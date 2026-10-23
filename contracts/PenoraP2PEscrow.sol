// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title PenoraP2PEscrow
 * @notice Complete, non-custodial peer-to-peer escrow marketplace for trading PNR and MockUSDT on Polygon Amoy.
 * @dev Supports:
 *   - Full and partial order fills with exact 6-to-18 decimal conversion & rounding protection
 *   - Minimum fill threshold preventing micro-dust spam attacks
 *   - Order expiration timestamps with automated or permissioned seller escrow recovery
 *   - Platform fee with strict hard-coded ceiling (100 bps / 1.00%)
 *   - Invariant-protected emergency recovery strictly restricted to unallocated surplus tokens
 *   - Atomic settlement: PNR escrow delivery and USDT transfer occur in the same transaction
 */
contract PenoraP2PEscrow is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable pnrToken;
    IERC20 public immutable usdtToken;

    uint256 public constant MAX_FEE_BPS = 100; // Strict maximum 1.00% platform fee
    uint256 public feeBps;                      // Configurable fee in basis points (e.g. 50 = 0.5%)
    address public feeRecipient;

    // Total PNR liabilities currently locked across all active uncancelled orders
    uint256 public totalPnrInEscrow;

    struct Offer {
        uint256 id;
        address seller;
        uint256 pnrAmount;       // Original total PNR escrowed (18 decimals)
        uint256 pnrRemaining;    // Current unfilled PNR balance in escrow (18 decimals)
        uint256 usdtPriceTotal;  // Original total USDT requested for the full order (6 decimals)
        uint256 minPnrFill;      // Minimum PNR fill size (18 decimals; 0 = no min)
        uint256 createdAt;
        uint256 expiresAt;      // Order expiration timestamp (0 = does not expire)
        bool cancelled;
    }

    uint256 public nextOfferId = 1;
    mapping(uint256 => Offer) public offers;

    event OfferCreated(
        uint256 indexed offerId,
        address indexed seller,
        uint256 pnrAmount,
        uint256 usdtPriceTotal,
        uint256 minPnrFill,
        uint256 expiresAt
    );
    event OfferFilled(
        uint256 indexed offerId,
        address indexed buyer,
        address indexed seller,
        uint256 pnrFilled,
        uint256 pnrRemaining,
        uint256 usdtPaid,
        uint256 fee
    );
    event OfferCancelled(uint256 indexed offerId, address indexed seller, uint256 pnrRefunded);
    event FeeUpdated(uint256 previousFeeBps, uint256 newFeeBps, address indexed recipient);
    event UnallocatedRecovered(address indexed token, address indexed recipient, uint256 amount);

    error InvalidConfiguration();
    error InvalidAmount();
    error OfferNotFound();
    error OfferNotActive();
    error OfferExpired();
    error FillBelowMinimum();
    error FillExceedsRemaining();
    error Unauthorized();
    error CannotBuyOwnOffer();
    error FeeTooHigh();
    error NoUnallocatedTokens();

    constructor(
        address pnr,
        address usdt,
        address initialOwner,
        uint256 initialFeeBps,
        address initialFeeRecipient
    ) Ownable(initialOwner) {
        if (pnr == address(0) || usdt == address(0) || pnr == usdt || initialOwner == address(0)) {
            revert InvalidConfiguration();
        }
        if (IERC20Metadata(pnr).decimals() != 18 || IERC20Metadata(usdt).decimals() != 6) {
            revert InvalidConfiguration();
        }
        if (initialFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (initialFeeBps > 0 && initialFeeRecipient == address(0)) revert InvalidConfiguration();

        pnrToken = IERC20(pnr);
        usdtToken = IERC20(usdt);
        feeBps = initialFeeBps;
        feeRecipient = initialFeeRecipient == address(0) ? initialOwner : initialFeeRecipient;

        emit FeeUpdated(0, initialFeeBps, feeRecipient);
    }

    /**
     * @notice Checks if an offer is currently active, uncancelled, non-empty, and unexpired.
     */
    function isOfferActive(uint256 offerId) public view returns (bool) {
        Offer storage offer = offers[offerId];
        if (offer.id == 0 || offer.cancelled || offer.pnrRemaining == 0) {
            return false;
        }
        if (offer.expiresAt > 0 && block.timestamp >= offer.expiresAt) {
            return false;
        }
        return true;
    }

    /**
     * @notice Creates a new P2P sell offer locking PNR tokens with optional minimum fill and expiration duration.
     * @param pnrAmount The total quantity of PNR tokens to escrow (18 decimals).
     * @param usdtPriceTotal The total price in MockUSDT (6 decimals) requested for the entire offer.
     * @param minPnrFill The minimum fill amount (18 decimals); 0 allows any partial fill.
     * @param durationSeconds Seconds until order expiration (0 = no expiration).
     */
    function createOffer(
        uint256 pnrAmount,
        uint256 usdtPriceTotal,
        uint256 minPnrFill,
        uint256 durationSeconds
    ) public nonReentrant whenNotPaused returns (uint256 offerId) {
        if (pnrAmount == 0 || usdtPriceTotal == 0) revert InvalidAmount();
        if (minPnrFill > pnrAmount) revert InvalidAmount();

        offerId = nextOfferId++;
        uint256 expiresAt = durationSeconds > 0 ? block.timestamp + durationSeconds : 0;

        offers[offerId] = Offer({
            id: offerId,
            seller: msg.sender,
            pnrAmount: pnrAmount,
            pnrRemaining: pnrAmount,
            usdtPriceTotal: usdtPriceTotal,
            minPnrFill: minPnrFill,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            cancelled: false
        });

        totalPnrInEscrow += pnrAmount;

        // Pull seller's PNR into escrow
        pnrToken.safeTransferFrom(msg.sender, address(this), pnrAmount);

        emit OfferCreated(offerId, msg.sender, pnrAmount, usdtPriceTotal, minPnrFill, expiresAt);
    }

    /**
     * @notice Convenience overload to create an offer without minimum fill threshold or expiration.
     */
    function createOffer(uint256 pnrAmount, uint256 usdtPriceTotal) external returns (uint256 offerId) {
        return createOffer(pnrAmount, usdtPriceTotal, 0, 0);
    }

    /**
     * @notice Partially or fully fills an active P2P offer.
     * @param offerId The ID of the offer to fulfill.
     * @param pnrToFill Quantity of PNR tokens to purchase (18 decimals).
     */
    function fillOffer(uint256 offerId, uint256 pnrToFill) public nonReentrant whenNotPaused {
        Offer storage offer = offers[offerId];
        if (offer.id == 0) revert OfferNotFound();
        if (offer.cancelled || offer.pnrRemaining == 0) revert OfferNotActive();
        if (offer.expiresAt > 0 && block.timestamp >= offer.expiresAt) revert OfferExpired();
        if (msg.sender == offer.seller) revert CannotBuyOwnOffer();
        if (pnrToFill == 0) revert InvalidAmount();
        if (pnrToFill > offer.pnrRemaining) revert FillExceedsRemaining();

        // Enforce minimum fill, unless taking the remaining balance so dust never stays locked
        if (offer.minPnrFill > 0 && pnrToFill < offer.pnrRemaining && pnrToFill < offer.minPnrFill) {
            revert FillBelowMinimum();
        }

        // Calculate exact proportional USDT cost, rounding CEIL in favor of seller solvency
        uint256 usdtToPay = Math.mulDiv(pnrToFill, offer.usdtPriceTotal, offer.pnrAmount, Math.Rounding.Ceil);
        if (usdtToPay == 0) revert InvalidAmount();

        uint256 fee = 0;
        if (feeBps > 0 && feeRecipient != address(0)) {
            fee = (usdtToPay * feeBps) / 10000;
        }
        uint256 netToSeller = usdtToPay - fee;

        // State update before external calls
        offer.pnrRemaining -= pnrToFill;
        totalPnrInEscrow -= pnrToFill;

        // 1. Transfer MockUSDT net to seller
        usdtToken.safeTransferFrom(msg.sender, offer.seller, netToSeller);

        // 2. Transfer fee in MockUSDT to feeRecipient (if any)
        if (fee > 0) {
            usdtToken.safeTransferFrom(msg.sender, feeRecipient, fee);
        }

        // 3. Deliver purchased PNR from escrow to buyer
        pnrToken.safeTransfer(msg.sender, pnrToFill);

        emit OfferFilled(
            offerId,
            msg.sender,
            offer.seller,
            pnrToFill,
            offer.pnrRemaining,
            usdtToPay,
            fee
        );
    }

    /**
     * @notice Convenience overload to fill the entirety of an offer's remaining balance.
     */
    function fillOffer(uint256 offerId) external {
        Offer storage offer = offers[offerId];
        if (offer.id == 0) revert OfferNotFound();
        fillOffer(offerId, offer.pnrRemaining);
    }

    /**
     * @notice Cancels an active or expired offer and refunds remaining escrowed PNR to the seller.
     * @dev Seller or contract owner can cancel anytime. If expired, anyone may trigger cancellation
     *      to return tokens back to the original seller.
     * @param offerId The ID of the offer to cancel.
     */
    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        if (offer.id == 0) revert OfferNotFound();
        if (offer.cancelled || offer.pnrRemaining == 0) revert OfferNotActive();

        bool isExpired = offer.expiresAt > 0 && block.timestamp >= offer.expiresAt;
        if (msg.sender != offer.seller && msg.sender != owner() && !isExpired) {
            revert Unauthorized();
        }

        uint256 refundAmount = offer.pnrRemaining;
        offer.cancelled = true;
        offer.pnrRemaining = 0;
        totalPnrInEscrow -= refundAmount;

        // Return escrowed PNR to seller
        pnrToken.safeTransfer(offer.seller, refundAmount);

        emit OfferCancelled(offerId, offer.seller, refundAmount);
    }

    /**
     * @notice Configures platform trading fee (strictly capped at 1.00%).
     */
    function setFee(uint256 nextFeeBps, address nextFeeRecipient) external onlyOwner {
        if (nextFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (nextFeeBps > 0 && nextFeeRecipient == address(0)) revert InvalidConfiguration();
        emit FeeUpdated(feeBps, nextFeeBps, nextFeeRecipient);
        feeBps = nextFeeBps;
        feeRecipient = nextFeeRecipient;
    }

    /**
     * @notice Sweeps accidentally sent tokens while strictly preserving all active PNR escrow liabilities.
     * @dev Contract PNR balance minus totalPnrInEscrow is the only unallocated surplus withdrawable.
     */
    function recoverUnallocated(address token, address recipient) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert InvalidConfiguration();

        if (token == address(pnrToken)) {
            uint256 balance = pnrToken.balanceOf(address(this));
            if (balance <= totalPnrInEscrow) revert NoUnallocatedTokens();
            uint256 unallocated = balance - totalPnrInEscrow;
            pnrToken.safeTransfer(recipient, unallocated);
            emit UnallocatedRecovered(token, recipient, unallocated);
        } else {
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance == 0) revert NoUnallocatedTokens();
            IERC20(token).safeTransfer(recipient, balance);
            emit UnallocatedRecovered(token, recipient, balance);
        }
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}

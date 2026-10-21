// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PenoraRewardDistributor
 * @notice Weekly creator and curator reward settlement engine for PENORA.
 * @dev Enforces a strict 48-hour challenge/review period after Merkle root publication,
 *      verifies cryptographic inclusion proofs, prevents double claims, and disburses
 *      100% liquid PNR directly to self-custodial creator wallets.
 */
contract PenoraRewardDistributor is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable pnrToken;

    uint256 public constant REVIEW_PERIOD = 48 hours; // 172,800 seconds

    struct Epoch {
        bytes32 merkleRoot;       // Merkle root of (creator, amount) leaves
        uint256 totalBudget;      // Total PNR allocated for this epoch
        uint256 totalClaimed;     // Cumulative PNR claimed by creators
        uint256 publishedAt;      // Timestamp when candidate root was submitted
        bool disputed;            // True if flagged/disputed during the 48-hour review
        bool funded;              // True if tokens were deposited into contract
    }

    // Mapping from epochId => Epoch metadata
    mapping(uint256 => Epoch) public epochs;

    // Mapping from epochId => creator address => hasClaimed
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    // Events
    event EpochPublished(uint256 indexed epochId, bytes32 merkleRoot, uint256 totalBudget, uint256 publishedAt);
    event EpochDisputed(uint256 indexed epochId, string reason, uint256 timestamp);
    event EpochResolved(uint256 indexed epochId, bytes32 newMerkleRoot, uint256 timestamp);
    event RewardClaimed(uint256 indexed epochId, address indexed creator, uint256 amount, uint256 timestamp);

    // Custom Errors
    error ZeroAddress();
    error ZeroAmount();
    error EpochAlreadyExists(uint256 epochId);
    error EpochNotFound(uint256 epochId);
    error EpochUnderReview(uint256 epochId, uint256 claimableAt);
    error EpochDisputedError(uint256 epochId);
    error AlreadyClaimed(uint256 epochId, address creator);
    error InvalidProof();
    error InsufficientContractBalance(uint256 required, uint256 actual);
    error ReviewPeriodPassed();
    error ReviewPeriodActive();

    constructor(address _pnrToken, address initialOwner) Ownable(initialOwner) {
        if (_pnrToken == address(0) || initialOwner == address(0)) revert ZeroAddress();
        pnrToken = IERC20(_pnrToken);
    }

    /**
     * @notice Submits a weekly epoch candidate Merkle root and funds the epoch budget.
     * @param epochId Sequential weekly epoch identifier (e.g., 1, 2, 3...).
     * @param merkleRoot Cryptographic Merkle root representing all creator and curator allocations.
     * @param totalBudget Total liquid PNR required to honor all proofs in this epoch.
     */
    function publishEpochRoot(
        uint256 epochId,
        bytes32 merkleRoot,
        uint256 totalBudget
    ) external onlyOwner whenNotPaused nonReentrant {
        if (epochId == 0) revert EpochNotFound(epochId);
        if (merkleRoot == bytes32(0)) revert InvalidProof();
        if (totalBudget == 0) revert ZeroAmount();

        Epoch storage epoch = epochs[epochId];
        if (epoch.publishedAt > 0) revert EpochAlreadyExists(epochId);

        // Fund the distributor contract with the exact epoch budget
        pnrToken.safeTransferFrom(msg.sender, address(this), totalBudget);

        epochs[epochId] = Epoch({
            merkleRoot: merkleRoot,
            totalBudget: totalBudget,
            totalClaimed: 0,
            publishedAt: block.timestamp,
            disputed: false,
            funded: true
        });

        emit EpochPublished(epochId, merkleRoot, totalBudget, block.timestamp);
    }

    /**
     * @notice Disputes an epoch during the 48-hour review window if fraud or sybil farming is verified.
     */
    function disputeEpoch(uint256 epochId, string calldata reason) external onlyOwner {
        Epoch storage epoch = epochs[epochId];
        if (epoch.publishedAt == 0) revert EpochNotFound(epochId);
        if (block.timestamp >= epoch.publishedAt + REVIEW_PERIOD) revert ReviewPeriodPassed();

        epoch.disputed = true;
        emit EpochDisputed(epochId, reason, block.timestamp);
    }

    /**
     * @notice Resolves a disputed epoch by updating the Merkle root after invalid claims are purged.
     */
    function resolveDispute(uint256 epochId, bytes32 newMerkleRoot) external onlyOwner {
        Epoch storage epoch = epochs[epochId];
        if (epoch.publishedAt == 0) revert EpochNotFound(epochId);
        if (!epoch.disputed) revert ReviewPeriodActive();

        epoch.merkleRoot = newMerkleRoot;
        epoch.disputed = false;
        epoch.publishedAt = block.timestamp; // Resets review window for the corrected root

        emit EpochResolved(epochId, newMerkleRoot, block.timestamp);
    }

    /**
     * @notice Claims a creator's verified 100% liquid PNR reward for an epoch.
     * @dev Enforces the 48-hour challenge review window and strict double-claim prevention.
     * @param epochId Sequential weekly epoch identifier.
     * @param creator Self-custodial address of the creator or curator.
     * @param amount Liquid PNR reward in 18-decimal base units.
     * @param merkleProof Cryptographic sibling hashes proving inclusion in the epoch root.
     */
    function claimCreatorReward(
        uint256 epochId,
        address creator,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external nonReentrant whenNotPaused {
        if (creator == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        Epoch storage epoch = epochs[epochId];
        if (epoch.publishedAt == 0) revert EpochNotFound(epochId);

        // 1. Verify 48-Hour Review Period has concluded
        uint256 unlockTimestamp = epoch.publishedAt + REVIEW_PERIOD;
        if (block.timestamp < unlockTimestamp) {
            revert EpochUnderReview(epochId, unlockTimestamp);
        }

        // 2. Verify epoch is not currently disputed
        if (epoch.disputed) revert EpochDisputedError(epochId);

        // 3. Verify creator has not already claimed for this epoch
        if (hasClaimed[epochId][creator]) revert AlreadyClaimed(epochId, creator);

        // 4. Verify cryptographic Merkle proof
        // Standard double-hash prevents second preimage attacks on 64-byte leaves
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(creator, amount))));
        if (!MerkleProof.verify(merkleProof, epoch.merkleRoot, leaf)) {
            revert InvalidProof();
        }

        // 5. Update state BEFORE external transfer (Checks-Effects-Interactions pattern)
        hasClaimed[epochId][creator] = true;
        epoch.totalClaimed += amount;

        // 6. Transfer 100% Liquid PNR to creator
        pnrToken.safeTransfer(creator, amount);

        emit RewardClaimed(epochId, creator, amount, block.timestamp);
    }

    /**
     * @notice Returns the settlement status of an epoch.
     */
    function getEpochStatus(uint256 epochId)
        external
        view
        returns (
            bool exists,
            bool isUnderReview,
            uint256 claimableAt,
            bool isDisputed,
            uint256 totalBudget,
            uint256 totalClaimed
        )
    {
        Epoch memory epoch = epochs[epochId];
        if (epoch.publishedAt == 0) return (false, false, 0, false, 0, 0);

        claimableAt = epoch.publishedAt + REVIEW_PERIOD;
        isUnderReview = (block.timestamp < claimableAt);

        return (
            true,
            isUnderReview,
            claimableAt,
            epoch.disputed,
            epoch.totalBudget,
            epoch.totalClaimed
        );
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}

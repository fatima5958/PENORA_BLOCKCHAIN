// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Inventory-backed, owner-priced PNR purchase desk. Not an order book or AMM.
/// @dev Intended for the existing Amoy testnet app; deployment and funding are separate actions.
contract PenoraExchange is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable pnrToken;
    IERC20 public immutable usdtToken;
    uint256 public pnrPerUsdt; // 18-decimal PNR units per whole six-decimal USDT.
    event RateUpdated(uint256 previousRate, uint256 newRate);
    event Purchased(address indexed buyer, uint256 usdtIn, uint256 pnrOut);
    error InvalidConfiguration();
    error InvalidAmount();
    error QuoteExpired();
    error MinimumOutput();
    error InsufficientInventory();
    error UnsupportedTransfer();
    constructor(address pnr, address usdt, address initialOwner, uint256 initialRate) Ownable(initialOwner) {
        if (pnr == address(0) || usdt == address(0) || pnr == usdt || initialRate == 0) revert InvalidConfiguration();
        if (IERC20Metadata(pnr).decimals() != 18 || IERC20Metadata(usdt).decimals() != 6) revert InvalidConfiguration();
        pnrToken = IERC20(pnr); usdtToken = IERC20(usdt); pnrPerUsdt = initialRate;
        emit RateUpdated(0, initialRate);
    }
    function quoteBuy(uint256 usdtIn) public view returns (uint256) {
        if (usdtIn == 0) revert InvalidAmount();
        uint256 output = Math.mulDiv(usdtIn, pnrPerUsdt, 1e6);
        if (output == 0) revert InvalidAmount();
        return output;
    }
    function buy(uint256 usdtIn, uint256 minimumPnr, uint256 deadline) external nonReentrant whenNotPaused returns (uint256 output) {
        if (block.timestamp > deadline) revert QuoteExpired();
        if (minimumPnr == 0) revert InvalidAmount();
        output = quoteBuy(usdtIn);
        if (output < minimumPnr) revert MinimumOutput();
        if (pnrToken.balanceOf(address(this)) < output) revert InsufficientInventory();
        uint256 previousUsdt = usdtToken.balanceOf(address(this));
        usdtToken.safeTransferFrom(msg.sender, address(this), usdtIn);
        if (usdtToken.balanceOf(address(this)) - previousUsdt != usdtIn) revert UnsupportedTransfer();
        uint256 previousPnr = pnrToken.balanceOf(msg.sender);
        pnrToken.safeTransfer(msg.sender, output);
        if (pnrToken.balanceOf(msg.sender) - previousPnr != output) revert UnsupportedTransfer();
        emit Purchased(msg.sender, usdtIn, output);
    }
    function setRate(uint256 nextRate) external onlyOwner {
        if (nextRate == 0) revert InvalidConfiguration();
        emit RateUpdated(pnrPerUsdt, nextRate); pnrPerUsdt = nextRate;
    }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    /// @notice Owner may recover inventory/proceeds. Liquidity is not guaranteed or locked.
    function withdraw(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
        if ((token != address(pnrToken) && token != address(usdtToken)) || recipient == address(0)) revert InvalidConfiguration();
        IERC20(token).safeTransfer(recipient, amount);
    }
}

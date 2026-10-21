// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDT
 * @notice OpenZeppelin-standard ERC-20 token simulating USDT for Polygon Amoy testnet testing.
 * @dev Explicitly uses 6 decimals to mirror production Tether USD mechanics.
 */
contract MockUSDT is ERC20, Ownable {
    uint8 private constant _DECIMALS = 6;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        address recipient
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        if (initialSupply > 0 && recipient != address(0)) {
            _mint(recipient, initialSupply);
        }
    }

    /**
     * @notice Overrides standard ERC20 decimals to return 6.
     */
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /**
     * @notice Allows test faucet minting for local testing / testnet staging.
     */
    function faucetMint(address to, uint256 amount) external {
        require(to != address(0), "Cannot mint to zero address");
        require(amount <= 10_000 * 10 ** _DECIMALS, "Exceeds faucet max limit");
        _mint(to, amount);
    }
}

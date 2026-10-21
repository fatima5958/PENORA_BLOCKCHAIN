// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PenoraToken (PNR)
 * @notice The official liquid, transferable utility and governance token of the PENORA ecosystem.
 * @dev Model A: Fixed Total Supply of exactly 100,000,000 PNR minted entirely at genesis.
 *      There is NO ongoing minting function. Programmatic inflation is permanently disabled.
 */
contract PenoraToken is ERC20, ERC20Burnable, Ownable2Step, Pausable {
    uint256 public constant TOTAL_FIXED_SUPPLY = 100_000_000 * 10 ** 18; // Exactly 100M PNR

    event TokensDistributedAtGenesis(address indexed initialVault, uint256 amount);

    error ZeroAddress();

    /**
     * @notice Deploys PNR token and mints the entire fixed 100,000,000 supply to the designated initial vault/owner.
     * @param initialVault Address of the treasury/allocation vault holding genesis tokens for distribution.
     */
    constructor(address initialVault)
        ERC20("PENORA Token", "PNR")
        Ownable(initialVault)
    {
        if (initialVault == address(0)) revert ZeroAddress();

        // Mint the entire fixed supply once at genesis
        _mint(initialVault, TOTAL_FIXED_SUPPLY);
        emit TokensDistributedAtGenesis(initialVault, TOTAL_FIXED_SUPPLY);
    }

    /**
     * @notice Emergency pause for token transfers in the event of an ecosystem security incident.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause token transfers once security verification is complete.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Hook override enforcing whenNotPaused for transfers.
     */
    function _update(address from, address to, uint256 value)
        internal
        override
        whenNotPaused
    {
        super._update(from, to, value);
    }
}

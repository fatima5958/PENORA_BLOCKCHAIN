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
 *      Includes a sovereign treasury vault held directly within the contract (address(this))
 *      allowing the owner to release protocol allocations safely without extra vault deployments.
 */
contract PenoraToken is ERC20, ERC20Burnable, Ownable2Step, Pausable {
    uint256 public constant TOTAL_FIXED_SUPPLY = 100_000_000 * 10 ** 18; // Exactly 100M PNR

    event TokensDistributedAtGenesis(address indexed initialVault, uint256 amount);
    event TreasuryTokensReleased(address indexed to, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientTreasuryBalance(uint256 requested, uint256 available);

    /**
     * @notice Deploys PNR token and mints the entire fixed 100,000,000 supply at genesis:
     *         - If initialTester and testAllocation are provided, testAllocation is minted directly to initialTester,
     *           and the remaining balance is minted into the contract's sovereign treasury vault (address(this)).
     *         - If initialTester is address(0) or testAllocation is 0, all 100M tokens are minted to initialOwner.
     * @param initialOwner Address of the owner who controls treasury release and contract administration.
     * @param initialTester Address receiving the immediate testing allocation (or address(0) for full owner allocation).
     * @param testAllocation Amount in wei of the testing allocation (e.g. 10,000 * 10^18).
     */
    constructor(
        address initialOwner,
        address initialTester,
        uint256 testAllocation
    )
        ERC20("PENORA Token", "PNR")
        Ownable(initialOwner)
    {
        if (initialOwner == address(0)) revert ZeroAddress();
        require(testAllocation <= TOTAL_FIXED_SUPPLY, "Exceeds total supply");

        if (initialTester == address(0) || testAllocation == 0) {
            _mint(initialOwner, TOTAL_FIXED_SUPPLY);
            emit TokensDistributedAtGenesis(initialOwner, TOTAL_FIXED_SUPPLY);
        } else {
            uint256 treasuryAmount = TOTAL_FIXED_SUPPLY - testAllocation;

            // Mint testing allocation to tester wallet
            _mint(initialTester, testAllocation);
            emit TokensDistributedAtGenesis(initialTester, testAllocation);

            // Mint remaining supply to the contract's sovereign treasury vault
            if (treasuryAmount > 0) {
                _mint(address(this), treasuryAmount);
                emit TokensDistributedAtGenesis(address(this), treasuryAmount);
            }
        }
    }

    /**
     * @notice Releases tokens from the sovereign treasury vault to authorized protocol pools or reward vaults.
     * @param to Destination address (e.g. PenoraRewardVault, Liquidity Pool, Ecosystem Fund).
     * @param amount Amount of PNR tokens to release.
     */
    function releaseTreasuryTokens(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 available = balanceOf(address(this));
        if (amount > available) revert InsufficientTreasuryBalance(amount, available);

        _transfer(address(this), to, amount);
        emit TreasuryTokensReleased(to, amount);
    }

    /**
     * @notice Returns the amount of PNR currently held in the contract's sovereign treasury vault.
     */
    function getTreasuryBalance() external view returns (uint256) {
        return balanceOf(address(this));
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

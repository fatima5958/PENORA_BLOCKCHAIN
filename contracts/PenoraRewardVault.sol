// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PenoraRewardVault
 * @notice Holds the 40,000,000 PNR Creator Rewards Pool:
 *         - 30,000,000 PNR scheduled for emission over the 5-year creator plan.
 *         - 10,000,000 PNR protected longevity reserve (timelocked and non-emitting).
 * @dev Enforces strict ceiling on scheduled releases and protects the 10M reserve.
 */
contract PenoraRewardVault is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable pnrToken;

    uint256 public constant TOTAL_SCHEDULED_BUDGET = 30_000_000 * 10 ** 18; // 30M PNR
    uint256 public constant PROTECTED_RESERVE      = 10_000_000 * 10 ** 18; // 10M PNR

    address public rewardDistributor;
    uint256 public totalScheduledReleased;
    bool public protectedReserveUnlocked;

    event ScheduledTokensReleased(address indexed distributor, uint256 amount, uint256 totalReleased);
    event DistributorUpdated(address indexed previousDistributor, address indexed newDistributor);
    event ProtectedReserveUnlocked(uint256 timestamp);

    error ZeroAddress();
    error ZeroAmount();
    error UnauthorizedDistributor();
    error ScheduledBudgetExceeded(uint256 requested, uint256 available);
    error ProtectedReserveLocked();

    modifier onlyDistributor() {
        if (msg.sender != rewardDistributor && msg.sender != owner()) {
            revert UnauthorizedDistributor();
        }
        _;
    }

    constructor(address _pnrToken, address initialOwner) Ownable(initialOwner) {
        if (_pnrToken == address(0) || initialOwner == address(0)) revert ZeroAddress();
        pnrToken = IERC20(_pnrToken);
    }

    /**
     * @notice Configures the authorized PenoraRewardDistributor contract.
     */
    function setRewardDistributor(address _distributor) external onlyOwner {
        if (_distributor == address(0)) revert ZeroAddress();
        emit DistributorUpdated(rewardDistributor, _distributor);
        rewardDistributor = _distributor;
    }

    /**
     * @notice Releases a tranche of scheduled reward tokens to the distributor for an epoch.
     * @param to Destination address (typically the PenoraRewardDistributor contract).
     * @param amount Token amount in 18-decimal base units.
     */
    function releaseScheduledTokens(address to, uint256 amount) external onlyDistributor nonReentrant whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        if (totalScheduledReleased + amount > TOTAL_SCHEDULED_BUDGET) {
            revert ScheduledBudgetExceeded(amount, TOTAL_SCHEDULED_BUDGET - totalScheduledReleased);
        }

        totalScheduledReleased += amount;
        pnrToken.safeTransfer(to, amount);

        emit ScheduledTokensReleased(to, amount, totalScheduledReleased);
    }

    /**
     * @notice Supermajority governance emergency activation for the 10M protected reserve.
     * @dev Restricted to the two-step contract owner (e.g., Timelock DAO controller).
     */
    function unlockProtectedReserve() external onlyOwner {
        protectedReserveUnlocked = true;
        emit ProtectedReserveUnlocked(block.timestamp);
    }

    /**
     * @notice Returns remaining unreleased scheduled budget.
     */
    function getRemainingScheduledBudget() external view returns (uint256) {
        return TOTAL_SCHEDULED_BUDGET - totalScheduledReleased;
    }

    /**
     * @notice Solvency invariant check ensuring the vault maintains exact token liabilities.
     */
    function verifyVaultSolvency() external view returns (bool isSolvent, uint256 currentBalance, uint256 requiredReserve) {
        currentBalance = pnrToken.balanceOf(address(this));
        requiredReserve = (TOTAL_SCHEDULED_BUDGET - totalScheduledReleased) + (protectedReserveUnlocked ? 0 : PROTECTED_RESERVE);
        isSolvent = (currentBalance >= requiredReserve);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}

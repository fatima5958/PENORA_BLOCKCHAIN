// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title PenoraPowerEscrow
 * @notice Trustless staking, vesting, and non-transferable PENORA Power (PP) escrow contract.
 * @dev Enforces 1 PNR = 1 PP backing. Manages the 13-week Power Down withdrawal schedule.
 *      Admin ownership is restricted: admins CANNOT withdraw user funds or alter user balances.
 */
contract PenoraPowerEscrow is ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    IERC20 public immutable pnrToken;

    uint256 public constant INSTALLMENT_COUNT = 13;
    uint256 public constant WEEK_DURATION = 7 days; // 604,800 seconds

    struct PowerDownSchedule {
        uint256 totalAmount;       // Total PNR requested for 13-week withdrawal
        uint256 weeklyInstallment; // Base weekly installment: totalAmount / 13
        uint256 remainder;         // Rounding remainder: totalAmount % 13 (paid in week 13)
        uint256 startTime;         // Timestamp when power down was initialized
        uint256 weeksClaimed;      // Number of installments already withdrawn (0..13)
        bool active;               // Whether a withdrawal schedule is currently in flight
    }

    // Total locked PNR held in escrow representing all outstanding PENORA Power
    uint256 public totalLockedPower;

    // Mapping from creator address to their total locked PENORA Power (PP)
    mapping(address => uint256) public lockedPower;

    // Mapping from creator address to their active 13-week Power Down schedule
    mapping(address => PowerDownSchedule) public powerDownSchedules;

    // ──────────────────────── EVENTS ────────────────────────
    event PowerUp(address indexed caller, address indexed recipient, uint256 amount, uint256 timestamp);
    event PowerDownStarted(address indexed user, uint256 totalAmount, uint256 weeklyInstallment, uint256 remainder, uint256 startTime);
    event InstallmentClaimed(address indexed user, uint256 amountClaimed, uint256 totalWeeksClaimed, uint256 timestamp);
    event PowerDownCancelled(address indexed user, uint256 restoredPower, uint256 maturedClaimed, uint256 timestamp);

    // ──────────────────────── CUSTOM ERRORS ────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientPower(uint256 requested, uint256 available);
    error PowerDownAlreadyActive();
    error NoActivePowerDown();
    error NoMaturedInstallments(uint256 nextUnlockTimestamp);
    error InvariantViolated(uint256 contractBalance, uint256 requiredLiabilities);

    constructor(address _pnrToken, address initialOwner) Ownable(initialOwner) {
        if (_pnrToken == address(0) || initialOwner == address(0)) revert ZeroAddress();
        pnrToken = IERC20(_pnrToken);
    }

    // ──────────────────────── 1. POWER UP (STAKING) ────────────────────────

    /**
     * @notice Stakes liquid PNR to receive non-transferable PENORA Power (PP) for the caller.
     * @param amount Token amount in 18-decimal base units.
     */
    function powerUp(uint256 amount) external nonReentrant whenNotPaused {
        _executePowerUp(msg.sender, msg.sender, amount);
    }

    /**
     * @notice Stakes liquid PNR on behalf of another PENORA creator.
     * @param recipient Creator address to receive the credited PENORA Power.
     * @param amount Token amount in 18-decimal base units.
     */
    function powerUpFor(address recipient, uint256 amount) external nonReentrant whenNotPaused {
        if (recipient == address(0)) revert ZeroAddress();
        _executePowerUp(msg.sender, recipient, amount);
    }

    function _executePowerUp(address caller, address recipient, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();

        // Transfer PNR into escrow contract
        pnrToken.safeTransferFrom(caller, address(this), amount);

        // Credit PENORA Power 1:1
        lockedPower[recipient] += amount;
        totalLockedPower += amount;

        emit PowerUp(caller, recipient, amount, block.timestamp);
    }

    // ──────────────────────── 2. POWER DOWN (13-WEEK SCHEDULE) ────────────────────────

    /**
     * @notice Initiates a 13-week linear Power Down schedule.
     * @dev Only one schedule may be active per account to guarantee unambiguous, deterministic accounting.
     *      Funds unlock in 13 weekly installments. First installment unlocks at (block.timestamp + 7 days).
     * @param amount Total PENORA Power to withdraw over 13 weeks.
     */
    function startPowerDown(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        PowerDownSchedule storage schedule = powerDownSchedules[msg.sender];
        if (schedule.active) revert PowerDownAlreadyActive();

        uint256 available = getAvailablePower(msg.sender);
        if (amount > available) revert InsufficientPower(amount, available);

        uint256 weeklyInstallment = amount / INSTALLMENT_COUNT;
        uint256 remainder = amount - (weeklyInstallment * INSTALLMENT_COUNT);

        schedule.totalAmount = amount;
        schedule.weeklyInstallment = weeklyInstallment;
        schedule.remainder = remainder;
        schedule.startTime = block.timestamp;
        schedule.weeksClaimed = 0;
        schedule.active = true;

        emit PowerDownStarted(msg.sender, amount, weeklyInstallment, remainder, block.timestamp);
    }

    /**
     * @notice Claims any matured weekly installments.
     * @dev Permissionless user-driven claim. No centralized cron or backend bot required.
     * @return claimedAmount The exact amount of liquid PNR transferred to the user.
     */
    function claimInstallments() external nonReentrant whenNotPaused returns (uint256 claimedAmount) {
        return _executeClaim(msg.sender);
    }

    function _executeClaim(address user) internal returns (uint256 claimedAmount) {
        PowerDownSchedule storage schedule = powerDownSchedules[user];
        if (!schedule.active) revert NoActivePowerDown();

        (uint256 maturedWeeks, uint256 claimableWeeks, uint256 payout) = getClaimableDetails(user);

        if (claimableWeeks == 0) {
            uint256 nextUnlock = schedule.startTime + ((schedule.weeksClaimed + 1) * WEEK_DURATION);
            revert NoMaturedInstallments(nextUnlock);
        }

        schedule.weeksClaimed = maturedWeeks;
        if (schedule.weeksClaimed == INSTALLMENT_COUNT) {
            schedule.active = false;
        }

        // Deduct from locked power and total locked power
        lockedPower[user] -= payout;
        totalLockedPower -= payout;

        // Transfer matured liquid PNR to user
        pnrToken.safeTransfer(user, payout);

        emit InstallmentClaimed(user, payout, maturedWeeks, block.timestamp);
        return payout;
    }

    /**
     * @notice Cancels an active Power Down schedule.
     * @dev Automatically claims any already-matured installments and immediately restores
     *      all remaining unvested installments to active PENORA Power.
     */
    function cancelPowerDown() external nonReentrant whenNotPaused {
        PowerDownSchedule storage schedule = powerDownSchedules[msg.sender];
        if (!schedule.active) revert NoActivePowerDown();

        // 1. Claim any matured installments first
        (, uint256 claimableWeeks, uint256 maturedPayout) = getClaimableDetails(msg.sender);
        if (claimableWeeks > 0) {
            _executeClaim(msg.sender);
        }

        // 2. Compute remaining unvested installments
        uint256 remainingUnvestedWeeks = INSTALLMENT_COUNT - schedule.weeksClaimed;
        uint256 restoredPower = remainingUnvestedWeeks * schedule.weeklyInstallment;
        if (schedule.weeksClaimed < INSTALLMENT_COUNT) {
            restoredPower += schedule.remainder;
        }

        // Deactivate schedule; restored power is immediately back in active/voting capacity
        schedule.active = false;

        emit PowerDownCancelled(msg.sender, restoredPower, maturedPayout, block.timestamp);
    }

    // ──────────────────────── 3. VIEW & INFLUENCE QUERIES ────────────────────────

    /**
     * @notice Returns the available PENORA Power for governance and voting mana.
     * @dev Active power-down liabilities are deducted immediately from available influence.
     */
    function getAvailablePower(address user) public view returns (uint256) {
        uint256 total = lockedPower[user];
        PowerDownSchedule memory schedule = powerDownSchedules[user];

        if (!schedule.active) {
            return total;
        }

        // Remaining withdrawal amount committed to power down
        uint256 remainingInstallments = INSTALLMENT_COUNT - schedule.weeksClaimed;
        uint256 pendingWithdrawal = remainingInstallments * schedule.weeklyInstallment;
        if (schedule.weeksClaimed < INSTALLMENT_COUNT) {
            pendingWithdrawal += schedule.remainder;
        }

        if (pendingWithdrawal >= total) {
            return 0;
        }
        return total - pendingWithdrawal;
    }

    /**
     * @notice Computes matured weeks, claimable weeks, and total payout for a user's schedule.
     */
    function getClaimableDetails(address user)
        public
        view
        returns (uint256 maturedWeeks, uint256 claimableWeeks, uint256 payout)
    {
        PowerDownSchedule memory schedule = powerDownSchedules[user];
        if (!schedule.active) return (0, 0, 0);

        uint256 elapsed = block.timestamp - schedule.startTime;
        uint256 calculatedMatured = elapsed / WEEK_DURATION;
        maturedWeeks = calculatedMatured > INSTALLMENT_COUNT ? INSTALLMENT_COUNT : calculatedMatured;

        if (maturedWeeks <= schedule.weeksClaimed) {
            return (maturedWeeks, 0, 0);
        }

        claimableWeeks = maturedWeeks - schedule.weeksClaimed;
        payout = claimableWeeks * schedule.weeklyInstallment;

        // If the 13th installment is reached in this claim, include the integer division remainder
        if (maturedWeeks == INSTALLMENT_COUNT && schedule.weeksClaimed < INSTALLMENT_COUNT) {
            payout += schedule.remainder;
        }
    }

    /**
     * @notice Returns next unlock timestamp for an active power down schedule.
     */
    function getNextUnlockTimestamp(address user) external view returns (uint256) {
        PowerDownSchedule memory schedule = powerDownSchedules[user];
        if (!schedule.active || schedule.weeksClaimed >= INSTALLMENT_COUNT) {
            return 0;
        }
        return schedule.startTime + ((schedule.weeksClaimed + 1) * WEEK_DURATION);
    }

    /**
     * @notice Invariant verification function.
     * @dev Asserts contract PNR holdings are greater than or equal to total locked power liabilities.
     */
    function verifySolvencyInvariant() external view returns (bool isSolvent, uint256 balance, uint256 liabilities) {
        balance = pnrToken.balanceOf(address(this));
        liabilities = totalLockedPower;
        isSolvent = (balance >= liabilities);
    }

    // ──────────────────────── 4. EMERGENCY CONTROLS ────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./PenoraPowerEscrow.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title PenoraPowerDelegation
 * @notice PENORA Power (PP) Delegation Smart Contract.
 * @dev Allows creators to delegate voting influence without transferring underlying token ownership.
 *      - Staker retains 100% custody of underlying staked PNR in PenoraPowerEscrow.
 *      - Recipient receives temporary voting influence only.
 *      - Strictly prohibits recursive delegation (cannot delegate received power).
 *      - Prevents double-counting and ensures zero-sum voting influence distribution.
 *      - Full active delegation tracking and historical audit trail.
 */
contract PenoraPowerDelegation is ReentrancyGuard, Pausable, Ownable2Step {
    PenoraPowerEscrow public immutable escrow;

    // Struct for active delegation information
    struct DelegationInfo {
        address delegator;
        address delegatee;
        uint256 amount;
        uint256 timestamp;
    }

    // Struct for delegation audit history
    struct DelegationRecord {
        address delegatee;
        uint256 amount;
        uint256 timestamp;
        bool isRevocation;
    }

    // delegator => delegatee => delegated PP amount
    mapping(address => mapping(address => uint256)) public delegations;

    // delegator => delegatee => last update timestamp
    mapping(address => mapping(address => uint256)) public delegationTimestamps;

    // Total PP currently delegated out by delegator
    mapping(address => uint256) public totalDelegatedOut;

    // Total PP currently received by delegatee from all delegators
    mapping(address => uint256) public totalReceivedPower;

    // Active delegatee list tracking for each delegator
    mapping(address => address[]) private _activeDelegatees;
    mapping(address => mapping(address => uint256)) private _delegateeIndex; // 1-based index

    // Active delegator list tracking for each delegatee
    mapping(address => address[]) private _activeDelegators;
    mapping(address => mapping(address => uint256)) private _delegatorIndex; // 1-based index

    // History of delegation actions per delegator
    mapping(address => DelegationRecord[]) private _delegationHistory;

    // ──────────────────────── EVENTS ────────────────────────
    event PowerDelegated(address indexed delegator, address indexed delegatee, uint256 amount, uint256 timestamp);
    event DelegationModified(address indexed delegator, address indexed delegatee, uint256 previousAmount, uint256 newAmount, uint256 timestamp);
    event DelegationRevoked(address indexed delegator, address indexed delegatee, uint256 revokedAmount, uint256 timestamp);

    // ──────────────────────── CUSTOM ERRORS ────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error CannotDelegateToSelf();
    error ExceedsAvailablePower(uint256 requested, uint256 available);
    error NoActiveDelegation(address delegator, address delegatee);
    error DelegationIdentical();

    constructor(address _escrow, address initialOwner) Ownable(initialOwner) {
        if (_escrow == address(0) || initialOwner == address(0)) revert ZeroAddress();
        escrow = PenoraPowerEscrow(_escrow);
    }

    // ──────────────────────── CORE ACTIONS ────────────────────────

    /**
     * @notice Delegates a specific amount of PENORA Power to another creator.
     * @param delegatee Recipient of the voting power.
     * @param amount Amount of PENORA Power (18-decimal base units) to delegate.
     */
    function delegatePower(address delegatee, uint256 amount) external nonReentrant whenNotPaused {
        if (delegatee == address(0)) revert ZeroAddress();
        if (delegatee == msg.sender) revert CannotDelegateToSelf();
        if (amount == 0) revert ZeroAmount();

        uint256 current = delegations[msg.sender][delegatee];
        if (amount == current) revert DelegationIdentical();

        _setDelegation(msg.sender, delegatee, amount, current);
    }

    /**
     * @notice Modifies an existing delegation to a new target amount.
     * @param delegatee Recipient of the delegation.
     * @param newAmount Target amount (if 0, revokes the delegation).
     */
    function modifyDelegation(address delegatee, uint256 newAmount) external nonReentrant whenNotPaused {
        if (delegatee == address(0)) revert ZeroAddress();
        if (delegatee == msg.sender) revert CannotDelegateToSelf();

        uint256 current = delegations[msg.sender][delegatee];
        if (current == 0) revert NoActiveDelegation(msg.sender, delegatee);
        if (newAmount == current) revert DelegationIdentical();

        if (newAmount == 0) {
            _revokeDelegation(msg.sender, delegatee, current);
        } else {
            _setDelegation(msg.sender, delegatee, newAmount, current);
        }
    }

    /**
     * @notice Completely revokes an active delegation to a recipient.
     * @param delegatee Recipient of the delegation.
     */
    function revokeDelegation(address delegatee) external nonReentrant whenNotPaused {
        if (delegatee == address(0)) revert ZeroAddress();
        uint256 current = delegations[msg.sender][delegatee];
        if (current == 0) revert NoActiveDelegation(msg.sender, delegatee);

        _revokeDelegation(msg.sender, delegatee, current);
    }

    // ──────────────────────── INTERNAL ACCOUNTING ────────────────────────

    function _setDelegation(address delegator, address delegatee, uint256 newAmount, uint256 currentAmount) internal {
        // Enforce delegator solvency: can ONLY delegate from own active staked power (never from received power)
        uint256 ownActivePower = escrow.getAvailablePower(delegator);
        uint256 existingDelegatedOut = totalDelegatedOut[delegator];

        if (newAmount > currentAmount) {
            uint256 increase = newAmount - currentAmount;
            uint256 maxAdditional = ownActivePower > existingDelegatedOut ? ownActivePower - existingDelegatedOut : 0;
            if (increase > maxAdditional) {
                revert ExceedsAvailablePower(newAmount, ownActivePower - (existingDelegatedOut - currentAmount));
            }
            totalDelegatedOut[delegator] = existingDelegatedOut + increase;
            totalReceivedPower[delegatee] += increase;
        } else {
            uint256 decrease = currentAmount - newAmount;
            totalDelegatedOut[delegator] = existingDelegatedOut - decrease;
            totalReceivedPower[delegatee] -= decrease;
        }

        delegations[delegator][delegatee] = newAmount;
        delegationTimestamps[delegator][delegatee] = block.timestamp;

        // Manage active tracking lists
        if (currentAmount == 0) {
            _addActiveDelegatee(delegator, delegatee);
            _addActiveDelegator(delegatee, delegator);
            emit PowerDelegated(delegator, delegatee, newAmount, block.timestamp);
        } else {
            emit DelegationModified(delegator, delegatee, currentAmount, newAmount, block.timestamp);
        }

        _delegationHistory[delegator].push(DelegationRecord({
            delegatee: delegatee,
            amount: newAmount,
            timestamp: block.timestamp,
            isRevocation: false
        }));
    }

    function _revokeDelegation(address delegator, address delegatee, uint256 currentAmount) internal {
        totalDelegatedOut[delegator] -= currentAmount;
        totalReceivedPower[delegatee] -= currentAmount;
        delegations[delegator][delegatee] = 0;
        delegationTimestamps[delegator][delegatee] = 0;

        _removeActiveDelegatee(delegator, delegatee);
        _removeActiveDelegator(delegatee, delegator);

        emit DelegationRevoked(delegator, delegatee, currentAmount, block.timestamp);

        _delegationHistory[delegator].push(DelegationRecord({
            delegatee: delegatee,
            amount: 0,
            timestamp: block.timestamp,
            isRevocation: true
        }));
    }

    function _addActiveDelegatee(address delegator, address delegatee) internal {
        if (_delegateeIndex[delegator][delegatee] == 0) {
            _activeDelegatees[delegator].push(delegatee);
            _delegateeIndex[delegator][delegatee] = _activeDelegatees[delegator].length;
        }
    }

    function _removeActiveDelegatee(address delegator, address delegatee) internal {
        uint256 index = _delegateeIndex[delegator][delegatee];
        if (index > 0) {
            uint256 lastIdx = _activeDelegatees[delegator].length;
            if (index != lastIdx) {
                address lastDelegatee = _activeDelegatees[delegator][lastIdx - 1];
                _activeDelegatees[delegator][index - 1] = lastDelegatee;
                _delegateeIndex[delegator][lastDelegatee] = index;
            }
            _activeDelegatees[delegator].pop();
            delete _delegateeIndex[delegator][delegatee];
        }
    }

    function _addActiveDelegator(address delegatee, address delegator) internal {
        if (_delegatorIndex[delegatee][delegator] == 0) {
            _activeDelegators[delegatee].push(delegator);
            _delegatorIndex[delegatee][delegator] = _activeDelegators[delegatee].length;
        }
    }

    function _removeActiveDelegator(address delegatee, address delegator) internal {
        uint256 index = _delegatorIndex[delegatee][delegator];
        if (index > 0) {
            uint256 lastIdx = _activeDelegators[delegatee].length;
            if (index != lastIdx) {
                address lastDelegator = _activeDelegators[delegatee][lastIdx - 1];
                _activeDelegators[delegatee][index - 1] = lastDelegator;
                _delegatorIndex[delegatee][lastDelegator] = index;
            }
            _activeDelegators[delegatee].pop();
            delete _delegatorIndex[delegatee][delegator];
        }
    }

    // ──────────────────────── VIEWS & INFLUENCE CALCULATION ────────────────────────

    /**
     * @notice Returns the available PENORA Power a user can delegate out.
     * @dev Strictly bounded by the user's unencumbered staked power in the escrow contract.
     *      Received power CANNOT be re-delegated (prevents recursive / circular exploits).
     */
    function getAvailableToDelegate(address user) public view returns (uint256) {
        uint256 activeStaked = escrow.getAvailablePower(user);
        uint256 delegatedOut = totalDelegatedOut[user];
        return activeStaked > delegatedOut ? activeStaked - delegatedOut : 0;
    }

    /**
     * @notice Computes effective voting power for a user incorporating delegations.
     * @dev Effective Power = max(0, Own Active Staked Power - Delegated Out) + Received Power.
     */
    function getEffectiveVotingPower(address user) public view returns (uint256) {
        uint256 activeStaked = escrow.getAvailablePower(user);
        uint256 delegatedOut = totalDelegatedOut[user];
        uint256 received = totalReceivedPower[user];

        uint256 ownRetained = activeStaked > delegatedOut ? activeStaked - delegatedOut : 0;
        return ownRetained + received;
    }

    /**
     * @notice Returns complete list of active delegations granted by a delegator.
     */
    function getActiveDelegations(address delegator) external view returns (DelegationInfo[] memory) {
        address[] memory delegatees = _activeDelegatees[delegator];
        uint256 count = delegatees.length;
        DelegationInfo[] memory list = new DelegationInfo[](count);

        for (uint256 i = 0; i < count; i++) {
            address d = delegatees[i];
            list[i] = DelegationInfo({
                delegator: delegator,
                delegatee: d,
                amount: delegations[delegator][d],
                timestamp: delegationTimestamps[delegator][d]
            });
        }
        return list;
    }

    /**
     * @notice Returns complete list of active delegations received by a delegatee.
     */
    function getReceivedDelegations(address delegatee) external view returns (DelegationInfo[] memory) {
        address[] memory delegators = _activeDelegators[delegatee];
        uint256 count = delegators.length;
        DelegationInfo[] memory list = new DelegationInfo[](count);

        for (uint256 i = 0; i < count; i++) {
            address d = delegators[i];
            list[i] = DelegationInfo({
                delegator: d,
                delegatee: delegatee,
                amount: delegations[d][delegatee],
                timestamp: delegationTimestamps[d][delegatee]
            });
        }
        return list;
    }

    /**
     * @notice Returns audit history of all delegation events for a delegator.
     */
    function getDelegationHistory(address delegator) external view returns (DelegationRecord[] memory) {
        return _delegationHistory[delegator];
    }

    /**
     * @notice Verifies token conservation: confirms delegation contract holds zero tokens.
     */
    function verifyTokenConservation() external view returns (bool isConserved, uint256 contractBalance) {
        contractBalance = escrow.pnrToken().balanceOf(address(this));
        isConserved = (contractBalance == 0);
    }

    // ──────────────────────── EMERGENCY CONTROLS ────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}

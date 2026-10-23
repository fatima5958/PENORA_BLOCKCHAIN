// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./PenoraPowerEscrow.sol";
import "./PenoraPowerDelegation.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title PenoraVotingInfluenceV2
 * @notice Content-voting influence engine supporting PENORA Power Delegation.
 * @dev Combines escrow-staked power and active delegated influence seamlessly.
 */
contract PenoraVotingInfluenceV2 is Ownable2Step {
    PenoraPowerEscrow public immutable escrow;
    PenoraPowerDelegation public immutable delegation;

    uint256 public constant MAX_MANA_BPS = 10_000;         // 100.00% capacity
    uint256 public constant REGENERATION_TIME = 5 days;     // 432,000 seconds for 100% recharge
    uint256 public constant VOTE_COST_DIVISOR = 50;        // 100% vote weight consumes 2% (200 bps) of mana

    struct ManaAccount {
        uint256 lastManaBps;       // Mana level at last update (0..10000)
        uint256 lastUpdateTimestamp; // Timestamp of last vote or interaction
    }

    mapping(address => ManaAccount) public userMana;
    mapping(bytes32 => mapping(address => bool)) public hasVotedOnContent;

    event VoteInfluenceCast(
        bytes32 indexed contentId,
        address indexed voter,
        uint256 voteWeightBps,
        uint256 remainingManaBps,
        uint256 effectiveInfluence,
        int8 direction // +1 upvote, -1 downvote
    );

    error ZeroAddress();
    error InvalidWeight(uint256 weightBps);
    error AlreadyVoted(bytes32 contentId, address voter);
    error InsufficientMana();
    error ZeroVotingPower();

    constructor(address _escrow, address _delegation, address initialOwner) Ownable(initialOwner) {
        if (_escrow == address(0) || initialOwner == address(0)) revert ZeroAddress();
        escrow = PenoraPowerEscrow(_escrow);
        delegation = PenoraPowerDelegation(_delegation);
    }

    function getCurrentMana(address user) public view returns (uint256) {
        ManaAccount memory account = userMana[user];
        if (account.lastUpdateTimestamp == 0) {
            return MAX_MANA_BPS;
        }

        uint256 elapsed = block.timestamp - account.lastUpdateTimestamp;
        if (elapsed >= REGENERATION_TIME) {
            return MAX_MANA_BPS;
        }

        uint256 regenerated = (elapsed * MAX_MANA_BPS) / REGENERATION_TIME;
        uint256 total = account.lastManaBps + regenerated;
        return total > MAX_MANA_BPS ? MAX_MANA_BPS : total;
    }

    /**
     * @notice Returns the effective voting power of the voter taking delegations into account.
     */
    function getVoterEffectivePower(address voter) public view returns (uint256) {
        if (address(delegation) != address(0)) {
            return delegation.getEffectiveVotingPower(voter);
        }
        return escrow.getAvailablePower(voter);
    }

    function previewVoteInfluence(address voter, uint256 voteWeightBps)
        external
        view
        returns (uint256 effectiveInfluence, uint256 postVoteManaBps)
    {
        if (voteWeightBps == 0 || voteWeightBps > MAX_MANA_BPS) revert InvalidWeight(voteWeightBps);

        uint256 availablePP = getVoterEffectivePower(voter);
        uint256 currentMana = getCurrentMana(voter);

        uint256 consumed = (currentMana * voteWeightBps) / (MAX_MANA_BPS * VOTE_COST_DIVISOR);
        postVoteManaBps = consumed >= currentMana ? 0 : currentMana - consumed;

        effectiveInfluence = (availablePP * voteWeightBps * currentMana) / (MAX_MANA_BPS * MAX_MANA_BPS);
    }

    function recordContentVote(
        bytes32 contentId,
        uint256 voteWeightBps,
        bool isUpvote
    ) external returns (uint256 influence) {
        if (voteWeightBps == 0 || voteWeightBps > MAX_MANA_BPS) revert InvalidWeight(voteWeightBps);
        if (hasVotedOnContent[contentId][msg.sender]) revert AlreadyVoted(contentId, msg.sender);

        uint256 availablePP = getVoterEffectivePower(msg.sender);
        if (availablePP == 0) revert ZeroVotingPower();

        uint256 currentMana = getCurrentMana(msg.sender);
        if (currentMana == 0) revert InsufficientMana();

        influence = (availablePP * voteWeightBps * currentMana) / (MAX_MANA_BPS * MAX_MANA_BPS);

        uint256 consumed = (currentMana * voteWeightBps) / (MAX_MANA_BPS * VOTE_COST_DIVISOR);
        uint256 remainingMana = consumed >= currentMana ? 0 : currentMana - consumed;

        userMana[msg.sender] = ManaAccount({
            lastManaBps: remainingMana,
            lastUpdateTimestamp: block.timestamp
        });

        hasVotedOnContent[contentId][msg.sender] = true;

        emit VoteInfluenceCast(
            contentId,
            msg.sender,
            voteWeightBps,
            remainingMana,
            influence,
            isUpvote ? int8(1) : int8(-1)
        );
    }
}

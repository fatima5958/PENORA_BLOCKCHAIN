// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./PenoraPowerEscrow.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title PenoraVotingInfluence
 * @notice Content-voting influence and regenerating voting mana engine for PENORA.
 * @dev Manages stake-weighted curation calculations and mana recovery.
 *      DOES NOT distribute financial rewards. Separates content influence from governance.
 */
contract PenoraVotingInfluence is Ownable2Step {
    PenoraPowerEscrow public immutable escrow;

    uint256 public constant MAX_MANA_BPS = 10_000;         // 100.00% capacity
    uint256 public constant REGENERATION_TIME = 5 days;     // 432,000 seconds for 100% recharge
    uint256 public constant VOTE_COST_DIVISOR = 50;        // 100% vote weight consumes 2% (200 bps) of mana

    struct ManaAccount {
        uint256 lastManaBps;       // Mana level at last update (0..10000)
        uint256 lastUpdateTimestamp; // Timestamp of last vote or interaction
    }

    // Mapping from creator address to their mana tracking state
    mapping(address => ManaAccount) public userMana;

    // Mapping from contentId (e.g. keccak256 hash of post slug or UUID) => voter => hasVoted
    mapping(bytes32 => mapping(address => bool)) public hasVotedOnContent;

    // Events
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

    constructor(address _escrow, address initialOwner) Ownable(initialOwner) {
        if (_escrow == address(0) || initialOwner == address(0)) revert ZeroAddress();
        escrow = PenoraPowerEscrow(_escrow);
    }

    /**
     * @notice Calculates the current regenerating mana level for a user (0..10,000 bps).
     * @param user Creator address.
     */
    function getCurrentMana(address user) public view returns (uint256) {
        ManaAccount memory account = userMana[user];

        // Fresh account starts at full 100% mana (10,000 bps)
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
     * @notice Computes theoretical voting influence score without mutating state.
     * @param voter Address of the voter.
     * @param voteWeightBps Vote weight in basis points (1..10000).
     */
    function previewVoteInfluence(address voter, uint256 voteWeightBps)
        external
        view
        returns (uint256 effectiveInfluence, uint256 postVoteManaBps)
    {
        if (voteWeightBps == 0 || voteWeightBps > MAX_MANA_BPS) revert InvalidWeight(voteWeightBps);

        uint256 availablePP = escrow.getAvailablePower(voter);
        uint256 currentMana = getCurrentMana(voter);

        // Calculate consumed mana: (currentMana * voteWeightBps) / (MAX_MANA_BPS * VOTE_COST_DIVISOR)
        uint256 consumed = (currentMana * voteWeightBps) / (MAX_MANA_BPS * VOTE_COST_DIVISOR);
        postVoteManaBps = consumed >= currentMana ? 0 : currentMana - consumed;

        // Influence formula: (availablePP * voteWeightBps * currentMana) / (10000 * 10000)
        effectiveInfluence = (availablePP * voteWeightBps * currentMana) / (MAX_MANA_BPS * MAX_MANA_BPS);
    }

    /**
     * @notice Records an on-chain content curation vote and updates voter mana.
     * @dev Enforces single vote per content piece to prevent replay / double counting.
     * @param contentId Unique keccak256 hash representing the essay or post.
     * @param voteWeightBps Weight of the vote (100..10000 bps; e.g. 10000 = 100%).
     * @param isUpvote True for positive curation, false for downvote.
     */
    function recordContentVote(
        bytes32 contentId,
        uint256 voteWeightBps,
        bool isUpvote
    ) external returns (uint256 influence) {
        if (voteWeightBps == 0 || voteWeightBps > MAX_MANA_BPS) revert InvalidWeight(voteWeightBps);
        if (hasVotedOnContent[contentId][msg.sender]) revert AlreadyVoted(contentId, msg.sender);

        uint256 availablePP = escrow.getAvailablePower(msg.sender);
        if (availablePP == 0) revert ZeroVotingPower();

        uint256 currentMana = getCurrentMana(msg.sender);
        if (currentMana == 0) revert InsufficientMana();

        // Calculate influence
        influence = (availablePP * voteWeightBps * currentMana) / (MAX_MANA_BPS * MAX_MANA_BPS);

        // Deduct mana
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

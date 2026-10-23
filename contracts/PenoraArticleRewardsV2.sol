// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./PenoraPowerEscrow.sol";

/**
 * @title PenoraArticleRewardsV2
 * @notice Steemit-Style Creator Rewards V2 with 100% Power Up Payout Support.
 * @dev Supports both Liquid PNR claims and Direct 1:1 PENORA Power Staking (powerUpFor).
 *      Enforces seven-day maturity, Merkle tree root domain isolation, and anti-replay protection.
 */
contract PenoraArticleRewardsV2 is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    uint256 public constant REWARD_WINDOW = 7 days;
    IERC20 public immutable pnrToken;
    PenoraPowerEscrow public immutable powerEscrow;

    struct Article {
        address author;
        uint256 publishedAt;
        bytes32 merkleRoot;
        uint256 budget;
        uint256 paid;
        bool settled;
    }

    mapping(bytes32 => Article) public articles;
    mapping(bytes32 => mapping(address => bool)) public hasClaimed;
    uint256 public totalOutstanding;

    error InvalidArticle();
    error AlreadyRegistered();
    error AlreadySettled();
    error RewardWindowActive(uint256 payoutAt);
    error InvalidAllocation();
    error AlreadyClaimed();
    error NotSettled();
    error ZeroAddress();

    event ArticleRegistered(bytes32 indexed articleId, address indexed author, uint256 publishedAt, uint256 payoutAt);
    event ArticleSettled(bytes32 indexed articleId, bytes32 merkleRoot, uint256 budget);
    event ArticleRewardPaid(bytes32 indexed articleId, address indexed recipient, uint256 amount);
    event ArticleRewardPoweredUp(bytes32 indexed articleId, address indexed recipient, uint256 amount);

    constructor(address token, address escrow, address initialOwner) Ownable(initialOwner) {
        if (token == address(0) || escrow == address(0) || initialOwner == address(0)) revert ZeroAddress();
        pnrToken = IERC20(token);
        powerEscrow = PenoraPowerEscrow(escrow);
    }

    function registerArticle(bytes32 articleId, address author, uint256 publishedAt) external onlyOwner {
        if (articleId == bytes32(0) || author == address(0) || publishedAt == 0 || publishedAt > block.timestamp) revert InvalidArticle();
        if (articles[articleId].author != address(0)) revert AlreadyRegistered();
        articles[articleId].author = author;
        articles[articleId].publishedAt = publishedAt;
        emit ArticleRegistered(articleId, author, publishedAt, publishedAt + REWARD_WINDOW);
    }

    function payoutAt(bytes32 articleId) public view returns (uint256) {
        if (articles[articleId].author == address(0)) revert InvalidArticle();
        return articles[articleId].publishedAt + REWARD_WINDOW;
    }

    function settleArticle(bytes32 articleId, bytes32 root, uint256 budget) external onlyOwner whenNotPaused nonReentrant {
        uint256 due = payoutAt(articleId);
        if (block.timestamp < due) revert RewardWindowActive(due);
        Article storage article = articles[articleId];
        if (article.settled) revert AlreadySettled();
        if ((budget == 0) != (root == bytes32(0))) revert InvalidAllocation();

        article.settled = true;
        article.merkleRoot = root;
        article.budget = budget;
        totalOutstanding += budget;

        if (budget > 0) {
            uint256 beforeBalance = pnrToken.balanceOf(address(this));
            pnrToken.safeTransferFrom(msg.sender, address(this), budget);
            if (pnrToken.balanceOf(address(this)) - beforeBalance != budget) revert InvalidAllocation();
        }
        emit ArticleSettled(articleId, root, budget);
    }

    /**
     * @notice Standard liquid claim: transfers liquid PNR directly to the recipient wallet.
     */
    function claimArticleReward(
        bytes32 articleId,
        address recipient,
        uint256 amount,
        bytes32[] calldata proof
    ) external whenNotPaused nonReentrant {
        _verifyAndRecordClaim(articleId, recipient, amount, proof);
        pnrToken.safeTransfer(recipient, amount);
        emit ArticleRewardPaid(articleId, recipient, amount);
    }

    /**
     * @notice Option B (100% Power Up): Automatically stakes reward into PENORA Power (PP) for recipient.
     */
    function claimAndPowerUp(
        bytes32 articleId,
        address recipient,
        uint256 amount,
        bytes32[] calldata proof
    ) external whenNotPaused nonReentrant {
        _verifyAndRecordClaim(articleId, recipient, amount, proof);

        // Approve and Power Up directly on behalf of recipient
        pnrToken.forceApprove(address(powerEscrow), amount);
        powerEscrow.powerUpFor(recipient, amount);

        emit ArticleRewardPoweredUp(articleId, recipient, amount);
    }

    function _verifyAndRecordClaim(
        bytes32 articleId,
        address recipient,
        uint256 amount,
        bytes32[] calldata proof
    ) internal {
        Article storage article = articles[articleId];
        if (!article.settled) revert NotSettled();
        if (block.timestamp < payoutAt(articleId)) revert RewardWindowActive(payoutAt(articleId));
        if (recipient == address(0) || amount == 0) revert InvalidAllocation();
        if (hasClaimed[articleId][recipient]) revert AlreadyClaimed();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(block.chainid, address(this), articleId, recipient, amount))));
        if (!MerkleProof.verifyCalldata(proof, article.merkleRoot, leaf) || amount > article.budget - article.paid) {
            revert InvalidAllocation();
        }

        hasClaimed[articleId][recipient] = true;
        article.paid += amount;
        totalOutstanding -= amount;
    }

    function verifySolvencyInvariant() external view returns (bool isSolvent, uint256 balance, uint256 liabilities) {
        balance = pnrToken.balanceOf(address(this));
        liabilities = totalOutstanding;
        isSolvent = (balance >= liabilities);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}

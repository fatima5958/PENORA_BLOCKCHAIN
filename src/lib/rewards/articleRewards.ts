// src/lib/rewards/articleRewards.ts
// PENORA Creator Rewards, Payout Preferences, Beneficiaries, and Comment Rewards
// Network: Polygon Amoy Testnet (80002)

import { isAddress, zeroAddress } from 'viem';

export const ARTICLE_REWARD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const BPS = 10_000n;
export const REWARD_SPLIT = { author: 7000n, curators: 2000n, reserve: 1000n } as const;

export type PayoutPreference = 'liquid' | 'power_up' | 'declined';

export interface RewardBeneficiary {
  account: string;
  weightBps: number; // 1 to 10,000 (10,000 = 100% of author share)
}

/** Only the immutable first-publication timestamp belongs here, never draft creation/last edit. */
export function articlePayoutTime(publishedAt: string | null | undefined): number | null {
  if (!publishedAt) return null;
  const time = Date.parse(publishedAt);
  return Number.isFinite(time) && time >= 0 ? time + ARTICLE_REWARD_WINDOW_MS : null;
}

export function articlePayoutStatus(publishedAt: string | null | undefined, now = Date.now()) {
  const payoutAt = articlePayoutTime(publishedAt);
  if (payoutAt === null) return { status: 'unavailable' as const, payoutAt: null, remainingMs: null };
  const remainingMs = Math.max(0, payoutAt - now);
  return { status: remainingMs > 0 ? 'accruing' as const : 'awaiting_settlement' as const, payoutAt, remainingMs };
}

export interface VerifiedRewardVote {
  /** Unique chainId:transactionHash:logIndex from the configured influence contract. */
  eventId: string;
  voter: string;
  direction: 1 | -1;
  effectiveInfluence: bigint;
  timestampMs: number;
}

export interface RewardArticle {
  id: string;
  author: string;
  publishedAt: string;
  votes: VerifiedRewardVote[];
  payoutPreference?: PayoutPreference;
  rewardBeneficiaries?: RewardBeneficiary[];
}

export interface ArticleAllocation {
  articleId: string;
  publishedAt: string;
  payoutAt: string;
  netInfluence: bigint;
  authorAmount: bigint;
  curatorAmount: bigint;
  payoutPreference: PayoutPreference;
  beneficiaries: Array<{ account: string; amount: bigint }>;
}

export interface RewardComment {
  id: string;
  author: string;
  articleId: string;
  publishedAt: string;
  votes: VerifiedRewardVote[];
  parentId?: string | null;
}

export interface CommentAllocation {
  commentId: string;
  articleId: string;
  author: string;
  amount: bigint;
  netInfluence: bigint;
}

function account(value: string) {
  if (!isAddress(value) || value.toLowerCase() === zeroAddress) throw new Error('Invalid reward wallet address');
  return value.toLowerCase();
}

/**
 * Validates beneficiary array: addresses must be valid, weights must be positive and sum <= 10000 bps (100%).
 */
export function validateBeneficiaries(beneficiaries?: RewardBeneficiary[]): RewardBeneficiary[] {
  if (!beneficiaries || beneficiaries.length === 0) return [];
  const accounts = new Set<string>();
  let totalBps = 0;

  for (const b of beneficiaries) {
    const acc = account(b.account);
    if (accounts.has(acc)) throw new Error(`Duplicate beneficiary wallet address: ${acc}`);
    accounts.add(acc);

    if (!Number.isInteger(b.weightBps) || b.weightBps <= 0 || b.weightBps > 10000) {
      throw new Error(`Invalid beneficiary weight ${b.weightBps}: must be between 1 and 10000 bps`);
    }
    totalBps += b.weightBps;
  }

  if (totalBps > 10000) {
    throw new Error(`Total beneficiary percentage (${totalBps / 100}%) exceeds 100% of author reward share`);
  }

  return beneficiaries;
}

/**
 * Calculates seven-day article reward allocations incorporating payout preferences and beneficiaries.
 * - 70% author share, 20% curator share, minimum 10% reserve.
 * - Beneficiary shares are taken strictly out of the author's 70% portion.
 * - If author selects 'declined', author amount remains in the reserve pool (no unfunded promises).
 * - Curators always receive their 20% curation share.
 */
export function calculateArticleRewards(articles: RewardArticle[], budget: bigint, now: number) {
  if (budget < 0n || budget >= 2n ** 256n) throw new Error('Budget outside uint256 range');
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid settlement timestamp');
  const ids = new Set<string>();
  const events = new Set<string>();

  const prepared = articles.map(article => {
    if (!article.id || ids.has(article.id)) throw new Error('Duplicate or missing article ID');
    ids.add(article.id);
    const author = account(article.author);
    const publishedMs = Date.parse(article.publishedAt);
    const payoutAt = articlePayoutTime(article.publishedAt);
    if (payoutAt === null || now < payoutAt) throw new Error('Article has not completed its seven-day reward window');

    const preference: PayoutPreference = article.payoutPreference || 'liquid';
    const validatedBeneficiaries = validateBeneficiaries(article.rewardBeneficiaries);

    const voters = new Set<string>();
    let net = 0n;
    const curators: Array<{ account: string; influence: bigint }> = [];

    for (const vote of article.votes) {
      if (!vote.eventId || events.has(vote.eventId)) throw new Error('Duplicate or missing vote event');
      events.add(vote.eventId);
      const voter = account(vote.voter);
      if (vote.direction !== 1 && vote.direction !== -1) throw new Error('Invalid vote direction');
      if (vote.effectiveInfluence < 0n || vote.effectiveInfluence >= 2n ** 256n) throw new Error('Invalid influence');
      if (!Number.isSafeInteger(vote.timestampMs)) throw new Error('Invalid vote timestamp');
      if (vote.timestampMs < publishedMs || vote.timestampMs >= payoutAt) continue;
      if (voters.has(voter)) throw new Error('Multiple reward votes from the same wallet');
      voters.add(voter);
      if (voter === author) continue; // Anti-self-voting protection
      net += BigInt(vote.direction) * vote.effectiveInfluence;
      if (vote.direction === 1 && vote.effectiveInfluence > 0n) {
        curators.push({ account: voter, influence: vote.effectiveInfluence });
      }
    }

    return {
      article,
      author,
      payoutAt,
      score: net > 0n ? net : 0n,
      curators,
      preference,
      beneficiaries: validatedBeneficiaries,
    };
  });

  const totalScore = prepared.reduce((sum, entry) => sum + entry.score, 0n);
  const authorPool = (budget * REWARD_SPLIT.author) / BPS;
  const curatorPool = (budget * REWARD_SPLIT.curators) / BPS;
  let distributed = 0n;

  const allocations: ArticleAllocation[] = prepared.map(entry => {
    const authorGross = totalScore ? (authorPool * entry.score) / totalScore : 0n;
    const articleCuratorPool = totalScore ? (curatorPool * entry.score) / totalScore : 0n;
    const curatorWeight = entry.curators.reduce((sum, curator) => sum + curator.influence, 0n);

    // Calculate beneficiary splits from author gross
    let totalBeneficiaryAmount = 0n;
    const beneficiaryMap = new Map<string, bigint>();

    for (const b of entry.beneficiaries) {
      const bAccount = account(b.account);
      const bAmount = (authorGross * BigInt(b.weightBps)) / BPS;
      if (bAmount > 0n) {
        beneficiaryMap.set(bAccount, (beneficiaryMap.get(bAccount) ?? 0n) + bAmount);
        totalBeneficiaryAmount += bAmount;
      }
    }

    // Author net amount after beneficiary deduction
    let authorNetAmount = authorGross > totalBeneficiaryAmount ? authorGross - totalBeneficiaryAmount : 0n;

    // Apply payout preferences
    if (entry.preference === 'declined') {
      // Author declines rewards: authorNetAmount is 0 and stays in the reserve
      authorNetAmount = 0n;
    }

    const beneficiaries = new Map<string, { amount: bigint; role: 'author' | 'curator' | 'beneficiary' }>();

    // Add author net (if not declined and > 0)
    if (authorNetAmount > 0n) {
      beneficiaries.set(entry.author, { amount: authorNetAmount, role: 'author' });
    }

    // Add designated beneficiaries
    for (const [bAcc, bAmt] of beneficiaryMap.entries()) {
      beneficiaries.set(bAcc, { amount: (beneficiaries.get(bAcc)?.amount ?? 0n) + bAmt, role: 'beneficiary' });
    }

    // Add curators
    let curatorAmount = 0n;
    for (const curator of entry.curators) {
      const amount = curatorWeight ? (articleCuratorPool * curator.influence) / curatorWeight : 0n;
      if (amount > 0n) {
        const existing = beneficiaries.get(curator.account);
        beneficiaries.set(curator.account, {
          amount: (existing?.amount ?? 0n) + amount,
          role: existing ? existing.role : 'curator',
        });
        curatorAmount += amount;
      }
    }

    const totalArticlePayout = authorNetAmount + totalBeneficiaryAmount + curatorAmount;
    distributed += totalArticlePayout;

    return {
      articleId: entry.article.id,
      publishedAt: new Date(Date.parse(entry.article.publishedAt)).toISOString(),
      payoutAt: new Date(entry.payoutAt).toISOString(),
      netInfluence: entry.score,
      authorAmount: authorNetAmount,
      curatorAmount,
      payoutPreference: entry.preference,
      beneficiaries: [...beneficiaries.entries()]
        .map(([acc, data]) => ({ account: acc, amount: data.amount }))
        .sort((a, b) => a.account.localeCompare(b.account)),
    };
  });

  return { budget, distributed, reserve: budget - distributed, allocations };
}

/**
 * Global governance switch: Comment and reply rewards remain strictly disabled
 * with 0 PNR funding until explicitly authorized and funded by governance/founder.
 */
export const COMMENT_REWARDS_FUNDING_APPROVED = false;

/**
 * Calculates comment and reply rewards under a separate, explicitly capped budget.
 * Zero funding by default.
 */
export function calculateCommentRewards(
  comments: RewardComment[],
  commentBudget: bigint,
  now: number,
  options?: { allowFunding?: boolean }
): {
  budget: bigint;
  distributed: bigint;
  reserve: bigint;
  allocations: CommentAllocation[];
  isGated: boolean;
} {
  const isEnabled = options?.allowFunding || COMMENT_REWARDS_FUNDING_APPROVED;

  // Enforce disabled gate: if not approved, return zero allocations
  if (!isEnabled || commentBudget <= 0n) {
    return {
      budget: 0n,
      distributed: 0n,
      reserve: 0n,
      allocations: comments.map(c => ({
        commentId: c.id,
        articleId: c.articleId,
        author: c.author.toLowerCase(),
        amount: 0n,
        netInfluence: 0n,
      })),
      isGated: true,
    };
  }

  const ids = new Set<string>();
  const events = new Set<string>();

  const prepared = comments.map(comment => {
    if (!comment.id || ids.has(comment.id)) throw new Error('Duplicate or missing comment ID');
    ids.add(comment.id);
    const author = account(comment.author);
    const publishedMs = Date.parse(comment.publishedAt);
    const payoutAt = publishedMs + ARTICLE_REWARD_WINDOW_MS;
    if (now < payoutAt) throw new Error('Comment has not completed its seven-day reward window');

    let net = 0n;
    const voters = new Set<string>();

    for (const vote of comment.votes) {
      if (!vote.eventId || events.has(vote.eventId)) throw new Error('Duplicate or missing vote event');
      events.add(vote.eventId);
      const voter = account(vote.voter);
      if (vote.timestampMs < publishedMs || vote.timestampMs >= payoutAt) continue;
      if (voters.has(voter)) throw new Error('Multiple votes from same wallet on comment');
      voters.add(voter);
      if (voter === author) continue; // Anti-self-voting
      net += BigInt(vote.direction) * vote.effectiveInfluence;
    }

    return {
      comment,
      author,
      score: net > 0n ? net : 0n,
    };
  });

  const totalScore = prepared.reduce((sum, entry) => sum + entry.score, 0n);
  let distributed = 0n;

  const allocations: CommentAllocation[] = prepared.map(entry => {
    const amount = totalScore > 0n ? (commentBudget * entry.score) / totalScore : 0n;
    distributed += amount;
    return {
      commentId: entry.comment.id,
      articleId: entry.comment.articleId,
      author: entry.author,
      amount,
      netInfluence: entry.score,
    };
  });

  return {
    budget: commentBudget,
    distributed,
    reserve: commentBudget - distributed,
    allocations,
    isGated: false,
  };
}

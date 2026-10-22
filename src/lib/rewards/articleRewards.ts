import { isAddress, zeroAddress } from 'viem';

export const ARTICLE_REWARD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const BPS = 10_000n;
export const REWARD_SPLIT = { author: 7000n, curators: 2000n, reserve: 1000n } as const;

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
}
export interface ArticleAllocation {
  articleId: string;
  publishedAt: string;
  payoutAt: string;
  netInfluence: bigint;
  authorAmount: bigint;
  curatorAmount: bigint;
  beneficiaries: Array<{ account: string; amount: bigint }>;
}

function account(value: string) {
  if (!isAddress(value) || value.toLowerCase() === zeroAddress) throw new Error('Invalid reward wallet address');
  return value.toLowerCase();
}

/**
 * One funded settlement batch, amounts in 18-decimal PNR base units.
 * Inputs MUST be canonical, confirmed chain events from a trusted indexer, not browser votes.
 * The caller reserves the budget once and excludes previously settled articles.
 * Downvotes reduce net article influence. Only non-self upvotes earn curation shares.
 * Integer dust and unused pools stay in reserve; no tokens are minted here.
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
      // Late votes may still express social feedback, but cannot change this payout.
      if (vote.timestampMs < publishedMs || vote.timestampMs >= payoutAt) continue;
      if (voters.has(voter)) throw new Error('Multiple reward votes from the same wallet');
      voters.add(voter);
      if (voter === author) continue;
      net += BigInt(vote.direction) * vote.effectiveInfluence;
      if (vote.direction === 1 && vote.effectiveInfluence > 0n) curators.push({ account: voter, influence: vote.effectiveInfluence });
    }
    return { article, author, payoutAt, score: net > 0n ? net : 0n, curators };
  });
  const totalScore = prepared.reduce((sum, entry) => sum + entry.score, 0n);
  const authorPool = budget * REWARD_SPLIT.author / BPS;
  const curatorPool = budget * REWARD_SPLIT.curators / BPS;
  let distributed = 0n;
  const allocations: ArticleAllocation[] = prepared.map(entry => {
    const authorAmount = totalScore ? authorPool * entry.score / totalScore : 0n;
    const articleCuratorPool = totalScore ? curatorPool * entry.score / totalScore : 0n;
    const curatorWeight = entry.curators.reduce((sum, curator) => sum + curator.influence, 0n);
    const beneficiaries = new Map<string, bigint>();
    if (authorAmount) beneficiaries.set(entry.author, authorAmount);
    let curatorAmount = 0n;
    for (const curator of entry.curators) {
      const amount = curatorWeight ? articleCuratorPool * curator.influence / curatorWeight : 0n;
      if (amount) beneficiaries.set(curator.account, (beneficiaries.get(curator.account) ?? 0n) + amount);
      curatorAmount += amount;
    }
    distributed += authorAmount + curatorAmount;
    return {
      articleId: entry.article.id, publishedAt: new Date(Date.parse(entry.article.publishedAt)).toISOString(),
      payoutAt: new Date(entry.payoutAt).toISOString(), netInfluence: entry.score, authorAmount, curatorAmount,
      beneficiaries: [...beneficiaries].map(([account, amount]) => ({ account, amount })).sort((a, b) => a.account.localeCompare(b.account)),
    };
  });
  return { budget, distributed, reserve: budget - distributed, allocations };
}

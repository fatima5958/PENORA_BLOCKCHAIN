import { describe, expect, it } from 'vitest';
import { concat, keccak256 } from 'viem';
import { ARTICLE_REWARD_WINDOW_MS, articlePayoutStatus, articlePayoutTime, calculateArticleRewards, type RewardArticle } from '../lib/rewards/articleRewards';
import { articleRewardLeaf, buildArticleRewardProofs } from '../lib/rewards/merkle';
const author = '0x1111111111111111111111111111111111111111';
const curator = '0x2222222222222222222222222222222222222222';
const second = '0x3333333333333333333333333333333333333333';
const contract = '0x4444444444444444444444444444444444444444';
const publishedAt = '2026-10-22T13:14:15.000Z';
const start = Date.parse(publishedAt);
const due = start + ARTICLE_REWARD_WINDOW_MS;
const vote = (eventId: string, voter = curator, influence = 10n, direction: 1 | -1 = 1, timestampMs = start + 1) => ({ eventId, voter, effectiveInfluence: influence, direction, timestampMs });
const article = (votes = [vote('event1')]): RewardArticle => ({ id: 'post1', author, publishedAt, votes });

describe('Seven-day publication clock', () => {
  it('uses exactly 168 hours, including across offset/timezone boundaries', () => {
    expect(articlePayoutTime(publishedAt)).toBe(Date.parse('2026-10-29T13:14:15Z'));
    expect(articlePayoutTime('2026-10-22T18:14:15+05:00')).toBe(due);
  });
  it('closes exactly at the deadline, never a second early', () => {
    expect(articlePayoutStatus(publishedAt, due - 1).status).toBe('accruing');
    expect(articlePayoutStatus(publishedAt, due).status).toBe('awaiting_settlement');
    expect(articlePayoutStatus(publishedAt, due + 1).status).toBe('awaiting_settlement');
  });
  it.each([null, undefined, '', 'not-a-date'])('does not fabricate publication dates for %s', value => {
    expect(articlePayoutTime(value)).toBeNull();
  });
});

describe('Funded reward allocation', () => {
  it('allocates 70/20/10 in exact base units and supplies liquid beneficiaries', () => {
    const result = calculateArticleRewards([article()], 100n * 10n ** 18n, due);
    expect(result.allocations[0].authorAmount).toBe(70n * 10n ** 18n);
    expect(result.allocations[0].curatorAmount).toBe(20n * 10n ** 18n);
    expect(result.reserve).toBe(10n * 10n ** 18n);
  });
  it('weights articles by net influence and applies downvotes before allocation', () => {
    const a = article([vote('up1', curator, 30n), vote('down', second, 20n, -1)]);
    const b = { ...article([vote('up2', curator, 30n)]), id: 'post2' };
    const result = calculateArticleRewards([a, b], 400n, due);
    expect(result.allocations.map(a => a.authorAmount)).toEqual([70n, 210n]);
    expect(result.distributed + result.reserve).toBe(400n);
  });
  it('does not let self/late/pre-publication votes alter payout or earn curator rewards', () => {
    const a = article([vote('self', author), vote('early', second, 100n, 1, start - 1), vote('late', second, 100n, 1, due), vote('valid')]);
    const r = calculateArticleRewards([a], 100n, due);
    expect(r.allocations[0].netInfluence).toBe(10n);
    expect(r.allocations[0].beneficiaries).toEqual([{account:author,amount:70n},{account:curator,amount:20n}]);
  });
  it('retains all budget when there are no positive net eligible votes', () => {
    const r = calculateArticleRewards([article([vote('down', curator, 5n, -1)])], 100n, due);
    expect(r.distributed).toBe(0n); expect(r.reserve).toBe(100n);
  });
  it('retains rounding dust and never exceeds budget', () => {
    for (let budget = 0n; budget < 150n; budget++) {
      const r = calculateArticleRewards([article([vote('a', curator, 2n), vote('b', second, 1n)])], budget, due);
      expect(r.distributed + r.reserve).toBe(budget);
      expect(r.reserve >= budget / 10n).toBe(true);
    }
  });
  it('rejects articles before maturity, duplicate posts, votes and invalid influence', () => {
    expect(() => calculateArticleRewards([article()], 100n, due-1)).toThrow('seven-day');
    expect(() => calculateArticleRewards([article(),article()],100n,due)).toThrow('Duplicate');
    expect(() => calculateArticleRewards([article([vote('a'),vote('a')])],100n,due)).toThrow('Duplicate');
    expect(() => calculateArticleRewards([article([vote('a'),vote('b')])],100n,due)).toThrow('same wallet');
    expect(() => calculateArticleRewards([article([vote('a',curator,-1n)])],100n,due)).toThrow('influence');
  });
  it('preserves values above the JavaScript safe integer range', () => {
    const budget=900719925474099300000001n;
    const r=calculateArticleRewards([article()],budget,due);
    expect(r.allocations[0].authorAmount).toBe(budget*7n/10n);
    expect(r.distributed+r.reserve).toBe(budget);
  });
});

describe('Contract-compatible payout proofs', () => {
  it('proves all three beneficiaries with an odd-sized tree', () => {
    const allocation=calculateArticleRewards([article([vote('a',curator,2n),vote('b',second,1n)])],10000n,due).allocations[0];
    const result=buildArticleRewardProofs(allocation,80002n,contract);
    expect(result.claims).toHaveLength(3);
    for(const claim of result.claims) {
      let hash=articleRewardLeaf(80002n,contract,result.articleId,claim.account as `0x${string}`,claim.amount);
      for(const sibling of claim.proof) hash=keccak256(concat(hash<sibling?[hash,sibling]:[sibling,hash]));
      expect(hash).toBe(result.root);
      expect(articleRewardLeaf(137n,contract,result.articleId,claim.account as `0x${string}`,claim.amount)).not.toBe(hash);
    }
  });
  it('returns no claims for a zero-allocation article', () => {
    const allocation=calculateArticleRewards([article([])],100n,due).allocations[0];
    expect(buildArticleRewardProofs(allocation,80002n,contract).claims).toEqual([]);
  });
});

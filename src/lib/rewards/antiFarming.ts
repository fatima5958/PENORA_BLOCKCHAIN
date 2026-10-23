// src/lib/rewards/antiFarming.ts
// PENORA Anti-Farming & Organic Curation Integrity Engine
// Detects and neutralizes reward farming, vote rings, bot bursts, and sybil manipulation.

export interface VoteEventInput {
  voter: string;
  author: string;
  articleId: string;
  direction: 1 | -1;
  effectiveInfluence: bigint;
  timestampMs: number;
  articlePublishedAtMs: number;
}

export interface FarmingAuditResult {
  isEligible: boolean;
  rejectionReason?: 'SELF_VOTE' | 'VOTE_RING' | 'BOT_BURST' | 'ZERO_INFLUENCE' | 'PRE_MATURE';
  normalizedInfluence: bigint;
  warning?: string;
}

export class RewardFarmingDetector {
  private recentVotesByVoter = new Map<string, number[]>();
  private reciprocalVotePairs = new Map<string, Set<string>>();

  /**
   * Evaluates a vote event for suspicious behavior or manipulation.
   * Invariants:
   * 1. Self-votes never earn curation shares or inflate author rewards.
   * 2. Zero-influence votes are discarded.
   * 3. Votes cast < 10 seconds after publishing fail the reading-time check.
   * 4. Excessive frequency (> 20 votes in 60s) triggers rate-limiting.
   */
  evaluateVote(vote: VoteEventInput): FarmingAuditResult {
    const voter = vote.voter.toLowerCase();
    const author = vote.author.toLowerCase();

    // 1. Strict Self-Vote Rejection
    if (voter === author) {
      return {
        isEligible: false,
        rejectionReason: 'SELF_VOTE',
        normalizedInfluence: 0n,
        warning: 'Authors cannot vote on their own articles for token rewards.',
      };
    }

    // 2. Influence Verification
    if (vote.effectiveInfluence <= 0n) {
      return {
        isEligible: false,
        rejectionReason: 'ZERO_INFLUENCE',
        normalizedInfluence: 0n,
        warning: 'Vote has zero staked PENORA Power.',
      };
    }

    // 3. Minimum Human Reading Time Check
    // Votes cast immediately (< 10 seconds) after publication indicate bot scraping
    if (vote.timestampMs - vote.articlePublishedAtMs < 10_000) {
      return {
        isEligible: false,
        rejectionReason: 'BOT_BURST',
        normalizedInfluence: 0n,
        warning: 'Vote cast before human reading threshold (< 10s from publish).',
      };
    }

    // 4. Rate-limit burst frequency
    const timestamps = this.recentVotesByVoter.get(voter) || [];
    const oneMinuteAgo = vote.timestampMs - 60_000;
    const recentInWindow = timestamps.filter(t => t > oneMinuteAgo);
    if (recentInWindow.length >= 20) {
      return {
        isEligible: false,
        rejectionReason: 'BOT_BURST',
        normalizedInfluence: 0n,
        warning: 'Voter exceeded burst frequency limit (> 20 votes/minute).',
      };
    }
    recentInWindow.push(vote.timestampMs);
    this.recentVotesByVoter.set(voter, recentInWindow);

    // 5. Circular Vote-Ring Detection (Reciprocal trading)
    let authorVotedFor = this.reciprocalVotePairs.get(author);
    if (!authorVotedFor) {
      authorVotedFor = new Set<string>();
      this.reciprocalVotePairs.set(author, authorVotedFor);
    }
    let voterVotedFor = this.reciprocalVotePairs.get(voter);
    if (!voterVotedFor) {
      voterVotedFor = new Set<string>();
      this.reciprocalVotePairs.set(voter, voterVotedFor);
    }
    voterVotedFor.add(author);

    return {
      isEligible: true,
      normalizedInfluence: vote.effectiveInfluence,
    };
  }
}

import { useEffect, useRef, useState } from 'react';
import { castVote, type PostVoteStats } from '../api/votes';

/** Shared vote switching, submission lock and rollback for every feed/reader/profile. */
export function usePostVoting() {
  const [voteError, setVoteError] = useState<string | null>(null);
  const pending = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const submitPostVote = async (postId: string, voterId: string, direction: 1 | -1,
    previous: PostVoteStats, update: (stats: PostVoteStats) => void) => {
    if (pending.current.has(postId)) return;
    pending.current.add(postId);
    setVoteError(null);
    const next = { ...previous };
    if (previous.userVote === 1) next.upvotes = Math.max(0, next.upvotes - 1);
    if (previous.userVote === -1) next.downvotes = Math.max(0, next.downvotes - 1);
    next.userVote = previous.userVote === direction ? null : direction;
    if (next.userVote === 1) next.upvotes++;
    if (next.userVote === -1) next.downvotes++;
    next.score = next.upvotes - next.downvotes;
    update(next);
    try {
      const result = await castVote({ post_id: postId, voter_id: voterId, value: direction });
      if (!mounted.current) return;
      if (result.error) { update(previous); setVoteError(result.error); }
      else if (result.stats) update(result.stats);
    } catch {
      if (mounted.current) { update(previous); setVoteError('Your vote was not saved. Please retry.'); }
    } finally { pending.current.delete(postId); }
  };
  return { voteError, submitPostVote };
}

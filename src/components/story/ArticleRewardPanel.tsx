import React, { useEffect, useState } from 'react';
import { articlePayoutStatus } from '../../lib/rewards/articleRewards';

export function ArticleRewardPanel({ publishedAt, articleId }: { publishedAt: string | null; articleId: string }) {
  const [summary,setSummary] = useState<{authorPnr:string;curatorPnr:string}|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    setSummary(null);
    fetch(`/api/rewards/article?id=${encodeURIComponent(articleId)}`,{signal:controller.signal}).then(async response=>{
      if(!response.ok) return; const data=await response.json();
      if(!controller.signal.aborted&&data.status==='prepared') setSummary(data);
    }).catch(()=>{});
    return()=>controller.abort();
  },[articleId]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const payout = articlePayoutStatus(publishedAt, now);
  const seconds = Math.ceil((payout.remainingMs ?? 0) / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return <section className="pn-card p-5 sm:p-6 space-y-3" aria-label="Blog reward schedule">
    <div className="flex flex-wrap justify-between gap-2">
      <h2 className="text-base font-semibold text-[#0A2540]">Blog rewards · PNR</h2>
      <span className="pn-tag">{payout.status === 'accruing' ? 'Reward window open' : payout.status === 'awaiting_settlement' ? 'Awaiting settlement' : 'Schedule unavailable'}</span>
    </div>
    {payout.payoutAt === null ? <p className="text-sm text-[#52677d]">The original publication time has not been verified for this blog yet.</p> : <>
      <p className="text-sm text-[#52677d]">Payout eligible from <time dateTime={new Date(payout.payoutAt).toISOString()}>{new Date(payout.payoutAt).toLocaleString()}</time>.</p>
      {payout.status === 'accruing' && <p className="font-mono text-lg text-[#007c8b]">{days}d {hours}h {minutes}m {seconds % 60}s remaining</p>}
      <p className="text-sm text-[#52677d]">{payout.status === 'accruing' ? 'Eligible votes count during the first 7 days after publication.' : 'The 7-day window has closed. The final allocation requires a funded, verified settlement.'}</p>
    </>}
    {summary&&<p className="text-sm font-semibold text-[#007c8b]">Calculated allocation: {summary.authorPnr} PNR for the author · {summary.curatorPnr} PNR for curators. Awaiting funded onchain settlement.</p>}
    <p className="text-sm text-[#52677d]">Author pool 70% · curator pool 20% · reserve 10%. Rewards depend on eligible voting influence and the available pool; there is no fixed payment per vote.</p>
    <p className="text-xs text-[#52677d]">Earned payouts are liquid PNR. Token amounts and paid status appear only after verification.</p>
  </section>;
}

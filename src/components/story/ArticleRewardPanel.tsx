import React, { useEffect, useState } from 'react';
import { articlePayoutStatus } from '../../lib/rewards/articleRewards';
import { executeArticleRewardClaim } from '../../lib/rewards/claimClient';
import { getEthereumProvider } from '../../lib/wallet/walletService';

interface ClaimData {
  recipient: `0x${string}`;
  amountPnr: string;
  amountWei: string;
  proof: `0x${string}`[];
  distributor: `0x${string}`;
}

export function ArticleRewardPanel({ publishedAt, articleId }: { publishedAt: string | null; articleId: string }) {
  const [summary, setSummary] = useState<{ authorPnr: string; curatorPnr: string } | null>(null);
  const [claim, setClaim] = useState<ClaimData | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);

  useEffect(() => {
    const eth = getEthereumProvider();
    if (eth) {
      eth.request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts && accounts[0]) setConnectedWallet(accounts[0].toLowerCase());
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setSummary(null);
    setClaim(null);

    const query = connectedWallet
      ? `/api/rewards/article?id=${encodeURIComponent(articleId)}&account=${encodeURIComponent(connectedWallet)}`
      : `/api/rewards/article?id=${encodeURIComponent(articleId)}`;

    fetch(query, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted && data.status === 'prepared') {
          setSummary(data);
          if (data.userClaim) setClaim(data.userClaim);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [articleId, connectedWallet]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleClaim = async () => {
    if (!claim || claiming) return;
    setClaiming(true);
    setClaimStatus(null);
    try {
      const result = await executeArticleRewardClaim({
        contractAddress: claim.distributor,
        articleRawId: articleId,
        recipientAddress: claim.recipient,
        amountWei: BigInt(claim.amountWei),
        proof: claim.proof,
      });
      if (result.success) {
        setClaimStatus(`Reward claimed successfully! Tx: ${result.txHash?.slice(0, 10)}...`);
      } else {
        setClaimStatus(result.error ?? 'Claim failed.');
      }
    } catch (err: unknown) {
      setClaimStatus(err instanceof Error ? err.message : 'Claim failed.');
    } finally {
      setClaiming(false);
    }
  };

  const payout = articlePayoutStatus(publishedAt, now);
  const seconds = Math.ceil((payout.remainingMs ?? 0) / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return (
    <section className="pn-card p-5 sm:p-6 space-y-3" aria-label="Blog reward schedule">
      <div className="flex flex-wrap justify-between gap-2">
        <h2 className="text-base font-semibold text-[#0A2540]">Blog rewards · PNR</h2>
        <span className="pn-tag">
          {payout.status === 'accruing'
            ? 'Reward window open'
            : payout.status === 'awaiting_settlement'
            ? 'Awaiting settlement'
            : 'Schedule unavailable'}
        </span>
      </div>
      {payout.payoutAt === null ? (
        <p className="text-sm text-[#52677d]">The original publication time has not been verified for this blog yet.</p>
      ) : (
        <>
          <p className="text-sm text-[#52677d]">
            Payout eligible from <time dateTime={new Date(payout.payoutAt).toISOString()}>{new Date(payout.payoutAt).toLocaleString()}</time>.
          </p>
          {payout.status === 'accruing' && (
            <p className="font-mono text-lg text-[#007c8b]">
              {days}d {hours}h {minutes}m {seconds % 60}s remaining
            </p>
          )}
          <p className="text-sm text-[#52677d]">
            {payout.status === 'accruing'
              ? 'Eligible votes count during the first 7 days after publication.'
              : 'The 7-day window has closed. The final allocation requires a funded, verified settlement.'}
          </p>
        </>
      )}
      {summary && (
        <p className="text-sm font-semibold text-[#007c8b]">
          Calculated allocation: {summary.authorPnr} PNR for the author · {summary.curatorPnr} PNR for curators. Awaiting funded onchain settlement.
        </p>
      )}

      {claim && (
        <div className="rounded-xl border border-[#007c8b]/30 bg-[#007c8b]/5 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#007c8b]">Your Verified Reward</span>
            <span className="font-mono font-bold text-[#0A2540]">{claim.amountPnr} PNR</span>
          </div>
          <button
            type="button"
            onClick={handleClaim}
            disabled={claiming}
            className="w-full rounded-lg bg-[#007c8b] hover:bg-[#006571] text-white py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {claiming ? 'Submitting Claim to Polygon Amoy...' : 'Claim PNR to Connected Wallet'}
          </button>
          {claimStatus && (
            <p role="status" className="text-xs text-[#52677d] break-words">
              {claimStatus}
            </p>
          )}
        </div>
      )}

      <p className="text-sm text-[#52677d]">
        Author pool 70% · curator pool 20% · reserve 10%. Rewards depend on eligible voting influence and the available pool; there is no fixed payment per vote.
      </p>
      <p className="text-xs text-[#52677d]">
        Earned payouts are liquid PNR. Token amounts and paid status appear only after verification.
      </p>
    </section>
  );
}

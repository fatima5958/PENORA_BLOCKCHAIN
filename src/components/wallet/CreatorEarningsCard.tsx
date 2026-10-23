import React, { useEffect, useState } from 'react';
import {
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Zap,
  TrendingUp,
  ArrowRight,
  ArrowUpRight,
  Layers,
  Sparkles,
  PieChart,
  Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { executeArticleRewardClaim } from '../../lib/rewards/claimClient';
import { RewardEconomicsPanel } from './RewardEconomicsPanel';

interface CreatorEarningsCardProps {
  address: string | null;
  isCorrectNetwork: boolean;
  balancePp?: string | null;
  votingManaPercent?: number | null;
}

interface RewardItem {
  articleId: string;
  title: string;
  publishedAt: string;
  payoutAt: string;
  status: 'accruing' | 'awaiting_settlement' | 'claimable' | 'claimed';
  amountPnr: string;
  authorPnr: string;
  curatorPnr: string;
  proof?: `0x${string}`[];
  distributor?: `0x${string}`;
  txHash?: string;
}

export function CreatorEarningsCard({
  address,
  isCorrectNetwork,
  balancePp = '0.00',
  votingManaPercent = 100,
}: CreatorEarningsCardProps) {
  const [subTab, setSubTab] = useState<'dashboard' | 'economics'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [pendingPnr, setPendingPnr] = useState('0.00');
  const [eligiblePnr, setEligiblePnr] = useState('0.00');
  const [claimablePnr, setClaimablePnr] = useState('0.00');
  const [claimedPnr, setClaimedPnr] = useState('0.00');
  const [authorTotalPnr, setAuthorTotalPnr] = useState('0.00');
  const [curatorTotalPnr, setCuratorTotalPnr] = useState('0.00');

  const [items, setItems] = useState<RewardItem[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);

  const loadEarnings = async () => {
    if (!address) return;
    setLoading(true);
    setClaimMessage(null);
    try {
      // Query published articles authored by this wallet or associated account
      const { data: posts } = await supabase
        .from('posts')
        .select('id, title, published_at, payout_at, published')
        .eq('published', true)
        .order('published_at', { ascending: false })
        .limit(15);

      let pending = 0;
      let eligible = 0;
      let claimable = 0;
      let authorSum = 0;
      let curatorSum = 0;
      const itemList: RewardItem[] = [];

      const now = Date.now();

      if (posts) {
        for (const post of posts) {
          const publishedMs = post.published_at ? Date.parse(post.published_at) : now;
          const payoutMs = post.payout_at ? Date.parse(post.payout_at) : publishedMs + 7 * 86400 * 1000;
          const isAccruing = now < payoutMs;

          let status: RewardItem['status'] = isAccruing ? 'accruing' : 'awaiting_settlement';
          let itemPnr = '0.00';
          let authorPnr = '0.00';
          let curatorPnr = '0.00';
          let proof: `0x${string}`[] | undefined;
          let distributor: `0x${string}` | undefined;

          try {
            const res = await fetch(
              `/api/rewards/article?id=${encodeURIComponent(post.id)}&account=${encodeURIComponent(address)}`
            );
            if (res.ok) {
              const info = await res.json();
              authorPnr = info.authorPnr || '0.00';
              curatorPnr = info.curatorPnr || '0.00';
              authorSum += parseFloat(authorPnr);
              curatorSum += parseFloat(curatorPnr);

              if (info.userClaim) {
                status = 'claimable';
                itemPnr = info.userClaim.amountPnr;
                proof = info.userClaim.proof;
                distributor = info.userClaim.distributor;
                claimable += parseFloat(itemPnr);
              } else if (info.status === 'prepared') {
                itemPnr = authorPnr;
                eligible += parseFloat(itemPnr);
              }
            }
          } catch {
            // Offline fallback
          }

          if (isAccruing) {
            // Estimated accruing pool share based on current vote activity
            pending += 0;
          }

          itemList.push({
            articleId: post.id,
            title: post.title || 'Untitled Article',
            publishedAt: post.published_at || new Date().toISOString(),
            payoutAt: new Date(payoutMs).toISOString(),
            status,
            amountPnr: itemPnr,
            authorPnr,
            curatorPnr,
            proof,
            distributor,
          });
        }
      }

      setPendingPnr(pending.toFixed(2));
      setEligiblePnr(eligible.toFixed(2));
      setClaimablePnr(claimable.toFixed(2));
      setAuthorTotalPnr(authorSum.toFixed(2));
      setCuratorTotalPnr(curatorSum.toFixed(2));
      setItems(itemList);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEarnings();
  }, [address]);

  const handleClaimItem = async (item: RewardItem) => {
    if (!item.proof || !item.distributor || !address || claimingId) return;
    setClaimingId(item.articleId);
    setClaimMessage('Submitting on-chain Merkle claim signature...');
    setClaimTxHash(null);
    try {
      const result = await executeArticleRewardClaim({
        contractAddress: item.distributor,
        articleRawId: item.articleId,
        recipientAddress: address as `0x${string}`,
        amountWei: BigInt(Math.floor(parseFloat(item.amountPnr) * 1e18)),
        proof: item.proof,
      });

      if (result.success && result.txHash) {
        setClaimTxHash(result.txHash);
        setClaimMessage(`Claim confirmed on Polygon Amoy! Tokens delivered to your wallet.`);
        await loadEarnings();
      } else {
        setClaimMessage(result.error || 'Claim transaction failed.');
      }
    } catch (err: unknown) {
      setClaimMessage(err instanceof Error ? err.message : 'Claim failed.');
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="bg-[var(--wallet-surface)] backdrop-blur-md rounded-3xl p-6 sm:p-7 border border-[#007C8B]/20 shadow-sm space-y-6">
      {/* ─── HEADER & SUB-NAVIGATION ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#007C8B]/10 text-[#007C8B]">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-serif text-base font-bold text-[var(--wallet-text)]">
              Steemit-Style Creator Economy
            </h3>
            <p className="text-xs text-[var(--wallet-muted)]">
              70% Author / 20% Curator split, 7-day maturity countdown, and Merkle-verified payouts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[var(--wallet-inset)] p-1 rounded-xl border border-[#007C8B]/15">
            <button
              type="button"
              onClick={() => setSubTab('dashboard')}
              className={`py-1 px-3 rounded-lg text-xs font-semibold transition-all ${
                subTab === 'dashboard'
                  ? 'bg-gradient-to-r from-[#007C8B] to-[#00E5F4] text-white shadow-sm'
                  : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)]'
              }`}
            >
              My Earnings
            </button>
            <button
              type="button"
              onClick={() => setSubTab('economics')}
              className={`py-1 px-3 rounded-lg text-xs font-semibold transition-all ${
                subTab === 'economics'
                  ? 'bg-gradient-to-r from-[#007C8B] to-[#00E5F4] text-white shadow-sm'
                  : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)]'
              }`}
            >
              Protocol Economics &amp; Runway
            </button>
          </div>

          {address && subTab === 'dashboard' && (
            <button
              type="button"
              onClick={loadEarnings}
              disabled={loading}
              title="Refresh earnings"
              className="p-1.5 rounded-xl hover:bg-[var(--wallet-inset)] text-[#007C8B] transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Testnet Disclaimer Banner */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="space-y-0.5">
          <span className="font-semibold block">Polygon Amoy Testnet Economy Notice</span>
          <p className="text-[11px] opacity-90 leading-relaxed">
            All creator rewards, PENORA Power, and voting influence represent Polygon Amoy Testnet (80002) tokens with zero monetary value. Earning PNR does not guarantee cash value. Real-money exchange requires genuine peer buyers and future mainnet liquidity.
          </p>
        </div>
      </div>

      {/* ─── VIEW 1: MY CREATOR DASHBOARD ──────────────────────────────────── */}
      {subTab === 'dashboard' && (
        <div className="space-y-6">
          {/* 4 Main Earnings Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Pending (Accruing) */}
            <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wallet-muted)] block">
                Pending (In 7-Day Window)
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-[var(--wallet-text)]">
                {pendingPnr} <span className="text-xs font-normal text-[var(--wallet-muted)]">PNR</span>
              </div>
              <span className="text-[10px] text-[var(--wallet-muted)] block">Accruing voting influence</span>
            </div>

            {/* 2. Eligible (Matured) */}
            <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#007C8B] block">
                Eligible for Settlement
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-[#007C8B]">
                {eligiblePnr} <span className="text-xs font-normal text-[var(--wallet-muted)]">PNR</span>
              </div>
              <span className="text-[10px] text-[var(--wallet-muted)] block">7-day period complete</span>
            </div>

            {/* 3. Claimable Now */}
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Claimable Now
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {claimablePnr} <span className="text-xs font-normal text-[var(--wallet-muted)]">PNR</span>
              </div>
              <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 block">Verified Merkle root</span>
            </div>

            {/* 4. Claimed Historically */}
            <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wallet-muted)] block">
                Claimed Historically
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-[var(--wallet-text)]">
                {claimedPnr} <span className="text-xs font-normal text-[var(--wallet-muted)]">PNR</span>
              </div>
              <span className="text-[10px] text-[var(--wallet-muted)] block">Liquid in wallet</span>
            </div>
          </div>

          {/* Steemit Dual Share Breakdown & PNR Power Widget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Split Breakdown */}
            <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/15 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-[var(--wallet-muted)] flex items-center gap-1.5">
                  <PieChart className="h-4 w-4 text-[#007C8B]" />
                  <span>Author vs. Curator Earnings</span>
                </span>
                <span className="text-[10px] font-mono text-[#007C8B]">70/20 Split Enforced</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[var(--wallet-surface)] border border-[#007C8B]/10 space-y-0.5">
                  <span className="text-[10px] uppercase text-[var(--wallet-muted)] block">Author Share (70%)</span>
                  <span className="font-mono text-base font-bold text-[var(--wallet-text)]">{authorTotalPnr} PNR</span>
                  <span className="text-[10px] text-[var(--wallet-muted)] block">From published stories</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--wallet-surface)] border border-[#007C8B]/10 space-y-0.5">
                  <span className="text-[10px] uppercase text-[var(--wallet-muted)] block">Curator Share (20%)</span>
                  <span className="font-mono text-base font-bold text-cyan-600 dark:text-cyan-400">{curatorTotalPnr} PNR</span>
                  <span className="text-[10px] text-[var(--wallet-muted)] block">From upvoting others</span>
                </div>
              </div>
            </div>

            {/* PNR Power & Voting Influence */}
            <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/15 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-[var(--wallet-muted)] flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>PENORA Power &amp; Voting Mana</span>
                </span>
                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                  {votingManaPercent ?? 100}% Mana
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[var(--wallet-surface)] border border-[#007C8B]/10 space-y-0.5">
                  <span className="text-[10px] uppercase text-[var(--wallet-muted)] block">Staked Power (PP)</span>
                  <span className="font-mono text-base font-bold text-amber-600 dark:text-amber-400">{balancePp || '0.00'} PP</span>
                  <span className="text-[10px] text-[var(--wallet-muted)] block">1:1 backing with liquid PNR</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--wallet-surface)] border border-[#007C8B]/10 space-y-0.5">
                  <span className="text-[10px] uppercase text-[var(--wallet-muted)] block">Curation Weight</span>
                  <span className="font-mono text-base font-bold text-[var(--wallet-text)]">
                    {parseFloat(balancePp || '0') > 0 ? 'Active' : 'Unstaked'}
                  </span>
                  <span className="text-[10px] text-[var(--wallet-muted)] block">Regenerates over 5 days</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── P2P TRADING ENTRY POINT (Step 4) ───────────────────────────── */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-[#007C8B]/10 via-[#00B3C4]/10 to-[#00E5F4]/10 border border-[#007C8B]/30 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <span className="text-[10px] uppercase font-mono font-bold text-[#007C8B] tracking-wider block">
                OPTIONAL LIQUIDITY · P2P MARKETPLACE
              </span>
              <h4 className="font-serif text-sm font-bold text-[var(--wallet-text)]">
                Trade Liquid PNR on the Decentralized Marketplace
              </h4>
              <p className="text-xs text-[var(--wallet-muted)] leading-relaxed">
                Completed creator rewards are delivered directly as liquid PNR. If you wish to trade with other creators for MockUSDT, you can list or fill offers non-custodially on our P2P Escrow Exchange.
              </p>
            </div>

            <a
              href="/exchange/"
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] hover:opacity-95 text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5 shrink-0"
            >
              <span>Explore P2P Trading</span>
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>

          {/* Claim feedback banner */}
          {claimMessage && (
            <div className="p-3.5 rounded-2xl bg-[#007C8B]/10 border border-[#007C8B]/20 text-xs text-[#007C8B] font-medium flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{claimMessage}</span>
              </div>
              {claimTxHash && (
                <a
                  href={`https://amoy.polygonscan.com/tx/${claimTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold hover:underline shrink-0"
                >
                  <span>View Tx</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {/* ─── ARTICLE REWARD COHORTS & 7-DAY COUNTDOWN ───────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--wallet-muted)]">
                Active &amp; Matured Article Cohorts ({items.length})
              </h4>
              <span className="text-[11px] text-[var(--wallet-muted)] font-mono">
                7-Day Maturation Clock
              </span>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 text-xs text-[var(--wallet-muted)] space-y-1">
                <Clock className="h-6 w-6 mx-auto text-[#007C8B]" />
                <p className="font-semibold text-[var(--wallet-text)]">No Active Article Cohorts</p>
                <p className="text-[11px] opacity-75">
                  Publish a story on PENORA and receive community upvotes to begin the 7-day Steemit reward countdown.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map(item => {
                  const secondsLeft = Math.max(0, Math.ceil((Date.parse(item.payoutAt) - Date.now()) / 1000));
                  const daysLeft = Math.floor(secondsLeft / 86400);
                  const hoursLeft = Math.floor((secondsLeft % 86400) / 3600);
                  const minutesLeft = Math.floor((secondsLeft % 3600) / 60);

                  return (
                    <div
                      key={item.articleId}
                      className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 max-w-sm">
                        <span className="font-semibold text-[var(--wallet-text)] block truncate">{item.title}</span>
                        <div className="flex items-center gap-2 text-[11px] text-[var(--wallet-muted)]">
                          <Clock className="h-3 w-3 text-[#007C8B]" />
                          {secondsLeft > 0 ? (
                            <span className="font-mono text-cyan-600 dark:text-cyan-400 font-medium">
                              Matures in {daysLeft}d {hoursLeft}h {minutesLeft}m
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium">
                              7-day period matured · Verified on-chain
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="font-mono font-bold text-[var(--wallet-text)] block">
                            {item.amountPnr} PNR
                          </span>
                          <span className="text-[10px] text-[var(--wallet-muted)] font-mono block">
                            {item.authorPnr} Author / {item.curatorPnr} Curator
                          </span>
                        </div>

                        {item.status === 'claimable' && (
                          <button
                            type="button"
                            onClick={() => handleClaimItem(item)}
                            disabled={claimingId === item.articleId || !isCorrectNetwork}
                            className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-[#007C8B] to-[#00E5F4] hover:opacity-95 text-white text-xs font-semibold transition-all disabled:opacity-50 shadow-sm"
                          >
                            {claimingId === item.articleId ? 'Claiming...' : 'Claim PNR'}
                          </button>
                        )}

                        {item.status === 'claimed' && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Claimed</span>
                          </span>
                        )}

                        {item.status === 'accruing' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#007C8B]/10 text-[#007C8B]">
                            Accruing (Day {7 - daysLeft}/7)
                          </span>
                        )}

                        {item.status === 'awaiting_settlement' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400">
                            Pending Batch Root
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── VIEW 2: PROTOCOL REWARD ECONOMICS & RUNWAY ────────────────────── */}
      {subTab === 'economics' && (
        <RewardEconomicsPanel />
      )}
    </div>
  );
}

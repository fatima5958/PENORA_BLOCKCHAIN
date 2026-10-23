// src/components/wallet/CreatorEarningsCard.tsx
// PENORA Creator Economy Earnings Dashboard (Phase 21 — Simplified & Honest On-Chain vs Database State)

import React, { useState, useEffect } from 'react';
import {
  Award,
  Clock,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  PieChart,
  Users,
  MessageSquare,
  History,
  FileText,
  DollarSign,
  Coins,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import {
  executeArticleRewardClaim,
  executeArticleRewardPowerUp,
} from '../../lib/rewards/claimClient';
import { RewardEconomicsPanel } from './RewardEconomicsPanel';
import type { PayoutPreference } from '../../lib/rewards/articleRewards';

interface CreatorEarningsCardProps {
  address?: string | null;
  isCorrectNetwork?: boolean;
  balancePp?: string | null;
  votingManaPercent?: number | null;
}

export interface RewardItem {
  articleId: string;
  title: string;
  publishedAt: string;
  payoutAt: string;
  status: 'accruing' | 'awaiting_settlement' | 'claimable' | 'claimed' | 'declined';
  amountPnr: string;
  authorPnr: string;
  curatorPnr: string;
  beneficiaryPnr?: string;
  commentPnr?: string;
  payoutPreference?: PayoutPreference;
  type: 'article' | 'curation' | 'comment' | 'beneficiary';
  proof?: `0x${string}`[];
  distributor?: `0x${string}`;
  txHash?: string;
}

type TabKey =
  | 'overview'
  | 'articles'
  | 'curation'
  | 'comments'
  | 'beneficiaries'
  | 'history'
  | 'economics';

export function CreatorEarningsCard({
  address,
  isCorrectNetwork,
}: CreatorEarningsCardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(false);
  const [settlementAvailable, setSettlementAvailable] = useState(false);
  const [pendingPnr, setPendingPnr] = useState('0.00');
  const [eligiblePnr, setEligiblePnr] = useState('0.00');
  const [claimablePnr, setClaimablePnr] = useState('0.00');
  const [claimedPnr, setClaimedPnr] = useState('0.00');
  const [authorTotalPnr, setAuthorTotalPnr] = useState('0.00');
  const [curatorTotalPnr, setCuratorTotalPnr] = useState('0.00');
  const [beneficiaryTotalPnr, setBeneficiaryTotalPnr] = useState('0.00');

  const [items, setItems] = useState<RewardItem[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);

  const loadEarnings = async () => {
    if (!address) return;
    setLoading(true);
    setClaimMessage(null);
    try {
      const { data: posts } = await supabase
        .from('posts')
        .select('id, title, published_at, payout_at, published')
        .eq('published', true)
        .order('published_at', { ascending: false })
        .limit(20);

      let pending = 0;
      let eligible = 0;
      let claimable = 0;
      let claimed = 0;
      let authorSum = 0;
      let curatorSum = 0;
      let beneficiarySum = 0;
      let anyDistributorFound = false;
      const itemList: RewardItem[] = [];

      const now = Date.now();

      if (posts) {
        for (const post of posts) {
          const publishedMs = post.published_at ? Date.parse(post.published_at) : now;
          const payoutMs = post.payout_at
            ? Date.parse(post.payout_at)
            : publishedMs + 7 * 86400 * 1000;
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
                anyDistributorFound = true;
                if (info.userClaim.claimed) {
                  status = 'claimed';
                  itemPnr = info.userClaim.amountPnr;
                  claimed += parseFloat(itemPnr);
                } else {
                  status = 'claimable';
                  itemPnr = info.userClaim.amountPnr;
                  proof = info.userClaim.proof;
                  distributor = info.userClaim.distributor;
                  claimable += parseFloat(itemPnr);
                }
              } else if (isAccruing) {
                itemPnr = authorPnr;
                pending += parseFloat(itemPnr);
              } else if (info.status === 'prepared') {
                itemPnr = authorPnr;
                eligible += parseFloat(itemPnr);
              }
            }
          } catch {
            // Offline fallback
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
            type: 'article',
            proof,
            distributor,
          });
        }
      }

      setSettlementAvailable(anyDistributorFound);
      setPendingPnr(pending.toFixed(2));
      setEligiblePnr(eligible.toFixed(2));
      setClaimablePnr(claimable.toFixed(2));
      setClaimedPnr(claimed.toFixed(2));
      setAuthorTotalPnr(authorSum.toFixed(2));
      setCuratorTotalPnr(curatorSum.toFixed(2));
      setBeneficiaryTotalPnr(beneficiarySum.toFixed(2));
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

  const handleClaimLiquid = async (item: RewardItem) => {
    if (!item.proof || !item.distributor || !address || claimingId) return;
    setClaimingId(item.articleId);
    setClaimMessage('Awaiting wallet approval for on-chain Merkle claim (Liquid PNR)…');
    setClaimTxHash(null);
    try {
      const result = await executeArticleRewardClaim({
        contractAddress: item.distributor,
        articleRawId: item.articleId,
        recipientAddress: address as `0x${string}`,
        amountWei: BigInt(Math.floor(parseFloat(item.amountPnr) * 1e18)),
        proof: item.proof,
        onProgress: status => setClaimMessage(status),
      });

      if (result.success && result.confirmed && result.txHash) {
        setClaimTxHash(result.txHash);
        const blockText = result.blockNumber ? ` in block #${result.blockNumber}` : '';
        setClaimMessage(
          `Confirmed on Polygon Amoy${blockText}! Liquid PNR delivered to your wallet.`
        );
        await loadEarnings();
      } else if (result.txHash && !result.confirmed) {
        setClaimTxHash(result.txHash);
        setClaimMessage(
          result.error ||
            'Submitted — awaiting receipt confirmation on Polygon Amoy. Check PolygonScan.'
        );
      } else {
        setClaimMessage(result.error || 'Claim transaction failed.');
      }
    } catch (err: unknown) {
      setClaimMessage(err instanceof Error ? err.message : 'Claim failed.');
    } finally {
      setClaimingId(null);
    }
  };

  const handleClaimPowerUp = async (item: RewardItem) => {
    if (!item.proof || !item.distributor || !address || claimingId) return;
    setClaimingId(item.articleId);
    setClaimMessage('Awaiting wallet approval for 100% Power Up claim on Polygon Amoy…');
    setClaimTxHash(null);
    try {
      const result = await executeArticleRewardPowerUp({
        contractAddress: item.distributor,
        articleRawId: item.articleId,
        recipientAddress: address as `0x${string}`,
        amountWei: BigInt(Math.floor(parseFloat(item.amountPnr) * 1e18)),
        proof: item.proof,
        onProgress: status => setClaimMessage(status),
      });

      if (result.success && result.confirmed && result.txHash) {
        setClaimTxHash(result.txHash);
        const blockText = result.blockNumber ? ` in block #${result.blockNumber}` : '';
        setClaimMessage(
          `Confirmed${blockText}! 100% Power Up credited directly to your PENORA Power escrow.`
        );
        await loadEarnings();
      } else if (result.txHash && !result.confirmed) {
        setClaimTxHash(result.txHash);
        setClaimMessage(
          result.error ||
            'Submitted — awaiting receipt confirmation on Polygon Amoy. Check PolygonScan.'
        );
      } else {
        setClaimMessage(result.error || 'Power Up transaction failed.');
      }
    } catch (err: unknown) {
      setClaimMessage(err instanceof Error ? err.message : 'Power Up claim failed.');
    } finally {
      setClaimingId(null);
    }
  };

  const hasAddress = Boolean(address);
  const articleItems = items.filter(i => i.type === 'article');
  const curationItems = items.filter(i => i.type === 'curation' || parseFloat(i.curatorPnr) > 0);
  const beneficiaryItems = items.filter(i => i.type === 'beneficiary');

  return (
    <section
      aria-label="Creator earnings and rewards"
      className="rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] p-5 sm:p-6 shadow-2xs space-y-5"
    >
      {/* ─── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--wallet-border)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0A2540] text-[#00E5F4] flex items-center justify-center shrink-0">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--wallet-text)]">
              Creator Earnings &amp; Rewards
            </h2>
            <p className="text-xs text-[var(--wallet-muted)]">
              70% Author / 20% Curator split · 7-day voting window · On-chain Merkle claims
            </p>
          </div>
        </div>

        {hasAddress && (
          <button
            type="button"
            onClick={loadEarnings}
            disabled={loading}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] hover:border-[#007C8B]/40 text-xs font-semibold text-[var(--wallet-text)] inline-flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* ─── HONEST SETTLEMENT DISTINCTION BANNER ──────────────────────────── */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="space-y-0.5">
          <span className="font-semibold block">
            {!hasAddress
              ? 'Wallet Connection Required'
              : settlementAvailable
              ? 'On-Chain Reward Settlement Active (Polygon Amoy)'
              : 'Database Estimates vs. Confirmed Blockchain Earnings'}
          </span>
          <p className="text-[11px] opacity-90 leading-relaxed">
            {!hasAddress
              ? 'Connect your wallet on Polygon Amoy (80002) to check verified claimable PNR and reward history.'
              : 'Pending rewards are off-chain database estimates during the 7-day voting window. Tokens become confirmed blockchain earnings only after an on-chain Merkle root is published and claimed.'}
          </p>
        </div>
      </div>

      {/* ─── SUB-NAVIGATION BAR ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[var(--wallet-border)] text-xs font-semibold">
        {[
          { key: 'overview', label: 'Overview', icon: PieChart },
          { key: 'articles', label: 'Article Rewards', icon: FileText },
          { key: 'history', label: 'Reward History', icon: History },
          { key: 'curation', label: 'Curation', icon: Sparkles },
          { key: 'beneficiaries', label: 'Beneficiaries', icon: Users },
          { key: 'comments', label: 'Comments', icon: MessageSquare },
          { key: 'economics', label: 'Economics', icon: DollarSign },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`shrink-0 min-h-[38px] py-1.5 px-3 rounded-xl flex items-center gap-1.5 transition-colors ${
                isActive
                  ? 'bg-[#0A2540] text-white dark:bg-[#007C8B] font-bold'
                  : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:bg-[var(--wallet-inset)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── TRANSACTION STATUS MESSAGE ────────────────────────────────────── */}
      {claimMessage && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
            claimTxHash
              ? 'bg-emerald-500/12 border-emerald-500/25 text-emerald-800 dark:text-emerald-200'
              : 'bg-[#007C8B]/10 border-[#007C8B]/25 text-[var(--wallet-text)]'
          }`}
        >
          {claimTxHash ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <Clock className="h-4 w-4 shrink-0 text-[#007C8B] animate-spin" />
          )}
          <div className="space-y-0.5 flex-1 min-w-0">
            <span className="font-semibold block">{claimMessage}</span>
            {claimTxHash && (
              <a
                href={`https://amoy.polygonscan.com/tx/${claimTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[11px] underline hover:opacity-80"
              >
                <span>View PolygonScan receipt ({claimTxHash.slice(0, 10)}…)</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 1: OVERVIEW (Pending, Claimable, Claimed, History Summary) ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* 4 Main Top Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wallet-muted)]">
                  Pending Rewards
                </span>
                <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  Estimate
                </span>
              </div>
              <div className="font-mono text-xl sm:text-2xl font-bold text-[var(--wallet-text)] tabular-nums">
                {hasAddress ? pendingPnr : '—'}{' '}
                <span className="text-xs font-normal text-[var(--wallet-muted)]">PNR</span>
              </div>
              <span className="text-[11px] text-[var(--wallet-muted)] block">
                7-day voting window (unconfirmed)
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wallet-muted)]">
                  Awaiting Settlement
                </span>
                <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[var(--wallet-surface)] text-[var(--wallet-muted)]">
                  Matured
                </span>
              </div>
              <div className="font-mono text-xl sm:text-2xl font-bold text-[var(--wallet-text)] tabular-nums">
                {hasAddress ? eligiblePnr : '—'}{' '}
                <span className="text-xs font-normal text-[var(--wallet-muted)]">PNR</span>
              </div>
              <span className="text-[11px] text-[var(--wallet-muted)] block">
                Pending on-chain Merkle root
              </span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/25 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Claimable PNR
                </span>
                <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  On-Chain
                </span>
              </div>
              <div className="font-mono text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {hasAddress ? claimablePnr : '—'}{' '}
                <span className="text-xs font-normal text-[var(--wallet-muted)]">PNR</span>
              </div>
              <span className="text-[11px] text-[var(--wallet-muted)] block">
                Verified Merkle proof ready
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wallet-muted)]">
                  Claimed PNR
                </span>
                <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[#007C8B]/15 text-[#007C8B] dark:text-[#00E5F4]">
                  Confirmed
                </span>
              </div>
              <div className="font-mono text-xl sm:text-2xl font-bold text-[var(--wallet-text)] tabular-nums">
                {hasAddress ? claimedPnr : '—'}{' '}
                <span className="text-xs font-normal text-[var(--wallet-muted)]">PNR</span>
              </div>
              <span className="text-[11px] text-[var(--wallet-muted)] block">
                Delivered to wallet on Amoy
              </span>
            </div>
          </div>

          {/* Empty State for Zero Claimable Rewards */}
          {(!hasAddress || parseFloat(claimablePnr) <= 0) && (
            <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <strong className="font-semibold text-[var(--wallet-text)] block">
                  {hasAddress
                    ? 'No claimable on-chain PNR rewards right now'
                    : 'Connect your wallet to check claimable PNR'}
                </strong>
                <p className="text-[11px] text-[var(--wallet-muted)]">
                  {hasAddress
                    ? 'Publish stories or curate articles with PENORA Power to earn from the 70% Author / 20% Curator reward pool.'
                    : 'On-chain reward claims verify your connected Polygon Amoy address against published Merkle roots.'}
                </p>
              </div>
              <a
                href="/write"
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#007C8B] hover:bg-[#006673] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0"
              >
                <span>Write an Article</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          )}

          {/* Category Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-1">
              <span className="text-xs font-bold text-[var(--wallet-text)] flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-[#007C8B] dark:text-[#00E5F4]" />
                <span>Author Share (70%)</span>
              </span>
              <div className="font-mono text-lg font-bold text-[var(--wallet-text)] tabular-nums">
                {hasAddress ? `${authorTotalPnr} PNR` : '— PNR'}
              </div>
              <p className="text-[11px] text-[var(--wallet-muted)]">
                Estimated &amp; settled author allocations from your published articles.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-1">
              <span className="text-xs font-bold text-[var(--wallet-text)] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Curation Share (20%)</span>
              </span>
              <div className="font-mono text-lg font-bold text-[var(--wallet-text)] tabular-nums">
                {hasAddress ? `${curatorTotalPnr} PNR` : '— PNR'}
              </div>
              <p className="text-[11px] text-[var(--wallet-muted)]">
                Earned by upvoting quality articles with staked PENORA Power.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-1">
              <span className="text-xs font-bold text-[var(--wallet-text)] flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-emerald-500" />
                <span>Beneficiary Splits</span>
              </span>
              <div className="font-mono text-lg font-bold text-[var(--wallet-text)] tabular-nums">
                {hasAddress ? `${beneficiaryTotalPnr} PNR` : '— PNR'}
              </div>
              <p className="text-[11px] text-[var(--wallet-muted)]">
                Co-author and collaborator revenue splits configured on posts.
              </p>
            </div>
          </div>

          {/* Exchange / P2P Shortcut */}
          <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[var(--wallet-text)] flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-[#007C8B] dark:text-[#00E5F4]" />
                <span>PENORA Exchange &amp; P2P Marketplace</span>
              </span>
              <p className="text-[11px] text-[var(--wallet-muted)]">
                Trade claimed liquid PNR for MockUSDT on the non-custodial P2P escrow or purchase desk.
              </p>
            </div>
            <a
              href="/exchange/"
              className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0A2540] hover:bg-[#103152] text-white font-semibold text-xs transition-colors shrink-0"
            >
              <span>Open Exchange</span>
              <ExternalLink className="h-3 w-3 text-[#00E5F4]" />
            </a>
          </div>
        </div>
      )}

      {/* ─── TAB 2: ARTICLE REWARDS ───────────────────────────────────────── */}
      {activeTab === 'articles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--wallet-muted)]">
              Published Articles &amp; Reward Status
            </h3>
            <span className="text-[11px] text-[var(--wallet-muted)]">
              {articleItems.length} articles
            </span>
          </div>

          {articleItems.length === 0 ? (
            <div className="p-6 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--wallet-muted)]">
              <span>
                No published articles found. Publish stories from the editor to accrue 7-day author rewards.
              </span>
              <a
                href="/write"
                className="font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline inline-flex items-center gap-1"
              >
                <span>Write Article</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : (
            <div className="space-y-2.5">
              {articleItems.map(item => {
                const isClaiming = claimingId === item.articleId;
                const isClaimable = item.status === 'claimable';
                const statusLabel =
                  item.status === 'claimable'
                    ? 'On-Chain Claimable'
                    : item.status === 'claimed'
                    ? 'Claimed On-Chain'
                    : item.status === 'awaiting_settlement'
                    ? 'Awaiting Merkle Settlement (Estimate)'
                    : 'Accruing in 7-Day Window (Estimate)';
                return (
                  <div
                    key={item.articleId}
                    className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 max-w-md min-w-0">
                      <span className="font-bold text-sm text-[var(--wallet-text)] block truncate">
                        {item.title}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-[var(--wallet-muted)]">
                        <span>Maturity: {new Date(item.payoutAt).toLocaleDateString()}</span>
                        <span>·</span>
                        <span className="px-1.5 py-0.5 rounded bg-[var(--wallet-surface)] text-[var(--wallet-text)] font-medium">
                          {item.payoutPreference === 'power_up'
                            ? '100% Power Up'
                            : item.payoutPreference === 'declined'
                            ? 'Declined'
                            : 'Liquid PNR'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-[var(--wallet-text)] block tabular-nums">
                          {item.authorPnr} PNR
                        </span>
                        <span className="text-[10px] text-[var(--wallet-muted)]">
                          {statusLabel}
                        </span>
                      </div>

                      {isClaimable && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleClaimLiquid(item)}
                            disabled={isClaiming || !isCorrectNetwork}
                            className="min-h-[38px] py-1.5 px-3 rounded-xl bg-[#007C8B] hover:bg-[#006673] text-white text-xs font-bold disabled:opacity-50"
                          >
                            {isClaiming ? 'Claiming…' : 'Claim PNR'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClaimPowerUp(item)}
                            disabled={isClaiming || !isCorrectNetwork}
                            className="min-h-[38px] py-1.5 px-3 rounded-xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] text-[#007C8B] dark:text-[#00E5F4] text-xs font-bold hover:border-[#007C8B]/40 disabled:opacity-50"
                            title="Auto-stake 100% into PENORA Power"
                          >
                            Power Up
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: REWARD HISTORY ────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--wallet-muted)]">
              Creator Reward History
            </h3>
            <span className="text-[11px] text-[var(--wallet-muted)]">{items.length} records</span>
          </div>

          {items.length === 0 ? (
            <div className="p-6 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--wallet-muted)]">
              <span>No reward history recorded for this wallet yet.</span>
              <a
                href="/write"
                className="font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline inline-flex items-center gap-1"
              >
                <span>Write an Article</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div
                  key={item.articleId}
                  className="p-3.5 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-semibold text-[var(--wallet-text)] block truncate max-w-xs">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-[var(--wallet-muted)]">
                      Published {new Date(item.publishedAt).toLocaleDateString()} · Payout{' '}
                      {new Date(item.payoutAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-[var(--wallet-text)] tabular-nums">
                      {item.authorPnr} PNR
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        item.status === 'claimable'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : item.status === 'claimed'
                          ? 'bg-[#007C8B]/15 text-[#007C8B] dark:text-[#00E5F4]'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {item.status === 'claimable'
                        ? 'Claimable'
                        : item.status === 'claimed'
                        ? 'Claimed'
                        : 'Estimate'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: CURATION SHARES ───────────────────────────────────────── */}
      {activeTab === 'curation' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--wallet-muted)]">
              Curation Rewards (20% Pool)
            </h3>
            <span className="font-mono text-xs font-bold text-[#007C8B] dark:text-[#00E5F4]">
              Total: {hasAddress ? `${curatorTotalPnr} PNR` : '— PNR'}
            </span>
          </div>

          <p className="text-xs text-[var(--wallet-muted)]">
            Curators who upvote quality stories within the 7-day window earn a stake-weighted share of the 20% curation reward pool. Self-votes do not earn curation rewards.
          </p>

          {curationItems.length === 0 ? (
            <div className="p-5 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--wallet-muted)]">
              <span>No curation earnings recorded yet. Upvote articles with PENORA Power to earn.</span>
              <a
                href="/"
                className="font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline inline-flex items-center gap-1"
              >
                <span>Explore Stories</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {curationItems.map(item => (
                <div
                  key={item.articleId}
                  className="p-3.5 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex items-center justify-between gap-3 text-xs"
                >
                  <span className="font-semibold text-[var(--wallet-text)] truncate">
                    {item.title}
                  </span>
                  <span className="font-mono font-bold text-[#007C8B] dark:text-[#00E5F4]">
                    +{item.curatorPnr} PNR
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 5: BENEFICIARIES ─────────────────────────────────────────── */}
      {activeTab === 'beneficiaries' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--wallet-muted)]">
              Beneficiary Revenue Sharing
            </h3>
            <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Total: {hasAddress ? `${beneficiaryTotalPnr} PNR` : '— PNR'}
            </span>
          </div>

          <p className="text-xs text-[var(--wallet-muted)]">
            Authors can designate co-creators or editors to automatically receive a percentage of the 70% author share upon settlement.
          </p>

          {beneficiaryItems.length === 0 ? (
            <div className="p-5 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] text-xs text-[var(--wallet-muted)]">
              No beneficiary payouts recorded for this wallet.
            </div>
          ) : (
            <div className="space-y-2">
              {beneficiaryItems.map(item => (
                <div
                  key={item.articleId}
                  className="p-3.5 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex items-center justify-between gap-3 text-xs"
                >
                  <span className="font-semibold text-[var(--wallet-text)] truncate">
                    {item.title}
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +{item.amountPnr} PNR
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 6: COMMENTS ──────────────────────────────────────────────── */}
      {activeTab === 'comments' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--wallet-muted)]">
              Comment &amp; Reply Rewards
            </h3>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
              Budget Gate: Disabled by Default
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] text-xs text-[var(--wallet-muted)] leading-relaxed">
            Comment rewards reside in a separate capped allocation within the 30M scheduled creator budget and remain disabled by default until activated by governance.
          </div>
        </div>
      )}

      {/* ─── TAB 7: ECONOMICS ─────────────────────────────────────────────── */}
      {activeTab === 'economics' && (
        <div className="pt-1">
          <RewardEconomicsPanel />
        </div>
      )}
    </section>
  );
}

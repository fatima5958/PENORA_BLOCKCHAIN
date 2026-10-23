// src/components/wallet/CreatorEarningsCard.tsx
// PENORA Creator Economy Earnings Dashboard (Phase 14)
// Tabs: Overview | Article Rewards | Curation | Comments | Beneficiaries | History | Economics

import React, { useState, useEffect } from 'react';
import {
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  PieChart,
  Zap,
  Info,
  Users,
  MessageSquare,
  History,
  FileText,
  DollarSign,
  Lock,
  Coins,
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

type TabKey = 'overview' | 'articles' | 'curation' | 'comments' | 'beneficiaries' | 'history' | 'economics';

export function CreatorEarningsCard({
  address,
  isCorrectNetwork,
  balancePp = '0.00',
  votingManaPercent = 100,
}: CreatorEarningsCardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(false);
  const [pendingPnr, setPendingPnr] = useState('0.00');
  const [eligiblePnr, setEligiblePnr] = useState('0.00');
  const [claimablePnr, setClaimablePnr] = useState('0.00');
  const [claimedPnr, setClaimedPnr] = useState('0.00');
  const [authorTotalPnr, setAuthorTotalPnr] = useState('0.00');
  const [curatorTotalPnr, setCuratorTotalPnr] = useState('0.00');
  const [beneficiaryTotalPnr, setBeneficiaryTotalPnr] = useState('0.00');
  const [poweredUpTotalPnr, setPoweredUpTotalPnr] = useState('0.00');
  const [declinedTotalPnr, setDeclinedTotalPnr] = useState('0.00');

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
      let authorSum = 0;
      let curatorSum = 0;
      let beneficiarySum = 0;
      let poweredUpSum = 0;
      let declinedSum = 0;
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

      setPendingPnr(pending.toFixed(2));
      setEligiblePnr(eligible.toFixed(2));
      setClaimablePnr(claimable.toFixed(2));
      setAuthorTotalPnr(authorSum.toFixed(2));
      setCuratorTotalPnr(curatorSum.toFixed(2));
      setBeneficiaryTotalPnr(beneficiarySum.toFixed(2));
      setPoweredUpTotalPnr(poweredUpSum.toFixed(2));
      setDeclinedTotalPnr(declinedSum.toFixed(2));
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
    setClaimMessage('Initiating on-chain Merkle claim signature (Liquid PNR)...');
    setClaimTxHash(null);
    try {
      const result = await executeArticleRewardClaim({
        contractAddress: item.distributor,
        articleRawId: item.articleId,
        recipientAddress: address as `0x${string}`,
        amountWei: BigInt(Math.floor(parseFloat(item.amountPnr) * 1e18)),
        proof: item.proof,
        onProgress: (status) => setClaimMessage(status),
      });

      if (result.success && result.confirmed && result.txHash) {
        setClaimTxHash(result.txHash);
        const blockText = result.blockNumber ? ` in block #${result.blockNumber}` : '';
        setClaimMessage(`Claim confirmed on Polygon Amoy${blockText}! Tokens delivered to your wallet.`);
        await loadEarnings();
      } else if (result.txHash && !result.confirmed) {
        setClaimTxHash(result.txHash);
        setClaimMessage(result.error || `Transaction pending on Polygon Amoy. Please check block explorer.`);
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
    setClaimMessage('Initiating 100% Power Up claim on Polygon Amoy...');
    setClaimTxHash(null);
    try {
      const result = await executeArticleRewardPowerUp({
        contractAddress: item.distributor,
        articleRawId: item.articleId,
        recipientAddress: address as `0x${string}`,
        amountWei: BigInt(Math.floor(parseFloat(item.amountPnr) * 1e18)),
        proof: item.proof,
        onProgress: (status) => setClaimMessage(status),
      });

      if (result.success && result.confirmed && result.txHash) {
        setClaimTxHash(result.txHash);
        const blockText = result.blockNumber ? ` in block #${result.blockNumber}` : '';
        setClaimMessage(`100% Power Up confirmed${blockText}! PENORA Power credited directly to your escrow.`);
        await loadEarnings();
      } else if (result.txHash && !result.confirmed) {
        setClaimTxHash(result.txHash);
        setClaimMessage(result.error || `Transaction pending on Polygon Amoy. Please check block explorer.`);
      } else {
        setClaimMessage(result.error || 'Power Up transaction failed.');
      }
    } catch (err: unknown) {
      setClaimMessage(err instanceof Error ? err.message : 'Power Up claim failed.');
    } finally {
      setClaimingId(null);
    }
  };

  const articleItems = items.filter((i) => i.type === 'article');
  const curationItems = items.filter((i) => i.type === 'curation' || parseFloat(i.curatorPnr) > 0);
  const beneficiaryItems = items.filter((i) => i.type === 'beneficiary');

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
              PENORA Creator Economy
            </h3>
            <p className="text-xs text-[var(--wallet-muted)]">
              70% Author / 20% Curator split, 7-day maturation, beneficiaries &amp; power-up preferences.
            </p>
          </div>
        </div>

        {address && (
          <button
            type="button"
            onClick={loadEarnings}
            disabled={loading}
            title="Refresh earnings"
            className="p-1.5 rounded-xl hover:bg-[var(--wallet-inset)] text-[#007C8B] transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* ─── 7-TAB NAVIGATION BAR ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[#007C8B]/15 text-xs font-semibold">
        {[
          { key: 'overview', label: 'Overview', icon: PieChart },
          { key: 'articles', label: 'Article Rewards', icon: FileText },
          { key: 'curation', label: 'Curation', icon: Sparkles },
          { key: 'comments', label: 'Comments', icon: MessageSquare },
          { key: 'beneficiaries', label: 'Beneficiaries', icon: Users },
          { key: 'history', label: 'History', icon: History },
          { key: 'economics', label: 'Economics', icon: DollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`shrink-0 py-2 px-3 rounded-xl flex items-center gap-1.5 transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#007C8B] to-[#00E5F4] text-white shadow-xs font-bold'
                  : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:bg-[var(--wallet-inset)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Testnet Notice Banner */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="space-y-0.5">
          <span className="font-semibold block">Polygon Amoy Testnet (Chain ID 80002)</span>
          <p className="text-[11px] opacity-90 leading-relaxed">
            All earnings represent testnet PNR tokens backed by on-chain Merkle settlement roots. Fixed 100M total supply strictly preserved.
          </p>
        </div>
      </div>

      {/* Transaction Status Message */}
      {claimMessage && (
        <div
          role="status"
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 ${
            claimTxHash
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
              : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-800 dark:text-cyan-300'
          }`}
        >
          {claimTxHash ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Clock className="h-4 w-4 shrink-0 text-cyan-600 animate-spin" />}
          <div className="space-y-0.5 flex-1 min-w-0">
            <span className="font-semibold block">{claimMessage}</span>
            {claimTxHash && (
              <a
                href={`https://amoy.polygonscan.com/tx/${claimTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[10px] underline hover:opacity-80"
              >
                <span>View Polygon Amoy transaction ({claimTxHash.slice(0, 10)}...)</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 1: OVERVIEW ──────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 4 Main Top Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wallet-muted)] block">
                Pending (In 7-Day Window)
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-[var(--wallet-text)]">
                {pendingPnr} <span className="text-xs font-normal text-[var(--wallet-muted)]">PNR</span>
              </div>
              <span className="text-[10px] text-[var(--wallet-muted)] block">Accruing voting influence</span>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#007C8B] block">
                Eligible for Settlement
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-[#007C8B]">
                {eligiblePnr} <span className="text-xs font-normal text-[var(--wallet-muted)]">PNR</span>
              </div>
              <span className="text-[10px] text-[var(--wallet-muted)] block">7-day maturity complete</span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Claimable Now
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {claimablePnr} <span className="text-xs font-normal text-[var(--wallet-muted)]">PNR</span>
              </div>
              <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 block">Verified on-chain root</span>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/10 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wallet-muted)] block">
                Claimed Historically
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-[var(--wallet-text)]">
                {claimedPnr} <span className="text-xs font-normal text-[var(--wallet-muted)]">PNR</span>
              </div>
              <span className="text-[10px] text-[var(--wallet-muted)] block">Delivered to wallet</span>
            </div>
          </div>

          {/* PENORA Category Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/15 space-y-2">
              <span className="text-xs font-bold uppercase text-[var(--wallet-muted)] flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-[#007C8B]" />
                <span>Author Earnings (70%)</span>
              </span>
              <div className="font-mono text-xl font-bold text-[var(--wallet-text)]">
                {authorTotalPnr} PNR
              </div>
              <p className="text-[11px] text-[var(--wallet-muted)]">Direct earnings from your published stories.</p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/15 space-y-2">
              <span className="text-xs font-bold uppercase text-[var(--wallet-muted)] flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-cyan-500" />
                <span>Curation Shares (20%)</span>
              </span>
              <div className="font-mono text-xl font-bold text-cyan-600 dark:text-cyan-400">
                {curatorTotalPnr} PNR
              </div>
              <p className="text-[11px] text-[var(--wallet-muted)]">Earned from discoverability votes on articles.</p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/15 space-y-2">
              <span className="text-xs font-bold uppercase text-[var(--wallet-muted)] flex items-center gap-1.5">
                <Users className="h-4 w-4 text-emerald-500" />
                <span>Beneficiary &amp; Powered Up</span>
              </span>
              <div className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {beneficiaryTotalPnr} PNR
              </div>
              <p className="text-[11px] text-[var(--wallet-muted)]">Collaborator revenue splits &amp; auto-staked PP.</p>
            </div>
          </div>

          {/* Quick P2P Marketplace Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-[#007C8B]/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-[var(--wallet-text)] flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-emerald-500" />
                <span>P2P Token Marketplace</span>
              </span>
              <p className="text-[11px] text-[var(--wallet-muted)]">
                Trade your earned liquid PNR tokens directly for MockUSDT in the non-custodial P2P escrow.
              </p>
            </div>
            <a
              href="/exchange/"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold text-xs hover:opacity-95 transition-all shrink-0 shadow-xs"
            >
              <span>Trade PNR</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {/* ─── TAB 2: ARTICLE REWARDS ───────────────────────────────────────── */}
      {activeTab === 'articles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--wallet-muted)]">
              Your Published Articles &amp; Author Allocations
            </h4>
            <span className="text-[11px] text-[var(--wallet-muted)]">{articleItems.length} articles</span>
          </div>

          {articleItems.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[var(--wallet-inset)] border border-dashed border-black/10 text-xs text-[var(--wallet-muted)]">
              No published articles found. Publish stories from the editor to accrue 7-day author rewards.
            </div>
          ) : (
            <div className="space-y-3">
              {articleItems.map((item) => {
                const isClaiming = claimingId === item.articleId;
                const isClaimable = item.status === 'claimable';
                return (
                  <div
                    key={item.articleId}
                    className="p-4 rounded-2xl bg-[var(--wallet-inset)] border border-[#007C8B]/15 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 max-w-sm">
                      <span className="font-serif font-bold text-sm text-[var(--wallet-text)] block truncate">
                        {item.title}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--wallet-muted)]">
                        <span>Maturity: {new Date(item.payoutAt).toLocaleDateString()}</span>
                        <span>·</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#EEFBFC] text-[#006573] dark:bg-[#007C8B]/20 dark:text-[#00E5F4] font-medium">
                          {item.payoutPreference === 'power_up' ? '100% Power Up' : item.payoutPreference === 'declined' ? 'Declined' : 'Liquid PNR'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-[var(--wallet-text)] block">
                          {item.authorPnr} PNR
                        </span>
                        <span className="text-[10px] text-[var(--wallet-muted)] uppercase">{item.status}</span>
                      </div>

                      {isClaimable && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleClaimLiquid(item)}
                            disabled={isClaiming || !isCorrectNetwork}
                            className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-[#007C8B] to-[#00E5F4] text-white text-xs font-bold hover:brightness-110 shadow-xs disabled:opacity-50"
                          >
                            {isClaiming ? 'Claiming…' : 'Claim PNR'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClaimPowerUp(item)}
                            disabled={isClaiming || !isCorrectNetwork}
                            className="py-1.5 px-3 rounded-xl bg-[var(--wallet-surface)] border border-[#007C8B]/30 text-[#007C8B] dark:text-[#00E5F4] text-xs font-bold hover:bg-[#007C8B]/10 shadow-xs disabled:opacity-50"
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

      {/* ─── TAB 3: CURATION SHARES ───────────────────────────────────────── */}
      {activeTab === 'curation' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--wallet-muted)]">
              Curation Rewards Earned From Voting
            </h4>
            <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400">
              Total: {curatorTotalPnr} PNR
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#EEFBFC]/60 dark:bg-[#007C8B]/10 border border-[#007C8B]/20 text-xs text-[#006573] dark:text-[#00E5F4] leading-relaxed">
            <strong>20% Curation Pool:</strong> Curators who upvote quality stories within the 7-day window earn a stake-weighted share of the curation reward. Self-votes do not earn curation rewards.
          </div>

          {curationItems.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[var(--wallet-inset)] border border-dashed border-black/10 text-xs text-[var(--wallet-muted)]">
              No curation earnings recorded. Upvote articles with PENORA Power to earn 20% curation shares.
            </div>
          ) : (
            <div className="space-y-2">
              {curationItems.map((item) => (
                <div
                  key={item.articleId}
                  className="p-3.5 rounded-2xl bg-[var(--wallet-inset)] border border-black/5 flex items-center justify-between gap-3 text-xs"
                >
                  <span className="font-semibold text-[var(--wallet-text)] truncate">{item.title}</span>
                  <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                    +{item.curatorPnr} PNR
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: COMMENTS & REPLIES ────────────────────────────────────── */}
      {activeTab === 'comments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--wallet-muted)]">
              Comment &amp; Reply Rewards
            </h4>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
              [Budget Gate: Disabled by Default]
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 leading-relaxed space-y-1">
            <strong>Scheduled Budget Funding Gate:</strong>
            <p className="text-[11px] opacity-90">
              In accordance with PENORA creator governance, comment rewards reside in a separate capped allocation within the 30M scheduled creator budget, with zero funding allocated by default. Active comment emissions remain disabled until founder authorization.
            </p>
          </div>

          <div className="p-8 text-center rounded-2xl bg-[var(--wallet-inset)] border border-dashed border-black/10 text-xs text-[var(--wallet-muted)] space-y-1">
            <MessageSquare className="h-6 w-6 mx-auto text-[var(--wallet-muted)] mb-2" />
            <p className="font-semibold text-[var(--wallet-text)]">No Active Comment Reward Emissions</p>
            <p className="text-[11px]">Quality discussions continue to accrue social discoverability and community reputation.</p>
          </div>
        </div>
      )}

      {/* ─── TAB 5: BENEFICIARIES ─────────────────────────────────────────── */}
      {activeTab === 'beneficiaries' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--wallet-muted)]">
              Reward Beneficiary Revenue Sharing
            </h4>
            <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Total: {beneficiaryTotalPnr} PNR
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#EEFBFC]/60 dark:bg-[#007C8B]/10 border border-[#007C8B]/20 text-xs text-[#006573] dark:text-[#00E5F4] leading-relaxed">
            <strong>Collaborator Revenue Splits:</strong> Authors can designate co-creators, illustrators, or editors to automatically receive a percentage of their author reward (up to 100%). Beneficiary shares are paid directly from the author's 70% portion.
          </div>

          {beneficiaryItems.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[var(--wallet-inset)] border border-dashed border-black/10 text-xs text-[var(--wallet-muted)]">
              No beneficiary payouts recorded. When publishing, you can add collaborator wallet percentages in article settings.
            </div>
          ) : (
            <div className="space-y-2">
              {beneficiaryItems.map((item) => (
                <div
                  key={item.articleId}
                  className="p-3.5 rounded-2xl bg-[var(--wallet-inset)] border border-black/5 flex items-center justify-between gap-3 text-xs"
                >
                  <span className="font-semibold text-[var(--wallet-text)] truncate">{item.title}</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +{item.amountPnr} PNR
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 6: COMPLETE HISTORY ──────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--wallet-muted)]">
              Comprehensive Creator Payout History
            </h4>
            <span className="text-[11px] text-[var(--wallet-muted)]">{items.length} records</span>
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[var(--wallet-inset)] border border-dashed border-black/10 text-xs text-[var(--wallet-muted)]">
              No reward history available yet.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.articleId}
                  className="p-3.5 rounded-2xl bg-[var(--wallet-inset)] border border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-[var(--wallet-text)] block truncate max-w-xs">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-[var(--wallet-muted)]">
                      Published {new Date(item.publishedAt).toLocaleDateString()} · Payout {new Date(item.payoutAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-[var(--wallet-text)]">
                      {item.authorPnr} PNR
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        item.status === 'claimable'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : item.status === 'claimed'
                          ? 'bg-blue-500/10 text-blue-600'
                          : 'bg-amber-500/10 text-amber-600'
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 7: PROTOCOL ECONOMICS & RUNWAY ────────────────────────────── */}
      {activeTab === 'economics' && (
        <div className="pt-2">
          <RewardEconomicsPanel />
        </div>
      )}
    </div>
  );
}

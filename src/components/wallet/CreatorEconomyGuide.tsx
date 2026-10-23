// src/components/wallet/CreatorEconomyGuide.tsx
// Educational Guide explaining PENORA's Steemit-Style Creator Economy
// Accessible to beginners while maintaining financial rigor and testnet transparency.

import React, { useState } from 'react';
import {
  HelpCircle,
  Coins,
  Award,
  Zap,
  TrendingDown,
  ArrowRightLeft,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

interface GuideItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  question: string;
  summary: string;
  details: string[];
  badge?: string;
}

const GUIDE_ITEMS: GuideItem[] = [
  {
    id: 'pnr',
    icon: <Coins className="h-4 w-4 text-[#00E5F4]" />,
    title: 'PENORA Token (PNR)',
    question: 'What is PNR?',
    summary: 'The native cryptographic utility and reward token powering the PENORA ecosystem.',
    details: [
      'Fixed Supply: Strictly capped at 100,000,000 PNR with no inflationary minting.',
      'Utility: Used for creator tipping, staking into PENORA Power, and P2P marketplace exchange.',
      'Testnet Status: Currently operating on Polygon Amoy (80002) as a testnet utility asset.',
    ],
    badge: '100M Fixed Supply',
  },
  {
    id: 'earning',
    icon: <Award className="h-4 w-4 text-emerald-400" />,
    title: 'Creator Rewards',
    question: 'How do creators earn?',
    summary: 'Authors earn 70% of the scheduled reward allocation based on verified curation upvotes.',
    details: [
      '70% Author Share: Net payout goes directly to the author or designated collaborators.',
      'Payout Preferences: Choose Liquid PNR, 100% Power Up (auto-stake), or Decline Rewards.',
      'No Self-Farming: Author self-votes are cryptographically excluded from reward calculations.',
    ],
    badge: '70% Author Split',
  },
  {
    id: 'pp',
    icon: <Zap className="h-4 w-4 text-amber-400" />,
    title: 'PENORA Power (PP)',
    question: 'What is PENORA Power?',
    summary: 'Staked PNR held 1:1 in non-custodial escrow that gives you on-chain voting influence.',
    details: [
      '1 PNR = 1 PP: Converting liquid PNR to PP is instantaneous with zero deposit fee.',
      'Voting Mana: Starts at 100% (10,000 bps) and regenerates linearly over 5 days (432,000 seconds).',
      'Stake Weight: The more PP you hold, the larger your curation impact on article payouts.',
    ],
    badge: '1:1 Staking Escrow',
  },
  {
    id: 'curation',
    icon: <ShieldCheck className="h-4 w-4 text-cyan-400" />,
    title: 'Curation Rewards',
    question: 'How do voting rewards work?',
    summary: 'Curators earn 20% of the total article reward pool for discovering and upvoting great content early.',
    details: [
      '20% Curator Share: Distributed proportionally to all eligible upvoters by stake and mana weight.',
      'Early Curation Incentive: Discovering high-quality articles before others yields higher returns.',
      'Downvotes: Consumes voter mana to defend the platform against spam and abuse without generating rewards.',
    ],
    badge: '20% Curator Split',
  },
  {
    id: 'maturation',
    icon: <Clock className="h-4 w-4 text-purple-400" />,
    title: 'Seven-Day Window',
    question: 'What happens after seven days?',
    summary: 'Articles mature 168 hours after publication, freezing votes and unlocking cryptographic settlement.',
    details: [
      'Vote Snapshot: Voting influence is frozen exactly at day 7 to prevent retrospective vote farming.',
      'Merkle Settlement: Epoch roots are published to Polygon Amoy with mathematical proof generation.',
      'Sovereign Reserve: Unallocated tokens (minimum 10%) stay in the protocol reserve pool.',
    ],
    badge: '7-Day Clock',
  },
  {
    id: 'delegation',
    icon: <ArrowRightLeft className="h-4 w-4 text-indigo-400" />,
    title: 'Power Delegation',
    question: 'What is delegation?',
    summary: 'Lend your voting influence to active curators or communities without transferring token custody.',
    details: [
      'Zero Token Transfer: Staked PNR never leaves your secure escrow contract.',
      'Anti-Chaining: Delegated influence cannot be re-delegated, prohibiting daisy-chain exploits.',
      'Instant Revocation: Delegators can increase, decrease, or revoke delegations at any time.',
    ],
    badge: 'Non-Custodial',
  },
  {
    id: 'power_down',
    icon: <TrendingDown className="h-4 w-4 text-rose-400" />,
    title: '13-Week Power Down',
    question: 'How does Power Down work?',
    summary: 'Unstake PENORA Power back to liquid PNR safely over 13 equal weekly installments.',
    details: [
      '13 Weekly Tranches: 1/13th of your unstaked PP becomes claimable every 7 days.',
      'Remainder Preservation: Integer remainders are resolved to the last wei on week 13.',
      'Cancel Anytime: Cancel an active power down at any moment to restore active voting power.',
    ],
    badge: '13 Weeks Vested',
  },
  {
    id: 'p2p',
    icon: <Coins className="h-4 w-4 text-teal-400" />,
    title: 'P2P Escrow Exchange',
    question: 'How does P2P trading work?',
    summary: 'Trade liquid PNR directly with other creators for test MockUSDT through audited on-chain escrow.',
    details: [
      'Direct Peer-to-Peer: No centralized exchange custody; funds are locked in audited smart contracts.',
      'Partial Fills: Buyers can fill partial amounts of sell offers with exact integer rounding.',
      'Safety Guarantees: Sellers can cancel unfilled offers and recover remaining tokens anytime.',
    ],
    badge: 'Audited Escrow',
  },
];

export function CreatorEconomyGuide() {
  const [expandedId, setExpandedId] = useState<string | null>('pnr');

  const toggleItem = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <section className="bg-[var(--wallet-surface)] backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-[#007C8B]/15 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#007C8B]/10">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-gradient-to-br from-[#007C8B] to-[#00E5F4] text-white">
            <HelpCircle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif text-lg font-bold text-[var(--wallet-text)]">
              Creator Economy Guide
            </h2>
            <p className="text-xs text-[var(--wallet-muted)]">
              Understand how PENORA&apos;s Steemit-style rewards, staking, and P2P trading function.
            </p>
          </div>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#00E5F4]/10 text-[#007C8B] border border-[#00E5F4]/20">
          Polygon Amoy Testnet (80002)
        </span>
      </div>

      {/* Testnet Transparency Alert */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Testnet Notice & Non-Monetary Disclaimer</p>
          <p className="text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
            All PNR tokens, MockUSDT, and creator rewards operate exclusively on the Polygon Amoy Testnet (Chain ID 80002).
            They are developmental testing instruments and carry zero financial or monetary value. No real funds are at risk.
          </p>
        </div>
      </div>

      {/* Interactive Guide Accordion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {GUIDE_ITEMS.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <div
              key={item.id}
              className={`rounded-2xl border transition-all ${
                isExpanded
                  ? 'border-[#007C8B]/40 bg-[#007C8B]/5 shadow-xs'
                  : 'border-[#007C8B]/15 bg-[var(--wallet-surface)] hover:border-[#007C8B]/30'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                className="w-full text-left p-4 flex items-start justify-between gap-3 focus:outline-none"
              >
                <div className="flex items-start gap-3">
                  <span className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 shrink-0 mt-0.5">
                    {item.icon}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[var(--wallet-text)]">
                        {item.question}
                      </span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#007C8B]/10 text-[#007C8B] border border-[#007C8B]/20">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--wallet-muted)] mt-1 line-clamp-2">
                      {item.summary}
                    </p>
                  </div>
                </div>
                <span className="text-[var(--wallet-muted)] mt-1">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-[#007C8B]/10 space-y-2">
                  <ul className="space-y-1.5 text-xs text-[var(--wallet-muted)]">
                    {item.details.map((detail, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#007C8B] font-bold shrink-0">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

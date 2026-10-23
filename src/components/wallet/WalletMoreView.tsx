import React from 'react';
import {
  Send,
  QrCode,
  Download,
  ArrowRightLeft,
  Coins,
  Key,
  Info,
  ExternalLink,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { RewardWalletLink } from './RewardWalletLink';
import { CreatorEconomyGuide } from './CreatorEconomyGuide';
import type { WalletState } from '../../lib/wallet/types';
import type { WalletTab } from './MobileWalletOverview';

export interface WalletMoreViewProps {
  state: WalletState;
  onNavigate: (tab: WalletTab) => void;
}

export const WalletMoreView: React.FC<WalletMoreViewProps> = ({ state, onNavigate }) => {
  const tools: Array<{
    id: WalletTab;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'send',
      title: 'Send / Withdraw',
      description: 'Transfer PNR or MockUSDT to verified creators or any Amoy address',
      icon: Send,
    },
    {
      id: 'receive',
      title: 'Receive Assets',
      description: 'Display your universal Polygon Amoy QR code and address',
      icon: QrCode,
    },
    {
      id: 'deposit',
      title: 'Deposit & Monitor',
      description: 'Monitor incoming ERC-20 PNR and MockUSDT transfers in real time',
      icon: Download,
    },
    {
      id: 'trade_pnr',
      title: 'P2P Marketplace',
      description: 'Create or fill peer-to-peer PNR/USDT escrow offers',
      icon: Coins,
    },
    {
      id: 'delegation',
      title: 'Power Delegation',
      description: 'Loan curation influence to creators while retaining custody',
      icon: ArrowRightLeft,
    },
  ];

  return (
    <div className="wallet-more-view space-y-5">
      {/* 1. Quick Directory of All Wallet Tools */}
      <section
        aria-label="Wallet tools and actions"
        className="rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] p-5 sm:p-6 shadow-2xs space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[var(--wallet-text)]">
              Wallet Tools &amp; Actions
            </h2>
            <p className="text-xs text-[var(--wallet-muted)]">
              Direct access to transfers, deposits, P2P trading, and delegation
            </p>
          </div>
          <a
            href="/exchange/"
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#0A2540] text-[#00E5F4] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#103152] transition-colors"
          >
            <span>Open Exchange Desk</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tools.map(tool => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onNavigate(tool.id)}
                className="p-4 rounded-xl bg-[var(--wallet-inset)] hover:border-[#007C8B]/45 border border-[var(--wallet-border)] text-left flex items-start justify-between gap-3 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-[#007C8B]/12 text-[#007C8B] dark:text-[#00E5F4] flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--wallet-text)]">{tool.title}</div>
                    <p className="text-[11px] text-[var(--wallet-muted)] mt-0.5 leading-snug">
                      {tool.description}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--wallet-muted)] shrink-0 mt-1" />
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Verified Creator Reward Wallet Link */}
      <div className="wallet-reward-link">
        <RewardWalletLink address={state.isCorrectNetwork ? state.address : null} />
      </div>

      {/* 3. Polygon Amoy Testnet Setup & Funding Guide */}
      <section
        aria-label="Testnet setup and funding guide"
        className="rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] p-5 sm:p-6 shadow-2xs space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-[#007C8B] dark:text-[#00E5F4]" />
            <h3 className="text-sm font-bold text-[var(--wallet-text)]">
              Polygon Amoy Testnet Setup &amp; Funding Guide
            </h3>
          </div>
          <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 font-semibold">
            Chain ID 80002
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex flex-col justify-between space-y-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--wallet-text)]">1. Test POL (Gas Fee)</span>
                <span className="text-[10px] font-mono text-[#007C8B] dark:text-[#00E5F4] font-semibold">
                  {state.balancePol ? `${state.balancePol} POL` : '0 POL'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--wallet-muted)] leading-relaxed">
                Required for Polygon Amoy network transactions (transfers, staking, claims). Request free testnet POL from official faucets.
              </p>
            </div>
            <a
              href="https://faucet.polygon.technology/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline pt-1"
            >
              <span>Polygon Official Faucet</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex flex-col justify-between space-y-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--wallet-text)]">2. Test Tokens</span>
                <span className="text-[10px] font-mono text-[var(--wallet-muted)] font-semibold">
                  PNR &amp; MockUSDT
                </span>
              </div>
              <p className="text-[11px] text-[var(--wallet-muted)] leading-relaxed">
                Acquire test PNR or MockUSDT via the PENORA Exchange Desk or deploy/configure testnet contracts on Polygon Amoy.
              </p>
            </div>
            <a
              href="/deploy-testnet"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline pt-1"
            >
              <span>Testnet Contract Setup</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] flex flex-col justify-between space-y-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--wallet-text)]">3. Power Up &amp; Curation</span>
                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                  1 PNR = 1 PP
                </span>
              </div>
              <p className="text-[11px] text-[var(--wallet-muted)] leading-relaxed">
                Stake liquid PNR into PENORA Power Escrow to build voting influence and earn 20% curation rewards.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('power_system')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline pt-1 text-left"
            >
              <span>Open Power Section</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 4. Key Architecture Separation Card */}
      <section
        aria-label="Key architecture"
        className="rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] p-5 sm:p-6 shadow-2xs space-y-3.5"
      >
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-[#007C8B] dark:text-[#00E5F4]" />
          <h3 className="text-sm font-bold text-[var(--wallet-text)]">
            Key Architecture: PENORA Account Keys vs. Blockchain Wallet Keys
          </h3>
        </div>
        <p className="text-xs text-[var(--wallet-muted)] leading-relaxed">
          PENORA separates social publishing keys from non-custodial Web3 token custody:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-[var(--wallet-text)] flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#007C8B] dark:text-[#00E5F4]" />
                <span>PENORA Account Authorities</span>
              </span>
              <span className="text-[10px] font-mono text-[#007C8B] dark:text-[#00E5F4] bg-[#007C8B]/10 px-2 py-0.5 rounded-full">
                Multi-Authority
              </span>
            </div>
            <ul className="text-[11px] text-[var(--wallet-muted)] space-y-1 list-disc pl-4 leading-relaxed">
              <li><strong>Posting Key:</strong> Publish essays, edit drafts, and cast curation votes gaslessly.</li>
              <li><strong>Active Key:</strong> Authorize account actions without exposing Web3 wallet funds.</li>
              <li><strong>Master Owner Key:</strong> Cold storage authority for key rotation and recovery.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-[var(--wallet-inset)] border border-[var(--wallet-border)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-[var(--wallet-text)] flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-[#007C8B] dark:text-[#00E5F4]" />
                <span>Polygon Amoy EVM Wallet</span>
              </span>
              <span className="text-[10px] font-mono text-[var(--wallet-muted)] bg-[var(--wallet-surface)] px-2 py-0.5 rounded-full border border-[var(--wallet-border)]">
                Chain 80002
              </span>
            </div>
            <ul className="text-[11px] text-[var(--wallet-muted)] space-y-1 list-disc pl-4 leading-relaxed">
              <li><strong>Self-Custodial:</strong> Private keys remain exclusively inside your MetaMask wallet.</li>
              <li><strong>Token Custody:</strong> Signs PNR/USDT transfers, staking, and Merkle reward claims.</li>
              <li><strong>Zero Seed Access:</strong> PENORA never requests or stores your EVM seed phrase.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5. Creator Economy Educational Guide */}
      <CreatorEconomyGuide />
    </div>
  );
};

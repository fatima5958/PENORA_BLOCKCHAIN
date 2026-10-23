import React from 'react';
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight, MoreHorizontal } from 'lucide-react';
import type { WalletTab } from './MobileWalletOverview';

export interface WalletQuickActionsProps {
  onNavigate: (tab: WalletTab) => void;
}

const ACTIONS: Array<{
  id: WalletTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'send', label: 'Send', icon: ArrowUpRight },
  { id: 'receive', label: 'Receive', icon: ArrowDownLeft },
  { id: 'trade_pnr', label: 'Trade', icon: ArrowLeftRight },
  { id: 'details', label: 'More', icon: MoreHorizontal },
];

export const WalletQuickActions: React.FC<WalletQuickActionsProps> = ({ onNavigate }) => {
  return (
    <div
      className="wallet-quick-actions grid grid-cols-4 gap-2 sm:gap-3"
      aria-label="Quick wallet actions"
    >
      {ACTIONS.map(action => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => onNavigate(action.id)}
            className="min-h-[64px] sm:min-h-[56px] px-2 py-2.5 rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] hover:border-[#007C8B]/45 active:scale-[0.98] transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 text-[var(--wallet-text)] shadow-2xs"
          >
            <span className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-[#007C8B]/10 dark:bg-[#00E5F4]/12 text-[#007C8B] dark:text-[#00E5F4] flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold tracking-tight">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
};

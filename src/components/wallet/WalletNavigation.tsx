import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutGrid,
  Clock,
  Award,
  Zap,
  MoreHorizontal,
  ChevronDown,
  Send,
  QrCode,
  Download,
  ArrowRightLeft,
  Coins,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';
import type { WalletTab } from './MobileWalletOverview';

export interface WalletNavigationProps {
  activeTab: WalletTab;
  onNavigate: (tab: WalletTab) => void;
}

const PRIMARY_TABS: Array<{ id: WalletTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'history', label: 'Activity', icon: Clock },
  { id: 'earnings', label: 'Earnings', icon: Award },
  { id: 'power_system', label: 'Power', icon: Zap },
];

const MORE_ITEMS: Array<{
  id: WalletTab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'send', label: 'Send / Withdraw', description: 'Transfer PNR or USDT to creators or addresses', icon: Send },
  { id: 'receive', label: 'Receive', description: 'QR code & universal Polygon Amoy address', icon: QrCode },
  { id: 'deposit', label: 'Deposit', description: 'Deposit ERC-20 tokens with live monitoring', icon: Download },
  { id: 'trade_pnr', label: 'Trade PNR', description: 'P2P escrow marketplace & exchange desk', icon: Coins },
  { id: 'delegation', label: 'Delegation', description: 'Delegate PENORA Power without losing custody', icon: ArrowRightLeft },
  { id: 'details', label: 'Wallet Details & Guides', description: 'Creator verification, key setup & economy guide', icon: BookOpen },
];

const SUB_TAB_LABELS: Partial<Record<WalletTab, string>> = {
  send: 'Send / Withdraw',
  receive: 'Receive Assets',
  deposit: 'Deposit Tokens',
  trade_pnr: 'Trade PNR',
  delegation: 'Power Delegation',
  details: 'More & Guides',
};

export const WalletNavigation: React.FC<WalletNavigationProps> = ({ activeTab, onNavigate }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isMoreTabActive = MORE_ITEMS.some(item => item.id === activeTab);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelect = (tab: WalletTab) => {
    setMenuOpen(false);
    onNavigate(tab);
  };

  return (
    <div className="wallet-nav-wrapper space-y-2" ref={menuRef}>
      <nav
        aria-label="Wallet sections"
        className="wallet-primary-nav grid grid-cols-5 gap-1 p-1 rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] shadow-2xs"
      >
        {PRIMARY_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => handleSelect(tab.id)}
              className={`min-h-[44px] px-1.5 sm:px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                isActive
                  ? 'bg-[#0A2540] text-white dark:bg-[#007C8B] dark:text-white shadow-2xs'
                  : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:bg-[var(--wallet-inset)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 hidden xs:inline-block" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}

        {/* 5th Item: More */}
        <div className="relative flex">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            aria-current={isMoreTabActive ? 'page' : undefined}
            onClick={() => setMenuOpen(prev => !prev)}
            className={`w-full min-h-[44px] px-1.5 sm:px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
              isMoreTabActive || menuOpen
                ? 'bg-[#0A2540] text-white dark:bg-[#007C8B] dark:text-white shadow-2xs'
                : 'text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] hover:bg-[var(--wallet-inset)]'
            }`}
          >
            <MoreHorizontal className="h-3.5 w-3.5 shrink-0 hidden xs:inline-block" />
            <span className="truncate">More</span>
            <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Dropdown / Sheet for "More" Options */}
      {menuOpen && (
        <div
          id="wallet-more-options"
          role="menu"
          aria-label="Additional wallet sections"
          className="p-2 rounded-2xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] shadow-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 z-30 relative"
        >
          {MORE_ITEMS.map(item => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(item.id)}
                className={`min-h-[48px] p-2.5 rounded-xl text-left flex items-start gap-2.5 transition-colors ${
                  isSelected
                    ? 'bg-[#007C8B]/12 text-[#007C8B] dark:bg-[#00E5F4]/15 dark:text-[#00E5F4] border border-[#007C8B]/25'
                    : 'hover:bg-[var(--wallet-inset)] text-[var(--wallet-text)] border border-transparent'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--wallet-inset)] flex items-center justify-center text-[#007C8B] dark:text-[#00E5F4] shrink-0 mt-0.5">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{item.label}</div>
                  <div className="text-[11px] text-[var(--wallet-muted)] line-clamp-1">{item.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Active Sub-View Context Bar when inside a secondary route */}
      {isMoreTabActive && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--wallet-surface)] border border-[var(--wallet-border)] text-xs">
          <button
            type="button"
            onClick={() => handleSelect('overview')}
            className="inline-flex items-center gap-1.5 font-semibold text-[#007C8B] dark:text-[#00E5F4] hover:underline min-h-[32px]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Overview</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[var(--wallet-muted)]">Section:</span>
            <span className="font-semibold text-[var(--wallet-text)]">{SUB_TAB_LABELS[activeTab]}</span>
            {activeTab !== 'details' && (
              <button
                type="button"
                onClick={() => handleSelect('details')}
                className="ml-1 px-2 py-1 rounded-lg bg-[var(--wallet-inset)] text-[var(--wallet-muted)] hover:text-[var(--wallet-text)] text-[11px] font-medium"
              >
                All More Tools
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

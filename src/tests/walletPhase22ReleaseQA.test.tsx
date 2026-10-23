import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { MobileWalletNavigation } from '../components/wallet/MobileWalletOverview';
import { WalletNavigation } from '../components/wallet/WalletNavigation';
import { WalletQuickActions } from '../components/wallet/WalletQuickActions';
import { SendConfirmDialog, PowerTransactionDialog } from '../components/wallet/WalletTransactionDialog';
import { INITIAL_WALLET_STATE } from '../lib/wallet/walletService';
import type { WalletState } from '../lib/wallet/types';

describe('PENORA Phase 22 — Wallet Final UX, Performance & Release QA', () => {
  it('1. MobileWalletNavigation renders primary 5 tabs and does not show Back bar on overview', () => {
    const onNavigate = vi.fn();
    const html = renderToStaticMarkup(
      <MobileWalletNavigation activeTab="overview" onNavigate={onNavigate} />
    );

    expect(html).toContain('Overview');
    expect(html).toContain('Activity');
    expect(html).toContain('Earnings');
    expect(html).toContain('Power');
    expect(html).toContain('More');

    // On overview, the secondary subnav back bar is not rendered
    expect(html).not.toContain('Back to Overview');
  });

  it('2. MobileWalletNavigation displays Back to Overview and section title when navigating to any sub-route', () => {
    const onNavigate = vi.fn();
    const sendHtml = renderToStaticMarkup(
      <MobileWalletNavigation activeTab="send" onNavigate={onNavigate} />
    );

    expect(sendHtml).toContain('Back to Overview');
    expect(sendHtml).toContain('Send / Withdraw');

    // Test other sub-routes
    const p2pHtml = renderToStaticMarkup(
      <MobileWalletNavigation activeTab="trade_pnr" onNavigate={onNavigate} />
    );
    expect(p2pHtml).toContain('Back to Overview');
    expect(p2pHtml).toContain('Trade PNR (P2P Escrow)');

    const earnHtml = renderToStaticMarkup(
      <MobileWalletNavigation activeTab="earnings" onNavigate={onNavigate} />
    );
    expect(earnHtml).toContain('Back to Overview');
    expect(earnHtml).toContain('Creator Earnings &amp; Claims');
  });

  it('3. WalletQuickActions maps 4 action buttons to intended flows', () => {
    const onNavigate = vi.fn();
    const html = renderToStaticMarkup(<WalletQuickActions onNavigate={onNavigate} />);

    expect(html).toContain('Send');
    expect(html).toContain('Receive');
    expect(html).toContain('Trade');
    expect(html).toContain('More');
  });

  it('4. Desktop WalletNavigation renders primary nav and contextual back bar for secondary tabs', () => {
    const onNavigate = vi.fn();
    const overviewHtml = renderToStaticMarkup(
      <WalletNavigation activeTab="overview" onNavigate={onNavigate} />
    );
    expect(overviewHtml).not.toContain('Back to Overview');

    const delegationHtml = renderToStaticMarkup(
      <WalletNavigation activeTab="delegation" onNavigate={onNavigate} />
    );
    expect(delegationHtml).toContain('Back to Overview');
    expect(delegationHtml).toContain('Power Delegation');
  });

  it('5. SendConfirmDialog renders review state and modal attributes when open', () => {
    const onClose = vi.fn();
    const html = renderToStaticMarkup(
      <SendConfirmDialog
        open={true}
        onClose={onClose}
        asset="PNR"
        tokenDecimals={18}
        sendAmount="100"
        sendRecipient="0x38CdF24eC27530B8F933023de2416d3960BD7372"
        creatorRecipient={null}
        gasEstimate={null}
        sendLoading={false}
        sendError={null}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toContain('Confirm Transfer');
    expect(html).toContain('100 PNR');
    expect(html).toContain('0x38CdF24eC27530B8F933023de2416d3960BD7372');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it('6. PowerTransactionDialog renders mode-specific attributes and amounts', () => {
    const onClose = vi.fn();
    const mockState: WalletState = {
      ...INITIAL_WALLET_STATE,
      status: 'connected',
      address: '0x38CdF24eC27530B8F933023de2416d3960BD7372',
      isCorrectNetwork: true,
      balancePnr: '500',
    };

    const upHtml = renderToStaticMarkup(
      <PowerTransactionDialog
        mode="up"
        open={true}
        onClose={onClose}
        state={mockState}
        amount="50"
        onAmountChange={vi.fn()}
        actionLoading={false}
        actionError={null}
        actionSuccess={null}
        onConfirm={vi.fn()}
      />
    );

    expect(upHtml).toContain('Power Up PNR');
    expect(upHtml).toContain('500 PNR');
    expect(upHtml).toContain('Confirm Power Up');

    const downHtml = renderToStaticMarkup(
      <PowerTransactionDialog
        mode="down"
        open={true}
        onClose={onClose}
        state={{ ...mockState, balancePp: '300' }}
        amount="50"
        onAmountChange={vi.fn()}
        actionLoading={false}
        actionError={null}
        actionSuccess={null}
        onConfirm={vi.fn()}
      />
    );

    expect(downHtml).toContain('Power Down PP');
    expect(downHtml).toContain('13-week linear withdrawal schedule');
    expect(downHtml).toContain('Start 13-Week Power Down');
  });
});

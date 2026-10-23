import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { WalletHeader } from '../components/wallet/WalletHeader';
import { MobileWalletOverview, MobileWalletNavigation } from '../components/wallet/MobileWalletOverview';
import { WalletBalanceCard } from '../components/wallet/WalletBalanceCard';
import { WalletQuickActions } from '../components/wallet/WalletQuickActions';
import { WalletSendFlow } from '../components/wallet/WalletSendFlow';
import { WalletReceiveView } from '../components/wallet/WalletReceiveView';
import { WalletPowerView } from '../components/wallet/WalletPowerView';
import { PowerDelegationCard } from '../components/wallet/PowerDelegationCard';
import { CreatorEarningsCard } from '../components/wallet/CreatorEarningsCard';
import { WalletActivityView } from '../components/wallet/WalletActivityView';
import { WalletMoreView } from '../components/wallet/WalletMoreView';
import { WalletConnectionPanel } from '../components/wallet/WalletConnectionPanel';
import { SendConfirmDialog, PowerTransactionDialog } from '../components/wallet/WalletTransactionDialog';
import { INITIAL_WALLET_STATE } from '../lib/wallet/walletService';
import type { WalletState } from '../lib/wallet/types';

describe('PENORA — Exhaustive Wallet Button & Action Audit', () => {
  const connectedState: WalletState = {
    ...INITIAL_WALLET_STATE,
    status: 'connected',
    address: '0x38CdF24eC27530B8F933023de2416d3960BD7372',
    chainId: 80002,
    isCorrectNetwork: true,
    contractsDeployed: true,
    balancePnr: '500.00',
    balanceUsdt: '100.00',
    balancePp: '250.00',
    balancePol: '1.45',
    votingManaPercent: 95.5,
    usdtDecimals: 6,
    isUsdtConfigured: true,
  };

  const wrongNetworkState: WalletState = {
    ...connectedState,
    status: 'wrong_network',
    chainId: 1,
    isCorrectNetwork: false,
  };

  describe('1. WalletHeader (Desktop & Mobile Header Actions)', () => {
    it('renders connect button when disconnected, and handles onConnect', () => {
      const onConnect = vi.fn();
      const html = renderToStaticMarkup(
        <WalletHeader
          state={INITIAL_WALLET_STATE}
          theme="dark"
          onToggleTheme={vi.fn()}
          onConnect={onConnect}
          onSwitchNetwork={vi.fn()}
          onCopyAddress={vi.fn()}
          copied={false}
        />
      );
      expect(html).toContain('Connect Wallet');
    });

    it('renders address, copy button, and network badge when connected', () => {
      const onCopyAddress = vi.fn();
      const html = renderToStaticMarkup(
        <WalletHeader
          state={connectedState}
          theme="dark"
          onToggleTheme={vi.fn()}
          onConnect={vi.fn()}
          onSwitchNetwork={vi.fn()}
          onCopyAddress={onCopyAddress}
          copied={false}
        />
      );
      expect(html).toContain('0x38Cd…7372');
      expect(html).toContain('Amoy');
      expect(html).toContain('aria-label="Copy connected wallet address"');
    });

    it('renders switch network button when connected to wrong network', () => {
      const onSwitchNetwork = vi.fn();
      const html = renderToStaticMarkup(
        <WalletHeader
          state={wrongNetworkState}
          theme="light"
          onToggleTheme={vi.fn()}
          onConnect={vi.fn()}
          onSwitchNetwork={onSwitchNetwork}
          onCopyAddress={vi.fn()}
          copied={false}
        />
      );
      expect(html).toContain('Switch to Amoy');
    });
  });

  describe('2. MobileWalletOverview (Mobile Quick Actions & Navigation)', () => {
    it('renders 4 quick action buttons and enables power actions when connected', () => {
      const onNavigate = vi.fn();
      const onPowerUp = vi.fn();
      const onPowerDown = vi.fn();
      const onRefresh = vi.fn();
      const onCopy = vi.fn();

      const html = renderToStaticMarkup(
        <MobileWalletOverview
          state={connectedState}
          onNavigate={onNavigate}
          onConnect={vi.fn()}
          onSwitchNetwork={vi.fn()}
          onCopyAddress={onCopy}
          onRefresh={onRefresh}
          copied={false}
          onPowerUp={onPowerUp}
          onPowerDown={onPowerDown}
          transactions={[]}
          historyLoading={false}
          historyError={null}
        />
      );

      expect(html).toContain('Send');
      expect(html).toContain('Receive');
      expect(html).toContain('Trade');
      expect(html).toContain('More');
      expect(html).toContain('Power Up');
      expect(html).toContain('Power Down');
      expect(html).toContain('View all');
      expect(html).toContain('Deposit, delegation, wallet verification &amp; guides');
    });

    it('disables power actions and shows network switch when on wrong network', () => {
      const html = renderToStaticMarkup(
        <MobileWalletOverview
          state={wrongNetworkState}
          onNavigate={vi.fn()}
          onConnect={vi.fn()}
          onSwitchNetwork={vi.fn()}
          onCopyAddress={vi.fn()}
          onRefresh={vi.fn()}
          copied={false}
          onPowerUp={vi.fn()}
          onPowerDown={vi.fn()}
          transactions={[]}
          historyLoading={false}
          historyError={null}
        />
      );

      expect(html).toContain('Switch to Polygon Amoy');
      expect(html).toMatch(/disabled=""[^>]*>Power Up/);
      expect(html).toMatch(/disabled=""[^>]*>Power Down/);
    });

    it('renders MobileWalletNavigation with 4 primary tabs plus more menu trigger', () => {
      const onNavigate = vi.fn();
      const html = renderToStaticMarkup(
        <MobileWalletNavigation activeTab="overview" onNavigate={onNavigate} />
      );

      expect(html).toContain('Overview');
      expect(html).toContain('Activity');
      expect(html).toContain('Earnings');
      expect(html).toContain('Power');
      expect(html).toContain('More');
    });

    it('renders subnav back bar when active tab is a subroute', () => {
      const onNavigate = vi.fn();
      const html = renderToStaticMarkup(
        <MobileWalletNavigation activeTab="send" onNavigate={onNavigate} />
      );

      expect(html).toContain('Back to Overview');
      expect(html).toContain('Send / Withdraw');
    });
  });

  describe('3. WalletBalanceCard (Desktop Balance & Quick Controls)', () => {
    it('renders all action buttons: Copy, Refresh, Power Up', () => {
      const onCopy = vi.fn();
      const onRefresh = vi.fn();
      const onPowerUp = vi.fn();

      const html = renderToStaticMarkup(
        <WalletBalanceCard
          state={connectedState}
          copied={false}
          onConnect={vi.fn()}
          onSwitchNetwork={vi.fn()}
          onCopyAddress={onCopy}
          onRefresh={onRefresh}
          onPowerUp={onPowerUp}
        />
      );

      expect(html).toContain('Power Up');
      expect(html).toContain('aria-label="Refresh wallet balances"');
      expect(html).toContain('aria-label="Copy wallet address"');
      expect(html).toContain('500.00');
    });

    it('renders connect CTA when disconnected', () => {
      const onConnect = vi.fn();
      const html = renderToStaticMarkup(
        <WalletBalanceCard
          state={INITIAL_WALLET_STATE}
          copied={false}
          onConnect={onConnect}
          onSwitchNetwork={vi.fn()}
          onCopyAddress={vi.fn()}
          onRefresh={vi.fn()}
          onPowerUp={vi.fn()}
        />
      );

      expect(html).toContain('Connect wallet');
    });
  });

  describe('4. WalletQuickActions (Desktop Action Row)', () => {
    it('renders 4 quick action buttons', () => {
      const onNavigate = vi.fn();
      const html = renderToStaticMarkup(<WalletQuickActions onNavigate={onNavigate} />);

      expect(html).toContain('Send');
      expect(html).toContain('Receive');
      expect(html).toContain('Trade');
      expect(html).toContain('More');
    });
  });

  describe('5. WalletSendFlow (Transfer Validation & Submission)', () => {
    it('renders asset toggles, recipient field, max button, and review button', () => {
      const onAssetChange = vi.fn();
      const onRecipientChange = vi.fn();
      const onReviewTransfer = vi.fn();

      const html = renderToStaticMarkup(
        <WalletSendFlow
          state={connectedState}
          asset="PNR"
          onAssetChange={onAssetChange}
          tokenBalance="500.00"
          tokenDecimals={18}
          tokenConfigured={true}
          sendRecipient=""
          onRecipientChange={onRecipientChange}
          onCreatorSelect={vi.fn()}
          recipientPickerVersion={0}
          sendAmount="25"
          onAmountChange={vi.fn()}
          onMaxAmount={vi.fn()}
          gasEstimate={null}
          estimatingGas={false}
          gasError={null}
          sendLoading={false}
          reviewingTransfer={false}
          sendError={null}
          sendSuccessReceipt={null}
          onReviewTransfer={onReviewTransfer}
          onSwitchNetwork={vi.fn()}
        />
      );

      expect(html).toContain('PNR · Penora Token');
      expect(html).toContain('USDT · MockUSDT');
      expect(html).toContain('Max');
      expect(html).toContain('Review Transfer');
    });

    it('disables submit and shows network switch when on wrong network', () => {
      const onSwitchNetwork = vi.fn();
      const html = renderToStaticMarkup(
        <WalletSendFlow
          state={wrongNetworkState}
          asset="PNR"
          onAssetChange={vi.fn()}
          tokenBalance="500.00"
          tokenDecimals={18}
          tokenConfigured={true}
          sendRecipient="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
          onRecipientChange={vi.fn()}
          onCreatorSelect={vi.fn()}
          recipientPickerVersion={0}
          sendAmount="25"
          onAmountChange={vi.fn()}
          onMaxAmount={vi.fn()}
          gasEstimate={null}
          estimatingGas={false}
          gasError={null}
          sendLoading={false}
          reviewingTransfer={false}
          sendError={null}
          sendSuccessReceipt={null}
          onReviewTransfer={vi.fn()}
          onSwitchNetwork={onSwitchNetwork}
        />
      );

      expect(html).toContain('Switch to Polygon Amoy (80002)');
      expect(html).toContain('Wrong Network Detected');
    });
  });

  describe('6. WalletReceiveView (Receive QR & Deposit Refresh)', () => {
    it('renders asset tabs, copy button in receive mode, and check now in deposit mode', () => {
      const onCopy = vi.fn();
      const onRefresh = vi.fn();

      const receiveHtml = renderToStaticMarkup(
        <WalletReceiveView
          mode="receive"
          state={connectedState}
          asset="PNR"
          onAssetChange={vi.fn()}
          tokenConfigured={true}
          qrCodeDataUrl="data:image/svg+xml;utf8,<svg></svg>"
          copied={false}
          onCopyAddress={onCopy}
          onConnect={vi.fn()}
          onSwitchNetwork={vi.fn()}
          onRefresh={onRefresh}
        />
      );

      expect(receiveHtml).toContain('Receive Assets');
      expect(receiveHtml).toContain('Copy Address');
      expect(receiveHtml).toContain('0x38CdF24eC27530B8F933023de2416d3960BD7372');

      const depositHtml = renderToStaticMarkup(
        <WalletReceiveView
          mode="deposit"
          state={connectedState}
          asset="USDT"
          onAssetChange={vi.fn()}
          tokenConfigured={true}
          qrCodeDataUrl="data:image/svg+xml;utf8,<svg></svg>"
          copied={false}
          onCopyAddress={onCopy}
          onConnect={vi.fn()}
          onSwitchNetwork={vi.fn()}
          onRefresh={onRefresh}
        />
      );

      expect(depositHtml).toContain('Deposit USDT');
      expect(depositHtml).toContain('Check Now');
    });
  });

  describe('7. WalletPowerView (Staking, Installments & Cancellation)', () => {
    it('renders Power Up and Power Down action buttons', () => {
      const onPowerUp = vi.fn();
      const onPowerDown = vi.fn();
      const onClaim = vi.fn();
      const onCancel = vi.fn();

      const html = renderToStaticMarkup(
        <WalletPowerView
          state={connectedState}
          actionLoading={false}
          onPowerUp={onPowerUp}
          onPowerDown={onPowerDown}
          onClaimInstallments={onClaim}
          onCancelPowerDown={onCancel}
          onRefreshWallet={vi.fn()}
        />
      );

      expect(html).toContain('Power Up');
      expect(html).toContain('Power Down');
      expect(html).toContain('250.00 PP');
      expect(html).toContain('95.5%');
    });
  });

  describe('8. PowerDelegationCard (Delegation Management)', () => {
    it('renders delegation header and Delegate Power trigger button', () => {
      const html = renderToStaticMarkup(
        <PowerDelegationCard
          userAddress={connectedState.address}
          onRefreshWallet={vi.fn()}
        />
      );

      expect(html).toContain('Power Delegation');
      expect(html).toContain('Delegate Power');
    });
  });

  describe('9. CreatorEarningsCard (Reward Tabs & Claim Actions)', () => {
    it('renders all 7 tabs and reward claim structure', () => {
      const html = renderToStaticMarkup(
        <CreatorEarningsCard
          address={connectedState.address}
          isCorrectNetwork={true}
          balancePp={connectedState.balancePp}
          votingManaPercent={connectedState.votingManaPercent}
        />
      );

      expect(html).toContain('Creator Earnings &amp; Rewards');
      expect(html).toContain('Overview');
      expect(html).toContain('Article Rewards');
      expect(html).toContain('Reward History');
      expect(html).toContain('Curation');
      expect(html).toContain('Beneficiaries');
      expect(html).toContain('Comments');
      expect(html).toContain('Economics');
    });
  });

  describe('10. WalletActivityView (History Filtering & Refresh)', () => {
    it('renders filter status pills and refresh action', () => {
      const onRefresh = vi.fn();
      const html = renderToStaticMarkup(
        <WalletActivityView
          address={connectedState.address}
          transactions={[]}
          loading={false}
          error={null}
          onRefresh={onRefresh}
        />
      );

      expect(html).toContain('>all<');
      expect(html).toContain('>confirmed<');
      expect(html).toContain('>pending<');
      expect(html).toContain('>failed<');
      expect(html).toContain('Refresh');
    });
  });

  describe('11. WalletMoreView (Tools, Verification & Quick Navigation)', () => {
    it('renders all 5 tool navigation buttons and external explorer/faucet links', () => {
      const onNavigate = vi.fn();
      const html = renderToStaticMarkup(
        <WalletMoreView state={connectedState} onNavigate={onNavigate} />
      );

      expect(html).toContain('Send / Withdraw');
      expect(html).toContain('Receive Assets');
      expect(html).toContain('Deposit &amp; Monitor');
      expect(html).toContain('P2P Marketplace');
      expect(html).toContain('Power Delegation');
      expect(html).toContain('Open Exchange Desk');
      expect(html).toContain('Polygon Official Faucet');
      expect(html).toContain('Open Power Section');
    });
  });

  describe('12. WalletConnectionPanel (Side Column & Manage Shortcuts)', () => {
    it('renders Disconnect, Copy, Manage Power, and Exchange Desk actions', () => {
      const onDisconnect = vi.fn();
      const onNavigate = vi.fn();
      const onPowerUp = vi.fn();
      const onPowerDown = vi.fn();

      const html = renderToStaticMarkup(
        <WalletConnectionPanel
          state={connectedState}
          onConnect={vi.fn()}
          onDisconnect={onDisconnect}
          onSwitchNetwork={vi.fn()}
          onCopyAddress={vi.fn()}
          onPowerUp={onPowerUp}
          onPowerDown={onPowerDown}
          onNavigate={onNavigate}
          copied={false}
        />
      );

      expect(html).toContain('Disconnect');
      expect(html).toContain('Manage');
      expect(html).toContain('Power Up');
      expect(html).toContain('Power Down');
      expect(html).toContain('Creator Rewards &amp; Claims');
      expect(html).toContain('PENORA Exchange Desk');
      expect(html).toContain('Get Test POL Faucet');
    });
  });

  describe('13. Transaction Dialogs (Confirm, Sign, Cancel, Close)', () => {
    it('SendConfirmDialog renders Confirm & Sign and Close buttons', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      const html = renderToStaticMarkup(
        <SendConfirmDialog
          open={true}
          onClose={onClose}
          asset="PNR"
          tokenDecimals={18}
          sendAmount="50"
          sendRecipient="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
          gasEstimate={null}
          sendLoading={false}
          sendError={null}
          creatorRecipient={null}
          onConfirm={onConfirm}
        />
      );

      expect(html).toContain('Confirm &amp; Sign in MetaMask');
      expect(html).toContain('aria-label="Close transfer review"');
      expect(html).toContain('50 PNR');
    });

    it('PowerTransactionDialog renders Confirm Power Up and Close buttons', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      const html = renderToStaticMarkup(
        <PowerTransactionDialog
          mode="up"
          open={true}
          onClose={onClose}
          state={connectedState}
          amount="100"
          onAmountChange={vi.fn()}
          actionLoading={false}
          actionError={null}
          actionSuccess={null}
          onConfirm={onConfirm}
        />
      );

      expect(html).toContain('Confirm Power Up');
      expect(html).toContain('aria-label="Close Power Up"');
      expect(html).toContain('Max: 500.00 PNR');
    });
  });
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WalletHeader } from '../components/wallet/WalletHeader';
import { WalletNavigation } from '../components/wallet/WalletNavigation';
import { WalletBalanceCard } from '../components/wallet/WalletBalanceCard';
import { WalletQuickActions } from '../components/wallet/WalletQuickActions';
import { WalletAssetList } from '../components/wallet/WalletAssetList';
import { WalletActivityPreview } from '../components/wallet/WalletActivityPreview';
import { WalletConnectionPanel } from '../components/wallet/WalletConnectionPanel';
import { WalletActivityView } from '../components/wallet/WalletActivityView';
import { WalletSendFlow } from '../components/wallet/WalletSendFlow';
import { WalletReceiveView } from '../components/wallet/WalletReceiveView';
import { WalletPowerView } from '../components/wallet/WalletPowerView';
import { WalletMoreView } from '../components/wallet/WalletMoreView';
import {
  SendConfirmDialog,
  PowerTransactionDialog,
} from '../components/wallet/WalletTransactionDialog';
import { MobileWalletOverview, MobileWalletNavigation } from '../components/wallet/MobileWalletOverview';
import { INITIAL_WALLET_STATE } from '../lib/wallet/walletService';
import type { WalletState, WalletTransaction } from '../lib/wallet/types';

const connectedState: WalletState = {
  ...INITIAL_WALLET_STATE,
  status: 'connected',
  address: '0x38CdF24eC27530B8F933023de2416d3960BD7372',
  chainId: 80002,
  isCorrectNetwork: true,
  contractsDeployed: true,
  isUsdtConfigured: true,
  usdtDecimals: 6,
  balancePnr: '10000.0',
  balancePp: '500.0',
  balanceUsdt: '1000.0',
  balancePol: '0.0298',
  votingManaPercent: 98.4,
  powerDownSchedule: {
    active: true,
    totalAmount: '130',
    weeklyInstallment: '10',
    weeksClaimed: 2,
    totalWeeks: 13,
    startTime: 1759000000,
    claimableWeeks: 1,
    claimableAmount: '10',
    nextUnlockTimestamp: 1760000000,
  },
};

const sampleTransactions: WalletTransaction[] = [
  {
    id: 'tx-1',
    hash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    type: 'transfer_out',
    amount: '25.5',
    symbol: 'PNR',
    status: 'confirmed',
    timestamp: '2026-10-23T10:00:00.000Z',
    explorerUrl: 'https://amoy.polygonscan.com/tx/0x1111',
  },
  {
    id: 'tx-2',
    hash: '0x2222222222222222222222222222222222222222222222222222222222222222',
    type: 'deposit_usdt',
    amount: '100',
    symbol: 'USDT',
    status: 'pending',
    timestamp: '2026-10-23T11:00:00.000Z',
  },
  {
    id: 'tx-3',
    hash: '0x3333333333333333333333333333333333333333333333333333333333333333',
    type: 'power_up',
    amount: '50',
    symbol: 'PNR',
    status: 'failed',
    timestamp: '2026-10-23T12:00:00.000Z',
  },
  {
    id: 'tx-4',
    hash: '0x4444444444444444444444444444444444444444444444444444444444444444',
    type: 'transfer_in',
    amount: '10',
    symbol: 'PNR',
    status: 'confirmed',
    timestamp: '2026-10-23T09:00:00.000Z',
  },
];

describe('PENORA Phase 20 — Wallet UX Redesign & Feature Preservation Suite', () => {
  it('1. renders compact WalletHeader with Amoy indicator, connected address, and theme toggle', () => {
    const html = renderToStaticMarkup(
      <WalletHeader
        state={connectedState}
        theme="light"
        onToggleTheme={vi.fn()}
        onConnect={vi.fn()}
        onSwitchNetwork={vi.fn()}
        onCopyAddress={vi.fn()}
        copied={false}
      />
    );
    expect(html).toContain('PENORA Wallet');
    expect(html).toContain('Polygon Amoy');
    expect(html).toContain('80002');
    expect(html).toContain('0x38Cd…7372');
    expect(html).toContain('Switch to dark wallet mode');
  });

  it('2. renders 5-item primary navigation (Overview, Activity, Earnings, Power, More) on desktop and mobile', () => {
    const desktopHtml = renderToStaticMarkup(
      <WalletNavigation activeTab="overview" onNavigate={vi.fn()} />
    );
    for (const label of ['Overview', 'Activity', 'Earnings', 'Power', 'More']) {
      expect(desktopHtml).toContain(label);
    }

    const mobileHtml = renderToStaticMarkup(
      <MobileWalletNavigation activeTab="overview" onNavigate={vi.fn()} />
    );
    for (const label of ['Overview', 'Activity', 'Earnings', 'Power', 'More']) {
      expect(mobileHtml).toContain(label);
    }
  });

  it('3. shows Back to Overview context bar when viewing a secondary section (Send, Receive, Deposit, Delegation, Trade)', () => {
    const html = renderToStaticMarkup(
      <WalletNavigation activeTab="send" onNavigate={vi.fn()} />
    );
    expect(html).toContain('Back to Overview');
    expect(html).toContain('Send / Withdraw');
  });

  it('4. renders WalletBalanceCard with Available PNR, TESTNET · AMOY badge, and no fake USD price', () => {
    const html = renderToStaticMarkup(
      <WalletBalanceCard
        state={connectedState}
        copied={false}
        onConnect={vi.fn()}
        onSwitchNetwork={vi.fn()}
        onCopyAddress={vi.fn()}
        onRefresh={vi.fn()}
        onPowerUp={vi.fn()}
      />
    );
    expect(html).toContain('Available PNR');
    expect(html).toContain('10000.0');
    expect(html).toContain('Testnet · Amoy');
    expect(html).not.toContain('Est. Value');
  });

  it('5. renders four Quick Actions: Send, Receive, Trade, More', () => {
    const html = renderToStaticMarkup(<WalletQuickActions onNavigate={vi.fn()} />);
    for (const action of ['Send', 'Receive', 'Trade', 'More']) {
      expect(html).toContain(action);
    }
  });

  it('6. renders all 4 assets in WalletAssetList (Liquid PNR, PENORA Power, MockUSDT, Test POL Gas)', () => {
    const html = renderToStaticMarkup(<WalletAssetList state={connectedState} />);
    expect(html).toContain('Liquid PNR');
    expect(html).toContain('10000.0');
    expect(html).toContain('PENORA Power');
    expect(html).toContain('500.0');
    expect(html).toContain('MockUSDT');
    expect(html).toContain('1000.0');
    expect(html).toContain('Test POL Gas');
    expect(html).toContain('0.0298');
  });

  it('7. displays up to 3 recent transactions in WalletActivityPreview and distinguishes Confirmed, Pending, Failed', () => {
    const html = renderToStaticMarkup(
      <WalletActivityPreview
        transactions={sampleTransactions}
        loading={false}
        error={null}
        hasAddress={true}
        onViewAll={vi.fn()}
      />
    );
    expect(html).toContain('Recent Activity');
    expect(html).toContain('View all');
    expect(html).toContain('Confirmed');
    expect(html).toContain('Pending');
    expect(html).toContain('Failed');
    // 4th transaction should not be rendered in 3-item preview
    expect(html).toContain('25.5 PNR');
    expect(html).toContain('100 USDT');
    expect(html).toContain('50 PNR');
    expect(html).not.toContain('+10 PNR');
  });

  it('8. renders MobileWalletOverview with 4 quick actions, 4 assets, and recent activity preview', () => {
    const html = renderToStaticMarkup(
      <MobileWalletOverview
        state={connectedState}
        onNavigate={vi.fn()}
        onConnect={vi.fn()}
        onSwitchNetwork={vi.fn()}
        onCopyAddress={vi.fn()}
        onRefresh={vi.fn()}
        copied={false}
        onPowerUp={vi.fn()}
        onPowerDown={vi.fn()}
        transactions={sampleTransactions}
      />
    );
    for (const label of ['Send', 'Receive', 'Trade', 'More']) {
      expect(html).toContain(label);
    }
    for (const assetName of ['Liquid PNR', 'PENORA Power', 'MockUSDT', 'Test POL Gas']) {
      expect(html).toContain(assetName);
    }
    expect(html).toContain('Recent activity');
    expect(html).toContain('View all');
  });

  it('9. renders WalletConnectionPanel with connection status, gas balance, Voting Mana, and Earnings shortcut', () => {
    const html = renderToStaticMarkup(
      <WalletConnectionPanel
        state={connectedState}
        copied={false}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        onSwitchNetwork={vi.fn()}
        onCopyAddress={vi.fn()}
        onPowerUp={vi.fn()}
        onPowerDown={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    expect(html).toContain('Web3 Wallet Connection');
    expect(html).toContain('0.0298 POL');
    expect(html).toContain('98.4%');
    expect(html).toContain('Creator Rewards &amp; Claims');
    expect(html).toContain('PENORA Exchange Desk');
  });

  it('10. renders WalletPowerView with 13-week schedule, installment claim, and schedule cancellation', () => {
    const html = renderToStaticMarkup(
      <WalletPowerView
        state={connectedState}
        actionLoading={false}
        onPowerUp={vi.fn()}
        onPowerDown={vi.fn()}
        onClaimInstallments={vi.fn()}
        onCancelPowerDown={vi.fn()}
        onRefreshWallet={vi.fn()}
      />
    );
    expect(html).toContain('13-Week Power Down Schedule');
    expect(html).toContain('130 PNR');
    expect(html).toContain('2 / 13 Weeks');
    expect(html).toContain('Claim Matured Installments');
    expect(html).toContain('Cancel Remaining Schedule (Restore PP)');
  });

  it('11. renders WalletSendFlow with token selector, CreatorRecipientPicker, address input, gas estimate, and review button', () => {
    const html = renderToStaticMarkup(
      <WalletSendFlow
        state={connectedState}
        asset="PNR"
        onAssetChange={vi.fn()}
        tokenBalance="10000.0"
        tokenDecimals={18}
        tokenConfigured={true}
        sendRecipient="0x1234567890123456789012345678901234567890"
        onRecipientChange={vi.fn()}
        onCreatorSelect={vi.fn()}
        recipientPickerVersion={0}
        sendAmount="50"
        onAmountChange={vi.fn()}
        onMaxAmount={vi.fn()}
        gasEstimate={{
          gasLimit: 52000n,
          maxFeePerGas: 30000000000n,
          estimatedCostPol: '0.001560',
          estimatedCostGwei: '30',
        }}
        estimatingGas={false}
        gasError={null}
        sendLoading={false}
        reviewingTransfer={false}
        sendError={null}
        sendSuccessReceipt={null}
        onReviewTransfer={vi.fn()}
        onSwitchNetwork={vi.fn()}
      />
    );
    expect(html).toContain('Send PNR');
    expect(html).toContain('Send to a Penora creator');
    expect(html).toContain('~0.001560 POL');
    expect(html).toContain('Review Transfer');
  });

  it('12. renders WalletReceiveView in both receive and deposit modes with QR code and network notice', () => {
    const receiveHtml = renderToStaticMarkup(
      <WalletReceiveView
        mode="receive"
        state={connectedState}
        asset="PNR"
        onAssetChange={vi.fn()}
        tokenConfigured={true}
        qrCodeDataUrl="data:image/png;base64,iVBORw0KGgo="
        copied={false}
        onCopyAddress={vi.fn()}
        onConnect={vi.fn()}
        onSwitchNetwork={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    expect(receiveHtml).toContain('Receive Assets');
    expect(receiveHtml).toContain('Copy Address');

    const depositHtml = renderToStaticMarkup(
      <WalletReceiveView
        mode="deposit"
        state={connectedState}
        asset="USDT"
        onAssetChange={vi.fn()}
        tokenConfigured={true}
        qrCodeDataUrl="data:image/png;base64,iVBORw0KGgo="
        copied={false}
        onCopyAddress={vi.fn()}
        onConnect={vi.fn()}
        onSwitchNetwork={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    expect(depositHtml).toContain('Deposit USDT');
    expect(depositHtml).toContain('Monitoring incoming USDT transfers on Amoy');
  });

  it('13. renders SendConfirmDialog and PowerTransactionDialog with complete transaction review details', () => {
    const sendModalHtml = renderToStaticMarkup(
      <SendConfirmDialog
        open={true}
        onClose={vi.fn()}
        asset="PNR"
        tokenDecimals={18}
        sendAmount="125"
        sendRecipient="0x1234567890123456789012345678901234567890"
        creatorRecipient={{
          id: 'u1',
          username: 'alice',
          displayName: 'Alice Creator',
          address: '0x1234567890123456789012345678901234567890',
          chainId: 80002,
        }}
        gasEstimate={{
          gasLimit: 50000n,
          maxFeePerGas: 30000000000n,
          estimatedCostPol: '0.001500',
          estimatedCostGwei: '30',
        }}
        sendLoading={false}
        sendError={null}
        onConfirm={vi.fn()}
      />
    );
    expect(sendModalHtml).toContain('Confirm Transfer');
    expect(sendModalHtml).toContain('Alice Creator (@alice)');
    expect(sendModalHtml).toContain('125 PNR');
    expect(sendModalHtml).toContain('Confirm &amp; Sign in MetaMask');

    const powerDownModalHtml = renderToStaticMarkup(
      <PowerTransactionDialog
        mode="down"
        open={true}
        onClose={vi.fn()}
        state={connectedState}
        amount="130"
        onAmountChange={vi.fn()}
        actionLoading={false}
        actionError={null}
        actionSuccess={null}
        onConfirm={vi.fn()}
      />
    );
    expect(powerDownModalHtml).toContain('Power Down PP');
    expect(powerDownModalHtml).toContain('Estimated Weekly Installment:');
    expect(powerDownModalHtml).toContain('10 PNR');
    expect(powerDownModalHtml).toContain('Start 13-Week Power Down');
  });

  it('14. renders WalletMoreView with all tools, RewardWalletLink, faucet guide, key architecture, and economy guide', () => {
    const html = renderToStaticMarkup(
      <WalletMoreView state={connectedState} onNavigate={vi.fn()} />
    );
    expect(html).toContain('Wallet Tools &amp; Actions');
    expect(html).toContain('Your verified creator wallet');
    expect(html).toContain('Polygon Amoy Testnet Setup &amp; Funding Guide');
    expect(html).toContain('Key Architecture: PENORA Account Keys vs. Blockchain Wallet Keys');
    expect(html).toContain('Creator Economy Guide');
  });

  it('15. renders full WalletActivityView with status filter pills and explorer links', () => {
    const html = renderToStaticMarkup(
      <WalletActivityView
        address={connectedState.address}
        transactions={sampleTransactions}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />
    );
    expect(html).toContain('Transaction Activity');
    expect(html).toContain('+10 PNR');
    expect(html).toContain('https://amoy.polygonscan.com/tx/0x1111');
  });
});

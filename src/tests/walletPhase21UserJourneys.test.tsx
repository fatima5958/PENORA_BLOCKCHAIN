import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WalletOnboardingBanner } from '../components/wallet/WalletOnboardingBanner';
import { WalletBalanceCard } from '../components/wallet/WalletBalanceCard';
import { WalletAssetList } from '../components/wallet/WalletAssetList';
import { WalletConnectionPanel } from '../components/wallet/WalletConnectionPanel';
import { WalletActivityPreview } from '../components/wallet/WalletActivityPreview';
import { WalletPowerView } from '../components/wallet/WalletPowerView';
import { PowerDelegationCard } from '../components/wallet/PowerDelegationCard';
import { CreatorEarningsCard } from '../components/wallet/CreatorEarningsCard';
import { MobileWalletOverview } from '../components/wallet/MobileWalletOverview';
import {
  SendConfirmDialog,
  PowerTransactionDialog,
  TransactionLifecycleStatusBanner,
} from '../components/wallet/WalletTransactionDialog';
import {
  createTxLifecycleState,
  TX_LIFECYCLE_LABELS,
  type WalletTxLifecycleStatus,
} from '../lib/wallet/txLifecycle';
import { INITIAL_WALLET_STATE } from '../lib/wallet/walletService';
import type { WalletState } from '../lib/wallet/types';

const TEST_ADDRESS = '0x38CdF24eC27530B8F933023de2416d3960BD7372';

describe('PENORA Phase 21 — Wallet Onboarding & 5 User Journey Scenarios', () => {
  it('User A (New visitor without MetaMask): shows Install MetaMask link, keeps balances unknown (—), and never fabricates 0 balances', () => {
    const noWalletState: WalletState = {
      ...INITIAL_WALLET_STATE,
      status: 'error',
      error:
        'MetaMask not detected. Please install the MetaMask extension or use a Web3-compatible browser.',
    };

    const balanceHtml = renderToStaticMarkup(
      <WalletBalanceCard
        state={noWalletState}
        copied={false}
        isProviderInstalled={false}
        onConnect={vi.fn()}
        onSwitchNetwork={vi.fn()}
        onCopyAddress={vi.fn()}
        onRefresh={vi.fn()}
        onPowerUp={vi.fn()}
      />
    );
    expect(balanceHtml).toContain('Connect wallet');
    expect(balanceHtml).toContain('Install MetaMask');
    expect(balanceHtml).toContain('https://metamask.io/download/');
    expect(balanceHtml).toContain('—');

    const panelHtml = renderToStaticMarkup(
      <WalletConnectionPanel
        state={noWalletState}
        copied={false}
        isProviderInstalled={false}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        onSwitchNetwork={vi.fn()}
        onCopyAddress={vi.fn()}
        onPowerUp={vi.fn()}
        onPowerDown={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    expect(panelHtml).toContain('No browser wallet extension detected');
    expect(panelHtml).toContain('Install MetaMask Extension');
  });

  it('User B (New creator connecting wallet): displays dismissible onboarding guide with all 4 token definitions and 4-step journey', () => {
    const newlyConnectedState: WalletState = {
      ...INITIAL_WALLET_STATE,
      status: 'connected',
      address: TEST_ADDRESS,
      chainId: 80002,
      isCorrectNetwork: true,
      contractsDeployed: true,
      balancePnr: '50',
      balanceUsdt: '10',
      balancePol: '0.05',
      balancePp: '0',
    };

    const expandedHtml = renderToStaticMarkup(
      <WalletOnboardingBanner
        state={newlyConnectedState}
        dismissed={false}
        onDismiss={vi.fn()}
        onReopen={vi.fn()}
        onConnect={vi.fn()}
        onSwitchNetwork={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    // 4-step journey
    expect(expandedHtml).toContain('1. Connect Wallet');
    expect(expandedHtml).toContain('2. Get Test Tokens');
    expect(expandedHtml).toContain('3. Trade PNR');
    expect(expandedHtml).toContain('4. View &amp; Stake');

    // 4 token definitions
    expect(expandedHtml).toContain('PNR — Test Token');
    expect(expandedHtml).toContain('PENORA Power');
    expect(expandedHtml).toContain('MockUSDT');
    expect(expandedHtml).toContain('Test POL');
    expect(expandedHtml).toContain('Dismiss');

    // Dismissed state renders compact reopen button
    const collapsedHtml = renderToStaticMarkup(
      <WalletOnboardingBanner
        state={newlyConnectedState}
        dismissed={true}
        onDismiss={vi.fn()}
        onReopen={vi.fn()}
        onConnect={vi.fn()}
        onSwitchNetwork={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    expect(collapsedHtml).toContain('Wallet Guide &amp; Token Help');
    expect(collapsedHtml).not.toContain('PNR — Test Token');
  });

  it('User C (Creator with zero balances vs failed balance lookup): shows actionable empty states for 0 balances and Unavailable for failed lookups', () => {
    const zeroBalanceState: WalletState = {
      ...INITIAL_WALLET_STATE,
      status: 'connected',
      address: TEST_ADDRESS,
      chainId: 80002,
      isCorrectNetwork: true,
      contractsDeployed: true,
      balancePnr: '0',
      balancePp: '0',
      balanceUsdt: '0',
      balancePol: '0',
    };

    const zeroAssetsHtml = renderToStaticMarkup(
      <WalletAssetList state={zeroBalanceState} onNavigate={vi.fn()} />
    );
    expect(zeroAssetsHtml).toContain('Trade PNR');
    expect(zeroAssetsHtml).toContain('Power Up');
    expect(zeroAssetsHtml).toContain('P2P / Exchange');
    expect(zeroAssetsHtml).toContain('Get Test POL');

    const mobileZeroHtml = renderToStaticMarkup(
      <MobileWalletOverview
        state={zeroBalanceState}
        onNavigate={vi.fn()}
        onConnect={vi.fn()}
        onSwitchNetwork={vi.fn()}
        onCopyAddress={vi.fn()}
        onRefresh={vi.fn()}
        copied={false}
        onPowerUp={vi.fn()}
        onPowerDown={vi.fn()}
      />
    );
    expect(mobileZeroHtml).toContain('No PNR yet — tap Trade to buy PNR');
    expect(mobileZeroHtml).toContain('0 POL — required for Amoy gas fees');

    // Failed balance lookup while connected on Amoy must show "Unavailable", never "0"
    const unavailableState: WalletState = {
      ...INITIAL_WALLET_STATE,
      status: 'connected',
      address: TEST_ADDRESS,
      chainId: 80002,
      isCorrectNetwork: true,
      contractsDeployed: true,
      balancePnr: null,
      balancePp: null,
      balanceUsdt: null,
      balancePol: null,
    };

    const unavailBalanceHtml = renderToStaticMarkup(
      <WalletBalanceCard
        state={unavailableState}
        copied={false}
        onConnect={vi.fn()}
        onSwitchNetwork={vi.fn()}
        onCopyAddress={vi.fn()}
        onRefresh={vi.fn()}
        onPowerUp={vi.fn()}
      />
    );
    expect(unavailBalanceHtml).toContain('Unavailable');

    const unavailAssetsHtml = renderToStaticMarkup(
      <WalletAssetList state={unavailableState} />
    );
    expect(unavailAssetsHtml).toContain('Unavailable');
    expect(unavailAssetsHtml).toContain('Unavailable — could not verify on-chain');
  });

  it('User D (Creator sending PNR & transaction lifecycle): supports all 7 lifecycle states with hash and PolygonScan link', () => {
    const statuses: Exclude<WalletTxLifecycleStatus, 'idle'>[] = [
      'preparing',
      'awaiting_approval',
      'submitted',
      'confirming',
      'confirmed',
      'failed',
      'unknown',
    ];

    const sampleHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    for (const status of statuses) {
      const lifecycle = createTxLifecycleState(status, { hash: sampleHash });
      const bannerHtml = renderToStaticMarkup(
        <TransactionLifecycleStatusBanner lifecycle={lifecycle} />
      );
      expect(bannerHtml).toContain(TX_LIFECYCLE_LABELS[status]);
      expect(bannerHtml).toContain('PolygonScan');
      expect(bannerHtml).toContain(sampleHash.slice(0, 10));
    }

    const sendModalHtml = renderToStaticMarkup(
      <SendConfirmDialog
        open={true}
        onClose={vi.fn()}
        asset="PNR"
        tokenDecimals={18}
        sendAmount="25"
        sendRecipient="0x1234567890123456789012345678901234567890"
        creatorRecipient={{
          id: 'c1',
          username: 'fatima',
          displayName: 'Fatima Creator',
          address: '0x1234567890123456789012345678901234567890',
          chainId: 80002,
        }}
        gasEstimate={null}
        sendLoading={true}
        sendError={null}
        txLifecycle={createTxLifecycleState('confirming', { hash: sampleHash })}
        onConfirm={vi.fn()}
      />
    );
    expect(sendModalHtml).toContain('Fatima Creator (@fatima)');
    expect(sendModalHtml).toContain('Confirming');
    expect(sendModalHtml).toContain('PolygonScan');
  });

  it('User E (Creator managing Power, Earnings, and Activity): shows clear empty states and distinguishes database estimates from on-chain earnings', () => {
    const powerState: WalletState = {
      ...INITIAL_WALLET_STATE,
      status: 'connected',
      address: TEST_ADDRESS,
      chainId: 80002,
      isCorrectNetwork: true,
      contractsDeployed: true,
      balancePnr: '500',
      balancePp: '100',
      votingManaPercent: 100,
      powerDownSchedule: null,
    };

    const powerHtml = renderToStaticMarkup(
      <WalletPowerView
        state={powerState}
        actionLoading={false}
        onPowerUp={vi.fn()}
        onPowerDown={vi.fn()}
        onClaimInstallments={vi.fn()}
        onCancelPowerDown={vi.fn()}
        onRefreshWallet={vi.fn()}
      />
    );
    expect(powerHtml).toContain('No active Power Down schedule');
    expect(powerHtml).toContain('Start Power Down');

    const delegationHtml = renderToStaticMarkup(
      <PowerDelegationCard userAddress={TEST_ADDRESS} />
    );
    expect(delegationHtml).toContain('No active outgoing delegations');
    expect(delegationHtml).toContain('Delegate Power');

    const earningsHtml = renderToStaticMarkup(
      <CreatorEarningsCard address={TEST_ADDRESS} isCorrectNetwork={true} />
    );
    expect(earningsHtml).toContain('Pending Rewards');
    expect(earningsHtml).toContain('Claimable PNR');
    expect(earningsHtml).toContain('Claimed PNR');
    expect(earningsHtml).toContain('Reward History');
    expect(earningsHtml).toContain('Database Estimates vs. Confirmed Blockchain Earnings');
    expect(earningsHtml).toContain('Write an Article');

    const emptyActivityHtml = renderToStaticMarkup(
      <WalletActivityPreview
        transactions={[]}
        loading={false}
        error={null}
        hasAddress={true}
        onViewAll={vi.fn()}
        onStartSend={vi.fn()}
      />
    );
    expect(emptyActivityHtml).toContain('No recent transactions in the current query window.');
    expect(emptyActivityHtml).toContain('Send Tokens');
  });
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MobileWalletOverview } from '../components/wallet/MobileWalletOverview';
import { INITIAL_WALLET_STATE } from '../lib/wallet/walletService';

const callbacks = { onNavigate: vi.fn(), onConnect: vi.fn(), onSwitchNetwork: vi.fn(), onCopyAddress: vi.fn(), onRefresh: vi.fn(), copied: false, onPowerUp: vi.fn(), onPowerDown: vi.fn() };
describe('Mobile wallet balance and action states', () => {
  it('keeps unknown balances unknown and offers connection', () => {
    const html = renderToStaticMarkup(<MobileWalletOverview {...callbacks} state={INITIAL_WALLET_STATE} />);
    expect(html).toContain('Connect wallet');
    expect(html).toContain('<strong>—</strong>');
    expect(html).not.toContain('<strong>0</strong>');
    expect(html).toMatch(/disabled=""[^>]*>Power Up/);
  });
  it('renders actual token balances and enables configured power actions', () => {
    const html = renderToStaticMarkup(<MobileWalletOverview {...callbacks} state={{ ...INITIAL_WALLET_STATE, status: 'connected', address: '0x1234567890123456789012345678901234567890', isCorrectNetwork: true, contractsDeployed: true, balancePnr: '125.75', balanceUsdt: '42.5', balancePp: '12', balancePol: '0.0957' }} />);
    for (const value of ['125.75', '42.5', '12', '0.0957']) expect(html).toContain(`<strong>${value}</strong>`);
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('Copy wallet address');
  });
  it('offers network correction and blocks power actions on the wrong chain', () => {
    const html = renderToStaticMarkup(<MobileWalletOverview {...callbacks} state={{ ...INITIAL_WALLET_STATE, address: '0x1234567890123456789012345678901234567890', status: 'wrong_network', contractsDeployed: true }} />);
    expect(html).toContain('Switch to Polygon Amoy');
    expect(html).toMatch(/disabled=""[^>]*>Power Down/);
  });
});

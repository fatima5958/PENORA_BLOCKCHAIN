import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ getBalance: vi.fn(), fetchBalance: vi.fn() }));
vi.mock('viem', async importOriginal => ({ ...(await importOriginal<any>()), createPublicClient: () => ({ getBalance: mock.getBalance }) }));
vi.mock('../lib/wallet/usdtService', () => ({ penoraUsdtService: { fetchBalance: mock.fetchBalance }, penoraPnrService: { fetchBalance: mock.fetchBalance } }));
import { penoraWalletService as wallet } from '../lib/wallet/walletService';
const address = '0x4444444444444444444444444444444444444444';
beforeEach(() => {
  wallet.disconnect();
  mock.fetchBalance.mockResolvedValue({ balanceFormatted: '2', decimals: 6 });
  vi.stubGlobal('window', { ethereum: { request: async ({ method }: { method: string }) => method === 'eth_chainId' ? '0x13882' : [address] } });
});
afterEach(() => { wallet.disconnect(); vi.unstubAllGlobals(); });
it('does not reconnect after disconnect while a wallet approval is pending', async () => {
  let resolve!: (accounts: string[]) => void;
  vi.stubGlobal('window', { ethereum: { request: ({ method }: { method: string }) =>
    method === 'eth_requestAccounts' ? new Promise(r => { resolve = r; }) : Promise.resolve(method === 'eth_chainId' ? '0x13882' : []) } });
  const connecting = wallet.connect();
  wallet.disconnect();
  resolve([address]);
  await connecting;
  expect(wallet.getState().status).toBe('disconnected');
  expect(wallet.getState().address).toBeNull();
});
it('clears stale liquid PNR when refreshing balances fails', async () => {
  mock.getBalance.mockResolvedValueOnce(10n ** 18n);
  await wallet.connect();
  expect(wallet.getState().balancePnr).toBe('2');
  mock.getBalance.mockRejectedValueOnce(new Error('RPC unavailable'));
  await wallet.refreshBalance(address);
  expect(wallet.getState().balancePnr).toBeNull();
});
it('ignores an in-flight balance response after disconnect', async () => {
  let resolve!: (value: bigint) => void;
  mock.getBalance.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const connected = wallet.connect();
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
  wallet.disconnect();
  resolve(1000000000000000000n);
  await connected;
  const state = wallet.getState();
  expect(state.status).toBe('disconnected');
  expect(state.address).toBeNull();
  expect(state.balancePol).toBeNull();
  expect(state.balancePnr).toBeNull();
  expect(state.balanceUsdt).toBeNull();
  expect(state.isCorrectNetwork).toBe(false);
  expect(state.chainId).toBeNull();
});
it('ignores an account lookup response after disconnect', async () => {
  let resolve!: (value: string) => void;
  vi.stubGlobal('window', { ethereum: { request: async ({ method }: { method: string }) => method === 'eth_chainId' ? new Promise(r => { resolve = r; }) : [address] } });
  const connected = wallet.connect();
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
  wallet.disconnect();
  resolve('0x13882');
  await connected;
  expect(wallet.getState().address).toBeNull();
  expect(wallet.getState().status).toBe('disconnected');
});

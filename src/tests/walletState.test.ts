import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ getBalance: vi.fn(), fetchBalance: vi.fn() }));
vi.mock('viem', async importOriginal => ({ ...(await importOriginal<any>()), createPublicClient: () => ({ getBalance: mock.getBalance }) }));
vi.mock('../lib/wallet/usdtService', () => ({ penoraUsdtService: { fetchBalance: mock.fetchBalance }, penoraPnrService: { fetchBalance: mock.fetchBalance, getContractAddress: () => address } }));
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
it('keeps independently verified tokens when only the native balance RPC fails', async () => {
  mock.getBalance.mockResolvedValueOnce(10n ** 18n);
  await wallet.connect();
  expect(wallet.getState().balancePnr).toBe('2');
  mock.getBalance.mockRejectedValueOnce(new Error('RPC unavailable'));
  await wallet.refreshBalance(address);
  expect(wallet.getState().balancePnr).toBe('2');
  expect(wallet.getState().balancePol).toBeNull();
  expect(wallet.getState().error).toContain('could not be verified');
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

it('preserves the exact native balance instead of rounding small gas balances to zero', async () => {
  mock.getBalance.mockResolvedValueOnce(12345n);
  await wallet.connect();
  expect(wallet.getState().balancePol).toBe('0.000000000000012345');
});
it('clears an unavailable token balance and exposes an actionable refresh error', async () => {
  mock.getBalance.mockResolvedValue(10n ** 18n);
  await wallet.connect();
  mock.fetchBalance.mockResolvedValue({ balanceFormatted: null, decimals: 6 });
  await wallet.refreshBalance(address);
  expect(wallet.getState().balancePnr).toBeNull();
  expect(wallet.getState().error).toContain('could not be verified');
});
it('adds then explicitly selects Amoy and resynchronizes a provider with no chainChanged event', async () => {
  let chain = '0x1';
  let added = false;
  const request = vi.fn(async ({ method }: { method: string }) => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [address];
    if (method === 'eth_chainId') return chain;
    if (method === 'wallet_addEthereumChain') { added = true; return null; }
    if (method === 'wallet_switchEthereumChain') {
      if (!added) throw Object.assign(new Error('Unknown chain'), { code: 4902 });
      chain = '0x13882'; return null;
    }
  });
  vi.stubGlobal('window', { ethereum: { request } });
  mock.getBalance.mockResolvedValue(10n ** 18n);
  await wallet.connect();
  expect(wallet.getState().isCorrectNetwork).toBe(false);
  await wallet.switchOrAddAmoyNetwork();
  expect(wallet.getState().isCorrectNetwork).toBe(true);
  expect(wallet.getState().chainId).toBe(80002);
  expect(request.mock.calls.filter(([args]) => args.method === 'wallet_switchEthereumChain')).toHaveLength(2);
});

it('retains the provider error when a connected user rejects a network switch', async () => {
  vi.stubGlobal('window', { ethereum: { request: async ({ method }: { method: string }) => {
    if (method === 'eth_chainId') return '0x1';
    if (method === 'wallet_switchEthereumChain') throw Object.assign(new Error('User rejected network switch'), { code: 4001 });
    return [address];
  } } });
  await wallet.connect();
  await wallet.switchOrAddAmoyNetwork();
  expect(wallet.getState().isCorrectNetwork).toBe(false);
  expect(wallet.getState().error).toBe('User rejected network switch');
});

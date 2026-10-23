import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPair } from '../lib/crypto/penoraKeys';
import { PENORA_CONTRACT_ADDRESSES } from '../lib/wallet/contracts';
import {
  deriveAmoyAccountFromActiveKey, ActiveKeyAmoyProvider,
  getActiveKeyWalletProvider, setActiveKeyWalletProvider, lockActiveKeyWallet,
  isPermittedActiveKeyAmoyCall,
} from '../lib/wallet/activeKeyAmoyProvider';

describe('PENORA Active Key derived EVM wallet on Amoy (isolated prototype)', () => {
  afterEach(() => { lockActiveKeyWallet(); vi.unstubAllGlobals(); });
  it('deterministically derives the same Amoy address from the SAME existing Active Key', async () => {
    const wif = generateKeyPair('active').privateKeyWif;
    const a = await deriveAmoyAccountFromActiveKey(wif);
    const b = await deriveAmoyAccountFromActiveKey(wif);
    expect(a.address).toBe(b.address);
    expect(a.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
  it('different Active Keys yield different EVM accounts', async () => {
    const a = await deriveAmoyAccountFromActiveKey(generateKeyPair('active').privateKeyWif);
    const b = await deriveAmoyAccountFromActiveKey(generateKeyPair('active').privateKeyWif);
    expect(a.address).not.toBe(b.address);
  });
  it('provides only Amoy EIP-1193 accounts and never switches to mainnet', async () => {
    const account = await deriveAmoyAccountFromActiveKey(generateKeyPair('active').privateKeyWif);
    const p = new ActiveKeyAmoyProvider(account);
    expect(await p.request({ method: 'eth_accounts' })).toEqual([account.address]);
    expect(await p.request({ method: 'eth_chainId' })).toBe('0x13882');
    await expect(p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] })).rejects.toThrow('only Polygon Amoy');
  });
  it('blocks signing from another address without requesting a signature', async () => {
    const account = await deriveAmoyAccountFromActiveKey(generateKeyPair('active').privateKeyWif);
    const p = new ActiveKeyAmoyProvider(account);
    const confirm = vi.fn(()=>true);
    vi.stubGlobal('window', { confirm });
    await expect(p.request({method:'eth_sendTransaction',params:[{from:'0x1111111111111111111111111111111111111111',to:account.address}]})).rejects.toThrow('account changed');
    expect(confirm).not.toHaveBeenCalled();
  });
  it('requires a visible confirmation for any blockchain broadcast', async () => {
    const account = await deriveAmoyAccountFromActiveKey(generateKeyPair('active').privateKeyWif);
    const p = new ActiveKeyAmoyProvider(account);
    vi.stubGlobal('window', { confirm: () => false });
    await expect(p.request({method:'eth_sendTransaction',params:[{from:account.address,to:PENORA_CONTRACT_ADDRESSES.PNR_TOKEN,data:'0xa9059cbb'}]})).rejects.toThrow('rejected by user');
  });
  it('locks the in-memory signer on request', async () => {
    const account = await deriveAmoyAccountFromActiveKey(generateKeyPair('active').privateKeyWif);
    const p = new ActiveKeyAmoyProvider(account);
    setActiveKeyWalletProvider(p);
    expect(getActiveKeyWalletProvider()).toBe(p);
    lockActiveKeyWallet();
    expect(getActiveKeyWalletProvider()).toBeNull();
  });
  it('prevents old provider references from signing after wallet lock', async () => {
    const account = await deriveAmoyAccountFromActiveKey(generateKeyPair('active').privateKeyWif);
    const p = new ActiveKeyAmoyProvider(account);
    setActiveKeyWalletProvider(p);
    lockActiveKeyWallet();
    await expect(p.request({ method: 'eth_accounts' })).rejects.toThrow('locked');
    await expect(p.request({ method: 'eth_sendTransaction', params: [] })).rejects.toThrow('locked');
  });
  it('revokes old provider when switching between account sessions', async () => {
    const one = new ActiveKeyAmoyProvider(await deriveAmoyAccountFromActiveKey(generateKeyPair('active').privateKeyWif));
    const two = new ActiveKeyAmoyProvider(await deriveAmoyAccountFromActiveKey(generateKeyPair('active').privateKeyWif));
    setActiveKeyWalletProvider(one);
    setActiveKeyWalletProvider(two);
    await expect(one.request({ method: 'eth_accounts' })).rejects.toThrow('locked');
    expect(await two.request({ method: 'eth_accounts' })).toEqual([two.address]);
  });
  it('only accepts configured PENORA Amoy contract calls with zero native POL value', () => {
    const pnr = PENORA_CONTRACT_ADDRESSES.PNR_TOKEN;
    expect(isPermittedActiveKeyAmoyCall(pnr, '0xa9059cbb')).toBe(true);
    expect(isPermittedActiveKeyAmoyCall(pnr, '0xa9059cbb', '0x1')).toBe(false);
    expect(isPermittedActiveKeyAmoyCall(pnr, '0x')).toBe(false);
    expect(isPermittedActiveKeyAmoyCall('0x1111111111111111111111111111111111111111', '0xa9059cbb')).toBe(false);
  });
  it('rejects unauthorized transaction destination BEFORE showing approval', async () => {
    const account = await deriveAmoyAccountFromActiveKey(generateKeyPair('active').privateKeyWif);
    const p = new ActiveKeyAmoyProvider(account);
    const confirm = vi.fn(() => true);
    vi.stubGlobal('window', { confirm });
    await expect(p.request({
      method: 'eth_sendTransaction',
      params: [{ from: account.address, to: '0x1111111111111111111111111111111111111111', data: '0xa9059cbb' }],
    })).rejects.toThrow('configured PENORA');
    expect(confirm).not.toHaveBeenCalled();
  });
  it('refuses arbitrary signing methods', async () => {
    const account = await deriveAmoyAccountFromActiveKey(generateKeyPair('active').privateKeyWif);
    const p = new ActiveKeyAmoyProvider(account);
    await expect(p.request({ method:'eth_sign', params:[] })).rejects.toThrow('Unsupported');
  });
});

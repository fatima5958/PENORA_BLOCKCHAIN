import { afterEach, describe, expect, it } from 'vitest';
import { setEmbeddedWalletProvider, getEmbeddedWalletProvider, clearEmbeddedWalletProvider } from '../lib/wallet/embeddedProvider';

describe('PENORA ephemeral embedded EIP-1193 provider', () => {
  afterEach(() => clearEmbeddedWalletProvider());
  it('registers a provider without persisting keys', () => {
    expect(getEmbeddedWalletProvider()).toBeNull();
    const provider = { request: async () => [] };
    setEmbeddedWalletProvider(provider);
    expect(getEmbeddedWalletProvider()).toBe(provider);
  });
  it('rejects a stale logout clearing a newer wallet session', () => {
    const old = { request: async () => [] };
    const current = { request: async () => [] };
    setEmbeddedWalletProvider(old);
    setEmbeddedWalletProvider(current);
    clearEmbeddedWalletProvider(old);
    expect(getEmbeddedWalletProvider()).toBe(current);
  });
});

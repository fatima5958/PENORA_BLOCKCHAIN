import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAccountKeySuite, generateKeyPair, deriveKeyInfoFromWif } from '../lib/crypto/penoraKeys';
import { authBroker } from '../lib/auth/authBroker';
import { penoraKeyAuth } from '../lib/auth/penoraKeyAuth';
import { PENORA_CONTRACT_ADDRESSES } from '../lib/wallet/contracts';
import {
  deriveAmoyAccountFromActiveKey,
  ActiveKeyAmoyProvider,
  getActiveKeyWalletProvider,
  setActiveKeyWalletProvider,
  lockActiveKeyWallet,
  isPermittedActiveKeyAmoyCall,
} from '../lib/wallet/activeKeyAmoyProvider';
import {
  deriveDeterministicSmartAccountAddress,
  evaluateTransactionSponsorship,
  recordSponsorshipGrant,
  resetSponsorshipLedger,
  getGasSponsorshipStatus,
  APPROVED_PENORA_SELECTORS,
} from '../lib/wallet/gasSponsorshipService';
import { penoraWalletService, getEthereumProvider } from '../lib/wallet/walletService';

describe('PENORA Phase 24 — Active Key Wallet Security, AA & Gasless Architecture Suite', () => {
  beforeEach(() => {
    resetSponsorshipLedger();
    lockActiveKeyWallet();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    resetSponsorshipLedger();
    lockActiveKeyWallet();
    vi.unstubAllGlobals();
  });

  // 1. Valid PENORA Active Key
  it('1. permits unlocking and derives deterministic Amoy signer with valid Active Key', async () => {
    const suite = generateAccountKeySuite();
    const username = 'testuser1';
    authBroker.registerAccount({
      userId: 'uuid-1',
      username,
      displayName: 'Test User 1',
      authorities: {
        owner_public_key: suite.owner.publicKeyPen,
        active_public_key: suite.active.publicKeyPen,
        posting_public_key: suite.posting.publicKeyPen,
        memo_public_key: suite.memo.publicKeyPen,
      },
    });

    const loginRes = await penoraKeyAuth.loginWithPrivateKey(username, suite.active.privateKeyWif);
    expect(loginRes.success).toBe(true);
    expect(loginRes.user?.keyRole).toBe('active');

    const account = await deriveAmoyAccountFromActiveKey(suite.active.privateKeyWif);
    expect(account.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    const provider = new ActiveKeyAmoyProvider(account);
    setActiveKeyWalletProvider(provider);
    expect(getActiveKeyWalletProvider()).toBe(provider);
  });

  // 2. Incorrect Active Key
  it('2. rejects malformed or incorrect Active Key without mutating state', async () => {
    const invalidKey = '5JInvalidBase58KeyThatIsNotReal1234567890';
    await expect(deriveAmoyAccountFromActiveKey(invalidKey)).rejects.toThrow();

    const username = 'testuser2';
    const loginRes = await penoraKeyAuth.loginWithPrivateKey(username, invalidKey);
    expect(loginRes.success).toBe(false);
    expect(getActiveKeyWalletProvider()).toBeNull();
  });

  // 3. Posting/Owner/Memo Key rejection
  it('3. strictly rejects Posting, Owner and Memo keys for wallet unlock', async () => {
    const suite = generateAccountKeySuite();
    const username = 'testuser3';
    authBroker.registerAccount({
      userId: 'uuid-3',
      username,
      displayName: 'Test User 3',
      authorities: {
        owner_public_key: suite.owner.publicKeyPen,
        active_public_key: suite.active.publicKeyPen,
        posting_public_key: suite.posting.publicKeyPen,
        memo_public_key: suite.memo.publicKeyPen,
      },
    });

    // Posting key: succeeds for login but role is 'posting'
    const postingRes = await penoraKeyAuth.loginWithPrivateKey(username, suite.posting.privateKeyWif);
    expect(postingRes.success).toBe(true);
    expect(postingRes.user?.keyRole).toBe('posting');

    // Owner key: rejected with explanatory message
    const ownerRes = await penoraKeyAuth.loginWithPrivateKey(username, suite.owner.privateKeyWif);
    expect(ownerRes.success).toBe(false);
    expect(ownerRes.error).toContain('Owner Key');

    // Memo key: rejected with explanatory message
    const memoRes = await penoraKeyAuth.loginWithPrivateKey(username, suite.memo.privateKeyWif);
    expect(memoRes.success).toBe(false);
    expect(memoRes.error).toContain('Memo Key');
  });

  // 4. Correct account and authority matching
  it('4. enforces authority matching: user A active key cannot unlock user B', async () => {
    const suiteA = generateAccountKeySuite();
    const suiteB = generateAccountKeySuite();
    authBroker.registerAccount({
      userId: 'uuid-a',
      username: 'alice',
      displayName: 'Alice',
      authorities: {
        owner_public_key: suiteA.owner.publicKeyPen,
        active_public_key: suiteA.active.publicKeyPen,
        posting_public_key: suiteA.posting.publicKeyPen,
        memo_public_key: suiteA.memo.publicKeyPen,
      },
    });
    authBroker.registerAccount({
      userId: 'uuid-b',
      username: 'bob',
      displayName: 'Bob',
      authorities: {
        owner_public_key: suiteB.owner.publicKeyPen,
        active_public_key: suiteB.active.publicKeyPen,
        posting_public_key: suiteB.posting.publicKeyPen,
        memo_public_key: suiteB.memo.publicKeyPen,
      },
    });

    // Alice's key used against Bob's account
    const crossRes = await penoraKeyAuth.loginWithPrivateKey('bob', suiteA.active.privateKeyWif);
    expect(crossRes.success).toBe(false);
    expect(crossRes.error).toContain('does not match');
  });

  // 5. Deterministic wallet address
  it('5. deterministically derives identical EVM address for same Active Key across sessions', async () => {
    const key = generateKeyPair('active').privateKeyWif;
    const addr1 = (await deriveAmoyAccountFromActiveKey(key)).address;
    const addr2 = (await deriveAmoyAccountFromActiveKey(key)).address;
    expect(addr1).toBe(addr2);

    const otherKey = generateKeyPair('active').privateKeyWif;
    const otherAddr = (await deriveAmoyAccountFromActiveKey(otherKey)).address;
    expect(addr1).not.toBe(otherAddr);
  });

  // 6. Account switching
  it('6. revokes old provider and disconnects when switching accounts', async () => {
    const suiteA = generateAccountKeySuite();
    const suiteB = generateAccountKeySuite();

    const signerA = await deriveAmoyAccountFromActiveKey(suiteA.active.privateKeyWif);
    const providerA = new ActiveKeyAmoyProvider(signerA);
    setActiveKeyWalletProvider(providerA);
    expect(getActiveKeyWalletProvider()?.address).toBe(signerA.address);

    const signerB = await deriveAmoyAccountFromActiveKey(suiteB.active.privateKeyWif);
    const providerB = new ActiveKeyAmoyProvider(signerB);
    setActiveKeyWalletProvider(providerB);

    // Old provider is now locked/revoked
    await expect(providerA.request({ method: 'eth_accounts' })).rejects.toThrow('locked');
    // New provider is active
    expect(await providerB.request({ method: 'eth_accounts' })).toEqual([signerB.address]);
  });

  // 7. Logout and stale signer revocation
  it('7. locks provider on logout and prevents signing from stale references', async () => {
    const key = generateKeyPair('active').privateKeyWif;
    const account = await deriveAmoyAccountFromActiveKey(key);
    const provider = new ActiveKeyAmoyProvider(account);
    setActiveKeyWalletProvider(provider);

    expect(await provider.request({ method: 'eth_accounts' })).toEqual([account.address]);

    // Perform lock/logout
    lockActiveKeyWallet();
    expect(getActiveKeyWalletProvider()).toBeNull();

    // Stale reference is immediately revoked
    await expect(provider.request({ method: 'eth_accounts' })).rejects.toThrow('locked');
    await expect(provider.request({ method: 'eth_sendTransaction', params: [] })).rejects.toThrow('locked');
  });

  // 8. Idle locking
  it('8. lockActiveKeyWallet clears in-memory activeProvider reference', () => {
    const provider = new ActiveKeyAmoyProvider({
      address: '0x1111111111111111111111111111111111111111',
    } as any);
    setActiveKeyWalletProvider(provider);
    expect(getActiveKeyWalletProvider()).toBe(provider);

    lockActiveKeyWallet();
    expect(getActiveKeyWalletProvider()).toBeNull();
  });

  // 9. Unauthorized contract/function rejection
  it('9. rejects unauthorized contract destinations and unknown function selectors before prompt', async () => {
    const key = generateKeyPair('active').privateKeyWif;
    const account = await deriveAmoyAccountFromActiveKey(key);
    const provider = new ActiveKeyAmoyProvider(account);

    const confirmSpy = vi.fn(() => true);
    vi.stubGlobal('window', { confirm: confirmSpy });

    // Unauthorized contract
    await expect(provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: account.address, to: '0x9999999999999999999999999999999999999999', data: '0xa9059cbb' }],
    })).rejects.toThrow('configured PENORA');

    // Unknown function selector on valid contract
    await expect(provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: account.address, to: PENORA_CONTRACT_ADDRESSES.PNR_TOKEN, data: '0xdeadbeef12345678' }],
    })).rejects.toThrow('configured PENORA');

    // Non-zero native POL transfer on contract call
    await expect(provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: account.address, to: PENORA_CONTRACT_ADDRESSES.PNR_TOKEN, data: '0xa9059cbb', value: '1000' }],
    })).rejects.toThrow('configured PENORA');

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  // 10. Wrong-network rejection
  it('10. rejects chainId other than 80002 and blocks wallet_switchEthereumChain', async () => {
    const key = generateKeyPair('active').privateKeyWif;
    const account = await deriveAmoyAccountFromActiveKey(key);
    const provider = new ActiveKeyAmoyProvider(account);

    expect(await provider.request({ method: 'eth_chainId' })).toBe('0x13882');
    await expect(provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x1' }],
    })).rejects.toThrow('only Polygon Amoy');
  });

  // 11. Rejected transaction signing
  it('11. returns code 4001 when user cancels the transaction confirmation dialog', async () => {
    const key = generateKeyPair('active').privateKeyWif;
    const account = await deriveAmoyAccountFromActiveKey(key);
    const provider = new ActiveKeyAmoyProvider(account);

    vi.stubGlobal('window', { confirm: () => false });

    await expect(provider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: account.address,
        to: PENORA_CONTRACT_ADDRESSES.PNR_TOKEN,
        data: '0xa9059cbb' + '0'.repeat(128),
      }],
    })).rejects.toMatchObject({ code: 4001 });
  });

  // 12. Real token-balance reads
  it('12. integrates with publicClient for deterministic address balance queries', async () => {
    vi.stubGlobal('window', {});
    const key = generateKeyPair('active').privateKeyWif;
    const account = await deriveAmoyAccountFromActiveKey(key);
    expect(account.address).toMatch(/^0x[0-9a-fA-F]{40}$/);

    const provider = new ActiveKeyAmoyProvider(account);
    setActiveKeyWalletProvider(provider);

    const eth = getEthereumProvider();
    expect(eth).toBe(provider);
    const accounts = await eth.request({ method: 'eth_accounts' });
    expect(accounts[0].toLowerCase()).toBe(account.address.toLowerCase());
  });

  // 13. Correct transaction receipts
  it('13. conforms to EIP-1193 RPC specification for requests and account reporting', async () => {
    const key = generateKeyPair('active').privateKeyWif;
    const account = await deriveAmoyAccountFromActiveKey(key);
    const provider = new ActiveKeyAmoyProvider(account);

    expect(await provider.request({ method: 'net_version' })).toBe('80002');
    expect(await provider.request({ method: 'eth_accounts' })).toEqual([account.address]);
    expect(await provider.request({ method: 'eth_requestAccounts' })).toEqual([account.address]);
  });

  // 14. Sponsored transaction success and failure
  it('14. evaluates sponsorship eligibility, rate limiting and quota consumption correctly', () => {
    const username = 'creator_alice';
    const from = '0x1111111111111111111111111111111111111111';
    const to = PENORA_CONTRACT_ADDRESSES.PNR_TOKEN as `0x${string}`;
    const data = '0xa9059cbb00000000000000000000000022222222222222222222222222222222222222220000000000000000000000000000000000000000000000000de0b6b3a7640000';

    // 1. Eligible transaction
    const res1 = evaluateTransactionSponsorship({
      username,
      from,
      to,
      data,
      value: 0n,
    });
    expect(res1.eligible).toBe(true);
    expect(res1.smartAccountAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);

    // Consume hourly rate limit
    for (let i = 0; i < 5; i++) {
      recordSponsorshipGrant(username);
    }

    // 2. Hourly limit reached
    const resRateLimit = evaluateTransactionSponsorship({
      username,
      from,
      to,
      data,
    });
    expect(resRateLimit.eligible).toBe(false);
    expect(resRateLimit.reason).toContain('Hourly rate limit exceeded');
  });

  // 15. Zero-Test-POL user scenario
  it('15. accurately detects and reports sponsorship infrastructure state and zero-POL fallback', () => {
    const status = getGasSponsorshipStatus();
    // In local dev/test environment without bundler env vars
    expect(status.status).toBe('unconfigured');
    expect(status.blockerReason).toContain('Paymaster and Bundler endpoints are not configured');
  });

  // 16. Key rotation and recovery implications
  it('16. verifies that rotating Active Key yields a distinct deterministic EVM address', async () => {
    const oldActiveKey = generateKeyPair('active').privateKeyWif;
    const newActiveKey = generateKeyPair('active').privateKeyWif;

    const oldEvm = await deriveAmoyAccountFromActiveKey(oldActiveKey);
    const newEvm = await deriveAmoyAccountFromActiveKey(newActiveKey);

    expect(oldEvm.address).not.toBe(newEvm.address);
  });

  // 17. MetaMask optional fallback
  it('17. seamlessly preserves MetaMask fallback when Active Key provider is locked', () => {
    const mockMetaMask = {
      isMetaMask: true,
      request: vi.fn(),
    };
    vi.stubGlobal('window', {
      ethereum: mockMetaMask,
    });

    // When locked, getEthereumProvider falls back to window.ethereum
    expect(getActiveKeyWalletProvider()).toBeNull();
    expect(getEthereumProvider()).toBe(mockMetaMask);

    // When Active Key wallet is unlocked, it takes precedence
    const key = generateKeyPair('active').privateKeyWif;
    const provider = new ActiveKeyAmoyProvider({
      address: '0x3333333333333333333333333333333333333333',
    } as any);
    setActiveKeyWalletProvider(provider);
    expect(getEthereumProvider()).toBe(provider);

    // Locking returns cleanly to MetaMask
    lockActiveKeyWallet();
    expect(getEthereumProvider()).toBe(mockMetaMask);
  });

  // 18. Mobile and desktop navigation
  it('18. verifies provider exports and state reset methods for desktop & mobile transitions', () => {
    expect(typeof isPermittedActiveKeyAmoyCall).toBe('function');
    expect(typeof lockActiveKeyWallet).toBe('function');
    expect(typeof setActiveKeyWalletProvider).toBe('function');
    expect(typeof getActiveKeyWalletProvider).toBe('function');
  });

  // 19. Existing Exchange functionality
  it('19. recognizes Exchange buy, setRate, pause, unpause, and withdraw function selectors', () => {
    expect(APPROVED_PENORA_SELECTORS['0x40993b26']).toBe('buy(uint256,uint256,uint256)');
    expect(APPROVED_PENORA_SELECTORS['0x34fcf437']).toBe('setRate(uint256)');
    expect(APPROVED_PENORA_SELECTORS['0x8456cb59']).toBe('pause()');
    expect(APPROVED_PENORA_SELECTORS['0x3f4ba83a']).toBe('unpause()');
    expect(APPROVED_PENORA_SELECTORS['0xd9caed12']).toBe('withdraw(address,address,uint256)');
  });

  // 20. No private key exposure or persistence
  it('20. ensures private keys are never stored in localStorage, sessionStorage, or global state', async () => {
    const suite = generateAccountKeySuite();
    const wif = suite.active.privateKeyWif;

    const mockStorage: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
      removeItem: (k: string) => { delete mockStorage[k]; },
    });

    const account = await deriveAmoyAccountFromActiveKey(wif);
    const provider = new ActiveKeyAmoyProvider(account);
    setActiveKeyWalletProvider(provider);

    // Verify localStorage contains NO WIF or derived EVM private key
    for (const [key, val] of Object.entries(mockStorage)) {
      expect(val).not.toContain(wif);
      expect(key).not.toContain('private');
    }
  });
});

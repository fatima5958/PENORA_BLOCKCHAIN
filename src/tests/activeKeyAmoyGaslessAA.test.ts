import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPair, generateAccountKeySuite } from '../lib/crypto/penoraKeys';
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
  buildSimpleAccountInitCode,
  computeUserOpHash,
  isSafeBoundedAllowance,
  evaluateTransactionSponsorship,
  recordSponsorshipGrant,
  resetSponsorshipLedger,
  getGasSponsorshipStatus,
  CANONICAL_ENTRY_POINT_V06,
  CANONICAL_SIMPLE_ACCOUNT_FACTORY,
  MAX_SAFE_PNR_ALLOWANCE,
  MAX_SAFE_USDT_ALLOWANCE,
  UNLIMITED_ALLOWANCE_SENTINEL,
  type UserOperationV06,
} from '../lib/wallet/gasSponsorshipService';
import { getEthereumProvider } from '../lib/wallet/walletService';

describe('PENORA Phase 25 — Real Amoy Gasless AA Smart Account & Security Suite', () => {
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

  // 1. Smart Account Derivation & Stability
  it('1. deterministically derives the same ERC-4337 smart account address from the same derived EOA owner', async () => {
    const key = generateKeyPair('active').privateKeyWif;
    const account = await deriveAmoyAccountFromActiveKey(key);

    const sa1 = deriveDeterministicSmartAccountAddress(account.address);
    const sa2 = deriveDeterministicSmartAccountAddress(account.address);

    expect(sa1).toBe(sa2);
    expect(sa1).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(sa1.toLowerCase()).not.toBe(account.address.toLowerCase());
  });

  // 2. Distinct Smart Account for distinct Owners
  it('2. derives distinct smart account addresses for different owners', async () => {
    const key1 = generateKeyPair('active').privateKeyWif;
    const key2 = generateKeyPair('active').privateKeyWif;

    const acc1 = await deriveAmoyAccountFromActiveKey(key1);
    const acc2 = await deriveAmoyAccountFromActiveKey(key2);

    const sa1 = deriveDeterministicSmartAccountAddress(acc1.address);
    const sa2 = deriveDeterministicSmartAccountAddress(acc2.address);

    expect(sa1).not.toBe(sa2);
  });

  // 3. SimpleAccount initCode generation
  it('3. constructs valid SimpleAccount initCode with canonical factory', async () => {
    const key = generateKeyPair('active').privateKeyWif;
    const account = await deriveAmoyAccountFromActiveKey(key);

    const initCode = buildSimpleAccountInitCode(account.address);
    expect(initCode.toLowerCase()).toContain(CANONICAL_SIMPLE_ACCOUNT_FACTORY.toLowerCase().slice(2));
    expect(initCode.length).toBeGreaterThan(42);
  });

  // 4. UserOperation Hash Computation
  it('4. computes canonical ERC-4337 v0.6 UserOp hash for signing', async () => {
    const key = generateKeyPair('active').privateKeyWif;
    const account = await deriveAmoyAccountFromActiveKey(key);
    const sa = deriveDeterministicSmartAccountAddress(account.address);

    const userOp: UserOperationV06 = {
      sender: sa,
      nonce: 0n,
      initCode: '0x',
      callData: '0xa9059cbb' as `0x${string}`,
      callGasLimit: 100_000n,
      verificationGasLimit: 150_000n,
      preVerificationGas: 50_000n,
      maxFeePerGas: 30_000_000_000n,
      maxPriorityFeePerGas: 2_000_000_000n,
      paymasterAndData: '0x',
      signature: '0x',
    };

    const hash = computeUserOpHash(userOp, CANONICAL_ENTRY_POINT_V06, 80002);
    expect(hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  // 5. Bounded Allowance Safety — Unlimited Approvals Strictly Rejected
  it('5. strictly detects and rejects unlimited token allowances (type(uint256).max)', () => {
    const pnr = PENORA_CONTRACT_ADDRESSES.PNR_TOKEN;
    const spender = '0000000000000000000000001111111111111111111111111111111111111111';
    const infiniteAmount = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const infiniteCalldata = '0x095ea7b3' + spender + infiniteAmount;

    const check = isSafeBoundedAllowance(pnr as `0x${string}`, infiniteCalldata);
    expect(check.isSafe).toBe(false);
    expect(check.reason).toContain('Unlimited token allowances');

    // Provider check must also reject
    expect(isPermittedActiveKeyAmoyCall(pnr, infiniteCalldata)).toBe(false);
  });

  // 6. Bounded Allowance Safety — Safe Exact Amount Approvals Permitted
  it('6. permits exact safe bounded token allowances within total supply', () => {
    const pnr = PENORA_CONTRACT_ADDRESSES.PNR_TOKEN;
    const spender = '0000000000000000000000001111111111111111111111111111111111111111';
    // 50 PNR (50 * 10^18 wei = 0x2b5e3af16b1880000)
    const amountHex = (50n * 10n ** 18n).toString(16).padStart(64, '0');
    const safeCalldata = '0x095ea7b3' + spender + amountHex;

    const check = isSafeBoundedAllowance(pnr as `0x${string}`, safeCalldata);
    expect(check.isSafe).toBe(true);
    expect(check.amount).toBe(50n * 10n ** 18n);

    // Provider check permits safe bounded approval
    expect(isPermittedActiveKeyAmoyCall(pnr, safeCalldata)).toBe(true);
  });

  // 7. Bounded Allowance Safety — Excessive Amount Exceeding Total Supply Rejected
  it('7. rejects allowance requests exceeding contract maximum safe supply', () => {
    const pnr = PENORA_CONTRACT_ADDRESSES.PNR_TOKEN;
    const spender = '0000000000000000000000001111111111111111111111111111111111111111';
    // 500M PNR (exceeds 100M total fixed supply)
    const excessiveAmount = (500_000_000n * 10n ** 18n).toString(16).padStart(64, '0');
    const excessiveCalldata = '0x095ea7b3' + spender + excessiveAmount;

    const check = isSafeBoundedAllowance(pnr as `0x${string}`, excessiveCalldata);
    expect(check.isSafe).toBe(false);
    expect(check.reason).toContain('exceeds safe limit');
    expect(isPermittedActiveKeyAmoyCall(pnr, excessiveCalldata)).toBe(false);
  });

  // 8. Zero-Test-POL Gas Sponsorship Policy Evaluation
  it('8. approves eligible contract calls for 0-Test-POL gas sponsorship and enforces daily limits', () => {
    const username = 'bob_creator';
    const from = '0x2222222222222222222222222222222222222222';
    const to = PENORA_CONTRACT_ADDRESSES.PNR_TOKEN as `0x${string}`;
    const data = '0xa9059cbb' + '0'.repeat(128);

    const eval1 = evaluateTransactionSponsorship({ username, from, to, data });
    expect(eval1.eligible).toBe(true);
    expect(eval1.smartAccountAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);

    // Hit hourly rate limit (5 requests)
    for (let i = 0; i < 5; i++) {
      recordSponsorshipGrant(username);
    }

    const evalHourly = evaluateTransactionSponsorship({ username, from, to, data });
    expect(evalHourly.eligible).toBe(false);
    expect(evalHourly.reason).toContain('Hourly rate limit exceeded');
  });

  // 9. Rejection of Native POL Transfers for Sponsorship
  it('9. rejects any non-zero native POL transfer value from gas sponsorship', () => {
    const username = 'charlie';
    const from = '0x3333333333333333333333333333333333333333';
    const to = PENORA_CONTRACT_ADDRESSES.PNR_TOKEN as `0x${string}`;
    const data = '0xa9059cbb' + '0'.repeat(128);

    const evalVal = evaluateTransactionSponsorship({ username, from, to, data, value: '1000000000' });
    expect(evalVal.eligible).toBe(false);
    expect(evalVal.reason).toContain('native POL value must be zero');
  });

  // 10. Honest Infrastructure Reporting
  it('10. reports unconfigured status honestly when Paymaster endpoints are absent', () => {
    const status = getGasSponsorshipStatus();
    expect(status.status).toBe('unconfigured');
    expect(status.provider).toBe('none');
    expect(status.blockerReason).toContain('Paymaster and Bundler endpoints are not configured');
  });

  // 11. Stale Signer Revocation on Lock
  it('11. ensures lockActiveKeyWallet immediately revokes in-flight provider access', async () => {
    const key = generateKeyPair('active').privateKeyWif;
    const account = await deriveAmoyAccountFromActiveKey(key);
    const provider = new ActiveKeyAmoyProvider(account);
    setActiveKeyWalletProvider(provider);

    expect(getActiveKeyWalletProvider()).toBe(provider);
    lockActiveKeyWallet();

    expect(getActiveKeyWalletProvider()).toBeNull();
    await expect(provider.request({ method: 'eth_accounts' })).rejects.toThrow('locked');
  });

  // 12. Optional MetaMask Fallback
  it('12. preserves MetaMask external wallet fallback seamlessly', () => {
    const mockInjected = { isMetaMask: true, request: vi.fn() };
    vi.stubGlobal('window', { ethereum: mockInjected });

    expect(getEthereumProvider()).toBe(mockInjected);

    const provider = new ActiveKeyAmoyProvider({ address: '0x4444444444444444444444444444444444444444' } as any);
    setActiveKeyWalletProvider(provider);
    expect(getEthereumProvider()).toBe(provider);

    lockActiveKeyWallet();
    expect(getEthereumProvider()).toBe(mockInjected);
  });
});

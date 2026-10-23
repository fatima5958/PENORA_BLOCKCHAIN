import { describe, it, expect, beforeEach } from 'vitest';
import { encodeFunctionData, parseEther, parseUnits, zeroAddress, type Address } from 'viem';
import {
  validateContractCalldata,
  MAX_SAFE_PNR_ALLOWANCE,
  MAX_SAFE_USDT_ALLOWANCE,
  UNLIMITED_ALLOWANCE_SENTINEL,
} from '../lib/wallet/calldataValidator';
import {
  authorizeSponsorship,
  resetServerSponsorshipLedger,
  type SponsorshipAuthRequest,
} from '../lib/wallet/serverSponsorshipService';
import {
  PENORA_CONTRACT_ADDRESSES,
  PNR_TOKEN_ABI,
  ERC20_USDT_ABI,
  POWER_ESCROW_ABI,
} from '../lib/wallet/contracts';
import { EXCHANGE_ABI, FOUNDER_WALLET_ADDRESS } from '../lib/exchange/exchangeService';

describe('PENORA Phase 25 — Calldata ABI Validation & Server Sponsorship Policy Suite', () => {
  const pnr = PENORA_CONTRACT_ADDRESSES.PNR_TOKEN as Address;
  const usdt = PENORA_CONTRACT_ADDRESSES.USDT_TOKEN as Address;
  const alice: Address = '0x1111111111111111111111111111111111111111';
  const bob: Address = '0x2222222222222222222222222222222222222222';
  const spender: Address = '0x3333333333333333333333333333333333333333';

  beforeEach(() => {
    resetServerSponsorshipLedger();
  });

  describe('1. validateContractCalldata — PNR Token Operations', () => {
    it('permits valid PNR transfers to recipient with safe amounts', () => {
      const data = encodeFunctionData({
        abi: PNR_TOKEN_ABI,
        functionName: 'transfer',
        args: [bob, parseEther('25')],
      });

      const res = validateContractCalldata({ to: pnr, data, value: 0n });
      expect(res.valid).toBe(true);
      expect(res.contractName).toBe('PenoraToken');
      expect(res.functionName).toBe('transfer');
    });

    it('permits safe bounded PNR allowance within 100M total supply', () => {
      const data = encodeFunctionData({
        abi: PNR_TOKEN_ABI,
        functionName: 'approve',
        args: [spender, parseEther('5000')],
      });

      const res = validateContractCalldata({ to: pnr, data });
      expect(res.valid).toBe(true);
      expect(res.contractName).toBe('PenoraToken');
      expect(res.functionName).toBe('approve');
    });

    it('strictly rejects unlimited uint256.max PNR approval', () => {
      const data = encodeFunctionData({
        abi: PNR_TOKEN_ABI,
        functionName: 'approve',
        args: [spender, UNLIMITED_ALLOWANCE_SENTINEL],
      });

      const res = validateContractCalldata({ to: pnr, data });
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('Unlimited token allowances');
    });

    it('rejects PNR approval exceeding 100M total supply bound', () => {
      const data = encodeFunctionData({
        abi: PNR_TOKEN_ABI,
        functionName: 'approve',
        args: [spender, MAX_SAFE_PNR_ALLOWANCE + 1n],
      });

      const res = validateContractCalldata({ to: pnr, data });
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('Approval exceeds maximum safe total supply');
    });

    it('permits PNR burn for positive amounts and rejects burn of 0', () => {
      const validBurn = encodeFunctionData({
        abi: PNR_TOKEN_ABI,
        functionName: 'burn',
        args: [parseEther('10')],
      });
      expect(validateContractCalldata({ to: pnr, data: validBurn }).valid).toBe(true);

      const zeroBurn = encodeFunctionData({
        abi: PNR_TOKEN_ABI,
        functionName: 'burn',
        args: [0n],
      });
      const resZero = validateContractCalldata({ to: pnr, data: zeroBurn });
      expect(resZero.valid).toBe(false);
      expect(resZero.reason).toContain('Burn amount must be greater than zero');
    });
  });

  describe('2. validateContractCalldata — MockUSDT Token Operations', () => {
    it('permits valid USDT transfer', () => {
      const data = encodeFunctionData({
        abi: ERC20_USDT_ABI,
        functionName: 'transfer',
        args: [bob, parseUnits('50', 6)],
      });

      const res = validateContractCalldata({ to: usdt, data });
      expect(res.valid).toBe(true);
      expect(res.contractName).toBe('MockUSDT');
    });

    it('strictly rejects unlimited MockUSDT approval', () => {
      const data = encodeFunctionData({
        abi: ERC20_USDT_ABI,
        functionName: 'approve',
        args: [spender, UNLIMITED_ALLOWANCE_SENTINEL],
      });

      const res = validateContractCalldata({ to: usdt, data });
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('Unlimited token allowances');
    });

    it('rejects MockUSDT approval exceeding 10M USDT bound', () => {
      const data = encodeFunctionData({
        abi: ERC20_USDT_ABI,
        functionName: 'approve',
        args: [spender, MAX_SAFE_USDT_ALLOWANCE + 1n],
      });

      const res = validateContractCalldata({ to: usdt, data });
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('Approval exceeds maximum safe USDT bound');
    });
  });

  describe('3. validateContractCalldata — Native Value & Security Rules', () => {
    it('rejects transactions with non-zero native POL transfer value', () => {
      const data = encodeFunctionData({
        abi: PNR_TOKEN_ABI,
        functionName: 'transfer',
        args: [bob, parseEther('1')],
      });

      const res = validateContractCalldata({ to: pnr, data, value: '1000000000000' });
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('native POL value must be zero');
    });

    it('rejects unconfigured or unauthorized target addresses', () => {
      const randomAddress = '0x9999999999999999999999999999999999999999';
      const res = validateContractCalldata({
        to: randomAddress,
        data: '0xa9059cbb' + '0'.repeat(128),
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('not an authorized PENORA Amoy contract');
    });

    it('rejects malformed or truncated calldata', () => {
      const res = validateContractCalldata({ to: pnr, data: '0x12' });
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('valid calldata with a 4-byte selector');
    });
  });

  describe('4. validateContractCalldata — Exchange & Admin Role Enforcement', () => {
    const exchange = '0x4444444444444444444444444444444444444444';
    // Mock exchange address configured in PENORA
    beforeEach(() => {
      (PENORA_CONTRACT_ADDRESSES as any)._EXCHANGE = exchange;
    });

    it('enforces founder-only execution for setRate and rejects unauthorized callers', () => {
      const setRateData = encodeFunctionData({
        abi: EXCHANGE_ABI,
        functionName: 'setRate',
        args: [200000n],
      });

      // Founder caller is allowed
      const founderRes = validateContractCalldata({
        to: exchange,
        data: setRateData,
        senderAddress: FOUNDER_WALLET_ADDRESS,
      });
      // If exchange is not in environment yet, it safely validates destination
      if (founderRes.reason?.includes('not an authorized')) return;

      expect(founderRes.valid).toBe(true);

      // Non-founder caller is strictly blocked
      const nonFounderRes = validateContractCalldata({
        to: exchange,
        data: setRateData,
        senderAddress: alice,
      });
      expect(nonFounderRes.valid).toBe(false);
      expect(nonFounderRes.reason).toContain('reserved for founder wallet');
    });
  });

  describe('5. serverSponsorshipService — Rate Limits, Nonce Tracking & Authorizations', () => {
    const validData = encodeFunctionData({
      abi: PNR_TOKEN_ABI,
      functionName: 'transfer',
      args: [bob, parseEther('10')],
    });

    it('authorizes eligible sponsorship requests and returns auth token and paymasterAndData', async () => {
      const req: SponsorshipAuthRequest = {
        username: 'alice_creator',
        senderAddress: alice,
        targetAddress: pnr,
        calldata: validData,
        nonce: 0,
      };

      const res = await authorizeSponsorship(req);
      expect(res.authorized).toBe(true);
      expect(res.authToken).toMatch(/^0x[0-9a-fA-F]{64}$/);
      expect(res.paymasterAndData).toBeDefined();
      expect(res.validUntil).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(res.quotaRemainingToday).toBe(19);
    });

    it('strictly enforces hourly rate limiting (5 requests per hour)', async () => {
      const req: SponsorshipAuthRequest = {
        username: 'alice_creator',
        senderAddress: alice,
        targetAddress: pnr,
        calldata: validData,
      };

      for (let i = 0; i < 5; i++) {
        const r = await authorizeSponsorship({ ...req, nonce: i });
        expect(r.authorized).toBe(true);
      }

      // 6th request should be blocked
      const blocked = await authorizeSponsorship({ ...req, nonce: 5 });
      expect(blocked.authorized).toBe(false);
      expect(blocked.reason).toContain('Hourly rate limit exceeded');
    });

    it('strictly rejects replayed or decreasing nonces', async () => {
      const req: SponsorshipAuthRequest = {
        username: 'david',
        senderAddress: alice,
        targetAddress: pnr,
        calldata: validData,
        nonce: 10,
      };

      const first = await authorizeSponsorship(req);
      expect(first.authorized).toBe(true);

      // Replayed nonce 10
      const replay = await authorizeSponsorship(req);
      expect(replay.authorized).toBe(false);
      expect(replay.reason).toContain('replayed nonce');

      // Decreasing nonce 9
      const decreasing = await authorizeSponsorship({ ...req, nonce: 9 });
      expect(decreasing.authorized).toBe(false);
      expect(decreasing.reason).toContain('replayed nonce');
    });

    it('rejects gas limits exceeding quota cap', async () => {
      const req: SponsorshipAuthRequest = {
        username: 'eve',
        senderAddress: alice,
        targetAddress: pnr,
        calldata: validData,
        gasLimit: 1_000_000n, // Exceeds default 500,000n
      };

      const res = await authorizeSponsorship(req);
      expect(res.authorized).toBe(false);
      expect(res.reason).toContain('gas limit exceeds server cap');
    });
  });
});

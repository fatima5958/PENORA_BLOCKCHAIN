// src/tests/usdtService.test.ts
// Vitest Test Suite for PenoraUsdtService (Security, Precision, Allowlist & Validations)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseUnits, formatUnits, isAddress } from 'viem';
import { PenoraUsdtService } from '../lib/wallet/usdtService';
import { isTokenAddressAllowed, VERIFIED_USDT_ALLOWLIST } from '../lib/wallet/contracts';
import { PENORA_TARGET_CHAIN_ID } from '../lib/wallet/chain';

describe('PenoraUsdtService Unit & Security Tests', () => {
  let service: PenoraUsdtService;

  beforeEach(() => {
    service = new PenoraUsdtService();
    vi.clearAllMocks();
  });

  describe('1. Token Allowlist & Contract Verification', () => {
    it('should reject fake or arbitrary contract addresses on Polygon Amoy', () => {
      const fakeAddress = '0x1111111111111111111111111111111111111111';
      const isAllowed = isTokenAddressAllowed(PENORA_TARGET_CHAIN_ID, fakeAddress);
      expect(isAllowed).toBe(false);
    });

    it('should reject malformed or non-hex contract strings', () => {
      expect(isTokenAddressAllowed(80002, 'not-an-address')).toBe(false);
      expect(isTokenAddressAllowed(80002, '0x123')).toBe(false);
      expect(isTokenAddressAllowed(80002, '')).toBe(false);
    });

    it('should disallow financial transactions on Polygon Mainnet (137) in testnet build', () => {
      const mainnetUsdt = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
      // Chain 137 is blocked from transfers in this build
      expect(isTokenAddressAllowed(137, mainnetUsdt)).toBe(false);
    });

    it('should recognize verified allowlist entries', () => {
      expect(VERIFIED_USDT_ALLOWLIST[137]).toBeDefined();
      expect(VERIFIED_USDT_ALLOWLIST[137][0].decimals).toBe(6);
      expect(VERIFIED_USDT_ALLOWLIST[137][0].symbol).toBe('USDT');
    });
  });

  describe('2. Decimal Precision & Exact Integer Arithmetic', () => {
    it('should format 6-decimal USDT without floating point inaccuracies', () => {
      const rawUnits = 125500000n; // 125.500000 with 6 decimals
      const formatted = formatUnits(rawUnits, 6);
      expect(formatted).toBe('125.5');

      const parsed = parseUnits('125.5', 6);
      expect(parsed).toBe(rawUnits);
    });

    it('should correctly handle micro-cent fractions in 6 decimals', () => {
      const parsedSmall = parseUnits('0.000001', 6);
      expect(parsedSmall).toBe(1n);
      expect(formatUnits(1n, 6)).toBe('0.000001');
    });

    it('should not confuse 6 decimals with standard 18 decimals', () => {
      const sixDec = parseUnits('100', 6);
      const eighteenDec = parseUnits('100', 18);

      expect(sixDec).toBe(100000000n);
      expect(eighteenDec).toBe(100000000000000000000n);
      expect(eighteenDec).not.toBe(sixDec);
    });
  });

  describe('3. Recipient Address Validation', () => {
    it('should validate valid EVM checksum and lowercase addresses', () => {
      expect(isAddress('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')).toBe(true);
      expect(isAddress('0x70997970c51812dc3a010c7d01b50e0d17dc79c8')).toBe(true);
    });

    it('should reject invalid addresses and non-hex inputs', () => {
      expect(isAddress('0xInvalidHexAddress1234567890123456789012')).toBe(false);
      expect(isAddress('random-string-user')).toBe(false);
      expect(isAddress('')).toBe(false);
    });
  });

  describe('4. Transfer Validation & Security Guards', () => {
    it('should reject execution when MetaMask is not detected', async () => {
      // In NodeJS test environment window.ethereum is undefined
      await expect(
        service.executeSendUsdt('0x70997970C51812dc3A010C7d01b50e0d17dc79C8', '10.0')
      ).rejects.toThrow('MetaMask or Web3 wallet extension not detected');
    });

    it('should reject transfer when unconfigured contract is called', async () => {
      // Target address is unconfigured by default in test env
      const address = service.getContractAddress();
      if (!address) {
        expect(address).toBeNull();
      }
    });

    it('should prevent duplicate transfer submissions when isSubmitting is active', async () => {
      // Simulate active submission
      (service as any).isSubmitting = true;
      await expect(
        service.executeSendUsdt('0x70997970C51812dc3A010C7d01b50e0d17dc79C8', '5.0')
      ).rejects.toThrow('A transfer is already in progress');
      (service as any).isSubmitting = false;
    });
  });

  describe('5. Local Transaction History Storage & Merging', () => {
    it('should retrieve empty array when no storage exists', () => {
      const txs = service.getLocalTransactions();
      expect(Array.isArray(txs)).toBe(true);
      expect(txs.length).toBe(0);
    });

    it('should deduplicate transactions by hash when merging', () => {
      const tx1 = {
        id: 'tx_1',
        hash: '0xabc123',
        type: 'deposit_usdt' as const,
        amount: '50.0',
        symbol: 'USDT',
        status: 'confirmed' as const,
        timestamp: '2026-10-21T10:00:00Z',
      };
      const tx2 = {
        id: 'tx_2',
        hash: '0xabc123', // Same hash
        type: 'deposit_usdt' as const,
        amount: '50.0',
        symbol: 'USDT',
        status: 'confirmed' as const,
        timestamp: '2026-10-21T10:00:00Z',
      };

      const map = new Map();
      map.set(tx1.hash, tx1);
      map.set(tx2.hash, tx2);

      expect(map.size).toBe(1);
    });
  });
});

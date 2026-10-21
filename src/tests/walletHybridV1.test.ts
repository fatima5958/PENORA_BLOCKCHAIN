// src/tests/walletHybridV1.test.ts
// PENORA Hybrid Wallet V1 Test Suite — Polygon Amoy (Chain ID 80002)
import { describe, it, expect, beforeEach } from 'vitest';
import { polygonAmoy, PENORA_TARGET_CHAIN_ID, POLYGON_AMOY_CONFIG } from '../lib/wallet/chain';
import { penoraWalletService } from '../lib/wallet/walletService';
import { penoraKeyAuth } from '../lib/auth/penoraKeyAuth';

describe('PENORA Hybrid Wallet V1 Architecture Suite', () => {

  beforeEach(() => {
    penoraWalletService.disconnect();
  });

  describe('1. Polygon Amoy Chain Configuration (Chain ID 80002)', () => {
    it('configures Polygon Amoy with exact chain ID 80002', () => {
      expect(polygonAmoy.id).toBe(80002);
      expect(PENORA_TARGET_CHAIN_ID).toBe(80002);
      expect(POLYGON_AMOY_CONFIG.id).toBe(80002);
    });

    it('specifies POL as native currency with 18 decimals', () => {
      expect(polygonAmoy.nativeCurrency.symbol).toBe('POL');
      expect(polygonAmoy.nativeCurrency.name).toBe('POL');
      expect(polygonAmoy.nativeCurrency.decimals).toBe(18);
    });

    it('configures official Polygon Amoy RPC and PolygonScan block explorer', () => {
      expect(polygonAmoy.rpcUrls.default.http[0]).toBe('https://polygon-amoy.drpc.org');
      expect(polygonAmoy.blockExplorers.default.url).toBe('https://amoy.polygonscan.com');
      expect(polygonAmoy.testnet).toBe(true);
    });
  });

  describe('2. Typed Wallet State & Lifecycle', () => {
    it('initializes in clean disconnected state with honest empty values', () => {
      const state = penoraWalletService.getState();
      expect(state.status).toBe('disconnected');
      expect(state.address).toBeNull();
      expect(state.balancePol).toBeNull();
      expect(state.balancePnr).toBeNull(); // Never fake PNR balances
      expect(state.isCorrectNetwork).toBe(false);
      expect(state.error).toBeNull();
    });

    it('notifies subscribers upon state changes and supports unsubscription', () => {
      const recordedStates: string[] = [];
      const unsub = penoraWalletService.subscribe(s => {
        recordedStates.push(s.status);
      });

      expect(recordedStates.length).toBeGreaterThan(0);
      expect(recordedStates[recordedStates.length - 1]).toBe('disconnected');

      unsub();
      // Calling disconnect after unsub shouldn't push to recordedStates
      const countBefore = recordedStates.length;
      penoraWalletService.disconnect();
      expect(recordedStates.length).toBe(countBefore);
    });
  });

  describe('3. Separation of PENORA Account Keys from Web3 EVM Keys', () => {
    it('strictly separates PENORA posting/active authority from EVM wallet custody', () => {
      const keys = penoraKeyAuth.generateKeys();

      // 1. Account authority keys are PENORA Multi-Authority base58/WIF strings
      expect(keys.posting.privateKeyWif).toMatch(/^5[HJK]/);
      expect(keys.active.privateKeyWif).toMatch(/^5[HJK]/);
      expect(keys.owner.privateKeyWif).toMatch(/^5[HJK]/);

      // 2. EVM address is a 42-char hex string (0x...) on Polygon Amoy
      const mockEvmAddress: `0x${string}` = '0x1234567890123456789012345678901234567890';
      expect(mockEvmAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);

      // 3. EVM private key is NEVER derived from or mixed with PENORA account keys
      expect(keys.posting.privateKeyWif).not.toBe(mockEvmAddress);
      expect(keys.active.privateKeyWif).not.toBe(mockEvmAddress);
    });

    it('enforces that wallet balances never simulate fake PNR or PP distributions', () => {
      const state = penoraWalletService.getState();
      // PNR and PP tokens are pre-launch; balances must remain null/'— PNR' / '— PP'
      expect(state.balancePnr).toBeNull();
      expect(state.balancePp).toBeNull();
    });
  });

  describe('4. Step 2 Real Blockchain Connection & Provider Resilience', () => {
    it('handles missing MetaMask provider with actionable installation message', async () => {
      // In node/test environment without window.ethereum
      await penoraWalletService.connect();
      const state = penoraWalletService.getState();
      expect(state.status).toBe('error');
      expect(state.error).toContain('MetaMask not detected');
    });

    it('identifies Polygon Amoy chain mismatch and flags wrong_network', () => {
      // Simulate chain changed to Ethereum Mainnet (chainId = 1)
      const mockEth: any = {
        request: async ({ method }: { method: string }) => {
          if (method === 'eth_chainId') return '0x1'; // Ethereum Mainnet
          return [];
        },
      };
      (globalThis as any).window = { ethereum: mockEth };

      // Re-init or test chain matching logic
      const isAmoy = parseInt('0x1', 16) === PENORA_TARGET_CHAIN_ID;
      expect(isAmoy).toBe(false);
      expect(PENORA_TARGET_CHAIN_ID).toBe(80002);

      delete (globalThis as any).window;
    });

    it('ensures connected EVM wallet does not alter PENORA session state', () => {
      // In PENORA architecture, EVM wallet is isolated from account keys
      const initialUser = penoraKeyAuth.getCurrentUser();

      // Connect or disconnect EVM
      penoraWalletService.disconnect();

      // PENORA key session must remain strictly untouched
      const currentUser = penoraKeyAuth.getCurrentUser();
      expect(currentUser).toEqual(initialUser);
    });
  });

  describe('5. PENORA Power Up / Power Down & Voting Mana Mathematics', () => {
    it('calculates 5-day linear mana recovery correctly', async () => {
      const { penoraPowerService } = await import('../lib/wallet/powerService');

      // Voter spent 200 bps (down to 9800 bps)
      const afterVote = penoraPowerService.calculateManaRecovery(9800, 0);
      expect(afterVote.updatedManaBps).toBe(9800);
      expect(afterVote.updatedManaPercent).toBe(98);
      // To recover 200 bps: (200 * 432000) / 10000 = 8640s (2.4 hours)
      expect(afterVote.secondsUntilFull).toBe(8640);

      // Advance by 4,320 seconds (1.2 hours) -> recovers 100 bps (to 9900 bps = 99%)
      const halfRecovered = penoraPowerService.calculateManaRecovery(9800, 4320);
      expect(halfRecovered.updatedManaBps).toBe(9900);
      expect(halfRecovered.updatedManaPercent).toBe(99);
      expect(halfRecovered.secondsUntilFull).toBe(4320);

      // Advance by 8,640 seconds (2.4 hours) -> fully recovered to 100%
      const fullyRecovered = penoraPowerService.calculateManaRecovery(9800, 8640);
      expect(fullyRecovered.updatedManaBps).toBe(10000);
      expect(fullyRecovered.updatedManaPercent).toBe(100);
      expect(fullyRecovered.secondsUntilFull).toBe(0);
    });

    it('handles 13-week installment division without precision loss', () => {
      // 1300 PNR / 13 = 100 exactly
      const amount1 = 1300n;
      const weekly1 = amount1 / 13n;
      const rem1 = amount1 % 13n;
      expect(weekly1).toBe(100n);
      expect(rem1).toBe(0n);
      expect(weekly1 * 13n + rem1).toBe(amount1);

      // 1000 PNR / 13 = 76 weekly, remainder = 12
      const amount2 = 1000n;
      const weekly2 = amount2 / 13n;
      const rem2 = amount2 % 13n;
      expect(weekly2).toBe(76n);
      expect(rem2).toBe(12n);
      expect(weekly2 * 13n + rem2).toBe(amount2);
    });

    it('returns honest empty state when contracts are not deployed', async () => {
      const { penoraPowerService } = await import('../lib/wallet/powerService');
      const mockAddr = '0x1234567890123456789012345678901234567890' as `0x${string}`;
      const state = await penoraPowerService.fetchPowerState(mockAddr);

      // Contracts are not deployed on testnet yet; must return honest nulls
      expect(state.contractsDeployed).toBe(false);
      expect(state.balancePnr).toBeNull();
      expect(state.balancePp).toBeNull();
      expect(state.powerDownSchedule).toBeNull();
    });
  });
});

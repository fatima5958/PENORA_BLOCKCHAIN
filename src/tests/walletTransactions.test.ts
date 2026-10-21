import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { decodeFunctionData, encodeEventTopics, encodeAbiParameters } from 'viem';
import { parseTokenAmount } from '../lib/wallet/amount';

const mocks = vi.hoisted(() => ({
  request: vi.fn(), readContract: vi.fn(), waitForTransactionReceipt: vi.fn(),
  getBalance: vi.fn(), getBlockNumber: vi.fn(), getLogs: vi.fn(),
}));
vi.mock('../lib/wallet/walletService', () => ({
  getEthereumProvider: () => ({ request: mocks.request }),
  publicClient: mocks,
}));
vi.mock('../lib/wallet/contracts', async importOriginal => {
  const original = await importOriginal<any>();
  return {
    ...original,
    PENORA_CONTRACT_ADDRESSES: {
      ...original.PENORA_CONTRACT_ADDRESSES,
      PNR_TOKEN: '0x1111111111111111111111111111111111111111',
      POWER_ESCROW: '0x2222222222222222222222222222222222222222',
      USDT_TOKEN: '0x3333333333333333333333333333333333333333',
    },
    areContractsConfigured: () => true,
    isUsdtConfigured: () => true,
    isTokenAddressAllowed: () => true,
  };
});
import { PenoraPowerService } from '../lib/wallet/powerService';
import { PenoraUsdtService } from '../lib/wallet/usdtService';
import { PNR_TOKEN_ABI, POWER_ESCROW_ABI, ERC20_USDT_ABI } from '../lib/wallet/contracts';

const owner = '0x4444444444444444444444444444444444444444';
const recipient = '0x5555555555555555555555555555555555555555';
const hash = `0x${'a'.repeat(64)}` as `0x${string}`;

beforeEach(() => {
  vi.resetAllMocks();
  let allowance = 0n;
  let transfer: { address: string; recipient: string; amount: bigint } | null = null;
  mocks.request.mockImplementation(async ({ method, params }) => {
    if (method === 'eth_accounts') return [owner];
    if (method === 'eth_chainId') return '0x13882';
    if (method === 'eth_sendTransaction') {
      const tx = params[0];
      let decoded;
      try { decoded = decodeFunctionData({ abi: ERC20_USDT_ABI, data: tx.data }); } catch { return hash; }
      if (decoded.functionName === 'approve') allowance = decoded.args[1] as bigint;
      if (decoded.functionName === 'transfer') transfer = { address: tx.to, recipient: decoded.args[0] as string, amount: decoded.args[1] as bigint };
      return hash;
    }
  });
  mocks.readContract.mockImplementation(async ({ functionName }) => {
    if (functionName === 'decimals') return 6;
    if (functionName === 'balanceOf') return 100000000n;
    if (functionName === 'allowance') return allowance;
    return 0n;
  });
  mocks.getBalance.mockResolvedValue(1000000000000000000n);
  mocks.waitForTransactionReceipt.mockImplementation(async () => ({ status: 'success', transactionHash: hash,
    logs: transfer ? [{ address: transfer.address,
      topics: encodeEventTopics({ abi: ERC20_USDT_ABI, eventName: 'Transfer', args: { from: owner, to: transfer.recipient as `0x${string}` } }),
      data: encodeAbiParameters([{ type: 'uint256' }], [transfer.amount]),
    }] : [],
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('Exact token amounts', () => {
  it.each(['1e3', '1,000', 'NaN', 'Infinity', '-2', '0', '1.0000001', '0.0000001'])('rejects unsafe amount %s', value => {
    expect(() => parseTokenAmount(value, 6)).toThrow();
  });
  it('preserves large balances and smallest transferable units', () => {
    expect(parseTokenAmount('9007199254740993.000001', 6)).toBe(9007199254740993000001n);
    expect(parseTokenAmount('0.000001', 6)).toBe(1n);
  });
});

describe('Power transaction lifecycle', () => {
  it.each(['executePowerUp', 'executeStartPowerDown', 'executeClaimInstallments', 'executeCancelPowerDown'] as const)('blocks %s on mainnet', async method => {
    mocks.request.mockImplementation(async ({ method }) => method === 'eth_accounts' ? [owner] : '0x89');
    await expect(new PenoraPowerService()[method]('1')).rejects.toThrow('Polygon Amoy');
    expect(mocks.request.mock.calls.some(([args]) => args.method === 'eth_sendTransaction')).toBe(false);
  });
  it('waits for approval confirmation before requesting staking', async () => {
    let confirm!: (value: any) => void;
    mocks.waitForTransactionReceipt.mockImplementationOnce(() => new Promise(resolve => { confirm = resolve; }));
    const service = new PenoraPowerService();
    const action = service.executePowerUp('1');
    await vi.waitFor(() => expect(confirm).toBeTypeOf('function'));
    const sends = () => mocks.request.mock.calls.filter(([args]) => args.method === 'eth_sendTransaction');
    expect(sends()).toHaveLength(1);
    expect(decodeFunctionData({ abi: PNR_TOKEN_ABI, data: sends()[0][0].params[0].data }).functionName).toBe('approve');
    await expect(service.executeStartPowerDown('1')).rejects.toThrow('already in progress');
    confirm({ status: 'success' });
    await expect(action).resolves.toBe(hash);
    expect(sends()).toHaveLength(2);
    expect(decodeFunctionData({ abi: POWER_ESCROW_ABI, data: sends()[1][0].params[0].data }).functionName).toBe('powerUp');
  });
  it('does not stake after reverted approval', async () => {
    mocks.waitForTransactionReceipt.mockResolvedValueOnce({ status: 'reverted' });
    await expect(new PenoraPowerService().executePowerUp('1')).rejects.toThrow('reverted');
    expect(mocks.request.mock.calls.filter(([args]) => args.method === 'eth_sendTransaction')).toHaveLength(1);
  });
  it('rejects an account switch between approval and staking', async () => {
    mocks.waitForTransactionReceipt.mockImplementationOnce(async () => {
      mocks.request.mockImplementation(async ({ method }) => method === 'eth_accounts' ? [recipient] : '0x13882');
      return { status: 'success' };
    });
    await expect(new PenoraPowerService().executePowerUp('1')).rejects.toThrow('account changed');
  });
});

describe('USDT lifecycle', () => {
  it('keeps a broadcast transfer pending when confirmation times out', async () => {
    mocks.waitForTransactionReceipt.mockRejectedValue(new Error('timeout'));
    const result = await new PenoraUsdtService().executeSendUsdt(recipient, '1');
    expect(result.status).toBe('pending');
    expect(result.hash).toBe(hash);
  });
  it('reports a reverted receipt as failed', async () => {
    mocks.waitForTransactionReceipt.mockResolvedValue({ status: 'reverted' });
    expect((await new PenoraUsdtService().executeSendUsdt(recipient, '1')).status).toBe('failed');
  });
  it('fails closed when decimals cannot be read', async () => {
    mocks.readContract.mockRejectedValue(new Error('RPC unavailable'));
    await expect(new PenoraUsdtService().executeSendUsdt(recipient, '1')).rejects.toThrow('verify USDT decimals');
    expect(mocks.request.mock.calls.some(([args]) => args.method === 'eth_sendTransaction')).toBe(false);
  });
  it('locks submissions before the first async provider call', async () => {
    let resume!: (value: any) => void;
    mocks.request.mockImplementationOnce(() => new Promise(resolve => { resume = resolve; }));
    const service = new PenoraUsdtService();
    const first = service.executeSendUsdt(recipient, '1');
    await expect(service.executeSendUsdt(recipient, '1')).rejects.toThrow('already in progress');
    resume([owner]);
    await first;
  });
  it('stores incoming deposits for the receiving wallet', () => {
    const entries = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value) });
    const service = new PenoraUsdtService();
    service.recordLocalTransaction({ id: 'deposit', hash, type: 'deposit_usdt', amount: '2', symbol: 'USDT', status: 'confirmed', timestamp: new Date().toISOString(), from: recipient, to: owner });
    expect(service.getLocalTransactions(owner)).toHaveLength(1);
    expect(service.getLocalTransactions(recipient)).toHaveLength(0);
  });
});

describe('PNR ERC-20 deposits and transfers', () => {
  it('sends exact 18-decimal PNR units to the configured PNR contract', async () => {
    mocks.readContract.mockImplementation(async ({ functionName }) => functionName === 'decimals' ? 18 : 10000000000000000000n);
    const result = await new PenoraUsdtService('PNR').executeSendUsdt(recipient, '1.000000000000000001');
    expect(result.status).toBe('confirmed');
    const send = mocks.request.mock.calls.find(([args]) => args.method === 'eth_sendTransaction')![0].params[0];
    expect(send.to).toBe('0x1111111111111111111111111111111111111111');
    const { ERC20_USDT_ABI } = await import('../lib/wallet/contracts');
    expect(decodeFunctionData({ abi: ERC20_USDT_ABI, data: send.data }).args).toEqual([recipient, 1000000000000000001n]);
  });
  it('rejects a contract override that does not match configured PNR', async () => {
    await expect(new PenoraUsdtService('PNR').executeSendUsdt(recipient, '1', recipient)).rejects.toThrow('allowlist');
  });
  it('keeps incoming PNR history separate from USDT', () => {
    const entries = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value) });
    const service = new PenoraUsdtService('PNR');
    service.recordLocalTransaction({ id: 'pnr-deposit', hash, type: 'transfer_in', amount: '3', symbol: 'PNR', status: 'confirmed', timestamp: new Date().toISOString(), from: recipient, to: owner });
    expect(service.getLocalTransactions(owner)[0].symbol).toBe('PNR');
    expect(new PenoraUsdtService().getLocalTransactions(owner)).toHaveLength(0);
  });
  it('uses the actual block time in deposit history', async () => {
    mocks.getBlockNumber.mockResolvedValue(5n);
    mocks.getLogs.mockResolvedValueOnce([{ args: { value: 1000000n, from: recipient }, transactionHash: hash, logIndex: 0, blockNumber: 4n }]).mockResolvedValueOnce([]);
    (mocks as any).getBlock = vi.fn().mockResolvedValue({ timestamp: 1700000000n });
    const txs = await new PenoraUsdtService().fetchTransferLogs(owner);
    expect(txs[0].timestamp).toBe('2023-11-14T22:13:20.000Z');
    expect(txs[0].amount).toBe('1');
  });
});


describe('Receipt replacement and actual token movement', () => {
  it('does not treat a successful wallet cancellation as a transfer', async () => {
    mocks.waitForTransactionReceipt.mockImplementation(async ({ onReplaced }) => {
      onReplaced({ reason: 'cancelled', transaction: { hash }, transactionReceipt: { status: 'success' } });
      return { status: 'success', transactionHash: hash, logs: [] };
    });
    expect((await new PenoraUsdtService().executeSendUsdt(recipient, '1')).status).toBe('failed');
  });
  it('never continues staking after an approval was cancelled', async () => {
    mocks.waitForTransactionReceipt.mockImplementation(async ({ onReplaced }) => {
      onReplaced({ reason: 'cancelled', transaction: { hash } });
      return { status: 'success', transactionHash: hash };
    });
    await expect(new PenoraPowerService().executePowerUp('1')).rejects.toThrow('cancelled');
    expect(mocks.request.mock.calls.filter(([a]) => a.method === 'eth_sendTransaction')).toHaveLength(1);
  });
  it('does not claim success when ERC-20 transfer returns false without a Transfer event', async () => {
    mocks.waitForTransactionReceipt.mockResolvedValue({ status: 'success', transactionHash: hash, logs: [] });
    expect((await new PenoraUsdtService().executeSendUsdt(recipient, '1')).status).toBe('failed');
  });
  it('uses the confirmed replacement hash for a repriced transfer', async () => {
    const nextHash = `0x${'b'.repeat(64)}` as `0x${string}`;
    const original = mocks.waitForTransactionReceipt.getMockImplementation()!;
    mocks.waitForTransactionReceipt.mockImplementation(async (args) => {
      args.onReplaced({ reason: 'repriced', transaction: { hash: nextHash } });
      return { ...await original(args), transactionHash: nextHash };
    });
    const result = await new PenoraUsdtService().executeSendUsdt(recipient, '1');
    expect(result.status).toBe('confirmed');
    expect(result.hash).toBe(nextHash);
    expect(result.explorerUrl).toContain(nextHash);
  });
  it('rejects a different account from the reviewed transfer before any signature', async () => {
    await expect(new PenoraUsdtService().executeSendUsdt(recipient, '1', undefined, recipient)).rejects.toThrow('account changed');
    expect(mocks.request.mock.calls.some(([a]) => a.method === 'eth_sendTransaction')).toBe(false);
  });
  it('shows only voting power still available outside the power-down schedule', async () => {
    mocks.readContract.mockImplementation(async ({ functionName }) => {
      if (functionName === 'balanceOf') return 10n ** 18n;
      if (functionName === 'getAvailablePower') return 80n * 10n ** 18n;
      if (functionName === 'lockedPower') return 100n * 10n ** 18n;
      if (functionName === 'powerDownSchedules') return [0n, 0n, 0n, 0n, 0n, false];
    });
    const state = await new PenoraPowerService().fetchPowerState(owner);
    expect(state.balancePp).toBe('80');
    expect(state.votingManaPercent).toBeNull();
  });
});

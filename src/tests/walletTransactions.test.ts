import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { decodeFunctionData, encodeEventTopics, encodeAbiParameters, parseAbi } from 'viem';
import { parseTokenAmount, previewPowerDown, isSpendableAmount } from '../lib/wallet/amount';

const mocks = vi.hoisted(() => ({
  request: vi.fn(), readContract: vi.fn(), waitForTransactionReceipt: vi.fn(),
  getBalance: vi.fn(), getBlockNumber: vi.fn(), getLogs: vi.fn(), getTransactionReceipt: vi.fn(), estimateGas: vi.fn(), estimateFeesPerGas: vi.fn(),
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
import { PNR_TOKEN_ABI, POWER_ESCROW_ABI, ERC20_USDT_ABI, PENORA_CONTRACT_ADDRESSES } from '../lib/wallet/contracts';

const owner = '0x4444444444444444444444444444444444444444';
const recipient = '0x5555555555555555555555555555555555555555';
const hash = `0x${'a'.repeat(64)}` as `0x${string}`;
const approvalLog = (amount: bigint) => ({
  address: '0x1111111111111111111111111111111111111111',
  topics: encodeEventTopics({ abi: ERC20_USDT_ABI, eventName: 'Approval', args: { owner, spender: '0x2222222222222222222222222222222222222222' } }),
  data: encodeAbiParameters([{ type: 'uint256' }], [amount]),
});

beforeEach(() => {
  vi.resetAllMocks();
  let allowance = 0n;
  let transfer: { address: string; recipient: string; amount: bigint } | null = null;
  let powerAction: { address: string; amount: bigint } | null = null;
  let approval: { address: string; spender: string; amount: bigint } | null = null;
  mocks.request.mockImplementation(async ({ method, params }) => {
    if (method === 'eth_accounts') return [owner];
    if (method === 'eth_chainId') return '0x13882';
    if (method === 'eth_sendTransaction') {
      const tx = params[0];
      let decoded;
      try { decoded = decodeFunctionData({ abi: ERC20_USDT_ABI, data: tx.data }); }
      catch {
        const power = decodeFunctionData({ abi: POWER_ESCROW_ABI, data: tx.data });
        if (power.functionName === 'powerUp') powerAction = { address: tx.to, amount: power.args[0] };
        return hash;
      }
      if (decoded.functionName === 'approve') { allowance = decoded.args[1] as bigint; approval = { address: tx.to, spender: decoded.args[0] as string, amount: allowance }; }
      if (decoded.functionName === 'transfer') transfer = { address: tx.to, recipient: decoded.args[0] as string, amount: decoded.args[1] as bigint };
      return hash;
    }
  });
  mocks.readContract.mockImplementation(async ({ functionName, address }) => {
    if (functionName === 'decimals') return address === '0x1111111111111111111111111111111111111111' ? 18 : 6;
    if (functionName === 'pnrToken') return '0x1111111111111111111111111111111111111111';
    if (functionName === 'paused') return false;
    if (functionName === 'balanceOf') return address === '0x1111111111111111111111111111111111111111' ? 100n * 10n ** 18n : 100000000n;
    if (functionName === 'allowance') return allowance;
    return 0n;
  });
  mocks.getBalance.mockResolvedValue(1000000000000000000n);
  mocks.estimateGas.mockResolvedValue(50000n);
  mocks.estimateFeesPerGas.mockResolvedValue({ maxFeePerGas: 30000000000n });
  mocks.waitForTransactionReceipt.mockImplementation(async () => ({ status: 'success', transactionHash: hash,
    logs: powerAction ? [{ address: powerAction.address,
      topics: encodeEventTopics({ abi: parseAbi(['event PowerUp(address indexed caller, address indexed recipient, uint256 amount, uint256 timestamp)']), eventName: 'PowerUp', args: { caller: owner, recipient: owner } }),
      data: encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [powerAction.amount, 1700000000n]),
    }] : approval ? [approvalLog(approval.amount)] : transfer ? [{ address: transfer.address,
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
    confirm({ status: 'success', logs: [approvalLog(10n ** 18n)] });
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
      return { status: 'success', logs: [approvalLog(10n ** 18n)] };
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
      if (functionName === 'decimals') return 18;
      if (functionName === 'pnrToken') return '0x1111111111111111111111111111111111111111';
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


describe('Wallet audit regressions', () => {
  it('rejects uint256 overflow while preserving the maximum valid amount', () => {
    const maximum = (2n ** 256n - 1n).toString();
    expect(parseTokenAmount(maximum, 0)).toBe(2n ** 256n - 1n);
    expect(() => parseTokenAmount((2n ** 256n).toString(), 0)).toThrow('range');
  });
  it('uses exact units for balance validation and final Power Down installment', () => {
    expect(isSpendableAmount('9007199254740993.000002', '9007199254740993.000001', 6)).toBe(false);
    expect(isSpendableAmount('1', null, 18)).toBe(false);
    expect(previewPowerDown('0.000000000000000014')).toEqual({ weekly: '0.000000000000000001', final: '0.000000000000000002' });
    expect(previewPowerDown('1e3')).toBeNull();
  });
  it('blocks staking when the reviewed wallet differs before any signature', async () => {
    await expect(new PenoraPowerService().executePowerUp('1', recipient)).rejects.toThrow('account changed');
    expect(mocks.request.mock.calls.some(([args]) => args.method === 'eth_sendTransaction')).toBe(false);
  });
  it('keeps multiple transfer events in one transaction and deduplicates a self-transfer log', async () => {
    mocks.getBlockNumber.mockResolvedValue(5n);
    const log = { args: { value: 1000000n, from: owner, to: owner }, transactionHash: hash, logIndex: 0, blockNumber: 4n };
    mocks.getLogs.mockResolvedValueOnce([log, { ...log, logIndex: 1, args: { ...log.args, value: 2000000n } }]).mockResolvedValueOnce([log]);
    (mocks as any).getBlock = vi.fn().mockResolvedValue({ timestamp: 1700000000n });
    const transactions = await new PenoraUsdtService().fetchTransferLogs(owner);
    expect(transactions).toHaveLength(2);
    expect(transactions.map(tx => tx.amount).sort()).toEqual(['1', '2']);
  });
  it('reports failed history lookups instead of implying the account has no transactions', async () => {
    mocks.getBlockNumber.mockRejectedValue(new Error('RPC unavailable'));
    const report = vi.fn();
    expect(await new PenoraUsdtService().fetchTransferLogs(owner, undefined, report)).toEqual([]);
    expect(report).toHaveBeenCalledWith(expect.stringContaining('history is unavailable'));
  });
  it('paginates recent log lookups within public RPC range limits', async () => {
    const { readRecentEvents } = await import('../lib/wallet/history');
    mocks.getLogs.mockResolvedValue([]);
    const event = ERC20_USDT_ABI.find(item => item.type === 'event' && item.name === 'Transfer')!;
    await readRecentEvents(owner, event, { to: owner }, 11000n);
    expect(mocks.getLogs).toHaveBeenCalledTimes(11);
    for (const [request] of mocks.getLogs.mock.calls) expect(request.toBlock - request.fromBlock).toBeLessThan(1000n);
    expect(mocks.getLogs.mock.calls[0][0].fromBlock).toBe(1000n);
    expect(mocks.getLogs.mock.calls.at(-1)![0].toBlock).toBe(11000n);
  });
});


describe('Verified staking outcomes and durable pending actions', () => {
  const browserStore = () => {
    const entries = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value) });
  };
  it('retains a pending approval across service instances and blocks a duplicate request', async () => {
    browserStore();
    const { localPowerTransactions } = await import('../lib/wallet/powerTransactions');
    mocks.waitForTransactionReceipt.mockRejectedValue(new Error('Receipt timeout'));
    mocks.getTransactionReceipt.mockRejectedValue(new Error('Receipt not found'));
    await expect(new PenoraPowerService().executePowerUp('1', owner)).rejects.toMatchObject({ name: 'PowerTransactionPendingError', hash });
    expect(localPowerTransactions(owner)[0]).toMatchObject({ status: 'pending', type: 'approve_pnr', hash });
    await expect(new PenoraPowerService().executePowerUp('1', owner)).rejects.toThrow('still pending');
    expect(mocks.request.mock.calls.filter(([args]) => args.method === 'eth_sendTransaction')).toHaveLength(1);
  });
  it('reconciles a stored approval using its actual Approval receipt', async () => {
    browserStore();
    const { pendingPowerTransaction, reconcilePowerTransactions } = await import('../lib/wallet/powerTransactions');
    pendingPowerTransaction(owner, hash, 'approve_pnr', '1');
    mocks.getTransactionReceipt.mockResolvedValue({ status: 'success', logs: [approvalLog(10n ** 18n)] });
    expect((await reconcilePowerTransactions(owner))[0]).toMatchObject({ status: 'confirmed', amount: '1' });
  });
  it('does not label staking successful if a success receipt has no corresponding PowerUp event', async () => {
    const original = mocks.readContract.getMockImplementation()!;
    mocks.readContract.mockImplementation(args => args.functionName === 'allowance' ? 10n ** 18n : original(args));
    mocks.waitForTransactionReceipt.mockResolvedValue({ status: 'success', logs: [] });
    await expect(new PenoraPowerService().executePowerUp('1', owner)).rejects.toThrow('expected action was not confirmed');
  });
  it.each(['mismatch', 'paused', 'insufficient'] as const)('stops %s staking before approval or signature', async issue => {
    const original = mocks.readContract.getMockImplementation()!;
    mocks.readContract.mockImplementation(args => {
      if (issue === 'mismatch' && args.functionName === 'pnrToken') return recipient;
      if (issue === 'paused' && args.functionName === 'paused') return true;
      if (issue === 'insufficient' && args.functionName === 'balanceOf') return 0n;
      return original(args);
    });
    await expect(new PenoraPowerService().executePowerUp('1', owner)).rejects.toThrow();
    expect(mocks.request.mock.calls.some(([args]) => args.method === 'eth_sendTransaction')).toBe(false);
  });
  it('does not discard stake and schedules when only optional voting-mana reads fail', async () => {
    const previous = PENORA_CONTRACT_ADDRESSES.VOTING_INFLUENCE;
    (PENORA_CONTRACT_ADDRESSES as any).VOTING_INFLUENCE = recipient;
    const original = mocks.readContract.getMockImplementation()!;
    mocks.readContract.mockImplementation(args => {
      if (args.functionName === 'getCurrentMana') throw new Error('Mana unavailable');
      if (args.functionName === 'getAvailablePower') return 80n * 10n ** 18n;
      if (args.functionName === 'powerDownSchedules') return [0n, 0n, 0n, 0n, 0n, false];
      return original(args);
    });
    try {
      expect(await new PenoraPowerService().fetchPowerState(owner)).toMatchObject({ balancePp: '80', votingManaPercent: null, contractsDeployed: true });
    } finally { (PENORA_CONTRACT_ADDRESSES as any).VOTING_INFLUENCE = previous; }
  });
});

it('blocks a transfer before signing when POL is nonzero but below the estimated gas cost', async () => {
  mocks.getBalance.mockResolvedValue(1n);
  await expect(new PenoraUsdtService().executeSendUsdt(recipient, '1')).rejects.toThrow('Insufficient POL for estimated gas');
  expect(mocks.request.mock.calls.some(([args]) => args.method === 'eth_sendTransaction')).toBe(false);
});
it('fails gas estimation when the RPC cannot provide a real network fee', async () => {
  mocks.estimateFeesPerGas.mockResolvedValue({});
  await expect(new PenoraUsdtService().estimateGas(owner, recipient, '1')).rejects.toThrow('gas fees are unavailable');
});

import { createWalletClient, custom, decodeEventLog, formatUnits, parseAbi, parseAbiItem, type Address, type Hash } from 'viem';
import { publicClient, penoraWalletService, getEthereumProvider } from '../wallet/walletService';
import { PENORA_CONTRACT_ADDRESSES, isConfiguredAddress } from '../wallet/contracts';
import { polygonAmoy } from '../wallet/chain';
import { parseTokenAmount } from '../wallet/amount';
import { waitForWalletTransaction } from '../wallet/transactionReceipt';

export const FOUNDER_WALLET_ADDRESS: Address = '0x38CdF24eC27530B8F933023de2416d3960BD7372';

export function isFounderWallet(address?: string | null): boolean {
  if (!address || !isConfiguredAddress(address)) return false;
  return address.toLowerCase() === FOUNDER_WALLET_ADDRESS.toLowerCase();
}

export const EXCHANGE_ABI = parseAbi([
  'function pnrToken() view returns (address)',
  'function usdtToken() view returns (address)',
  'function pnrPerUsdt() view returns (uint256)',
  'function paused() view returns (bool)',
  'function owner() view returns (address)',
  'function quoteBuy(uint256 usdtIn) view returns (uint256)',
  'function buy(uint256 usdtIn,uint256 minimumPnr,uint256 deadline) returns (uint256)',
  'function setRate(uint256 nextRate)',
  'function pause()',
  'function unpause()',
  'function withdraw(address token, address recipient, uint256 amount)',
  'event RateUpdated(uint256 previousRate,uint256 newRate)',
  'event Purchased(address indexed buyer,uint256 usdtIn,uint256 pnrOut)',
]);

const tokenAbi = parseAbi([
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
]);

const configuredExchange = PENORA_CONTRACT_ADDRESSES?.EXCHANGE;
const envExchange =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.PUBLIC_PNR_EXCHANGE_ADDRESS) ||
  (typeof process !== 'undefined' && process.env?.PUBLIC_PNR_EXCHANGE_ADDRESS) ||
  '';

export const exchangeAddress = (
  isConfiguredAddress(configuredExchange) ? configuredExchange : envExchange
) as Address;

export const exchangeConfigured = () =>
  isConfiguredAddress(exchangeAddress) &&
  isConfiguredAddress(PENORA_CONTRACT_ADDRESSES.PNR_TOKEN) &&
  isConfiguredAddress(PENORA_CONTRACT_ADDRESSES.USDT_TOKEN);

export interface MarketSnapshot {
  rate: bigint;
  inventory: bigint;
  paused: boolean;
  block: bigint;
}

export interface BuyQuote {
  input: bigint;
  output: bigint;
  minimum: bigint;
  createdAt: number;
  market: MarketSnapshot;
}

export interface ExchangeAdminState {
  owner: Address;
  isOwner: boolean;
  rate: bigint;
  rateFormatted: string;
  equivalentPricePerPnr: string;
  pnrInventory: bigint;
  pnrInventoryFormatted: string;
  usdtBalance: bigint;
  usdtBalanceFormatted: string;
  paused: boolean;
}

export interface RateHistoryItem {
  blockNumber: bigint;
  previousRate: bigint;
  newRate: bigint;
  newRateFormatted: string;
  equivalentPricePerPnr: string;
  txHash?: string;
}

export function minimumReceived(output: bigint, bps = 50) {
  if (output <= 0n || !Number.isInteger(bps) || bps < 0 || bps > 100) throw new Error('Invalid slippage');
  const minimum = (output * BigInt(10000 - bps)) / 10000n;
  if (minimum === 0n) throw new Error('Amount is too small');
  return minimum;
}

export async function readMarket(): Promise<MarketSnapshot> {
  if (!exchangeConfigured()) throw new Error('Trading opens after the Amoy exchange is deployed and funded.');
  if ((await publicClient.getChainId()) !== 80002) throw new Error('Amoy network verification failed.');
  const block = await publicClient.getBlockNumber({ cacheTime: 0 });
  const read = (functionName: 'pnrToken' | 'usdtToken' | 'pnrPerUsdt' | 'paused') =>
    publicClient.readContract({ address: exchangeAddress, abi: EXCHANGE_ABI, functionName, blockNumber: block });
  const [pnr, usdt, rate, paused, pnrDecimals, usdtDecimals, inventory] = await Promise.all([
    read('pnrToken'),
    read('usdtToken'),
    read('pnrPerUsdt'),
    read('paused'),
    publicClient.readContract({
      address: PENORA_CONTRACT_ADDRESSES.PNR_TOKEN as Address,
      abi: tokenAbi,
      functionName: 'decimals',
      blockNumber: block,
    }),
    publicClient.readContract({
      address: PENORA_CONTRACT_ADDRESSES.USDT_TOKEN as Address,
      abi: tokenAbi,
      functionName: 'decimals',
      blockNumber: block,
    }),
    publicClient.readContract({
      address: PENORA_CONTRACT_ADDRESSES.PNR_TOKEN as Address,
      abi: tokenAbi,
      functionName: 'balanceOf',
      args: [exchangeAddress],
      blockNumber: block,
    }),
  ]);
  if (
    String(pnr).toLowerCase() !== PENORA_CONTRACT_ADDRESSES.PNR_TOKEN.toLowerCase() ||
    String(usdt).toLowerCase() !== PENORA_CONTRACT_ADDRESSES.USDT_TOKEN.toLowerCase() ||
    pnrDecimals !== 18 ||
    usdtDecimals !== 6 ||
    typeof rate !== 'bigint' ||
    rate <= 0n ||
    typeof paused !== 'boolean'
  )
    throw new Error('Exchange token configuration could not be verified.');
  return { rate, inventory, paused, block };
}

export async function readExchangeAdmin(userAddress?: string): Promise<ExchangeAdminState | null> {
  if (!exchangeConfigured()) return null;
  try {
    if ((await publicClient.getChainId()) !== 80002) return null;
    const block = await publicClient.getBlockNumber({ cacheTime: 0 });
    const [owner, rate, paused, pnrInventory, usdtBalance] = await Promise.all([
      publicClient.readContract({ address: exchangeAddress, abi: EXCHANGE_ABI, functionName: 'owner', blockNumber: block }),
      publicClient.readContract({ address: exchangeAddress, abi: EXCHANGE_ABI, functionName: 'pnrPerUsdt', blockNumber: block }),
      publicClient.readContract({ address: exchangeAddress, abi: EXCHANGE_ABI, functionName: 'paused', blockNumber: block }),
      publicClient.readContract({
        address: PENORA_CONTRACT_ADDRESSES.PNR_TOKEN as Address,
        abi: tokenAbi,
        functionName: 'balanceOf',
        args: [exchangeAddress],
        blockNumber: block,
      }),
      publicClient.readContract({
        address: PENORA_CONTRACT_ADDRESSES.USDT_TOKEN as Address,
        abi: tokenAbi,
        functionName: 'balanceOf',
        args: [exchangeAddress],
        blockNumber: block,
      }),
    ]);

    const isOwner = userAddress
      ? userAddress.toLowerCase() === String(owner).toLowerCase() ||
        isFounderWallet(userAddress)
      : false;
    const rateNum = Number(formatUnits(rate, 18));
    const equivalentPricePerPnr = rateNum > 0 ? (1 / rateNum).toFixed(6) : '0';

    return {
      owner: owner as Address,
      isOwner,
      rate,
      rateFormatted: formatUnits(rate, 18),
      equivalentPricePerPnr,
      pnrInventory,
      pnrInventoryFormatted: formatUnits(pnrInventory, 18),
      usdtBalance,
      usdtBalanceFormatted: formatUnits(usdtBalance, 6),
      paused,
    };
  } catch {
    return null;
  }
}

export async function getUserUsdtAllowance(userAddress?: Address | string | null): Promise<bigint> {
  if (!exchangeConfigured() || !userAddress || !isConfiguredAddress(String(userAddress))) return 0n;
  try {
    const usdt = PENORA_CONTRACT_ADDRESSES.USDT_TOKEN as Address;
    const allowance = await publicClient.readContract({
      address: usdt,
      abi: tokenAbi,
      functionName: 'allowance',
      args: [userAddress as Address, exchangeAddress],
    });
    return typeof allowance === 'bigint' ? allowance : 0n;
  } catch {
    return 0n;
  }
}

export async function getBuyQuote(amount: string): Promise<BuyQuote> {
  const input = parseTokenAmount(amount, 6),
    market = await readMarket();
  if (market.paused) throw new Error('The purchase desk is paused.');
  const output = await publicClient.readContract({
    address: exchangeAddress,
    abi: EXCHANGE_ABI,
    functionName: 'quoteBuy',
    args: [input],
    blockNumber: market.block,
  });
  if (output > market.inventory) throw new Error('Not enough PNR liquidity for this amount.');
  return { input, output, minimum: minimumReceived(output), createdAt: Date.now(), market };
}

export async function estimateBuyGas(
  quote: BuyQuote,
  account: Address
): Promise<{ estimatedGasPol: string; gasPriceGwei: string } | null> {
  try {
    const block = await publicClient.getBlock();
    const gasPrice = await publicClient.getGasPrice();
    const gasUnits = await publicClient.estimateContractGas({
      address: exchangeAddress,
      abi: EXCHANGE_ABI,
      functionName: 'buy',
      args: [quote.input, quote.minimum, block.timestamp + 180n],
      account,
    });
    const totalWei = (gasUnits * gasPrice * 125n) / 100n;
    return {
      estimatedGasPol: formatUnits(totalWei, 18),
      gasPriceGwei: formatUnits(gasPrice, 9),
    };
  } catch {
    return null;
  }
}

export function watchExchangeRate(
  onRateUpdated: (newRate: bigint, previousRate: bigint) => void
): () => void {
  if (!exchangeConfigured()) return () => {};
  try {
    const unwatch = publicClient.watchContractEvent({
      address: exchangeAddress,
      abi: EXCHANGE_ABI,
      eventName: 'RateUpdated',
      poll: true,
      pollingInterval: 15_000,
      onLogs: (logs) => {
        for (const log of logs) {
          if (log.args && typeof log.args.newRate === 'bigint') {
            onRateUpdated(log.args.newRate, log.args.previousRate ?? 0n);
          }
        }
      },
      onError: () => {},
    });
    return unwatch;
  } catch {
    return () => {};
  }
}

export function watchExchangePurchases(
  onPurchased: (buyer: Address, usdtIn: bigint, pnrOut: bigint) => void
): () => void {
  if (!exchangeConfigured()) return () => {};
  try {
    const unwatch = publicClient.watchContractEvent({
      address: exchangeAddress,
      abi: EXCHANGE_ABI,
      eventName: 'Purchased',
      poll: true,
      pollingInterval: 15_000,
      onLogs: (logs) => {
        for (const log of logs) {
          if (log.args && log.args.buyer) {
            onPurchased(log.args.buyer, log.args.usdtIn ?? 0n, log.args.pnrOut ?? 0n);
          }
        }
      },
      onError: () => {},
    });
    return unwatch;
  } catch {
    return () => {};
  }
}

export async function fetchRateHistory(): Promise<RateHistoryItem[]> {
  if (!exchangeConfigured()) return [];
  try {
    const logs = await publicClient.getLogs({
      address: exchangeAddress,
      event: parseAbiItem('event RateUpdated(uint256 previousRate, uint256 newRate)'),
      fromBlock: 'earliest',
      toBlock: 'latest',
    });
    return logs.map((log) => {
      const newRate = log.args.newRate ?? 0n;
      const prevRate = log.args.previousRate ?? 0n;
      const rateNum = Number(formatUnits(newRate, 18));
      return {
        blockNumber: log.blockNumber ?? 0n,
        previousRate: prevRate,
        newRate,
        newRateFormatted: formatUnits(newRate, 18),
        equivalentPricePerPnr: rateNum > 0 ? (1 / rateNum).toFixed(6) : '0',
        txHash: log.transactionHash,
      };
    });
  } catch {
    return [];
  }
}

export interface PendingBuy {
  account: Address;
  hash: Hash;
  stage: 'approval' | 'buy';
  input: string;
  minimum: string;
}

const storageKey = () => `penora:exchange:v1:80002:${exchangeAddress.toLowerCase()}`;

export function pendingBuy(): PendingBuy | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey()) || 'null');
    return value &&
      /^0x[\da-f]{64}$/i.test(value.hash) &&
      /^0x[\da-f]{40}$/i.test(value.account) &&
      ['buy', 'approval'].includes(value.stage) &&
      /^\d+$/.test(value.input) &&
      /^\d+$/.test(value.minimum)
      ? value
      : null;
  } catch {
    return null;
  }
}

function savePending(value: PendingBuy | null) {
  if (value) localStorage.setItem(storageKey(), JSON.stringify(value));
  else localStorage.removeItem(storageKey());
}

export async function reconcileBuy() {
  const pending = pendingBuy();
  if (!pending) return null;
  const result = await waitForWalletTransaction(pending.hash);
  if (result.status === 'pending') {
    savePending({ ...pending, hash: result.hash });
    return { ...result, stage: pending.stage, amount: undefined };
  }
  let amount: bigint | undefined;
  if (result.status === 'confirmed' && pending.stage === 'buy') {
    for (const log of result.receipt!.logs) {
      if (log.address.toLowerCase() !== exchangeAddress.toLowerCase()) continue;
      try {
        const event = decodeEventLog({ abi: EXCHANGE_ABI, data: log.data, topics: log.topics });
        if (
          event.eventName === 'Purchased' &&
          event.args.buyer.toLowerCase() === pending.account.toLowerCase() &&
          event.args.usdtIn === BigInt(pending.input) &&
          event.args.pnrOut >= BigInt(pending.minimum)
        )
          amount = event.args.pnrOut;
      } catch {}
    }
    if (amount === undefined) throw new Error('Receipt needs review: the expected purchase event was not verified.');
  }
  savePending(null);
  return { ...result, stage: pending.stage, amount };
}

let submitting = false;

export async function buyPnr(quote: BuyQuote, account: Address, onStage: (message: string) => void) {
  if (submitting || pendingBuy()) throw new Error('Resolve the pending transaction before buying again.');
  if (Date.now() - quote.createdAt > 60000) throw new Error('Quote expired. Refresh before reviewing again.');
  submitting = true;
  try {
    localStorage.setItem('penora:exchange:storage-check', '1');
    localStorage.removeItem('penora:exchange:storage-check');
    const provider = getEthereumProvider();
    if (!provider) throw new Error('Open this page in your connected wallet browser.');
    const wallet = createWalletClient({ chain: polygonAmoy, transport: custom(provider) });
    const assertContext = async () => {
      const accounts = await wallet.getAddresses();
      const chain = await wallet.getChainId();
      const current = penoraWalletService.getState();
      if (
        chain !== 80002 ||
        accounts[0]?.toLowerCase() !== account.toLowerCase() ||
        current.address?.toLowerCase() !== account.toLowerCase() ||
        !current.isCorrectNetwork
      )
        throw new Error('Wallet account or network changed. Review the purchase again.');
    };
    await assertContext();
    const current = await getBuyQuote(formatUnits(quote.input, 6));
    if (current.output < quote.minimum) throw new Error('Price moved beyond your minimum. Request a new quote.');
    const usdt = PENORA_CONTRACT_ADDRESSES.USDT_TOKEN as Address;
    const [balance, allowance] = await Promise.all([
      publicClient.readContract({ address: usdt, abi: tokenAbi, functionName: 'balanceOf', args: [account] }),
      publicClient.readContract({ address: usdt, abi: tokenAbi, functionName: 'allowance', args: [account, exchangeAddress] }),
    ]);
    if (balance < quote.input) throw new Error('Insufficient test USDT balance.');
    if (allowance < quote.input) {
      for (const approval of allowance > 0n ? [0n, quote.input] : [quote.input]) {
        onStage(approval === 0n ? 'Reset USDT approval in your wallet' : 'Approve the exact USDT amount in your wallet');
        await assertContext();
        const { request } = await publicClient.simulateContract({
          address: usdt,
          abi: tokenAbi,
          functionName: 'approve',
          args: [exchangeAddress, approval],
          account,
        });
        await assertContext();
        const hash = await wallet.writeContract(request);
        savePending({ account, hash, stage: 'approval', input: quote.input.toString(), minimum: quote.minimum.toString() });
        onStage('Waiting for USDT approval confirmation…');
        const receipt = await reconcileBuy();
        if (receipt?.status !== 'confirmed')
          throw new Error(
            receipt?.status === 'pending'
              ? 'Approval is pending. Check its status before retrying.'
              : 'Approval failed or was cancelled.'
          );
      }
    }
    await assertContext();
    if (Date.now() - quote.createdAt > 60000) throw new Error('Approval completed. Refresh your quote before purchasing.');
    const block = await publicClient.getBlock();
    const { request } = await publicClient.simulateContract({
      address: exchangeAddress,
      abi: EXCHANGE_ABI,
      functionName: 'buy',
      args: [quote.input, quote.minimum, block.timestamp + 180n],
      account,
    });
    await assertContext();
    onStage('Confirm your PNR purchase in your wallet');
    const hash = await wallet.writeContract(request);
    savePending({ account, hash, stage: 'buy', input: quote.input.toString(), minimum: quote.minimum.toString() });
    onStage('Purchase submitted. Waiting for onchain confirmation…');
    return await reconcileBuy();
  } finally {
    submitting = false;
  }
}

export async function setExchangeRate(
  nextRatePnrPerUsdtWei: bigint,
  account: Address
): Promise<{ hash: Hash; previousRate: bigint; newRate: bigint }> {
  if (nextRatePnrPerUsdtWei <= 0n) throw new Error('Rate must be greater than zero.');
  const provider = getEthereumProvider();
  if (!provider) throw new Error('Connect your wallet to administer the exchange.');
  const wallet = createWalletClient({ chain: polygonAmoy, transport: custom(provider) });

  const current = penoraWalletService.getState();
  const accounts = await wallet.getAddresses();
  const chain = await wallet.getChainId();
  if (
    chain !== 80002 ||
    accounts[0]?.toLowerCase() !== account.toLowerCase() ||
    current.address?.toLowerCase() !== account.toLowerCase() ||
    !current.isCorrectNetwork
  ) {
    throw new Error('Wallet account or network changed. Review the rate update again.');
  }

  const { request } = await publicClient.simulateContract({
    address: exchangeAddress,
    abi: EXCHANGE_ABI,
    functionName: 'setRate',
    args: [nextRatePnrPerUsdtWei],
    account,
  });

  const hash = await wallet.writeContract(request);
  const result = await waitForWalletTransaction(hash);
  if (result.status !== 'confirmed') {
    throw new Error(result.status === 'pending' ? 'Rate update transaction is pending.' : 'Rate update failed or was rejected.');
  }

  let previousRate = 0n;
  let newRate = nextRatePnrPerUsdtWei;
  if (result.receipt) {
    for (const log of result.receipt.logs) {
      if (log.address.toLowerCase() !== exchangeAddress.toLowerCase()) continue;
      try {
        const event = decodeEventLog({ abi: EXCHANGE_ABI, data: log.data, topics: log.topics });
        if (event.eventName === 'RateUpdated') {
          previousRate = event.args.previousRate;
          newRate = event.args.newRate;
        }
      } catch {}
    }
  }

  return { hash: result.hash, previousRate, newRate };
}

export async function setExchangePaused(pauseState: boolean, account: Address): Promise<{ hash: Hash; paused: boolean }> {
  const provider = getEthereumProvider();
  if (!provider) throw new Error('Connect your wallet to administer the exchange.');
  const wallet = createWalletClient({ chain: polygonAmoy, transport: custom(provider) });

  const current = penoraWalletService.getState();
  const accounts = await wallet.getAddresses();
  const chain = await wallet.getChainId();
  if (
    chain !== 80002 ||
    accounts[0]?.toLowerCase() !== account.toLowerCase() ||
    current.address?.toLowerCase() !== account.toLowerCase() ||
    !current.isCorrectNetwork
  ) {
    throw new Error('Wallet account or network changed. Review the pause action again.');
  }

  const functionName = pauseState ? 'pause' : 'unpause';
  const { request } = await publicClient.simulateContract({
    address: exchangeAddress,
    abi: EXCHANGE_ABI,
    functionName,
    account,
  });

  const hash = await wallet.writeContract(request);
  const result = await waitForWalletTransaction(hash);
  if (result.status !== 'confirmed') {
    throw new Error(result.status === 'pending' ? 'Pause transaction is pending.' : 'Pause update failed or was rejected.');
  }

  return { hash: result.hash, paused: pauseState };
}

export async function withdrawExchangeInventory(
  token: Address,
  recipient: Address,
  amount: bigint,
  account: Address
): Promise<{ hash: Hash }> {
  if (amount <= 0n) throw new Error('Amount must be greater than zero.');
  const provider = getEthereumProvider();
  if (!provider) throw new Error('Connect your wallet to administer the exchange.');
  const wallet = createWalletClient({ chain: polygonAmoy, transport: custom(provider) });

  const current = penoraWalletService.getState();
  const accounts = await wallet.getAddresses();
  const chain = await wallet.getChainId();
  if (
    chain !== 80002 ||
    accounts[0]?.toLowerCase() !== account.toLowerCase() ||
    current.address?.toLowerCase() !== account.toLowerCase() ||
    !current.isCorrectNetwork
  ) {
    throw new Error('Wallet account or network changed. Review the withdrawal again.');
  }

  const { request } = await publicClient.simulateContract({
    address: exchangeAddress,
    abi: EXCHANGE_ABI,
    functionName: 'withdraw',
    args: [token, recipient, amount],
    account,
  });

  const hash = await wallet.writeContract(request);
  const result = await waitForWalletTransaction(hash);
  if (result.status !== 'confirmed') {
    throw new Error(result.status === 'pending' ? 'Withdrawal transaction is pending.' : 'Withdrawal failed or was rejected.');
  }

  return { hash: result.hash };
}

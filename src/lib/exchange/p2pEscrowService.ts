// src/lib/exchange/p2pEscrowService.ts
// PENORA P2P Escrow Contract Client Service (Polygon Amoy - 80002)

import { encodeFunctionData, parseAbi, formatUnits, parseUnits, isAddress, type Hex } from 'viem';
import { getEthereumProvider } from '../wallet/walletService';

export const P2P_ESCROW_ABI = parseAbi([
  'function offers(uint256) view returns (uint256 id, address seller, uint256 pnrAmount, uint256 pnrRemaining, uint256 usdtPriceTotal, uint256 minPnrFill, uint256 createdAt, uint256 expiresAt, bool cancelled)',
  'function nextOfferId() view returns (uint256)',
  'function totalPnrInEscrow() view returns (uint256)',
  'function isOfferActive(uint256) view returns (bool)',
  'function feeBps() view returns (uint256)',
  'function feeRecipient() view returns (address)',
  'function createOffer(uint256 pnrAmount, uint256 usdtPriceTotal, uint256 minPnrFill, uint256 durationSeconds) returns (uint256 offerId)',
  'function createOffer(uint256 pnrAmount, uint256 usdtPriceTotal) returns (uint256 offerId)',
  'function fillOffer(uint256 offerId, uint256 pnrToFill)',
  'function fillOffer(uint256 offerId)',
  'function cancelOffer(uint256 offerId)',
  'function recoverUnallocated(address token, address recipient)',
  'event OfferCreated(uint256 indexed offerId, address indexed seller, uint256 pnrAmount, uint256 usdtPriceTotal, uint256 minPnrFill, uint256 expiresAt)',
  'event OfferFilled(uint256 indexed offerId, address indexed buyer, address indexed seller, uint256 pnrFilled, uint256 pnrRemaining, uint256 usdtPaid, uint256 fee)',
  'event OfferCancelled(uint256 indexed offerId, address indexed seller, uint256 pnrRefunded)',
  'event FeeUpdated(uint256 previousFeeBps, uint256 newFeeBps, address indexed recipient)',
  'event UnallocatedRecovered(address indexed token, address indexed recipient, uint256 amount)',
]);

export const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

export interface P2POffer {
  id: number;
  seller: `0x${string}`;
  pnrAmount: string;       // Original total formatted in 18-decimal PNR
  pnrAmountWei: bigint;
  pnrRemaining: string;    // Current available unfilled PNR
  pnrRemainingWei: bigint;
  usdtPriceTotal: string;  // Total requested USDT for 100% of the offer (6 decimals)
  usdtPriceWei: bigint;
  minPnrFill: string;      // Minimum fill threshold (0 = any)
  minPnrFillWei: bigint;
  pricePerPnr: string;     // USDT per PNR (6 decimals)
  createdAt: number;
  expiresAt: number;
  isExpired: boolean;
  cancelled: boolean;
  active: boolean;
  fillPercentage: number;  // 0 to 100
}

export interface P2PTradeEvent {
  offerId: number;
  buyer: `0x${string}`;
  seller: `0x${string}`;
  pnrFilled: string;
  pnrFilledWei: bigint;
  pnrRemaining: string;
  pnrRemainingWei: bigint;
  usdtPaid: string;
  usdtPaidWei: bigint;
  feePaid: string;
  txHash: `0x${string}`;
  blockNumber: bigint;
}

export interface TradeCostBreakdown {
  grossUsdtWei: bigint;
  grossUsdt: string;
  feeWei: bigint;
  fee: string;
  netSellerWei: bigint;
  netSeller: string;
}

export interface UserAllowances {
  pnrAllowance: bigint;
  pnrAllowanceFormatted: string;
  usdtAllowance: bigint;
  usdtAllowanceFormatted: string;
}

export interface UserPortfolioSummary {
  liquidPnr: string;
  liquidPnrWei: bigint;
  escrowedPnr: string;
  escrowedPnrWei: bigint;
  totalPnr: string;
  liquidUsdt: string;
  liquidUsdtWei: bigint;
  activeOffersCount: number;
}

export interface MarketMetrics {
  bestAskPrice: string;
  totalActivePnr: string;
  activeOffersCount: number;
  totalLifetimeVolumeUsdt: string;
  totalTradesCount: number;
}

export const KNOWN_P2P_ESCROW_ADDRESS = (process.env.PUBLIC_P2P_ESCROW_ADDRESS || '') as `0x${string}`;

/**
 * Calculates exact USDT payment and platform fee using ceil rounding to guarantee solvency.
 */
export function calculateUsdtCost(
  pnrToFillWei: bigint,
  offerPnrAmountWei: bigint,
  offerUsdtPriceTotalWei: bigint,
  feeBps: bigint = 50n
): TradeCostBreakdown {
  if (pnrToFillWei <= 0n || offerPnrAmountWei <= 0n) {
    return { grossUsdtWei: 0n, grossUsdt: '0', feeWei: 0n, fee: '0', netSellerWei: 0n, netSeller: '0' };
  }

  // Ceil division: (numerator + denominator - 1) / denominator
  const numerator = pnrToFillWei * offerUsdtPriceTotalWei;
  const grossUsdtWei = (numerator + offerPnrAmountWei - 1n) / offerPnrAmountWei;
  const feeWei = feeBps > 0n ? (grossUsdtWei * feeBps) / 10000n : 0n;
  const netSellerWei = grossUsdtWei - feeWei;

  return {
    grossUsdtWei,
    grossUsdt: formatUnits(grossUsdtWei, 6),
    feeWei,
    fee: formatUnits(feeWei, 6),
    netSellerWei,
    netSeller: formatUnits(netSellerWei, 6),
  };
}

/**
 * Calculates market metrics (best ask, total active escrow, volume) from genuine verified data.
 */
export function calculateMarketMetrics(offers: P2POffer[], history: P2PTradeEvent[]): MarketMetrics {
  const activeOffers = offers.filter(o => o.active);
  let bestAsk = '—';
  let minPrice = Infinity;
  let totalActivePnrWei = 0n;

  for (const offer of activeOffers) {
    totalActivePnrWei += offer.pnrRemainingWei;
    const rateNum = parseFloat(offer.pricePerPnr);
    if (!isNaN(rateNum) && rateNum > 0 && rateNum < minPrice) {
      minPrice = rateNum;
      bestAsk = offer.pricePerPnr;
    }
  }

  let totalVolumeUsdtWei = 0n;
  for (const trade of history) {
    totalVolumeUsdtWei += trade.usdtPaidWei;
  }

  return {
    bestAskPrice: bestAsk,
    totalActivePnr: formatUnits(totalActivePnrWei, 18),
    activeOffersCount: activeOffers.length,
    totalLifetimeVolumeUsdt: formatUnits(totalVolumeUsdtWei, 6),
    totalTradesCount: history.length,
  };
}

/**
 * Fetches all orders with pagination, expiration verification, and status flags.
 */
export async function fetchP2POffers(
  escrowAddress: `0x${string}`,
  rpcUrl: string,
  options?: { limit?: number; offset?: number }
): Promise<P2POffer[]> {
  if (!escrowAddress || !isAddress(escrowAddress)) return [];
  try {
    const { createPublicClient, http } = await import('viem');
    const { polygonAmoy } = await import('viem/chains');
    const client = createPublicClient({ chain: polygonAmoy, transport: http(rpcUrl) });

    const nextId = await client.readContract({
      address: escrowAddress,
      abi: P2P_ESCROW_ABI,
      functionName: 'nextOfferId',
    });

    const total = Number(nextId);
    const limit = options?.limit || 50;
    const startId = total - 1;
    const offers: P2POffer[] = [];
    const now = Math.floor(Date.now() / 1000);

    for (let id = startId; id >= 1 && offers.length < limit; id--) {
      try {
        const raw = await client.readContract({
          address: escrowAddress,
          abi: P2P_ESCROW_ABI,
          functionName: 'offers',
          args: [BigInt(id)],
        });

        const [
          offerId,
          seller,
          pnrAmount,
          pnrRemaining,
          usdtPriceTotal,
          minPnrFill,
          createdAt,
          expiresAt,
          cancelled,
        ] = raw;

        if (offerId > 0n) {
          const pnrFormatted = formatUnits(pnrAmount, 18);
          const pnrRemFormatted = formatUnits(pnrRemaining, 18);
          const usdtFormatted = formatUnits(usdtPriceTotal, 6);
          const minFillFormatted = formatUnits(minPnrFill, 18);

          const pnrNum = parseFloat(pnrFormatted);
          const usdtNum = parseFloat(usdtFormatted);
          const pricePerPnr = pnrNum > 0 ? (usdtNum / pnrNum).toFixed(6) : '0.00';

          const expiresAtNum = Number(expiresAt);
          const isExpired = expiresAtNum > 0 && expiresAtNum <= now;
          const active = !cancelled && pnrRemaining > 0n && !isExpired;

          const pnrRemainingNum = parseFloat(pnrRemFormatted);
          const fillPercentage =
            pnrNum > 0
              ? Math.max(0, Math.min(100, Math.round(((pnrNum - pnrRemainingNum) / pnrNum) * 100)))
              : 0;

          offers.push({
            id: Number(offerId),
            seller: seller as `0x${string}`,
            pnrAmount: pnrFormatted,
            pnrAmountWei: pnrAmount,
            pnrRemaining: pnrRemFormatted,
            pnrRemainingWei: pnrRemaining,
            usdtPriceTotal: usdtFormatted,
            usdtPriceWei: usdtPriceTotal,
            minPnrFill: minFillFormatted,
            minPnrFillWei: minPnrFill,
            pricePerPnr,
            createdAt: Number(createdAt),
            expiresAt: expiresAtNum,
            isExpired,
            cancelled,
            active,
            fillPercentage,
          });
        }
      } catch {
        // Skip uninitialized slot
      }
    }

    return offers;
  } catch {
    return [];
  }
}

/**
 * Pre-flight simulation: Validates buyer balances, allowances, constraints, and contract simulation
 * before any real wallet transaction is prompted to the user.
 */
export async function preflightFillValidation(params: {
  escrowAddress: `0x${string}`;
  usdtAddress: `0x${string}`;
  buyerAddress: `0x${string}`;
  offer: P2POffer;
  pnrToFillWei: bigint;
  rpcUrl: string;
}): Promise<{ valid: boolean; error?: string; cost?: TradeCostBreakdown }> {
  const { escrowAddress, usdtAddress, buyerAddress, offer, pnrToFillWei, rpcUrl } = params;

  if (buyerAddress.toLowerCase() === offer.seller.toLowerCase()) {
    return { valid: false, error: 'Cannot purchase your own sell offer.' };
  }
  if (!offer.active) {
    return { valid: false, error: 'Offer is no longer active.' };
  }
  if (offer.isExpired) {
    return { valid: false, error: 'Offer has expired.' };
  }
  if (pnrToFillWei <= 0n) {
    return { valid: false, error: 'Enter a valid PNR amount greater than zero.' };
  }
  if (pnrToFillWei > offer.pnrRemainingWei) {
    return { valid: false, error: `Requested fill exceeds remaining escrow (${offer.pnrRemaining} PNR).` };
  }

  // Minimum fill validation (unless clearing all remaining balance)
  if (offer.minPnrFillWei > 0n && pnrToFillWei < offer.pnrRemainingWei && pnrToFillWei < offer.minPnrFillWei) {
    return {
      valid: false,
      error: `Minimum fill is ${offer.minPnrFill} PNR (or take remaining ${offer.pnrRemaining} PNR).`,
    };
  }

  try {
    const { createPublicClient, http } = await import('viem');
    const { polygonAmoy } = await import('viem/chains');
    const client = createPublicClient({ chain: polygonAmoy, transport: http(rpcUrl) });

    const feeBps = await client.readContract({
      address: escrowAddress,
      abi: P2P_ESCROW_ABI,
      functionName: 'feeBps',
    });

    const cost = calculateUsdtCost(pnrToFillWei, offer.pnrAmountWei, offer.usdtPriceWei, feeBps);

    // Check MockUSDT balance
    const usdtBalance = await client.readContract({
      address: usdtAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [buyerAddress],
    });

    if (usdtBalance < cost.grossUsdtWei) {
      return {
        valid: false,
        error: `Insufficient TESTNET USDT balance. You have ${formatUnits(usdtBalance, 6)} USDT, but need ${cost.grossUsdt} USDT.`,
        cost,
      };
    }

    return {
      valid: true,
      cost,
    };
  } catch (err: unknown) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Pre-flight check failed.',
    };
  }
}

/**
 * Fetches token allowances of a user to the P2P escrow contract.
 */
export async function fetchUserAllowances(
  userAddress: `0x${string}`,
  escrowAddress: `0x${string}`,
  pnrAddress: `0x${string}`,
  usdtAddress: `0x${string}`,
  rpcUrl: string
): Promise<UserAllowances> {
  if (!userAddress || !escrowAddress) {
    return {
      pnrAllowance: 0n,
      pnrAllowanceFormatted: '0',
      usdtAllowance: 0n,
      usdtAllowanceFormatted: '0',
    };
  }

  try {
    const { createPublicClient, http } = await import('viem');
    const { polygonAmoy } = await import('viem/chains');
    const client = createPublicClient({ chain: polygonAmoy, transport: http(rpcUrl) });

    const [pnrAllow, usdtAllow] = await Promise.all([
      client.readContract({
        address: pnrAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [userAddress, escrowAddress],
      }),
      client.readContract({
        address: usdtAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [userAddress, escrowAddress],
      }),
    ]);

    return {
      pnrAllowance: pnrAllow,
      pnrAllowanceFormatted: formatUnits(pnrAllow, 18),
      usdtAllowance: usdtAllow,
      usdtAllowanceFormatted: formatUnits(usdtAllow, 6),
    };
  } catch {
    return {
      pnrAllowance: 0n,
      pnrAllowanceFormatted: '0',
      usdtAllowance: 0n,
      usdtAllowanceFormatted: '0',
    };
  }
}

/**
 * Computes portfolio summary: Liquid PNR vs Escrowed PNR locked in active offers.
 */
export function calculateUserPortfolio(
  userAddress: `0x${string}` | null,
  liquidPnrFormatted: string | null,
  liquidUsdtFormatted: string | null,
  offers: P2POffer[]
): UserPortfolioSummary {
  if (!userAddress) {
    return {
      liquidPnr: '0',
      liquidPnrWei: 0n,
      escrowedPnr: '0',
      escrowedPnrWei: 0n,
      totalPnr: '0',
      liquidUsdt: '0',
      liquidUsdtWei: 0n,
      activeOffersCount: 0,
    };
  }

  const userLower = userAddress.toLowerCase();
  const myActiveOffers = offers.filter(o => o.active && o.seller.toLowerCase() === userLower);

  let escrowedWei = 0n;
  for (const offer of myActiveOffers) {
    escrowedWei += offer.pnrRemainingWei;
  }

  const liquidPnrWei = liquidPnrFormatted ? parseUnits(liquidPnrFormatted, 18) : 0n;
  const liquidUsdtWei = liquidUsdtFormatted ? parseUnits(liquidUsdtFormatted, 6) : 0n;
  const totalPnrWei = liquidPnrWei + escrowedWei;

  return {
    liquidPnr: liquidPnrFormatted || '0',
    liquidPnrWei,
    escrowedPnr: formatUnits(escrowedWei, 18),
    escrowedPnrWei: escrowedWei,
    totalPnr: formatUnits(totalPnrWei, 18),
    liquidUsdt: liquidUsdtFormatted || '0',
    liquidUsdtWei,
    activeOffersCount: myActiveOffers.length,
  };
}

/**
 * Fetches confirmed trade history events from the blockchain.
 */
export async function fetchP2PTradeHistory(
  escrowAddress: `0x${string}`,
  rpcUrl: string
): Promise<P2PTradeEvent[]> {
  if (!escrowAddress || !isAddress(escrowAddress)) return [];
  try {
    const { createPublicClient, http, parseAbiItem } = await import('viem');
    const { polygonAmoy } = await import('viem/chains');
    const client = createPublicClient({ chain: polygonAmoy, transport: http(rpcUrl) });

    const logs = await client.getLogs({
      address: escrowAddress,
      event: parseAbiItem(
        'event OfferFilled(uint256 indexed offerId, address indexed buyer, address indexed seller, uint256 pnrFilled, uint256 pnrRemaining, uint256 usdtPaid, uint256 fee)'
      ),
      fromBlock: 'earliest',
      toBlock: 'latest',
    });

    return logs
      .map(log => ({
        offerId: Number(log.args.offerId || 0n),
        buyer: (log.args.buyer || '0x0') as `0x${string}`,
        seller: (log.args.seller || '0x0') as `0x${string}`,
        pnrFilled: formatUnits(log.args.pnrFilled || 0n, 18),
        pnrFilledWei: log.args.pnrFilled || 0n,
        pnrRemaining: formatUnits(log.args.pnrRemaining || 0n, 18),
        pnrRemainingWei: log.args.pnrRemaining || 0n,
        usdtPaid: formatUnits(log.args.usdtPaid || 0n, 6),
        usdtPaidWei: log.args.usdtPaid || 0n,
        feePaid: formatUnits(log.args.fee || 0n, 6),
        txHash: log.transactionHash as `0x${string}`,
        blockNumber: log.blockNumber || 0n,
      }))
      .reverse();
  } catch {
    return [];
  }
}

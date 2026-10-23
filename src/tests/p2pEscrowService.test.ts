// src/tests/p2pEscrowService.test.ts
import { describe, it, expect } from 'vitest';
import { parseUnits, formatUnits } from 'viem';
import {
  calculateUsdtCost,
  calculateMarketMetrics,
  calculateUserPortfolio,
  type P2POffer,
  type P2PTradeEvent,
} from '../lib/exchange/p2pEscrowService';

describe('PENORA P2P Escrow Client Service & Arithmetic', () => {
  it('correctly calculates gross USDT and platform fee with ceiling rounding', () => {
    // 1,000 PNR offered for 10.000000 USDT ($0.01 / PNR)
    const offerPnrAmountWei = parseUnits('1000', 18);
    const offerUsdtPriceWei = parseUnits('10', 6);

    // Buyer fills 250 PNR (25%)
    const pnrToFillWei = parseUnits('250', 18);
    const cost = calculateUsdtCost(pnrToFillWei, offerPnrAmountWei, offerUsdtPriceWei, 50n);

    expect(cost.grossUsdtWei).toBe(parseUnits('2.5', 6));
    expect(cost.grossUsdt).toBe('2.5');

    // 0.5% of 2.5 USDT = 0.0125 USDT = 12500 micro-USDT
    expect(cost.feeWei).toBe(12500n);
    expect(cost.fee).toBe('0.0125');

    // Net to seller: 2.5 - 0.0125 = 2.4875 USDT
    expect(cost.netSellerWei).toBe(2487500n);
    expect(cost.netSeller).toBe('2.4875');
  });

  it('enforces ceiling rounding so seller is never short-changed on fractional micro-cents', () => {
    // 3 PNR for 1 USDT: Rate = 0.333333... USDT per PNR
    const offerPnrAmountWei = parseUnits('3', 18);
    const offerUsdtPriceWei = parseUnits('1', 6); // 1,000,000 micro-USDT

    // Fill 1 PNR: Exact = 333,333.333... micro-USDT
    // Ceiling division must round up to 333,334 micro-USDT to protect solvency
    const pnrToFillWei = parseUnits('1', 18);
    const cost = calculateUsdtCost(pnrToFillWei, offerPnrAmountWei, offerUsdtPriceWei, 0n);

    expect(cost.grossUsdtWei).toBe(333334n);
  });

  it('handles zero or negative inputs gracefully without division by zero', () => {
    const costZero = calculateUsdtCost(0n, parseUnits('100', 18), parseUnits('5', 6), 50n);
    expect(costZero.grossUsdtWei).toBe(0n);
    expect(costZero.grossUsdt).toBe('0');

    const costZeroDenom = calculateUsdtCost(parseUnits('10', 18), 0n, parseUnits('5', 6), 50n);
    expect(costZeroDenom.grossUsdtWei).toBe(0n);
  });

  it('accurately computes live market metrics from verified on-chain offers and trade events', () => {
    const mockOffers: P2POffer[] = [
      {
        id: 1,
        seller: '0x1111111111111111111111111111111111111111',
        pnrAmount: '1000',
        pnrAmountWei: parseUnits('1000', 18),
        pnrRemaining: '600',
        pnrRemainingWei: parseUnits('600', 18),
        usdtPriceTotal: '12',
        usdtPriceWei: parseUnits('12', 6),
        minPnrFill: '0',
        minPnrFillWei: 0n,
        pricePerPnr: '0.012000',
        createdAt: 1000,
        expiresAt: 0,
        isExpired: false,
        cancelled: false,
        active: true,
        fillPercentage: 40,
      },
      {
        id: 2,
        seller: '0x2222222222222222222222222222222222222222',
        pnrAmount: '500',
        pnrAmountWei: parseUnits('500', 18),
        pnrRemaining: '500',
        pnrRemainingWei: parseUnits('500', 18),
        usdtPriceTotal: '4.5',
        usdtPriceWei: parseUnits('4.5', 6),
        minPnrFill: '100',
        minPnrFillWei: parseUnits('100', 18),
        pricePerPnr: '0.009000', // Lowest rate ($0.009 / PNR)
        createdAt: 2000,
        expiresAt: 0,
        isExpired: false,
        cancelled: false,
        active: true,
        fillPercentage: 0,
      },
      {
        id: 3,
        seller: '0x3333333333333333333333333333333333333333',
        pnrAmount: '200',
        pnrAmountWei: parseUnits('200', 18),
        pnrRemaining: '0',
        pnrRemainingWei: 0n,
        usdtPriceTotal: '2',
        usdtPriceWei: parseUnits('2', 6),
        minPnrFill: '0',
        minPnrFillWei: 0n,
        pricePerPnr: '0.010000',
        createdAt: 500,
        expiresAt: 0,
        isExpired: false,
        cancelled: false,
        active: false, // Inactive / filled
        fillPercentage: 100,
      },
    ];

    const mockHistory: P2PTradeEvent[] = [
      {
        offerId: 1,
        buyer: '0x4444444444444444444444444444444444444444',
        seller: '0x1111111111111111111111111111111111111111',
        pnrFilled: '400',
        pnrFilledWei: parseUnits('400', 18),
        pnrRemaining: '600',
        pnrRemainingWei: parseUnits('600', 18),
        usdtPaid: '4.8',
        usdtPaidWei: parseUnits('4.8', 6),
        feePaid: '0.024',
        txHash: '0xaaaa',
        blockNumber: 100n,
      },
      {
        offerId: 3,
        buyer: '0x5555555555555555555555555555555555555555',
        seller: '0x3333333333333333333333333333333333333333',
        pnrFilled: '200',
        pnrFilledWei: parseUnits('200', 18),
        pnrRemaining: '0',
        pnrRemainingWei: 0n,
        usdtPaid: '2.0',
        usdtPaidWei: parseUnits('2.0', 6),
        feePaid: '0.01',
        txHash: '0xbbbb',
        blockNumber: 101n,
      },
    ];

    const metrics = calculateMarketMetrics(mockOffers, mockHistory);

    // Best ask should be the cheapest active offer: 0.009000
    expect(metrics.bestAskPrice).toBe('0.009000');
    // Active PNR: 600 + 500 = 1100 PNR
    expect(metrics.totalActivePnr).toBe('1100');
    expect(metrics.activeOffersCount).toBe(2);
    // Lifetime volume: 4.8 + 2.0 = 6.8 USDT
    expect(metrics.totalLifetimeVolumeUsdt).toBe('6.8');
    expect(metrics.totalTradesCount).toBe(2);
  });

  it('correctly tracks user portfolio across liquid wallet and active escrow commitments', () => {
    const userAddress = '0x1111111111111111111111111111111111111111' as `0x${string}`;
    const mockOffers: P2POffer[] = [
      {
        id: 1,
        seller: userAddress,
        pnrAmount: '1000',
        pnrAmountWei: parseUnits('1000', 18),
        pnrRemaining: '750', // 750 PNR currently committed in escrow
        pnrRemainingWei: parseUnits('750', 18),
        usdtPriceTotal: '10',
        usdtPriceWei: parseUnits('10', 6),
        minPnrFill: '0',
        minPnrFillWei: 0n,
        pricePerPnr: '0.010000',
        createdAt: 1000,
        expiresAt: 0,
        isExpired: false,
        cancelled: false,
        active: true,
        fillPercentage: 25,
      },
      {
        id: 2,
        seller: '0x9999999999999999999999999999999999999999', // Different seller
        pnrAmount: '500',
        pnrAmountWei: parseUnits('500', 18),
        pnrRemaining: '500',
        pnrRemainingWei: parseUnits('500', 18),
        usdtPriceTotal: '5',
        usdtPriceWei: parseUnits('5', 6),
        minPnrFill: '0',
        minPnrFillWei: 0n,
        pricePerPnr: '0.010000',
        createdAt: 2000,
        expiresAt: 0,
        isExpired: false,
        cancelled: false,
        active: true,
        fillPercentage: 0,
      },
    ];

    const portfolio = calculateUserPortfolio(userAddress, '250', '50.5', mockOffers);

    expect(portfolio.liquidPnr).toBe('250');
    expect(portfolio.escrowedPnr).toBe('750');
    // Total PNR = 250 liquid + 750 escrowed = 1000 PNR
    expect(portfolio.totalPnr).toBe('1000');
    expect(portfolio.liquidUsdt).toBe('50.5');
    expect(portfolio.activeOffersCount).toBe(1);
  });
});

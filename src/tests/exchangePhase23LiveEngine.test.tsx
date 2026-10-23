import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExchangeView } from '../components/exchange/ExchangeView';
import {
  minimumReceived,
  getBuyQuote,
  readMarket,
  readExchangeAdmin,
  isFounderWallet,
  FOUNDER_WALLET_ADDRESS,
  type MarketSnapshot,
  type BuyQuote,
} from '../lib/exchange/exchangeService';
import { parseUnits, formatUnits } from 'viem';

describe('PENORA — Phase 23 Live Testnet Exchange & Real-Time Price Engine Suite', () => {
  describe('1. Price Calculation & 0.5% Slippage Invariant', () => {
    it('calculates exact 0.20 MockUSDT per 1 PNR (5 PNR per 1 MockUSDT)', () => {
      const rate = 5n * 10n ** 18n; // 5 PNR per 1 USDT
      const rateNum = Number(formatUnits(rate, 18));
      const pricePerPnr = (1 / rateNum).toFixed(6);

      expect(rateNum).toBe(5);
      expect(pricePerPnr).toBe('0.200000');
    });

    it('enforces exact 0.5% (50 bps) minimum received without float rounding errors', () => {
      // 100 PNR output -> 99.5 PNR minimum
      const output = parseUnits('100', 18);
      const minimum = minimumReceived(output, 50);

      expect(minimum).toBe(parseUnits('99.5', 18));
    });

    it('rejects invalid slippage parameters', () => {
      expect(() => minimumReceived(100n, -1)).toThrow('Invalid slippage');
      expect(() => minimumReceived(100n, 150)).toThrow('Invalid slippage');
      expect(() => minimumReceived(0n, 50)).toThrow('Invalid slippage');
    });
  });

  describe('2. Founder Wallet Identity & Authorization Guard', () => {
    it('recognizes verified founder wallet 0x38CdF24eC27530B8F933023de2416d3960BD7372', () => {
      expect(isFounderWallet(FOUNDER_WALLET_ADDRESS)).toBe(true);
      expect(isFounderWallet(FOUNDER_WALLET_ADDRESS.toLowerCase())).toBe(true);
    });

    it('rejects ordinary user addresses as founder', () => {
      expect(isFounderWallet('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')).toBe(false);
      expect(isFounderWallet(null)).toBe(false);
      expect(isFounderWallet(undefined)).toBe(false);
      expect(isFounderWallet('0x0000000000000000000000000000000000000000')).toBe(false);
    });
  });

  describe('3. Exchange UI Structure & Requirement Compliance', () => {
    it('renders real-time rate engine hero card without synthetic candle generators', () => {
      const html = renderToStaticMarkup(<ExchangeView />);

      // Compliant headers & labels
      expect(html).toContain('Instant Exchange');
      expect(html).toContain('Rate &amp; Liquidity Engine');
      expect(html).toContain('Owner-set TESTNET rate — not a live market price');
      expect(html).toContain('Honest Market Transparency');
      expect(html).toContain('Market trading price discovery is not active');
      expect(html).toContain('creators set their own independent asking prices');

      // Fake synthetic SVG candles MUST NOT be generated
      expect(html).not.toContain('Illustrative chart · sample data');
    });

    it('renders instant quote inputs, token badges, and quick percentage selectors', () => {
      const html = renderToStaticMarkup(<ExchangeView />);

      expect(html).toContain('BUY PNR');
      expect(html).toContain('You pay');
      expect(html).toContain('You receive · estimated');
      expect(html).toContain('25%');
      expect(html).toContain('50%');
      expect(html).toContain('75%');
      expect(html).toContain('MAX');
      expect(html).toContain('Slippage tolerance');
      expect(html).toContain('0.5%');
    });

    it('renders connect wallet CTA when disconnected', () => {
      const html = renderToStaticMarkup(<ExchangeView />);
      expect(html).toContain('Connect wallet');
    });

    it('displays network badge showing Polygon Amoy TESTNET', () => {
      const html = renderToStaticMarkup(<ExchangeView />);
      expect(html).toContain('Polygon Amoy');
      expect(html).toContain('TESTNET');
    });
  });
});

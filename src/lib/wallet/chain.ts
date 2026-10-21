// src/lib/wallet/chain.ts
// PENORA Blockchain — Polygon Amoy Testnet (Chain ID: 80002) Chain Definition via viem
import { defineChain } from 'viem';
import type { WalletNetwork } from './types';

export const polygonAmoy = defineChain({
  id: 80002,
  name: 'Polygon Amoy',
  nativeCurrency: {
    name: 'POL',
    symbol: 'POL',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-amoy.polygon.technology'],
    },
    public: {
      http: ['https://rpc-amoy.polygon.technology'],
    },
  },
  blockExplorers: {
    default: {
      name: 'PolygonScan',
      url: 'https://amoy.polygonscan.com',
    },
  },
  testnet: true,
});

export const PENORA_TARGET_CHAIN_ID = 80002;

export const POLYGON_AMOY_CONFIG: WalletNetwork = {
  id: 80002,
  name: 'Polygon Amoy Testnet',
  nativeCurrency: {
    name: 'POL',
    symbol: 'POL',
    decimals: 18,
  },
  rpcUrls: ['https://rpc-amoy.polygon.technology'],
  blockExplorers: ['https://amoy.polygonscan.com'],
  testnet: true,
};

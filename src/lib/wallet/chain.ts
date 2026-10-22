// src/lib/wallet/chain.ts
// PENORA Blockchain — Polygon Amoy Testnet (Chain ID: 80002) Chain Definition via viem
import { defineChain } from 'viem';
import type { WalletNetwork } from './types';

// Current high-performance public Amoy endpoints.
export const AMOY_RPC_URL = import.meta.env.PUBLIC_AMOY_RPC_URL || 'https://polygon-amoy.drpc.org';
export const AMOY_FALLBACK_RPCS = [
  'https://polygon-amoy.drpc.org',
  'https://polygon-amoy-bor-rpc.publicnode.com',
];

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
      http: AMOY_FALLBACK_RPCS,
    },
    public: {
      http: AMOY_FALLBACK_RPCS,
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
  rpcUrls: AMOY_FALLBACK_RPCS,
  blockExplorers: ['https://amoy.polygonscan.com'],
  testnet: true,
};

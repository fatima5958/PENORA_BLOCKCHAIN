// src/lib/wallet/walletService.ts
// PENORA Blockchain — EVM Wallet Service for Polygon Amoy (Chain ID 80002)
// Clean separation of PENORA authority keys from EVM Web3 wallet keys.
import { createPublicClient, http, formatEther } from 'viem';
import { polygonAmoy, PENORA_TARGET_CHAIN_ID } from './chain';
import type { WalletState } from './types';
import { isUsdtConfigured } from './contracts';
import { penoraUsdtService } from './usdtService';

// Create a public viem client for querying Polygon Amoy testnet
export const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http('https://rpc-amoy.polygon.technology'),
});

// Helper to get MetaMask / EIP-1193 injected provider
export function getEthereumProvider(): any {
  if (typeof window === 'undefined') return undefined;
  const anyWin = window as any;
  if (!anyWin.ethereum) return undefined;

  // Handle multi-provider injections (e.g. MetaMask + Coinbase + Phantom)
  if (Array.isArray(anyWin.ethereum.providers)) {
    const metaMask = anyWin.ethereum.providers.find((p: any) => p.isMetaMask);
    if (metaMask) return metaMask;
    return anyWin.ethereum.providers[0];
  }

  return anyWin.ethereum;
}

class PenoraWalletService {
  private state: WalletState = {
    status: 'disconnected',
    address: null,
    chainId: null,
    error: null,
    balancePol: null,
    balancePnr: null, // Pre-launch MVP; always honest '— PNR'
    balancePp: null,  // Pre-launch MVP; always honest '— PP'
    balanceUsdt: null, // Real onchain USDT balance
    usdtDecimals: 6,
    isUsdtConfigured: isUsdtConfigured(),
    votingManaPercent: null,
    powerDownSchedule: null,
    isCorrectNetwork: false,
    contractsDeployed: false,
  };

  private listeners: Set<(state: WalletState) => void> = new Set();
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public isMetaMaskAvailable(): boolean {
    const eth = getEthereumProvider();
    return Boolean(eth);
  }

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    const eth = getEthereumProvider();
    if (eth) {
      // Listen to accountsChanged
      eth.on?.('accountsChanged', (accounts: string[]) => {
        if (!accounts || accounts.length === 0) {
          this.updateState({
            status: 'disconnected',
            address: null,
            balancePol: null,
            balanceUsdt: null,
          });
        } else {
          this.handleAccountConnected(accounts[0] as `0x${string}`);
        }
      });

      // Listen to chainChanged
      eth.on?.('chainChanged', (chainIdHex: string) => {
        const chainId = parseInt(chainIdHex, 16);
        const isCorrect = chainId === PENORA_TARGET_CHAIN_ID;
        this.updateState({
          chainId,
          isCorrectNetwork: isCorrect,
          status: isCorrect ? (this.state.address ? 'connected' : 'disconnected') : 'wrong_network',
        });
        if (this.state.address && isCorrect) {
          this.refreshBalance(this.state.address);
        }
      });

      // Auto-detect if already authorized in MetaMask
      eth
        .request?.({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts && accounts.length > 0) {
            this.handleAccountConnected(accounts[0] as `0x${string}`);
          }
        })
        .catch(() => {
          // silent ignore
        });
    }
  }

  public getState(): WalletState {
    return { ...this.state };
  }

  public subscribe(listener: (state: WalletState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(partial: Partial<WalletState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => {
      try {
        listener(this.getState());
      } catch (err) {
        console.error('Wallet state subscriber error:', err);
      }
    });
  }

  private async handleAccountConnected(address: `0x${string}`) {
    const eth = getEthereumProvider();
    if (!eth) return;

    try {
      const chainIdHex = await eth.request({ method: 'eth_chainId' });
      const chainId = parseInt(chainIdHex, 16);
      const isCorrect = chainId === PENORA_TARGET_CHAIN_ID;

      this.updateState({
        address,
        chainId,
        isCorrectNetwork: isCorrect,
        status: isCorrect ? 'connected' : 'wrong_network',
        error: null,
      });

      if (isCorrect) {
        await this.refreshBalance(address);
      }
    } catch (err: any) {
      this.updateState({
        address,
        status: 'error',
        error: err?.message || 'Failed to initialize account state',
      });
    }
  }

  public async refreshBalance(address: `0x${string}`) {
    try {
      const rawBalance = await publicClient.getBalance({ address });
      const balancePol = formatEther(rawBalance);
      const formattedPol = parseFloat(balancePol).toFixed(4);

      // Fetch USDT balance if configured
      const usdtInfo = await penoraUsdtService.fetchBalance(address);

      this.updateState({
        balancePol: formattedPol,
        balanceUsdt: usdtInfo.balanceFormatted,
        usdtDecimals: usdtInfo.decimals,
        isUsdtConfigured: isUsdtConfigured(),
      });
    } catch {
      // RPC or network unavailable
      this.updateState({
        balancePol: null,
        balanceUsdt: null,
      });
    }
  }

  public async connect(): Promise<void> {
    const eth = getEthereumProvider();
    if (!eth) {
      this.updateState({
        status: 'error',
        error: 'MetaMask not detected. Please install the MetaMask extension or use a Web3-compatible browser.',
      });
      return;
    }

    this.updateState({ status: 'connecting', error: null });

    try {
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        await this.handleAccountConnected(accounts[0] as `0x${string}`);
      } else {
        this.updateState({ status: 'disconnected', error: 'No account selected in wallet' });
      }
    } catch (err: any) {
      const isUserRejected = err?.code === 4001 || err?.message?.toLowerCase().includes('reject');
      const isPending = err?.code === -32002;
      let errorMsg = err?.message || 'Failed to connect wallet';
      if (isUserRejected) {
        errorMsg = 'Connection request rejected in MetaMask';
      } else if (isPending) {
        errorMsg = 'A connection request is already pending in MetaMask. Please open your extension.';
      }
      this.updateState({
        status: 'error',
        error: errorMsg,
      });
    }
  }

  public async switchOrAddAmoyNetwork(): Promise<void> {
    const eth = getEthereumProvider();
    if (!eth) return;

    const chainIdHex = `0x${PENORA_TARGET_CHAIN_ID.toString(16)}`;

    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } catch (switchError: any) {
      // 4902 indicates the chain has not been added to MetaMask
      if (switchError?.code === 4902) {
        try {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: chainIdHex,
                chainName: polygonAmoy.name,
                nativeCurrency: polygonAmoy.nativeCurrency,
                rpcUrls: [polygonAmoy.rpcUrls.default.http[0]],
                blockExplorerUrls: [polygonAmoy.blockExplorers.default.url],
              },
            ],
          });
        } catch (addError: any) {
          this.updateState({
            error: addError?.message || 'Failed to add Polygon Amoy to wallet',
          });
        }
      } else {
        this.updateState({
          error: switchError?.message || 'Failed to switch network',
        });
      }
    }
  }

  public disconnect() {
    this.updateState({
      status: 'disconnected',
      address: null,
      balancePol: null,
      balancePnr: null,
      balancePp: null,
      balanceUsdt: null,
      votingManaPercent: null,
      powerDownSchedule: null,
      error: null,
    });
  }
}

export const penoraWalletService = new PenoraWalletService();

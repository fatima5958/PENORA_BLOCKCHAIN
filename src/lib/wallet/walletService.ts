// src/lib/wallet/walletService.ts
// PENORA Blockchain — EVM Wallet Service for Polygon Amoy (Chain ID 80002)
// Clean separation of PENORA authority keys from EVM Web3 wallet keys.
import { createPublicClient, http, formatEther } from 'viem';
import { polygonAmoy, PENORA_TARGET_CHAIN_ID, AMOY_RPC_URL } from './chain';
import type { WalletState } from './types';
import { isUsdtConfigured } from './contracts';
import { penoraUsdtService, penoraPnrService } from './usdtService';

// Create a public viem client for querying Polygon Amoy testnet
export const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(AMOY_RPC_URL, { timeout: 10_000, retryCount: 1 }),
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

export const INITIAL_WALLET_STATE: WalletState = {
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


class PenoraWalletService {
  private state: WalletState = { ...INITIAL_WALLET_STATE };

  private listeners: Set<(state: WalletState) => void> = new Set();
  private isInitialized = false;
  private accountVersion = 0;
  private balanceVersion = 0;

  private clearBalances(): Partial<WalletState> {
    return { balancePol: null, balancePnr: null, balancePp: null, balanceUsdt: null,
      votingManaPercent: null, powerDownSchedule: null, contractsDeployed: false };
  }

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
    const eth = getEthereumProvider();
    if (eth) {
      this.isInitialized = true;
      // Listen to accountsChanged
      eth.on?.('accountsChanged', (accounts: string[]) => {
        if (!accounts || accounts.length === 0) {
          this.disconnect();
        } else {
          this.handleAccountConnected(accounts[0] as `0x${string}`);
        }
      });

      // Listen to chainChanged
      eth.on?.('chainChanged', (chainIdHex: string) => {
        const chainId = parseInt(chainIdHex, 16);
        const isCorrect = chainId === PENORA_TARGET_CHAIN_ID;
        this.accountVersion++;
        this.balanceVersion++;
        this.updateState({
          ...this.clearBalances(),
          chainId,
          isCorrectNetwork: isCorrect,
          status: isCorrect ? (this.state.address ? 'connected' : 'disconnected') : 'wrong_network',
        });
        if (this.state.address && isCorrect) {
          this.refreshBalance(this.state.address);
        }
      });

      // Ignore a late auto-detection after disconnect or another connection.
      const detectedVersion = this.accountVersion;
      eth
        .request?.({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (detectedVersion !== this.accountVersion) return;
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

    const version = ++this.accountVersion;
    this.balanceVersion++;
    this.updateState({ ...this.clearBalances(), address, isCorrectNetwork: false, status: 'loading' });
    try {
      const chainIdHex = await eth.request({ method: 'eth_chainId' });
      if (version !== this.accountVersion) return;
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
      if (version !== this.accountVersion) return;
      this.updateState({
        address,
        status: 'error',
        error: err?.message || 'Failed to initialize account state',
      });
    }
  }

  public async refreshBalance(address: `0x${string}`) {
    if (this.state.address !== address || !this.state.isCorrectNetwork) return;
    const version = ++this.balanceVersion;
    const isCurrent = () => version === this.balanceVersion && this.state.address === address && this.state.isCorrectNetwork;
    try {
      const rawBalance = await publicClient.getBalance({ address });
      const balancePol = formatEther(rawBalance);
      const formattedPol = parseFloat(balancePol).toFixed(4);

      // Fetch USDT balance if configured
      const [usdtInfo, pnrInfo] = await Promise.all([penoraUsdtService.fetchBalance(address), penoraPnrService.fetchBalance(address)]);

      if (!isCurrent()) return;
      this.updateState({
        balancePol: formattedPol,
        balancePnr: pnrInfo.balanceFormatted,
        balanceUsdt: usdtInfo.balanceFormatted,
        usdtDecimals: usdtInfo.decimals,
        isUsdtConfigured: isUsdtConfigured(),
      });
    } catch {
      // RPC or network unavailable
      if (!isCurrent()) return;
      this.updateState({
        balancePol: null,
        balancePnr: null,
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

    this.init();
    const version = ++this.accountVersion;
    this.balanceVersion++;
    this.updateState({ status: 'connecting', error: null });

    try {
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      if (version !== this.accountVersion) return;
      if (accounts && accounts.length > 0) {
        await this.handleAccountConnected(accounts[0] as `0x${string}`);
      } else {
        this.updateState({ status: 'disconnected', error: 'No account selected in wallet' });
      }
    } catch (err: any) {
      if (version !== this.accountVersion) return;
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
    this.accountVersion++;
    this.balanceVersion++;
    this.updateState({
      ...this.clearBalances(),
      chainId: null,
      isCorrectNetwork: false,
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

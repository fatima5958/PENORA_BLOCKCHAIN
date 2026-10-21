// src/lib/wallet/usdtService.ts
// PENORA Blockchain — Real USDT Service for Polygon Amoy Testnet (Chain ID 80002)
// Handles real ERC-20 USDT balances, gas fee estimation, transfers, deposit event watching, and strict allowlists.

import {
  formatUnits,
  encodeFunctionData,
  isAddress,
  type Hash,
  type Address,
  formatEther,
  decodeEventLog,
} from 'viem';
import { publicClient, getEthereumProvider } from './walletService';
import {
  PENORA_CONTRACT_ADDRESSES,
  isUsdtConfigured,
  isConfiguredAddress,
  isTokenAddressAllowed,
  ERC20_USDT_ABI,
} from './contracts';
import { PENORA_TARGET_CHAIN_ID, POLYGON_AMOY_CONFIG } from './chain';
import { parseTokenAmount } from './amount';
import { waitForWalletTransaction } from './transactionReceipt';
import type { WalletTransaction, UsdtGasEstimate } from './types';

export class PenoraUsdtService {
  private isSubmitting = false;

  constructor(public readonly symbol: 'USDT' | 'PNR' = 'USDT') {}

  private get defaultDecimals() { return this.symbol === 'USDT' ? 6 : 18; }

  private confirmsTransfer(receipt: { logs: readonly any[] }, contract: string, from: string, to: string, amount: bigint): boolean {
    return receipt.logs.some(log => {
      if (log.address?.toLowerCase() !== contract.toLowerCase()) return false;
      try {
        const event = decodeEventLog({ abi: ERC20_USDT_ABI, data: log.data, topics: log.topics });
        if (event.eventName !== 'Transfer') return false;
        const args = event.args as { from: string; to: string; value: bigint };
        return args.from.toLowerCase() === from.toLowerCase() && args.to.toLowerCase() === to.toLowerCase() && args.value === amount;
      } catch { return false; }
    });
  }

  /**
   * Retrieves active USDT contract address for the current environment.
   */
  public getContractAddress(): `0x${string}` | null {
    const address = this.symbol === 'USDT' ? PENORA_CONTRACT_ADDRESSES.USDT_TOKEN : PENORA_CONTRACT_ADDRESSES.PNR_TOKEN;
    return isConfiguredAddress(address) ? address.toLowerCase() as `0x${string}` : null;
  }

  /**
   * Reads token decimals directly from verified ERC-20 contract (standard USDT is 6).
   */
  public async fetchDecimals(contractAddress?: `0x${string}`): Promise<number> {
    const targetAddress = contractAddress || this.getContractAddress();
    if (!targetAddress) return this.defaultDecimals;

    try {
      const decimals = (await publicClient.readContract({
        address: targetAddress,
        abi: ERC20_USDT_ABI,
        functionName: 'decimals',
      })) as number;
      const value = Number(decimals);
      if (!Number.isInteger(value) || value < 0 || value > 255) throw new Error('Invalid token decimals');
      return value;
    } catch {
      throw new Error(`Unable to verify ${this.symbol} decimals. Please retry when the network is available.`);
    }
  }

  /**
   * Reads real onchain USDT balance directly from verified ERC-20 contract.
   */
  public async fetchBalance(
    userAddress: `0x${string}`,
    contractAddress?: `0x${string}`
  ): Promise<{
    balanceFormatted: string | null;
    balanceRaw: bigint | null;
    decimals: number;
  }> {
    const targetAddress = contractAddress || this.getContractAddress();
    if (!targetAddress) {
      return { balanceFormatted: null, balanceRaw: null, decimals: this.defaultDecimals };
    }

    try {
      const decimals = await this.fetchDecimals(targetAddress);
      const rawBalance = (await publicClient.readContract({
        address: targetAddress,
        abi: ERC20_USDT_ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      })) as bigint;

      return {
        balanceFormatted: formatUnits(rawBalance, decimals),
        balanceRaw: rawBalance,
        decimals,
      };
    } catch (err) {
      console.warn('Failed to read USDT balance from RPC:', err);
      return { balanceFormatted: null, balanceRaw: null, decimals: this.defaultDecimals };
    }
  }

  /**
   * Estimates gas fees in POL and Gwei for an ERC-20 USDT transfer.
   */
  public async estimateGas(
    fromAddress: `0x${string}`,
    recipient: `0x${string}`,
    amountFormatted: string,
    contractAddress?: `0x${string}`
  ): Promise<UsdtGasEstimate> {
    const targetAddress = contractAddress || this.getContractAddress();
    if (!targetAddress) {
      throw new Error(`${this.symbol} contract is not configured on Polygon Amoy.`);
    }

    if (!isAddress(recipient) || recipient === '0x0000000000000000000000000000000000000000') {
      throw new Error('Invalid recipient address.');
    }

    const decimals = await this.fetchDecimals(targetAddress);
    const parsedAmount = parseTokenAmount(amountFormatted, decimals);

    const callData = encodeFunctionData({
      abi: ERC20_USDT_ABI,
      functionName: 'transfer',
      args: [recipient, parsedAmount],
    });

    // Estimate gas limit
    const gasLimit = await publicClient.estimateGas({
      account: fromAddress,
      to: targetAddress,
      data: callData,
    });

    // Estimate fees per gas
    const fees = await publicClient.estimateFeesPerGas();
    const gasPrice = fees.maxFeePerGas || fees.gasPrice || 25000000000n; // fallback 25 gwei
    const estimatedCostWei = gasLimit * gasPrice;

    return {
      gasLimit,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      estimatedCostPol: formatEther(estimatedCostWei),
      estimatedCostGwei: formatUnits(gasPrice, 9),
    };
  }

  /**
   * Sends real USDT from connected wallet to destination address via MetaMask.
   * Enforces exact integer arithmetic, network checks, and duplicate-submission guards.
   */
  public async executeSendUsdt(
    recipient: string,
    amountFormatted: string,
    overrideContract?: `0x${string}`,
    expectedAddress?: string
  ): Promise<{
    hash: Hash;
    status: 'confirmed' | 'pending' | 'failed';
    amount: string;
    recipient: string;
    explorerUrl: string;
  }> {
    if (this.isSubmitting) {
      throw new Error('A transfer is already in progress. Please wait for confirmation.');
    }

    this.isSubmitting = true;
    try {
      const eth = getEthereumProvider();
      if (!eth) throw new Error('MetaMask or Web3 wallet extension not detected.');

      const accounts = await eth.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0) throw new Error('Wallet is not connected.');
      const userAddress = accounts[0] as `0x${string}`;
      if (expectedAddress && userAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
        throw new Error('Wallet account changed. Please review the transfer again.');
      }

      // 1. Verify Network
      const chainIdHex = await eth.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chainIdHex, 16);
      if (currentChainId !== PENORA_TARGET_CHAIN_ID) {
        throw new Error(
          `Incorrect network (Chain ID ${currentChainId}). Please switch to Polygon Amoy Testnet (Chain ID 80002).`
        );
      }

      // 2. Resolve Contract & Verify Allowlist
      const targetContract = overrideContract || this.getContractAddress();
      if (!targetContract) {
        throw new Error(`${this.symbol} contract is not configured on Polygon Amoy testnet.`);
      }
      if (!(this.symbol === 'USDT' ? isTokenAddressAllowed(currentChainId, targetContract) : targetContract.toLowerCase() === this.getContractAddress())) {
        throw new Error(`Token contract ${targetContract} is not on the verified allowlist for Polygon Amoy.`);
      }

      // 3. Validate Recipient Address
      const trimmedRecipient = recipient.trim();
      if (!isAddress(trimmedRecipient)) {
        throw new Error('Invalid recipient EVM address. Please enter a valid 0x hexadecimal address.');
      }
      if (trimmedRecipient.toLowerCase() === '0x0000000000000000000000000000000000000000') {
        throw new Error(`Cannot send ${this.symbol} to the zero / burn address.`);
      }
      if (trimmedRecipient.toLowerCase() === userAddress.toLowerCase()) {
        throw new Error('Recipient address cannot be your own wallet address.');
      }

      // 4. Validate Amount and Available Balance
      const decimals = await this.fetchDecimals(targetContract);
      const parsedAmount = parseTokenAmount(amountFormatted, decimals);

      const { balanceRaw } = await this.fetchBalance(userAddress, targetContract);
      if (balanceRaw === null || balanceRaw < parsedAmount) {
        const balanceStr = balanceRaw !== null ? formatUnits(balanceRaw, decimals) : '0';
        throw new Error(`Insufficient ${this.symbol} balance. Available: ${balanceStr} ${this.symbol}, requested: ${amountFormatted} ${this.symbol}.`);
      }

      // 5. Check Native POL for Gas Fees
      const nativeBal = await publicClient.getBalance({ address: userAddress });
      if (nativeBal === 0n) {
        throw new Error('Insufficient POL for gas. You need native POL on Polygon Amoy to pay blockchain transaction fees.');
      }

      // 6. Execute Transfer with Mutex Lock
      const transferData = encodeFunctionData({
        abi: ERC20_USDT_ABI,
        functionName: 'transfer',
        args: [trimmedRecipient as Address, parsedAmount],
      });

      const activeAccounts = await eth.request({ method: 'eth_accounts' });
      const activeChain = await eth.request({ method: 'eth_chainId' });
      if (Number(activeChain) !== PENORA_TARGET_CHAIN_ID || activeAccounts?.[0]?.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error('Wallet account or network changed. Please review the transfer again.');
      }
      const txHash: Hash = await eth.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: userAddress,
            to: targetContract,
            data: transferData,
          },
        ],
      });

      const explorerUrl = `${POLYGON_AMOY_CONFIG.blockExplorers[0]}/tx/${txHash}`;

      // Save pending transaction to local history
      this.recordLocalTransaction({
        id: `tx_${Date.now()}_${txHash.slice(0, 8)}`,
        hash: txHash,
        type: this.symbol === 'USDT' ? 'send_usdt' : 'transfer_out',
        amount: amountFormatted,
        symbol: this.symbol,
        status: 'pending',
        timestamp: new Date().toISOString(),
        from: userAddress,
        to: trimmedRecipient,
        explorerUrl,
      });

      // Wait for receipt onchain
      const result = await waitForWalletTransaction(txHash);
      if (result.status === 'pending') {
        return { hash: result.hash, status: 'pending', amount: amountFormatted, recipient: trimmedRecipient, explorerUrl };
      }
      // ERC-20 contracts may return false without reverting. Verify the actual token movement.
      const finalStatus = result.status === 'confirmed' && result.receipt &&
        this.confirmsTransfer(result.receipt, targetContract, userAddress, trimmedRecipient, parsedAmount)
        ? 'confirmed' : 'failed';
      this.updateLocalTransactionStatus(txHash, finalStatus, result.hash);

      return {
        hash: result.hash,
        status: finalStatus,
        amount: amountFormatted,
        recipient: trimmedRecipient,
        explorerUrl: `${POLYGON_AMOY_CONFIG.blockExplorers[0]}/tx/${result.hash}`,
      };
    } catch (err: any) {
      if (err?.code === 4001 || err?.message?.includes('User rejected')) {
        throw new Error('Transaction was rejected in MetaMask.');
      }
      throw new Error(err?.message || 'Failed to execute USDT transfer.');
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Fetches real onchain incoming/outgoing Transfer events for the user.
   */
  public async fetchTransferLogs(
    userAddress: `0x${string}`,
    contractAddress?: `0x${string}`
  ): Promise<WalletTransaction[]> {
    const targetAddress = contractAddress || this.getContractAddress();
    if (!targetAddress) return this.getLocalTransactions(userAddress);

    try {
      const decimals = await this.fetchDecimals(targetAddress);
      const currentBlock = await publicClient.getBlockNumber();
      // Look back 10,000 blocks (~5.5 hours on Polygon Amoy) to avoid testnet RPC query size limits
      const fromBlock = currentBlock > 10000n ? currentBlock - 10000n : 0n;

      // 1. Incoming Transfer events
      const incomingLogs = await publicClient.getLogs({
        address: targetAddress,
        event: {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' },
          ],
        },
        args: { to: userAddress },
        fromBlock,
      });

      // 2. Outgoing Transfer events
      const outgoingLogs = await publicClient.getLogs({
        address: targetAddress,
        event: {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' },
          ],
        },
        args: { from: userAddress },
        fromBlock,
      });

      const onchainTxs: WalletTransaction[] = [];
      const blockTimes = new Map<bigint, Promise<string>>();
      const timestampFor = (blockNumber: bigint) => {
        let promise = blockTimes.get(blockNumber);
        if (!promise) {
          promise = publicClient.getBlock({ blockNumber }).then(block => new Date(Number(block.timestamp) * 1000).toISOString());
          blockTimes.set(blockNumber, promise);
        }
        return promise;
      };

      for (const log of incomingLogs) {
        if (!log.args.value || !log.transactionHash) continue;
        onchainTxs.push({
          id: `onchain_${log.transactionHash}_${log.logIndex}`,
          hash: log.transactionHash,
          type: this.symbol === 'USDT' ? 'deposit_usdt' : 'transfer_in',
          amount: formatUnits(log.args.value, decimals),
          symbol: this.symbol,
          status: 'confirmed',
          timestamp: await timestampFor(log.blockNumber!),
          from: log.args.from,
          to: userAddress,
          explorerUrl: `${POLYGON_AMOY_CONFIG.blockExplorers[0]}/tx/${log.transactionHash}`,
        });
      }

      for (const log of outgoingLogs) {
        if (!log.args.value || !log.transactionHash) continue;
        onchainTxs.push({
          id: `onchain_${log.transactionHash}_${log.logIndex}`,
          hash: log.transactionHash,
          type: this.symbol === 'USDT' ? 'send_usdt' : 'transfer_out',
          amount: formatUnits(log.args.value, decimals),
          symbol: this.symbol,
          status: 'confirmed',
          timestamp: await timestampFor(log.blockNumber!),
          from: userAddress,
          to: log.args.to,
          explorerUrl: `${POLYGON_AMOY_CONFIG.blockExplorers[0]}/tx/${log.transactionHash}`,
        });
      }

      // Merge with locally tracked transactions to preserve pending status and deduplicate by hash
      const localTxs = await Promise.all(this.getLocalTransactions(userAddress).map(async tx => {
        if (tx.status !== 'pending') return tx;
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash as Hash });
          const rawAmount = parseTokenAmount(tx.amount, decimals);
          const status = receipt.status === 'success' && tx.from && tx.to &&
            this.confirmsTransfer(receipt, targetAddress, tx.from, tx.to, rawAmount)
            ? 'confirmed' as const : 'failed' as const;
          this.updateLocalTransactionStatus(tx.hash as Hash, status);
          return { ...tx, status };
        } catch { return tx; }
      }));
      const map = new Map<string, WalletTransaction>();

      for (const tx of onchainTxs) {
        map.set(tx.hash.toLowerCase(), tx);
      }
      for (const tx of localTxs) {
        if (!map.has(tx.hash.toLowerCase())) {
          map.set(tx.hash.toLowerCase(), tx);
        }
      }

      return Array.from(map.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (err) {
      console.warn('Could not query onchain Transfer events from testnet RPC:', err);
      return this.getLocalTransactions(userAddress);
    }
  }

  /**
   * Sets up real-time listener for incoming USDT deposits to user's address.
   */
  public watchIncomingTransfers(
    userAddress: `0x${string}`,
    onDeposit: (tx: WalletTransaction) => void,
    contractAddress?: `0x${string}`
  ): () => void {
    const targetAddress = contractAddress || this.getContractAddress();
    if (!targetAddress) return () => {};

    try {
      const unwatch = publicClient.watchContractEvent({
        address: targetAddress,
        abi: ERC20_USDT_ABI,
        eventName: 'Transfer',
        args: { to: userAddress },
        onLogs: async logs => {
          let decimals: number;
          try { decimals = await this.fetchDecimals(targetAddress); } catch { return; }
          for (const log of logs) {
            if (log.removed) continue;
            const rawVal = (log as any).args?.value;
            const txHash = log.transactionHash;
            if (rawVal && txHash) {
              const amountStr = formatUnits(rawVal, decimals);
              const tx: WalletTransaction = {
                id: `incoming_${txHash}_${log.logIndex}`,
                hash: txHash,
                type: this.symbol === 'USDT' ? 'deposit_usdt' : 'transfer_in',
                amount: amountStr,
                symbol: this.symbol,
                status: 'confirmed',
                timestamp: new Date().toISOString(),
                from: (log as any).args?.from,
                to: userAddress,
                explorerUrl: `${POLYGON_AMOY_CONFIG.blockExplorers[0]}/tx/${txHash}`,
              };
              this.recordLocalTransaction(tx);
              onDeposit(tx);
            }
          }
        },
      });

      return unwatch;
    } catch {
      return () => {};
    }
  }

  // ── Local Storage Helpers ──────────────────────────────────────────────────
  private getStorageKey(userAddress?: string): string {
    const prefix = `penora_80002_${this.symbol.toLowerCase()}_${this.getContractAddress() ?? 'unconfigured'}_txs`;
    return userAddress ? `${prefix}_${userAddress.toLowerCase()}` : prefix;
  }

  public getLocalTransactions(userAddress?: `0x${string}`): WalletTransaction[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.getStorageKey(userAddress));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(tx =>
        tx && /^0x[0-9a-f]{64}$/i.test(tx.hash) && tx.symbol === this.symbol &&
        ['pending', 'confirmed', 'failed'].includes(tx.status) && typeof tx.amount === 'string' &&
        typeof tx.timestamp === 'string' && Number.isFinite(Date.parse(tx.timestamp)) &&
        (!userAddress || (tx.from?.toLowerCase() === userAddress.toLowerCase() || tx.to?.toLowerCase() === userAddress.toLowerCase()))
      ).map(tx => ({ ...tx, explorerUrl: `${POLYGON_AMOY_CONFIG.blockExplorers[0]}/tx/${tx.hash}` })) : [];
    } catch {
      return [];
    }
  }

  public recordLocalTransaction(tx: WalletTransaction): void {
    if (typeof window === 'undefined') return;
    try {
      const owner = (tx.type === 'deposit_usdt' || tx.type === 'transfer_in') ? tx.to : tx.from;
      if (!owner) return;
      const current = this.getLocalTransactions(owner as `0x${string}`);
      const updated = [tx, ...current.filter(t => t.hash.toLowerCase() !== tx.hash.toLowerCase())].slice(0, 50);
      localStorage.setItem(this.getStorageKey(owner), JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
  }

  public updateLocalTransactionStatus(
    txHash: Hash,
    status: 'confirmed' | 'failed',
    replacementHash?: Hash
  ): void {
    if (typeof window === 'undefined') return;
    try {
      // Find across keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.getStorageKey())) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const txs: WalletTransaction[] = JSON.parse(raw);
            let changed = false;
            const updated = txs.map(t => {
              if (t.hash.toLowerCase() === txHash.toLowerCase()) {
                changed = true;
                const hash = replacementHash ?? t.hash;
                return { ...t, hash, status, explorerUrl: `${POLYGON_AMOY_CONFIG.blockExplorers[0]}/tx/${hash}` };
              }
              return t;
            });
            if (changed) {
              localStorage.setItem(key, JSON.stringify(updated));
            }
          }
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }
}

export const penoraUsdtService = new PenoraUsdtService();

/** Shares the ERC-20 lifecycle, with a distinct contract, precision and history namespace. */
export const penoraPnrService = new PenoraUsdtService('PNR');

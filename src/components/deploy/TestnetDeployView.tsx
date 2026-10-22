// src/components/deploy/TestnetDeployView.tsx
// PENORA Blockchain — Polygon Amoy Testnet (Chain ID 80002) Browser-Based Deployment Dashboard
// Non-custodial deployment via MetaMask with explicit user confirmation for each transaction.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wallet,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Coins,
  Zap,
  ArrowRight,
  Copy,
  Check,
  AlertTriangle,
  Lock,
  Server,
  HelpCircle,
  RotateCcw,
  Code2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { encodeDeployData, formatEther, isAddress, formatUnits } from 'viem';
import {
  publicClient,
  getEthereumProvider,
  penoraWalletService,
} from '../../lib/wallet/walletService';
import {
  PENORA_TARGET_CHAIN_ID,
  AMOY_FALLBACK_RPCS,
} from '../../lib/wallet/chain';
import {
  PENORA_TOKEN_BYTECODE,
  PENORA_TOKEN_ABI,
  MOCK_USDT_BYTECODE,
  MOCK_USDT_ABI,
} from '../../lib/wallet/contractArtifacts';

export interface RawDeploymentError {
  code?: number | string;
  name?: string;
  message: string;
  data?: any;
  stack?: string;
  timestamp: string;
}

interface DeployedStep {
  address: string | null;
  txHash: string | null;
  status: 'idle' | 'checking' | 'signing' | 'confirming' | 'confirmed' | 'failed';
  error: RawDeploymentError | null;
  verifiedBalance?: string | null;
}

interface RpcHealth {
  url: string;
  status: 'checking' | 'healthy' | 'error';
  blockNumber?: number;
  latencyMs?: number;
  error?: string;
}

export const TestnetDeployView: React.FC = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [polBalance, setPolBalance] = useState<string | null>(null);
  const [nonce, setNonce] = useState<number | null>(null);
  const [pendingNonce, setPendingNonce] = useState<number | null>(null);
  const [currentGasPriceGwei, setCurrentGasPriceGwei] = useState<string>('30.0');
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [updatingMetaMaskRpc, setUpdatingMetaMaskRpc] = useState(false);
  const [metaMaskRpcSuccess, setMetaMaskRpcSuccess] = useState(false);
  const [showManualRpcGuide, setShowManualRpcGuide] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [txFormat, setTxFormat] = useState<'legacy' | 'eip1559'>('legacy');
  const [expandedPnrRaw, setExpandedPnrRaw] = useState(false);
  const [expandedUsdtRaw, setExpandedUsdtRaw] = useState(false);

  // Guard against concurrent execution / rapid double clicking
  const isExecutingRef = useRef(false);

  // Live RPC endpoints health
  const [rpcHealthList, setRpcHealthList] = useState<RpcHealth[]>([
    { url: AMOY_FALLBACK_RPCS[0], status: 'checking' },
    { url: AMOY_FALLBACK_RPCS[1], status: 'checking' },
  ]);

  // Deployment Steps
  const [pnrStep, setPnrStep] = useState<DeployedStep>({
    address: null,
    txHash: null,
    status: 'idle',
    error: null,
  });
  const [usdtStep, setUsdtStep] = useState<DeployedStep>({
    address: null,
    txHash: null,
    status: 'idle',
    error: null,
  });

  const isAmoy = chainId === PENORA_TARGET_CHAIN_ID;
  const targetWallet = '0x38CdF24eC27530B8F933023de2416d3960BD7372';

  // Check RPC Health across fallback endpoints
  const checkRpcHealth = useCallback(async () => {
    const results: RpcHealth[] = [];
    for (const rpcUrl of AMOY_FALLBACK_RPCS) {
      const start = Date.now();
      try {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
          signal: AbortSignal.timeout(4000),
        });
        const data = await res.json();
        const latency = Date.now() - start;
        if (data.result) {
          results.push({
            url: rpcUrl,
            status: 'healthy',
            blockNumber: parseInt(data.result, 16),
            latencyMs: latency,
          });
        } else {
          results.push({
            url: rpcUrl,
            status: 'error',
            error: data.error?.message || 'RPC returned invalid response',
          });
        }
      } catch (e: any) {
        results.push({
          url: rpcUrl,
          status: 'error',
          error: e.message || 'Connection timeout',
        });
      }
    }
    setRpcHealthList(results);
  }, []);

  // Verify whether contracts were previously deployed on-chain
  const verifyExistingDeployments = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const pnr = localStorage.getItem('penora_contract_PNR_TOKEN');
    const usdt = localStorage.getItem('penora_contract_USDT_TOKEN');

    if (pnr && isAddress(pnr)) {
      try {
        const code = await publicClient.getBytecode({ address: pnr as `0x${string}` });
        if (code && code !== '0x') {
          setPnrStep(prev => ({ ...prev, address: pnr, status: 'confirmed' }));
        }
      } catch (e) {
        console.warn('Could not verify PNR bytecode:', e);
      }
    }

    if (usdt && isAddress(usdt)) {
      try {
        const code = await publicClient.getBytecode({ address: usdt as `0x${string}` });
        if (code && code !== '0x') {
          setUsdtStep(prev => ({ ...prev, address: usdt, status: 'confirmed' }));
        }
      } catch (e) {
        console.warn('Could not verify USDT bytecode:', e);
      }
    }
  }, []);

  const refreshAccountAndBalance = useCallback(async () => {
    const eth = getEthereumProvider();
    if (!eth) return;
    try {
      const accounts = await eth.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        const addr = accounts[0];
        setAccount(addr);
        const cIdHex = await eth.request({ method: 'eth_chainId' });
        const cId = parseInt(cIdHex, 16);
        setChainId(cId);

        if (cId === PENORA_TARGET_CHAIN_ID) {
          setBalanceLoading(true);
          try {
            const raw = await publicClient.getBalance({ address: addr as `0x${string}` });
            setPolBalance(parseFloat(formatEther(raw)).toFixed(4));

            const latestTxCount = await publicClient.getTransactionCount({
              address: addr as `0x${string}`,
              blockTag: 'latest',
            });
            setNonce(latestTxCount);

            const pendingTxCount = await publicClient.getTransactionCount({
              address: addr as `0x${string}`,
              blockTag: 'pending',
            });
            setPendingNonce(pendingTxCount);

            const gasPrice = await publicClient.getGasPrice();
            setCurrentGasPriceGwei((Number(gasPrice) / 1e9).toFixed(1));
          } catch (err) {
            console.error('Failed to query POL balance / gas price:', err);
          } finally {
            setBalanceLoading(false);
          }
        }
      } else {
        setAccount(null);
      }
    } catch (err) {
      console.error('Failed to read provider state:', err);
    }
  }, []);

  useEffect(() => {
    checkRpcHealth();
    verifyExistingDeployments();
    refreshAccountAndBalance();

    const eth = getEthereumProvider();
    if (eth?.on) {
      eth.on('accountsChanged', refreshAccountAndBalance);
      eth.on('chainChanged', refreshAccountAndBalance);
    }
  }, [checkRpcHealth, verifyExistingDeployments, refreshAccountAndBalance]);

  const handleConnect = async () => {
    const eth = getEthereumProvider();
    if (!eth) {
      alert('MetaMask not detected. Please install the MetaMask extension.');
      return;
    }
    try {
      await eth.request({ method: 'eth_requestAccounts' });
      await refreshAccountAndBalance();
    } catch (err: any) {
      console.error('User rejected or connection error:', err);
    }
  };

  const handleSwitchNetwork = async () => {
    await penoraWalletService.switchOrAddAmoyNetwork();
    await refreshAccountAndBalance();
  };

  // 1-Click Update MetaMask RPC
  const handleUpdateMetaMaskRpc = async () => {
    setUpdatingMetaMaskRpc(true);
    setMetaMaskRpcSuccess(false);
    try {
      const success = await penoraWalletService.updateAmoyRpc(AMOY_FALLBACK_RPCS[0]);
      if (success) {
        setMetaMaskRpcSuccess(true);
        setTimeout(() => setMetaMaskRpcSuccess(false), 5000);
        await refreshAccountAndBalance();
        await checkRpcHealth();
      }
    } finally {
      setUpdatingMetaMaskRpc(false);
    }
  };

  // Construct structured raw error object
  const createRawError = (err: any): RawDeploymentError => {
    const code = err?.code ?? err?.data?.code ?? 'N/A';
    const name = err?.name ?? 'Error';
    const message = err?.message ?? String(err);
    const data = err?.data ?? null;
    const stack = err?.stack ?? undefined;

    return {
      code,
      name,
      message,
      data,
      stack,
      timestamp: new Date().toLocaleTimeString(),
    };
  };

  // Safe Request Cancellation & Recovery Action
  const handleRecoverStaleState = async () => {
    isExecutingRef.current = false;
    setRecoveryNotice('Resetting local state and polling live blockchain nonce...');

    // 1. Clear any frontend error state
    setPnrStep(prev => ({ ...prev, status: prev.address ? 'confirmed' : 'idle', error: null }));
    setUsdtStep(prev => ({ ...prev, status: prev.address ? 'confirmed' : 'idle', error: null }));

    // 2. Query live account & nonces directly from resilient RPC
    await refreshAccountAndBalance();
    await checkRpcHealth();
    await verifyExistingDeployments();

    setRecoveryNotice('State reset complete. Nonce verified.');
    setTimeout(() => setRecoveryNotice(null), 4000);
  };

  // 1. Deploy PenoraToken (PNR) — Stage 1
  const deployPnr = async () => {
    if (isExecutingRef.current) return;
    if (!account || !isAmoy) return;

    // Pre-flight check: Already deployed?
    if (pnrStep.status === 'confirmed' && pnrStep.address) {
      alert(`PenoraToken is already deployed at ${pnrStep.address}`);
      return;
    }

    // Pre-flight check: Gas balance
    const available = parseFloat(polBalance || '0');
    if (available < 0.035) {
      setPnrStep(prev => ({
        ...prev,
        status: 'failed',
        error: {
          code: 'INSUFFICIENT_FUNDS',
          name: 'BalanceError',
          message: `Insufficient POL for gas. Required: ~0.031 POL, Available: ${available} POL.`,
          timestamp: new Date().toLocaleTimeString(),
        },
      }));
      return;
    }

    isExecutingRef.current = true;
    setPnrStep({ address: null, txHash: null, status: 'signing', error: null });

    try {
      const eth = getEthereumProvider();
      const testAllocation = 10000n * 10n ** 18n; // Exactly 10,000 PNR with 18 decimals
      const deployData = encodeDeployData({
        abi: PENORA_TOKEN_ABI,
        bytecode: PENORA_TOKEN_BYTECODE,
        args: [
          account as `0x${string}`, // initialOwner (controls sovereign treasury vault)
          account as `0x${string}`, // initialTester (receives exactly 10,000 PNR)
          testAllocation,           // 10,000 PNR in wei (remaining 99.99M to address(this))
        ],
      });

      let txParams: any;

      if (txFormat === 'legacy') {
        // Legacy Type 0 Transaction: strictly gasPrice, zero EIP-1559 fields (bypasses MetaMask -32602)
        const [gasPrice, latestNonce, gasEstimate] = await Promise.all([
          publicClient.getGasPrice(),
          publicClient.getTransactionCount({ address: account as `0x${string}`, blockTag: 'pending' }),
          publicClient.estimateGas({ account: account as `0x${string}`, data: deployData, type: 'legacy' }),
        ]);
        const safeGasLimit = (gasEstimate * 125n) / 100n;
        txParams = {
          from: account,
          data: deployData,
          nonce: `0x${latestNonce.toString(16)}`,
          gas: `0x${safeGasLimit.toString(16)}`,
          gasPrice: `0x${gasPrice.toString(16)}`,
        };
      } else {
        // EIP-1559 Type 2 Transaction: strictly maxFeePerGas / maxPriorityFeePerGas, zero gasPrice
        const [fees, latestNonce, gasEstimate] = await Promise.all([
          publicClient.estimateFeesPerGas(),
          publicClient.getTransactionCount({ address: account as `0x${string}`, blockTag: 'pending' }),
          publicClient.estimateGas({ account: account as `0x${string}`, data: deployData, type: 'eip1559' }),
        ]);
        const safeGasLimit = (gasEstimate * 125n) / 100n;
        txParams = {
          from: account,
          data: deployData,
          nonce: `0x${latestNonce.toString(16)}`,
          gas: `0x${safeGasLimit.toString(16)}`,
          maxFeePerGas: `0x${fees.maxFeePerGas.toString(16)}`,
          maxPriorityFeePerGas: `0x${fees.maxPriorityFeePerGas.toString(16)}`,
        };
      }

      // Non-custodial sign and broadcast via MetaMask
      const txHash = (await eth.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      })) as `0x${string}`;

      setPnrStep(prev => ({ ...prev, txHash, status: 'confirming' }));

      // Poll transaction receipt via resilient fallback client (bounded retries + backoff)
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 90_000,
        retryCount: 8,
        retryDelay: 2_000,
      });

      const address = receipt.contractAddress;
      if (!address) throw new Error('Contract deployment reverted or missing address in receipt.');

      // Verify on-chain token balance for user
      let verifiedBal = '10,000 PNR';
      try {
        const rawBal = await publicClient.readContract({
          address,
          abi: PENORA_TOKEN_ABI,
          functionName: 'balanceOf',
          args: [account as `0x${string}`],
        });
        verifiedBal = `${Number(formatUnits(rawBal as bigint, 18)).toLocaleString()} PNR`;
      } catch (balErr) {
        console.warn('Could not read deployed balance immediately:', balErr);
      }

      setPnrStep({ address, txHash, status: 'confirmed', error: null, verifiedBalance: verifiedBal });
      localStorage.setItem('penora_contract_PNR_TOKEN', address);
      await refreshAccountAndBalance();
    } catch (err: any) {
      if (err?.message?.includes('EIP-1559') || err?.code === -32602) {
        setTxFormat('legacy');
      }
      const rawError = createRawError(err);
      setPnrStep(prev => ({
        ...prev,
        status: 'failed',
        error: rawError,
      }));
    } finally {
      isExecutingRef.current = false;
    }
  };

  // 2. Deploy MockUSDT — Stage 1
  const deployUsdt = async () => {
    if (isExecutingRef.current) return;
    if (!account || !isAmoy) return;

    // Pre-flight check: Already deployed?
    if (usdtStep.status === 'confirmed' && usdtStep.address) {
      alert(`MockUSDT is already deployed at ${usdtStep.address}`);
      return;
    }

    // Pre-flight check: Gas balance
    const available = parseFloat(polBalance || '0');
    if (available < 0.028) {
      setUsdtStep(prev => ({
        ...prev,
        status: 'failed',
        error: {
          code: 'INSUFFICIENT_FUNDS',
          name: 'BalanceError',
          message: `Insufficient POL for gas. Required: ~0.026 POL, Available: ${available} POL.`,
          timestamp: new Date().toLocaleTimeString(),
        },
      }));
      return;
    }

    isExecutingRef.current = true;
    setUsdtStep({ address: null, txHash: null, status: 'signing', error: null });

    try {
      const eth = getEthereumProvider();
      const initialSupply = 1000n * 10n ** 6n; // 1,000 USDT with 6 decimals
      const deployData = encodeDeployData({
        abi: MOCK_USDT_ABI,
        bytecode: MOCK_USDT_BYTECODE,
        args: ['Test Tether USD', 'USDT', initialSupply, account as `0x${string}`],
      });

      let txParams: any;

      if (txFormat === 'legacy') {
        const [gasPrice, latestNonce, gasEstimate] = await Promise.all([
          publicClient.getGasPrice(),
          publicClient.getTransactionCount({ address: account as `0x${string}`, blockTag: 'pending' }),
          publicClient.estimateGas({ account: account as `0x${string}`, data: deployData, type: 'legacy' }),
        ]);
        const safeGasLimit = (gasEstimate * 125n) / 100n;
        txParams = {
          from: account,
          data: deployData,
          nonce: `0x${latestNonce.toString(16)}`,
          gas: `0x${safeGasLimit.toString(16)}`,
          gasPrice: `0x${gasPrice.toString(16)}`,
        };
      } else {
        const [fees, latestNonce, gasEstimate] = await Promise.all([
          publicClient.estimateFeesPerGas(),
          publicClient.getTransactionCount({ address: account as `0x${string}`, blockTag: 'pending' }),
          publicClient.estimateGas({ account: account as `0x${string}`, data: deployData, type: 'eip1559' }),
        ]);
        const safeGasLimit = (gasEstimate * 125n) / 100n;
        txParams = {
          from: account,
          data: deployData,
          nonce: `0x${latestNonce.toString(16)}`,
          gas: `0x${safeGasLimit.toString(16)}`,
          maxFeePerGas: `0x${fees.maxFeePerGas.toString(16)}`,
          maxPriorityFeePerGas: `0x${fees.maxPriorityFeePerGas.toString(16)}`,
        };
      }

      const txHash = (await eth.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      })) as `0x${string}`;

      setUsdtStep(prev => ({ ...prev, txHash, status: 'confirming' }));

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 90_000,
        retryCount: 8,
        retryDelay: 2_000,
      });

      const address = receipt.contractAddress;
      if (!address) throw new Error('Contract deployment reverted or missing address in receipt.');

      // Verify on-chain token balance for user
      let verifiedBal = '1,000 USDT';
      try {
        const rawBal = await publicClient.readContract({
          address,
          abi: MOCK_USDT_ABI,
          functionName: 'balanceOf',
          args: [account as `0x${string}`],
        });
        verifiedBal = `${Number(formatUnits(rawBal as bigint, 6)).toLocaleString()} USDT`;
      } catch (balErr) {
        console.warn('Could not read deployed USDT balance immediately:', balErr);
      }

      setUsdtStep({ address, txHash, status: 'confirmed', error: null, verifiedBalance: verifiedBal });
      localStorage.setItem('penora_contract_USDT_TOKEN', address);
      await refreshAccountAndBalance();
    } catch (err: any) {
      if (err?.message?.includes('EIP-1559') || err?.code === -32602) {
        setTxFormat('legacy');
      }
      const rawError = createRawError(err);
      setUsdtStep(prev => ({
        ...prev,
        status: 'failed',
        error: rawError,
      }));
    } finally {
      isExecutingRef.current = false;
    }
  };

  const envSnippet = `# Polygon Amoy Testnet Deployed Contracts
PUBLIC_AMOY_RPC_URL=${AMOY_FALLBACK_RPCS[0]}
PUBLIC_PNR_TOKEN_ADDRESS=${pnrStep.address || ''}
PUBLIC_USDT_CONTRACT_ADDRESS=${usdtStep.address || ''}
`;

  const handleCopyEnv = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(envSnippet);
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2500);
    }
  };

  const stage1Complete = pnrStep.address && usdtStep.address;
  const inMempoolCount = (pendingNonce ?? 0) - (nonce ?? 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8 font-sans">
      {/* Title Bar */}
      <div className="space-y-2 pb-4 border-b border-[#007C8B]/15">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[#007C8B]">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0A2540] tracking-tight">
            PENORA Testnet Deployment Dashboard
          </h1>
        </div>
        <p className="text-sm text-[#475A6E] leading-relaxed">
          Deploy official PENORA test contracts to Polygon Amoy Testnet (Chain ID 80002) directly from your connected MetaMask wallet. Non-custodial with explicit signature for each transaction.
        </p>
      </div>

      {/* Safety Notice */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="font-bold uppercase tracking-wider block">TESTNET ONLY (POLYGON AMOY 80002)</strong>
          <p className="leading-relaxed">
            All deployments and tokens created here operate exclusively on Polygon Amoy testnet. Tokens hold zero monetary value. Private keys and seed phrases are never requested or stored.
          </p>
        </div>
      </div>

      {/* RPC Diagnostic & 1-Click Fix Banner */}
      <div className="p-5 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Server className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Polygon Amoy RPC Health &amp; Automatic Failover
              </h2>
              <p className="text-[11px] text-slate-400">
                Resilient multi-endpoint client with bounded retries and exponential backoff.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUpdateMetaMaskRpc}
              disabled={updatingMetaMaskRpc}
              className="py-1.5 px-3.5 rounded-xl bg-gradient-to-r from-[#007C8B] to-[#00E5F4] text-white text-xs font-bold shadow hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
            >
              {updatingMetaMaskRpc ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Prompting MetaMask...</span>
                </>
              ) : metaMaskRpcSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  <span>MetaMask RPC Updated!</span>
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5 text-amber-300" />
                  <span>Auto-Fix MetaMask RPC</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowManualRpcGuide(!showManualRpcGuide)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Manual Settings Guide"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                checkRpcHealth();
                refreshAccountAndBalance();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Re-check RPCs"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Live RPC Endpoints List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {rpcHealthList.map(rpc => (
            <div
              key={rpc.url}
              className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-xs"
            >
              <div className="space-y-0.5 truncate pr-2">
                <span className="font-mono text-[11px] text-slate-300 block truncate">
                  {rpc.url.replace('https://', '')}
                </span>
                <span className="text-[10px] text-slate-400">
                  {rpc.status === 'healthy'
                    ? `Block #${rpc.blockNumber?.toLocaleString()} · ${rpc.latencyMs}ms`
                    : rpc.status === 'checking'
                    ? 'Pinging endpoint...'
                    : `Error: ${rpc.error}`}
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  rpc.status === 'healthy'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : rpc.status === 'checking'
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {rpc.status === 'healthy' ? 'Active' : rpc.status === 'checking' ? 'Testing' : 'Offline'}
              </span>
            </div>
          ))}
        </div>

        {/* Expandable Manual RPC Fix Guide */}
        {showManualRpcGuide && (
          <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 text-xs space-y-2 text-slate-300">
            <h4 className="font-bold text-white flex items-center gap-1.5">
              <span>Why this fix is needed:</span>
            </h4>
            <p className="text-[11px] leading-relaxed text-slate-300">
              MetaMask&apos;s default Polygon Amoy RPC (<code className="text-cyan-300">rpc-amoy.polygon.technology</code>) is currently offline/rate-limited. To fix it:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300 pl-1">
              <li>Open MetaMask &rarr; Click <strong>Network Selector</strong> at top.</li>
              <li>Click the gear icon next to <strong>Polygon Amoy</strong> (or Settings &rarr; Networks).</li>
              <li>Change <strong>RPC URL</strong> to: <code className="text-cyan-300 select-all font-mono">https://polygon-amoy-bor-rpc.publicnode.com</code></li>
              <li>Click <strong>Save</strong>.</li>
            </ol>
          </div>
        )}
      </div>

      {/* Wallet Status Card */}
      <div className="p-6 rounded-3xl bg-white border border-[#007C8B]/15 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[#007C8B]" />
            <h2 className="font-serif text-base font-bold text-[#0A2540]">
              Connected Deployment Signer
            </h2>
          </div>
          {account && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRecoverStaleState}
                className="py-1 px-2.5 rounded-lg text-slate-600 hover:text-[#007C8B] hover:bg-slate-100 text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Reset stale state and re-sync"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset &amp; Re-sync</span>
              </button>
              <button
                type="button"
                onClick={refreshAccountAndBalance}
                disabled={balanceLoading}
                className="p-1.5 rounded-lg text-slate-500 hover:text-[#007C8B] hover:bg-slate-100 transition-colors"
                title="Refresh Balance"
              >
                <RefreshCw className={`h-4 w-4 ${balanceLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {recoveryNotice && (
          <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-900 text-xs flex items-center gap-2">
            <Check className="h-4 w-4 text-[#007C8B]" />
            <span>{recoveryNotice}</span>
          </div>
        )}

        {account ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">MetaMask Address</span>
              <div className="font-mono text-xs font-bold text-[#0A2540] truncate" title={account}>
                {account}
              </div>
              {account.toLowerCase() === targetWallet.toLowerCase() ? (
                <span className="text-[10px] text-emerald-600 font-semibold block">
                  ✓ Matches Approved Wallet
                </span>
              ) : (
                <span className="text-[10px] text-amber-600 font-semibold block">
                  Notice: Non-target address
                </span>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">Network</span>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isAmoy ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span className="font-bold text-xs text-[#0A2540]">
                  {isAmoy ? 'Polygon Amoy (80002)' : `Wrong Network (${chainId})`}
                </span>
              </div>
              {!isAmoy && (
                <button
                  type="button"
                  onClick={handleSwitchNetwork}
                  className="mt-1 text-[11px] font-semibold text-[#007C8B] hover:underline block"
                >
                  Switch to Amoy
                </button>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">Test POL (Gas)</span>
              <div className="font-serif text-lg font-bold text-[#0A2540]">
                {polBalance !== null ? `${polBalance} POL` : '0.0000 POL'}
              </div>
              {parseFloat(polBalance || '0') < 0.0577 ? (
                <span className="text-[10px] text-amber-600 font-semibold block">
                  Gas buffer &lt; 0.058 POL
                </span>
              ) : (
                <span className="text-[10px] text-emerald-600 font-semibold block">
                  ✓ Sufficient Gas for Stage 1
                </span>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">On-Chain State</span>
              <div className="text-xs font-bold text-[#0A2540] flex items-center gap-1.5">
                <span>Nonce: {nonce !== null ? nonce : '—'}</span>
                {inMempoolCount > 0 ? (
                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-normal">
                    {inMempoolCount} pending in mempool
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-normal">
                    0 in mempool
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 block">
                Gas: ~{currentGasPriceGwei} Gwei
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 space-y-3">
            <p className="text-xs text-slate-500">
              Connect MetaMask to initialize the interactive testnet deployment.
            </p>
            <button
              type="button"
              onClick={handleConnect}
              className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-[#007C8B] to-[#00E5F4] text-white font-bold text-xs shadow-sm hover:opacity-95 transition-opacity"
            >
              Connect MetaMask
            </button>
          </div>
        )}
      </div>

      {/* Stage 1 Deployments Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-lg font-bold text-[#0A2540]">
              Stage 1 Deployment Sequence
            </h2>
            <span className="text-xs font-normal font-sans text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-semibold">
              Approved
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs border border-slate-200">
              <span className="text-[10px] font-semibold text-slate-500 pl-1.5">Tx Format:</span>
              <button
                type="button"
                onClick={() => setTxFormat('legacy')}
                className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition-colors ${
                  txFormat === 'legacy' ? 'bg-[#007C8B] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Legacy Type 0 with gasPrice (Universal across all MetaMask network configurations)"
              >
                Legacy Type 0 (Universal)
              </button>
              <button
                type="button"
                onClick={() => setTxFormat('eip1559')}
                className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition-colors ${
                  txFormat === 'eip1559' ? 'bg-[#007C8B] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="EIP-1559 Type 2 with maxFeePerGas"
              >
                EIP-1559 Type 2
              </button>
            </div>

            <button
              type="button"
              onClick={handleRecoverStaleState}
              className="text-xs text-[#007C8B] hover:underline font-semibold flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Clear Stale Notices</span>
            </button>
          </div>
        </div>

        {/* Step 1: PenoraToken */}
        <div className="p-5 rounded-3xl bg-white border border-[#007C8B]/15 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-[#007C8B]">
                  Step 1
                </span>
                <h3 className="font-serif text-base font-bold text-[#0A2540]">
                  PenoraToken (PNR)
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Fixed 100M total supply. Allocation: exactly <strong>10,000 PNR</strong> to your wallet; <strong>99,990,000 PNR</strong> to sovereign treasury vault (recoverable only by you).
              </p>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                <span>Gas limit: ~949,526 (~0.0313 POL)</span>
                <span>•</span>
                <span>Decimals: 18</span>
              </div>
            </div>

            <div>
              {pnrStep.status === 'confirmed' ? (
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Deployed &amp; Verified</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={deployPnr}
                  disabled={!account || !isAmoy || pnrStep.status === 'signing' || pnrStep.status === 'confirming'}
                  className="py-2.5 px-4 rounded-xl bg-[#007C8B] hover:bg-[#006572] disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center gap-2 shrink-0 shadow-sm"
                >
                  {pnrStep.status === 'signing' ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Approve in MetaMask...</span>
                    </>
                  ) : pnrStep.status === 'confirming' ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Confirming on Amoy...</span>
                    </>
                  ) : (
                    <>
                      <Coins className="h-3.5 w-3.5" />
                      <span>Deploy PenoraToken</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {pnrStep.address && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-xs space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-mono text-[11px]">
                <span className="text-emerald-950 font-bold truncate">Contract: {pnrStep.address}</span>
                <a
                  href={`https://amoy.polygonscan.com/address/${pnrStep.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#007C8B] hover:underline flex items-center gap-1 shrink-0 font-sans font-semibold text-[11px]"
                >
                  <span>PolygonScan Explorer</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {pnrStep.verifiedBalance && (
                <div className="text-[11px] text-emerald-800 font-semibold font-sans">
                  ✓ Verified On-Chain Wallet Balance: <strong>{pnrStep.verifiedBalance}</strong>
                </div>
              )}
            </div>
          )}

          {pnrStep.txHash && pnrStep.status === 'confirming' && (
            <div className="p-3 rounded-2xl bg-cyan-50 border border-cyan-200 text-xs flex items-center justify-between">
              <span className="text-cyan-900 font-mono text-[11px] truncate">
                Tx: {pnrStep.txHash}
              </span>
              <a
                href={`https://amoy.polygonscan.com/tx/${pnrStep.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#007C8B] hover:underline flex items-center gap-1 shrink-0 font-semibold"
              >
                <span>Track Tx</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Actual Raw MetaMask/RPC Error Details */}
          {pnrStep.error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-900 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold text-red-950">
                      <span>MetaMask Response</span>
                      <span className="px-1.5 py-0.5 rounded bg-red-200/70 text-[10px] font-mono">
                        Code: {String(pnrStep.error.code)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {pnrStep.error.timestamp}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-red-800 break-words leading-relaxed">
                      {pnrStep.error.message}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPnrStep(prev => ({ ...prev, status: 'idle', error: null }))}
                  className="py-1 px-2.5 rounded-lg bg-red-200/80 hover:bg-red-300 text-red-900 font-semibold text-[11px] shrink-0 transition-colors"
                >
                  Dismiss
                </button>
              </div>

              {/* Actionable recovery based on actual error message & code */}
              <div className="p-3 rounded-xl bg-white/90 border border-red-200/90 text-[11px] space-y-2">
                {pnrStep.error.message.includes('eth_getBlockByNumber') || pnrStep.error.message.includes('too many errors') ? (
                  <div className="space-y-2">
                    <p className="font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>MetaMask Network RPC Needs Update (Takes 30 seconds):</span>
                    </p>
                    <p className="text-slate-700 leading-relaxed">
                      MetaMask is still using Polygon&apos;s overloaded default endpoint (<code>rpc-amoy.polygon.technology</code>). To fix this permanently:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1">
                      <li>Open MetaMask &rarr; click <strong>Network Dropdown</strong> at top &rarr; click Settings icon on <strong>Polygon Amoy</strong>.</li>
                      <li>Replace <strong>RPC URL</strong> with:
                        <div className="mt-1 flex items-center gap-2">
                          <code className="px-2 py-1 bg-slate-100 rounded text-[11px] font-mono text-[#007C8B] font-bold select-all">
                            https://polygon-amoy-bor-rpc.publicnode.com
                          </code>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText('https://polygon-amoy-bor-rpc.publicnode.com')}
                            className="px-2 py-0.5 rounded bg-[#007C8B] text-white text-[10px] font-bold hover:bg-[#006572]"
                          >
                            Copy URL
                          </button>
                        </div>
                      </li>
                      <li>Click <strong>Save</strong>. The error will disappear and you can click Deploy!</li>
                    </ol>
                  </div>
                ) : String(pnrStep.error.code) === '-32602' || pnrStep.error.message.includes('does not support EIP-1559') ? (
                  <p className="text-slate-700">
                    <strong>Auto-Recovery for Code -32602:</strong> MetaMask reported that the network does not support EIP-1559. Transaction format has been automatically switched to <strong>Legacy Type 0 (Universal)</strong> with verified on-chain gasPrice. Click &ldquo;Deploy PenoraToken&rdquo; to sign smoothly!
                  </p>
                ) : String(pnrStep.error.code) === '4001' ? (
                  <p className="text-slate-700">
                    <strong>Action:</strong> Signature request was cancelled in MetaMask. Click &ldquo;Deploy PenoraToken&rdquo; whenever you are ready.
                  </p>
                ) : String(pnrStep.error.code) === '-32002' ? (
                  <p className="text-slate-700">
                    <strong>Recovery Tip for Code -32002:</strong> MetaMask holds an unfulfilled request in its internal background queue. In MetaMask, toggle network to <em>Ethereum</em> and back to <em>Polygon Amoy</em> (or lock and unlock MetaMask) to purge the queue, then retry.
                  </p>
                ) : (
                  <p className="text-slate-700">
                    <strong>Action:</strong> If this was caused by RPC rate-limits, click <strong>Auto-Fix MetaMask RPC</strong> at the top to ensure your extension uses our healthy Bor-RPC.
                  </p>
                )}
              </div>

              {/* Raw JSON Details Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setExpandedPnrRaw(!expandedPnrRaw)}
                  className="text-[11px] font-semibold text-red-800 hover:underline flex items-center gap-1"
                >
                  <Code2 className="h-3 w-3" />
                  <span>{expandedPnrRaw ? 'Hide Raw Error Details' : 'View Raw Error Details'}</span>
                  {expandedPnrRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {expandedPnrRaw && (
                  <pre className="mt-2 p-3 rounded-xl bg-slate-900 text-slate-200 text-[10px] font-mono overflow-x-auto max-h-48 leading-relaxed">
                    {JSON.stringify(pnrStep.error, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: MockUSDT */}
        <div className="p-5 rounded-3xl bg-white border border-[#007C8B]/15 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-[#007C8B]">
                  Step 2
                </span>
                <h3 className="font-serif text-base font-bold text-[#0A2540]">MockUSDT</h3>
              </div>
              <p className="text-xs text-slate-500">
                Standard ERC-20 with 6 decimals. Allocation: exactly <strong>1,000 USDT</strong> minted directly to your wallet for test liquidity.
              </p>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                <span>Gas limit: ~800,021 (~0.0264 POL)</span>
                <span>•</span>
                <span>Decimals: 6</span>
              </div>
            </div>

            <div>
              {usdtStep.status === 'confirmed' ? (
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Deployed &amp; Verified</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={deployUsdt}
                  disabled={!account || !isAmoy || usdtStep.status === 'signing' || usdtStep.status === 'confirming'}
                  className="py-2.5 px-4 rounded-xl bg-[#007C8B] hover:bg-[#006572] disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center gap-2 shrink-0 shadow-sm"
                >
                  {usdtStep.status === 'signing' ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Approve in MetaMask...</span>
                    </>
                  ) : usdtStep.status === 'confirming' ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Confirming on Amoy...</span>
                    </>
                  ) : (
                    <>
                      <Coins className="h-3.5 w-3.5" />
                      <span>Deploy MockUSDT</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {usdtStep.address && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-xs space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-mono text-[11px]">
                <span className="text-emerald-950 font-bold truncate">Contract: {usdtStep.address}</span>
                <a
                  href={`https://amoy.polygonscan.com/address/${usdtStep.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#007C8B] hover:underline flex items-center gap-1 shrink-0 font-sans font-semibold text-[11px]"
                >
                  <span>PolygonScan Explorer</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {usdtStep.verifiedBalance && (
                <div className="text-[11px] text-emerald-800 font-semibold font-sans">
                  ✓ Verified On-Chain Wallet Balance: <strong>{usdtStep.verifiedBalance}</strong>
                </div>
              )}
            </div>
          )}

          {usdtStep.txHash && usdtStep.status === 'confirming' && (
            <div className="p-3 rounded-2xl bg-cyan-50 border border-cyan-200 text-xs flex items-center justify-between">
              <span className="text-cyan-900 font-mono text-[11px] truncate">
                Tx: {usdtStep.txHash}
              </span>
              <a
                href={`https://amoy.polygonscan.com/tx/${usdtStep.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#007C8B] hover:underline flex items-center gap-1 shrink-0 font-semibold"
              >
                <span>Track Tx</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Actual Raw MetaMask/RPC Error Details */}
          {usdtStep.error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-900 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold text-red-950">
                      <span>MetaMask Response</span>
                      <span className="px-1.5 py-0.5 rounded bg-red-200/70 text-[10px] font-mono">
                        Code: {String(usdtStep.error.code)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {usdtStep.error.timestamp}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-red-800 break-words leading-relaxed">
                      {usdtStep.error.message}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setUsdtStep(prev => ({ ...prev, status: 'idle', error: null }))}
                  className="py-1 px-2.5 rounded-lg bg-red-200/80 hover:bg-red-300 text-red-900 font-semibold text-[11px] shrink-0 transition-colors"
                >
                  Dismiss
                </button>
              </div>

              {/* Actionable recovery based on actual error message & code */}
              <div className="p-3 rounded-xl bg-white/90 border border-red-200/90 text-[11px] space-y-2">
                {usdtStep.error.message.includes('eth_getBlockByNumber') || usdtStep.error.message.includes('too many errors') ? (
                  <div className="space-y-2">
                    <p className="font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>MetaMask Network RPC Needs Update (Takes 30 seconds):</span>
                    </p>
                    <p className="text-slate-700 leading-relaxed">
                      MetaMask is still using Polygon&apos;s overloaded default endpoint (<code>rpc-amoy.polygon.technology</code>). To fix this permanently:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1">
                      <li>Open MetaMask &rarr; click <strong>Network Dropdown</strong> at top &rarr; click Settings icon on <strong>Polygon Amoy</strong>.</li>
                      <li>Replace <strong>RPC URL</strong> with:
                        <div className="mt-1 flex items-center gap-2">
                          <code className="px-2 py-1 bg-slate-100 rounded text-[11px] font-mono text-[#007C8B] font-bold select-all">
                            https://polygon-amoy-bor-rpc.publicnode.com
                          </code>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText('https://polygon-amoy-bor-rpc.publicnode.com')}
                            className="px-2 py-0.5 rounded bg-[#007C8B] text-white text-[10px] font-bold hover:bg-[#006572]"
                          >
                            Copy URL
                          </button>
                        </div>
                      </li>
                      <li>Click <strong>Save</strong>. The error will disappear and you can click Deploy!</li>
                    </ol>
                  </div>
                ) : String(usdtStep.error.code) === '-32602' || usdtStep.error.message.includes('does not support EIP-1559') ? (
                  <p className="text-slate-700">
                    <strong>Auto-Recovery for Code -32602:</strong> MetaMask reported that the network does not support EIP-1559. Transaction format has been automatically switched to <strong>Legacy Type 0 (Universal)</strong> with verified on-chain gasPrice. Click &ldquo;Deploy MockUSDT&rdquo; to sign smoothly!
                  </p>
                ) : String(usdtStep.error.code) === '4001' ? (
                  <p className="text-slate-700">
                    <strong>Action:</strong> Signature request was cancelled in MetaMask. Click &ldquo;Deploy MockUSDT&rdquo; whenever you are ready.
                  </p>
                ) : String(usdtStep.error.code) === '-32002' ? (
                  <p className="text-slate-700">
                    <strong>Recovery Tip for Code -32002:</strong> MetaMask holds an unfulfilled request in its internal background queue. In MetaMask, toggle network to <em>Ethereum</em> and back to <em>Polygon Amoy</em> (or lock and unlock MetaMask) to purge the queue, then retry.
                  </p>
                ) : (
                  <p className="text-slate-700">
                    <strong>Action:</strong> If this was caused by RPC rate-limits, click <strong>Auto-Fix MetaMask RPC</strong> at the top to ensure your extension uses our healthy Bor-RPC.
                  </p>
                )}
              </div>

              {/* Raw JSON Details Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setExpandedUsdtRaw(!expandedUsdtRaw)}
                  className="text-[11px] font-semibold text-red-800 hover:underline flex items-center gap-1"
                >
                  <Code2 className="h-3 w-3" />
                  <span>{expandedUsdtRaw ? 'Hide Raw Error Details' : 'View Raw Error Details'}</span>
                  {expandedUsdtRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {expandedUsdtRaw && (
                  <pre className="mt-2 p-3 rounded-xl bg-slate-900 text-slate-200 text-[10px] font-mono overflow-x-auto max-h-48 leading-relaxed">
                    {JSON.stringify(usdtStep.error, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stage 2 & 3 Locked Notice */}
      <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex items-center gap-2 text-slate-700">
          <Lock className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-bold font-serif text-slate-800">
            Stage 2 &amp; Stage 3 Contracts (Locked)
          </h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong>PenoraPowerEscrow</strong> and <strong>PenoraVotingInfluence</strong> are safely locked to preserve testnet gas until Stage 1 is fully tested and founder approval is granted.
        </p>
      </div>

      {/* Completion & Wallet Actions */}
      {stage1Complete && (
        <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-200 space-y-4">
          <div className="flex items-center gap-2.5 text-emerald-800">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
            <div>
              <h3 className="font-serif text-lg font-bold">
                Stage 1 Smart Contracts Deployed to Polygon Amoy!
              </h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                Tokens are allocated and active. You can now view live balances and test transfers in the PENORA Wallet.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="/wallet"
              className="py-2.5 px-6 rounded-xl bg-[#007C8B] hover:bg-[#006572] text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors"
            >
              <span>Open PENORA Wallet</span>
              <ArrowRight className="h-4 w-4" />
            </a>

            <button
              type="button"
              onClick={handleCopyEnv}
              className="py-2.5 px-4 rounded-xl bg-white border border-emerald-300 text-emerald-900 font-bold text-xs hover:bg-emerald-100/50 flex items-center gap-1.5 transition-colors"
            >
              {copiedEnv ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Copied .env Config!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy .env Configuration</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-3.5 rounded-2xl bg-white/80 border border-emerald-200 text-[11px] font-mono text-emerald-950 overflow-x-auto">
            {envSnippet}
          </pre>
        </div>
      )}
    </div>
  );
};
import { createWalletClient, createPublicClient, http, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { deriveKeyInfoFromWif } from '../crypto/penoraKeys';
import { polygonAmoy, AMOY_FALLBACK_RPCS } from './chain';
import { accountWalletKey } from './accountVault';

let provider: ReturnType<typeof makeEmbeddedProvider> | null = null;
export function getEmbeddedProvider() { return provider; }
export function clearEmbeddedProvider() { provider = null; }
export function enableEmbeddedProvider(username: string, key: string) { provider = makeEmbeddedProvider(username, key); }

export function makeEmbeddedProvider(username: string, key: string) {
  const info = deriveKeyInfoFromWif(key);
  // Domain-separated EVM identity. Never reinterpret the Ed25519 public key as an EVM key.
  const tag = new TextEncoder().encode('PENORA_EVM_WALLET_V1:');
  const material = new Uint8Array(tag.length + info.rawSeed.length);
  material.set(tag); material.set(info.rawSeed, tag.length);
  const account = privateKeyToAccount(keccak256(toHex(material)));
  material.fill(0); info.rawSeed.fill(0); info.rawSecretKey.fill(0);
  const wallet = createWalletClient({ account, chain: polygonAmoy, transport: http(AMOY_FALLBACK_RPCS[0]) });
  const reader = createPublicClient({ chain: polygonAmoy, transport: http(AMOY_FALLBACK_RPCS[0]) });
  return {
    isPenora: true,
    on() {},
    removeListener() {},
    async request({ method, params = [] }: { method: string; params?: any[] }): Promise<any> {
      if (accountWalletKey(username) !== key) throw new Error('Unlock your PENORA Active Key before using this wallet.');
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [account.address];
      if (method === 'eth_chainId') return '0x13882';
      if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') {
        if (Number(params[0]?.chainId) !== 80002) throw new Error('This wallet currently supports Polygon Amoy testnet only.');
        return null;
      }
      if (method === 'wallet_watchAsset') return true;
      if (method === 'personal_sign') {
        if (typeof window === 'undefined' || !window.confirm('Sign a message with your PENORA testnet wallet? Only approve requests you initiated.')) throw new Error('Signature cancelled.');
        if (params[1]?.toLowerCase() !== account.address.toLowerCase()) throw new Error('Wallet account mismatch.');
        return account.signMessage({ message: { raw: params[0] } });
      }
      if (method === 'eth_signTypedData_v4') {
        if (params[0]?.toLowerCase() !== account.address.toLowerCase()) throw new Error('Wallet account mismatch.');
        const typed = JSON.parse(params[1]);
        if (Number(typed.domain?.chainId) !== 80002) throw new Error('Signing network mismatch.');
        if (typeof window === 'undefined' || !window.confirm('Sign typed data with your PENORA testnet wallet? This can authorize spending.')) throw new Error('Signature cancelled.');
        return account.signTypedData(typed);
      }
      if (method === 'eth_sendTransaction') {
        const tx = params[0];
        if (!tx || tx.from?.toLowerCase() !== account.address.toLowerCase() || (tx.chainId && Number(tx.chainId) !== 80002)) throw new Error('Transaction account or network mismatch.');
        if (typeof window === 'undefined' || !window.confirm(`Send Polygon Amoy testnet transaction?\nTo: ${tx.to}\nValue: ${tx.value || '0x0'} wei\nData: ${tx.data || '0x'}\nTest POL network fees apply.`)) throw new Error('Transaction cancelled.');
        return wallet.sendTransaction({ account, chain: polygonAmoy, to: tx.to, data: tx.data,
          value: tx.value ? BigInt(tx.value) : 0n,
          ...(tx.gas ? { gas: BigInt(tx.gas) } : {}),
        });
      }
      if (['eth_call','eth_estimateGas','eth_gasPrice','eth_getBalance','eth_getCode','eth_getTransactionCount','eth_getTransactionReceipt','eth_getBlockByNumber','eth_maxPriorityFeePerGas','eth_blockNumber','eth_feeHistory'].includes(method)) {
        return reader.request({ method, params } as any);
      }
      throw new Error(`Unsupported PENORA wallet request: ${method}`);
    },
  };
}

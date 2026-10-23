/**
 * PENORA Polygon Amoy Active Key wallet prototype (feature gated).
 *
 * PENORA Active Keys are Ed25519 seeds, NOT Polygon secp256k1 keys.
 * HKDF derives a domain-separated secp256k1 key from the existing Active
 * Key. No extra downloadable key is required, but this creates a distinct
 * EVM signing identity. Rotation of the Active Key changes the address.
 *
 * This is a non-custodial EOA prototype. It is NOT gasless: transfers still
 * require native Test POL until a verified ERC-4337 sponsor is integrated.
 */
import { createWalletClient, http, isAddress, type Address, type Hex } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { extractWifKey, deriveKeyInfoFromWif } from '../crypto/penoraKeys';
import { AMOY_RPC_URL, polygonAmoy, PENORA_TARGET_CHAIN_ID } from './chain';
import { PENORA_CONTRACT_ADDRESSES, isConfiguredAddress } from './contracts';
import { APPROVED_PENORA_SELECTORS } from './gasSponsorshipService';

const text = (str: string) => new TextEncoder().encode(str);
const SECP256K1_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
export const ACTIVE_WALLET_NETWORK = 'Polygon Amoy testnet (80002)' as const;

/** Client-only deterministic derivation, never returns/exports the private key. */
export async function deriveAmoyAccountFromActiveKey(activeWif: string): Promise<PrivateKeyAccount> {
  const wif = extractWifKey(activeWif);
  const info = deriveKeyInfoFromWif(wif);
  const seed = info.rawSeed;
  if (!globalThis.crypto?.subtle) throw new Error('Unlock requires secure HTTPS/localhost browser crypto.');
  let scalar: Uint8Array | null = null;
  try {
    const bufferCopy = new Uint8Array(seed.length);
    bufferCopy.set(seed);
    const base = await globalThis.crypto.subtle.importKey('raw', bufferCopy.buffer, 'HKDF', false, ['deriveBits']);
    bufferCopy.fill(0);
    const salt = text('PENORA/ACTIVE/AMOY/SECP256K1/V1');
    for (let counter = 0; counter < 8; counter++) {
      const material = await globalThis.crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt, info: text('evm-account:80002:' + counter) }, base, 256
      );
      scalar = new Uint8Array(material);
      const hex = '0x' + Array.from(scalar, b => b.toString(16).padStart(2, '0')).join('');
      if (BigInt(hex) > 0n && BigInt(hex) < SECP256K1_ORDER) {
        return privateKeyToAccount(hex as Hex);
      }
      scalar.fill(0);
      scalar = null;
    }
    throw new Error('Unable to derive a valid signing scalar.');
  } finally {
    seed.fill(0);
    info.rawSecretKey.fill(0);
    if (scalar) scalar.fill(0); // Original signer retains private scalar internally until locked.
  }
}

type RpcCall = { method: string; params?: readonly unknown[] | Record<string, unknown> };
type EvmTx = {
  from?: string; to?: string; data?: string; value?: string;
  chainId?: string | number; gas?: string; gasPrice?: string;
  maxFeePerGas?: string; maxPriorityFeePerGas?: string; nonce?: string;
};

/**
 * EIP-1193-compatible minimal adapter for the EXISTING Viem wallet flows.
 * Each on-chain transaction requires explicit review in addition to the
 * existing PENORA modal. Never forward unknown signing RPC methods.
 */
/** Only allow approved PENORA Amoy contract calls with recognized function selectors; no arbitrary POL transfers. */
export function isPermittedActiveKeyAmoyCall(to: string, data?: string, value?: string): boolean {
  if (!isAddress(to) || !data || !/^0x[0-9a-fA-F]{8}(?:[0-9a-fA-F]{2})*$/.test(data)) return false;
  try { if (BigInt(value || '0') !== 0n) return false; } catch { return false; }
  const selector = data.slice(0, 10).toLowerCase();
  if (!APPROVED_PENORA_SELECTORS[selector]) return false;
  const a = PENORA_CONTRACT_ADDRESSES;
  return [
    a.PNR_TOKEN, a.USDT_TOKEN, a.POWER_ESCROW, a.VOTING_INFLUENCE,
    a.REWARD_DISTRIBUTOR, a.EXCHANGE, a.P2P_ESCROW,
  ].some(contract => isConfiguredAddress(contract) && contract.toLowerCase() === to.toLowerCase());
}

export class ActiveKeyAmoyProvider {
  public readonly address: Address;
  private readonly client: ReturnType<typeof createWalletClient>;
  private revoked = false;
  public revoke(): void { this.revoked = true; }
  private assertUnlocked(): void { if (this.revoked) throw new Error('PENORA wallet is locked. Unlock with your Active Key again.'); }
  constructor(private readonly account: PrivateKeyAccount) {
    this.address = account.address;
    this.client = createWalletClient({ account, chain: polygonAmoy, transport: http(AMOY_RPC_URL) });
  }
  public async request({ method, params }: RpcCall): Promise<unknown> {
    this.assertUnlocked();
    switch (method) {
      case 'eth_chainId': return '0x13882';
      case 'net_version': return String(PENORA_TARGET_CHAIN_ID);
      case 'eth_accounts':
      case 'eth_requestAccounts': return [this.address];
      case 'wallet_switchEthereumChain':
      case 'wallet_addEthereumChain': {
        const list = Array.isArray(params) ? params : [];
        const requested = list[0] as { chainId?: string } | undefined;
        if (Number(requested?.chainId) !== PENORA_TARGET_CHAIN_ID) throw new Error('Built-in wallet supports only Polygon Amoy.');
        return null;
      }
      case 'eth_sendTransaction': {
        const list = Array.isArray(params) ? params : [];
        const tx = list[0] as EvmTx | undefined;
        if (!tx || !isAddress(tx.to || '')) throw new Error('Valid transaction destination required.');
        if (!tx.from || tx.from.toLowerCase() !== this.address.toLowerCase()) throw new Error('Wallet account changed; transaction rejected.');
        if (tx.chainId !== undefined && Number(tx.chainId) !== PENORA_TARGET_CHAIN_ID) {
          throw new Error('Transactions are restricted to Polygon Amoy testnet.');
        }
        if (!isPermittedActiveKeyAmoyCall(tx.to || '', tx.data, tx.value)) {
          throw new Error('Active Key wallet only supports configured PENORA Amoy contract calls with zero native POL value.');
        }
        if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
          throw new Error('A visible user confirmation is required before signing.');
        }
        const approved = window.confirm(
          'PENORA Amoy TESTNET transaction\n' +
          'From: ' + this.address + '\n' +
          'To: ' + tx.to + '\n' +
          'Value: ' + (tx.value || '0') + ' wei\n' +
          'Function selector: ' + (tx.data?.slice(0, 10) || 'native transfer') + '\n\n' +
          'Test POL gas is required. This prototype does NOT sponsor gas.\n\nApprove and sign?'
        );
        if (!approved) throw Object.assign(new Error('Transaction rejected by user.'), { code: 4001 });
        this.assertUnlocked();
        const rpcChain = await this.client.getChainId();
        this.assertUnlocked();
        if (rpcChain !== PENORA_TARGET_CHAIN_ID) throw new Error('RPC network mismatch: Polygon Amoy required.');
        return await this.client.sendTransaction({
          account: this.account,
          chain: polygonAmoy,
          to: tx.to as Address,
          data: (tx.data || '0x') as Hex,
          value: tx.value ? BigInt(tx.value) : 0n,
          gas: tx.gas ? BigInt(tx.gas) : undefined,
          // Local viem signer estimates fees against Amoy; never trust an
          // unvalidated mixture of legacy gasPrice and EIP-1559 fee fields.
          nonce: tx.nonce !== undefined ? Number(tx.nonce) : undefined,
        });
      }
      default:
        throw new Error('Unsupported wallet RPC method: ' + method);
    }
  }
}

let activeProvider: ActiveKeyAmoyProvider | null = null;
export function getActiveKeyWalletProvider(): ActiveKeyAmoyProvider | null { return activeProvider; }
export function setActiveKeyWalletProvider(provider: ActiveKeyAmoyProvider): void {
  if (activeProvider && activeProvider !== provider) activeProvider.revoke();
  activeProvider = provider;
}
export function lockActiveKeyWallet(): void {
  if (activeProvider) activeProvider.revoke();
  activeProvider = null;
}

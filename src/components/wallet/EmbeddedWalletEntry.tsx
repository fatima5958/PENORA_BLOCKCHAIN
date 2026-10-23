/**
 * Feature-gated testnet-only noncustodial embedded wallet.
 * Wallet authentication is NOT yet linked to PENORA posting/account auth.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createThirdwebClient } from 'thirdweb';
import { defineChain } from 'thirdweb/chains';
import { ConnectButton, ThirdwebProvider, useActiveAccount, useActiveWallet, useDisconnect } from 'thirdweb/react';
import { EIP1193, inAppWallet } from 'thirdweb/wallets';
import { penoraWalletService } from '../../lib/wallet/walletService';
import {
  clearEmbeddedWalletProvider,
  getEmbeddedWalletProvider,
  setEmbeddedWalletProvider,
  type PenoraEip1193Provider,
} from '../../lib/wallet/embeddedProvider';

const clientId = import.meta.env.PUBLIC_THIRDWEB_CLIENT_ID?.trim() || '';
export const embeddedWalletEnabled =
  import.meta.env.PUBLIC_EMBEDDED_WALLET_ENABLED === 'true' && clientId.length > 0;
const client = embeddedWalletEnabled ? createThirdwebClient({ clientId }) : null;
const amoy = defineChain({
  id: 80002,
  rpc: import.meta.env.PUBLIC_AMOY_RPC_URL || 'https://polygon-amoy-bor-rpc.publicnode.com',
});
const wallets = [
  inAppWallet({
    auth: { options: ['email', 'google'] },
    executionMode: { mode: 'EIP4337', smartAccount: { chain: amoy, sponsorGas: true } },
    metadata: { name: 'PENORA Wallet' },
  }),
];

function Session({ compact }: { compact: boolean }) {
  const wallet = useActiveWallet();
  const account = useActiveAccount();
  const { disconnect } = useDisconnect();
  const last = useRef<PenoraEip1193Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = last.current;
    if (!wallet || !account || !client) {
      if (previous) {
        clearEmbeddedWalletProvider(previous);
        last.current = null;
        if (!getEmbeddedWalletProvider()) penoraWalletService.disconnect();
      }
      return;
    }
    // Thirdweb EIP-1193 adapter lets all existing Viem wallet actions use the
    // currently authenticated smart account rather than an injected extension.
    const provider = EIP1193.toProvider({ wallet, chain: amoy, client });
    setEmbeddedWalletProvider(provider);
    last.current = provider;
    setError(null);
    void penoraWalletService.connect().catch(err => {
      setError(err instanceof Error ? err.message : 'Built-in wallet connection failed.');
    });
  }, [wallet, account?.address]);

  const useExternal = async () => {
    try {
      if (wallet) await disconnect(wallet);
      clearEmbeddedWalletProvider();
      last.current = null;
      penoraWalletService.disconnect();
      await penoraWalletService.connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'External wallet connection failed.');
    }
  };

  return (
    <section id="penora-built-in-wallet" aria-label="PENORA built-in wallet"
      className={compact
        ? 'rounded-xl border border-[#00E5F4]/20 bg-[#122129] text-white p-3 mb-4'
        : 'rounded-2xl border border-[var(--wallet-border)] bg-[var(--wallet-surface)] p-4 sm:p-5'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold">PENORA Built-in Wallet · Amoy Testnet</h2>
          <p className="text-xs opacity-75 mt-1">Email or Google sign-in. No MetaMask required.</p>
          {account && <p className="text-xs font-mono break-all mt-1">Wallet: {account.address}</p>}
        </div>
        {client && <ConnectButton client={client} chain={amoy} wallets={wallets}
          connectButton={{ label: 'Open PENORA Wallet' }}
          appMetadata={{ name: 'PENORA', description: 'Polygon Amoy creator wallet' }} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <span className="text-[11px] opacity-75">New smart-account address · Test tokens only · Sponsored gas depends on paymaster availability.</span>
        <button type="button" onClick={() => void useExternal()} className="text-xs font-semibold underline underline-offset-2">
          Use MetaMask instead (optional)
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-500 mt-2">{error}</p>}
    </section>
  );
}

export function EmbeddedWalletEntry({ compact = false }: { compact?: boolean }) {
  if (!embeddedWalletEnabled || !client) return null;
  return <ThirdwebProvider><Session compact={compact} /></ThirdwebProvider>;
}

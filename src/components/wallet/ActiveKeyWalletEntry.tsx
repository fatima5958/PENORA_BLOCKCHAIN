/**
 * Existing PENORA PDF Active Key is the only user-entered wallet credential.
 * Feature gated OFF in production until on-chain and security QA pass.
 */
import React, { useEffect, useState } from 'react';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import { authBroker } from '../../lib/auth/authBroker';
import { deriveKeyInfoFromWif, extractWifKey } from '../../lib/crypto/penoraKeys';
import { penoraWalletService } from '../../lib/wallet/walletService';
import {
  ActiveKeyAmoyProvider, deriveAmoyAccountFromActiveKey,
  getActiveKeyWalletProvider, lockActiveKeyWallet, setActiveKeyWalletProvider,
} from '../../lib/wallet/activeKeyAmoyProvider';

export const activeKeyWalletEnabled = import.meta.env.PUBLIC_ACTIVE_KEY_WALLET_ENABLED === 'true';

/**
 * Active Key unlock is explicit and memory-only. The downloaded key PDF stays
 * with the user; PENORA never stores the private key in Supabase/localStorage.
 */
export function ActiveKeyWalletEntry({ compact = false }: { compact?: boolean }) {
  const [user, setUser] = useState<PenoraUser | null>(() => penoraKeyAuth.getCurrentUser());
  const [username, setUsername] = useState('');
  const [activeKey, setActiveKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [unlockedUsername, setUnlockedUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => penoraKeyAuth.subscribe(next => {
    setUser(next);
    if (getActiveKeyWalletProvider() && (!next || (unlockedUsername && next.username !== unlockedUsername))) {
      lockActiveKeyWallet();
      penoraWalletService.disconnect();
      setAddress(null);
      setUnlockedUsername(null);
    }
  }), [unlockedUsername]);

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    // Do not persist or log sensitive key input, not even in error details.
    const key = extractWifKey(activeKey);
    const name = (user?.username || username).trim().toLowerCase().replace(/^@/, '');
    try {
      if (!name || !key) throw new Error('Enter your PENORA username and existing Private Active Key.');
      if (getActiveKeyWalletProvider()) {
        penoraWalletService.disconnect();
      }
      // Verifies signed challenge against registered user Active public key.
      // Posting/Owner/Memo keys are never permitted to unlock funds.
      const result = await penoraKeyAuth.loginWithPrivateKey(name, key);
      if (!result.success || result.user?.keyRole !== 'active') {
        throw new Error(result.error || 'Only the registered Active Key can unlock your wallet.');
      }
      const authority = authBroker.getAccount(name)?.authorities.active_public_key;
      if (!authority || deriveKeyInfoFromWif(key).publicKeyPen !== authority) {
        throw new Error('Active Key does not match the registered account authority.');
      }
      const signer = await deriveAmoyAccountFromActiveKey(key);
      const provider = new ActiveKeyAmoyProvider(signer);
      setActiveKeyWalletProvider(provider);
      await penoraWalletService.connect();
      const state = penoraWalletService.getState();
      if (!state.address || state.address.toLowerCase() !== signer.address.toLowerCase() || !state.isCorrectNetwork) {
        lockActiveKeyWallet();
        penoraWalletService.disconnect();
        throw new Error('Polygon Amoy wallet connection was not verified.');
      }
      setUnlockedUsername(name);
      setAddress(signer.address);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlock PENORA Wallet.');
    } finally {
      setActiveKey('');
      setBusy(false);
    }
  };

  const connectBrowserWallet = async () => {
    try {
      penoraWalletService.disconnect();
      lockActiveKeyWallet();
      setAddress(null);
      setUnlockedUsername(null);
      await penoraWalletService.connect();
    } catch {
      setError('Could not connect the optional browser wallet.');
    }
  };

  const lock = () => {
    penoraWalletService.disconnect();
    lockActiveKeyWallet();
    setActiveKey('');
    setUnlockedUsername(null);
    setAddress(null);
    setError(null);
  };

  return (
    <section id="penora-active-key-wallet" aria-label="PENORA Active Key wallet"
      className={compact ? 'rounded-xl border border-[#00E5F4]/20 bg-[#122129] text-white p-3 mb-4 space-y-3'
        : 'rounded-2xl border border-[var(--wallet-border)] bg-[var(--wallet-surface)] p-4 sm:p-5 space-y-3'}>
      <div>
        <h2 className="font-display text-sm font-semibold">PENORA Built-in Wallet · Active Key</h2>
        <p className="text-xs opacity-75 mt-1">
          Use your existing downloaded PENORA Private Active Key. No MetaMask or extra key download.
        </p>
      </div>
      {address ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-xs break-all">Unlocked Amoy address: {address}</p>
          <button type="button" onClick={lock} className="rounded-lg bg-[#007C8B] text-white text-xs px-3 py-2">Lock wallet</button>
        </div>
      ) : (
        <form onSubmit={event => void unlock(event)} className="flex flex-col sm:flex-row gap-2">
          {!user && <label className="text-xs flex-1">
            <span className="block mb-1">PENORA username</span>
            <input value={username} onChange={e => setUsername(e.target.value)}
              autoComplete="username" required className="border border-[var(--wallet-border)] bg-[var(--wallet-inset)] text-[var(--wallet-text)] rounded-lg w-full px-3 py-2" />
          </label>}
          <label className="text-xs flex-[2]">
            <span className="block mb-1">Private Active Key (from your PENORA Keys PDF)</span>
            <input type="password" value={activeKey} onChange={e => setActiveKey(e.target.value)}
              autoComplete="off" spellCheck={false} required
              className="border border-[var(--wallet-border)] bg-[var(--wallet-inset)] text-[var(--wallet-text)] rounded-lg w-full px-3 py-2"
              placeholder="5..." />
          </label>
          <button type="submit" disabled={busy || !activeKey.trim()}
            className="rounded-lg bg-[#007C8B] text-white px-4 py-2 text-xs font-semibold disabled:opacity-40">
            {busy ? 'Verifying…' : 'Unlock Wallet'}
          </button>
        </form>
      )}
      {!address && (
        <button type="button" onClick={() => void connectBrowserWallet()}
          className="text-xs underline underline-offset-2 opacity-80">
          Use MetaMask / browser wallet instead (optional)
        </button>
      )}
      <p className="text-[11px] opacity-70">
        Preview only · Active Key controls this derived wallet. Never share your key.
        Test POL is required for transactions; gasless sponsorship is NOT active.
        Locking clears the signer from app memory.
      </p>
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    </section>
  );
}

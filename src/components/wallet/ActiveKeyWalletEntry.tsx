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
import { getGasSponsorshipStatus } from '../../lib/wallet/gasSponsorshipService';

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

  const sponsorshipStatus = getGasSponsorshipStatus();

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

  // Auto-lock on idle/page navigation so sensitive in-memory signing state
  // cannot remain unlocked indefinitely. Never persist the Active Key.
  useEffect(() => {
    if (!address) return;
    let idle: ReturnType<typeof setTimeout>;
    const onIdle = () => {
      lockActiveKeyWallet();
      penoraWalletService.disconnect();
      setUnlockedUsername(null);
      setAddress(null);
      setError('Wallet automatically locked after 10 minutes without activity.');
    };
    const schedule = () => {
      clearTimeout(idle);
      idle = setTimeout(onIdle, 10 * 60 * 1000);
    };
    const leave = () => {
      lockActiveKeyWallet();
      penoraWalletService.disconnect();
    };
    const onReturn = () => {
      if (!getActiveKeyWalletProvider()) {
        setUnlockedUsername(null);
        setAddress(null);
      }
    };
    const unsubscribe = penoraWalletService.subscribe(state => {
      if (state.status === 'disconnected' || state.address?.toLowerCase() !== address.toLowerCase()) {
        setUnlockedUsername(null);
        setAddress(null);
      }
    });
    schedule();
    window.addEventListener('pointerdown', schedule, { passive: true });
    window.addEventListener('keydown', schedule);
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', onReturn);
    return () => {
      clearTimeout(idle);
      unsubscribe();
      window.removeEventListener('pointerdown', schedule);
      window.removeEventListener('keydown', schedule);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('pageshow', onReturn);
    };
  }, [address]);

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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-semibold text-[var(--wallet-text)]">PENORA Built-in Wallet · Active Key</h2>
          <p className="text-xs opacity-75 mt-0.5">
            Use your existing downloaded PENORA Private Active Key. No MetaMask or extra key download required.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#00E5F4]/10 text-[#00E5F4] border border-[#00E5F4]/20">
          Polygon Amoy (80002)
        </span>
      </div>

      {address ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-[var(--wallet-inset)] border border-[var(--wallet-border)]">
            <div>
              <p className="text-[11px] opacity-70">Derived EOA Address ({unlockedUsername ? `@${unlockedUsername}` : 'Active Key'})</p>
              <p className="font-mono text-xs break-all font-medium text-[var(--wallet-text)]">{address}</p>
            </div>
            <button type="button" onClick={lock} className="rounded-lg bg-[#007C8B] hover:bg-[#006673] transition-colors text-white text-xs font-medium px-3.5 py-2">
              Lock Wallet
            </button>
          </div>
          <p className="text-[11px] opacity-65 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Session unlocked in browser memory · Automatically locks after 10m idle or on tab close.
          </p>
        </div>
      ) : (
        <form onSubmit={event => void unlock(event)} className="flex flex-col sm:flex-row gap-2">
          {!user && (
            <label className="text-xs flex-1">
              <span className="block mb-1 font-medium">PENORA username</span>
              <input value={username} onChange={e => setUsername(e.target.value)}
                autoComplete="username" required
                placeholder="alice"
                className="border border-[var(--wallet-border)] bg-[var(--wallet-inset)] text-[var(--wallet-text)] rounded-lg w-full px-3 py-2 text-xs focus:outline-none focus:border-[#00E5F4]" />
            </label>
          )}
          <label className="text-xs flex-[2]">
            <span className="block mb-1 font-medium">Private Active Key (from your PENORA Keys PDF)</span>
            <input type="password" value={activeKey} onChange={e => setActiveKey(e.target.value)}
              autoComplete="off" spellCheck={false} required
              className="border border-[var(--wallet-border)] bg-[var(--wallet-inset)] text-[var(--wallet-text)] rounded-lg w-full px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#00E5F4]"
              placeholder="5..." />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={busy || !activeKey.trim()}
              className="rounded-lg bg-[#007C8B] hover:bg-[#006673] transition-colors text-white px-4 py-2 text-xs font-semibold disabled:opacity-40 whitespace-nowrap h-[34px]">
              {busy ? 'Verifying…' : 'Unlock Wallet'}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--wallet-border)]/50 text-[11px]">
        {!address && (
          <button type="button" onClick={() => void connectBrowserWallet()}
            className="text-[11px] underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity">
            Use MetaMask / browser wallet instead (optional)
          </button>
        )}
        <span className="opacity-70 text-[11px]">
          {sponsorshipStatus.status === 'active'
            ? 'Gas Sponsorship: Active (ERC-4337 Amoy)'
            : 'Gas Sponsorship: Pending Amoy Paymaster deployment · Native Test POL required'}
        </span>
      </div>

      <p className="text-[11px] opacity-70 leading-relaxed">
        Preview only · Deterministically derived in browser memory from your signup Active Key.
        Never persisted in localStorage, cookies or backend databases.
        Rotating your Active Key changes the derived address; transfer balances prior to rotation.
      </p>

      {error && <p role="alert" className="text-xs text-red-400 font-medium">{error}</p>}
    </section>
  );
}

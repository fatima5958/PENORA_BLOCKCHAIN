import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Copy, LockKeyhole, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import { extractWifKey } from '../../lib/crypto/penoraKeys';
import { accountWalletKey, lockAccountWallet, unlockAccountWallet } from '../../lib/wallet/accountVault';
import { AccountWalletRequestError, accountRequest, makeAccountRequest, type AccountSnapshot } from '../../lib/wallet/accountClient';
import { accountUnits, displayAccountUnits, type AccountAsset, type AccountRequest, validateAccountRequest } from '../../lib/wallet/accountProtocol';

export function AccountWallet({ onExternal }: { onExternal: () => void }) {
  const [user, setUser] = useState<PenoraUser | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [asset, setAsset] = useState<AccountAsset>('PNR');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'home' | 'send' | 'receive' | 'review'>('home');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const [copied, setCopied] = useState(false);
  const pending = useRef<AccountRequest | null>(null);
  const generation = useRef(0);
  const identity = useRef('');
  useEffect(() => penoraKeyAuth.subscribe(next => {
    const name = next?.username || '';
    if (identity.current !== name) {
      generation.current++;
      identity.current = name;
      pending.current = null;
      setSnapshot(null); setError(''); setReceipt(''); setKeyInput(''); setBusy(false); setStep('home');
      if (!next) lockAccountWallet();
      setUnlocked(Boolean(next && accountWalletKey(next.username)));
      if (name) {
        try {
          const saved = sessionStorage.getItem(`penora:pending-transfer:${name}`);
          if (saved) {
            const restored = validateAccountRequest({ ...JSON.parse(saved), expires: Date.now() + 90000 });
            if (restored.username === name && restored.action === 'transfer') {
              pending.current = restored;
              setAsset(restored.asset); setRecipient(restored.recipient); setAmount(restored.amount); setStep('review');
            }
          }
        } catch { /* Malformed local retry data never authorizes a transfer. */ }
      }
    }
    setUser(next);
  }), []);
  async function refresh(key = user ? accountWalletKey(user.username) : null) {
    if (!user || !key) return;
    const current = generation.current;
    setBusy(true); setError('');
    try {
      const result = await accountRequest(makeAccountRequest(user.username, 'balance'), key);
      if (current !== generation.current) return;
      setSnapshot(result); setUnlocked(true); unlockAccountWallet(user.username, key); setKeyInput('');
    } catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : 'Balance unavailable.'); }
    finally { if (current === generation.current) setBusy(false); }
  }
  useEffect(() => { if (user && unlocked) void refresh(); }, [user?.username]);
  function review() {
    setError(''); setReceipt('');
    try {
      const clean = recipient.trim().replace(/^@/, '').toLowerCase();
      if (!/^[a-z0-9][a-z0-9_.-]{0,49}$/.test(clean) || clean === user?.username) throw new Error('Enter another creator’s exact PENORA username.');
      const units = accountUnits(amount, asset);
      if (!snapshot || units > BigInt(snapshot.balances[asset])) throw new Error('Insufficient PENORA account balance.');
      setRecipient(clean); setStep('review');
    } catch (e) { setError(e instanceof Error ? e.message : 'Check the transfer details.'); }
  }
  async function send() {
    if (!user || busy) return;
    const key = accountWalletKey(user.username);
    if (!key) { setUnlocked(false); return; }
    const current = generation.current;
    pending.current ??= makeAccountRequest(user.username, 'transfer', asset, recipient, amount);
    try { sessionStorage.setItem(`penora:pending-transfer:${user.username}`, JSON.stringify(pending.current)); }
    catch { setError('Enable browser session storage before sending so an interrupted transfer can be retried safely.'); return; }
    setBusy(true); setError('');
    try {
      const result = await accountRequest(pending.current, key);
      if (current !== generation.current) return;
      setReceipt(`Sent ${amount} ${asset} to @${recipient}. Receipt: ${result.receipt.id}`);
      sessionStorage.removeItem(`penora:pending-transfer:${user.username}`);
      pending.current = null; setStep('home'); setAmount('');
      // Confirmed receipt is retained even if a later balance refresh fails.
      const latest = await accountRequest(makeAccountRequest(user.username, 'balance'), key);
      if (current === generation.current) setSnapshot(latest);
    } catch (e) {
      if (current !== generation.current) return;
      // A rejected request did not debit the account. Let the creator correct it;
      // retain the same nonce for network/server failures with an uncertain result.
      if (e instanceof AccountWalletRequestError && e.rejected && pending.current) {
        pending.current = null;
        try { sessionStorage.removeItem(`penora:pending-transfer:${user.username}`); } catch {}
        setStep('send');
        if (e.status === 403) { lockAccountWallet(); setUnlocked(false); setSnapshot(null); }
      }
      setError(e instanceof Error ? e.message : 'Transfer is unconfirmed. Retry to check the same request.');
    }
    finally { if (current === generation.current) setBusy(false); }
  }
  const balance = (symbol: AccountAsset) => snapshot ? displayAccountUnits(snapshot.balances[symbol], symbol) : '—';
  return <section className="account-wallet" aria-label="PENORA account wallet">
    <header className="account-wallet-heading"><div><span className="account-eyebrow">PENORA / YOUR CREATOR WALLET</span><h1>Made to move.</h1><p>Send to creators. Keep creating.</p></div><Wallet size={30} /></header>
    <p className="account-testnet">Amoy testnet · Test PNR & test USDT have no monetary value.</p>
    {!user ? <div className="account-panel"><h2>Your account. Your wallet.</h2><p>Sign in to PENORA using the account menu to open your creator wallet.</p></div> : <>
      <div className="account-balance"><div className="account-balance-top"><span>@{user.username}</span><span><ShieldCheck size={14} /> Internal transfers · Free</span></div><span className="account-eyebrow">PENORA ACCOUNT BALANCE</span><div className="account-main-balance">{balance('PNR')} <small>PNR</small></div><div className="account-secondary-balance">{balance('USDT')} <span>test USDT</span></div><div className="account-balance-actions"><button onClick={() => { setStep('send'); setReceipt(''); }} disabled={!unlocked || busy || Boolean(pending.current)}><ArrowUpRight size={18} />Send</button><button disabled={busy || Boolean(pending.current)} onClick={() => setStep('receive')}><ArrowDownLeft size={18} />Receive</button><button aria-label="Refresh account balances" disabled={!unlocked || busy} onClick={() => void refresh()}><RefreshCw size={18} /></button></div></div>
      {!unlocked && <form className="account-panel" onSubmit={e => { e.preventDefault(); void refresh(extractWifKey(keyInput)); }}><h2><LockKeyhole size={18} /> Unlock your wallet</h2><p>Use the Active Key from your signup backup. No separate wallet connection is needed. Your key stays in this browser’s memory.</p><label>Private Active Key<input type="password" autoComplete="off" spellCheck={false} value={keyInput} onChange={e => setKeyInput(e.target.value)} required /></label><button className="account-primary" disabled={busy || !keyInput}>{busy ? 'Verifying…' : 'Unlock securely'}</button></form>}
      {unlocked && step === 'send' && <form className="account-panel" onSubmit={e => { e.preventDefault(); review(); }}><h2>Send to a creator</h2><label>Asset<select value={asset} onChange={e => setAsset(e.target.value as AccountAsset)}><option value="PNR">PNR</option><option value="USDT">Test USDT</option></select></label><label>PENORA username<input value={recipient} placeholder="@creator" autoCapitalize="none" spellCheck={false} onChange={e => setRecipient(e.target.value)} required /></label><label>Amount<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required /></label><p>Available: {balance(asset)} {asset} · Transfer fee: 0</p><button className="account-primary" disabled={busy || !snapshot}>Review transfer</button><button type="button" onClick={onExternal}>Send to an external wallet address →</button></form>}
      {unlocked && step === 'review' && <div className="account-panel"><h2>Confirm your transfer</h2><p className="account-review-amount">{amount} {asset}</p><p>To <strong>@{recipient}</strong></p><p>Fee: <strong>0</strong> · Arrives in their PENORA account.</p><p>Transfers cannot be undone. Check the exact username.</p><button className="account-primary" disabled={busy} onClick={() => void send()}>{busy ? 'Confirming…' : pending.current ? 'Retry same transfer' : 'Confirm send'}</button>{!pending.current && <button disabled={busy} onClick={() => setStep('send')}>Edit details</button>}</div>}
      {step === 'receive' && <div className="account-panel"><h2>Receive inside PENORA</h2><p>Share your username to receive PNR or test USDT from another PENORA account.</p><div className="account-receive"><strong>@{user.username}</strong><button aria-label="Copy PENORA username" onClick={async () => { try { await navigator.clipboard.writeText(`@${user.username}`); setCopied(true); } catch { setError('Copy failed. Select your username to copy it.'); } }}>{copied ? <Check size={18} /> : <Copy size={18} />}</button></div><p>This username is for PENORA transfers. It is not a blockchain deposit address.</p><button disabled={busy || Boolean(pending.current)} onClick={onExternal}>Open external wallet & deposit address →</button></div>}
      {receipt && <p role="status" className="account-success">{receipt}</p>}
      {unlocked && step === 'home' && <div className="account-panel"><h2>Recent activity</h2>{!snapshot ? <p>Balance and activity have not been verified yet.</p> : snapshot.transfers.length === 0 ? <p>Your first transfer starts here.</p> : <ul className="account-activity">{snapshot.transfers.map(tx => <li key={tx.id}><span>{tx.direction === 'sent' ? 'To' : 'From'} @{tx.counterparty}<small>{new Date(tx.created_at).toLocaleDateString()}</small></span><strong>{tx.direction === 'sent' ? '−' : '+'}{displayAccountUnits(tx.units, tx.asset)} {tx.asset}</strong></li>)}</ul>}</div>}
      {unlocked && <button className="account-lock" disabled={busy || Boolean(pending.current)} onClick={() => { generation.current++; lockAccountWallet(); setUnlocked(false); setSnapshot(null); setStep('home'); }}>Lock account wallet</button>}
    </>}
    {error && <p role="alert" className="account-error">{error}</p>}
    <footer className="account-panel account-external"><div><h2>External wallets</h2><p>Send or receive PNR and test USDT on Polygon Amoy. Network fees apply to direct on-chain transactions.</p></div><button disabled={busy || Boolean(pending.current)} onClick={onExternal}>Open on-chain wallet <ArrowUpRight size={16} /></button></footer>
    <p className="account-footnote">Account balances are separate from on-chain balances. Deposits and withdrawals between them are not activated; no unverified deposits are credited.</p>
  </section>;
}

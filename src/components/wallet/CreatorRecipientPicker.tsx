import React, { useEffect, useRef, useState } from 'react';
import { Search, CheckCircle2, RefreshCw } from 'lucide-react';
import { resolveCreatorRecipient, type CreatorRecipient } from '../../lib/wallet/creatorRecipient';

export function CreatorRecipientPicker({ onSelect, disabled = false }: { onSelect: (recipient: CreatorRecipient | null) => void; disabled?: boolean }) {
  const [username, setUsername] = useState('');
  const [recipient, setRecipient] = useState<CreatorRecipient | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);
  const lookup = async () => {
    if (busy || disabled) return;
    const current = ++version.current;
    setBusy(true); setError(''); setRecipient(null); onSelect(null);
    try {
      const result = await resolveCreatorRecipient(username);
      if (version.current !== current) return;
      setRecipient(result); onSelect(result);
    } catch (e) {
      if (version.current === current) setError(e instanceof Error ? e.message : 'Creator lookup failed.');
    } finally { if (version.current === current) setBusy(false); }
  };
  return <section className="rounded-2xl border border-[#007C8B]/20 bg-[var(--wallet-inset)] p-4 space-y-3">
    <label htmlFor="creator-recipient" className="block text-xs font-semibold">Send to a Penora creator</label>
    <div className="flex gap-2">
      <input id="creator-recipient" type="text" autoComplete="off" placeholder="@username" value={username} disabled={disabled}
        onChange={e => { version.current++; setBusy(false); setUsername(e.target.value); setRecipient(null); setError(''); onSelect(null); }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void lookup(); } }}
        className="min-w-0 flex-1 rounded-xl border border-[#007C8B]/20 bg-[var(--wallet-surface)] px-3 py-2 text-sm" />
      <button type="button" onClick={lookup} disabled={busy || disabled || !username.trim()} className="rounded-xl bg-[#007C8B] px-3 py-2 text-white text-xs font-semibold inline-flex items-center gap-2">
        {busy ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}Find
      </button>
    </div>
    {recipient && <div role="status" className="rounded-xl bg-[var(--wallet-surface)] p-3 text-xs space-y-1">
      <p className="font-semibold flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#007C8B]" aria-hidden="true" />{recipient.displayName} · @{recipient.username}</p>
      <p className="font-mono break-all text-[var(--wallet-muted)]">{recipient.address}</p>
      <p className="text-[var(--wallet-muted)]">Verified wallet · Polygon Amoy testnet</p>
    </div>}
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    <p className="text-[11px] text-[var(--wallet-muted)]">Choose PNR or USDT above. Review the creator and full wallet address before signing.</p>
  </section>;
}

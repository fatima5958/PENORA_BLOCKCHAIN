import React, { useEffect, useState } from 'react';
import { getProfileByUsername } from '../../lib/api/profiles';
import { CreatorProfileV7 } from './CreatorProfileV7';
import type { Author } from '../../types';

export function PublicCreatorProfile() {
  const [author, setAuthor] = useState<Author | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let request = 0;
    const path = window.location.pathname.split('/').filter(Boolean);
    let handle = '';
    try {
      handle = decodeURIComponent(path[0] === 'profile' ? path[1] || '' : new URLSearchParams(window.location.search).get('handle') || '').replace(/^@/, '').toLowerCase();
    } catch { setState('missing'); return; }
    if (!handle || handle === 'me' || !/^[a-z0-9_.-]+$/.test(handle)) { setState('missing'); return; }
    const refresh = async () => {
      const current = ++request;
      const result = await getProfileByUsername(handle);
      if (!active || current !== request) return;
      if (result.error) { setState(prev => prev === 'ready' ? prev : 'error'); return; }
      const p = result.data;
      if (!p) { setAuthor(null); setState('missing'); return; }
      setAuthor({
        id: p.id, handle: p.username, name: p.display_name || p.username,
        avatar: p.avatar_url && !p.avatar_url.includes('/brand/penora-avatar-') ? p.avatar_url : '',
        coverImage: p.cover_url || '/brand/penora-celestial-cover-default.jpg',
        bio: p.bio || '', location: p.location || '', website: p.website || '',
        interests: p.interests || [], reputationScore: p.reputation ?? 0, role: 'Creator',
        joinedDate: p.created_at ? new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '',
      });
      document.title = (p.display_name || p.username) + ' (@' + p.username + ') — PENORA';
      setState('ready');
    };
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const storage = (e: StorageEvent) => { if (e.key === 'penora:profile-updated') visible(); };
    void refresh();
    const timer = window.setInterval(visible, 15000);
    window.addEventListener('focus', visible);
    window.addEventListener('storage', storage);
    window.addEventListener('penora:profile-updated', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false; window.clearInterval(timer);
      window.removeEventListener('focus', visible);
      window.removeEventListener('storage', storage);
      window.removeEventListener('penora:profile-updated', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [attempt]);
  if (state === 'ready' && author) return <CreatorProfileV7 key={author.id} author={author} />;
  return (
    <section className="mx-auto max-w-xl px-6 py-20 text-center text-[#0A2540]" aria-live="polite">
      <h1 className="font-serif text-2xl mb-3">{state === 'loading' ? 'Loading creator…' : state === 'missing' ? 'Creator not found' : 'Profile could not be loaded'}</h1>
      <p className="text-sm text-[#52657C] mb-6">{state === 'loading' ? 'Opening their stories and profile.' : state === 'missing' ? 'Check the username or discover another creator.' : 'Please try again in a moment.'}</p>
      {state === 'error' && <button className="pn-btn pn-btn-brand mr-3" onClick={() => { setState('loading'); setAttempt(n => n + 1); }}>Try again</button>}
      {state !== 'loading' && <a href="/" className="pn-btn pn-btn-ghost">Back to feed</a>}
    </section>
  );
}

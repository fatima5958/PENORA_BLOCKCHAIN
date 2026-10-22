import { useEffect, useState } from 'react';
import { getProfileById } from '../api/profiles';
import type { ProfileRecord } from '../api/types';

/** Refresh a saved profile after edits, across tabs, and while the page is visible. */
export function useLiveProfile(id?: string) {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  useEffect(() => {
    let active = true;
    let request = 0;
    setProfile(null);
    if (!id) return;
    const refresh = async () => {
      const current = ++request;
      const result = await getProfileById(id);
      if (active && current === request && !result.error) setProfile(result.data);
    };
    const onSaved = () => {
      try { localStorage.setItem('penora:profile-updated', String(Date.now())); } catch {}
      void refresh();
    };
    const onStorage = (event: StorageEvent) => { if (event.key === 'penora:profile-updated') void refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh();
    window.addEventListener('penora:profile-updated', onSaved);
    window.addEventListener('focus', onVisible);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(onVisible, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('penora:profile-updated', onSaved);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('storage', onSaved);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id]);
  return profile;
}

import { isAddress } from 'viem';
import { supabase } from '../supabaseClient';
export interface CreatorRecipient { id: string; username: string; displayName: string; address: string; chainId: 80002; }
export async function resolveCreatorRecipient(username: string): Promise<CreatorRecipient> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('Sign in with your verified Penora account to send to a creator.');
  const response = await fetch('/api/wallet/recipient', {
    method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token },
    body: JSON.stringify({ username }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to find this creator wallet.');
  const r = result.recipient;
  if (!r || typeof r.username !== 'string' || r.username.toLowerCase() !== username.trim().replace(/^@/, '').toLowerCase() || !isAddress(r.address) || r.chainId !== 80002) throw new Error('Invalid recipient verification. Please look up the creator again.');
  return r;
}

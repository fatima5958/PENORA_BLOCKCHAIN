import { createClient } from '@supabase/supabase-js';
import { isAddress, zeroAddress } from 'viem';
const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return Response.json({ error: 'Sign in before looking up a creator wallet.' }, { status: 401, headers });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Creator wallet lookup is not configured yet.' }, { status: 503, headers });
  try {
    const raw = await request.text();
    if (raw.length > 1024) return Response.json({ error: 'Request too large.' }, { status: 413, headers });
    let body: { username?: unknown };
    try { body = JSON.parse(raw); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400, headers }); }
    const username = typeof body?.username === 'string' ? body.username.trim().replace(/^@/, '').toLowerCase() : '';
    if (!/^[a-z0-9][a-z0-9_.-]{0,49}$/.test(username)) return Response.json({ error: 'Enter a valid creator username.' }, { status: 400, headers });
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const session = await db.auth.getUser(token);
    if (session.error || !session.data.user) return Response.json({ error: 'Your session expired. Please sign in again.' }, { status: 401, headers });
    const profile = await db.from('profiles').select('id,username,display_name').eq('username', username).maybeSingle();
    if (profile.error) return Response.json({ error: 'Creator lookup is unavailable.' }, { status: 503, headers });
    if (!profile.data) return Response.json({ error: 'Creator not found. Check the exact username.' }, { status: 404, headers });
    if (profile.data.id === session.data.user.id) return Response.json({ error: 'Choose another creator to send tokens to.' }, { status: 400, headers });
    const binding = await db.from('reward_wallet_bindings').select('wallet_address,verified_at,verification_reference').eq('author_id', profile.data.id).maybeSingle();
    if (binding.error) return Response.json({ error: 'Verified wallet lookup is unavailable.' }, { status: 503, headers });
    const row = binding.data;
    if (!row || !row.verified_at || !row.verification_reference?.startsWith('signed-wallet-challenge:') || !isAddress(row.wallet_address) || row.wallet_address.toLowerCase() === zeroAddress) {
      return Response.json({ error: 'This creator has not linked a verified wallet yet. Ask them to connect and verify it in Wallet.' }, { status: 409, headers });
    }
    return Response.json({ recipient: { id: profile.data.id, username: profile.data.username, displayName: profile.data.display_name || profile.data.username, address: row.wallet_address, chainId: 80002 } }, { headers });
  } catch {
    return Response.json({ error: 'Creator wallet lookup is unavailable. Please try again.' }, { status: 503, headers });
  }
}

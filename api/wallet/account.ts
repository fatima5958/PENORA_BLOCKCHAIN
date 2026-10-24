import { createClient } from '@supabase/supabase-js';
import { verifyChallengeSignature } from '../../src/lib/crypto/penoraKeys';
import { accountMessage, accountUnits, validateAccountRequest } from '../../src/lib/wallet/accountProtocol';

const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') && request.headers.get('origin') !== origin) {
    return Response.json({ error: 'Cross-origin wallet requests are not allowed.' }, { status: 403, headers });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_URL) {
    return Response.json({ error: 'PENORA account transfers are not configured yet.' }, { status: 503, headers });
  }
  let body; let signature: string;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return Response.json({ error: 'Request too large.' }, { status: 413, headers });
    const json = JSON.parse(raw);
    body = validateAccountRequest(json);
    signature = json.signature;
    if (typeof signature !== 'string' || !/^[0-9a-f]{128}$/i.test(signature)) throw new Error('An Active Key signature is required.');
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Invalid request.' }, { status: 400, headers });
  }
  try {
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } });
    const profile = await db.from('profiles').select('id').eq('username', body.username).maybeSingle();
    if (profile.error) throw new Error('Database unavailable');
    if (!profile.data) return Response.json({ error: 'Account or Active Key could not be verified.' }, { status: 403, headers });
    const authority = await db.from('account_authorities').select('active_public_key').eq('account_id', profile.data.id).maybeSingle();
    if (authority.error) throw new Error('Database unavailable');
    const key = authority.data?.active_public_key;
    if (!key || !verifyChallengeSignature(accountMessage(body, origin), signature, key)) {
      return Response.json({ error: 'Account or Active Key could not be verified.' }, { status: 403, headers });
    }
    if (body.action === 'balance') {
      const result = await db.rpc('penora_account_snapshot', { p_owner: profile.data.id });
      if (result.error) throw new Error('Database unavailable');
      return Response.json({ ...result.data, network: 'amoy-testnet', externalWithdrawalsEnabled: false }, { headers });
    }
    const result = await db.rpc('penora_account_transfer', {
      p_sender: profile.data.id, p_recipient: body.recipient, p_asset: body.asset,
      p_units: accountUnits(body.amount, body.asset).toString(), p_nonce: body.nonce,
      p_active_key: key, p_expires: body.expires,
    });
    if (result.error) {
      const message = result.error.message;
      const expected = ['Insufficient account balance', 'Recipient not found', 'Request conflict', 'Active Key changed', 'Request expired'];
      if (expected.includes(message)) return Response.json({ error: message }, { status: 409, headers });
      throw new Error('Transfer unavailable');
    }
    return Response.json({ receipt: result.data, fee: '0', settlement: 'internal' }, { headers });
  } catch {
    return Response.json({ error: 'Account wallet is unavailable. No transfer has been confirmed; retry with the same request.' }, { status: 503, headers });
  }
}

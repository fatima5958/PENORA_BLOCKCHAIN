// MOCKED-TRANSPORT unit tests (NOT live email delivery).
// They stub only the Supabase network client to prove the app-side OTP contract:
//  - verifyOtp is called EXACTLY ONCE, with type 'email', never retried with another type
//  - duplicate/rapid verify requests are collapsed into one server call
//  - duplicate/rapid sends are collapsed into one email (each send replaces the previous code)
//  - network / 5xx / 429 failures never consume an attempt
//  - confirmed 403 otp_expired consumes an attempt and asks for a resend
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();

vi.mock('../lib/supabaseClient', () => ({
  supabase: { auth: { signInWithOtp: (...a: any[]) => signInWithOtp(...a), verifyOtp: (...a: any[]) => verifyOtp(...a) } },
}));

import { EmailVerificationService } from '../lib/auth/emailVerification';

const email = 'otp-once@example.com';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function freshService() {
  const svc = new EmailVerificationService();
  const sent = await svc.sendVerificationCode({ email, username: 'onceuser' });
  expect(sent.success).toBe(true);
  return svc;
}

describe('OTP verified exactly once (mocked Supabase transport)', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production'); // exercise the production branch, not the unit sandbox
    signInWithOtp.mockReset();
    verifyOtp.mockReset();
    signInWithOtp.mockResolvedValue({ data: { user: null, session: null }, error: null });
    if (typeof window !== 'undefined') window.localStorage?.clear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('calls verifyOtp once with type "email" and succeeds with the real auth user UUID', async () => {
    const svc = await freshService();
    const id = '7308b85e-7cbf-4af7-83dc-9d91edd2153a';
    verifyOtp.mockResolvedValue({ data: { user: { id }, session: {} }, error: null });

    const res = await svc.verifyCode({ email, code: '123456' });
    expect(res.success).toBe(true);
    expect(res.proof?.userId).toBe(id);
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(verifyOtp).toHaveBeenCalledWith({ email, token: '123456', type: 'email' });
  });

  it('submits complete 8-digit OTP unchanged to Supabase verifyOtp', async () => {
    const svc = await freshService();
    const id = '8419c96f-8dcf-5ba8-94ed-0e02fee3264b';
    verifyOtp.mockResolvedValue({ data: { user: { id }, session: {} }, error: null });

    const eightDigitOtp = '84920153';
    const res = await svc.verifyCode({ email, code: eightDigitOtp });
    expect(res.success).toBe(true);
    expect(res.proof?.userId).toBe(id);
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(verifyOtp).toHaveBeenCalledWith({ email, token: eightDigitOtp, type: 'email' });
  });

  it('never retries a rejected code with another type and asks for a resend', async () => {
    const svc = await freshService();
    verifyOtp.mockResolvedValue({ data: {}, error: { name: 'AuthApiError', status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' } });

    const res = await svc.verifyCode({ email, code: '123456' });
    expect(res.success).toBe(false);
    expect(res.needsResend).toBe(true);
    expect(res.error).toMatch(/Resend Code/i);
    expect(res.error).toMatch(/4 attempts remaining/);
    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });

  it('collapses rapid double-submits into a single server verification', async () => {
    const svc = await freshService();
    let release!: (v: any) => void;
    verifyOtp.mockReturnValue(new Promise(r => (release = r)));

    const p1 = svc.verifyCode({ email, code: '123456' });
    const p2 = svc.verifyCode({ email, code: '123456' });
    const p3 = svc.verifyCode({ email, code: '123456' });
    release({ data: { user: { id: '7308b85e-7cbf-4af7-83dc-9d91edd2153a' }, session: {} }, error: null });
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect([r1, r2, r3].filter(r => r.success)).toHaveLength(1);
  });

  it('does not consume attempts on network failure, 5xx or rate limit', async () => {
    const svc = await freshService();
    const failures = [
      { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' },
      { name: 'AuthApiError', status: 502, message: 'bad gateway' },
      { name: 'AuthApiError', status: 429, code: 'over_request_rate_limit', message: 'rate limited' },
    ];
    for (const err of failures) {
      verifyOtp.mockResolvedValueOnce({ data: {}, error: err });
      const res = await svc.verifyCode({ email, code: '123456' });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/not counted/i);
    }
    // Still 5 attempts left: the next confirmed rejection reports 4 remaining
    verifyOtp.mockResolvedValueOnce({ data: {}, error: { name: 'AuthApiError', status: 403, code: 'otp_expired', message: 'x' } });
    const res = await svc.verifyCode({ email, code: '123456' });
    expect(res.error).toMatch(/4 attempts remaining/);
  });

  it('sends only one email for rapid duplicate send requests', async () => {
    const svc = new EmailVerificationService();
    let release!: (v: any) => void;
    signInWithOtp.mockReturnValue(new Promise(r => (release = r)));

    const p1 = svc.sendVerificationCode({ email, username: 'onceuser' });
    const p2 = svc.sendVerificationCode({ email, username: 'onceuser' });
    release({ data: {}, error: null });
    const [a, b] = await Promise.all([p1, p2]);

    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    expect([a, b].filter(r => r.success)).toHaveLength(1);
  });

  it('does not reject a delayed (>5 min) code locally; the server decides', async () => {
    const svc = await freshService();
    const real = Date.now;
    vi.spyOn(Date, 'now').mockImplementation(() => real() + 20 * 60 * 1000);
    verifyOtp.mockResolvedValue({ data: { user: { id: '7308b85e-7cbf-4af7-83dc-9d91edd2153a' }, session: {} }, error: null });
    const res = await svc.verifyCode({ email, code: '123456' });
    vi.restoreAllMocks();
    expect(res.success).toBe(true);
    expect(res.proof?.userId).toMatch(UUID);
  });
});

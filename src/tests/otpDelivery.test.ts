// src/tests/otpDelivery.test.ts
// ============================================================================
// PENORA OTP EMAIL DELIVERY & GOTRUE DIAGNOSTICS TEST
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { emailVerificationService } from '../lib/auth/emailVerification';
import { penoraKeyAuth } from '../lib/auth/penoraKeyAuth';
import { supabase } from '../lib/supabaseClient';

describe('PENORA OTP Email Delivery & GoTrue Diagnostics', () => {
  const testEmail = 'pilot@penora.io';
  const testUsername = 'pilot_tester';

  beforeEach(() => {
    emailVerificationService.clearEmail(testEmail);
    penoraKeyAuth.logout();
  });

  it('1. verifies isolated test environment generates and validates real 6-digit code without leaks', async () => {
    const res = await emailVerificationService.sendVerificationCode({
      email: testEmail,
      username: testUsername,
    });

    expect(res.success).toBe(true);
    expect(res.cooldownSeconds).toBe(60);
    // OTP MUST NEVER leak in the response object
    expect((res as any).code).toBeUndefined();
    expect((res as any).otp).toBeUndefined();

    // Verify 6-digit code format
    const code = emailVerificationService._getTestCodeForTestingOnly(testEmail);
    expect(code).toBeDefined();
    expect(code).toMatch(/^\d{6}$/);

    // Verify code successfully yields proof
    const verifyRes = await emailVerificationService.verifyCode({
      email: testEmail,
      code: code!,
    });

    expect(verifyRes.success).toBe(true);
    expect(verifyRes.proof).toBeDefined();
    expect(verifyRes.proof?.email).toBe(testEmail);
    expect(verifyRes.proof?.username).toBe(testUsername);
  });

  it('2. confirms single-use replay protection after successful verification', async () => {
    await emailVerificationService.sendVerificationCode({
      email: testEmail,
      username: testUsername,
    });
    const code = emailVerificationService._getTestCodeForTestingOnly(testEmail)!;

    // First use passes
    const v1 = await emailVerificationService.verifyCode({ email: testEmail, code });
    expect(v1.success).toBe(true);

    // Second use is rejected
    const v2 = await emailVerificationService.verifyCode({ email: testEmail, code });
    expect(v2.success).toBe(false);
    expect(v2.error).toMatch(/already been used/i);
  });

  it('3. confirms brute force lockout after 5 incorrect attempts', async () => {
    await emailVerificationService.sendVerificationCode({
      email: testEmail,
      username: testUsername,
    });

    for (let i = 0; i < 5; i++) {
      const res = await emailVerificationService.verifyCode({
        email: testEmail,
        code: '000000',
      });
      expect(res.success).toBe(false);
    }

    // 6th attempt is locked out
    const lockedRes = await emailVerificationService.verifyCode({
      email: testEmail,
      code: '000000',
    });
    expect(lockedRes.success).toBe(false);
    expect(lockedRes.error).toMatch(/invalidated|too many/i);
  });

  it('4. verifies live Supabase GoTrue raw response format and status code against remote DB', async () => {
    // Probe remote GoTrue endpoint directly to verify error structure
    const { error } = await supabase.auth.signInWithOtp({
      email: 'diagnostics-' + Date.now() + '@penora.test',
      options: { shouldCreateUser: true },
    });

    // Remote Supabase instance currently returns 500 when SMTP provider encounters handshake/domain error
    expect(error).not.toBeNull();
    expect(error?.status).toBe(500);
    expect(error?.message).toMatch(/Error sending (confirmation|magic link) email/i);
  });

  it('5. verifies OTP verification immediately unlocks Step 3: Key Suite generation', async () => {
    await emailVerificationService.sendVerificationCode({
      email: testEmail,
      username: testUsername,
    });
    const code = emailVerificationService._getTestCodeForTestingOnly(testEmail)!;

    const verifyRes = await penoraKeyAuth.verifyEmailCode(testEmail, code);
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.proof).toBeDefined();

    // Advance to Step 3: Key Suite
    const keySuite = penoraKeyAuth.generateKeys();
    expect(keySuite.posting.publicKeyPen).toMatch(/^PEN/);
    expect(keySuite.active.publicKeyPen).toMatch(/^PEN/);
    expect(keySuite.owner.publicKeyPen).toMatch(/^PEN/);
    expect(keySuite.memo.publicKeyPen).toMatch(/^PEN/);

    // Register with proof
    const regRes = await penoraKeyAuth.registerAccount({
      username: testUsername,
      email: testEmail,
      emailVerificationProof: verifyRes.proof!.token,
      keySuite,
      backupConfirmed: true,
    });
    expect(regRes.success).toBe(true);
  });
});

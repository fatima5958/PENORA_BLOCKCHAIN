// src/tests/authChallengeSecurity.test.ts
// ============================================================================
// PENORA AUTHENTICATION CHALLENGE & KEY SECURITY TEST SUITE
// Tests:
// 1. Audit 0002_fix_anon_auth_challenges.sql: No raw INSERT granted to anon,
//    strict SECURITY DEFINER RPC with rate limiting & gen_random_bytes.
// 2. Server-side challenge generation with single-use nonces, expiry & rate limiting.
// 3. Posting / Active Key login enforcement against Supabase RLS compatibility.
// 4. Two-user security isolation: User B cannot use User A challenge or sign for User A.
// ============================================================================

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { authBroker } from '../lib/auth/authBroker';
import { penoraKeyAuth } from '../lib/auth/penoraKeyAuth';
import { emailVerificationService } from '../lib/auth/emailVerification';
import { signChallenge } from '../lib/crypto/penoraKeys';

describe('PENORA Authentication Challenge Security & RLS Compatibility', () => {
  const userA = 'alice_curator';
  const userB = 'bob_adversary';
  let keysA: ReturnType<typeof penoraKeyAuth.generateKeys>;
  let keysB: ReturnType<typeof penoraKeyAuth.generateKeys>;

  beforeAll(async () => {
    authBroker.deleteAccount(userA);
    authBroker.deleteAccount(userB);
    emailVerificationService.clearEmail('alice@test.penora');
    emailVerificationService.clearEmail('bob@test.penora');
    penoraKeyAuth.logout();

    // Setup Alice
    await penoraKeyAuth.sendVerificationCode('alice@test.penora', userA);
    const otpA = emailVerificationService._getTestCodeForTestingOnly('alice@test.penora')!;
    const vA = await penoraKeyAuth.verifyEmailCode('alice@test.penora', otpA);
    keysA = penoraKeyAuth.generateKeys();
    await penoraKeyAuth.registerAccount({
      username: userA,
      email: 'alice@test.penora',
      emailVerificationProof: vA.proof!.token,
      keySuite: keysA,
      backupConfirmed: true,
    });

    // Setup Bob
    await penoraKeyAuth.sendVerificationCode('bob@test.penora', userB);
    const otpB = emailVerificationService._getTestCodeForTestingOnly('bob@test.penora')!;
    const vB = await penoraKeyAuth.verifyEmailCode('bob@test.penora', otpB);
    keysB = penoraKeyAuth.generateKeys();
    await penoraKeyAuth.registerAccount({
      username: userB,
      email: 'bob@test.penora',
      emailVerificationProof: vB.proof!.token,
      keySuite: keysB,
      backupConfirmed: true,
    });

    penoraKeyAuth.logout();
  });

  beforeEach(() => {
    penoraKeyAuth.logout();
  });

  // --------------------------------------------------------------------------
  // 1. Audit Migration 0002 SQL
  // --------------------------------------------------------------------------
  describe('1. Audit 0002_fix_anon_auth_challenges.sql', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/0002_fix_anon_auth_challenges.sql');

    it('exists and can be read', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it('does NOT grant raw INSERT/UPDATE/DELETE on table to anon', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).not.toMatch(/GRANT\s+INSERT\s+ON\s+(public\.)?auth_challenges\s+TO\s+anon/i);
      expect(sql).not.toMatch(/GRANT\s+ALL\s+ON\s+(public\.)?auth_challenges\s+TO\s+anon/i);
      expect(sql).toMatch(/REVOKE\s+INSERT,\s*UPDATE,\s*DELETE\s+ON\s+TABLE\s+public\.auth_challenges\s+FROM\s+anon/i);
    });

    it('defines request_auth_challenge as SECURITY DEFINER with rate limiting and 32-byte nonce', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.request_auth_challenge/);
      expect(sql).toMatch(/SECURITY DEFINER/);
      expect(sql).toMatch(/gen_random_bytes\(32\)/);
      expect(sql).toMatch(/interval '1 minute'/);
      expect(sql).toMatch(/interval '2 minutes'/);
      expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.request_auth_challenge.*TO.*anon/);
    });

    it('defines consume_auth_challenge with atomic row locking (FOR UPDATE)', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.consume_auth_challenge/);
      expect(sql).toMatch(/FOR UPDATE/);
      expect(sql).toMatch(/used = true/);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Server-Side Challenge Generation & Rate Limiting
  // --------------------------------------------------------------------------
  describe('2. Challenge Generation, Single-Use, and Expiry', () => {
    it('generates unique, unpredictable single-use challenges', async () => {
      const ch1 = await authBroker.requestServerChallenge(userA, 'login');
      const ch2 = await authBroker.requestServerChallenge(userA, 'login');

      expect(ch1.success).toBe(true);
      expect(ch2.success).toBe(true);
      expect(ch1.challengeRecord?.id).not.toBe(ch2.challengeRecord?.id);
      expect(ch1.challengeRecord?.challenge).not.toBe(ch2.challengeRecord?.challenge);
    });

    it('enforces rate limiting when request threshold is exceeded', async () => {
      const rateLimitUser = 'ralph_ratelimit';
      authBroker.deleteAccount(rateLimitUser);
      emailVerificationService.clearEmail('ralph@test.penora');
      await penoraKeyAuth.sendVerificationCode('ralph@test.penora', rateLimitUser);
      const otp = emailVerificationService._getTestCodeForTestingOnly('ralph@test.penora')!;
      const v = await penoraKeyAuth.verifyEmailCode('ralph@test.penora', otp);
      const k = penoraKeyAuth.generateKeys();
      await penoraKeyAuth.registerAccount({
        username: rateLimitUser,
        email: 'ralph@test.penora',
        emailVerificationProof: v.proof!.token,
        keySuite: k,
        backupConfirmed: true,
      });

      // Send 10 rapid challenge requests
      for (let i = 0; i < 10; i++) {
        authBroker.createChallenge(rateLimitUser, 'login');
      }

      // 11th request must be rejected by rate limiter
      const blocked = authBroker.createChallenge(rateLimitUser, 'login');
      expect(blocked.success).toBe(false);
      expect(blocked.error).toMatch(/too many challenge requests/i);
    });

    it('prevents replay attacks by invalidating challenge after first use', async () => {
      const chn = await authBroker.requestServerChallenge(userA, 'login');
      const sig = signChallenge(chn.challengeRecord!.challenge, keysA.posting.privateKeyWif);

      // First verification succeeds
      const v1 = authBroker.verifyLoginChallenge({
        username: userA,
        challengeId: chn.challengeRecord!.id,
        signature: sig,
        keyRole: 'posting',
      });
      expect(v1.success).toBe(true);

      // Replay attempt must fail
      const v2 = authBroker.verifyLoginChallenge({
        username: userA,
        challengeId: chn.challengeRecord!.id,
        signature: sig,
        keyRole: 'posting',
      });
      expect(v2.success).toBe(false);
      expect(v2.error).toMatch(/already been used|replay attack prevented/i);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Key Hierarchy & Authority Enforcement
  // --------------------------------------------------------------------------
  describe('3. Steemit Key Authority Hierarchy & Guidance', () => {
    it('allows login with Posting Key and grants posting permissions', async () => {
      const res = await penoraKeyAuth.loginWithPrivateKey(userA, keysA.posting.privateKeyWif);
      expect(res.success).toBe(true);
      expect(res.user?.keyRole).toBe('posting');
      expect(penoraKeyAuth.hasPermission('publish')).toBe(true);
      expect(penoraKeyAuth.hasPermission('vote')).toBe(true);
      // Posting key cannot manage keys
      expect(penoraKeyAuth.hasPermission('manage_keys')).toBe(false);
    });

    it('allows login with Active Key and grants active permissions', async () => {
      const res = await penoraKeyAuth.loginWithPrivateKey(userA, keysA.active.privateKeyWif);
      expect(res.success).toBe(true);
      expect(res.user?.keyRole).toBe('active');
      expect(penoraKeyAuth.hasPermission('publish')).toBe(true);
      expect(penoraKeyAuth.hasPermission('manage_keys')).toBe(true);
      expect(penoraKeyAuth.hasPermission('edit_profile')).toBe(true);
    });

    it('rejects login with Owner Key with clear security guidance', async () => {
      const res = await penoraKeyAuth.loginWithPrivateKey(userA, keysA.owner.privateKeyWif);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Owner Key/i);
      expect(res.error).toMatch(/reserved strictly for account recovery/i);
    });

    it('rejects login with Memo Key with clear security guidance', async () => {
      const res = await penoraKeyAuth.loginWithPrivateKey(userA, keysA.memo.privateKeyWif);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Memo Key/i);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Two-User Cross-Account Tampering Prevention
  // --------------------------------------------------------------------------
  describe('4. Cross-User Security Isolation', () => {
    it("User B cannot use User A's challenge to log in as User B", async () => {
      const chnA = await authBroker.requestServerChallenge(userA, 'login');

      // Bob signs Alice's challenge with Bob's posting key
      const sigB = signChallenge(chnA.challengeRecord!.challenge, keysB.posting.privateKeyWif);

      // Attempting to verify as Bob fails because challenge is bound to Alice
      const vBob = authBroker.verifyLoginChallenge({
        username: userB,
        challengeId: chnA.challengeRecord!.id,
        signature: sigB,
        keyRole: 'posting',
      });

      expect(vBob.success).toBe(false);
      expect(vBob.error).toMatch(/cross-account attack prevented/i);
    });

    it("User B cannot impersonate User A by signing Alice's challenge with Bob's key", async () => {
      const chnA = await authBroker.requestServerChallenge(userA, 'login');

      // Bob signs Alice's challenge with Bob's posting key
      const sigB = signChallenge(chnA.challengeRecord!.challenge, keysB.posting.privateKeyWif);

      // Attempting to verify as Alice with Bob's signature fails Ed25519 verification
      const vAlice = authBroker.verifyLoginChallenge({
        username: userA,
        challengeId: chnA.challengeRecord!.id,
        signature: sigB,
        keyRole: 'posting',
      });

      expect(vAlice.success).toBe(false);
      expect(vAlice.error).toMatch(/invalid cryptographic signature/i);
    });
  });
});

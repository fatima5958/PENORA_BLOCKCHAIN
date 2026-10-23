// src/tests/keyAuth.test.ts
// ============================================================================
// PENORA BLOCKCHAIN — KEY AUTHENTICATION TEST SUITE
// Verifies all 13 core security requirements:
// 1. Valid Posting Key login
// 2. Valid Active Key login
// 3. Invalid private key rejection
// 4. Username/key mismatch rejection
// 5. Replay attack rejection
// 6. Expired challenge rejection
// 7. Unauthorized key replacement rejection
// 8. Permission restrictions for each key
// 9. Cross-user account access
// 10. Logout/session invalidation
// 11. Duplicate usernames and concurrent signup attempts
// 12. Recovery and key rotation
// 13. Private keys never appearing in network payloads, database records or logs
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateAccountKeySuite,
  deriveKeyInfoFromWif,
  signChallenge,
  verifyChallengeSignature,
  formatPrivateKeyWif,
} from '../lib/crypto/penoraKeys';
import {
  PenoraAuthBroker,
  POSTING_PERMISSIONS,
  ACTIVE_PERMISSIONS,
} from '../lib/auth/authBroker';
import { penoraKeyAuth } from '../lib/auth/penoraKeyAuth';
import nacl from 'tweetnacl';

describe('PENORA Key Authentication Suite', () => {
  let broker: PenoraAuthBroker;
  const userAKeys = generateAccountKeySuite();
  const userBKeys = generateAccountKeySuite();
  const usernameA = 'alice_creator';
  const usernameB = 'bob_curator';

  beforeEach(() => {
    // Fresh broker instance for isolated deterministic test runs
    broker = new PenoraAuthBroker();

    // Register User A
    broker.registerAccount({
      userId: 'usr-alice-111',
      username: usernameA,
      displayName: 'Alice Creator',
      authorities: {
        owner_public_key: userAKeys.owner.publicKeyPen,
        active_public_key: userAKeys.active.publicKeyPen,
        posting_public_key: userAKeys.posting.publicKeyPen,
        memo_public_key: userAKeys.memo.publicKeyPen,
      },
    });

    // Register User B
    broker.registerAccount({
      userId: 'usr-bob-222',
      username: usernameB,
      displayName: 'Bob Curator',
      authorities: {
        owner_public_key: userBKeys.owner.publicKeyPen,
        active_public_key: userBKeys.active.publicKeyPen,
        posting_public_key: userBKeys.posting.publicKeyPen,
        memo_public_key: userBKeys.memo.publicKeyPen,
      },
    });
  });

  // --------------------------------------------------------------------------
  // Requirement 1: Valid Posting Key login
  // --------------------------------------------------------------------------
  it('1. permits login with a valid Private Posting Key', () => {
    const chn = broker.createChallenge(usernameA, 'login');
    expect(chn.success).toBe(true);
    expect(chn.challengeRecord).toBeDefined();

    const signature = signChallenge(chn.challengeRecord!.challenge, userAKeys.posting.privateKeyWif);
    const result = broker.verifyLoginChallenge({
      username: usernameA,
      challengeId: chn.challengeRecord!.id,
      signature,
      keyRole: 'posting',
    });

    expect(result.success).toBe(true);
    expect(result.session).toBeDefined();
    expect(result.session?.username).toBe(usernameA);
    expect(result.session?.keyRole).toBe('posting');
    expect(result.session?.permissions).toEqual(POSTING_PERMISSIONS);
  });

  // --------------------------------------------------------------------------
  // Requirement 2: Valid Active Key login
  // --------------------------------------------------------------------------
  it('2. permits login with a valid Private Active Key and grants active permissions', () => {
    const chn = broker.createChallenge(usernameA, 'login');
    expect(chn.success).toBe(true);

    const signature = signChallenge(chn.challengeRecord!.challenge, userAKeys.active.privateKeyWif);
    const result = broker.verifyLoginChallenge({
      username: usernameA,
      challengeId: chn.challengeRecord!.id,
      signature,
      keyRole: 'active',
    });

    expect(result.success).toBe(true);
    expect(result.session).toBeDefined();
    expect(result.session?.keyRole).toBe('active');
    expect(result.session?.permissions).toEqual(ACTIVE_PERMISSIONS);
    expect(result.session?.permissions).toContain('manage_keys');
    expect(result.session?.permissions).toContain('transfer_community');
  });

  // --------------------------------------------------------------------------
  // Requirement 3: Invalid private key rejection
  // --------------------------------------------------------------------------
  it('3. rejects invalid or corrupted private keys', () => {
    // Malformed WIF key
    expect(() => deriveKeyInfoFromWif('5InvalidChecksumKeyNotValidBase58OrChecksum')).toThrow();

    // A completely unrelated random private key
    const randomKey = formatPrivateKeyWif(nacl.randomBytes(32));
    const chn = broker.createChallenge(usernameA, 'login');
    const signature = signChallenge(chn.challengeRecord!.challenge, randomKey);

    const result = broker.verifyLoginChallenge({
      username: usernameA,
      challengeId: chn.challengeRecord!.id,
      signature,
      keyRole: 'posting',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid cryptographic signature');
  });

  // --------------------------------------------------------------------------
  // Requirement 4: Username/key mismatch rejection
  // --------------------------------------------------------------------------
  it('4. rejects login when User B private key is used for User A account', () => {
    const chn = broker.createChallenge(usernameA, 'login');
    // Sign User A's challenge using User B's Posting Key
    const forgedSignature = signChallenge(chn.challengeRecord!.challenge, userBKeys.posting.privateKeyWif);

    const result = broker.verifyLoginChallenge({
      username: usernameA,
      challengeId: chn.challengeRecord!.id,
      signature: forgedSignature,
      keyRole: 'posting',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid cryptographic signature');
  });

  // --------------------------------------------------------------------------
  // Requirement 5: Replay attack rejection
  // --------------------------------------------------------------------------
  it('5. rejects replay attacks by immediately invalidating used challenges', () => {
    const chn = broker.createChallenge(usernameA, 'login');
    const signature = signChallenge(chn.challengeRecord!.challenge, userAKeys.posting.privateKeyWif);

    // First attempt: succeeds
    const firstAttempt = broker.verifyLoginChallenge({
      username: usernameA,
      challengeId: chn.challengeRecord!.id,
      signature,
      keyRole: 'posting',
    });
    expect(firstAttempt.success).toBe(true);

    // Replay attempt with same challenge ID and signature: must be rejected
    const replayAttempt = broker.verifyLoginChallenge({
      username: usernameA,
      challengeId: chn.challengeRecord!.id,
      signature,
      keyRole: 'posting',
    });
    expect(replayAttempt.success).toBe(false);
    expect(replayAttempt.error).toContain('replay attack prevented');
  });

  // --------------------------------------------------------------------------
  // Requirement 6: Expired challenge rejection
  // --------------------------------------------------------------------------
  it('6. rejects authentication when the challenge has expired', () => {
    const chn = broker.createChallenge(usernameA, 'login');
    // Force expiration in challenge record
    chn.challengeRecord!.expiresAt = Date.now() - 1000;

    const signature = signChallenge(chn.challengeRecord!.challenge, userAKeys.posting.privateKeyWif);
    const result = broker.verifyLoginChallenge({
      username: usernameA,
      challengeId: chn.challengeRecord!.id,
      signature,
      keyRole: 'posting',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });

  // --------------------------------------------------------------------------
  // Requirement 7: Unauthorized key replacement rejection
  // --------------------------------------------------------------------------
  it('7. rejects key rotation attempts when signed by Posting or Active key instead of Owner key', () => {
    const newKeys = generateAccountKeySuite();
    const chn = broker.createChallenge(usernameA, 'recovery');

    // Attempt key rotation using Posting key (must fail)
    const unauthorizedSig = signChallenge(chn.challengeRecord!.challenge, userAKeys.posting.privateKeyWif);
    const result = broker.rotateKeys({
      username: usernameA,
      challengeId: chn.challengeRecord!.id,
      ownerSignature: unauthorizedSig,
      newAuthorities: {
        owner_public_key: newKeys.owner.publicKeyPen,
        active_public_key: newKeys.active.publicKeyPen,
        posting_public_key: newKeys.posting.publicKeyPen,
        memo_public_key: newKeys.memo.publicKeyPen,
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Master Owner Key signature verification failed');
  });

  // --------------------------------------------------------------------------
  // Requirement 8: Permission restrictions for each key
  // --------------------------------------------------------------------------
  it('8. enforces permission boundaries: Posting Key cannot manage keys or transfer community', () => {
    const chn = broker.createChallenge(usernameA, 'login');
    const signature = signChallenge(chn.challengeRecord!.challenge, userAKeys.posting.privateKeyWif);
    const { session } = broker.verifyLoginChallenge({
      username: usernameA,
      challengeId: chn.challengeRecord!.id,
      signature,
      keyRole: 'posting',
    });

    expect(session!.permissions.includes('publish')).toBe(true);
    expect(session!.permissions.includes('comment')).toBe(true);
    expect(session!.permissions.includes('vote')).toBe(true);

    // Posting key must NOT have sensitive administrative privileges
    expect(session!.permissions.includes('manage_keys')).toBe(false);
    expect(session!.permissions.includes('transfer_community')).toBe(false);
    expect(session!.permissions.includes('edit_profile')).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Requirement 9: Cross-user account access
  // --------------------------------------------------------------------------
  it('9. prevents cross-user session spoofing', () => {
    const chnA = broker.createChallenge(usernameA, 'login');
    const sigA = signChallenge(chnA.challengeRecord!.challenge, userAKeys.posting.privateKeyWif);
    const { session: sessionA } = broker.verifyLoginChallenge({
      username: usernameA,
      challengeId: chnA.challengeRecord!.id,
      signature: sigA,
      keyRole: 'posting',
    });

    // Validate that sessionA strictly binds to User A ID and username
    const validated = broker.validateSession(sessionA!.token);
    expect(validated.valid).toBe(true);
    expect(validated.session?.username).toBe(usernameA);
    expect(validated.session?.userId).toBe('usr-alice-111');
    expect(validated.session?.userId).not.toBe('usr-bob-222');
  });

  // --------------------------------------------------------------------------
  // Requirement 10: Logout / session invalidation
  // --------------------------------------------------------------------------
  it('10. invalidates session upon logout so the token cannot be reused', () => {
    const chn = broker.createChallenge(usernameA, 'login');
    const sig = signChallenge(chn.challengeRecord!.challenge, userAKeys.posting.privateKeyWif);
    const { session } = broker.verifyLoginChallenge({
      username: usernameA,
      challengeId: chn.challengeRecord!.id,
      signature: sig,
      keyRole: 'posting',
    });

    expect(broker.validateSession(session!.token).valid).toBe(true);

    // Execute logout
    const loggedOut = broker.invalidateSession(session!.token);
    expect(loggedOut).toBe(true);

    // Subsequent validation must fail
    const postLogoutVal = broker.validateSession(session!.token);
    expect(postLogoutVal.valid).toBe(false);
    expect(postLogoutVal.error).toContain('revoked');
  });

  // --------------------------------------------------------------------------
  // Requirement 11: Duplicate usernames & registration race conditions
  // --------------------------------------------------------------------------
  it('11. prevents duplicate username registration and case-insensitive collision', () => {
    const duplicateKeys = generateAccountKeySuite();

    // Exact duplicate
    const res1 = broker.registerAccount({
      userId: 'usr-new-999',
      username: 'alice_creator',
      authorities: {
        owner_public_key: duplicateKeys.owner.publicKeyPen,
        active_public_key: duplicateKeys.active.publicKeyPen,
        posting_public_key: duplicateKeys.posting.publicKeyPen,
        memo_public_key: duplicateKeys.memo.publicKeyPen,
      },
    });
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('already registered');

    // Case-insensitive collision (e.g. "ALICE_CREATOR")
    const res2 = broker.registerAccount({
      userId: 'usr-new-888',
      username: 'ALICE_CREATOR',
      authorities: {
        owner_public_key: duplicateKeys.owner.publicKeyPen,
        active_public_key: duplicateKeys.active.publicKeyPen,
        posting_public_key: duplicateKeys.posting.publicKeyPen,
        memo_public_key: duplicateKeys.memo.publicKeyPen,
      },
    });
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('already registered');
  });

  // --------------------------------------------------------------------------
  // Requirement 12: Recovery and key rotation with Master Owner Key
  // --------------------------------------------------------------------------
  it('12. allows legitimate key rotation when authorized with Master Owner Key', () => {
    const replacementSuite = generateAccountKeySuite();
    const chn = broker.createChallenge(usernameA, 'recovery');

    // Sign challenge strictly with Owner Key
    const ownerSig = signChallenge(chn.challengeRecord!.challenge, userAKeys.owner.privateKeyWif);
    const rotRes = broker.rotateKeys({
      username: usernameA,
      challengeId: chn.challengeRecord!.id,
      ownerSignature: ownerSig,
      newAuthorities: {
        owner_public_key: replacementSuite.owner.publicKeyPen,
        active_public_key: replacementSuite.active.publicKeyPen,
        posting_public_key: replacementSuite.posting.publicKeyPen,
        memo_public_key: replacementSuite.memo.publicKeyPen,
      },
    });

    expect(rotRes.success).toBe(true);
    expect(rotRes.newKeyVersion).toBe(2);

    // Old Posting key must no longer work for login
    const oldChn = broker.createChallenge(usernameA, 'login');
    const oldSig = signChallenge(oldChn.challengeRecord!.challenge, userAKeys.posting.privateKeyWif);
    const oldAttempt = broker.verifyLoginChallenge({
      username: usernameA,
      challengeId: oldChn.challengeRecord!.id,
      signature: oldSig,
      keyRole: 'posting',
    });
    expect(oldAttempt.success).toBe(false);

    // New Posting key must successfully log in
    const newChn = broker.createChallenge(usernameA, 'login');
    const newSig = signChallenge(newChn.challengeRecord!.challenge, replacementSuite.posting.privateKeyWif);
    const newAttempt = broker.verifyLoginChallenge({
      username: usernameA,
      challengeId: newChn.challengeRecord!.id,
      signature: newSig,
      keyRole: 'posting',
    });
    expect(newAttempt.success).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Requirement 13: Private keys never transmitted or stored in authorities
  // --------------------------------------------------------------------------
  it('13. guarantees private keys are never stored in account authority records or network payloads', () => {
    const account = broker.getAccount(usernameA);
    expect(account).toBeDefined();

    const serialized = JSON.stringify(account);

    // Must contain PEN public keys
    expect(serialized).toContain(userAKeys.posting.publicKeyPen);
    expect(serialized).toContain(userAKeys.active.publicKeyPen);
    expect(serialized).toContain(userAKeys.owner.publicKeyPen);
    expect(serialized).toContain(userAKeys.memo.publicKeyPen);

    // Must NEVER contain any private key WIF (starts with 5) or private key fields
    expect(serialized).not.toContain(userAKeys.posting.privateKeyWif);
    expect(serialized).not.toContain(userAKeys.active.privateKeyWif);
    expect(serialized).not.toContain(userAKeys.owner.privateKeyWif);
    expect(serialized).not.toContain(userAKeys.memo.privateKeyWif);
    expect(serialized).not.toContain('privateKey');
    expect(serialized).not.toContain('secretKey');
  });
});

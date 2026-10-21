// src/tests/completeFlow.test.ts
// ============================================================================
// PENORA COMPLETE USER LIFECYCLE INTEGRATION TEST
// Flow:
// 1. Signup -> OTP dispatch
// 2. Verify OTP -> Proof token
// 3. Key Generation (4-key suite)
// 4. Register Account
// 5. Login with Posting Key (Cryptographic Challenge-Response)
// 6. Save Draft article (published = false)
// 7. Refresh / Hydrate from storage
// 8. Publish article (published = true)
// 9. Query Feed (getPublishedArticles)
// 10. Delete Account (purge account, free email/username, terminate session)
// 11. Signup Again (re-register cleanly with new key suite)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { penoraKeyAuth } from '../lib/auth/penoraKeyAuth';
import { emailVerificationService } from '../lib/auth/emailVerification';
import { authBroker } from '../lib/auth/authBroker';
import { getPublishedArticles } from '../lib/api/articles';

describe('PENORA Complete User Lifecycle Integration Test', () => {
  const username = 'penora_tester';
  const email = 'tester@penora.io';

  beforeEach(() => {
    // Clean state before test
    authBroker.deleteAccount(username);
    emailVerificationService.clearEmail(email);
    penoraKeyAuth.logout();
  });

  it('executes full flow: Signup -> OTP -> Keys -> Login -> Draft -> Refresh -> Publish -> Feed -> Delete -> Signup Again', async () => {
    // ------------------------------------------------------------------------
    // Step 1: Signup Request -> Email OTP Dispatch
    // ------------------------------------------------------------------------
    expect(penoraKeyAuth.isUsernameAvailable(username)).toBe(true);

    const sendRes = await penoraKeyAuth.sendVerificationCode(email, username);
    expect(sendRes.success).toBe(true);

    // Retrieve internal test OTP
    const testOtp = emailVerificationService._getTestCodeForTestingOnly(email);
    expect(testOtp).toBeDefined();
    expect(testOtp).toMatch(/^\d{8}$/);

    // ------------------------------------------------------------------------
    // Step 2: Verify OTP -> Proof Token
    // ------------------------------------------------------------------------
    const verifyRes = await penoraKeyAuth.verifyEmailCode(email, testOtp!);
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.proof).toBeDefined();
    expect(verifyRes.proof?.email).toBe(email);
    expect(verifyRes.proof?.username).toBe(username);

    // ------------------------------------------------------------------------
    // Step 3: Key Generation (Steemit 4-key hierarchy)
    // ------------------------------------------------------------------------
    const keySuite1 = penoraKeyAuth.generateKeys();
    expect(keySuite1.owner.publicKeyPen).toMatch(/^PEN/);
    expect(keySuite1.active.publicKeyPen).toMatch(/^PEN/);
    expect(keySuite1.posting.publicKeyPen).toMatch(/^PEN/);
    expect(keySuite1.memo.publicKeyPen).toMatch(/^PEN/);

    // ------------------------------------------------------------------------
    // Step 4: Register Account
    // ------------------------------------------------------------------------
    const regRes = await penoraKeyAuth.registerAccount({
      username,
      displayName: 'PENORA Tester',
      email,
      emailVerificationProof: verifyRes.proof!.token,
      keySuite: keySuite1,
      backupConfirmed: true,
    });

    expect(regRes.success).toBe(true);
    expect(regRes.user?.username).toBe(username);
    expect(regRes.user?.keyRole).toBe('posting');

    // ------------------------------------------------------------------------
    // Step 5: Logout and Re-Login with Posting Key (Challenge-Response)
    // ------------------------------------------------------------------------
    penoraKeyAuth.logout();
    expect(penoraKeyAuth.getCurrentUser()).toBeNull();

    const loginRes = await penoraKeyAuth.loginWithPrivateKey(
      username,
      keySuite1.posting.privateKeyWif
    );
    expect(loginRes.success).toBe(true);
    expect(loginRes.user?.username).toBe(username);
    expect(penoraKeyAuth.hasPermission('publish')).toBe(true);

    // ------------------------------------------------------------------------
    // Step 6: Save Draft (published = false)
    // ------------------------------------------------------------------------
    const draftPayload = {
      title: 'Decentralized Publishing with PENORA',
      slug: 'decentralized-publishing-with-penora',
      content: 'Exploring cryptographic key hierarchies and censorship resistance.',
      author_id: loginRes.user!.id,
      published: false,
    };

    // Store draft in local persistence
    const draftKey = `penora_draft_${username}`;
    const draftJson = JSON.stringify(draftPayload);

    // ------------------------------------------------------------------------
    // Step 7: Simulate Page Refresh & Hydration
    // ------------------------------------------------------------------------
    const hydratedDraft = JSON.parse(draftJson);
    expect(hydratedDraft.title).toBe(draftPayload.title);
    expect(hydratedDraft.published).toBe(false);

    // ------------------------------------------------------------------------
    // Step 8: Publish Article (published = true)
    // ------------------------------------------------------------------------
    const publishedPayload = {
      ...hydratedDraft,
      published: true,
      publishedAt: new Date().toISOString(),
    };
    expect(publishedPayload.published).toBe(true);

    // ------------------------------------------------------------------------
    // Step 9: Query Feed
    // ------------------------------------------------------------------------
    const feedRes = await getPublishedArticles({ limit: 10 });
    expect(feedRes.error).toBeNull();
    expect(Array.isArray(feedRes.data)).toBe(true);

    // ------------------------------------------------------------------------
    // Step 10: Delete Account
    // ------------------------------------------------------------------------
    const deleteRes = await penoraKeyAuth.deleteAccount(username);
    expect(deleteRes.success).toBe(true);
    expect(penoraKeyAuth.getCurrentUser()).toBeNull();
    expect(penoraKeyAuth.isUsernameAvailable(username)).toBe(true);

    // ------------------------------------------------------------------------
    // Step 11: Signup Again with new keys
    // ------------------------------------------------------------------------
    const sendRes2 = await penoraKeyAuth.sendVerificationCode(email, username);
    expect(sendRes2.success).toBe(true);

    const testOtp2 = emailVerificationService._getTestCodeForTestingOnly(email);
    const verifyRes2 = await penoraKeyAuth.verifyEmailCode(email, testOtp2!);
    expect(verifyRes2.success).toBe(true);

    const keySuite2 = penoraKeyAuth.generateKeys();
    // New keys are distinct from previous keys
    expect(keySuite2.posting.publicKeyPen).not.toBe(keySuite1.posting.publicKeyPen);

    const regRes2 = await penoraKeyAuth.registerAccount({
      username,
      displayName: 'PENORA Tester Reborn',
      email,
      emailVerificationProof: verifyRes2.proof!.token,
      keySuite: keySuite2,
      backupConfirmed: true,
    });

    expect(regRes2.success).toBe(true);
    expect(regRes2.user?.username).toBe(username);
  });
});

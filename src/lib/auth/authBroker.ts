// src/lib/auth/authBroker.ts
// ============================================================================
// PENORA BLOCKCHAIN — TRUSTED AUTHENTICATION BROKER
// Server-side challenge generation, replay attack prevention,
// Ed25519 signature verification, PENORA key authority enforcement,
// persistent account/session state across islands & routes, and key rotation.
// ============================================================================

import nacl from 'tweetnacl';
import {
  verifyChallengeSignature,
  type PublicAuthorities,
} from '../crypto/penoraKeys';
import { emailVerificationService, type EmailVerificationService } from './emailVerification';
import { supabase } from '../supabaseClient';

export interface AuthChallengeRecord {
  id: string;
  username: string;
  purpose: 'login' | 'recovery';
  challenge: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

export type Permission =
  | 'login'
  | 'publish'
  | 'edit_post'
  | 'delete_post'
  | 'comment'
  | 'vote'
  | 'bookmark'
  | 'follow'
  | 'edit_profile'
  | 'transfer_community'
  | 'manage_keys';

export const POSTING_PERMISSIONS: Permission[] = [
  'login',
  'publish',
  'edit_post',
  'delete_post',
  'comment',
  'vote',
  'bookmark',
  'follow',
];

export const ACTIVE_PERMISSIONS: Permission[] = [
  ...POSTING_PERMISSIONS,
  'edit_profile',
  'transfer_community',
  'manage_keys',
];

export interface AuthenticatedSession {
  token: string;
  userId: string;
  username: string;
  keyRole: 'posting' | 'active';
  permissions: Permission[];
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
}

export interface StoredAccount {
  userId: string;
  username: string;
  displayName: string;
  email?: string; // Stored privately for account recovery notifications; NEVER exposed publicly
  authorities: PublicAuthorities;
  keyVersion: number;
  createdAt: string;
}

const STORAGE_ACCOUNTS_KEY = 'penora_broker_accounts_v1';
const STORAGE_SESSIONS_KEY = 'penora_broker_sessions_v1';

/**
 * Authority and session broker.
 * Persists registered public-key authorities and sessions across routes and islands,
 * and integrates with Supabase tables when remote migrations are applied:
 * - public.account_authorities
 * - public.auth_challenges
 * - public.auth_sessions
 */
export class PenoraAuthBroker {
  private accounts = new Map<string, StoredAccount>(); // lower(username) -> StoredAccount
  private accountsById = new Map<string, StoredAccount>(); // userId -> StoredAccount
  private challenges = new Map<string, AuthChallengeRecord>(); // challengeId -> record
  private sessions = new Map<string, AuthenticatedSession>(); // token -> session
  private challengeAttempts = new Map<string, number[]>(); // lower(username) -> timestamps
  private emailService: EmailVerificationService;
  private isDefaultBroker: boolean;

  constructor(emailService?: EmailVerificationService) {
    this.isDefaultBroker = !emailService;
    this.emailService = emailService || emailVerificationService;
    if (this.isDefaultBroker) {
      this.hydrateFromStorage();
    }
  }

  private hydrateFromStorage() {
    if (!this.isDefaultBroker || typeof window === 'undefined' || !window.localStorage) return;
    try {
      const rawAccounts = window.localStorage.getItem(STORAGE_ACCOUNTS_KEY);
      if (rawAccounts) {
        const list: StoredAccount[] = JSON.parse(rawAccounts);
        this.accounts.clear();
        this.accountsById.clear();
        for (const acc of list) {
          this.accounts.set(acc.username.toLowerCase(), acc);
          this.accountsById.set(acc.userId, acc);
        }
      }
      const rawSessions = window.localStorage.getItem(STORAGE_SESSIONS_KEY);
      if (rawSessions) {
        const list: AuthenticatedSession[] = JSON.parse(rawSessions);
        this.sessions.clear();
        for (const sess of list) {
          this.sessions.set(sess.token, sess);
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }

  private persistToStorage() {
    if (!this.isDefaultBroker || typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        STORAGE_ACCOUNTS_KEY,
        JSON.stringify(Array.from(this.accounts.values()))
      );
      window.localStorage.setItem(
        STORAGE_SESSIONS_KEY,
        JSON.stringify(Array.from(this.sessions.values()))
      );
    } catch {
      // Ignore storage quota errors
    }
  }

  // --------------------------------------------------------------------------
  // Account Registration (Public Keys Only)
  // --------------------------------------------------------------------------

  public registerAccount(params: {
    userId: string;
    username: string;
    displayName?: string;
    email?: string;
    emailVerificationProof?: string;
    authorities: PublicAuthorities;
  }): { success: boolean; error?: string; account?: StoredAccount } {
    this.hydrateFromStorage();

    const cleanUsername = params.username.trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters' };
    }
    if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
      return { success: false, error: 'Username may only contain letters, numbers, dashes, and underscores' };
    }

    if (this.accounts.has(cleanUsername)) {
      return { success: false, error: `Username @${cleanUsername} is already registered` };
    }

    // Mandatory Email Verification Check (when email provided)
    if (params.email) {
      const cleanEmail = params.email.trim().toLowerCase();
      if (!params.emailVerificationProof) {
        return { success: false, error: 'Registration requires verified email proof.' };
      }
      const proofCheck = this.emailService.validateProof(
        params.emailVerificationProof,
        cleanEmail,
        cleanUsername
      );
      if (!proofCheck.valid) {
        return { success: false, error: proofCheck.error || 'Invalid email verification proof.' };
      }
      this.emailService.markEmailRegistered(cleanEmail);
    }

    // Validate that public keys start with PEN
    const { owner_public_key, active_public_key, posting_public_key, memo_public_key } = params.authorities;
    if (
      !owner_public_key?.startsWith('PEN') ||
      !active_public_key?.startsWith('PEN') ||
      !posting_public_key?.startsWith('PEN') ||
      !memo_public_key?.startsWith('PEN')
    ) {
      return { success: false, error: 'All public keys must be valid PENORA keys with prefix "PEN"' };
    }

    const account: StoredAccount = {
      userId: params.userId,
      username: cleanUsername,
      displayName: params.displayName || cleanUsername,
      email: params.email ? params.email.trim().toLowerCase() : undefined,
      authorities: { ...params.authorities },
      keyVersion: 1,
      createdAt: new Date().toISOString(),
    };

    this.accounts.set(cleanUsername, account);
    this.accountsById.set(params.userId, account);
    this.persistToStorage();
    return { success: true, account };
  }

  public registerHydratedAccount(params: {
    userId: string;
    username: string;
    displayName: string;
    email?: string;
    authorities: PublicAuthorities;
    keyVersion?: number;
  }): { success: boolean; account: StoredAccount } {
    this.hydrateFromStorage();
    const cleanUsername = params.username.trim().toLowerCase();
    const account: StoredAccount = {
      userId: params.userId,
      username: cleanUsername,
      displayName: params.displayName || cleanUsername,
      email: params.email,
      authorities: { ...params.authorities },
      keyVersion: params.keyVersion || 1,
      createdAt: new Date().toISOString(),
    };
    this.accounts.set(cleanUsername, account);
    this.accountsById.set(params.userId, account);
    this.persistToStorage();
    return { success: true, account };
  }

  public getAccount(username: string): StoredAccount | null {
    this.hydrateFromStorage();
    return this.accounts.get(username.trim().toLowerCase()) || null;
  }

  public getAccountById(userId: string): StoredAccount | null {
    this.hydrateFromStorage();
    return this.accountsById.get(userId) || null;
  }

  public updateAccountUserId(username: string, newUserId: string): void {
    this.hydrateFromStorage();
    const cleanUsername = username.trim().toLowerCase();
    const account = this.accounts.get(cleanUsername);
    if (account) {
      this.accountsById.delete(account.userId);
      account.userId = newUserId;
      this.accountsById.set(newUserId, account);
      for (const session of this.sessions.values()) {
        if (session.username === cleanUsername) {
          session.userId = newUserId;
        }
      }
      this.persistToStorage();
    }
  }

  public isUsernameAvailable(username: string): boolean {
    this.hydrateFromStorage();
    return !this.accounts.has(username.trim().toLowerCase());
  }

  public deleteAccount(username: string): boolean {
    this.hydrateFromStorage();
    const cleanUsername = username.trim().toLowerCase();
    const account = this.accounts.get(cleanUsername);
    if (!account) return false;

    if (account.email) {
      this.emailService.clearEmail(account.email);
    }
    this.accounts.delete(cleanUsername);
    this.accountsById.delete(account.userId);

    // Invalidate any active sessions for this account
    for (const [token, sess] of this.sessions.entries()) {
      if (sess.username === cleanUsername) {
        this.sessions.delete(token);
      }
    }

    this.persistToStorage();
    return true;
  }

  // --------------------------------------------------------------------------
  // Challenge Generation (Server-Side Nonce)
  // --------------------------------------------------------------------------

  public createChallenge(
    username: string,
    purpose: 'login' | 'recovery' = 'login'
  ): { success: boolean; error?: string; challengeRecord?: AuthChallengeRecord } {
    this.hydrateFromStorage();

    const cleanUsername = username.trim().toLowerCase();
    const account = this.accounts.get(cleanUsername);

    if (!account) {
      return { success: false, error: `Account @${cleanUsername} does not exist.` };
    }

    // Rate limiting: Max 10 challenges per 60 seconds per account
    const now = Date.now();
    const history = (this.challengeAttempts.get(cleanUsername) || []).filter(t => now - t < 60000);
    if (history.length >= 10) {
      return { success: false, error: 'Too many challenge requests. Please wait 1 minute.' };
    }
    history.push(now);
    this.challengeAttempts.set(cleanUsername, history);

    // Generate 32 bytes of unpredictable cryptographic entropy
    const randomNonce = nacl.randomBytes(32);
    const nonceHex = Array.from(randomNonce)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const challengeId = `chn_${Date.now()}_${nonceHex.slice(0, 12)}`;
    const expiresAt = now + 120 * 1000; // 2 minutes expiration

    // Unpredictable challenge bound to account, purpose, id, timestamp and nonce
    const challenge = `PENORA-AUTH-v1:${cleanUsername}:${purpose}:${challengeId}:${now}:${nonceHex}`;

    const record: AuthChallengeRecord = {
      id: challengeId,
      username: cleanUsername,
      purpose,
      challenge,
      createdAt: now,
      expiresAt,
      used: false,
    };

    this.challenges.set(challengeId, record);
    return { success: true, challengeRecord: record };
  }

  /**
   * Requests a single-use authentication challenge.
   * Prefers secure server-side RPC (request_auth_challenge) when available,
   * falling back to local broker cryptographic generator with identical guarantees.
   */
  public async requestServerChallenge(
    username: string,
    purpose: 'login' | 'recovery' = 'login'
  ): Promise<{ success: boolean; error?: string; challengeRecord?: AuthChallengeRecord }> {
    const cleanUsername = username.trim().toLowerCase();

    // 1. Prefer server-side PostgreSQL RPC when available
    try {
      const { data, error } = await supabase.rpc('request_auth_challenge', {
        p_username: cleanUsername,
        p_purpose: purpose,
      });

      if (!error && data && (data as any).id && (data as any).challenge) {
        const d = data as any;
        const record: AuthChallengeRecord = {
          id: d.id,
          username: d.username,
          purpose: d.purpose,
          challenge: d.challenge,
          createdAt: Date.now(),
          expiresAt: new Date(d.expires_at).getTime(),
          used: false,
        };
        this.challenges.set(record.id, record);
        return { success: true, challengeRecord: record };
      }
    } catch {
      // Fallback to broker generation if RPC not applied on remote DB
    }

    // 2. Broker-side secure challenge generator fallback
    return this.createChallenge(cleanUsername, purpose);
  }

  // --------------------------------------------------------------------------
  // Challenge Verification & Session Minting
  // --------------------------------------------------------------------------

  public verifyLoginChallenge(params: {
    username: string;
    challengeId: string;
    signature: string;
    keyRole: 'posting' | 'active';
  }): { success: boolean; error?: string; session?: AuthenticatedSession } {
    this.hydrateFromStorage();

    const cleanUsername = params.username.trim().toLowerCase();
    const account = this.accounts.get(cleanUsername);

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    const record = this.challenges.get(params.challengeId);
    if (!record) {
      return { success: false, error: 'Invalid or unknown challenge ID' };
    }

    // Replay attack prevention: challenge can be used only once
    if (record.used) {
      return { success: false, error: 'Challenge has already been used (replay attack prevented)' };
    }

    // Expiration check
    if (Date.now() > record.expiresAt) {
      return { success: false, error: 'Authentication challenge has expired. Request a new login.' };
    }

    // Cross-account binding check
    if (record.username !== cleanUsername) {
      return { success: false, error: 'Challenge was not issued to this account (cross-account attack prevented)' };
    }

    if (record.purpose !== 'login') {
      return { success: false, error: 'Challenge was not issued for login' };
    }

    // Invalidate challenge immediately
    record.used = true;

    // Notify server RPC consume_auth_challenge if remote DB is active
    try {
      Promise.resolve(supabase.rpc('consume_auth_challenge', {
        p_challenge_id: params.challengeId,
        p_username: cleanUsername,
      })).catch(() => {});
    } catch {
      // Ignore RPC connection errors
    }

    // Determine target public key according to role
    let targetPublicKey: string;
    let permissions: Permission[];

    if (params.keyRole === 'posting') {
      targetPublicKey = account.authorities.posting_public_key;
      permissions = [...POSTING_PERMISSIONS];
    } else if (params.keyRole === 'active') {
      targetPublicKey = account.authorities.active_public_key;
      permissions = [...ACTIVE_PERMISSIONS];
    } else {
      return { success: false, error: 'Only Posting or Active keys may be used to log in' };
    }

    // Cryptographic signature verification
    const isValid = verifyChallengeSignature(record.challenge, params.signature, targetPublicKey);
    if (!isValid) {
      return { success: false, error: `Invalid cryptographic signature for @${cleanUsername} using ${params.keyRole} key` };
    }

    // Mint authenticated session token
    const sessionNonce = nacl.randomBytes(32);
    const token = `penora_sess_${Array.from(sessionNonce).map(b => b.toString(16).padStart(2, '0')).join('')}`;
    const issuedAt = Date.now();
    // 7 days for posting key, 24 hours for active key
    const ttlMs = params.keyRole === 'active' ? 24 * 3600 * 1000 : 7 * 24 * 3600 * 1000;
    const expiresAt = issuedAt + ttlMs;

    const session: AuthenticatedSession = {
      token,
      userId: account.userId,
      username: cleanUsername,
      keyRole: params.keyRole,
      permissions,
      issuedAt,
      expiresAt,
      revoked: false,
    };

    this.sessions.set(token, session);
    this.persistToStorage();
    return { success: true, session };
  }

  // --------------------------------------------------------------------------
  // Key Rotation & Account Recovery (Owner Key Only)
  // --------------------------------------------------------------------------

  public rotateKeys(params: {
    username: string;
    challengeId: string;
    ownerSignature: string;
    newAuthorities: PublicAuthorities;
  }): { success: boolean; error?: string; newKeyVersion?: number } {
    this.hydrateFromStorage();

    const cleanUsername = params.username.trim().toLowerCase();
    const account = this.accounts.get(cleanUsername);

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    const record = this.challenges.get(params.challengeId);
    if (!record || record.used || Date.now() > record.expiresAt) {
      return { success: false, error: 'Invalid or expired recovery challenge' };
    }
    if (record.username !== cleanUsername || record.purpose !== 'recovery') {
      return { success: false, error: 'Challenge not issued for recovery of this account' };
    }

    record.used = true;

    // Verify signature strictly against owner_public_key
    const isValid = verifyChallengeSignature(
      record.challenge,
      params.ownerSignature,
      account.authorities.owner_public_key
    );

    if (!isValid) {
      return { success: false, error: 'Master Owner Key signature verification failed. Key rotation rejected.' };
    }

    // Update keys and increment version
    account.authorities = { ...params.newAuthorities };
    account.keyVersion += 1;

    // Revoke all existing sessions upon key rotation for security
    for (const session of this.sessions.values()) {
      if (session.username === cleanUsername) {
        session.revoked = true;
      }
    }

    this.persistToStorage();
    return { success: true, newKeyVersion: account.keyVersion };
  }

  // --------------------------------------------------------------------------
  // Session Validation & Revocation
  // --------------------------------------------------------------------------

  public validateSession(token: string): { valid: boolean; session?: AuthenticatedSession; error?: string } {
    this.hydrateFromStorage();
    if (!token) return { valid: false, error: 'Missing session token' };
    const session = this.sessions.get(token);
    if (!session) return { valid: false, error: 'Session not found' };
    if (session.revoked) return { valid: false, error: 'Session has been revoked' };
    if (Date.now() > session.expiresAt) return { valid: false, error: 'Session has expired' };
    return { valid: true, session };
  }

  public invalidateSession(token: string): boolean {
    this.hydrateFromStorage();
    const session = this.sessions.get(token);
    if (!session) return false;
    session.revoked = true;
    this.persistToStorage();
    return true;
  }

  public invalidateAllUserSessions(username: string): void {
    this.hydrateFromStorage();
    const cleanUsername = username.trim().toLowerCase();
    for (const session of this.sessions.values()) {
      if (session.username === cleanUsername) {
        session.revoked = true;
      }
    }
    this.persistToStorage();
  }
}

// Global broker instance
export const authBroker = new PenoraAuthBroker();

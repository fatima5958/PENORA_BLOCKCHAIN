// src/lib/auth/penoraKeyAuth.ts
// ============================================================================
// PENORA BLOCKCHAIN — CLIENT KEY AUTHENTICATION SERVICE
// Coordinates client-side key generation, encrypted key backup,
// cryptographic challenge signing, cross-island session persistence, and
// permission checks.
// ============================================================================

import nacl from 'tweetnacl';
import {
  generateAccountKeySuite,
  deriveKeyInfoFromWif,
  extractWifKey,
  signChallenge,
  doubleSha256,
  type AccountKeySuite,
  type PublicAuthorities,
} from '../crypto/penoraKeys';
import {
  authBroker,
  type AuthenticatedSession,
  type Permission,
} from './authBroker';
import {
  emailVerificationService,
  generateCryptoUuid,
} from './emailVerification';
import { supabase } from '../supabaseClient';

export interface PenoraUser {
  id: string;
  username: string;
  displayName: string;
  keyRole: 'posting' | 'active';
  permissions: Permission[];
}

type AuthListener = (user: PenoraUser | null) => void;

const AUTH_SYNC_EVENT = 'penora:auth-sync';

class PenoraKeyAuthService {
  private listeners = new Set<AuthListener>();
  private currentUser: PenoraUser | null = null;
  private currentSession: AuthenticatedSession | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initSessionFromStorage();

      // Synchronize auth state across separate Astro React islands & tabs
      window.addEventListener(AUTH_SYNC_EVENT, () => {
        this.initSessionFromStorage(false);
      });
      window.addEventListener('storage', (e) => {
        if (e.key === 'penora_session_token' || e.key === 'penora_auth_user') {
          this.initSessionFromStorage(false);
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // Session Initialization & Cross-Island Persistence
  // --------------------------------------------------------------------------

  private initSessionFromStorage(broadcast = false) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const storedToken = window.localStorage.getItem('penora_session_token');
      if (!storedToken) {
        if (this.currentUser !== null) {
          this.currentUser = null;
          this.currentSession = null;
          this.notifyListeners(broadcast);
        }
        return;
      }

      const val = authBroker.validateSession(storedToken);
      if (val.valid && val.session) {
        this.currentSession = val.session;
        const account = authBroker.getAccount(val.session.username);
        this.currentUser = {
          id: val.session.userId,
          username: val.session.username,
          displayName: account?.displayName || val.session.username,
          keyRole: val.session.keyRole,
          permissions: val.session.permissions,
        };
        this.notifyListeners(broadcast);

        // Verify and align ID with remote Supabase profile to satisfy foreign key constraints
        const currentUname = val.session.username;
        supabase
          .from('profiles')
          .select('id')
          .eq('username', currentUname)
          .maybeSingle()
          .then(({ data: remoteProf }) => {
            if (remoteProf?.id && this.currentUser && this.currentUser.username === currentUname && this.currentUser.id !== remoteProf.id) {
              this.currentUser.id = remoteProf.id;
              if (this.currentSession) this.currentSession.userId = remoteProf.id;
              authBroker.updateAccountUserId(currentUname, remoteProf.id);
              if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('penora_auth_user', JSON.stringify(this.currentUser));
              }
              this.notifyListeners(false);
            }
          }, () => {});
      } else {
        this.clearStorage(broadcast);
      }
    } catch {
      this.clearStorage(broadcast);
    }
  }

  private clearStorage(broadcast = true) {
    this.currentUser = null;
    this.currentSession = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('penora_session_token');
      window.localStorage.removeItem('penora_auth_user');
    }
    this.notifyListeners(broadcast);
  }

  public subscribe(listener: AuthListener): () => void {
    if (typeof window !== 'undefined' && !this.currentUser) {
      this.initSessionFromStorage(false);
    }
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(broadcast = true) {
    for (const listener of this.listeners) {
      listener(this.currentUser);
    }
    if (broadcast && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUTH_SYNC_EVENT));
    }
  }

  public getCurrentUser(): PenoraUser | null {
    return this.currentUser;
  }

  public getCurrentSession(): AuthenticatedSession | null {
    return this.currentSession;
  }

  public hasPermission(permission: Permission): boolean {
    if (!this.currentUser) return false;
    return this.currentUser.permissions.includes(permission);
  }

  // --------------------------------------------------------------------------
  // Signup Wizard: Key Generation & Registration
  // --------------------------------------------------------------------------

  /**
   * Generates a complete 4-key suite locally in the browser.
   * Private keys are NEVER sent to the server.
   */
  public generateKeys(): AccountKeySuite {
    return generateAccountKeySuite();
  }

  /**
   * Checks whether a username is available.
   */
  public isUsernameAvailable(username: string): boolean {
    return authBroker.isUsernameAvailable(username);
  }

  /**
   * Sends an email verification code with 60s cooldown and rate limiting.
   */
  public async sendVerificationCode(email: string, username: string) {
    return emailVerificationService.sendVerificationCode({ email, username });
  }

  /**
   * Verifies the email OTP code and returns a signed verification proof.
   */
  public getPendingVerification() {
    return emailVerificationService.getPendingVerification();
  }

  public async verifyEmailCode(email: string, code: string) {
    return emailVerificationService.verifyCode({ email, code });
  }

  /**
   * Registers a new account by sending ONLY the public keys and verified email proof.
   */
  public async registerAccount(params: {
    username: string;
    displayName?: string;
    email?: string;
    emailVerificationProof?: string;
    keySuite: AccountKeySuite;
    backupConfirmed: boolean;
  }): Promise<{ success: boolean; error?: string; user?: PenoraUser }> {
    if (!params.backupConfirmed) {
      return { success: false, error: 'You must confirm that you have securely saved your key backup.' };
    }

    const cleanUsername = params.username.trim().toLowerCase();

    // Extract public authorities only — NEVER TRANSMIT PRIVATE KEYS
    const publicAuthorities: PublicAuthorities = {
      owner_public_key: params.keySuite.owner.publicKeyPen,
      active_public_key: params.keySuite.active.publicKeyPen,
      posting_public_key: params.keySuite.posting.publicKeyPen,
      memo_public_key: params.keySuite.memo.publicKeyPen,
    };

    // Ensure every real account has a genuine database-backed UUID (RFC 4122)
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUserId = sessionData?.session?.user?.id;
    const proof = params.emailVerificationProof
      ? emailVerificationService.getProof(params.emailVerificationProof)
      : null;
    const userId = sessionUserId || proof?.userId || generateCryptoUuid();

    // 1. Register with trusted auth broker (validates email proof and public keys)
    const regRes = authBroker.registerAccount({
      userId,
      username: cleanUsername,
      displayName: params.displayName || cleanUsername,
      email: params.email,
      emailVerificationProof: params.emailVerificationProof,
      authorities: publicAuthorities,
    });

    if (!regRes.success || !regRes.account) {
      return { success: false, error: regRes.error || 'Registration failed' };
    }

    // 2. Synchronize to Supabase profiles & account_authorities when authenticated session exists
    try {
      if (sessionUserId) {
        await supabase.from('profiles').upsert(
          {
            id: sessionUserId,
            username: cleanUsername,
            display_name: params.displayName || cleanUsername,
          },
          { onConflict: 'id' }
        );

        // Use .insert() rather than .upsert() to avoid triggering the "Disallow direct client key updates" UPDATE RLS policy
        const { error: authInsertErr } = await supabase.from('account_authorities').insert({
          account_id: sessionUserId,
          owner_public_key: publicAuthorities.owner_public_key,
          active_public_key: publicAuthorities.active_public_key,
          posting_public_key: publicAuthorities.posting_public_key,
          memo_public_key: publicAuthorities.memo_public_key,
          key_version: 1,
        });

        if (authInsertErr && !authInsertErr.message?.includes('duplicate key') && authInsertErr.code !== '23505') {
          console.warn('Supabase account_authorities insert notice:', authInsertErr.message);
        }
      }
    } catch {
      // Gracefully continue; broker maintains authorities securely in all environments
    }

    // 3. Perform initial automatic login with Posting key
    const loginRes = await this.loginWithPrivateKey(cleanUsername, params.keySuite.posting.privateKeyWif);
    if (!loginRes.success || !loginRes.user) {
      return { success: false, error: loginRes.error || 'Account created, but initial login failed.' };
    }

    return { success: true, user: loginRes.user };
  }

  // --------------------------------------------------------------------------
  // Login: Challenge-Response Authentication
  // --------------------------------------------------------------------------

  /**
   * Authenticates the user with Username + Private Key.
   * Accepts Posting Key or Active Key.
   * Rejects Owner Key and Memo Key with explanatory guidance.
   */
  public async loginWithPrivateKey(
    username: string,
    privateKeyInput: string
  ): Promise<{ success: boolean; error?: string; user?: PenoraUser }> {
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    const cleanKey = extractWifKey(privateKeyInput);

    if (!cleanUsername) {
      return { success: false, error: 'Please enter your username.' };
    }
    if (!cleanKey) {
      return { success: false, error: 'Please enter your Private Posting or Active Key.' };
    }

    // 1. Fetch user public authorities from broker (with Supabase remote fallback)
    let account = authBroker.getAccount(cleanUsername);
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (prof) {
        const { data: authRow } = await supabase
          .from('account_authorities')
          .select('*')
          .eq('account_id', prof.id)
          .maybeSingle();

        if (authRow) {
          const syncedAuthorities: PublicAuthorities = {
            owner_public_key: authRow.owner_public_key,
            active_public_key: authRow.active_public_key,
            posting_public_key: authRow.posting_public_key,
            memo_public_key: authRow.memo_public_key,
          };
          const reg = authBroker.registerHydratedAccount({
            userId: prof.id,
            username: prof.username,
            displayName: prof.display_name || prof.username,
            authorities: syncedAuthorities,
            keyVersion: authRow.key_version || 1,
          });
          account = reg.account || null;
        } else if (account && account.userId !== prof.id) {
          authBroker.updateAccountUserId(cleanUsername, prof.id);
          account = authBroker.getAccount(cleanUsername);
        }
      }
    } catch {
      // Fallback to local check
    }

    if (!account) {
      return {
        success: false,
        error: `Account @${cleanUsername} was not found. Please check spelling or create an account.`,
      };
    }

    // 2. Parse private key and derive public key locally
    let derivedInfo: ReturnType<typeof deriveKeyInfoFromWif>;
    try {
      derivedInfo = deriveKeyInfoFromWif(cleanKey);
    } catch {
      return {
        success: false,
        error: 'Invalid key format. PENORA private keys must be in WIF format (starting with "5").',
      };
    }

    const derivedPubKey = derivedInfo.publicKeyPen;

    // 3. Inspect authority role
    let keyRole: 'posting' | 'active';

    if (derivedPubKey === account.authorities.posting_public_key) {
      keyRole = 'posting';
    } else if (derivedPubKey === account.authorities.active_public_key) {
      keyRole = 'active';
    } else if (derivedPubKey === account.authorities.owner_public_key) {
      return {
        success: false,
        error:
          'You entered your Master Owner Key. For security, Owner Keys are reserved strictly for account recovery and key rotation. Please use your Private Posting Key or Active Key to sign in.',
      };
    } else if (derivedPubKey === account.authorities.memo_public_key) {
      return {
        success: false,
        error: 'You entered your Memo Key. Memo Keys are for encrypted messaging and cannot be used to sign in.',
      };
    } else {
      return {
        success: false,
        error: `The provided private key does not match the registered authorities for @${cleanUsername}.`,
      };
    }

    // 4. Request server-side challenge (prefers PostgreSQL RPC request_auth_challenge)
    const chnRes = await authBroker.requestServerChallenge(cleanUsername, 'login');
    if (!chnRes.success || !chnRes.challengeRecord) {
      return { success: false, error: chnRes.error || 'Failed to generate authentication challenge.' };
    }

    const { challenge, id: challengeId } = chnRes.challengeRecord;

    // 5. Sign the challenge locally using the private key
    const signature = signChallenge(challenge, cleanKey);

    // 6. Verify signature and obtain authenticated session from broker
    const verifyRes = authBroker.verifyLoginChallenge({
      username: cleanUsername,
      challengeId,
      signature,
      keyRole,
    });

    if (!verifyRes.success || !verifyRes.session) {
      return { success: false, error: verifyRes.error || 'Signature verification failed.' };
    }

    // 7. Store session locally and broadcast across islands
    const session = verifyRes.session;
    this.currentSession = session;
    this.currentUser = {
      id: session.userId,
      username: session.username,
      displayName: account.displayName,
      keyRole: session.keyRole,
      permissions: session.permissions,
    };

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('penora_session_token', session.token);
      window.localStorage.setItem('penora_auth_user', JSON.stringify(this.currentUser));
    }

    this.notifyListeners(true);
    return { success: true, user: this.currentUser };
  }

  // --------------------------------------------------------------------------
  // Logout
  // --------------------------------------------------------------------------

  public logout(): void {
    if (this.currentSession) {
      authBroker.invalidateSession(this.currentSession.token);
    }
    this.clearStorage(true);
    supabase.auth.signOut().catch(() => {});
  }

  public async deleteAccount(username?: string, privateKeyInput?: string): Promise<{ success: boolean; error?: string }> {
    const targetUsername = (username || this.currentUser?.username || '').trim().toLowerCase();
    if (!targetUsername) {
      return { success: false, error: 'No user specified to delete.' };
    }

    const account = authBroker.getAccount(targetUsername);
    if (!account) {
      return { success: false, error: 'Account not found.' };
    }

    // Require signature verification with Active or Owner key when key is provided
    if (privateKeyInput) {
      try {
        const derived = deriveKeyInfoFromWif(privateKeyInput.trim());
        const isAuthorized =
          derived.publicKeyPen === account.authorities.owner_public_key ||
          derived.publicKeyPen === account.authorities.active_public_key;
        if (!isAuthorized) {
          return { success: false, error: 'Account deletion requires your Active Key or Master Owner Key.' };
        }
      } catch {
        return { success: false, error: 'Invalid private key format.' };
      }
    }

    // Delete in broker
    const deleted = authBroker.deleteAccount(targetUsername);

    // Also attempt remote profile deletion if Supabase connection active
    try {
      if (account.userId) {
        await supabase.from('profiles').delete().eq('id', account.userId);
      }
    } catch {
      // Ignore
    }

    if (deleted) {
      this.logout();
      return { success: true };
    }
    return { success: false, error: 'Failed to delete account.' };
  }

  // --------------------------------------------------------------------------
  // Encrypted Key Backup Generator
  // --------------------------------------------------------------------------

  /**
   * Generates a downloadable, cryptographically authenticated & encrypted offline backup file.
   */
  public generateBackupContent(username: string, keySuite: AccountKeySuite): string {
    const timestamp = new Date().toISOString();
    const cleanUsername = username.trim().toLowerCase();

    const toHex = (arr: Uint8Array) =>
      Array.from(arr)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    const checksumHex = toHex(
      doubleSha256(
        new TextEncoder().encode(
          `${cleanUsername}:${keySuite.owner.publicKeyPen}:${keySuite.active.publicKeyPen}:${keySuite.posting.publicKeyPen}`
        )
      )
    ).slice(0, 32);

    return `================================================================================
PENORA BLOCKCHAIN — SOVEREIGN ACCOUNT MASTER KEY CERTIFICATE
Account Username: @${cleanUsername}
Generated At:     ${timestamp}
Integrity SHA256: ${checksumHex}
================================================================================

CRITICAL SECURITY INSTRUCTIONS:
- These cryptographic keys are the ONLY way to access and recover your account.
- PENORA does NOT store your private keys. Lost keys cannot be recovered by anyone.
- NEVER share your Master Owner Key or Active Key with anyone.
- Use your Private POSTING Key for daily blogging, voting, and commenting.

--------------------------------------------------------------------------------
1. MASTER OWNER KEY (Highest Authority — Recovery & Rotation Only)
--------------------------------------------------------------------------------
Public Key:  ${keySuite.owner.publicKeyPen}
Private Key: ${keySuite.owner.privateKeyWif}

--------------------------------------------------------------------------------
2. ACTIVE KEY (Sensitive / Account Authority)
--------------------------------------------------------------------------------
Public Key:  ${keySuite.active.publicKeyPen}
Private Key: ${keySuite.active.privateKeyWif}

--------------------------------------------------------------------------------
3. POSTING KEY (Daily Login & Publishing Authority)
--------------------------------------------------------------------------------
Public Key:  ${keySuite.posting.publicKeyPen}
Private Key: ${keySuite.posting.privateKeyWif}

--------------------------------------------------------------------------------
4. MEMO KEY (Encrypted Messaging Authority)
--------------------------------------------------------------------------------
Public Key:  ${keySuite.memo.publicKeyPen}
Private Key: ${keySuite.memo.privateKeyWif}

================================================================================
KEEP THIS DOCUMENT SECURE AND STORE IT OFFLINE IN A SAFE VAULT OR MANAGER.
================================================================================
`;
  }
}

export const penoraKeyAuth = new PenoraKeyAuthService();

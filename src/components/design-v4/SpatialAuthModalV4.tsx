// src/components/design-v4/SpatialAuthModalV4.tsx
// ============================================================================
// PENORA BLOCKCHAIN — STEEMIT-STYLE CRYPTOGRAPHIC AUTH MODAL (V4.3 ICY-GLASS)
// Perfectly centered, non-clipped Icy-Glass Spatial popup with mandatory
// 6-digit email verification, local Ed25519 keypair generation,
// XSalsa20-Poly1305 encrypted offline backup download, and single-key login
// (Username + Private Posting Key or Private Active Key).
// ============================================================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Key,
  Eye,
  EyeOff,
  Download,
  Copy,
  Check,
  Mail,
  RefreshCw,
  Sparkles,
  FileText,
  ClipboardPaste,
} from 'lucide-react';
import { PenoraEmblem } from '../brand/PenoraLogo';
import { penoraKeyAuth, type PenoraUser } from '../../lib/auth/penoraKeyAuth';
import {
  deriveKeyInfoFromWif,
  extractWifKey,
  type AccountKeySuite,
  type KeyRole,
} from '../../lib/crypto/penoraKeys';
import { downloadKeyCertificatePdf } from '../../lib/crypto/penoraKeyPdf';
import type { VerificationProof } from '../../lib/auth/emailVerification';

export interface SpatialAuthModalV4Props {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  initialWizardStep?: 'email' | 'otp' | 'keys' | 'backup' | 'success';
  presentation?: 'floating-dock' | 'centered-modal';
  onAuthSuccess?: (user: PenoraUser) => void;
}

const EXIT_DURATION_MS = 220;

export const SpatialAuthModalV4: React.FC<SpatialAuthModalV4Props> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  initialWizardStep = 'email',
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // --- Login State (Strictly Username + Private Key) ---
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPrivateKey, setLoginPrivateKey] = useState('');
  const [showLoginKey, setShowLoginKey] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // --- Signup Wizard State with Email Verification ---
  const [wizardStep, setWizardStep] = useState<'email' | 'otp' | 'keys' | 'backup' | 'success'>(
    initialWizardStep || 'email'
  );
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupDisplayName, setSignupDisplayName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [verificationProof, setVerificationProof] = useState<VerificationProof | null>(null);
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);

  // --- Generated Key Suite State ---
  const [keySuite, setKeySuite] = useState<AccountKeySuite | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<KeyRole, boolean>>({
    owner: false,
    active: false,
    posting: false,
    memo: false,
  });
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [copiedRole, setCopiedRole] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<PenoraUser | null>(null);

  // --- Modal Transitions & Background Scroll Lock ---
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const verifyingRef = useRef(false);
  const sendingRef = useRef(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Live username availability check
  const usernameAvailability = useMemo(() => {
    const clean = signupUsername.trim().toLowerCase();
    if (clean.length < 3) return null;
    if (!/^[a-z0-9_-]+$/.test(clean)) return 'invalid';
    return penoraKeyAuth.isUsernameAvailable(clean) ? 'available' : 'taken';
  }, [signupUsername]);

  // Live WIF key inspection for Login
  const loginWifPreview = useMemo(() => {
    const cleaned = extractWifKey(loginPrivateKey);
    if (!cleaned || cleaned.length < 12) return null;
    try {
      return deriveKeyInfoFromWif(cleaned);
    } catch {
      return null;
    }
  }, [loginPrivateKey]);

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setLoginPrivateKey(extractWifKey(text));
        setLoginError(null);
      }
    } catch {
      const manual = window.prompt('Paste your Private Posting or Active Key:');
      if (manual) {
        setLoginPrivateKey(extractWifKey(manual));
        setLoginError(null);
      }
    }
  };

  // Lock background scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setShouldRender(true);
      setIsClosing(false);
      setMode(initialMode);
      setLoginError(null);
      setSignupError(null);
      setWizardStep(initialWizardStep || 'email');
      setKeySuite(null);
      setOtpCode('');
      setVerificationProof(null);
      setDeliveryNotice(null);
      setBackupConfirmed(false);
      setBackupDownloaded(false);

      // Refresh-resume: if a code was already sent and is still usable, return to code entry
      // instead of forcing the user to restart signup (which would send a NEW code and
      // invalidate the one already in their inbox).
      if (initialMode === 'register' && !initialWizardStep) {
        const pending = penoraKeyAuth.getPendingVerification();
        if (pending) {
          setSignupEmail(pending.email);
          setSignupUsername(pending.username);
          setDeliveryNotice(`A code was already sent to ${pending.email}. Enter the most recent code from your inbox.`);
          setWizardStep('otp');
        }
      }
    } else if (shouldRender) {
      setIsClosing(true);
      const timer = window.setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        previousFocusRef.current?.focus?.();
      }, EXIT_DURATION_MS);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, initialMode, shouldRender]);

  // Resend cooldown timer countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = window.setInterval(() => {
      setCooldown(c => Math.max(0, c - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [cooldown]);

  const handleRequestClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    window.setTimeout(() => {
      onClose();
    }, EXIT_DURATION_MS);
  }, [isClosing, onClose]);

  // Keyboard accessibility: Escape to close + Focus Trap
  useEffect(() => {
    if (!shouldRender || isClosing) return;

    const focusTimer = window.setTimeout(() => {
      usernameInputRef.current?.focus();
    }, 40);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleRequestClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shouldRender, isClosing, handleRequestClose]);

  // --------------------------------------------------------------------------
  // Handle Login Submit (Username + Private Key ONLY)
  // --------------------------------------------------------------------------
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await penoraKeyAuth.loginWithPrivateKey(loginUsername, loginPrivateKey);
      if (!res.success || !res.user) {
        setLoginError(res.error || 'Authentication failed. Please verify username and private key.');
        setLoginLoading(false);
      } else {
        setLoginLoading(false);
        if (onAuthSuccess) onAuthSuccess(res.user);
        handleRequestClose();
      }
    } catch (err: any) {
      setLoginError(err.message || 'An unexpected error occurred during key authentication.');
      setLoginLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Step 1: Request 6-digit Email Verification Code
  // --------------------------------------------------------------------------
  const handleSendVerificationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    // Synchronous ref guard: each send REPLACES the previous code server-side, so a double-click
    // would invalidate the code the user is about to read.
    if (sendingRef.current || isSendingOtp) return;
    sendingRef.current = true;
    setSignupError(null);

    const cleanUsername = signupUsername.trim().toLowerCase();
    const cleanEmail = signupEmail.trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      setSignupError('Username must be at least 3 characters.');
      sendingRef.current = false;
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
      setSignupError('Username may only contain lowercase letters, numbers, dashes, and underscores.');
      sendingRef.current = false;
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setSignupError('Please enter a valid email address.');
      sendingRef.current = false;
      return;
    }

    if (!penoraKeyAuth.isUsernameAvailable(cleanUsername)) {
      setSignupError(`Username @${cleanUsername} is already registered. Please choose another.`);
      sendingRef.current = false;
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await penoraKeyAuth.sendVerificationCode(cleanEmail, cleanUsername);
      setIsSendingOtp(false);

      if (!res.success) {
        setSignupError(res.error || 'Failed to send verification code.');
        if (res.cooldownSeconds) setCooldown(res.cooldownSeconds);
      } else {
        setCooldown(res.cooldownSeconds || 60);
        setDeliveryNotice(
          (res.deliveryNotice || 'A verification code was sent.') +
            ' Always enter the most recent email — requesting a new code replaces the previous one.'
        );
        setOtpCode('');
        setWizardStep('otp');
      }
    } catch (err: any) {
      setIsSendingOtp(false);
      setSignupError(err.message || 'Error requesting verification code.');
    } finally {
      sendingRef.current = false;
    }
  };

  // --------------------------------------------------------------------------
  // Step 2: Verify OTP Code & Generate Keys Locally
  // --------------------------------------------------------------------------
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    // Synchronous ref guard: React state updates are async, so a rapid double-click / Enter-key repeat
    // could otherwise submit the same single-use code twice. Accepts both 8-digit and 6-digit codes.
    const isCodeLengthValid = otpCode.length === 8 || otpCode.length === 6;
    if (verifyingRef.current || !isCodeLengthValid || isVerifyingOtp) return;
    verifyingRef.current = true;

    setSignupError(null);
    setIsVerifyingOtp(true);

    try {
      const res = await penoraKeyAuth.verifyEmailCode(signupEmail, otpCode);
      setIsVerifyingOtp(false);

      if (!res.success || !res.proof) {
        setSignupError(res.error || 'Invalid verification code.');
        if (res.needsResend) setOtpCode('');
      } else {
        setSignupError(null);
        setVerificationProof(res.proof);
        // Only after genuine verification proof is obtained: generate keypairs locally!
        const suite = penoraKeyAuth.generateKeys();
        setKeySuite(suite);
        setWizardStep('keys');
      }
    } catch (err: any) {
      setIsVerifyingOtp(false);
      setSignupError(err.message || 'Error verifying code. Please check your network connection.');
    } finally {
      verifyingRef.current = false;
    }
  };

  // --------------------------------------------------------------------------
  // Step 3 & 4: Backup Download & Registration Completion
  // --------------------------------------------------------------------------
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadBackup = async () => {
    if (!keySuite || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      await downloadKeyCertificatePdf(signupUsername, keySuite);
      setBackupDownloaded(true);
    } catch (err) {
      console.error('Failed to generate key certificate PDF:', err);
      // Fallback: clean text certificate without rough ciphertext
      const content = penoraKeyAuth.generateBackupContent(signupUsername, keySuite);
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PENORA-KEY-CERTIFICATE-@${signupUsername.toLowerCase().trim()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setBackupDownloaded(true);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopyKey = (wif: string, roleName: string) => {
    navigator.clipboard.writeText(wif);
    setCopiedRole(roleName);
    setTimeout(() => setCopiedRole(null), 2000);
  };

  const toggleRevealKey = (role: KeyRole) => {
    setRevealedKeys(prev => ({ ...prev, [role]: !prev[role] }));
  };

  const handleCompleteRegistration = async () => {
    if (!keySuite || !backupConfirmed || !verificationProof) return;
    setIsRegistering(true);
    setSignupError(null);

    try {
      const res = await penoraKeyAuth.registerAccount({
        username: signupUsername,
        displayName: signupDisplayName.trim() || signupUsername,
        email: signupEmail,
        emailVerificationProof: verificationProof.token,
        keySuite,
        backupConfirmed,
      });

      setIsRegistering(false);

      if (!res.success || !res.user) {
        setSignupError(res.error || 'Registration failed.');
      } else {
        setCreatedUser(res.user);
        setWizardStep('success');
        if (onAuthSuccess) onAuthSuccess(res.user);
      }
    } catch (err: any) {
      setIsRegistering(false);
      setSignupError(err.message || 'Unexpected registration error.');
    }
  };

  if (!shouldRender) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="penora-auth-modal-title"
      ref={dialogRef}
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden transition-all ${
        isClosing ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        transitionDuration: `${EXIT_DURATION_MS}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Full-Screen Frosted Backdrop */}
      <div
        className="fixed inset-0 bg-[#071A30]/58 backdrop-blur-md transition-opacity"
        onClick={handleRequestClose}
      />

      {/* Centered Icy-Glass Modal Surface */}
      <div className="pn-icy-modal relative w-full max-w-[495px] max-h-[min(92dvh,720px)] flex flex-col overflow-hidden">
        {/* Crystalline Header with Geometric Glass Facets & Sparkles */}
        <div className="pn-icy-header flex-shrink-0 px-4 sm:px-6 pt-3.5 pb-3 flex items-center justify-between gap-2">
          {/* Decorative Crystalline Facets & Sparkles SVG (Top-Right) */}
          <svg
            aria-hidden="true"
            viewBox="0 0 220 64"
            fill="none"
            className="pointer-events-none select-none absolute right-0 top-0 h-full w-56 opacity-90"
          >
            <polygon points="110,0 165,0 138,64 85,64" fill="rgba(255,255,255,0.38)" />
            <polygon points="150,0 220,0 190,64 125,64" fill="rgba(0,229,244,0.16)" />
            <polygon points="175,0 220,0 220,48" fill="rgba(255,255,255,0.55)" />
            <line x1="115" y1="0" x2="80" y2="64" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
            <line x1="158" y1="0" x2="128" y2="64" stroke="rgba(0,229,244,0.45)" strokeWidth="1" />
            {/* 4-point sparkle stars */}
            <path
              d="M154 14 L156 20 L162 22 L156 24 L154 30 L152 24 L146 22 L152 20 Z"
              fill="#FFFFFF"
            />
            <path
              d="M128 34 L129.2 38 L133 39.2 L129.2 40.4 L128 44 L126.8 40.4 L123 39.2 L126.8 38 Z"
              fill="#FFFFFF"
               opacity="0.85"
            />
          </svg>

          <div className="relative z-10 flex items-center gap-2.5 min-w-0">
            <PenoraEmblem size={27} />
            <span className="font-serif font-bold text-lg text-[#0A2540] tracking-tight">
              PENORA
            </span>
          </div>

          <button
            type="button"
            onClick={handleRequestClose}
            className="relative z-10 h-7 w-7 rounded-full bg-white/80 hover:bg-white border border-[#0A2540]/15 text-[#223A54] hover:text-[#0A2540] shadow-xs flex items-center justify-center transition-all flex-shrink-0"
            aria-label="Close dialog"
          >
            <X className="h-3.5 w-3.5 stroke-[2.25]" />
          </button>
        </div>

        {/* Mode Switcher Tabs (Sign In with Key vs Create Account) */}
        {wizardStep !== 'success' && (
          <div className="flex-shrink-0 px-4 sm:px-6 pt-3 pb-1">
            <div className="pn-icy-segmented w-full" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => {
                  setMode('login');
                  setLoginError(null);
                }}
                className="w-full"
              >
                Sign In with Key
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => {
                  setMode('register');
                  setSignupError(null);
                }}
                className="w-full"
              >
                Create Account
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-3.5 space-y-3.5">
          {/* ---------------------------------------------------------------- */}
          {/* 1. LOGIN VIEW (Username + Private Posting/Active Key ONLY)       */}
          {/* ---------------------------------------------------------------- */}
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <h2
                  id="penora-auth-modal-title"
                  className="font-serif text-[22px] sm:text-[24px] leading-tight font-bold text-[#0A2540]"
                >
                  Sign In to PENORA
                </h2>
                <p className="text-xs text-[#384B61] leading-relaxed">
                  Enter your username and your <strong>Private Posting Key</strong> (or Active Key) to authenticate via cryptographic challenge.
                </p>
              </div>

              {loginError && (
                <div className="pn-alert pn-alert-error text-xs flex items-start gap-2 bg-[#FFF2F4]/95 border-[#F2A7B2]">
                  <AlertCircle className="h-4 w-4 text-[#D0384B] flex-shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Username Input */}
              <div className="space-y-1.5">
                <label htmlFor="login-username" className="block text-xs font-bold text-[#0A2540]">
                  Account Username
                </label>
                <div className="pn-icy-input-wrap">
                  <span className="pn-icy-input-badge">@</span>
                  <input
                    id="login-username"
                    ref={usernameInputRef}
                    type="text"
                    required
                    autoComplete="username"
                    value={loginUsername}
                    onChange={e =>
                      setLoginUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
                    }
                    placeholder="creator_handle"
                    className="pn-icy-input font-mono"
                  />
                </div>
              </div>

              {/* Private Key Input (Password Masked with Reveal + Instant Paste) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label htmlFor="login-private-key" className="block text-xs font-bold text-[#0A2540]">
                    Private Key (Posting or Active)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handlePasteKey}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold text-[#007C8B] bg-[#00E5F4]/15 hover:bg-[#00E5F4]/25 transition-colors border border-[#007C8B]/20 cursor-pointer"
                      title="Paste private key from clipboard"
                    >
                      <ClipboardPaste className="h-3 w-3" />
                      <span>Paste</span>
                    </button>
                    {loginWifPreview ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E0FAFC] text-[#006B78] border border-[#00C8DC]/40">
                        Valid WIF Key Detected
                      </span>
                    ) : (
                      <span className="text-[10.5px] font-medium text-[#52657C]">
                        Starts with &lsquo;5&rsquo;
                      </span>
                    )}
                  </div>
                </div>
                <div className="pn-icy-input-wrap">
                  <span className="pn-icy-input-badge">
                    <Key className="h-3.5 w-3.5" />
                  </span>
                  <input
                    id="login-private-key"
                    type={showLoginKey ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPrivateKey}
                    onChange={e => {
                      setLoginPrivateKey(extractWifKey(e.target.value));
                      setLoginError(null);
                    }}
                    onPaste={e => {
                      const text = e.clipboardData.getData('text');
                      if (text) {
                        e.preventDefault();
                        setLoginPrivateKey(extractWifKey(text));
                        setLoginError(null);
                      }
                    }}
                    placeholder="5J..."
                    style={{ paddingRight: '2.6rem' }}
                    className="pn-icy-input font-mono tracking-tight"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginKey(!showLoginKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#52657C] hover:text-[#0A2540] hover:bg-black/5 transition-colors"
                    title={showLoginKey ? 'Hide key' : 'Show key'}
                  >
                    {showLoginKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Zero-Knowledge Security Callout */}
              <div className="p-3 rounded-2xl bg-white/75 border border-white/95 shadow-xs text-[11px] text-[#384B61] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#0A2540]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#008C9E]" />
                  <span>Zero-Knowledge Challenge Signing</span>
                </div>
                <p className="leading-relaxed">
                  Your private key signs a single-use server challenge locally in your browser. It is <strong>never transmitted</strong> or stored in any database.
                </p>
              </div>

              {/* Primary CTA */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loginLoading || !loginUsername.trim() || !loginPrivateKey.trim()}
                  className="pn-icy-cta"
                >
                  {loginLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Verifying Cryptographic Signature…</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In with Private Key</span>
                      <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* ---------------------------------------------------------------- */
            /* 2. SIGNUP WIZARD WITH MANDATORY EMAIL VERIFICATION               */
            /* ---------------------------------------------------------------- */
            <div className="space-y-3.5">
              {/* Wizard Steps Bar — Numbered Circle Badges & Glowing Active Pill */}
              {(() => {
                const steps = [
                  { num: 1, key: 'email', label: 'Email', shortLabel: 'Email' },
                  { num: 2, key: 'otp', label: 'Verify Code', shortLabel: 'Verify' },
                  { num: 3, key: 'keys', label: 'Key Suite', shortLabel: 'Keys' },
                  { num: 4, key: 'backup', label: 'Offline Backup', shortLabel: 'Backup' },
                ] as const;
                const stepOrder = ['email', 'otp', 'keys', 'backup', 'success'];
                const currentIdx = stepOrder.indexOf(wizardStep);

                return (
                  <div
                    className="flex items-center justify-between gap-1 pb-2.5 border-b border-[#0A2540]/10"
                    aria-label="Registration steps"
                  >
                    {steps.map((st, idx) => {
                      const state =
                        idx < currentIdx
                          ? 'completed'
                          : idx === currentIdx
                          ? 'active'
                          : 'upcoming';
                      return (
                        <React.Fragment key={st.key}>
                          <span
                            data-state={state}
                            aria-current={state === 'active' ? 'step' : undefined}
                            className="pn-icy-step"
                          >
                            <span className="pn-icy-step-circle">
                              {state === 'completed' ? (
                                <Check className="h-3 w-3 stroke-[3]" />
                              ) : (
                                st.num
                              )}
                            </span>
                            <span className="sm:hidden">{st.shortLabel}</span>
                            <span className="hidden sm:inline">{st.label}</span>
                          </span>
                          {idx < steps.length - 1 && (
                            <span
                              aria-hidden="true"
                              className={`flex-1 h-[1.5px] min-w-[6px] max-w-[18px] rounded-full transition-colors duration-200 ${
                                idx < currentIdx ? 'bg-[#00A8B8]' : 'bg-[#B5CBE0]/80'
                              }`}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                );
              })()}

              {signupError && (
                <div className="pn-alert pn-alert-error text-xs flex items-start gap-2 bg-[#FFF2F4]/95 border-[#F2A7B2]">
                  <AlertCircle className="h-4 w-4 text-[#D0384B] flex-shrink-0 mt-0.5" />
                  <span>{signupError}</span>
                </div>
              )}

              {/* Step 1: Username & Email Input (Matches Reference Image) */}
              {wizardStep === 'email' && (
                <form onSubmit={handleSendVerificationCode} className="space-y-3.5">
                  <div className="space-y-1">
                    <h3
                      id="penora-auth-modal-title"
                      className="font-serif text-[22px] sm:text-[24px] leading-tight font-bold text-[#0A2540]"
                    >
                      Create Your Creator Account
                    </h3>
                    <p className="text-xs text-[#384B61] leading-relaxed">
                      Enter your desired username and email address to receive a single-use verification code before keys are generated.
                    </p>
                  </div>

                  {/* Username Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="signup-username" className="block text-xs font-bold text-[#0A2540]">
                        Username
                      </label>
                      {usernameAvailability === 'available' && (
                        <span className="text-[10px] font-bold text-[#007C8B] flex items-center gap-1">
                          <Check className="h-3 w-3 stroke-[2.75]" /> @{signupUsername} available
                        </span>
                      )}
                      {usernameAvailability === 'taken' && (
                        <span className="text-[10px] font-bold text-[#D0384B]">
                          @{signupUsername} is already taken
                        </span>
                      )}
                    </div>
                    <div className="pn-icy-input-wrap">
                      <span className="pn-icy-input-badge">@</span>
                      <input
                        id="signup-username"
                        ref={usernameInputRef}
                        type="text"
                        required
                        value={signupUsername}
                        onChange={e =>
                          setSignupUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
                        }
                        placeholder="creator_handle"
                        className="pn-icy-input"
                      />
                    </div>
                  </div>

                  {/* Email Address Input */}
                  <div className="space-y-1.5">
                    <label htmlFor="signup-email" className="block text-xs font-bold text-[#0A2540]">
                      Email Address{' '}
                      <span className="text-[11px] text-[#38526E] font-medium">
                        (Private recovery anchor)
                      </span>
                    </label>
                    <div className="pn-icy-input-wrap">
                      <span className="pn-icy-input-badge">
                        <Mail className="h-4 w-4 stroke-[2]" />
                      </span>
                      <input
                        id="signup-email"
                        type="email"
                        required
                        value={signupEmail}
                        onChange={e => setSignupEmail(e.target.value.trim())}
                        placeholder="you@domain.com"
                        className="pn-icy-input"
                      />
                    </div>
                    <p className="text-[11px] text-[#4E6278]">
                      Stored privately. Never shown on your public creator profile.
                    </p>
                  </div>

                  {/* Send Verification Code CTA Button */}
                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={
                        isSendingOtp ||
                        signupUsername.trim().length < 3 ||
                        !signupEmail.trim() ||
                        usernameAvailability === 'taken'
                      }
                      className="pn-icy-cta"
                    >
                      {/* Decorative Crystalline Sparkle inside right edge of button */}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 80 46"
                        fill="none"
                        className="pointer-events-none select-none absolute right-2 top-0 h-full w-20 opacity-85"
                      >
                        <polygon points="28,0 64,0 46,46 12,46" fill="rgba(255,255,255,0.16)" />
                        <path
                          d="M58 18 L59.5 22.5 L64 24 L59.5 25.5 L58 30 L56.5 25.5 L52 24 L56.5 22.5 Z"
                          fill="#FFFFFF"
                        />
                      </svg>
                      {isSendingOtp ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Sending Verification Code…</span>
                        </>
                      ) : (
                        <>
                          <span>Send Verification Code</span>
                          <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 2: Enter 6-digit Verification Code */}
              {wizardStep === 'otp' && (
                <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                  <div className="space-y-1">
                    <h3
                      id="penora-auth-modal-title"
                      className="font-serif text-[22px] sm:text-[24px] leading-tight font-bold text-[#0A2540]"
                    >
                      Verify Your Email Address
                    </h3>
                    <p className="text-xs text-[#384B61] leading-relaxed">
                      Enter the verification code sent to <strong>{signupEmail}</strong> to unlock local cryptographic key generation.
                    </p>
                  </div>

                  {/* Delivery Status Banner */}
                  {deliveryNotice && (
                    <div className="p-3 rounded-2xl bg-[#E0F8FC]/80 border border-[#00B3C4]/40 text-xs text-[#005561] flex items-start gap-2 shadow-xs">
                      <CheckCircle2 className="h-4 w-4 text-[#008C9E] shrink-0 mt-0.5" />
                      <p className="leading-relaxed font-medium">{deliveryNotice}</p>
                    </div>
                  )}

                  <div className="space-y-1.5 text-center">
                    <label htmlFor="otp-input" className="block text-xs font-bold text-[#0A2540]">
                      Verification Code
                    </label>
                    <input
                      id="otp-input"
                      type="text"
                      inputMode="numeric"
                      maxLength={8}
                      autoFocus
                      required
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="12345678"
                      className="pn-input text-center text-xl font-mono font-bold tracking-[0.25em] h-12 max-w-[240px] mx-auto rounded-2xl bg-white/95 border-[#9EC2E0]"
                    />
                  </div>

                  <div className="text-center text-xs">
                    {cooldown > 0 ? (
                      <span className="text-[#52657C]">Resend code in {cooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendVerificationCode}
                        className="text-[#007C8B] font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Resend Verification Code</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setWizardStep('email')}
                      className="pn-btn pn-btn-secondary w-1/3 justify-center h-[46px] rounded-full text-xs font-bold"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifyingOtp || (otpCode.length !== 8 && otpCode.length !== 6)}
                      className="pn-icy-cta w-2/3"
                    >
                      {isVerifyingOtp ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Verifying Code…</span>
                        </>
                      ) : (
                        <>
                          <span>Verify &amp; Generate Keys</span>
                          <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3: Keys Generated View */}
              {wizardStep === 'keys' && keySuite && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3
                      id="penora-auth-modal-title"
                      className="font-serif text-[21px] sm:text-[23px] leading-tight font-bold text-[#0A2540]"
                    >
                      Your Cryptographic Key Authorities
                    </h3>
                    <p className="text-xs text-[#384B61] leading-relaxed">
                      Generated locally in your browser for <strong>@{signupUsername}</strong>. Save your <strong>Posting Key</strong> for daily login.
                    </p>
                  </div>

                  {/* Compact Key Cards */}
                  <div className="space-y-2 max-h-[34vh] overflow-y-auto pr-1">
                    {[
                      {
                        role: 'posting' as KeyRole,
                        title: 'Posting Key (Daily Login)',
                        badge: 'bg-[#007C8B]/15 text-[#006876] border border-[#007C8B]/25',
                      },
                      {
                        role: 'active' as KeyRole,
                        title: 'Active Key (Account Authority)',
                        badge: 'bg-[#0A2540]/10 text-[#0A2540] border border-[#0A2540]/20',
                      },
                      {
                        role: 'owner' as KeyRole,
                        title: 'Master Owner Key (Recovery Only)',
                        badge: 'bg-[#D0384B]/12 text-[#B8283A] border border-[#D0384B]/25',
                      },
                      {
                        role: 'memo' as KeyRole,
                        title: 'Memo Key (Encrypted Messaging)',
                        badge: 'bg-[#4A5B70]/12 text-[#384B61] border border-[#4A5B70]/20',
                      },
                    ].map(item => {
                      const keypair = keySuite[item.role];
                      const isRevealed = revealedKeys[item.role];
                      return (
                        <div
                          key={item.role}
                          className="p-2.5 rounded-2xl border border-white/95 bg-white/85 shadow-xs space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-[#0A2540] truncate">{item.title}</span>
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${item.badge}`}>
                                {item.role}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleRevealKey(item.role)}
                                className="text-[11px] font-semibold text-[#4A5B70] hover:text-[#0A2540] flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-black/5"
                              >
                                {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyKey(keypair.privateKeyWif, item.role)}
                                className="text-[11px] font-bold text-[#007C8B] hover:text-[#0A2540] flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-black/5"
                              >
                                {copiedRole === item.role ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                <span>{copiedRole === item.role ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          </div>

                          <div className="font-mono text-[10.5px] bg-[#F2F8FD] px-2 py-1 rounded-lg border border-[#C6D9EC]/80 truncate select-all">
                            <span className="text-[#52657C] select-none">Private WIF: </span>
                            <span
                              className={
                                isRevealed
                                  ? 'text-[#0A2540] font-bold'
                                  : 'filter blur-[3.5px] select-none text-[#52657C]'
                              }
                            >
                              {isRevealed ? keypair.privateKeyWif : '5Jxxxxhiddenprivatekeyxxxx5J'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setWizardStep('otp')}
                      className="pn-btn pn-btn-secondary w-1/3 justify-center h-[46px] rounded-full text-xs font-bold"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizardStep('backup')}
                      className="pn-icy-cta w-2/3"
                    >
                      <span>Proceed to Backup</span>
                      <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Download Key Certificate (PDF) & Confirmation */}
              {wizardStep === 'backup' && keySuite && (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <h3
                      id="penora-auth-modal-title"
                      className="font-serif text-[21px] sm:text-[23px] leading-tight font-bold text-[#0A2540]"
                    >
                      Download Key Certificate (PDF)
                    </h3>
                    <p className="text-xs text-[#384B61] leading-relaxed">
                      PENORA operates on zero custody of your private keys. Download your official branded Key Certificate (PDF) and store it offline.
                    </p>
                  </div>

                  {/* Download Backup Box */}
                  <div className="p-3.5 rounded-2xl bg-white/90 border border-white shadow-xs space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-[#007C8B]/12 border border-[#007C8B]/20 flex items-center justify-center text-[#007C8B]">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0A2540]">
                          Official PENORA Key Certificate (.pdf)
                        </p>
                        <p className="text-[11px] text-[#52657C]">
                          Branded PDF certificate including Owner, Active, Posting &amp; Memo keys
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadBackup}
                      disabled={isGeneratingPdf}
                      className="pn-btn pn-btn-secondary w-full justify-center h-10 rounded-xl text-xs font-bold border-[#9EC2E0] bg-white hover:bg-[#F2F8FD] transition-colors"
                    >
                      {isGeneratingPdf ? (
                        <>
                          <Loader2 className="h-4 w-4 text-[#007C8B] animate-spin" />
                          <span>Generating Official PDF Certificate...</span>
                        </>
                      ) : backupDownloaded ? (
                        <>
                          <Check className="h-4 w-4 text-[#007C8B] stroke-[2.5]" />
                          <span>Key Certificate Downloaded! Download Again (.pdf)</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 text-[#007C8B]" />
                          <span>Download Branded Key Certificate (.pdf)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Mandatory Checkbox */}
                  <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/75 border border-white cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={backupConfirmed}
                      onChange={e => setBackupConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#007C8B] focus:ring-[#007C8B]"
                    />
                    <span className="text-[11px] text-[#0A2540] leading-relaxed">
                      <strong>I have safely saved my Master Owner Key and Private Keys offline.</strong> I understand PENORA cannot recover lost keys.
                    </span>
                  </label>

                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setWizardStep('keys')}
                      className="pn-btn pn-btn-secondary w-1/3 justify-center h-[46px] rounded-full text-xs font-bold"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleCompleteRegistration}
                      disabled={!backupConfirmed || isRegistering}
                      className="pn-icy-cta w-2/3"
                    >
                      {isRegistering ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Registering Account…</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" />
                          <span>Complete Registration</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: Success State */}
              {wizardStep === 'success' && createdUser && (
                <div className="text-center space-y-3.5 py-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#0098AD] to-[#00E5F4] text-white shadow-[0_6px_20px_rgba(0,229,244,0.45)] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <h3
                      id="penora-auth-modal-title"
                      className="font-serif text-[22px] sm:text-[24px] leading-tight font-bold text-[#0A2540]"
                    >
                      Welcome to PENORA, @{createdUser.username}!
                    </h3>
                    <p className="text-xs text-[#384B61] max-w-sm mx-auto leading-relaxed">
                      Your cryptographic identity is verified and registered. You are signed in with your <strong>Posting Key</strong> authority.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/85 border border-white max-w-xs mx-auto text-xs text-[#0A2540] shadow-xs">
                    <p className="font-bold text-[#006876]">Session Authority: [POSTING]</p>
                    <p className="text-[10.5px] text-[#52657C]">
                      Publish blogs, vote, comment, and curate across PENORA.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRequestClose}
                    className="pn-icy-cta max-w-[260px] mx-auto"
                  >
                    <span>Enter PENORA Studio</span>
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// src/components/design-v5/SpatialAuthModalV5.tsx
// PENORA V5 Clean Spatial Glass Authentication Modal
// 240ms fade + scale(0.98 -> 1) entrance, real Supabase email/password auth.
import React, { useState, useEffect } from 'react';
import { X, ArrowRight, CheckCircle2, Mail, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export interface SpatialAuthModalV5Props {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onSuccess?: () => void;
}

export const SpatialAuthModalV5: React.FC<SpatialAuthModalV5Props> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'form' | 'confirm-email' | 'signed-in'>('form');

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setView('form');
    }
  }, [isOpen, initialMode]);

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInErr) {
          setError(signInErr.message);
        } else {
          setView('signed-in');
          if (onSuccess) onSuccess();
          setTimeout(onClose, 750);
        }
      } else {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpErr) {
          setError(signUpErr.message);
        } else if (data.session) {
          setView('signed-in');
          if (onSuccess) onSuccess();
          setTimeout(onClose, 750);
        } else {
          setView('confirm-email');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError(null);
    setView('form');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="v5-auth-heading"
      className="v5-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="v5-modal-panel relative z-10 w-full max-w-[390px] p-6 sm:p-7 text-[#1D2729]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="v5-focus absolute top-4 right-4 h-8 w-8 rounded-lg flex items-center justify-center text-[#5F554F] hover:text-[#1D2729] hover:bg-black/5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {view === 'signed-in' ? (
          <div className="py-8 text-center space-y-2.5">
            <div className="h-11 w-11 rounded-full bg-[#3F8E80]/15 text-[#2E6F64] mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3
              className="text-xl font-bold text-[#1D2729]"
              style={{ fontFamily: 'var(--v5-font-serif)' }}
            >
              Signed in to PENORA
            </h3>
            <p className="text-xs text-[#5F554F]">
              Welcome back, <strong className="text-[#1D2729]">{email}</strong>
            </p>
          </div>
        ) : view === 'confirm-email' ? (
          <div className="py-6 text-center space-y-3">
            <div className="h-11 w-11 rounded-full bg-[#3F8E80]/15 text-[#2E6F64] mx-auto flex items-center justify-center">
              <Mail className="h-5 w-5" />
            </div>
            <h3
              className="text-xl font-bold text-[#1D2729]"
              style={{ fontFamily: 'var(--v5-font-serif)' }}
            >
              Check your inbox
            </h3>
            <p className="text-xs text-[#5F554F] leading-relaxed">
              We sent a confirmation link to <strong className="text-[#1D2729]">{email}</strong>.
              Confirm your email to complete account setup.
            </p>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="v5-focus text-xs font-semibold text-[#2E6F64] underline pt-1"
            >
              Return to Sign in
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3F8E80] mb-1">
                PENORA Publishing
              </div>
              <h2
                id="v5-auth-heading"
                className="text-2xl font-bold text-[#1D2729] tracking-tight"
                style={{ fontFamily: 'var(--v5-font-serif)' }}
              >
                {mode === 'login' ? 'Sign in to your account' : 'Create your creator account'}
              </h2>
              <p className="text-xs text-[#5F554F] mt-1 leading-relaxed">
                {mode === 'login'
                  ? 'Access your personalized feed, bookmarks, and publishing tools.'
                  : 'Join a calm, reader-supported community for thoughtful writing.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
              <div>
                <label
                  htmlFor="v5-email-input"
                  className="block text-xs font-medium text-[#1D2729] mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="v5-email-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="v5-focus w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#1D2729]/15 text-xs text-[#1D2729] placeholder:text-[#8C827A] focus:border-[#3F8E80] transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="v5-password-input"
                  className="block text-xs font-medium text-[#1D2729] mb-1.5"
                >
                  Password
                </label>
                <input
                  id="v5-password-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="v5-focus w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#1D2729]/15 text-xs text-[#1D2729] placeholder:text-[#8C827A] focus:border-[#3F8E80] transition-colors"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200/80 text-red-700 text-xs leading-snug">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="v5-btn-jade v5-focus w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{mode === 'login' ? 'Signing in…' : 'Creating account…'}</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'login' ? 'Sign in' : 'Create account'}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-5 pt-4 border-t border-[#1D2729]/10 text-center text-xs text-[#5F554F]">
              {mode === 'login' ? (
                <>
                  New to PENORA?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="v5-focus font-semibold text-[#1D2729] underline hover:text-[#2E6F64]"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="v5-focus font-semibold text-[#1D2729] underline hover:text-[#2E6F64]"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

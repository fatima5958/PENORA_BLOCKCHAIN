// src/components/auth/AuthModal.tsx
// Real Supabase authentication modal — no demo/simulated state
import React, { useState } from 'react';
import { X, Mail, Lock, ArrowRight, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signUp: (email: string, password: string) => Promise<{ error?: any }>;
}

type ViewState = 'form' | 'success' | 'confirm-email';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  signIn,
  signUp,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>('form');

  if (!isOpen) return null;

  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setError(null);
    setView('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const result = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password);

    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? 'Something went wrong. Please try again.');
    } else if (mode === 'login') {
      // onAuthStateChange in Header will update user state automatically
      setView('success');
      setTimeout(onClose, 900);
    } else {
      // Supabase sends a confirmation email for new accounts
      setView('confirm-email');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-penora-cocoa-dark/60 backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-3xl bg-white/95 backdrop-blur-xl p-8 shadow-spatial-xl border border-white/90 z-10 animate-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 h-8 w-8 rounded-full flex items-center justify-center text-penora-cocoa-muted hover:bg-penora-cocoa/8 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Success view */}
        {view === 'success' && (
          <div className="py-8 text-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-penora-mint/15 text-penora-mint mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="font-serif text-2xl font-bold text-penora-cocoa">Welcome back!</h3>
            <p className="text-sm text-penora-cocoa-muted">You are signed in.</p>
          </div>
        )}

        {/* Email confirmation view */}
        {view === 'confirm-email' && (
          <div className="py-8 text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-penora-mint/15 text-penora-mint mx-auto flex items-center justify-center">
              <Mail className="h-8 w-8" />
            </div>
            <h3 className="font-serif text-2xl font-bold text-penora-cocoa">Check your inbox</h3>
            <p className="text-sm text-penora-cocoa-muted leading-relaxed">
              We sent a confirmation link to <strong className="text-penora-cocoa">{email}</strong>.<br />
              Click the link to activate your account, then log in.
            </p>
            <button
              type="button"
              onClick={() => { setView('form'); setMode('login'); }}
              className="text-sm font-semibold text-penora-mint underline"
            >
              Go to login
            </button>
          </div>
        )}

        {/* Form view */}
        {view === 'form' && (
          <>
            <div className="mb-6">
              <h2 className="font-serif text-3xl font-bold text-penora-cocoa tracking-tight">
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </h2>
              <p className="text-xs text-penora-cocoa-muted mt-1.5">
                {mode === 'login'
                  ? 'Sign in to access your feed and profile.'
                  : 'Join PENORA — free to start writing.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email */}
              <div>
                <label htmlFor="auth-email" className="block text-xs font-semibold text-penora-cocoa mb-1.5">
                  Email address
                </label>
                <div className="flex rounded-xl overflow-hidden border border-penora-cocoa/20 bg-white focus-within:ring-2 focus-within:ring-penora-mint/40">
                  <div className="px-3 flex items-center text-penora-cocoa-muted border-r border-penora-cocoa/10 bg-penora-cocoa/3">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className="w-full px-3 py-3 bg-transparent text-sm text-penora-cocoa focus:outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="auth-password" className="block text-xs font-semibold text-penora-cocoa mb-1.5">
                  Password
                </label>
                <div className="flex rounded-xl overflow-hidden border border-penora-cocoa/20 bg-white focus-within:ring-2 focus-within:ring-penora-mint/40">
                  <div className="px-3 flex items-center text-penora-cocoa-muted border-r border-penora-cocoa/10 bg-penora-cocoa/3">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'Min. 6 characters' : '••••••••'}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full px-3 py-3 bg-transparent text-sm text-penora-cocoa focus:outline-none"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <div className="pt-1 flex items-center justify-between gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-penora-cocoa-dark text-white font-semibold text-sm shadow-spatial-md hover:bg-penora-cocoa active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{mode === 'login' ? 'Signing in…' : 'Creating…'}</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'login' ? 'Sign in' : 'Create account'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <div className="text-right">
                  <p className="text-[11px] text-penora-cocoa-muted">
                    {mode === 'login' ? 'New to PENORA?' : 'Already have an account?'}
                  </p>
                  <button
                    type="button"
                    onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                    className="text-xs font-bold text-penora-mint hover:text-penora-mint-hover transition-colors underline"
                  >
                    {mode === 'login' ? 'Register for free' : 'Sign in'}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

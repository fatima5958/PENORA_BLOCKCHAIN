// src/components/common/BetaFeedbackModal.tsx
// PENORA Public Beta Tester Feedback Modal
// Accessible, touch-friendly, secure dialog for reporting bugs or suggestions.

import React, { useState, useEffect } from 'react';
import {
  MessageSquarePlus,
  X,
  Bug,
  Sparkles,
  Layout,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Send,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface BetaFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackCategory = 'bug' | 'suggestion' | 'ux' | 'other';

const CATEGORIES: { key: FeedbackCategory; label: string; icon: React.ReactNode }[] = [
  { key: 'bug', label: 'Bug Report', icon: <Bug className="h-3.5 w-3.5 text-rose-500" /> },
  { key: 'suggestion', label: 'Feature Idea', icon: <Sparkles className="h-3.5 w-3.5 text-amber-500" /> },
  { key: 'ux', label: 'UI / UX Polish', icon: <Layout className="h-3.5 w-3.5 text-cyan-500" /> },
  { key: 'other', label: 'General Feedback', icon: <HelpCircle className="h-3.5 w-3.5 text-[#007C8B]" /> },
];

export const BetaFeedbackModal: React.FC<BetaFeedbackModalProps> = ({ isOpen, onClose }) => {
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSubmitSuccess(false);
      setErrorMessage(null);
      // Auto-fill email if user is logged in
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user?.email) {
          setEmail(data.session.user.email);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 5) {
      setErrorMessage('Please provide at least 5 characters of feedback.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message: message.trim(),
          userEmail: email.trim() || undefined,
          pageUrl: typeof window !== 'undefined' ? window.location.pathname : undefined,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to submit feedback.');
      }

      setSubmitSuccess(true);
      setMessage('');
      setTimeout(() => {
        onClose();
      }, 2200);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Beta Feedback Modal"
      className="fixed inset-0 z-50 bg-[#0A2540]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-[#0E1E28] rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-[#007C8B]/20 shadow-2xl relative space-y-5">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-gradient-to-br from-[#007C8B] to-[#00E5F4] text-white">
            <MessageSquarePlus className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-serif text-lg font-bold text-[#0A2540] dark:text-white">
              Beta Feedback &amp; Bug Report
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Help us polish PENORA before public release.
            </p>
          </div>
        </div>

        {submitSuccess ? (
          <div className="p-6 text-center space-y-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
            <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
              Feedback Received!
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Thank you for contributing to the PENORA public beta. Our team is actively reviewing submissions.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setCategory(cat.key)}
                      className={`p-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all border ${
                        isSelected
                          ? 'bg-[#007C8B]/10 border-[#007C8B] text-[#007C8B] font-semibold'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200/60 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      {cat.icon}
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <span className="text-slate-400 text-[11px] font-mono">
                  {message.length} / 2000
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What happened? Or what can we improve? Please include steps to reproduce if reporting a bug."
                rows={4}
                maxLength={2000}
                required
                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 p-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#007C8B]/30 focus:border-[#007C8B] resize-none"
              />
            </div>

            {/* Optional Contact Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Contact Email (Optional)</span>
                <span className="text-[10px] text-slate-400 font-normal">For follow-up questions</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#007C8B]/30 focus:border-[#007C8B]"
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit & Cancel Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || message.trim().length < 5}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] hover:opacity-95 text-white flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Feedback</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

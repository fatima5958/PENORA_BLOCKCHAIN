import React, { useState } from 'react';
import { GlassButton } from '../3d/GlassButton';
import { ArrowRight, Check, Sparkles, Mail, Lock } from 'lucide-react';

export const NewsletterGlass: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && email.includes('@')) {
      setSubmitted(true);
    }
  };

  return (
    <section id="join" className="py-20 px-4 sm:px-6 relative">
      <div className="max-w-4xl mx-auto">
        <div className="relative rounded-[2.5rem] liquid-glass p-8 sm:p-14 shadow-spatial-xl border border-white/90 overflow-hidden text-center">
          
          {/* Subtle Ambient Coral Glow in background */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-penora-peach/25 rounded-full blur-3xl -z-10"
          />

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-penora-peach-light/40 border border-penora-peach/30 text-penora-coral text-xs font-semibold mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            <span>PENORA Editorial Beta Access</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-penora-cocoa tracking-tight mb-4 max-w-2xl mx-auto">
            Step into the next dimension of digital writing.
          </h2>

          <p className="text-penora-cocoa-muted text-base max-w-lg mx-auto mb-10 leading-relaxed">
            Join the priority cohort of authors and curators shaping PENORA’s spatial publishing protocol.
            Zero spam. Free forever for beta readers.
          </p>

          {submitted ? (
            <div className="inline-flex items-center gap-3 p-4 px-6 rounded-full bg-emerald-100/80 border border-emerald-300 text-emerald-900 text-sm font-semibold shadow-spatial-sm animate-in fade-in zoom-in-95">
              <Check className="h-5 w-5 text-emerald-600" />
              <span>You're on the priority invitation list! Welcome to PENORA.</span>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="max-w-md mx-auto relative flex items-center"
            >
              <div className="relative w-full">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-penora-cocoa-muted/60" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address..."
                  required
                  className="w-full pl-12 pr-14 py-4 rounded-full bg-white/90 border border-white/80 shadow-spatial-sm text-penora-cocoa placeholder:text-penora-cocoa-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-penora-coral/40 backdrop-blur-md"
                />
                <button
                  type="submit"
                  aria-label="Submit email"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-penora-cocoa text-white flex items-center justify-center shadow-gloss-dark hover:bg-penora-coral transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          <div className="flex items-center justify-center gap-4 mt-6 text-xs text-penora-cocoa-muted">
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-penora-coral" /> Privacy First
            </span>
            <span>·</span>
            <span>Zero Tracking Cookies</span>
            <span>·</span>
            <span>Instant Unsubscribe</span>
          </div>
        </div>
      </div>
    </section>
  );
};

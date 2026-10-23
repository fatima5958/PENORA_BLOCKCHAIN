// src/components/common/Footer.tsx
// PENORA Blockchain — Compact App-Style Footer with Beta Feedback
import React, { useState } from 'react';
import { PenoraEmblem } from '../brand/PenoraLogo';
import { BetaFeedbackModal } from './BetaFeedbackModal';
import { MessageSquarePlus } from 'lucide-react';

export const Footer: React.FC = () => {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <>
      <footer className="hidden md:block border-t border-[#0A2540]/8 bg-white/70 backdrop-blur-md py-4 px-4 sm:px-6 lg:px-8 mt-12">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6E7D90]">
          {/* Left: Brand & Copyright */}
          <div className="flex items-center gap-2.5">
            <a href="/" className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
              <PenoraEmblem size={18} />
              <span className="font-bold text-[#0A2540] tracking-tight">PENORA</span>
            </a>
            <span className="text-[#0A2540]/20">|</span>
            <span>© {new Date().getFullYear()}</span>
          </div>

          {/* Center: Essential Quick Links */}
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-center font-medium">
            <a href="/explore" className="hover:text-[#007C8B] transition-colors">Explore</a>
            <a href="/communities" className="hover:text-[#007C8B] transition-colors">Communities</a>
            <a href="/editor" className="hover:text-[#007C8B] transition-colors">Article Studio</a>
            <a href="/brand" className="hover:text-[#007C8B] transition-colors">Brand</a>
            <a href="/roadmap" className="hover:text-[#007C8B] transition-colors">Protocol Safety</a>
            <button
              type="button"
              onClick={() => setShowFeedback(true)}
              className="inline-flex items-center gap-1.5 text-[#007C8B] hover:text-[#00B3C4] font-semibold transition-colors"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              <span>Beta Feedback</span>
            </button>
          </div>

          {/* Right: Live Network Status Pill */}
          <div className="flex items-center gap-2 bg-[#007C8B]/5 border border-[#007C8B]/15 px-2.5 py-1 rounded-full text-[11px] font-medium text-[#0A2540]">
            <span className="pn-status-dot h-1.5 w-1.5" />
            <span>Protocol Active</span>
          </div>
        </div>
      </footer>

      <BetaFeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
    </>
  );
};

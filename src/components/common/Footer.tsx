// src/components/common/Footer.tsx
// PENORA Blockchain — Global Footer
import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { PenoraLogo } from '../brand/PenoraLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-20 border-t border-[#0A2540]/8 bg-white/80 backdrop-blur-md pt-14 pb-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-12">
          {/* Brand Column (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <a href="/" className="inline-flex items-center">
              <PenoraLogo variant="horizontal" size="sm" showTagline={true} />
            </a>
            <p className="text-xs sm:text-sm text-[#4A5B70] max-w-sm leading-relaxed">
              Building a more open, connected tomorrow. A refined Web3 publishing platform where writers publish longform essays, curate domain communities, and earn verifiable reputation.
            </p>
            <div className="inline-flex items-center gap-2 text-xs text-[#0A2540] bg-[#EEFBFC] border border-[#007C8B]/20 px-3 py-1.5 rounded-full font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-[#007C8B]" />
              <span>Non-cash reputation protocol · Verifiable creator identity</span>
            </div>
          </div>

          {/* Platform Links (2 cols) */}
          <div className="md:col-span-2">
            <h4 className="pn-label mb-3">Platform</h4>
            <ul className="space-y-2.5 text-xs text-[#4A5B70]">
              <li><a href="/" className="hover:text-[#007C8B] transition-colors">Home Feed</a></li>
              <li><a href="/explore" className="hover:text-[#007C8B] transition-colors">Explore Topics</a></li>
              <li><a href="/communities" className="hover:text-[#007C8B] transition-colors">Communities</a></li>
              <li><a href="/editor" className="hover:text-[#007C8B] transition-colors">Article Studio</a></li>
            </ul>
          </div>

          {/* Brand & Design System (3 cols) */}
          <div className="md:col-span-3">
            <h4 className="pn-label mb-3">Brand & Architecture</h4>
            <ul className="space-y-2.5 text-xs text-[#4A5B70]">
              <li><a href="/brand" className="hover:text-[#007C8B] transition-colors font-medium text-[#0A2540]">Brand Identity & UI System</a></li>
              <li><a href="/roadmap" className="hover:text-[#007C8B] transition-colors">Protocol Roadmap & Safety</a></li>
              <li><a href="/dev-progress" className="hover:text-[#007C8B] transition-colors">Development Status</a></li>
              <li><a href="/profile/erostova" className="hover:text-[#007C8B] transition-colors">Creator Profile Showcase</a></li>
            </ul>
          </div>

          {/* Status Column (2 cols) */}
          <div className="md:col-span-2">
            <h4 className="pn-label mb-3">Network Status</h4>
            <ul className="space-y-2.5 text-xs text-[#4A5B70]">
              <li className="flex items-center gap-2 text-[#0A2540] font-medium">
                <span className="pn-status-dot" />
                <span>Protocol Active</span>
              </li>
              <li><span>Supabase Auth Connected</span></li>
              <li><span>Balanced Motion UI</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-[#0A2540]/8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6E7D90]">
          <p>© {new Date().getFullYear()} PENORA Blockchain. Precision Web3 Publishing & Curation Protocol.</p>
          <div className="flex items-center gap-4">
            <a href="/brand" className="hover:text-[#0A2540] transition-colors">Brand Guidelines</a>
            <span>·</span>
            <a href="/roadmap" className="hover:text-[#0A2540] transition-colors">Protocol Safety</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

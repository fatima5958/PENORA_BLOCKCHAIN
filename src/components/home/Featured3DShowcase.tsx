import React, { useState } from 'react';
import { FloatingCard } from '../3d/FloatingCard';
import { SpatialBadge } from '../3d/SpatialBadge';
import { GlassButton } from '../3d/GlassButton';
import { Layers, Award, Sparkles, Sliders, CheckCircle2, ShieldAlert } from 'lucide-react';

export const Featured3DShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'spatial' | 'curation' | 'governance'>('spatial');

  return (
    <section id="manifesto" className="py-20 px-4 sm:px-6 relative">
      <div className="max-w-6xl mx-auto">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <SpatialBadge variant="coral" size="md" className="mb-3.5">
            Architectural Philosophy
          </SpatialBadge>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-penora-cocoa tracking-tight mb-4">
            Re-engineering the Social Publishing Layer
          </h2>
          <p className="text-penora-cocoa-muted text-base leading-relaxed">
            Built on the foundational insight that readers and writers share in curation value,
            elevated with Apple Vision Pro spatial depth and liquid glass design.
          </p>
        </div>

        {/* Interactive Showcase Card */}
        <div className="rounded-3xl liquid-glass p-6 sm:p-10 shadow-spatial-xl border border-white/90">
          
          {/* Tab Selector - Liquid Glass Pill Group */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10 p-1.5 rounded-full bg-penora-cocoa/5 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setActiveTab('spatial')}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'spatial'
                  ? 'bg-penora-cocoa text-white shadow-spatial-sm'
                  : 'text-penora-cocoa-muted hover:text-penora-cocoa'
              }`}
            >
              1. Spatial Depth (70%)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('curation')}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'curation'
                  ? 'bg-penora-cocoa text-white shadow-spatial-sm'
                  : 'text-penora-cocoa-muted hover:text-penora-cocoa'
              }`}
            >
              2. Peer Curation
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('governance')}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'governance'
                  ? 'bg-penora-cocoa text-white shadow-spatial-sm'
                  : 'text-penora-cocoa-muted hover:text-penora-cocoa'
              }`}
            >
              3. Safety & Reputation
            </button>
          </div>

          {/* Dynamic Content Planes */}
          {activeTab === 'spatial' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-in fade-in duration-300">
              <div className="space-y-4">
                <div className="h-10 w-10 rounded-2xl bg-penora-peach-light/50 flex items-center justify-center text-penora-coral">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-penora-cocoa">
                  Multi-Plane Depth & Realistic Ambient Lighting
                </h3>
                <p className="text-penora-cocoa-muted text-sm leading-relaxed">
                  Instead of flat, lifeless cards, PENORA incorporates spatial lighting physics.
                  Primary blogs float on an elevated z-plane, casting realistic soft ambient shadows
                  while maintaining rigorous readable contrast.
                </p>
                <ul className="space-y-2.5 text-xs text-penora-cocoa pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-penora-coral" />
                    <span>Z-elevation hierarchy inspired by VisionOS viewport standards</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-penora-coral" />
                    <span>Chromatic prism borders and glossy liquid button shaders</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-penora-coral" />
                    <span>Reduced-motion support for full accessibility compliance</span>
                  </li>
                </ul>
              </div>

              {/* Spatial 3D Preview Stack */}
              <div className="relative p-6 rounded-3xl bg-gradient-to-br from-white/70 to-penora-cream/40 border border-white/80 shadow-spatial-lg">
                <FloatingCard depth="hero" glowColor="coral" className="p-6">
                  <div className="flex items-center justify-between mb-3 text-xs text-penora-cocoa-muted">
                    <span className="font-semibold text-penora-coral">Floating Elevation Layer</span>
                    <span>z-index: 30</span>
                  </div>
                  <div className="h-24 rounded-xl bg-penora-peach-light/30 border border-penora-peach/20 p-4 flex flex-col justify-between">
                    <div className="h-2 w-2/3 bg-penora-cocoa/20 rounded-full" />
                    <div className="h-2 w-1/2 bg-penora-cocoa/10 rounded-full" />
                    <div className="h-2 w-4/5 bg-penora-coral/30 rounded-full" />
                  </div>
                  <p className="text-xs text-penora-cocoa-muted mt-3">
                    Hover and move cursor over card to test interactive multi-point gyroscopic tilt.
                  </p>
                </FloatingCard>
              </div>
            </div>
          )}

          {activeTab === 'curation' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-in fade-in duration-300">
              <div className="space-y-4">
                <div className="h-10 w-10 rounded-2xl bg-penora-peach-light/50 flex items-center justify-center text-penora-coral">
                  <Award className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-penora-cocoa">
                  Consensus Voting Without Toxic Rage Engagement
                </h3>
                <p className="text-penora-cocoa-muted text-sm leading-relaxed">
                  We refine peer reader curation: readers cast upvotes that accumulate
                  into transparent community reputation. Rather than algorithmic black boxes, the feed
                  is shaped entirely by peer readers.
                </p>
                <div className="p-4 rounded-2xl bg-penora-peach-light/30 border border-penora-peach/20 text-xs text-penora-cocoa">
                  <p className="font-semibold mb-1 text-penora-coral">Merit-First Dynamic</p>
                  Articles receiving genuine reader endorsements gain higher visual elevation in the spatial layout.
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white/80 shadow-spatial-md border border-white/90">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-penora-surface border border-penora-cocoa/8 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-penora-coral text-white font-bold flex items-center justify-center text-xs">
                      94
                    </div>
                    <div>
                      <div className="text-xs font-bold text-penora-cocoa">Curator Consensus</div>
                      <div className="text-[10px] text-penora-cocoa-muted">High editorial weight</div>
                    </div>
                  </div>
                  <SpatialBadge variant="coral">Verified Author</SpatialBadge>
                </div>
                <div className="text-xs text-penora-cocoa-muted leading-relaxed">
                  Every vote reflects the curator's earned reputation score, dampening spam and low-effort farming.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'governance' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-in fade-in duration-300">
              <div className="space-y-4">
                <div className="h-10 w-10 rounded-2xl bg-penora-peach-light/50 flex items-center justify-center text-penora-coral">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-penora-cocoa">
                  Business Safety & Free-First Architecture
                </h3>
                <p className="text-penora-cocoa-muted text-sm leading-relaxed">
                  We maintain strict architectural separation between free participatory features and future financial rails.
                  Points in Phase 1-5 are strictly non-cash reputation indicators.
                </p>
                <ul className="space-y-2 text-xs text-penora-cocoa">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Zero paid dependencies, zero billing traps, 100% free-first</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>No fake promises of speculative crypto yields</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Prepared for secure Supabase Auth and PostgreSQL RLS in Phase 2</span>
                  </li>
                </ul>
              </div>

              <div className="p-6 rounded-3xl bg-penora-surface border border-penora-coral/20 shadow-spatial-md">
                <h4 className="text-sm font-bold text-penora-cocoa mb-2">Phase 1 Safety Guarantee</h4>
                <p className="text-xs text-penora-cocoa-muted leading-relaxed mb-4">
                  All mock data and demonstration feeds are explicitly demarcated. No sensitive credentials or blockchain keys are required.
                </p>
                <GlassButton variant="secondary" size="sm" href="/roadmap">
                  Review Roadmap & Safeguards
                </GlassButton>
              </div>
            </div>
          )}

        </div>
      </div>
    </section>
  );
};

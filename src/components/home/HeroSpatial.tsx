import React from 'react';
import { GlassButton } from '../3d/GlassButton';
import { FloatingCard } from '../3d/FloatingCard';
import { SpatialBadge } from '../3d/SpatialBadge';
import { ReputationIndicator } from '../feed/ReputationIndicator';
import { ArrowRight, Sparkles, Compass, Shield, Flame, Play, Eye } from 'lucide-react';

export const HeroSpatial: React.FC = () => {
  return (
    <section className="relative min-h-[92vh] flex items-center justify-center pt-28 pb-16 px-4 sm:px-6 overflow-hidden">
      {/* Background Volumetric Atmospheric Light */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 spatial-ambient-glow opacity-80"
      />

      {/* Massive Spatial Watermark Typography - Apple Vision Pro Inspired */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center select-none overflow-hidden"
      >
        <span className="font-serif font-extrabold text-[15vw] leading-none text-penora-cocoa/[0.045] tracking-widest uppercase">
          PENORA
        </span>
      </div>

      <div className="max-w-6xl w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Vision & Philosophy */}
          <div className="lg:col-span-7 flex flex-col items-start text-left z-20">
            {/* Social Proof Pill Badge */}
            <div className="inline-flex items-center gap-3 p-1.5 pr-4 rounded-full liquid-glass shadow-spatial-sm mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex -space-x-2 overflow-hidden">
                <img
                  className="inline-block h-7 w-7 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
                  alt="Author Elena"
                />
                <img
                  className="inline-block h-7 w-7 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"
                  alt="Author Marcus"
                />
                <img
                  className="inline-block h-7 w-7 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80"
                  alt="Author Seraphina"
                />
              </div>
              <span className="text-xs font-semibold text-penora-cocoa">
                Curated by <span className="text-penora-coral">8,400+</span> thoughtful writers
              </span>
            </div>

            {/* Primary Headline */}
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-penora-cocoa tracking-tight leading-[1.12] mb-6">
              A more human <br />
              <span className="italic font-normal text-penora-coral">
                depth to prose.
              </span>
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg text-penora-cocoa-muted max-w-xl leading-relaxed mb-8">
              PENORA elevates independent publishing into three-dimensional clarity.
              Peer-voted longform, non-cash reputation merit, and tactile spatial reading
              unshackled from rage-inducing algorithmic feeds.
            </p>

            {/* CTA Group */}
            <div className="flex flex-wrap items-center gap-3.5 w-full sm:w-auto">
              <GlassButton
                variant="primary"
                size="lg"
                href="/feed"
                icon={<ArrowRight className="h-4 w-4" />}
                className="w-full sm:w-auto"
              >
                Explore Live Feed
              </GlassButton>
              <GlassButton
                variant="secondary"
                size="lg"
                href="#manifesto"
                icon={<Eye className="h-4 w-4" />}
                className="w-full sm:w-auto"
              >
                Experience Design
              </GlassButton>
            </div>

            {/* Safety & Protocol Notice */}
            <div className="flex items-center gap-2 mt-8 text-xs text-penora-cocoa-muted/80">
              <Shield className="h-4 w-4 text-penora-coral" />
              <span>Phase 1 Frontend Prototype · Free-first · Non-cash merit scores</span>
            </div>
          </div>

          {/* Right Column: Layered Spatial 3D Card Stack (Vision Pro reference) */}
          <div className="lg:col-span-5 relative mt-6 lg:mt-0 flex justify-center">
            
            {/* Ambient Back Glow Ring */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-penora-coral/20 via-penora-peach/25 to-white/40 rounded-[2.5rem] blur-2xl -z-10" />

            {/* Main Elevated Spatial Hero Card */}
            <FloatingCard
              depth="hero"
              glowColor="coral"
              className="w-full max-w-md p-6 sm:p-7 relative border border-white/80"
            >
              {/* Top Meta Bar */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-semibold text-penora-cocoa">
                    Trending Editorial
                  </span>
                </div>
                <SpatialBadge variant="coral" size="sm" dot>
                  +1,240 Rep Points
                </SpatialBadge>
              </div>

              {/* Cover Artwork Preview with Liquid Glass sheen */}
              <div className="relative rounded-2xl overflow-hidden aspect-[16/10] mb-5 shadow-spatial-sm">
                <img
                  src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"
                  alt="Spatial surfaces"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-penora-cocoa-dark/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                  <span className="font-serif italic text-penora-peach">
                    Spatial Computing Volume IV
                  </span>
                  <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full text-[11px]">
                    7 min read
                  </span>
                </div>
              </div>

              {/* Title & Author snippet */}
              <h3 className="font-serif text-lg font-bold text-penora-cocoa mb-2 line-clamp-2">
                The Architecture of Spatial Interfaces: Beyond the Flat Glass Pane
              </h3>
              
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-penora-cocoa/8 text-xs text-penora-cocoa-muted">
                <div className="flex items-center gap-2">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                    alt="Elena"
                    className="h-6 w-6 rounded-full object-cover"
                  />
                  <span className="font-medium text-penora-cocoa">Elena Rostova</span>
                </div>
                <div className="flex items-center gap-1 font-semibold text-penora-coral">
                  <Flame className="h-3.5 w-3.5" />
                  <span>342 votes</span>
                </div>
              </div>
            </FloatingCard>

            {/* Overlapping Floating Satellite Glass Card (Vision Pro Reference detail) */}
            <div className="absolute -bottom-6 -left-4 sm:-left-8 max-w-[250px] p-4 rounded-2xl liquid-glass shadow-spatial-xl hidden sm:block z-30 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="h-7 w-7 rounded-full bg-penora-coral/20 flex items-center justify-center text-penora-coral">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-penora-cocoa">Proof of Curation</h4>
                  <p className="text-[10px] text-penora-cocoa-muted">Reputation weighted consensus</p>
                </div>
              </div>
              <div className="w-full bg-penora-cocoa/10 h-1.5 rounded-full overflow-hidden mt-2">
                <div className="bg-penora-coral h-full rounded-full w-[84%]" />
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};

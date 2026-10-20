import React from 'react';
import { FloatingCard } from '../3d/FloatingCard';
import { SpatialBadge } from '../3d/SpatialBadge';
import { GlassButton } from '../3d/GlassButton';
import { CheckCircle2, Clock, ShieldCheck } from 'lucide-react';

interface PhaseItem {
  phase: string;
  title: string;
  status: 'completed' | 'pending' | 'future';
  description: string;
  details: string[];
}

const phases: PhaseItem[] = [
  {
    phase: 'Phase 1',
    title: 'Spatial Design System & 3D Web Frontend',
    status: 'completed',
    description: 'Vision Pro spatial depth (70%), liquid glass optics (20%), and warm volcano accents (10%). Reusable components, functional navigation, and accessible mobile layout.',
    details: [
      'Spatial design tokens & 3D shadow system',
      'Interactive gyroscopic card tilt',
      'In-app feed prototype with optimistic voting',
      'Automated smoke tests & static build validation',
    ],
  },
  {
    phase: 'Phase 2',
    title: 'Auth, Database Schema & Security RLS',
    status: 'pending',
    description: 'Supabase Auth, PostgreSQL schema, strict Row Level Security (RLS), user profiles and secure API foundations.',
    details: [
      'Zero hardcoded admin access',
      'Cryptographic session tokens',
      'Anti-sybil account creation safeguards',
    ],
  },
  {
    phase: 'Phase 3',
    title: 'Publishing Editor & Dynamic Feeds',
    status: 'future',
    description: 'Rich-text markdown editor, cover image storage, real-time draft autosaving, tag search and RSS feeds.',
    details: [
      'SEO-optimized article slugs',
      'Media storage bucket with image optimization',
      'Draft version history',
    ],
  },
  {
    phase: 'Phase 4',
    title: 'Community Consensus, Comments & Follows',
    status: 'future',
    description: 'Persistent peer voting engine, threaded comment trees, user follows, bookmark collections, and community circle governance.',
    details: [
      'Reputation-weighted voting calculations',
      'Moderation queues & community flag thresholds',
    ],
  },
  {
    phase: 'Phase 5',
    title: 'Reputation Engine & Beta Readiness',
    status: 'future',
    description: 'Non-cash reputation point scoring algorithms, spam heuristics, moderation dashboard, and comprehensive automated test suites.',
    details: [
      'Strict non-cash enforcement',
      'Automated CI/CD security scanning',
    ],
  },
  {
    phase: 'Phase 6',
    title: 'Revenue-Backed Creator Rewards',
    status: 'future',
    description: 'Sustainable creator revenue share after separate review and approval. No speculation or cash promises.',
    details: [
      'Contingent on separate explicit user approval',
      'Transparent balance ledgers',
    ],
  },
  {
    phase: 'Phase 7',
    title: 'Optional Blockchain Architecture',
    status: 'future',
    description: 'Optional on-chain archiving and sovereign wallet connections following rigorous technical and regulatory review.',
    details: [
      'Zero speculative tokens in core app',
      'Decentralized identity portability',
    ],
  },
];

export const RoadmapView: React.FC = () => {
  return (
    <div className="pt-28 pb-20 px-4 sm:px-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <SpatialBadge variant="coral" size="md" className="mb-4">
          Engineering Roadmap
        </SpatialBadge>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-penora-cocoa tracking-tight mb-4">
          Phased Architecture & Safety Principles
        </h1>
        <p className="text-penora-cocoa-muted text-base leading-relaxed">
          Building a durable platform requires structural discipline. Every phase is strictly gate-kept, free-first by default, and engineered for long-term security.
        </p>
      </div>

      {/* Safety Declarations Banner */}
      <div className="rounded-3xl liquid-glass p-8 shadow-spatial-md border border-white/90 mb-16">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="h-6 w-6 text-penora-coral" />
          <h2 className="font-serif text-xl font-bold text-penora-cocoa">
            Core Business & Safety Guarantees
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-penora-cocoa leading-relaxed">
          <div className="p-4 rounded-2xl bg-white/70 border border-white/80">
            <div className="font-bold text-penora-cocoa mb-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Free-First Architecture
            </div>
            No paid services, third-party subscriptions, or billing APIs will be provisioned without explicit user authorization.
          </div>
          <div className="p-4 rounded-2xl bg-white/70 border border-white/80">
            <div className="font-bold text-penora-cocoa mb-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Non-Cash Reputation
            </div>
            Points earned in Phases 1 through 5 represent community curation weight only. They are not cash, financial assets, or promises of yield.
          </div>
          <div className="p-4 rounded-2xl bg-white/70 border border-white/80">
            <div className="font-bold text-penora-cocoa mb-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-penora-coral" /> Zero Secrets Exposure
            </div>
            No API keys, service roles, or administrative credentials are hardcoded. All database operations will adhere to strict PostgreSQL RLS.
          </div>
        </div>
      </div>

      {/* Phased Timeline Stack */}
      <div className="space-y-6">
        {phases.map((item) => (
          <FloatingCard key={item.phase} depth="sm" className="p-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <span className="font-serif font-bold text-penora-coral text-base">
                  {item.phase}
                </span>
                <h3 className="font-serif text-xl font-bold text-penora-cocoa">
                  {item.title}
                </h3>
              </div>
              <div>
                {item.status === 'completed' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100/80 px-3 py-1 rounded-full border border-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Phase 1 Complete (Current)
                  </span>
                )}
                {item.status === 'pending' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-100/80 px-3 py-1 rounded-full border border-amber-300">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    Next Up (Awaiting Approval)
                  </span>
                )}
                {item.status === 'future' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-penora-cocoa-muted bg-penora-cocoa/5 px-3 py-1 rounded-full">
                    Planned Horizon
                  </span>
                )}
              </div>
            </div>

            <p className="text-sm text-penora-cocoa-muted leading-relaxed mb-4">
              {item.description}
            </p>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-penora-cocoa pt-3 border-t border-penora-cocoa/8">
              {item.details.map((detail, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-penora-coral flex-shrink-0" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </FloatingCard>
        ))}
      </div>

      {/* Approval Callout at bottom */}
      <div className="mt-16 text-center">
        <p className="text-xs text-penora-cocoa-muted mb-4">
          Phase 1 has delivered the design system, 3D landing page, and feed preview.
        </p>
        <GlassButton variant="primary" size="md" href="/feed">
          Test Interactive Feed
        </GlassButton>
      </div>
    </div>
  );
};

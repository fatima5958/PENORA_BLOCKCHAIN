import React from 'react';

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const mockCards = [
  {
    title: 'The Future of Decentralized Publishing',
    author: 'Mateen Fatima',
    initials: 'MF',
    readTime: '6 min read',
    excerpt:
      'How blockchain-backed content platforms are reshaping who gets paid and who controls the narrative in the creator economy.',
    tag: 'Technology',
  },
  {
    title: 'Building Rituals for Deep Work in 2026',
    author: 'Jordan Reeves',
    initials: 'JR',
    readTime: '4 min read',
    excerpt:
      'Cal Newport\'s framework meets a world of ambient AI notifications. What does focus even mean anymore?',
    tag: 'Productivity',
  },
];

// ─── Concept A: Premium Editorial ──────────────────────────────────────────────

const ConceptA: React.FC = () => (
  <div style={{ background: '#ffffff', color: '#1a1a1a', fontFamily: 'Georgia, serif', border: '1px solid #e8e0d8', borderRadius: 16, overflow: 'hidden' }}>
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid #e8e0d8' }}>
      <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.5 }}>PENORA</span>
      <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#555', fontFamily: 'sans-serif' }}>
        <span>Explore</span><span>Communities</span><span>Write</span>
      </div>
      <div style={{ display: 'flex', gap: 8, fontFamily: 'sans-serif' }}>
        <button style={{ fontSize: 11, color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}>Login</button>
        <button style={{ fontSize: 11, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 20, padding: '5px 14px', cursor: 'pointer' }}>Sign up</button>
      </div>
    </nav>
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {mockCards.map((card, i) => (
        <div key={i} style={{ padding: '20px 0', borderBottom: i < mockCards.length - 1 ? '1px solid #e8e0d8' : 'none' }}>
          <div style={{ fontSize: 10, color: '#8B4513', fontFamily: 'sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            {card.tag}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: '0 0 8px', lineHeight: 1.3 }}>{card.title}</h3>
          <p style={{ fontSize: 12, color: '#555', lineHeight: 1.6, margin: '0 0 12px', fontFamily: 'sans-serif' }}>{card.excerpt}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1a1a1a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontFamily: 'sans-serif', fontWeight: 700 }}>{card.initials}</div>
            <span style={{ fontSize: 11, color: '#777', fontFamily: 'sans-serif' }}>{card.author} · {card.readTime}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Concept B: Soft Spatial ───────────────────────────────────────────────────

const ConceptB: React.FC = () => (
  <div style={{ background: '#F5F0EA', fontFamily: "'Inter', sans-serif", borderRadius: 16, overflow: 'hidden', border: '1px solid #e0d8cc' }}>
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#FAF7F2', borderBottom: '1px solid #e0d8cc' }}>
      <span style={{ fontWeight: 800, fontSize: 16, color: '#2d2d2d' }}>PENORA</span>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6B7B6B', fontWeight: 500 }}>
        <span>Feed</span><span>Communities</span><span>Write</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={{ fontSize: 11, color: '#2d2d2d', background: 'none', border: 'none', cursor: 'pointer' }}>Login</button>
        <button style={{ fontSize: 11, background: '#6B7B6B', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>Sign up</button>
      </div>
    </nav>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 0 }}>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {mockCards.map((card, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #ede7de' }}>
            <span style={{ fontSize: 10, color: '#6B7B6B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{card.tag}</span>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#2d2d2d', margin: '6px 0', lineHeight: 1.4 }}>{card.title}</h3>
            <p style={{ fontSize: 11, color: '#777', lineHeight: 1.5, margin: '0 0 10px' }}>{card.excerpt}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#6B7B6B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700 }}>{card.initials}</div>
              <span style={{ fontSize: 10, color: '#999' }}>{card.author} · {card.readTime}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '16px 12px 16px 0', borderLeft: '1px solid #e0d8cc' }}>
        <div style={{ padding: 12, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #ede7de' }}>
          <h4 style={{ fontSize: 11, fontWeight: 700, color: '#2d2d2d', marginBottom: 8 }}>Trending Tags</h4>
          {['Technology', 'Culture', 'Productivity', 'Science'].map(t => (
            <div key={t} style={{ fontSize: 10, color: '#6B7B6B', padding: '4px 0', borderBottom: '1px solid #f0ebe3', fontWeight: 500 }}>#{t}</div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ─── Concept C: Modern Social ──────────────────────────────────────────────────

const ConceptC: React.FC = () => (
  <div style={{ background: '#FAFAF8', fontFamily: "'Inter', sans-serif", borderRadius: 16, overflow: 'hidden', border: '1px solid #e0ddd8' }}>
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#1C1C1E', borderBottom: '1px solid #2c2c2e' }}>
      <span style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>PENORA</span>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#aaa', fontWeight: 500 }}>
        <span style={{ color: '#D4813A', fontWeight: 700 }}>Feed</span>
        <span>Communities</span>
        <span>Write</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={{ fontSize: 11, color: '#ccc', background: 'none', border: 'none', cursor: 'pointer' }}>Login</button>
        <button style={{ fontSize: 11, background: '#D4813A', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>Sign up</button>
      </div>
    </nav>
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 140px', minHeight: 280 }}>
      <div style={{ background: '#1C1C1E', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {['Home', 'Explore', 'Communities', 'Profile', 'Write'].map((item, i) => (
          <div key={item} style={{ padding: '8px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, color: i === 0 ? '#D4813A' : '#aaa', background: i === 0 ? 'rgba(212,129,58,0.1)' : 'none', cursor: 'pointer' }}>
            {item}
          </div>
        ))}
      </div>
      <div style={{ padding: '14px', borderLeft: '1px solid #2c2c2e', borderRight: '1px solid #e0ddd8', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mockCards.map((card, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #e8e5e0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#D4813A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{card.tag}</span>
              <span style={{ fontSize: 9, color: '#aaa' }}>{card.readTime}</span>
            </div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E', margin: '0 0 5px', lineHeight: 1.35 }}>{card.title}</h3>
            <p style={{ fontSize: 10, color: '#666', lineHeight: 1.5, margin: '0 0 8px' }}>{card.excerpt}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#D4813A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 800 }}>{card.initials}</div>
              <span style={{ fontSize: 9, color: '#888', fontWeight: 500 }}>{card.author}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 10px' }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: 12, border: '1px solid #e8e5e0', marginBottom: 10 }}>
          <h4 style={{ fontSize: 10, fontWeight: 800, color: '#1C1C1E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Trending</h4>
          {['#web3', '#productivity', '#ai', '#culture'].map(t => (
            <div key={t} style={{ fontSize: 10, color: '#D4813A', padding: '3px 0', fontWeight: 600 }}>{t}</div>
          ))}
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: 12, border: '1px solid #e8e5e0' }}>
          <h4 style={{ fontSize: 10, fontWeight: 800, color: '#1C1C1E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Top Creators</h4>
          {['Mateen F.', 'Jordan R.'].map((name, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: i === 0 ? '#D4813A' : '#6B7B6B', color: '#fff', fontSize: 7, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{name[0]}</div>
              <span style={{ fontSize: 10, color: '#555' }}>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ─── DesignLab ─────────────────────────────────────────────────────────────────

export const DesignLab: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 py-12">
    <div className="mb-8">
      <h1 className="font-serif text-4xl font-bold text-penora-cocoa tracking-tight">
        Design Lab — Choose a Direction
      </h1>
      <p className="text-penora-cocoa-muted mt-2 max-w-2xl text-sm">
        Review visual concepts for PENORA. Approve a direction before it is applied globally.
      </p>
      <div className="mt-4 p-4 rounded-2xl bg-[#1D2729] text-[#F8F9F8] flex items-center justify-between gap-4 flex-wrap shadow-md border border-[#3F8E80]/40">
        <div>
          <span className="px-2.5 py-0.5 rounded-full bg-[#3F8E80] text-white text-[10px] font-bold uppercase tracking-wider mr-2">
            Latest Candidate (V5)
          </span>
          <strong className="text-sm">PENORA V5 — Clean Spatial Glass + Balanced Motion</strong>
          <p className="text-xs text-[#DDE5E5] mt-0.5">
            85% clean editorial functionality + 15% spatial-glass polish, slim sticky header, and balanced motion tokens.
          </p>
        </div>
        <a
          href="/design-v5"
          className="px-4 py-2 rounded-full bg-[#3F8E80] hover:bg-[#2E6F64] text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
        >
          <span>Open Clean Spatial V5</span>
          <span>→</span>
        </a>
      </div>
      <div className="mt-3 p-4 rounded-2xl bg-[#263336] text-[#F8F9F8] flex items-center justify-between gap-4 flex-wrap">
        <div>
          <span className="px-2.5 py-0.5 rounded-full bg-[#4D9F91]/40 text-[#A7E8DF] text-[10px] font-bold uppercase tracking-wider mr-2">
            V4 Reference
          </span>
          <strong className="text-sm">PENORA Spatial Glass V4 — Showcase Candidate</strong>
          <p className="text-xs text-[#DDE5E5] mt-0.5">
            Full window shell with hero banner and docked liquid-glass authentication panel.
          </p>
        </div>
        <a
          href="/design-v4"
          className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
        >
          <span>Open V4 Candidate</span>
          <span>→</span>
        </a>
      </div>
      <div className="mt-3 p-4 rounded-2xl bg-stone-900/90 text-stone-100 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <span className="px-2 py-0.5 rounded-full bg-[#B45A2B] text-white text-[10px] font-bold uppercase tracking-wider mr-2">Earlier</span>
          <strong className="text-sm">Design V3 Full-Screen Interactive Proposal</strong>
          <p className="text-xs text-stone-400 mt-0.5">
            Combines Concept C's 3-column social layout, Concept A's editorial typography, and Concept B's subtle spatial depth.
          </p>
        </div>
        <a
          href="/design-v3"
          className="px-4 py-2 rounded-xl bg-[#B45A2B] hover:bg-[#9a4c23] text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
        >
          <span>Open V3 Preview</span>
          <span>→</span>
        </a>
      </div>
      <div className="mt-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs inline-block">
        ⚠️ None of these designs have been applied globally yet. Approve a direction first.
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Concept A */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-penora-cocoa text-white text-[10px] font-bold uppercase tracking-wider">A</span>
            <h2 className="font-serif text-xl font-bold text-penora-cocoa">Premium Editorial</h2>
          </div>
          <p className="text-xs text-penora-cocoa-muted leading-relaxed">
            Clean serif headings on white. No shadows, thin 1px borders, generous whitespace.
            Feels like a classic high-end literary journal. Muted terracotta accent.
          </p>
        </div>
        <ConceptA />
      </div>

      {/* Concept B */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-penora-cocoa text-white text-[10px] font-bold uppercase tracking-wider">B</span>
            <h2 className="font-serif text-xl font-bold text-penora-cocoa">Soft Spatial</h2>
          </div>
          <p className="text-xs text-penora-cocoa-muted leading-relaxed">
            Off-white warm canvas with soft card elevation. 2-column layout with sidebar.
            Restrained depth, warm sage green accent. Feels like <em>Notion</em> or Bear.
          </p>
        </div>
        <ConceptB />
      </div>

      {/* Concept C */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-penora-cocoa text-white text-[10px] font-bold uppercase tracking-wider">C</span>
            <h2 className="font-serif text-xl font-bold text-penora-cocoa">Modern Social</h2>
          </div>
          <p className="text-xs text-penora-cocoa-muted leading-relaxed">
            True 3-column: sidebar nav | feed | right panel. Charcoal header/sidebar, ivory content.
            Warm amber accent. Feels like <em>Readwise Reader</em> or Twitter.
          </p>
        </div>
        <ConceptC />
      </div>
    </div>
  </div>
);

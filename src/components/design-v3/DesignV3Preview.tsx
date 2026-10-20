// src/components/design-v3/DesignV3Preview.tsx
// PENORA Design V3 — Full-screen interactive proposal
// Combines: Concept C's 3-column social layout, Concept A's editorial typography,
// Concept B's subtle spatial elevation. Gender-neutral palette.
import React, { useState } from 'react';

// ─── Color Tokens ──────────────────────────────────────────────────────────────
const C = {
  // Surfaces
  pageBg: '#F4F1EC',       // warm stone ivory
  cardBg: '#FFFFFF',
  sidebarBg: '#1C1917',    // warm charcoal
  sidebarHover: '#292524',
  surfaceHover: '#F5F3EF',
  surfaceActive: '#EDEAE5',
  // Text
  textPrimary: '#1C1917',
  textSecondary: '#57534E',
  textMuted: '#A8A29E',
  textOnDark: '#F5F5F4',
  textOnDarkMuted: '#A8A29E',
  // Accents
  terracotta: '#B45A2B',
  terracottaLight: '#F5E6DC',
  sage: '#5C7A5C',
  sageLight: '#E8EFE8',
  sageMuted: '#6B8A6B',
  // Borders
  border: '#E7E5E4',
  borderLight: '#F0EEEA',
  borderDark: '#363331',
  // Misc
  white: '#FFFFFF',
  voteBg: '#F9F7F4',
};

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { icon: '◉', label: 'Home', active: true },
  { icon: '⊞', label: 'Explore', active: false },
  { icon: '✎', label: 'Write', active: false },
  { icon: '☆', label: 'Bookmarks', active: false },
  { icon: '⌂', label: 'Communities', active: false },
  { icon: '♫', label: 'Notifications', active: false },
];

const FEED_TABS = ['For You', 'Following', 'Latest', 'Top'];

const ARTICLES = [
  {
    id: 1,
    title: 'The Architecture of Slow Journalism in a Post-Algorithm World',
    excerpt: 'Why the best long-form writing lives outside the algorithm — and how independent publishing infrastructure can let it thrive without sacrificing discoverability or editorial integrity.',
    author: { name: 'Elena Rostova', handle: 'erostova', initials: 'ER', color: '#5C7A5C' },
    tag: 'Editorial Craft',
    readTime: '8 min',
    date: 'Oct 18',
    votes: 142,
    comments: 23,
    coverImage: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=800&q=80',
    hasImage: true,
  },
  {
    id: 2,
    title: 'Reputation Without Currency: Designing Non-Cash Value Systems for Creator Communities',
    excerpt: 'A deep investigation into how on-chain reputation can replace monetary incentives in creator communities without reproducing the same power dynamics that plague existing platforms.',
    author: { name: 'Marcus Chen', handle: 'marcus_chen', initials: 'MC', color: '#B45A2B' },
    tag: 'Systems Design',
    readTime: '12 min',
    date: 'Oct 17',
    votes: 89,
    comments: 41,
    hasImage: false,
  },
  {
    id: 3,
    title: 'The Lost Art of Typographic Rhythm in Digital Publishing',
    excerpt: 'How careful attention to measure, leading, and vertical rhythm transforms reading experiences — lessons from a century of print design applied to screens.',
    author: { name: 'Sophia Ross', handle: 's_ross', initials: 'SR', color: '#7B6B5C' },
    tag: 'Typography',
    readTime: '6 min',
    date: 'Oct 16',
    votes: 67,
    comments: 12,
    coverImage: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=800&q=80',
    hasImage: true,
  },
  {
    id: 4,
    title: 'Toward a Sovereign Creator Commons: Infrastructure for Independent Publishing',
    excerpt: 'Building censorship-resistant publishing tools that give creators real ownership over their audience relationships and content distribution.',
    author: { name: 'Tariq Malik', handle: 'tariq_m', initials: 'TM', color: '#5A6B7B' },
    tag: 'Open Protocols',
    readTime: '15 min',
    date: 'Oct 15',
    votes: 203,
    comments: 58,
    hasImage: false,
  },
];

const COMMUNITIES = [
  { name: 'Spatial Computing Alliance', members: '4.8K', tag: 'Technology', color: '#5C7A5C' },
  { name: 'Creator Commons & Curation', members: '3.9K', tag: 'Economics', color: '#B45A2B' },
  { name: 'Art of Typographic Craft', members: '2.7K', tag: 'Publishing', color: '#7B6B5C' },
];

const CREATORS = [
  { name: 'Elena Rostova', handle: '@erostova', rep: 82, initials: 'ER', color: '#5C7A5C' },
  { name: 'Marcus Chen', handle: '@marcus_chen', rep: 76, initials: 'MC', color: '#B45A2B' },
  { name: 'Sophia Ross', handle: '@s_ross', rep: 71, initials: 'SR', color: '#7B6B5C' },
  { name: 'Tariq Malik', handle: '@tariq_m', rep: 68, initials: 'TM', color: '#5A6B7B' },
];

const TRENDING_TAGS = [
  { name: 'Spatial Design', count: 342 },
  { name: 'Publishing Ethics', count: 218 },
  { name: 'Open Protocols', count: 176 },
  { name: 'Slow Journalism', count: 134 },
  { name: 'Governance', count: 98 },
];

// ─── Subcomponents ─────────────────────────────────────────────────────────────

/** Avatar circle with initials */
const Avatar: React.FC<{ initials: string; color: string; size?: number }> = ({
  initials, color, size = 36,
}) => (
  <div
    style={{
      width: size, height: size, borderRadius: '50%', backgroundColor: color,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 700, letterSpacing: '-0.02em', flexShrink: 0,
    }}
  >
    {initials}
  </div>
);

/** Vote button with subtle spatial lift */
const VoteButton: React.FC<{ count: number }> = ({ count }) => {
  const [voted, setVoted] = useState(false);
  return (
    <button
      onClick={() => setVoted(v => !v)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '8px 10px', borderRadius: 10,
        background: voted ? C.sageLight : C.voteBg,
        border: `1px solid ${voted ? C.sage : C.borderLight}`,
        color: voted ? C.sage : C.textMuted,
        cursor: 'pointer', transition: 'all 0.15s ease',
        fontSize: 11, fontWeight: 700, minWidth: 44,
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1, transform: voted ? 'translateY(-1px)' : 'none', transition: 'transform 0.15s ease' }}>▲</span>
      <span>{voted ? count + 1 : count}</span>
    </button>
  );
};

/** Tag pill */
const TagPill: React.FC<{ label: string; color?: string }> = ({ label, color }) => (
  <span style={{
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '3px 8px', borderRadius: 6,
    background: color ? `${color}15` : C.surfaceHover,
    color: color || C.textSecondary,
  }}>
    {label}
  </span>
);

// ─── Article Card ──────────────────────────────────────────────────────────────
const ArticleCard: React.FC<{ article: typeof ARTICLES[0] }> = ({ article }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.cardBg,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        padding: 0,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow 0.25s ease, transform 0.25s ease',
        boxShadow: hovered
          ? '0 8px 32px -8px rgba(28,25,23,0.10), 0 2px 8px -2px rgba(28,25,23,0.06)'
          : '0 1px 3px rgba(28,25,23,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Vote column */}
        <div style={{ padding: '20px 4px 20px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 22 }}>
          <VoteButton count={article.votes} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '20px 20px 20px 12px', minWidth: 0 }}>
          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Avatar initials={article.author.initials} color={article.author.color} size={24} />
            <span style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary }}>{article.author.name}</span>
            <span style={{ fontSize: 11, color: C.textMuted }}>·</span>
            <span style={{ fontSize: 11, color: C.textMuted }}>{article.date}</span>
            <span style={{ fontSize: 11, color: C.textMuted }}>·</span>
            <span style={{ fontSize: 11, color: C.textMuted }}>{article.readTime}</span>
            <div style={{ marginLeft: 'auto' }}>
              <TagPill label={article.tag} color={article.author.color} />
            </div>
          </div>

          {/* Title */}
          <h3 style={{
            fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
            fontSize: 18, fontWeight: 700, lineHeight: 1.38,
            color: C.textPrimary, margin: '0 0 8px 0',
            letterSpacing: '-0.01em',
          }}>
            {article.title}
          </h3>

          {/* Excerpt */}
          <p style={{
            fontSize: 13.5, lineHeight: 1.65, color: C.textSecondary,
            margin: '0 0 12px 0',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {article.excerpt}
          </p>

          {/* Footer actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: C.textMuted }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              💬 <span>{article.comments}</span>
            </span>
            <span style={{ cursor: 'pointer' }}>⤴ Share</span>
            <span style={{ cursor: 'pointer' }}>⊛ Save</span>
          </div>
        </div>

        {/* Cover image (if article has one) */}
        {article.hasImage && article.coverImage && (
          <div style={{
            width: 160, minHeight: 140, flexShrink: 0,
            borderLeft: `1px solid ${C.borderLight}`,
            overflow: 'hidden',
          }}>
            <img
              src={article.coverImage}
              alt=""
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transition: 'transform 0.4s ease',
                transform: hovered ? 'scale(1.04)' : 'scale(1)',
              }}
            />
          </div>
        )}
      </div>
    </article>
  );
};

// ─── Mobile Article Card ───────────────────────────────────────────────────────
const MobileArticleCard: React.FC<{ article: typeof ARTICLES[0] }> = ({ article }) => (
  <article style={{
    background: C.cardBg, borderRadius: 14, border: `1px solid ${C.border}`,
    padding: 16, boxShadow: '0 1px 3px rgba(28,25,23,0.04)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <Avatar initials={article.author.initials} color={article.author.color} size={22} />
      <span style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary }}>{article.author.name}</span>
      <span style={{ fontSize: 11, color: C.textMuted }}>{article.date}</span>
    </div>
    {article.hasImage && article.coverImage && (
      <img src={article.coverImage} alt="" style={{
        width: '100%', height: 140, objectFit: 'cover', borderRadius: 10, marginBottom: 10,
      }} />
    )}
    <h3 style={{
      fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700,
      lineHeight: 1.35, color: C.textPrimary, marginBottom: 6,
    }}>{article.title}</h3>
    <p style={{ fontSize: 13, lineHeight: 1.6, color: C.textSecondary, marginBottom: 10 }}>
      {article.excerpt.slice(0, 100)}…
    </p>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: C.textMuted }}>
      <span>▲ {article.votes}</span>
      <span>💬 {article.comments}</span>
      <TagPill label={article.tag} />
    </div>
  </article>
);

// ─── Sidebar Nav ───────────────────────────────────────────────────────────────
const SidebarNav: React.FC = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  return (
    <aside style={{
      width: 240, minHeight: '100vh', background: C.sidebarBg,
      display: 'flex', flexDirection: 'column',
      padding: '0', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${C.terracotta}, #8B4513)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(180,90,43,0.3)',
        }}>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 700, fontFamily: 'Georgia, serif' }}>P</span>
        </div>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: C.textOnDark, letterSpacing: '-0.02em' }}>
            PENORA
          </div>
          <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textOnDarkMuted, marginTop: -1 }}>
            Publishing Platform
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#292524', borderRadius: 10, padding: '8px 12px',
          border: `1px solid ${C.borderDark}`,
        }}>
          <span style={{ fontSize: 13, color: C.textOnDarkMuted }}>⌕</span>
          <span style={{ fontSize: 12, color: C.textOnDarkMuted }}>Search posts, creators…</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textOnDarkMuted, background: '#363331', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>⌘K</span>
        </div>
      </div>

      <div style={{ height: 1, background: C.borderDark, margin: '0 16px 8px' }} />

      {/* Nav items */}
      <nav style={{ padding: '0 10px', flex: 1 }}>
        {NAV_ITEMS.map((item, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              width: '100%', padding: '10px 12px', borderRadius: 10,
              background: activeIdx === i ? C.sidebarHover : 'transparent',
              border: 'none', cursor: 'pointer',
              color: activeIdx === i ? C.textOnDark : C.textOnDarkMuted,
              fontSize: 13, fontWeight: activeIdx === i ? 600 : 400,
              transition: 'all 0.12s ease', textAlign: 'left',
              marginBottom: 2,
            }}
          >
            <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{item.icon}</span>
            <span>{item.label}</span>
            {item.label === 'Notifications' && (
              <span style={{
                marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                background: C.terracotta, color: '#fff',
                padding: '1px 7px', borderRadius: 10,
              }}>3</span>
            )}
          </button>
        ))}
      </nav>

      {/* Write CTA */}
      <div style={{ padding: '12px 16px' }}>
        <button style={{
          width: '100%', padding: '11px 16px', borderRadius: 10,
          background: `linear-gradient(135deg, ${C.terracotta}, #C4673A)`,
          border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 2px 10px rgba(180,90,43,0.25)',
          transition: 'transform 0.12s ease, box-shadow 0.12s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span>✎</span> Write Article
        </button>
      </div>

      {/* User profile */}
      <div style={{
        padding: '12px 16px', borderTop: `1px solid ${C.borderDark}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Avatar initials="YU" color={C.sage} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.textOnDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Your Name</div>
          <div style={{ fontSize: 10, color: C.textOnDarkMuted }}>@username</div>
        </div>
        <span style={{ fontSize: 14, color: C.textOnDarkMuted, cursor: 'pointer' }}>⋯</span>
      </div>
    </aside>
  );
};

// ─── Right Panel ───────────────────────────────────────────────────────────────
const RightPanel: React.FC = () => (
  <aside style={{
    width: 300, flexShrink: 0, padding: '20px 0 20px 0',
    display: 'flex', flexDirection: 'column', gap: 16,
    position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
    paddingRight: 20,
  }}>
    {/* Trending Tags */}
    <section style={{
      background: C.cardBg, borderRadius: 14, border: `1px solid ${C.border}`,
      padding: 0, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(28,25,23,0.03)',
    }}>
      <div style={{
        padding: '14px 16px 10px', borderBottom: `1px solid ${C.borderLight}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Trending Topics</span>
        <span style={{ fontSize: 11, color: C.sage, fontWeight: 600, cursor: 'pointer' }}>See all →</span>
      </div>
      {TRENDING_TAGS.map((t, i) => (
        <div key={i} style={{
          padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: i < TRENDING_TAGS.length - 1 ? `1px solid ${C.borderLight}` : 'none',
          cursor: 'pointer', transition: 'background 0.1s ease',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHover)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{t.name}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{t.count} articles</div>
          </div>
          <span style={{ fontSize: 11, color: C.textMuted }}>#{i + 1}</span>
        </div>
      ))}
    </section>

    {/* Communities */}
    <section style={{
      background: C.cardBg, borderRadius: 14, border: `1px solid ${C.border}`,
      overflow: 'hidden', boxShadow: '0 1px 3px rgba(28,25,23,0.03)',
    }}>
      <div style={{
        padding: '14px 16px 10px', borderBottom: `1px solid ${C.borderLight}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Communities</span>
        <span style={{ fontSize: 11, color: C.sage, fontWeight: 600, cursor: 'pointer' }}>Browse →</span>
      </div>
      {COMMUNITIES.map((c, i) => (
        <div key={i} style={{
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: i < COMMUNITIES.length - 1 ? `1px solid ${C.borderLight}` : 'none',
          cursor: 'pointer', transition: 'background 0.1s ease',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHover)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: c.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0,
          }}>
            {c.name[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{c.members} members · {c.tag}</div>
          </div>
          <button style={{
            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
            background: C.sageLight, color: C.sage, border: 'none', cursor: 'pointer',
          }}>Join</button>
        </div>
      ))}
    </section>

    {/* Creator Suggestions */}
    <section style={{
      background: C.cardBg, borderRadius: 14, border: `1px solid ${C.border}`,
      overflow: 'hidden', boxShadow: '0 1px 3px rgba(28,25,23,0.03)',
    }}>
      <div style={{
        padding: '14px 16px 10px', borderBottom: `1px solid ${C.borderLight}`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>Creators to Follow</span>
      </div>
      {CREATORS.map((cr, i) => (
        <div key={i} style={{
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: i < CREATORS.length - 1 ? `1px solid ${C.borderLight}` : 'none',
          cursor: 'pointer', transition: 'background 0.1s ease',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHover)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Avatar initials={cr.initials} color={cr.color} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{cr.name}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{cr.handle} · Rep {cr.rep}</div>
          </div>
          <button style={{
            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
            background: 'transparent', color: C.terracotta, border: `1px solid ${C.terracotta}40`,
            cursor: 'pointer', transition: 'all 0.1s ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = C.terracottaLight; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >Follow</button>
        </div>
      ))}
    </section>

    {/* Footer text */}
    <div style={{ padding: '8px 0', fontSize: 10, color: C.textMuted, lineHeight: 1.6 }}>
      PENORA Design V3 Proposal · Not applied globally · Awaiting approval
    </div>
  </aside>
);

// ─── Main Page ─────────────────────────────────────────────────────────────────
export const DesignV3Preview: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [isMobileView, setIsMobileView] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: C.pageBg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif' }}>
      {/* Mobile/Desktop toggle */}
      <div style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 100,
        display: 'flex', gap: 4, background: C.sidebarBg, padding: 4, borderRadius: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      }}>
        {['Desktop', 'Mobile'].map((label, i) => (
          <button key={label} onClick={() => setIsMobileView(i === 1)} style={{
            padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 600,
            background: (i === 0 ? !isMobileView : isMobileView) ? C.sidebarHover : 'transparent',
            color: (i === 0 ? !isMobileView : isMobileView) ? '#fff' : C.textOnDarkMuted,
          }}>{label}</button>
        ))}
      </div>

      {/* Proposal banner */}
      <div style={{
        background: C.sidebarBg, color: C.textOnDark, padding: '10px 20px',
        fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${C.borderDark}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: C.terracotta, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>V3 PROPOSAL</span>
          <span style={{ color: C.textOnDarkMuted }}>PENORA Design V3 — Full interactive preview. Not applied globally.</span>
        </div>
        <a href="/design-lab" style={{ color: C.sage, fontWeight: 600, textDecoration: 'none', fontSize: 11 }}>← Back to Design Lab</a>
      </div>

      {/* Mobile view */}
      {isMobileView ? (
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 0 40px' }}>
          {/* Mobile header */}
          <header style={{
            background: C.cardBg, padding: '12px 16px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            position: 'sticky', top: 0, zIndex: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: `linear-gradient(135deg, ${C.terracotta}, #8B4513)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 700,
              }}>P</div>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: C.textPrimary }}>PENORA</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 16, color: C.textMuted, cursor: 'pointer' }}>⌕</span>
              <Avatar initials="YU" color={C.sage} size={28} />
            </div>
          </header>

          {/* Mobile tabs */}
          <div style={{
            display: 'flex', gap: 0, padding: '0 16px',
            background: C.cardBg, borderBottom: `1px solid ${C.border}`,
          }}>
            {FEED_TABS.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)} style={{
                padding: '12px 14px', fontSize: 12, fontWeight: activeTab === i ? 700 : 400,
                color: activeTab === i ? C.terracotta : C.textMuted,
                borderBottom: activeTab === i ? `2px solid ${C.terracotta}` : '2px solid transparent',
                background: 'none', border: 'none', cursor: 'pointer',
              }}>{tab}</button>
            ))}
          </div>

          {/* Mobile feed */}
          <div style={{ padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ARTICLES.map(a => <MobileArticleCard key={a.id} article={a} />)}
          </div>
        </div>
      ) : (
        /* Desktop layout */
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 36px)' }}>
          {/* Left sidebar */}
          <SidebarNav />

          {/* Main feed column */}
          <main style={{
            flex: 1, minWidth: 0,
            padding: '20px 24px',
            maxWidth: 720,
          }}>
            {/* Feed header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 20,
            }}>
              <h1 style={{
                fontFamily: 'Georgia, Cambria, serif', fontSize: 24,
                fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.02em',
                margin: 0,
              }}>
                Your Feed
              </h1>
            </div>

            {/* Feed tabs */}
            <div style={{
              display: 'flex', gap: 0, marginBottom: 20,
              borderBottom: `1px solid ${C.border}`,
            }}>
              {FEED_TABS.map((tab, i) => (
                <button key={tab} onClick={() => setActiveTab(i)} style={{
                  padding: '10px 18px', fontSize: 13,
                  fontWeight: activeTab === i ? 600 : 400,
                  color: activeTab === i ? C.terracotta : C.textMuted,
                  borderBottom: activeTab === i ? `2px solid ${C.terracotta}` : '2px solid transparent',
                  background: 'none', border: 'none', borderRadius: 0,
                  cursor: 'pointer', transition: 'color 0.1s ease',
                  marginBottom: -1,
                }}>{tab}</button>
              ))}
            </div>

            {/* Article cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ARTICLES.map(a => <ArticleCard key={a.id} article={a} />)}
            </div>

            {/* Load more */}
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <button style={{
                padding: '10px 28px', borderRadius: 10,
                background: 'transparent', border: `1px solid ${C.border}`,
                color: C.textSecondary, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.1s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHover; e.currentTarget.style.borderColor = C.textMuted; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.border; }}
              >Load more articles</button>
            </div>
          </main>

          {/* Right panel */}
          <RightPanel />
        </div>
      )}
    </div>
  );
};

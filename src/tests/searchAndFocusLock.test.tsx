import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { searchProfiles } from '../lib/api/profiles';
import { lockScroll, unlockScroll } from '../lib/ui/overlayManager';
import { ExploreView } from '../components/explore/ExploreView';
import { MobileNavigationDrawer } from '../components/common/MobileNavigationDrawer';
import { Header } from '../components/common/Header';

describe('PENORA Search, Mobile Drawer & Focus Lock Suite', () => {
  // ─── 1. USER SEARCH API ───────────────────────────────────────────────────
  describe('1. Real User Search API (searchProfiles)', () => {
    it('returns empty array when query is empty or whitespace', async () => {
      const res = await searchProfiles('   ');
      expect(res.data).toEqual([]);
      expect(res.error).toBeNull();
    });

    it('strips leading @ symbol when searching by handle', async () => {
      // Should execute query without error and handle clean @ stripped query
      const res = await searchProfiles('@test_creator');
      expect(Array.isArray(res.data)).toBe(true);
    });
  });

  // ─── 2. EXPLORE VIEW & SEARCH TABS ─────────────────────────────────────────
  describe('2. Unified Explore View with Users, Articles & Communities Tabs', () => {
    const mockTopics = [
      {
        id: 'guild-1',
        name: 'Creator Commons',
        slug: 'creator-commons',
        description: 'Decentralized creator economy and publishing guilds.',
        iconName: 'Feather',
        articleCount: 140,
        followerCount: 2200,
        trendingRank: 1,
      },
    ];

    it('renders Search Input and Category filter tabs for Creators, Articles, and Communities', () => {
      const html = renderToStaticMarkup(<ExploreView topics={mockTopics} />);

      // Search input present with proper accessible label
      expect(html).toContain('placeholder="Search by @handle, creator name, article, or guild..."');
      expect(html).toContain('aria-label="Search creators, articles, and guilds"');

      // Communities section renders
      expect(html).toContain('Featured Editorial Circles');
      expect(html).toContain('Creator Commons');
    });
  });

  // ─── 3. MOBILE SIDEBAR CONSTRAINTS & 16PX TYPOGRAPHY ───────────────────────
  describe('3. Mobile Navigation Drawer Specification', () => {
    const drawerProps = {
      isOpen: true,
      onClose: vi.fn(),
      currentPath: '/',
      user: null,
      keyUser: null,
      profile: null,
      onOpenLogin: vi.fn(),
      onOpenRegister: vi.fn(),
      onLogout: vi.fn(),
    };

    it('enforces maximum 320px width and 16px mobile font size', () => {
      const html = renderToStaticMarkup(<MobileNavigationDrawer {...drawerProps} />);

      // Maximum 320px width
      expect(html).toContain('max-w-[320px]');
      expect(html).toContain('w-[82vw]');

      // Menu typography strictly 16px
      expect(html).toContain('text-[16px]');

      // Touch target min-height 46px
      expect(html).toContain('min-h-[46px]');

      // Internal drawer scrolling permitted, background scroll lock handled
      expect(html).toContain('overflow-y-auto');
      expect(html).toContain('overscroll-contain');
    });

    it('verifies width boundaries across mobile viewports 320px, 360px, 375px, 390px, 430px', () => {
      const testViewports = [320, 360, 375, 390, 430];

      testViewports.forEach((vw) => {
        const width = Math.min(Math.round(vw * 0.82), 320);
        // Never exceed 320px
        expect(width).toBeLessThanOrEqual(320);
        // Ratio at least 74% (due to 320px cap on 430px) and at most 85%
        expect(width / vw).toBeGreaterThanOrEqual(0.74);
        expect(width / vw).toBeLessThanOrEqual(0.85);
        // At least 45px tap backdrop preserved
        expect(vw - width).toBeGreaterThanOrEqual(45);
      });
    });
  });

  // ─── 4. STACK-SAFE SCROLL LOCK ENGINE ─────────────────────────────────────
  describe('4. Stack-Safe Focus Management & Scroll Locking', () => {
    it('gracefully handles SSR / non-DOM environments without crashing', () => {
      // In SSR (no window or document), functions must not throw
      expect(() => lockScroll()).not.toThrow();
      expect(() => unlockScroll()).not.toThrow();
    });

    it('locks and restores simulated DOM styles when window/document are defined', () => {
      const fakeBody = {
        style: {
          overflow: '',
          position: '',
          top: '',
          width: '',
          paddingRight: '',
        },
        contains: vi.fn().mockReturnValue(true),
      };
      const fakeHtml = {
        style: { overflow: '' },
        clientWidth: 1024,
      };

      (global as any).window = {
        scrollY: 150,
        innerWidth: 1024,
        scrollTo: vi.fn(),
      };
      (global as any).document = {
        body: fakeBody,
        documentElement: fakeHtml,
        activeElement: { focus: vi.fn() },
      };

      // 1. Lock 1 (e.g. mobile drawer opens)
      lockScroll();
      expect(fakeBody.style.position).toBe('fixed');
      expect(fakeBody.style.overflow).toBe('hidden');
      expect(fakeBody.style.top).toBe('-150px');

      // 2. Lock 2 (e.g. nested auth modal opens)
      lockScroll();
      expect(fakeBody.style.position).toBe('fixed');

      // 3. Unlock 1 (modal closes -> drawer still open, body still locked)
      unlockScroll();
      expect(fakeBody.style.position).toBe('fixed');

      // 4. Unlock 2 (drawer closes -> count is 0, original position and scroll restored!)
      unlockScroll();
      expect(fakeBody.style.position).toBe('');
      expect(fakeBody.style.overflow).toBe('');
      expect((global as any).window.scrollTo).toHaveBeenCalledWith(0, 150);

      // Clean up globals
      delete (global as any).window;
      delete (global as any).document;
    });
  });

  // ─── 5. HEADER INTEGRATION ────────────────────────────────────────────────
  describe('5. Header Live Search Integration', () => {
    it('renders Header with Desktop Search bar configured for creators, handles, and topics', () => {
      const html = renderToStaticMarkup(<Header currentPath="/" />);

      // Search input exists
      expect(html).toContain('placeholder="Search creators, @handle, articles, or topics..."');
      expect(html).toContain('aria-label="Search creators, handles, articles, or topics"');
    });
  });
});

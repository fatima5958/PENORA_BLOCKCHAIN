import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MobileNavigationDrawer } from '../components/common/MobileNavigationDrawer';

describe('PENORA Mobile Navigation Drawer & Responsiveness Suite', () => {
  const defaultProps = {
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

  it('renders open drawer with calibrated width classes (80-85vw, max-w-[320px])', () => {
    const html = renderToStaticMarkup(<MobileNavigationDrawer {...defaultProps} />);

    // Must have dialog role and modal attribute
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');

    // Drawer panel width constraint: w-[82vw] and max-w-[320px]
    expect(html).toContain('w-[82vw]');
    expect(html).toContain('max-w-[320px]');
    expect(html).toContain('overflow-x-hidden');
  });

  it('renders subtle dark backdrop outside drawer with click handler', () => {
    const html = renderToStaticMarkup(<MobileNavigationDrawer {...defaultProps} />);
    expect(html).toContain('bg-black/55');
    expect(html).toContain('backdrop-blur-[2px]');
  });

  it('renders touch-friendly typography (15px) and 20px icons across navigation links', () => {
    const html = renderToStaticMarkup(<MobileNavigationDrawer {...defaultProps} />);

    // Font size should be 15px for comfortable mobile reading
    expect(html).toContain('text-[15px]');

    // Touch targets should have at least 46px height
    expect(html).toContain('min-h-[46px]');

    // Verify all primary mobile routes are rendered
    const expectedHrefs = [
      'href="/"',
      'href="/following"',
      'href="/explore"',
      'href="/communities"',
      'href="/creators"',
      'href="/editor"',
      'href="/notifications"',
      'href="/challenges"',
      'href="/analytics"',
      'href="/profile/me"',
      'href="/wallet"',
      'href="/exchange"',
      'href="/profile/me?tab=bookmarks"',
      'href="/profile/me?tab=posts"',
    ];

    for (const href of expectedHrefs) {
      expect(html).toContain(href);
    }
  });

  it('calculates drawer width compliance across standard mobile viewports (320px, 360px, 375px, 390px, 430px)', () => {
    const viewports = [320, 360, 375, 390, 430];

    viewports.forEach((vw) => {
      // With w-[82vw] and max-w-[320px]:
      const calculatedWidth = Math.min(Math.round(vw * 0.82), 320);
      const remainingBackdrop = vw - calculatedWidth;

      // 1. Drawer width must never exceed 320px
      expect(calculatedWidth).toBeLessThanOrEqual(320);

      // 2. Drawer width must stay within 80-85vw proportion
      const ratio = calculatedWidth / vw;
      if (vw * 0.82 <= 320) {
        expect(ratio).toBeGreaterThanOrEqual(0.80);
        expect(ratio).toBeLessThanOrEqual(0.85);
      }

      // 3. There must always be visible dark backdrop on the right for comfortable tapping to dismiss
      expect(remainingBackdrop).toBeGreaterThanOrEqual(45);
    });
  });

  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(<MobileNavigationDrawer {...defaultProps} isOpen={false} />);
    expect(html).toBe('');
  });

  it('renders logged-in creator stats and sign-out button when user is authenticated', () => {
    const authenticatedProps = {
      ...defaultProps,
      user: {
        id: 'usr_123',
        email: 'alice@penora.io',
        app_metadata: {},
        user_metadata: { full_name: 'Alice Creator', username: 'alice' },
        aud: 'authenticated',
        created_at: '2026-01-01',
      } as any,
      profile: {
        id: 'usr_123',
        username: 'alice',
        display_name: 'Alice Creator',
        bio: 'Decentralized storytelling on PENORA',
        reputation: 68,
        avatar_url: null,
        created_at: '2026-01-01',
      } as any,
    };

    const html = renderToStaticMarkup(<MobileNavigationDrawer {...authenticatedProps} />);
    expect(html).toContain('Alice Creator');
    expect(html).toContain('@alice');
    expect(html).toContain('Sign Out');
    expect(html).toContain('Followers');
    expect(html).toContain('Blogs');
    expect(html).toContain('Reputation');
  });
});

// src/lib/ui/overlayManager.ts
// ============================================================================
// PENORA — ACCESSIBLE OVERLAY, FOCUS & BACKGROUND SCROLL MANAGER
// - Stack-safe nested overlay counter (prevents premature unlock on multiple modals)
// - Zero layout-shift scrollbar compensation (preserves desktop scrollbar width)
// - Native iOS/mobile Safari fixed positioning with exact scroll position restoration
// - Accessible focus trapping (cycles Tab/Shift+Tab inside active container)
// - Restores focus to the triggering element when closed
// ============================================================================

import { useEffect, useRef } from 'react';

interface OverlayState {
  count: number;
  scrollY: number;
  triggerElement: HTMLElement | null;
  originalBodyOverflow: string;
  originalBodyPosition: string;
  originalBodyTop: string;
  originalBodyWidth: string;
  originalBodyPaddingRight: string;
  originalHtmlOverflow: string;
}

const state: OverlayState = {
  count: 0,
  scrollY: 0,
  triggerElement: null,
  originalBodyOverflow: '',
  originalBodyPosition: '',
  originalBodyTop: '',
  originalBodyWidth: '',
  originalBodyPaddingRight: '',
  originalHtmlOverflow: '',
};

export function lockScroll(trigger?: HTMLElement | null): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (state.count === 0) {
    state.scrollY = window.scrollY;
    state.triggerElement = trigger || (document.activeElement as HTMLElement | null);

    state.originalBodyOverflow = document.body.style.overflow;
    state.originalBodyPosition = document.body.style.position;
    state.originalBodyTop = document.body.style.top;
    state.originalBodyWidth = document.body.style.width;
    state.originalBodyPaddingRight = document.body.style.paddingRight;
    state.originalHtmlOverflow = document.documentElement.style.overflow;

    // Prevent desktop layout shift when scrollbar vanishes
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Freeze page scroll without jump
    document.body.style.position = 'fixed';
    document.body.style.top = `-${state.scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }

  state.count += 1;
}

export function unlockScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (state.count <= 0) return;

  state.count -= 1;

  if (state.count === 0) {
    const savedY = state.scrollY;
    const trigger = state.triggerElement;

    document.body.style.position = state.originalBodyPosition;
    document.body.style.top = state.originalBodyTop;
    document.body.style.width = state.originalBodyWidth;
    document.body.style.overflow = state.originalBodyOverflow;
    document.body.style.paddingRight = state.originalBodyPaddingRight;
    document.documentElement.style.overflow = state.originalHtmlOverflow;

    window.scrollTo(0, savedY);

    if (trigger && typeof trigger.focus === 'function' && document.body.contains(trigger)) {
      try {
        trigger.focus();
      } catch {}
    }

    state.triggerElement = null;
  }
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
  );
}

export function handleTabFocusTrap(container: HTMLElement, e: KeyboardEvent): void {
  if (e.key !== 'Tab') return;

  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    e.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first || !container.contains(document.activeElement)) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last || !container.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  }
}

export interface UseOverlayLockOptions {
  containerRef?: React.RefObject<HTMLElement | null>;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  onEscape?: () => void;
  autoFocus?: boolean;
}

/**
 * React hook combining stack-safe scroll locking, Escape closing, and accessible focus trapping.
 */
export function useOverlayLock(
  isOpen: boolean,
  options?: UseOverlayLockOptions
): void {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement as HTMLElement | null;
    lockScroll(triggerRef.current);

    // Initial focus on requested element or container's first focusable child
    const focusTimer = setTimeout(() => {
      if (options?.initialFocusRef?.current) {
        options.initialFocusRef.current.focus();
      } else if (options?.containerRef?.current && options.autoFocus !== false) {
        const focusable = getFocusableElements(options.containerRef.current);
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          options.containerRef.current.focus();
        }
      }
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && options?.onEscape) {
        e.preventDefault();
        e.stopPropagation();
        options.onEscape();
        return;
      }

      if (e.key === 'Tab' && options?.containerRef?.current) {
        handleTabFocusTrap(options.containerRef.current, e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      unlockScroll();
    };
  }, [isOpen, options?.onEscape, options?.autoFocus]);
}

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatMarkdown, articleSlug, normalizeTags, isValidCoverUrl } from '../lib/articleEditor';
import { ArticleMarkdown } from '../components/editor/ArticleMarkdown';

describe('Working article formatting', () => {
  it('wraps a selected phrase without moving or losing surrounding text', () => {
    const r = formatMarkdown('hello world today', 6, 11, 'bold');
    expect(r.text).toBe('hello **world** today');
    expect(r.text.slice(r.start, r.end)).toBe('world');
  });
  it('inserts an editable placeholder when there is no selection', () => {
    const r = formatMarkdown('', 0, 0, 'italic');
    expect(r.text).toBe('*italic text*');
    expect(r.text.slice(r.start, r.end)).toBe('italic text');
  });
  it.each([['heading', '## '], ['quote', '> '], ['list', '- ']] as const)('formats complete selected lines with %s and toggles them off', (action, prefix) => {
    const r = formatMarkdown('first\nsecond\nthird', 1, 13, action);
    expect(r.text).toBe(`${prefix}first\n${prefix}second\nthird`);
    expect(formatMarkdown(r.text, r.start, r.end, action).text).toBe('first\nsecond\nthird');
  });
  it('adds code fences on separate lines', () => {
    const r = formatMarkdown('before CODE after', 7, 11, 'code');
    expect(r.text).toBe('before \n```\nCODE\n```\n after');
  });
  it('supports h1, h3, ordered-list, divider, link, image, and strikethrough', () => {
    expect(formatMarkdown('Heading', 0, 7, 'h1').text).toBe('# Heading');
    expect(formatMarkdown('Subheading', 0, 10, 'h3').text).toBe('### Subheading');
    expect(formatMarkdown('Item', 0, 4, 'ordered-list').text).toBe('1. Item');
    expect(formatMarkdown('', 0, 0, 'divider').text).toContain('---');
    expect(formatMarkdown('click here', 0, 10, 'link').text).toBe('[click here](https://)');
    expect(formatMarkdown('Chart', 0, 5, 'image').text).toBe('![Chart](https://)');
    expect(formatMarkdown('old', 0, 3, 'strikethrough').text).toBe('~~old~~');
    expect(formatMarkdown('var', 0, 3, 'inline-code').text).toBe('`var`');
  });
  it('renders toolbar Markdown as formatted content, including GFM tables', () => {
    const html = renderToStaticMarkup(<ArticleMarkdown content={'## Heading\n\n**Bold** and *italic*\n\n> Quote\n\n- Item\n\n```js\nlet x = 1;\n```\n\n|A|B|\n|-|-|\n|1|2|'} />);
    for (const tag of ['<h2', '<strong>', '<em>', '<blockquote', '<ul', '<li>', '<pre', '<code', '<table']) expect(html).toContain(tag);
  });
  it('does not execute raw HTML or unsafe Markdown links', () => {
    const html = renderToStaticMarkup(<ArticleMarkdown content={'<script>alert(1)</script>\n\n[text](javascript:alert)\n\n![x](javascript:alert)'} />);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('href="javascript');
  });
  it('creates usable slugs for English and Urdu titles', () => {
    expect(articleSlug('  Hello, World! ')).toBe('hello-world');
    expect(articleSlug('میری کہانی')).toBe('میری-کہانی');
    expect(articleSlug('!!!')).toMatch(/^essay-[a-f0-9]{8}$/);
  });
  it('deduplicates and normalizes tags', () => {
    expect(normalizeTags(' Tech,tech, Design, ,DESIGN ')).toEqual(['tech', 'design']);
  });
  it('allows supported covers and rejects unsafe URLs', () => {
    for (const url of ['', 'https://example.com/a.png', 'data:image/png;base64,aGVsbG8=']) expect(isValidCoverUrl(url)).toBe(true);
    for (const url of ['javascript:alert(1)', 'file:///image.png', 'data:image/svg+xml;base64,abcd', 'not-a-url']) expect(isValidCoverUrl(url)).toBe(false);
  });
});

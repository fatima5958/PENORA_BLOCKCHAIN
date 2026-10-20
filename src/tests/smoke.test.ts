import { describe, it, expect } from 'vitest';
import { MOCK_ARTICLES, MOCK_TOPICS, MOCK_COMMUNITIES } from '../data/mockArticles';
import { castVote, getVotesForPost } from '../lib/api/votes';
import tailwindConfig from '../../tailwind.config.mjs';

describe('PENORA Phase 1 Smoke Test Suite', () => {
  it('validates mock articles data schema, SEO slugs, and zero hardcoded vote counts', () => {
    expect(MOCK_ARTICLES.length).toBeGreaterThan(0);

    for (const article of MOCK_ARTICLES) {
      expect(article.id).toBeDefined();
      expect(article.slug).toMatch(/^[a-z0-9-]+$/);
      expect(article.title.length).toBeGreaterThan(5);
      expect(article.author.name).toBeDefined();
      expect(article.author.reputationScore).toBeGreaterThanOrEqual(0);
      expect(article.author.reputationScore).toBeLessThanOrEqual(100);
      expect(article.stats.reputationPoints).toBeGreaterThanOrEqual(0);
      expect(article.stats.votesCount).toBe(0);
      expect(article.stats.userHasVoted).toBe(false);
      expect(article.readTimeMinutes).toBeGreaterThan(0);
      expect(article.content.length).toBeGreaterThan(0);
    }
  });

  it('validates mock topics structure and member rankings', () => {
    expect(MOCK_TOPICS.length).toBeGreaterThan(0);

    for (const topic of MOCK_TOPICS) {
      expect(topic.id).toBeDefined();
      expect(topic.slug).toMatch(/^[a-z0-9-]+$/);
      expect(topic.followerCount).toBeGreaterThanOrEqual(0);
      expect(topic.articleCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('validates mock communities structure and subscribers', () => {
    expect(MOCK_COMMUNITIES.length).toBeGreaterThan(0);

    for (const comm of MOCK_COMMUNITIES) {
      expect(comm.id).toBeDefined();
      expect(comm.slug).toMatch(/^[a-z0-9-]+$/);
      expect(comm.name).toBeDefined();
      expect(comm.subscriberCount).toBeGreaterThan(0);
      expect(comm.activePostsCount).toBeGreaterThan(0);
    }
  });

  it('validates approved PENORA Blockchain brand color palette', () => {
    const extendColors = tailwindConfig.theme?.extend?.colors as Record<string, Record<string, string>>;
    const colors = extendColors?.penora;
    expect(colors).toBeDefined();
    // Approved PENORA Blockchain Palette: Deep Navy #0A2540, Dark Teal #007C8B, Bright Teal #00E5F4, Cool Alabaster #F4F7FA
    expect(colors!.navy.toLowerCase()).toBe('#0a2540');
    expect(colors!.teal.toLowerCase()).toBe('#007c8b');
    expect(colors!.bright.toLowerCase()).toBe('#00e5f4');
    expect(colors!.canvas.toLowerCase()).toBe('#f4f7fa');
  });

  it('enforces business safety: reputation points must not promise cash or financial returns', () => {
    const serializedArticles = JSON.stringify(MOCK_ARTICLES).toLowerCase();
    expect(serializedArticles).not.toContain('dollar');
    expect(serializedArticles).not.toContain('guaranteed income');
    expect(serializedArticles).not.toContain('crypto dividend');
    expect(serializedArticles).not.toContain('token sale');
  });

  it('validates Upvote ▲ and Downvote ▼ API contract and initial zero state', async () => {
    const initial = await getVotesForPost('test-post-1', 'voter-1');
    expect(initial.upvotes).toBe(0);
    expect(initial.downvotes).toBe(0);
    expect(initial.score).toBe(0);
    expect(initial.userVote).toBeNull();

    const validationErr = await castVote({ voter_id: 'voter-1', value: 1 });
    expect(validationErr.error).toContain('Vote must target either a post or a comment');
  });
});

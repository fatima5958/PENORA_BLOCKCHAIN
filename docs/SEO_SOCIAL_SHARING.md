# PENORA SEO & Social Sharing — implementation notes

## Included in this branch
- Canonical URL, absolute Open Graph/Twitter image URL, site name and configurable page type.
- No-index for login, signup, register, auth, settings, dashboard and wallet routes.
- Set `PUBLIC_SITE_URL` to the final canonical HTTPS origin before production deployment.

## Important limitation: creator post previews
The Astro layout only generates metadata known during server-side HTML generation. If a post title, cover or description is loaded only by a client-side React component, social crawlers will **not** see that per-post metadata. A client-side `document.title` update is insufficient.

Before claiming full article sharing support, implement public per-article HTML rendering or pre-rendered article pages with:
- A stable public URL for each article
- Real published article title, excerpt and public cover image fetched at render/build time
- `type="article"` and article-specific `title`, `description`, `image` passed to BaseLayout
- Fallback to PENORA brand preview only if no public cover exists
- Exclusion of unpublished/private articles
- Appropriate HTML escaping, valid image URLs and stable canonical links
- Tests inspecting **raw HTML** from an anonymous request, not just browser-rendered DOM

## Validation checklist
1. `npm run lint` and `npm run build`.
2. Set `PUBLIC_SITE_URL` and inspect rendered raw HTML for homepage and auth pages.
3. Confirm `og:image` and `twitter:image` are absolute HTTPS URLs.
4. Confirm private routes include `robots=noindex,nofollow`.
5. Verify post previews against a real published article before announcing support.
6. Never publish an internal URL, draft text or private cover image in metadata.

No wallet, token, database, deployment or financial code is changed by this feature branch.

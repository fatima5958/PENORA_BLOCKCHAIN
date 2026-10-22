# Community creation

A verified Supabase account with reputation at least 65 can create a community from /communities/. The server derives the owner from auth.uid(), locks the profile while checking reputation and atomically creates the community, owner and first admin membership. Client supplied roles, identity and reputation are never accepted. Repeated submissions with the same request UUID and content return the existing community.

The migration 20261022154700_community_creation_reputation_gate.sql was applied to PENORA-Dev on 2026-10-22. Rollback-only production checks verified 64 is rejected, 65 and 66 are accepted, owner/admin records are correct, retries are idempotent, and direct inserts or client reputation elevation are rejected. All synthetic rows were rolled back. The migration also prevents profile recreation with a self-selected reputation and limits client community edits to display fields.

The public RPC is security invoker; its private implementation is security definer with an empty search path and authenticated-only execution. Existing ownership RLS continues to control updates. Key-only login has no verified Supabase session and cannot create until an authenticated identity is available.

Validation: 18 service unit tests, 33 isolated PostgreSQL checks, 15 browser contract checks, TypeScript and production build passed. The browser check uses a mock Supabase API; live database behavior was verified independently. Production security advisors retained pre-existing unrelated findings; no community creation warning was introduced.

Run unit tests with `npm test -- src/tests/communityCreation.test.ts`. Install @electric-sql/pglite 0.3.14 outside the repository and supply PGLITE_MODULE_PATH to scripts/check-community-creation.cjs. For browser checks, build the app, install Playwright 1.51.1 and Chromium headless shell outside the repository, then run `PLAYWRIGHT_MODULE_PATH=/path/to/playwright node scripts/check-community-ui.cjs`.

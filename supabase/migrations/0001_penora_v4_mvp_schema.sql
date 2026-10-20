-- ============================================================================
-- PENORA BLOCKCHAIN — CONSOLIDATED PRODUCTION MVP SCHEMA (V4.2)
-- Target Supabase Project: ssjdirzophcveisnubwj (PENORA-Dev)
--
-- This migration consolidates migrations 000-012 into a single, idempotent,
-- dependency-ordered schema file following Supabase Postgres Best Practices.
--
-- Security Guarantees:
-- 1. All public tables have Row-Level Security (RLS) ENABLED.
-- 2. Performance-optimized RLS using (select auth.uid()) subquery patterns.
-- 3. Explicit TO authenticated / TO anon role targeting.
-- 4. Cross-user isolation: users cannot update or delete other users' posts,
--    comments, votes, bookmarks, follows, profiles, or reputation.
-- 5. Community role integrity: community_memberships insert restricted to 'member';
--    community_owners insert protected against unauthorized hijacking.
-- 6. Foreign keys use ON DELETE CASCADE to prevent orphaned records.
-- 7. Automated profile creation trigger on auth.users with collision resilience.
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Privileged Internal Roles (Idempotent)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reputation_updater') THEN
    CREATE ROLE reputation_updater NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'community_owner_creator') THEN
    CREATE ROLE community_owner_creator NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO reputation_updater, community_owner_creator;

-- ----------------------------------------------------------------------------
-- 2. Table: public.profiles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  cover_url text,
  bio text,
  reputation integer NOT NULL DEFAULT 25,
  created_at timestamptz DEFAULT now()
);

-- Protect reputation from direct client modification
CREATE OR REPLACE FUNCTION public.prevent_reputation_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.reputation <> OLD.reputation THEN
    -- Check caller session role (definer role check avoided)
    IF NOT pg_has_role(session_user, 'reputation_updater', 'USAGE') THEN
      RAISE EXCEPTION 'Reputation column is read-only for client updates';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_reputation ON public.profiles;
CREATE TRIGGER trg_prevent_reputation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_reputation_change();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow read for everyone" ON public.profiles;
  DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.profiles;
  DROP POLICY IF EXISTS "Allow update for owner" ON public.profiles;
  DROP POLICY IF EXISTS "Allow delete for owner" ON public.profiles;
END $$;

CREATE POLICY "Allow read for everyone" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow insert for authenticated users" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Allow update for owner" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Allow delete for owner" ON public.profiles
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = id);

REVOKE UPDATE(reputation) ON public.profiles FROM public, authenticated, anon;
GRANT UPDATE(reputation) ON public.profiles TO reputation_updater;

-- ----------------------------------------------------------------------------
-- 3. Table: public.communities
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  avatar_url text,
  cover_url text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow read for everyone" ON public.communities;
  DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.communities;
  DROP POLICY IF EXISTS "Allow update for owner (moderator)" ON public.communities;
  DROP POLICY IF EXISTS "Allow delete for owner" ON public.communities;
END $$;

CREATE POLICY "Allow read for everyone" ON public.communities
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow insert for authenticated users" ON public.communities
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = created_by);

-- ----------------------------------------------------------------------------
-- 4. Table: public.community_owners
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_owners (
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (community_id, owner_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_community_owner ON public.community_owners (community_id);

ALTER TABLE public.community_owners ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow read for everyone" ON public.community_owners;
  DROP POLICY IF EXISTS "Allow insert for owner creation" ON public.community_owners;
  DROP POLICY IF EXISTS "Allow delete for owner" ON public.community_owners;
END $$;

CREATE POLICY "Allow read for everyone" ON public.community_owners
  FOR SELECT TO anon, authenticated USING (true);

-- Secure insert: strictly the creator of the community can insert initial owner record
CREATE POLICY "Allow insert for owner creation" ON public.community_owners
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = owner_id
    AND EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_id AND c.created_by = (select auth.uid())
    )
  );

CREATE POLICY "Allow delete for owner" ON public.community_owners
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = owner_id);

-- Attach update/delete policies to public.communities based on community_owners
CREATE POLICY "Allow update for owner (moderator)" ON public.communities
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_owners co
      WHERE co.community_id = public.communities.id AND co.owner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.community_owners co
      WHERE co.community_id = public.communities.id AND co.owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Allow delete for owner" ON public.communities
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_owners co
      WHERE co.community_id = public.communities.id AND co.owner_id = (select auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- 5. Table: public.community_memberships
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_memberships (
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  member_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (community_id, member_id)
);

ALTER TABLE public.community_memberships ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow read for everyone" ON public.community_memberships;
  DROP POLICY IF EXISTS "Allow insert for members" ON public.community_memberships;
  DROP POLICY IF EXISTS "Disallow updates" ON public.community_memberships;
  DROP POLICY IF EXISTS "Allow delete by owner" ON public.community_memberships;
END $$;

CREATE POLICY "Allow read for everyone" ON public.community_memberships
  FOR SELECT TO anon, authenticated USING (true);

-- Authenticated users can only join as 'member'; no self-elevation to admin/moderator
CREATE POLICY "Allow insert for members" ON public.community_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = member_id AND role = 'member'
  );

CREATE POLICY "Disallow updates" ON public.community_memberships
  FOR UPDATE TO authenticated USING (false);

CREATE POLICY "Allow delete by owner" ON public.community_memberships
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = member_id);

-- ----------------------------------------------------------------------------
-- 6. Table: public.posts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  content text NOT NULL,
  cover_image_url text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS posts_author_idx ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS posts_slug_idx ON public.posts (slug);
CREATE INDEX IF NOT EXISTS posts_published_idx ON public.posts (published, created_at DESC);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read of published posts" ON public.posts;
  DROP POLICY IF EXISTS "Owner read of own posts" ON public.posts;
  DROP POLICY IF EXISTS "Insert posts for authenticated users" ON public.posts;
  DROP POLICY IF EXISTS "Update own posts" ON public.posts;
  DROP POLICY IF EXISTS "Delete own posts" ON public.posts;
END $$;

CREATE POLICY "Public read of published posts" ON public.posts
  FOR SELECT TO anon, authenticated
  USING (published = true);

CREATE POLICY "Owner read of own posts" ON public.posts
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = author_id);

CREATE POLICY "Insert posts for authenticated users" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = author_id);

CREATE POLICY "Update own posts" ON public.posts
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = author_id)
  WITH CHECK ((select auth.uid()) = author_id);

CREATE POLICY "Delete own posts" ON public.posts
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = author_id);

-- ----------------------------------------------------------------------------
-- 7. Table: public.comments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_post_idx ON public.comments (post_id);
CREATE INDEX IF NOT EXISTS comments_author_idx ON public.comments (author_id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read of comments for published posts" ON public.comments;
  DROP POLICY IF EXISTS "Owner read of own comments" ON public.comments;
  DROP POLICY IF EXISTS "Insert comments for authenticated users" ON public.comments;
  DROP POLICY IF EXISTS "Update own comments" ON public.comments;
  DROP POLICY IF EXISTS "Delete own comments" ON public.comments;
END $$;

CREATE POLICY "Public read of comments for published posts" ON public.comments
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.posts p WHERE p.id = comments.post_id AND p.published = true)
  );

CREATE POLICY "Owner read of own comments" ON public.comments
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = author_id);

CREATE POLICY "Insert comments for authenticated users" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = author_id
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = comments.post_id
      AND (p.published = true OR p.author_id = (select auth.uid()))
    )
  );

CREATE POLICY "Update own comments" ON public.comments
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = author_id)
  WITH CHECK ((select auth.uid()) = author_id);

CREATE POLICY "Delete own comments" ON public.comments
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = author_id);

-- ----------------------------------------------------------------------------
-- 8. Table: public.votes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT votes_exactly_one_target CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS votes_unique_user_post ON public.votes (voter_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS votes_unique_user_comment ON public.votes (voter_id, comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS votes_post_idx ON public.votes (post_id);
CREATE INDEX IF NOT EXISTS votes_comment_idx ON public.votes (comment_id);

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read of votes on published posts" ON public.votes;
  DROP POLICY IF EXISTS "Public read of votes on comments" ON public.votes;
  DROP POLICY IF EXISTS "Allow read of own votes" ON public.votes;
  DROP POLICY IF EXISTS "Insert vote for authenticated users" ON public.votes;
  DROP POLICY IF EXISTS "Update own vote" ON public.votes;
  DROP POLICY IF EXISTS "Delete own vote" ON public.votes;
END $$;

CREATE POLICY "Public read of votes on published posts" ON public.votes
  FOR SELECT TO anon, authenticated
  USING (
    post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.posts p WHERE p.id = votes.post_id AND p.published = true
    )
  );

CREATE POLICY "Public read of votes on comments" ON public.votes
  FOR SELECT TO anon, authenticated
  USING (comment_id IS NOT NULL);

CREATE POLICY "Allow read of own votes" ON public.votes
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = voter_id);

CREATE POLICY "Insert vote for authenticated users" ON public.votes
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = voter_id
    AND (
      post_id IS NULL OR EXISTS (
        SELECT 1 FROM public.posts p WHERE p.id = votes.post_id AND p.published = true
      )
    )
    AND (
      comment_id IS NULL OR EXISTS (
        SELECT 1 FROM public.comments c WHERE c.id = votes.comment_id
      )
    )
  );

CREATE POLICY "Update own vote" ON public.votes
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = voter_id)
  WITH CHECK ((select auth.uid()) = voter_id);

CREATE POLICY "Delete own vote" ON public.votes
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = voter_id);

-- ----------------------------------------------------------------------------
-- 9. Table: public.follows
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  followee_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id)
);

CREATE OR REPLACE FUNCTION public.prevent_self_follow()
RETURNS trigger AS $$
BEGIN
  IF NEW.follower_id = NEW.followee_id THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_self_follow ON public.follows;
CREATE TRIGGER trg_prevent_self_follow
  BEFORE INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_follow();

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow read for everyone" ON public.follows;
  DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.follows;
  DROP POLICY IF EXISTS "Allow delete for owner" ON public.follows;
END $$;

CREATE POLICY "Allow read for everyone" ON public.follows
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow insert for authenticated users" ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = follower_id);

CREATE POLICY "Allow delete for owner" ON public.follows
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = follower_id);

-- ----------------------------------------------------------------------------
-- 10. Table: public.bookmarks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookmarks (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS bookmarks_user_idx ON public.bookmarks (user_id);
CREATE INDEX IF NOT EXISTS bookmarks_post_idx ON public.bookmarks (post_id);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow read of own bookmarks" ON public.bookmarks;
  DROP POLICY IF EXISTS "Allow bookmarking published posts" ON public.bookmarks;
  DROP POLICY IF EXISTS "Allow deleting own bookmarks" ON public.bookmarks;
END $$;

CREATE POLICY "Allow read of own bookmarks" ON public.bookmarks
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Allow bookmarking published posts" ON public.bookmarks
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = bookmarks.post_id AND p.published = true
    )
  );

CREATE POLICY "Allow deleting own bookmarks" ON public.bookmarks
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- 11. Automated Profile Creation Trigger on auth.users
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_username text;
  candidate_username text;
  counter integer := 0;
BEGIN
  -- Extract username from raw_user_meta_data or email prefix
  base_username := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'username'), ''),
    split_part(NEW.email, '@', 1)
  );
  -- Sanitize username: lowercase, alphanumeric and underscores only
  base_username := regexp_replace(lower(base_username), '[^a-z0-9_]', '', 'g');
  IF length(base_username) < 3 THEN
    base_username := 'creator';
  END IF;

  candidate_username := base_username;

  -- Resolve potential username collision safely
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate_username) LOOP
    counter := counter + 1;
    candidate_username := base_username || '_' || counter || '_' || substr(NEW.id::text, 1, 4);
    IF counter > 10 THEN
      candidate_username := base_username || '_' || substr(NEW.id::text, 1, 8);
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, avatar_url, reputation)
  VALUES (
    NEW.id,
    candidate_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    25
  )
  ON CONFLICT (id) DO UPDATE SET
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 12. Table: public.account_authorities (Steemit-Style Key Hierarchy)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_authorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  owner_public_key text NOT NULL,
  active_public_key text NOT NULL,
  posting_public_key text NOT NULL,
  memo_public_key text NOT NULL,
  key_version integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_owner_key CHECK (owner_public_key LIKE 'PEN%'),
  CONSTRAINT valid_active_key CHECK (active_public_key LIKE 'PEN%'),
  CONSTRAINT valid_posting_key CHECK (posting_public_key LIKE 'PEN%'),
  CONSTRAINT valid_memo_key CHECK (memo_public_key LIKE 'PEN%')
);

CREATE INDEX IF NOT EXISTS idx_account_authorities_account_id ON public.account_authorities (account_id);
CREATE INDEX IF NOT EXISTS idx_account_authorities_posting_key ON public.account_authorities (posting_public_key);
CREATE INDEX IF NOT EXISTS idx_account_authorities_active_key ON public.account_authorities (active_public_key);

ALTER TABLE public.account_authorities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read of public keys" ON public.account_authorities;
  DROP POLICY IF EXISTS "Insert authorities for account owner" ON public.account_authorities;
  DROP POLICY IF EXISTS "Disallow direct client key updates" ON public.account_authorities;
  DROP POLICY IF EXISTS "Disallow direct key deletion" ON public.account_authorities;
END $$;

-- Public keys are publicly readable for signature verification
CREATE POLICY "Public read of public keys" ON public.account_authorities
  FOR SELECT TO anon, authenticated USING (true);

-- Initial key registration bound strictly to authenticated account identity
CREATE POLICY "Insert authorities for account owner" ON public.account_authorities
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = account_id);

-- Key rotation requires owner authority and must be performed via audited RPC or admin broker
CREATE POLICY "Disallow direct client key updates" ON public.account_authorities
  FOR UPDATE TO authenticated USING (false);

CREATE POLICY "Disallow direct key deletion" ON public.account_authorities
  FOR DELETE TO authenticated USING (false);

-- ----------------------------------------------------------------------------
-- 13. Table: public.auth_challenges (Single-Use Replay Protection)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_challenges (
  id text PRIMARY KEY,
  username text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('login', 'recovery')),
  challenge text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_username ON public.auth_challenges (username);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires ON public.auth_challenges (expires_at);

ALTER TABLE public.auth_challenges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow challenge creation" ON public.auth_challenges;
  DROP POLICY IF EXISTS "Disallow client challenge updates" ON public.auth_challenges;
  DROP POLICY IF EXISTS "Disallow client challenge deletion" ON public.auth_challenges;
END $$;

CREATE POLICY "Allow challenge creation" ON public.auth_challenges
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Disallow client challenge updates" ON public.auth_challenges
  FOR UPDATE TO anon, authenticated USING (false);

CREATE POLICY "Disallow client challenge deletion" ON public.auth_challenges
  FOR DELETE TO anon, authenticated USING (false);

-- ----------------------------------------------------------------------------
-- 14. Privileged Function: Adjust User Reputation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_reputation(p_user uuid, p_delta int)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET reputation = reputation + p_delta
  WHERE id = p_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.adjust_reputation(uuid, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_reputation(uuid, int) TO reputation_updater;

-- ----------------------------------------------------------------------------
-- 15. Data API Grants for PostgREST
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
REVOKE UPDATE(reputation) ON public.profiles FROM authenticated, anon, public;

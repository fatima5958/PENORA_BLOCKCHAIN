-- supabase/migrations/20261023032500_phase1_social_foundation.sql
-- PENORA Phase 1: Social Foundation Migration
-- Implements Reblogs, Threaded Comments (parent_id), Mutes, Blocks, and Reports
-- Strictly additive with robust RLS policies and ownership checks.

-- 1. Threaded Comments: Add parent_id to comments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'comments' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.comments ADD COLUMN parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS comments_parent_idx ON public.comments (parent_id);

-- 2. Table: public.reblogs (Reblog / Repost)
CREATE TABLE IF NOT EXISTS public.reblogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS reblogs_user_idx ON public.reblogs (user_id);
CREATE INDEX IF NOT EXISTS reblogs_post_idx ON public.reblogs (post_id);

ALTER TABLE public.reblogs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read reblogs" ON public.reblogs;
  DROP POLICY IF EXISTS "Insert own reblogs" ON public.reblogs;
  DROP POLICY IF EXISTS "Delete own reblogs" ON public.reblogs;
END $$;

CREATE POLICY "Public read reblogs" ON public.reblogs
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Insert own reblogs" ON public.reblogs
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Delete own reblogs" ON public.reblogs
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- 3. Table: public.mutes (Mute creators and hide their content)
CREATE TABLE IF NOT EXISTS public.mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  muter_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  muted_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (muter_id, muted_id)
);

CREATE INDEX IF NOT EXISTS mutes_muter_idx ON public.mutes (muter_id);
CREATE INDEX IF NOT EXISTS mutes_muted_idx ON public.mutes (muted_id);

ALTER TABLE public.mutes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Owner read own mutes" ON public.mutes;
  DROP POLICY IF EXISTS "Owner insert own mutes" ON public.mutes;
  DROP POLICY IF EXISTS "Owner delete own mutes" ON public.mutes;
END $$;

CREATE POLICY "Owner read own mutes" ON public.mutes
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = muter_id);

CREATE POLICY "Owner insert own mutes" ON public.mutes
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = muter_id);

CREATE POLICY "Owner delete own mutes" ON public.mutes
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = muter_id);

-- 4. Table: public.blocks (Block unwanted interactions)
CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS blocks_blocker_idx ON public.blocks (blocker_id);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON public.blocks (blocked_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Owner read own blocks" ON public.blocks;
  DROP POLICY IF EXISTS "Owner insert own blocks" ON public.blocks;
  DROP POLICY IF EXISTS "Owner delete own blocks" ON public.blocks;
END $$;

CREATE POLICY "Owner read own blocks" ON public.blocks
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = blocker_id);

CREATE POLICY "Owner insert own blocks" ON public.blocks
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = blocker_id);

CREATE POLICY "Owner delete own blocks" ON public.blocks
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = blocker_id);

-- 5. Table: public.reports (Report blogs, comments, users)
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment', 'profile')),
  target_id text NOT NULL,
  reason text NOT NULL,
  details text,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS reports_reporter_idx ON public.reports (reporter_id);
CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Owner read own reports" ON public.reports;
  DROP POLICY IF EXISTS "Owner insert own reports" ON public.reports;
END $$;

CREATE POLICY "Owner read own reports" ON public.reports
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = reporter_id);

CREATE POLICY "Owner insert own reports" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = reporter_id);

-- supabase/migrations/20261023035500_phase4_creator_growth_v2.sql
-- PENORA Phase 4: Creator Growth V2 Migration
-- Implements writing challenges, submissions, genuine article views, and streak tracking.

-- 1. Writing Challenges Table
CREATE TABLE IF NOT EXISTS public.writing_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  prompt text NOT NULL,
  guidelines text NOT NULL,
  starts_at timestamptz DEFAULT now() NOT NULL,
  ends_at timestamptz NOT NULL,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('upcoming', 'active', 'completed')),
  cover_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS challenges_slug_idx ON public.writing_challenges (slug);
CREATE INDEX IF NOT EXISTS challenges_status_idx ON public.writing_challenges (status);

ALTER TABLE public.writing_challenges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read writing challenges" ON public.writing_challenges;
END $$;

CREATE POLICY "Public read writing challenges" ON public.writing_challenges
  FOR SELECT TO anon, authenticated
  USING (true);

-- 2. Challenge Submissions Table
CREATE TABLE IF NOT EXISTS public.challenge_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid REFERENCES public.writing_challenges(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  is_featured boolean DEFAULT false NOT NULL,
  submitted_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(challenge_id, post_id)
);

CREATE INDEX IF NOT EXISTS challenge_submissions_challenge_idx ON public.challenge_submissions (challenge_id);
CREATE INDEX IF NOT EXISTS challenge_submissions_author_idx ON public.challenge_submissions (author_id);

ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read submissions" ON public.challenge_submissions;
  DROP POLICY IF EXISTS "Authenticated submit own post" ON public.challenge_submissions;
END $$;

CREATE POLICY "Public read submissions" ON public.challenge_submissions
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated submit own post" ON public.challenge_submissions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = author_id);

-- 3. Article Views Table (Genuine readership sessions)
CREATE TABLE IF NOT EXISTS public.article_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  viewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS article_views_post_idx ON public.article_views (post_id);
CREATE INDEX IF NOT EXISTS article_views_created_at_idx ON public.article_views (created_at);

ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read article views" ON public.article_views;
  DROP POLICY IF EXISTS "Public record article views" ON public.article_views;
END $$;

CREATE POLICY "Public read article views" ON public.article_views
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Public record article views" ON public.article_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

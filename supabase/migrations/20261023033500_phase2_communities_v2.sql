-- supabase/migrations/20261023033500_phase2_communities_v2.sql
-- PENORA Phase 2: Communities V2 Migration
-- Implements community rules, covers, pinned posts, moderation hidden posts, audit logs, and role-based permissions.

-- 1. Extend public.communities with rules and cover_url
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'rules'
  ) THEN
    ALTER TABLE public.communities ADD COLUMN rules text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'cover_url'
  ) THEN
    ALTER TABLE public.communities ADD COLUMN cover_url text;
  END IF;
END $$;

-- 2. Pinned Posts Table
CREATE TABLE IF NOT EXISTS public.community_pinned_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  pinned_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  pinned_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(community_id, post_id)
);

CREATE INDEX IF NOT EXISTS pinned_posts_community_idx ON public.community_pinned_posts (community_id);
CREATE INDEX IF NOT EXISTS pinned_posts_post_idx ON public.community_pinned_posts (post_id);

ALTER TABLE public.community_pinned_posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read pinned posts" ON public.community_pinned_posts;
  DROP POLICY IF EXISTS "Leaders manage pinned posts" ON public.community_pinned_posts;
END $$;

CREATE POLICY "Public read pinned posts" ON public.community_pinned_posts
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Leaders manage pinned posts" ON public.community_pinned_posts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_memberships cm
      WHERE cm.community_id = public.community_pinned_posts.community_id
        AND cm.member_id = (select auth.uid())
        AND cm.role IN ('owner', 'admin', 'moderator')
    )
    OR EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = public.community_pinned_posts.community_id
        AND c.created_by = (select auth.uid())
    )
  );

-- 3. Hidden / Removed Posts in Community
CREATE TABLE IF NOT EXISTS public.community_hidden_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  hidden_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reason text NOT NULL,
  hidden_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(community_id, post_id)
);

CREATE INDEX IF NOT EXISTS hidden_posts_community_idx ON public.community_hidden_posts (community_id);

ALTER TABLE public.community_hidden_posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read hidden posts" ON public.community_hidden_posts;
  DROP POLICY IF EXISTS "Leaders manage hidden posts" ON public.community_hidden_posts;
END $$;

CREATE POLICY "Public read hidden posts" ON public.community_hidden_posts
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Leaders manage hidden posts" ON public.community_hidden_posts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_memberships cm
      WHERE cm.community_id = public.community_hidden_posts.community_id
        AND cm.member_id = (select auth.uid())
        AND cm.role IN ('owner', 'admin', 'moderator')
    )
    OR EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = public.community_hidden_posts.community_id
        AND c.created_by = (select auth.uid())
    )
  );

-- 4. Community Audit Logs Table
CREATE TABLE IF NOT EXISTS public.community_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  target_id text,
  details text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_community_idx ON public.community_audit_logs (community_id);

ALTER TABLE public.community_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Leaders read audit logs" ON public.community_audit_logs;
  DROP POLICY IF EXISTS "Authenticated insert audit logs" ON public.community_audit_logs;
END $$;

CREATE POLICY "Leaders read audit logs" ON public.community_audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_memberships cm
      WHERE cm.community_id = public.community_audit_logs.community_id
        AND cm.member_id = (select auth.uid())
        AND cm.role IN ('owner', 'admin', 'moderator')
    )
    OR EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = public.community_audit_logs.community_id
        AND c.created_by = (select auth.uid())
    )
  );

CREATE POLICY "Authenticated insert audit logs" ON public.community_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = actor_id);

-- supabase/migrations/20261023034500_phase3_reputation_v2.sql
-- PENORA Phase 3: Creator Reputation & Verified Achievements V2
-- Stores verified badges, progress milestones, and transparent reputation history.

-- 1. Table: public.creator_achievements
CREATE TABLE IF NOT EXISTS public.creator_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  badge_key text NOT NULL,
  awarded_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}' NOT NULL,
  UNIQUE(user_id, badge_key)
);

CREATE INDEX IF NOT EXISTS achievements_user_idx ON public.creator_achievements (user_id);
CREATE INDEX IF NOT EXISTS achievements_badge_idx ON public.creator_achievements (badge_key);

ALTER TABLE public.creator_achievements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read achievements" ON public.creator_achievements;
  DROP POLICY IF EXISTS "Authenticated insert verified achievements" ON public.creator_achievements;
END $$;

CREATE POLICY "Public read achievements" ON public.creator_achievements
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated insert verified achievements" ON public.creator_achievements
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- 2. Table: public.reputation_audit_history
CREATE TABLE IF NOT EXISTS public.reputation_audit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS reputation_history_user_idx ON public.reputation_audit_history (user_id);

ALTER TABLE public.reputation_audit_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read reputation history" ON public.reputation_audit_history;
  DROP POLICY IF EXISTS "Authenticated insert reputation history" ON public.reputation_audit_history;
END $$;

CREATE POLICY "Public read reputation history" ON public.reputation_audit_history
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated insert reputation history" ON public.reputation_audit_history
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

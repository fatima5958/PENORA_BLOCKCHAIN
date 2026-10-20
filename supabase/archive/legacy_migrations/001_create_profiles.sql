CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 001_create_profiles.sql
-- Table for user profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  username text NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  cover_url text,
  bio text,
  reputation integer NOT NULL DEFAULT 25,
  created_at timestamp with time zone DEFAULT now()
);

-- Prevent direct reputation manipulation via trigger
CREATE OR REPLACE FUNCTION public.prevent_reputation_change()
RETURNS trigger AS $$
BEGIN
  -- Allow changes only when the caller has the reputation_updater role (service‑side)
  IF NEW.reputation <> OLD.reputation AND NOT pg_has_role('reputation_updater', 'USAGE') THEN
    RAISE EXCEPTION 'Reputation column is read‑only for client updates';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_reputation ON public.profiles;
CREATE TRIGGER trg_prevent_reputation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_reputation_change();

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Revoke direct client updates to privileged columns
REVOKE UPDATE(reputation) ON public.profiles FROM public;
GRANT UPDATE(reputation) ON public.profiles TO reputation_updater;

-- Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow read for everyone" ON public.profiles;
  DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.profiles;
  DROP POLICY IF EXISTS "Allow update for owner" ON public.profiles;
  DROP POLICY IF EXISTS "Allow delete for owner" ON public.profiles;
END $$;

CREATE POLICY "Allow read for everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Allow insert for authenticated users" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow update for owner" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow delete for owner" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

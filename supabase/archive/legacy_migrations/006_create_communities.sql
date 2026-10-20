-- 006_create_communities.sql
-- Table for communities (public groups)
CREATE TABLE IF NOT EXISTS public.communities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  avatar_url text,
  cover_url text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow read for everyone" ON public.communities;
  DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.communities;
END $$;

CREATE POLICY "Allow read for everyone" ON public.communities
  FOR SELECT USING (true);

CREATE POLICY "Allow insert for authenticated users" ON public.communities
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

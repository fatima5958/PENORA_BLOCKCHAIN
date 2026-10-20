-- 007_fix_community_owners.sql
-- Fixed ordering: creates owners after communities exist and adds proper RLS.

CREATE TABLE IF NOT EXISTS public.community_owners (
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  owner_id uuid REFERENCES public.profiles(id) NOT NULL,
  PRIMARY KEY (community_id, owner_id)
);

-- One owner per community (can be extended later)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_community_owner ON public.community_owners (community_id);

ALTER TABLE public.community_owners ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow read for everyone" ON public.community_owners;
  DROP POLICY IF EXISTS "Allow insert for owner creation" ON public.community_owners;
  DROP POLICY IF EXISTS "Allow delete for owner" ON public.community_owners;
END $$;

CREATE POLICY "Allow read for everyone" ON public.community_owners
  FOR SELECT USING (true);

CREATE POLICY "Allow insert for owner creation" ON public.community_owners
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Allow delete for owner" ON public.community_owners
  FOR DELETE USING (auth.uid() = owner_id);

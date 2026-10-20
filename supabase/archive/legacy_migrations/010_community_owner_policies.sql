-- 010_community_owner_policies.sql
-- Policies for community owners (moderator) – applied after community_owners table exists

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow update for owner (moderator)" ON public.communities;
  DROP POLICY IF EXISTS "Allow delete for owner" ON public.communities;
END $$;

-- Allow update for owner (moderator)
CREATE POLICY "Allow update for owner (moderator)" ON public.communities
  FOR UPDATE USING (auth.uid() = (SELECT owner_id FROM public.community_owners WHERE community_id = public.communities.id))
  WITH CHECK (auth.uid() = (SELECT owner_id FROM public.community_owners WHERE community_id = public.communities.id));

-- Allow delete for owner
CREATE POLICY "Allow delete for owner" ON public.communities
  FOR DELETE USING (auth.uid() = (SELECT owner_id FROM public.community_owners WHERE community_id = public.communities.id));

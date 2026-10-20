-- 008_community_memberships.sql
-- Table for community memberships (members, moderators, admins)
CREATE TABLE IF NOT EXISTS public.community_memberships (
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  member_id uuid REFERENCES public.profiles(id) NOT NULL,
  role text NOT NULL DEFAULT 'member', -- possible values: member, moderator, admin
  PRIMARY KEY (community_id, member_id)
);

ALTER TABLE public.community_memberships ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow read for everyone" ON public.community_memberships;
  DROP POLICY IF EXISTS "Allow insert for members" ON public.community_memberships;
  DROP POLICY IF EXISTS "Disallow updates" ON public.community_memberships;
  DROP POLICY IF EXISTS "Allow delete by owner" ON public.community_memberships;
END $$;

CREATE POLICY "Allow read for everyone" ON public.community_memberships
  FOR SELECT USING (true);

-- Insert only by authenticated users; cannot assign role higher than 'member'
CREATE POLICY "Allow insert for members" ON public.community_memberships
  FOR INSERT WITH CHECK (
    auth.uid() = member_id AND
    role = 'member'
  );

CREATE POLICY "Disallow updates" ON public.community_memberships
  FOR UPDATE USING (false);

CREATE POLICY "Allow delete by owner" ON public.community_memberships
  FOR DELETE USING (auth.uid() = member_id);

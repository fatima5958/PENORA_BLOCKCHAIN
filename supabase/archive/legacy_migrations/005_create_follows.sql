-- 005_create_follows.sql
-- Table for user follow relationships
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid REFERENCES public.profiles(id) NOT NULL,
  followee_id uuid REFERENCES public.profiles(id) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id)
);

-- Prevent a user from following themselves
CREATE OR REPLACE FUNCTION public.prevent_self_follow()
RETURNS trigger AS $$
BEGIN
  IF NEW.follower_id = NEW.followee_id THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_self_follow ON public.follows;
CREATE TRIGGER trg_prevent_self_follow BEFORE INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_follow();

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow read for everyone" ON public.follows;
  DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.follows;
  DROP POLICY IF EXISTS "Allow delete for owner" ON public.follows;
END $$;

CREATE POLICY "Allow read for everyone" ON public.follows
  FOR SELECT USING (true);

CREATE POLICY "Allow insert for authenticated users" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Allow delete for owner" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);

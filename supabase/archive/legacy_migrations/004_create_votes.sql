-- 004_create_votes.sql
-- Table for up/down votes on posts and comments
CREATE TABLE IF NOT EXISTS public.votes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  voter_id uuid REFERENCES public.profiles(id) NOT NULL,
  post_id uuid REFERENCES public.posts(id),
  comment_id uuid REFERENCES public.comments(id),
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT votes_exactly_one_target CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  )
);

-- Ensure each user can vote only once per post or comment
CREATE UNIQUE INDEX IF NOT EXISTS votes_unique_user_post ON public.votes (voter_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS votes_unique_user_comment ON public.votes (voter_id, comment_id) WHERE comment_id IS NOT NULL;

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read of votes on published posts" ON public.votes;
  DROP POLICY IF EXISTS "Public read of votes on comments" ON public.votes;
  DROP POLICY IF EXISTS "Allow read of own votes" ON public.votes;
  DROP POLICY IF EXISTS "Insert vote for authenticated users" ON public.votes;
  DROP POLICY IF EXISTS "Update own vote" ON public.votes;
  DROP POLICY IF EXISTS "Delete own vote" ON public.votes;
END $$;

-- Read policies: public can read votes on published posts; users can read their own votes
CREATE POLICY "Public read of votes on published posts" ON public.votes
  FOR SELECT USING (
    post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.posts p WHERE p.id = votes.post_id AND p.published = true
    )
  );

CREATE POLICY "Public read of votes on comments" ON public.votes
  FOR SELECT USING (
    comment_id IS NOT NULL
  );

CREATE POLICY "Allow read of own votes" ON public.votes
  FOR SELECT USING (auth.uid() = voter_id);

CREATE POLICY "Insert vote for authenticated users" ON public.votes
  FOR INSERT WITH CHECK (
    auth.uid() = voter_id
    AND (
      post_id IS NULL OR EXISTS (
        SELECT 1 FROM public.posts p WHERE p.id = votes.post_id AND p.published = true
      )
    )
    AND (
      comment_id IS NULL OR EXISTS (
        SELECT 1 FROM public.comments c WHERE c.id = votes.comment_id
      )
    )
  );

CREATE POLICY "Update own vote" ON public.votes
  FOR UPDATE USING (auth.uid() = voter_id) WITH CHECK (auth.uid() = voter_id);

CREATE POLICY "Delete own vote" ON public.votes
  FOR DELETE USING (auth.uid() = voter_id);

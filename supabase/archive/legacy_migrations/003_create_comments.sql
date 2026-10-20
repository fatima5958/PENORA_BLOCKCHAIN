-- 003_create_comments.sql
-- Table for comments on posts
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id uuid REFERENCES public.posts(id) NOT NULL,
  author_id uuid REFERENCES public.profiles(id) NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read of comments for published posts" ON public.comments;
  DROP POLICY IF EXISTS "Owner read of own comments" ON public.comments;
  DROP POLICY IF EXISTS "Insert comments for authenticated users" ON public.comments;
  DROP POLICY IF EXISTS "Update own comments" ON public.comments;
  DROP POLICY IF EXISTS "Delete own comments" ON public.comments;
END $$;

CREATE POLICY "Public read of comments for published posts" ON public.comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.posts p WHERE p.id = comments.post_id AND p.published = true)
  );

CREATE POLICY "Owner read of own comments" ON public.comments
  FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Insert comments for authenticated users" ON public.comments
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = comments.post_id
      AND (p.published = true OR p.author_id = auth.uid())
    )
  );

CREATE POLICY "Update own comments" ON public.comments
  FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Delete own comments" ON public.comments
  FOR DELETE USING (auth.uid() = author_id);

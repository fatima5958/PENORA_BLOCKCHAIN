-- 011_create_bookmarks.sql
-- Table for user post bookmarks with full RLS and published content constraint

CREATE TABLE IF NOT EXISTS public.bookmarks (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS bookmarks_user_idx ON public.bookmarks (user_id);
CREATE INDEX IF NOT EXISTS bookmarks_post_idx ON public.bookmarks (post_id);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow read of own bookmarks" ON public.bookmarks;
  DROP POLICY IF EXISTS "Allow bookmarking published posts" ON public.bookmarks;
  DROP POLICY IF EXISTS "Allow deleting own bookmarks" ON public.bookmarks;
END $$;

-- Owner can read their own bookmarks
CREATE POLICY "Allow read of own bookmarks" ON public.bookmarks
  FOR SELECT USING (auth.uid() = user_id);

-- Authenticated user can bookmark only published posts
CREATE POLICY "Allow bookmarking published posts" ON public.bookmarks
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = bookmarks.post_id
      AND p.published = true
    )
  );

-- Owner can delete their own bookmarks
CREATE POLICY "Allow deleting own bookmarks" ON public.bookmarks
  FOR DELETE USING (auth.uid() = user_id);

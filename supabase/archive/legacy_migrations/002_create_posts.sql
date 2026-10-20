-- 002_create_posts.sql
-- Table for posts/articles
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id uuid REFERENCES public.profiles(id) NOT NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  content text NOT NULL,
  cover_image_url text,
  tags text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  published boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS posts_author_idx ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS posts_slug_idx ON public.posts (slug);
CREATE INDEX IF NOT EXISTS posts_published_idx ON public.posts (published, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read of published posts" ON public.posts;
  DROP POLICY IF EXISTS "Owner read of own posts" ON public.posts;
  DROP POLICY IF EXISTS "Insert posts for authenticated users" ON public.posts;
  DROP POLICY IF EXISTS "Update own posts" ON public.posts;
  DROP POLICY IF EXISTS "Delete own posts" ON public.posts;
END $$;

CREATE POLICY "Public read of published posts" ON public.posts
  FOR SELECT USING (published = true);

CREATE POLICY "Owner read of own posts" ON public.posts
  FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Insert posts for authenticated users" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Update own posts" ON public.posts
  FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Delete own posts" ON public.posts
  FOR DELETE USING (auth.uid() = author_id);

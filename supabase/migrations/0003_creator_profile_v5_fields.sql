-- supabase/migrations/0003_creator_profile_v5_fields.sql
-- PENORA Blockchain Creator Profile V5: Identity, Location, Website, Interests & Storage Bucket

-- 1. Add extra profile fields to public.profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'location') THEN
    ALTER TABLE public.profiles ADD COLUMN location text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'website') THEN
    ALTER TABLE public.profiles ADD COLUMN website text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'interests') THEN
    ALTER TABLE public.profiles ADD COLUMN interests text[] DEFAULT '{}';
  END IF;
END $$;

-- 2. Configure Supabase Storage Bucket for Creator Media (avatars and cover banners)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creator-media',
  'creator-media',
  true,
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 3. Storage Security Policies for 'creator-media'
-- Public read access: Anyone can view avatars and banners
DROP POLICY IF EXISTS "Public Creator Media View" ON storage.objects;
CREATE POLICY "Public Creator Media View"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'creator-media');

-- Owner-only upload: Creators can only upload to their own UUID folder (/user_id/*)
DROP POLICY IF EXISTS "Creator Media User Upload" ON storage.objects;
CREATE POLICY "Creator Media User Upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'creator-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner-only update
DROP POLICY IF EXISTS "Creator Media User Update" ON storage.objects;
CREATE POLICY "Creator Media User Update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'creator-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner-only delete
DROP POLICY IF EXISTS "Creator Media User Delete" ON storage.objects;
CREATE POLICY "Creator Media User Delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'creator-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

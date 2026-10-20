-- 012_create_profile_trigger.sql
-- Trigger to automatically create a public.profiles record when a new user signs up in auth.users

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  initial_username text;
BEGIN
  -- Generate a clean initial username from metadata or email
  initial_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1) || '_' || substr(NEW.id::text, 1, 6)
  );

  INSERT INTO public.profiles (id, username, avatar_url, reputation)
  VALUES (
    NEW.id,
    initial_username,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    25 -- initial reputation
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Attach trigger to auth.users (guarded so it doesn't fail if already existing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

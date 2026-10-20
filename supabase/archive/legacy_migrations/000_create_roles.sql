-- 000_create_roles.sql
-- Create internal service roles for privileged operations (no login) safely and idempotently
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reputation_updater') THEN
    CREATE ROLE reputation_updater NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'community_owner_creator') THEN
    CREATE ROLE community_owner_creator NOLOGIN;
  END IF;
END $$;

-- Grant usage on schema public to these roles
GRANT USAGE ON SCHEMA public TO reputation_updater, community_owner_creator;

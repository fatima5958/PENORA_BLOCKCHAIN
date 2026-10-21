-- ============================================================================
-- PENORA MIGRATION 0002: Hardened Authentication Challenge RPC
-- Target Database: PENORA-Dev (ssjdirzophcveisnubwj)
-- Purpose:
--   1. Protects public.auth_challenges from direct table INSERT/UPDATE/DELETE by anon and authenticated.
--   2. Provides atomic, server-side challenge generation with:
--      - Single-use cryptographic entropy (32 random bytes = 256 bits)
--      - Strict 2-minute expiration
--      - Dual rate limiting (per-username: max 5/min, global: max 100/min)
--      - Opportunistic automated purging of expired challenges
--   3. Provides atomic, single-use consumption with row locking (replay protection).
--   4. Hardened SECURITY DEFINER search_path (public, extensions, pg_temp).
-- ============================================================================

-- Ensure pgcrypto is available for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Revoke any direct mutation privileges from anon on the underlying table
REVOKE INSERT, UPDATE, DELETE ON TABLE public.auth_challenges FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.auth_challenges FROM authenticated, public;
GRANT SELECT ON TABLE public.auth_challenges TO anon, authenticated;

-- Ensure RLS policies reject direct client table mutations
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow challenge creation" ON public.auth_challenges;
  DROP POLICY IF EXISTS "Disallow client challenge updates" ON public.auth_challenges;
  DROP POLICY IF EXISTS "Disallow client challenge deletion" ON public.auth_challenges;
  DROP POLICY IF EXISTS "Disallow direct client inserts" ON public.auth_challenges;
  DROP POLICY IF EXISTS "Disallow direct client updates" ON public.auth_challenges;
  DROP POLICY IF EXISTS "Disallow direct client deletes" ON public.auth_challenges;
END $$;

CREATE POLICY "Disallow direct client inserts" ON public.auth_challenges
  FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY "Disallow direct client updates" ON public.auth_challenges
  FOR UPDATE TO anon, authenticated USING (false);

CREATE POLICY "Disallow direct client deletes" ON public.auth_challenges
  FOR DELETE TO anon, authenticated USING (false);

-- ----------------------------------------------------------------------------
-- 1. Server-side Challenge Generation RPC (Rate-limited, Cryptographic Nonce)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_auth_challenge(
  p_username text,
  p_purpose text DEFAULT 'login'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_clean_username text;
  v_nonce text;
  v_challenge_id text;
  v_challenge text;
  v_expires_at timestamptz;
  v_recent_count int;
  v_global_recent_count int;
BEGIN
  v_clean_username := lower(trim(p_username));

  -- 1. Username validation & sanitization
  IF length(v_clean_username) < 3 OR length(v_clean_username) > 64 OR v_clean_username !~ '^[a-z0-9_-]+$' THEN
    RAISE EXCEPTION 'Invalid username format';
  END IF;

  -- 2. Purpose validation
  IF p_purpose NOT IN ('login', 'recovery') THEN
    RAISE EXCEPTION 'Invalid challenge purpose: %', p_purpose;
  END IF;

  -- 3. Server-side rate limiting:
  -- 3a. Per-username rate limit (Max 5 challenges per 60 seconds per username)
  SELECT count(*) INTO v_recent_count
  FROM public.auth_challenges
  WHERE username = v_clean_username
    AND created_at > now() - interval '1 minute';

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 5 challenges per minute for this account. Please wait.';
  END IF;

  -- 3b. Global system rate limit (Max 100 challenges per 60 seconds across all accounts)
  SELECT count(*) INTO v_global_recent_count
  FROM public.auth_challenges
  WHERE created_at > now() - interval '1 minute';

  IF v_global_recent_count >= 100 THEN
    RAISE EXCEPTION 'System authentication rate limit reached. Please wait a moment before trying again.';
  END IF;

  -- 4. Opportunistic automated cleanup of expired challenges (>5 min old)
  DELETE FROM public.auth_challenges
  WHERE expires_at < now() - interval '5 minutes';

  -- 5. Cryptographic nonce generation (32 bytes = 256 bits entropy)
  v_nonce := encode(extensions.gen_random_bytes(32), 'hex');
  v_challenge_id := 'chn_' || extract(epoch from now())::bigint || '_' || substr(v_nonce, 1, 12);
  v_expires_at := now() + interval '2 minutes';
  v_challenge := 'PENORA-AUTH-v1:' || v_clean_username || ':' || p_purpose || ':' || v_challenge_id || ':' || extract(epoch from now())::bigint || ':' || v_nonce;

  -- 6. Safe internal insertion
  INSERT INTO public.auth_challenges (
    id,
    username,
    purpose,
    challenge,
    created_at,
    expires_at,
    used
  ) VALUES (
    v_challenge_id,
    v_clean_username,
    p_purpose,
    v_challenge,
    now(),
    v_expires_at,
    false
  );

  RETURN jsonb_build_object(
    'id', v_challenge_id,
    'username', v_clean_username,
    'purpose', p_purpose,
    'challenge', v_challenge,
    'expires_at', v_expires_at
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Atomic Challenge Consumption RPC (Single-Use Replay Protection)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_auth_challenge(
  p_challenge_id text,
  p_username text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record public.auth_challenges%ROWTYPE;
BEGIN
  -- Input sanitization
  IF p_challenge_id IS NULL OR length(trim(p_challenge_id)) = 0 THEN
    RETURN false;
  END IF;

  -- Row lock with FOR UPDATE to prevent race conditions & double-spends
  SELECT * INTO v_record
  FROM public.auth_challenges
  WHERE id = p_challenge_id AND username = lower(trim(p_username))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Verify challenge is fresh and unused
  IF v_record.used OR now() > v_record.expires_at THEN
    RETURN false;
  END IF;

  -- Mark as used immediately within the locked transaction
  UPDATE public.auth_challenges
  SET used = true
  WHERE id = p_challenge_id;

  RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Execution Grants
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.request_auth_challenge(text, text) FROM public;
REVOKE ALL ON FUNCTION public.consume_auth_challenge(text, text) FROM public;

GRANT EXECUTE ON FUNCTION public.request_auth_challenge(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_auth_challenge(text, text) TO anon, authenticated;

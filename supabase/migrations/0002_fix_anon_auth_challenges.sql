-- ============================================================================
-- PENORA MIGRATION 0002: Hardened Authentication Challenge RPC
-- Target Database: PENORA-Dev (ssjdirzophcveisnubwj)
-- Purpose:
--   1. Protects public.auth_challenges from direct table INSERT/UPDATE/DELETE by anon.
--   2. Provides atomic, server-side challenge generation with:
--      - Single-use cryptographic entropy (32 random bytes)
--      - Strict 2-minute expiration
--      - Server-side rate limiting (max 5 requests / min / account)
--   3. Provides atomic, single-use consumption with row locking (replay protection).
-- ============================================================================

-- Ensure pgcrypto is available for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Revoke any direct mutation privileges from anon on the underlying table
REVOKE INSERT, UPDATE, DELETE ON TABLE public.auth_challenges FROM anon;
GRANT SELECT ON TABLE public.auth_challenges TO anon, authenticated;

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
SET search_path = public, extensions
AS $$
DECLARE
  v_clean_username text;
  v_nonce text;
  v_challenge_id text;
  v_challenge text;
  v_expires_at timestamptz;
  v_recent_count int;
BEGIN
  v_clean_username := lower(trim(p_username));

  -- 1. Username validation
  IF length(v_clean_username) < 3 OR v_clean_username !~ '^[a-z0-9_-]+$' THEN
    RAISE EXCEPTION 'Invalid username format';
  END IF;

  -- 2. Purpose validation
  IF p_purpose NOT IN ('login', 'recovery') THEN
    RAISE EXCEPTION 'Invalid challenge purpose: %', p_purpose;
  END IF;

  -- 3. Server-side rate limiting (Max 5 challenges per 60 seconds per username)
  SELECT count(*) INTO v_recent_count
  FROM public.auth_challenges
  WHERE username = v_clean_username
    AND created_at > now() - interval '1 minute';

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 5 challenges per minute. Please wait.';
  END IF;

  -- 4. Cryptographic nonce generation (32 bytes = 256 bits entropy)
  v_nonce := encode(extensions.gen_random_bytes(32), 'hex');
  v_challenge_id := 'chn_' || extract(epoch from now())::bigint || '_' || substr(v_nonce, 1, 12);
  v_expires_at := now() + interval '2 minutes';
  v_challenge := 'PENORA-AUTH-v1:' || v_clean_username || ':' || p_purpose || ':' || v_challenge_id || ':' || extract(epoch from now())::bigint || ':' || v_nonce;

  -- 5. Safe internal insertion
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
SET search_path = public
AS $$
DECLARE
  v_record public.auth_challenges%ROWTYPE;
BEGIN
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

  -- Mark as used immediately
  UPDATE public.auth_challenges
  SET used = true
  WHERE id = p_challenge_id;

  RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Execution Grants
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.request_auth_challenge(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_auth_challenge(text, text) TO anon, authenticated;

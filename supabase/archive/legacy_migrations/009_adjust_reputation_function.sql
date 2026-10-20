-- 009_adjust_reputation_function.sql
-- Secure server‑side function to adjust user reputation.
-- Only the `reputation_updater` role may execute it.

CREATE OR REPLACE FUNCTION public.adjust_reputation(p_user uuid, p_delta int)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET reputation = reputation + p_delta
  WHERE id = p_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Restrict execution to the privileged role
GRANT EXECUTE ON FUNCTION public.adjust_reputation(uuid, int) TO reputation_updater;
REVOKE EXECUTE ON FUNCTION public.adjust_reputation(uuid, int) FROM public;

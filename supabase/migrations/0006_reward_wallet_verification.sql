BEGIN;
CREATE TABLE IF NOT EXISTS public.reward_wallet_challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_id uuid NOT NULL REFERENCES public.profiles(id),
 wallet_address text NOT NULL, message text NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reward_wallet_challenges_author_idx ON public.reward_wallet_challenges(author_id,created_at);
ALTER TABLE public.reward_wallet_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reward_wallet_challenges FROM anon,authenticated;
GRANT ALL ON public.reward_wallet_challenges TO service_role;
CREATE OR REPLACE FUNCTION public.issue_reward_wallet_challenge(p_author uuid,p_wallet text,p_origin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE challenge uuid:=gen_random_uuid(); expiry timestamptz:=clock_timestamp()+interval '5 minutes'; msg text;
BEGIN
 IF p_wallet IS NULL OR p_origin IS NULL OR p_wallet !~ '^0x[0-9a-f]{40}$' OR p_wallet='0x0000000000000000000000000000000000000000' OR p_origin !~ '^https://[^/[:space:]]+$' THEN RAISE EXCEPTION 'Invalid wallet challenge'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_author::text));
 IF (SELECT count(*) FROM public.reward_wallet_challenges WHERE author_id=p_author AND created_at>clock_timestamp()-interval '10 minutes')>=5 THEN RAISE EXCEPTION 'Challenge rate limit'; END IF;
 msg:='PENORA blog reward wallet'||E'\nOrigin: '||p_origin||E'\nAccount: '||p_author||E'\nWallet: '||p_wallet||E'\nNonce: '||challenge||E'\nExpires: '||expiry;
 INSERT INTO public.reward_wallet_challenges(id,author_id,wallet_address,message,expires_at) VALUES(challenge,p_author,p_wallet,msg,expiry);
 RETURN jsonb_build_object('id',challenge,'message',msg,'expiresAt',expiry);
END;
$$;
REVOKE ALL ON FUNCTION public.issue_reward_wallet_challenge(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.issue_reward_wallet_challenge(uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.consume_reward_wallet_challenge(p_author uuid,p_challenge uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE wallet text;
BEGIN
 -- Call only after server-side signature verification. The browser cannot execute this function.
 UPDATE public.reward_wallet_challenges SET used_at=clock_timestamp()
 WHERE id=p_challenge AND author_id=p_author AND used_at IS NULL AND expires_at>clock_timestamp() RETURNING wallet_address INTO wallet;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.reward_wallet_bindings(author_id,wallet_address,verification_reference) VALUES(p_author,wallet,'signed-wallet-challenge:'||p_challenge)
 ON CONFLICT(author_id) DO UPDATE SET wallet_address=excluded.wallet_address,verification_reference=excluded.verification_reference,verified_at=clock_timestamp();
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_reward_wallet_challenge(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_reward_wallet_challenge(uuid,uuid) TO service_role;
COMMIT;

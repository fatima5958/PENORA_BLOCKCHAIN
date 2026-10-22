-- Service-only reward cohort/lease ledger. No browser can reserve budgets or write allocations.
BEGIN;
CREATE TABLE IF NOT EXISTS public.reward_wallet_bindings (
  author_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  wallet_address text NOT NULL CHECK (wallet_address ~ '^0x[0-9a-f]{40}$' AND wallet_address <> '0x0000000000000000000000000000000000000000'),
  verification_reference text NOT NULL CHECK (length(verification_reference) > 10),
  verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.reward_daily_budgets (
  reward_day date PRIMARY KEY,
  daily_cap numeric(78,0) NOT NULL CHECK (daily_cap >= 0 AND daily_cap < power(2::numeric,256)),
  reserved numeric(78,0) NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= daily_cap)
);
CREATE TABLE IF NOT EXISTS public.article_reward_batches (
  slot_start timestamptz PRIMARY KEY,
  budget numeric(78,0) NOT NULL CHECK (budget >= 0),
  chain_id bigint NOT NULL CHECK (chain_id = 80002),
  distributor text NOT NULL,
  influence_contract text NOT NULL,
  from_block numeric(78,0) NOT NULL,
  through_block numeric(78,0) NOT NULL,
  through_block_hash text NOT NULL,
  articles_snapshot jsonb NOT NULL,
  prepared_plan jsonb,
  index_cursor numeric(78,0),
  indexed_votes jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','prepared','blocked')),
  lease_id uuid NOT NULL,
  lease_until timestamptz NOT NULL,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  prepared_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.article_reward_jobs (
  article_id uuid PRIMARY KEY,
  author_id uuid NOT NULL,
  batch_slot timestamptz NOT NULL REFERENCES public.article_reward_batches(slot_start),
  published_at timestamptz NOT NULL,
  payout_at timestamptz NOT NULL,
  author_wallet text
);
CREATE INDEX IF NOT EXISTS article_reward_batches_pending_idx ON public.article_reward_batches(slot_start) WHERE state='reserved';
CREATE INDEX IF NOT EXISTS article_reward_jobs_batch_idx ON public.article_reward_jobs(batch_slot);
CREATE INDEX IF NOT EXISTS article_reward_jobs_author_idx ON public.article_reward_jobs(author_id);

ALTER TABLE public.reward_wallet_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_daily_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_reward_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_reward_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reward_wallet_bindings,public.reward_daily_budgets,public.article_reward_batches,public.article_reward_jobs FROM anon,authenticated;
GRANT ALL ON public.reward_wallet_bindings,public.reward_daily_budgets,public.article_reward_batches,public.article_reward_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_article_reward_batch(
 p_slot timestamptz,p_daily_cap numeric,p_budget numeric,p_chain bigint,p_distributor text,p_influence text,
 p_from_block numeric,p_through_block numeric,p_block_hash text,p_lease uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.article_reward_batches; snapshot jsonb; day date; slot_number integer; expected numeric;
BEGIN
 IF p_slot IS NULL OR p_daily_cap IS NULL OR p_budget IS NULL OR p_chain IS NULL OR p_distributor IS NULL OR p_influence IS NULL OR p_from_block IS NULL OR p_through_block IS NULL OR p_block_hash IS NULL OR p_lease IS NULL THEN RAISE EXCEPTION 'Invalid batch configuration'; END IF;
 IF p_slot <> date_trunc('minute',p_slot) OR p_slot + interval '60 seconds' > clock_timestamp() THEN RAISE EXCEPTION 'Slot is not closed'; END IF;
 IF p_chain <> 80002 OR p_daily_cap < 0 OR p_daily_cap <> trunc(p_daily_cap) OR p_daily_cap >= power(2::numeric,256) OR p_from_block < 0 OR p_through_block < p_from_block OR p_from_block <> trunc(p_from_block) OR p_through_block <> trunc(p_through_block) OR p_budget <> trunc(p_budget) OR p_distributor !~ '^0x[0-9a-f]{40}$' OR p_influence !~ '^0x[0-9a-f]{40}$' OR p_distributor='0x0000000000000000000000000000000000000000' OR p_influence='0x0000000000000000000000000000000000000000' OR p_block_hash !~ '^0x[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid batch configuration'; END IF;
 day := (p_slot AT TIME ZONE 'UTC')::date;
 slot_number := extract(hour FROM p_slot AT TIME ZONE 'UTC')::int*60 + extract(minute FROM p_slot AT TIME ZONE 'UTC')::int;
 expected := trunc(p_daily_cap/1440) + CASE WHEN slot_number=1439 THEN mod(p_daily_cap,1440) ELSE 0 END;
 IF p_budget <> expected THEN RAISE EXCEPTION 'Incorrect slot budget'; END IF;
 PERFORM pg_advisory_xact_lock(70427123);
 SELECT * INTO b FROM public.article_reward_batches WHERE slot_start=p_slot FOR UPDATE;
 IF FOUND THEN
   IF b.chain_id<>p_chain OR b.distributor<>p_distributor OR b.influence_contract<>p_influence THEN RAISE EXCEPTION 'Batch configuration changed'; END IF;
   IF b.state='prepared' THEN RETURN to_jsonb(b) || jsonb_build_object('budget',b.budget::text,'from_block',b.from_block::text,'through_block',b.through_block::text,'index_cursor',coalesce(b.index_cursor,b.from_block)::text); END IF;
   IF b.lease_until>clock_timestamp() AND b.lease_id<>p_lease THEN RETURN NULL; END IF;
   UPDATE public.article_reward_batches SET lease_id=p_lease,lease_until=clock_timestamp()+interval '5 minutes' WHERE slot_start=p_slot RETURNING * INTO b;
   RETURN to_jsonb(b) || jsonb_build_object('budget',b.budget::text,'from_block',b.from_block::text,'through_block',b.through_block::text,'index_cursor',coalesce(b.index_cursor,b.from_block)::text);
 END IF;
 -- Incomplete authorship linkage blocks the COMPLETE cohort instead of silently omitting posts.
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'author_id',p.author_id,'author',w.wallet_address,'publishedAt',p.published_at,'payoutAt',p.payout_at) ORDER BY p.id),'[]'::jsonb)
 INTO snapshot FROM public.posts p LEFT JOIN public.reward_wallet_bindings w ON w.author_id=p.author_id
 WHERE p.published AND p.payout_at>=p_slot AND p.payout_at<p_slot+interval '60 seconds'
 AND NOT EXISTS(SELECT 1 FROM public.article_reward_jobs j WHERE j.article_id=p.id);
 IF jsonb_array_length(snapshot)=0 THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(snapshot) e WHERE e->>'author' IS NULL) THEN RAISE EXCEPTION 'Reward wallet verification required'; END IF;
 INSERT INTO public.reward_daily_budgets(reward_day,daily_cap) VALUES(day,p_daily_cap) ON CONFLICT DO NOTHING;
 IF (SELECT daily_cap FROM public.reward_daily_budgets WHERE reward_day=day)<>p_daily_cap THEN RAISE EXCEPTION 'Daily budget already fixed'; END IF;
 UPDATE public.reward_daily_budgets SET reserved=reserved+p_budget WHERE reward_day=day AND reserved+p_budget<=daily_cap;
 IF NOT FOUND THEN RAISE EXCEPTION 'Daily budget exhausted'; END IF;
 INSERT INTO public.article_reward_batches(slot_start,budget,chain_id,distributor,influence_contract,from_block,through_block,through_block_hash,articles_snapshot,lease_id,lease_until)
 VALUES(p_slot,p_budget,p_chain,p_distributor,p_influence,p_from_block,p_through_block,p_block_hash,snapshot,p_lease,clock_timestamp()+interval '5 minutes') RETURNING * INTO b;
 INSERT INTO public.article_reward_jobs(article_id,author_id,batch_slot,published_at,payout_at,author_wallet)
 SELECT (e->>'id')::uuid,(e->>'author_id')::uuid,p_slot,(e->>'publishedAt')::timestamptz,(e->>'payoutAt')::timestamptz,e->>'author' FROM jsonb_array_elements(snapshot) e;
 RETURN to_jsonb(b) || jsonb_build_object('budget',b.budget::text,'from_block',b.from_block::text,'through_block',b.through_block::text,'index_cursor',coalesce(b.index_cursor,b.from_block)::text);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_article_reward_batch(timestamptz,numeric,numeric,bigint,text,text,numeric,numeric,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_article_reward_batch(timestamptz,numeric,numeric,bigint,text,text,numeric,numeric,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_article_reward_batch(p_slot timestamptz,p_lease uuid,p_plan jsonb,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_plan IS NULL AND p_error IS NULL THEN RAISE EXCEPTION 'Missing result'; END IF;
 UPDATE public.article_reward_batches SET prepared_plan=p_plan,state=CASE WHEN p_plan IS NULL THEN 'blocked' ELSE 'prepared' END,
 prepared_at=CASE WHEN p_plan IS NULL THEN NULL ELSE now() END,last_error_code=p_error,lease_until=clock_timestamp()
 WHERE slot_start=p_slot AND lease_id=p_lease AND lease_until>clock_timestamp() AND state<>'prepared';
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_article_reward_batch(timestamptz,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_article_reward_batch(timestamptz,uuid,jsonb,text) TO service_role;
CREATE OR REPLACE FUNCTION public.checkpoint_article_reward_batch(p_slot timestamptz,p_lease uuid,p_next_block numeric,p_votes jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.article_reward_batches SET index_cursor=p_next_block,indexed_votes=p_votes,lease_until=clock_timestamp()
 WHERE slot_start=p_slot AND lease_id=p_lease AND lease_until>clock_timestamp() AND state='reserved'
 AND p_next_block=trunc(p_next_block) AND jsonb_typeof(p_votes)='object'
 AND p_next_block>=coalesce(index_cursor,from_block) AND p_next_block<=through_block+1;
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.checkpoint_article_reward_batch(timestamptz,uuid,numeric,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.checkpoint_article_reward_batch(timestamptz,uuid,numeric,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.next_article_reward_slot(p_closed_before timestamptz)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 -- A cohort waits as a whole for wallet verification; later ready cohorts can proceed.
 SELECT date_trunc('minute',p.payout_at) AS slot FROM public.posts p
 LEFT JOIN public.reward_wallet_bindings w ON w.author_id=p.author_id
 WHERE p.published AND p.payout_at IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.article_reward_jobs j WHERE j.article_id=p.id)
 GROUP BY date_trunc('minute',p.payout_at)
 HAVING max(p.payout_at)<=least(p_closed_before,statement_timestamp()-interval '60 seconds')
 AND bool_and(w.wallet_address IS NOT NULL)
 ORDER BY slot LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.next_article_reward_slot(timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.next_article_reward_slot(timestamptz) TO service_role;
COMMIT;

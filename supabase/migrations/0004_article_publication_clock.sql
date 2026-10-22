-- First publication, not draft creation or last edit, starts the seven-day window.
-- Legacy published posts have unknown first-publication dates: do not fabricate/backdate them.
BEGIN;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS payout_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_article_publication_clock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.published_at := CASE WHEN NEW.published THEN statement_timestamp() ELSE NULL END;
  ELSIF OLD.published_at IS NOT NULL THEN
    NEW.id := OLD.id;
    NEW.author_id := OLD.author_id;
    NEW.published_at := OLD.published_at;
  ELSIF NEW.published AND NOT OLD.published THEN
    NEW.published_at := statement_timestamp();
  ELSE
    NEW.published_at := OLD.published_at;
  END IF;
  NEW.payout_at := CASE WHEN NEW.published_at IS NOT NULL THEN NEW.published_at + interval '168 hours' ELSE NULL END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS posts_publication_clock ON public.posts;
CREATE TRIGGER posts_publication_clock BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.set_article_publication_clock();
CREATE INDEX IF NOT EXISTS posts_reward_due_idx ON public.posts(payout_at) WHERE published AND payout_at IS NOT NULL;
COMMIT;

-- Community creation is authenticated, reputation-gated and atomic.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Client-created profiles cannot invent the reputation needed for eligibility.
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.profiles;
CREATE POLICY "Allow insert for authenticated users" ON public.profiles FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid())=id AND reputation=25);
CREATE OR REPLACE FUNCTION public.prevent_reputation_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user IN ('anon','authenticated') THEN
   IF TG_OP='INSERT' THEN
     IF NEW.reputation IS DISTINCT FROM 25 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Reputation is managed by the server'; END IF;
   ELSIF NEW.reputation IS DISTINCT FROM OLD.reputation THEN
     RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Reputation is managed by the server';
   END IF;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_reputation ON public.profiles;
CREATE TRIGGER trg_prevent_reputation BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_reputation_change();
REVOKE ALL ON FUNCTION public.prevent_reputation_change() FROM PUBLIC,anon,authenticated;

-- Only the validated function may create communities/initial ownership.
REVOKE INSERT ON public.communities,public.community_owners FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.communities;
DROP POLICY IF EXISTS "Allow insert for owner creation" ON public.community_owners;
-- Creators cannot rewrite provenance or identifiers through normal owner edits.
REVOKE UPDATE ON public.communities FROM PUBLIC,anon,authenticated;
GRANT UPDATE(name,description,avatar_url,cover_url) ON public.communities TO authenticated;

CREATE OR REPLACE FUNCTION private.create_community_impl(p_name text,p_slug text,p_description text,p_request_id uuid)
RETURNS public.communities LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE caller uuid:=auth.uid(); score integer; result public.communities; clean_name text:=btrim(p_name); clean_slug text:=btrim(p_slug); clean_description text:=btrim(p_description);
BEGIN
 IF caller IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Sign in to create a community'; END IF;
 IF p_request_id IS NULL OR clean_name IS NULL OR char_length(clean_name) NOT BETWEEN 3 AND 60
 OR clean_slug IS NULL OR char_length(clean_slug) NOT BETWEEN 3 AND 48 OR clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
 OR clean_description IS NULL OR char_length(clean_description) NOT BETWEEN 10 AND 1000 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Check the community name, URL and description';
 END IF;
 -- Serializes requests against reputation changes and concurrent retries for this account.
 SELECT reputation INTO score FROM public.profiles WHERE id=caller FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='A verified profile is required'; END IF;
 SELECT * INTO result FROM public.communities WHERE id=p_request_id;
 IF FOUND THEN
  IF result.created_by=caller AND result.name=clean_name AND result.slug=clean_slug AND result.description=clean_description THEN RETURN result; END IF;
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='This creation request was already used';
 END IF;
 IF score IS NULL OR score<65 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Community creation requires reputation 65 or higher'; END IF;
 INSERT INTO public.communities(id,name,slug,description,created_by)
 VALUES(p_request_id,clean_name,clean_slug,clean_description,caller) RETURNING * INTO result;
 INSERT INTO public.community_owners(community_id,owner_id) VALUES(result.id,caller);
 INSERT INTO public.community_memberships(community_id,member_id,role) VALUES(result.id,caller,'admin');
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION private.create_community_impl(text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.create_community_impl(text,text,text,uuid) TO authenticated;
COMMENT ON FUNCTION private.create_community_impl(text,text,text,uuid) IS 'Intentional per-user privileged operation: auth.uid(), locked server reputation >=65, validated content and atomic initial ownership. Not an exposed API schema.';

CREATE OR REPLACE FUNCTION public.create_community(p_name text,p_slug text,p_description text,p_request_id uuid)
RETURNS public.communities LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM private.create_community_impl(p_name,p_slug,p_description,p_request_id);
$$;
REVOKE ALL ON FUNCTION public.create_community(text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_community(text,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_creation_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce((SELECT jsonb_build_object('reputation',p.reputation,'minimum',65,'eligible',p.reputation>=65)
 FROM public.profiles p WHERE p.id=(SELECT auth.uid())),jsonb_build_object('reputation',NULL,'minimum',65,'eligible',false));
$$;
REVOKE ALL ON FUNCTION public.community_creation_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.community_creation_status() TO authenticated;
COMMIT;

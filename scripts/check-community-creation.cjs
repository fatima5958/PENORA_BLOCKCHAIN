// Isolated PostgreSQL authorization tests. Never connects to a live project.
// PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite node scripts/check-community-creation.cjs
const {PGlite}=require(process.env.PGLITE_MODULE_PATH||'@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();let count=0;
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const check=value=>{assert.ok(value);count++;};
 const rejected=async(sql,args=[])=>{await assert.rejects(q(sql,args));count++;};
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY,username text UNIQUE NOT NULL,reputation integer NOT NULL DEFAULT 25);
 CREATE TABLE public.communities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text UNIQUE NOT NULL,slug text UNIQUE NOT NULL,description text,avatar_url text,cover_url text,created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,created_at timestamptz DEFAULT now());
 CREATE TABLE community_owners(community_id uuid UNIQUE REFERENCES communities(id) ON DELETE CASCADE,owner_id uuid REFERENCES profiles(id),PRIMARY KEY(community_id,owner_id));
 CREATE TABLE community_memberships(community_id uuid REFERENCES communities(id) ON DELETE CASCADE,member_id uuid REFERENCES profiles(id),role text DEFAULT 'member' CHECK(role IN ('member','moderator','admin')),PRIMARY KEY(community_id,member_id));
 ALTER TABLE profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE communities ENABLE ROW LEVEL SECURITY; ALTER TABLE community_owners ENABLE ROW LEVEL SECURITY; ALTER TABLE community_memberships ENABLE ROW LEVEL SECURITY;
 CREATE POLICY profile_read ON profiles FOR SELECT USING(true);
 CREATE POLICY profile_update ON profiles FOR UPDATE TO authenticated USING(auth.uid()=id) WITH CHECK(auth.uid()=id);
 CREATE POLICY profile_delete ON profiles FOR DELETE TO authenticated USING(auth.uid()=id);
 CREATE POLICY "Allow insert for authenticated users" ON profiles FOR INSERT TO authenticated WITH CHECK(auth.uid()=id);
 CREATE POLICY "Allow insert for authenticated users" ON communities FOR INSERT TO authenticated WITH CHECK(auth.uid()=created_by);
 CREATE POLICY community_read ON communities FOR SELECT USING(true);
 CREATE POLICY community_update ON communities FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM community_owners co WHERE co.community_id=communities.id AND co.owner_id=auth.uid())) WITH CHECK(EXISTS(SELECT 1 FROM community_owners co WHERE co.community_id=communities.id AND co.owner_id=auth.uid()));
 CREATE POLICY owner_read ON community_owners FOR SELECT USING(true);
 CREATE POLICY "Allow insert for owner creation" ON community_owners FOR INSERT TO authenticated WITH CHECK(auth.uid()=owner_id);
 CREATE POLICY membership_read ON community_memberships FOR SELECT USING(true);
 CREATE POLICY membership_join ON community_memberships FOR INSERT TO authenticated WITH CHECK(auth.uid()=member_id AND role='member');
 GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
 GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;`);
 const migration=fs.readdirSync('supabase/migrations').find(p=>p.endsWith('_community_creation_reputation_gate.sql'));
 await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'));
 const u64='11111111-1111-4111-8111-111111111111',u65='22222222-2222-4222-8222-222222222222',u66='33333333-3333-4333-8333-333333333333';
 const c65='44444444-4444-4444-8444-444444444444',c66='55555555-5555-4555-8555-555555555555',other='66666666-6666-4666-8666-666666666666';
 await q('INSERT INTO profiles VALUES($1,$2,64),($3,$4,65),($5,$6,66)',[u64,'r64',u65,'r65',u66,'r66']);
 const login=async id=>{await db.exec('RESET ROLE');await q("SELECT set_config('test.uid',$1,false)",[id||'']);await db.exec('SET ROLE authenticated');};
 const create='SELECT (public.create_community($1,$2,$3,$4)).*';
 const args=['Writers circle','writers-circle','A focused circle for thoughtful writers.',c65];
 await login(u64);check((await q('SELECT community_creation_status() AS s'))[0].s.eligible===false);
 await rejected(create,args);
 await rejected('INSERT INTO communities(name,slug,created_by) VALUES($1,$2,$3)',['Direct bypass','direct-bypass',u64]);
 await rejected('UPDATE profiles SET reputation=65 WHERE id=$1',[u64]);
 await q('UPDATE profiles SET username=$1 WHERE id=$2',['still-editable',u64]);check((await q('SELECT username FROM profiles WHERE id=$1',[u64]))[0].username==='still-editable');
 await login(u65);check((await q('SELECT community_creation_status() AS s'))[0].s.eligible===true);
 const created=(await q(create,args))[0];check(created.id===c65&&created.created_by===u65);
 check((await q('SELECT * FROM community_owners WHERE community_id=$1',[c65]))[0].owner_id===u65);
 check((await q('SELECT role FROM community_memberships WHERE community_id=$1 AND member_id=$2',[c65,u65]))[0].role==='admin');
 await q(create,args);check((await q('SELECT count(*)::int AS n FROM communities'))[0].n===1);
 await rejected(create,['Changed name',...args.slice(1)]);
 await rejected('INSERT INTO communities(name,slug,created_by) VALUES($1,$2,$3)',['Bypass at 65','bypass-65',u65]);
 await rejected('UPDATE communities SET created_by=$1 WHERE id=$2',[u64,c65]);
 await q('UPDATE communities SET description=$1 WHERE id=$2',['Owner can still edit this description',c65]);
 // Restore the fixture content as administrator before testing idempotency after a score drop.
 await db.exec('RESET ROLE');await q('UPDATE communities SET description=$1 WHERE id=$2',[args[2],c65]);await q('UPDATE profiles SET reputation=64 WHERE id=$1',[u65]);
 await login(u65);check((await q(create,args))[0].id===c65);await rejected(create,['Another circle','another-circle','A second circle for different ideas.',other]);
 await login(u66);check((await q(create,['Readers circle','readers-circle','A circle for readers and reviewers.',c66]))[0].created_by===u66);
 await rejected(create,args); // Cannot claim another user's idempotency identifier.
 await rejected('INSERT INTO community_owners VALUES($1,$2)',[c65,u66]);
 await rejected('INSERT INTO community_memberships VALUES($1,$2,$3)',[c65,u66,'admin']);
 await q('INSERT INTO community_memberships VALUES($1,$2,$3)',[c65,u66,'member']);check((await q('SELECT role FROM community_memberships WHERE community_id=$1 AND member_id=$2',[c65,u66]))[0].role==='member');
 await rejected(create,['Duplicate URL','writers-circle','An intentionally duplicated URL.',other]);
 await rejected(create,['Bad','Invalid Slug','A valid long description.',other]);
 await rejected(create,['x','valid-slug','A valid long description.',other]);
 await rejected(create,['Valid Name','valid-slug','short',other]);
 await rejected(create,['Valid Name','valid-slug','A valid long description.',null]);
 // A failed membership insert must roll back community and owner creation together.
 await db.exec(`RESET ROLE; CREATE FUNCTION fail_admin() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.community_id='66666666-6666-4666-8666-666666666666'::uuid THEN RAISE EXCEPTION 'forced fixture error'; END IF; RETURN NEW; END$$; CREATE TRIGGER fixture_admin_failure BEFORE INSERT ON community_memberships FOR EACH ROW EXECUTE FUNCTION fail_admin();`);
 await login(u66);await rejected(create,['Rollback circle','rollback-circle','This creation must roll back atomically.',other]);
 check((await q('SELECT count(*)::int AS n FROM communities WHERE id=$1',[other]))[0].n===0);
 check((await q('SELECT count(*)::int AS n FROM community_owners WHERE community_id=$1',[other]))[0].n===0);
 // Delete/recreate cannot manufacture a qualifying score.
 await login(u64);await q('DELETE FROM profiles WHERE id=$1',[u64]);await rejected('INSERT INTO profiles VALUES($1,$2,99)',[u64,'forged-score']);await q('INSERT INTO profiles(id,username) VALUES($1,$2)',[u64,'default-score']);check((await q('SELECT reputation FROM profiles WHERE id=$1',[u64]))[0].reputation===25);
 await login(null);await rejected(create,['Unsigned circle','unsigned-circle','A valid description for this circle.',other]);
 await db.exec('SET ROLE anon');await rejected(create,args);await rejected('SELECT community_creation_status()');
 await db.close();console.log(`${count} PostgreSQL community authorization checks passed`);
})().catch(error=>{console.error(error);process.exitCode=1;});

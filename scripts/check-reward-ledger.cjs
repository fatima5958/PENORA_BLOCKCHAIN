// Run against isolated PostgreSQL WASM, never a live project.
// PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite node scripts/check-reward-ledger.cjs
const {PGlite}=require(process.env.PGLITE_MODULE_PATH||'@electric-sql/pglite');
const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite(); let checks=0;
 const check=(value)=>{assert.ok(value);checks++;};
 const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE profiles(id uuid PRIMARY KEY);
 CREATE TABLE posts(id uuid PRIMARY KEY,author_id uuid REFERENCES profiles(id),published boolean NOT NULL DEFAULT false);`);
 for(const file of ['0004_article_publication_clock.sql','0005_reward_settlement_ledger.sql','0006_reward_wallet_verification.sql']) await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 const p='33333333-3333-4333-8333-333333333333',p2='44444444-4444-4444-8444-444444444444';
 const wallet='0x'+'11'.repeat(20),contract='0x'+'22'.repeat(20),influence='0x'+'33'.repeat(20),hash='0x'+'44'.repeat(32);
 const lease='55555555-5555-4555-8555-555555555555',other='66666666-6666-4666-8666-666666666666';
 await query('INSERT INTO profiles VALUES ($1),($2)',[a,b]);
 await query("INSERT INTO posts(id,author_id,published,published_at) VALUES ($1,$2,true,'2000-01-01')",[p,a]);
 const pub=(await query('SELECT published_at,payout_at FROM posts WHERE id=$1',[p]))[0];
 check(Date.parse(pub.published_at)>Date.now()-10000);
 check(Date.parse(pub.payout_at)-Date.parse(pub.published_at)===604800000);
 await query("UPDATE posts SET published=false,published_at='2000-01-01' WHERE id=$1",[p]);
 await query('UPDATE posts SET published=true WHERE id=$1',[p]);
 check(String((await query('SELECT published_at FROM posts WHERE id=$1',[p]))[0].published_at)===String(pub.published_at));
 // Historical timestamps are fixtures only; the production trigger cannot backdate them.
 await db.exec('ALTER TABLE posts DISABLE TRIGGER posts_publication_clock');
 await query("UPDATE posts SET published_at='2020-01-01 00:02:15Z',payout_at='2020-01-08 00:02:15Z' WHERE id=$1",[p]);
 await query("INSERT INTO posts(id,author_id,published,published_at,payout_at) VALUES ($1,$2,true,'2020-01-01 00:01:15Z','2020-01-08 00:01:15Z')",[p2,b]);
 await db.exec('ALTER TABLE posts ENABLE TRIGGER posts_publication_clock');
 const challenge=(await query("SELECT issue_reward_wallet_challenge($1,$2,'https://penorablockchain.vercel.app') AS c",[a,wallet]))[0].c;
 check(challenge.message.includes(challenge.id)&&challenge.message.includes(a));
 check((await query('SELECT consume_reward_wallet_challenge($1,$2) AS ok',[b,challenge.id]))[0].ok===false);
 check((await query('SELECT consume_reward_wallet_challenge($1,$2) AS ok',[a,challenge.id]))[0].ok===true);
 check((await query('SELECT consume_reward_wallet_challenge($1,$2) AS ok',[a,challenge.id]))[0].ok===false);
 const next=(await query('SELECT next_article_reward_slot(now()) AS slot'))[0].slot;
 check(new Date(next).toISOString()==='2020-01-08T00:02:00.000Z'); // Earlier unlinked cohort cannot starve this one.
 const cap='1440000000000000000000',budget='1000000000000000000',slot='2020-01-08T00:02:00Z';
 const args=[slot,cap,budget,80002,contract,influence,'10','20',hash,lease];
 const reserve='SELECT reserve_article_reward_batch($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS b';
 const batch=(await query(reserve,args))[0].b;
 check(batch.budget===budget&&batch.from_block==='10');
 check(batch.articles_snapshot.length===1&&batch.articles_snapshot[0].author===wallet);
 check((await query(reserve,[...args.slice(0,9),other]))[0].b===null);
 check((await query('SELECT finish_article_reward_batch($1,$2,$3,null) AS ok',[slot,other,{bad:true}]))[0].ok===false);
 check((await query('SELECT checkpoint_article_reward_batch($1,$2,15,$3) AS ok',[slot,lease,{}]))[0].ok===true);
 const resumed=(await query(reserve,[...args.slice(0,9),other]))[0].b;
 check(resumed.index_cursor==='15');
 check((await query('SELECT reserved::text FROM reward_daily_budgets'))[0].reserved===budget);
 check((await query('SELECT finish_article_reward_batch($1,$2,$3,null) AS ok',[slot,other,{version:1}]))[0].ok===true);
 check((await query('SELECT finish_article_reward_batch($1,$2,$3,null) AS ok',[slot,other,{version:2}]))[0].ok===false);
 check((await query(reserve,args))[0].b.prepared_plan.version===1);
 await assert.rejects(query(reserve,[slot,cap,'2',80002,contract,influence,'10','20',hash,lease]));checks++;
 const exp=(await query("SELECT issue_reward_wallet_challenge($1,$2,'https://penorablockchain.vercel.app') AS c",[a,wallet]))[0].c;
 await query("UPDATE reward_wallet_challenges SET expires_at=now()-interval '1 minute' WHERE id=$1",[exp.id]);
 check((await query('SELECT consume_reward_wallet_challenge($1,$2) AS ok',[a,exp.id]))[0].ok===false);
 for(let i=0;i<3;i++) await query("SELECT issue_reward_wallet_challenge($1,$2,'https://penorablockchain.vercel.app')",[a,wallet]);
 await assert.rejects(query("SELECT issue_reward_wallet_challenge($1,$2,'https://penorablockchain.vercel.app')",[a,wallet]));checks++;
 for(const role of ['anon','authenticated']) {
   await db.exec('SET ROLE '+role);
   await assert.rejects(query('SELECT * FROM reward_wallet_bindings'));checks++;
   await assert.rejects(query('SELECT consume_reward_wallet_challenge($1,$2)',[a,challenge.id]));checks++;
   await assert.rejects(query(reserve,args));checks++;
   await db.exec('RESET ROLE');
 }
 await db.close(); console.log(`${checks} isolated PostgreSQL reward checks passed`);
})().catch(error=>{console.error(error);process.exitCode=1;});

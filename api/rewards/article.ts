import { createClient } from '@supabase/supabase-js';
import { formatUnits } from 'viem';

/** Public summary is restricted to an actually published blog. "Prepared" is not "paid". */
export async function GET(request:Request) {
  const id=new URL(request.url).searchParams.get('id')??'';
  const headers={'Cache-Control':'no-store'};
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({error:'Invalid blog ID'},{status:400,headers});
  if(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({status:'unavailable'},{status:503,headers});
  try {
    const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const post=await db.from('posts').select('id,published_at,payout_at').eq('id',id).eq('published',true).maybeSingle();
    if(post.error) throw new Error('Publication lookup unavailable');
    if(!post.data) return Response.json({error:'Blog not found'},{status:404,headers});
    const job=await db.from('article_reward_jobs').select('batch_slot').eq('article_id',id).maybeSingle();
    if(job.error) throw new Error('Ledger unavailable');
    const base={publishedAt:post.data.published_at,payoutAt:post.data.payout_at,serverTime:new Date().toISOString()};
    if(!job.data) return Response.json({...base,status:'not_prepared'},{headers});
    const batch=await db.from('article_reward_batches').select('state,prepared_plan').eq('slot_start',job.data.batch_slot).maybeSingle();
    if(batch.error) throw new Error('Ledger unavailable');
    const allocation=batch.data?.prepared_plan?.allocations?.find((entry:{articleId:string})=>entry.articleId===id);
    if(batch.data?.state!=='prepared'||!allocation) return Response.json({...base,status:batch.data?.state??'not_prepared'},{headers});
    return Response.json({...base,status:'prepared',authorPnr:formatUnits(BigInt(allocation.authorAmount),18),curatorPnr:formatUnits(BigInt(allocation.curatorAmount),18),paymentConfirmed:false},{headers});
  } catch {
    console.error('Article reward summary unavailable');
    return Response.json({status:'unavailable'},{status:503,headers});
  }
}

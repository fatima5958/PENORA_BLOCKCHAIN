import { createClient } from '@supabase/supabase-js';
import { isAddress, verifyMessage, zeroAddress, type Hex } from 'viem';
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request) {
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token) return Response.json({error:'Sign in to verify your reward wallet.'},{status:401,headers});
  if(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({error:'Reward wallet verification is not configured yet.'},{status:503,headers});
  if(Number(request.headers.get('content-length')??0)>4096) return Response.json({error:'Request too large'},{status:413,headers});
  try {
    const raw=await request.text();
    if(raw.length>4096) return Response.json({error:'Request too large'},{status:413,headers});
    const body=JSON.parse(raw);
    const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await db.auth.getUser(token);
    if(error||!data.user) return Response.json({error:'A verified account session is required.'},{status:401,headers});
    if(body.step==='challenge') {
      if(typeof body.address!=='string'||!isAddress(body.address)||body.address.toLowerCase()===zeroAddress) return Response.json({error:'Invalid reward wallet'},{status:400,headers});
      const challenge=await db.rpc('issue_reward_wallet_challenge',{p_author:data.user.id,p_wallet:body.address.toLowerCase(),p_origin:new URL(request.url).origin});
      if(challenge.error) return Response.json({error:'Wallet challenge unavailable. Please try again later.'},{status:challenge.error.message==='Challenge rate limit'?429:503,headers});
      return Response.json(challenge.data,{headers});
    }
    if(body.step!=='verify'||typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)||typeof body.signature!=='string'||!/^0x[0-9a-f]{130}$/i.test(body.signature)) return Response.json({error:'Invalid verification request'},{status:400,headers});
    const challenge=await db.from('reward_wallet_challenges').select('wallet_address,message,expires_at,used_at').eq('id',body.id).eq('author_id',data.user.id).maybeSingle();
    const row=challenge.data;
    if(challenge.error||!row||row.used_at||Date.parse(row.expires_at)<=Date.now()) return Response.json({error:'Challenge expired or already used.'},{status:409,headers});
    if(!await verifyMessage({address:row.wallet_address as Hex,message:row.message,signature:body.signature as Hex})) return Response.json({error:'Wallet signature does not match.'},{status:403,headers});
    const consumed=await db.rpc('consume_reward_wallet_challenge',{p_author:data.user.id,p_challenge:body.id});
    if(consumed.error||consumed.data!==true) return Response.json({error:'Challenge expired or already used.'},{status:409,headers});
    return Response.json({verified:true,address:row.wallet_address},{headers});
  } catch {
    console.error('Reward wallet verification unavailable');
    return Response.json({error:'Unable to verify reward wallet.'},{status:400,headers});
  }
}

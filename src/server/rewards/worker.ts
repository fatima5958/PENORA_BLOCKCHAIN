import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createPublicClient, http, parseAbi, type PublicClient, type Hex } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { calculateArticleRewards, type VerifiedRewardVote } from '../../lib/rewards/articleRewards';
import { buildArticleRewardProofs } from '../../lib/rewards/merkle';
import { rewardWorkerConfig, minuteBudget } from './config';
import { indexArticleVotes } from './indexer';

const abi=parseAbi(['function REWARD_WINDOW() view returns (uint256)','function pnrToken() view returns (address)']);
export const serializeRewards=(value:unknown)=>JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item));
interface Batch {
  slot_start:string; budget:string; chain_id:number; distributor:`0x${string}`; influence_contract:`0x${string}`;
  from_block:string; through_block:string; through_block_hash:Hex; index_cursor:string;
  articles_snapshot:Array<{id:string;author:string;publishedAt:string}>;
  indexed_votes:Record<string,Array<Omit<VerifiedRewardVote,'effectiveInfluence'>&{effectiveInfluence:string}>>;
  state:'reserved'|'prepared'|'blocked';
}
export class RewardWorker {
  constructor(private db:SupabaseClient,private chain:PublicClient,private config:ReturnType<typeof rewardWorkerConfig>) {}
  private async rpc(name:string,args:Record<string,unknown>) {
    const {data,error}=await this.db.rpc(name,args);
    if(error) throw new Error(error.message);
    return data;
  }
  private async firstBlockAt(timestamp:number,head:bigint) {
    if(this.config.startBlock>head) throw new Error('REWARD_START_BLOCK_INVALID');
    let low=this.config.startBlock,high=head;
    while(low<high) {
      const middle=(low+high)/2n;
      const block=await this.chain.getBlock({blockNumber:middle});
      if(Number(block.timestamp)*1000<timestamp) low=middle+1n; else high=middle;
    }
    return low;
  }
  async run() {
    if(await this.chain.getChainId()!==80002) throw new Error('REWARD_CHAIN_MISMATCH');
    const window=await this.chain.readContract({address:this.config.distributor,abi,functionName:'REWARD_WINDOW'});
    if(window!==604800n) throw new Error('REWARD_CONTRACT_POLICY_MISMATCH');
    // Only finalize against the RPC's finalized chain, never a browser-supplied "confirmed" head.
    const head=await this.chain.getBlock({blockTag:'finalized'});
    if(head.number===null||!head.hash) throw new Error('REWARD_FINALITY_UNAVAILABLE');
    const through=head.number;
    const closedBefore=new Date(Number(head.timestamp)*1000-60000).toISOString();
    const pending=await this.db.from('article_reward_batches').select('slot_start').eq('state','reserved').order('slot_start').limit(1).maybeSingle();
    if(pending.error) throw new Error('REWARD_LEDGER_UNAVAILABLE');
    let slot:string|undefined=pending.data?.slot_start;
    if(!slot) {
      slot=await this.rpc('next_article_reward_slot',{p_closed_before:closedBefore})??undefined;
      if(!slot) return {status:'idle'};
    }
    const slotMs=Date.parse(slot);
    const lease=randomUUID();
    // Historical range begins at the first possible vote in this cohort, not genesis.
    const from=await this.firstBlockAt(slotMs-604800000,through);
    const batch=await this.rpc('reserve_article_reward_batch',{
      p_slot:slot,p_daily_cap:this.config.dailyBudget.toString(),p_budget:minuteBudget(slotMs,this.config.dailyBudget).toString(),
      p_chain:80002,p_distributor:this.config.distributor,p_influence:this.config.influence,
      p_from_block:from.toString(),p_through_block:through.toString(),p_block_hash:head.hash,p_lease:lease,
    }) as Batch|null;
    if(!batch) return {status:'busy_or_empty'};
    if(batch.state==='prepared') return {status:'already_prepared',slot};
    if(batch.state==='blocked') return {status:'blocked',slot,note:'Operator review is required before retrying a blocked batch'};
    try {
      const anchor=await this.chain.getBlock({blockNumber:BigInt(batch.through_block)});
      if(anchor.hash?.toLowerCase()!==batch.through_block_hash.toLowerCase()) throw new Error('REWARD_CHAIN_REORG');
      const cursor=BigInt(batch.index_cursor);
      const end=cursor+9999n<BigInt(batch.through_block)?cursor+9999n:BigInt(batch.through_block);
      const votes={...batch.indexed_votes};
      if(cursor<=end) {
        const boundary=await this.chain.getBlock({blockNumber:end});
        if(!boundary.hash) throw new Error('REWARD_FINALITY_UNAVAILABLE');
        const page=await indexArticleVotes(this.chain,{chainId:80002,influence:batch.influence_contract,fromBlock:cursor,throughBlock:end,throughHash:boundary.hash},batch.articles_snapshot);
        for(const article of page) votes[article.id]=[...(votes[article.id]??[]),...serializeRewards(article.votes)];
      }
      // Recheck the original anchor after the RPC reads, before any durable result.
      if((await this.chain.getBlock({blockNumber:BigInt(batch.through_block)})).hash?.toLowerCase()!==batch.through_block_hash.toLowerCase()) throw new Error('REWARD_CHAIN_REORG');
      if(end<BigInt(batch.through_block)) {
        const saved=await this.rpc('checkpoint_article_reward_batch',{p_slot:slot,p_lease:lease,p_next_block:(end+1n).toString(),p_votes:votes});
        if(!saved) throw new Error('REWARD_LEASE_LOST');
        return {status:'indexing',slot,nextBlock:(end+1n).toString()};
      }
      const articles=batch.articles_snapshot.map(article=>({...article,votes:(votes[article.id]??[]).map(vote=>({...vote,effectiveInfluence:BigInt(vote.effectiveInfluence)}))}));
      const allocation=calculateArticleRewards(articles,BigInt(batch.budget),Number(anchor.timestamp)*1000);
      const plan=serializeRewards({version:1,chainId:80002,distributor:batch.distributor,influence:batch.influence_contract,slot,
        confirmedThroughBlock:batch.through_block,confirmedThroughHash:batch.through_block_hash,...allocation,
        articles:allocation.allocations.map(article=>({...article,...buildArticleRewardProofs(article,80002n,batch.distributor)}))});
      const saved=await this.rpc('finish_article_reward_batch',{p_slot:slot,p_lease:lease,p_plan:plan,p_error:null});
      if(!saved) throw new Error('REWARD_LEASE_LOST');
      return {status:'prepared',slot,articles:articles.length,distributed:allocation.distributed.toString(),reserve:allocation.reserve.toString()};
    } catch(error) {
      const code=error instanceof Error&&/^REWARD_[A-Z_]+$/.test(error.message)?error.message:'REWARD_PROCESSING_FAILED';
      await this.rpc('finish_article_reward_batch',{p_slot:slot,p_lease:lease,p_plan:null,p_error:code});
      throw new Error(code);
    }
  }
}
export function createRewardWorker(config:ReturnType<typeof rewardWorkerConfig>) {
  const db=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const chain=createPublicClient({chain:polygonAmoy,transport:http(config.rpcUrl,{timeout:12000,retryCount:0})});
  return new RewardWorker(db,chain,config);
}

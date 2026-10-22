import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import type { SupabaseClient } from '@supabase/supabase-js';
import { rewardWorkerConfig, minuteBudget } from '../server/rewards/config';
import { indexArticleVotes } from '../server/rewards/indexer';
import { RewardWorker } from '../server/rewards/worker';
import { articleContentId } from '../lib/rewards/merkle';
import { POST as processRewards } from '../../api/rewards/process';
const author='0x1111111111111111111111111111111111111111',voter='0x2222222222222222222222222222222222222222';
const distributor='0x3333333333333333333333333333333333333333',influence='0x4444444444444444444444444444444444444444';
const hash=`0x${'aa'.repeat(32)}` as const,tx=`0x${'bb'.repeat(32)}` as const;
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-server-key',CRON_SECRET:'x'.repeat(32),REWARDS_RPC_URL:'https://rpc.example.com',REWARDS_ARTICLE_CONTRACT:distributor,REWARDS_INFLUENCE_CONTRACT:influence,REWARDS_DAILY_BUDGET_PNR:'1440',REWARDS_INFLUENCE_START_BLOCK:'0'};
const article={id:'11111111-2222-4333-8444-555555555555',author,publishedAt:'2020-01-01T00:00:00Z'};
const log={address:influence,blockNumber:1n,blockHash:hash,transactionHash:tx,logIndex:0,removed:false,args:{contentId:articleContentId(article.id),voter,direction:1,effectiveInfluence:10n}};
const chain=()=>({getChainId:vi.fn().mockResolvedValue(80002),readContract:vi.fn().mockResolvedValue(604800n),getBlock:vi.fn().mockResolvedValue({number:20n,hash,timestamp:1578528000n}),getLogs:vi.fn().mockResolvedValue([log])});
const source={chainId:80002,influence,fromBlock:0n,throughBlock:20n,throughHash:hash} as const;
const asChain=(c:ReturnType<typeof chain>)=>c as unknown as PublicClient;
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
describe('server reward configuration',()=>{
 it('requires explicit credentials, addresses and funded budget configuration',()=>{expect(()=>rewardWorkerConfig({})).toThrow();expect(rewardWorkerConfig(env).dailyBudget).toBe(1440n*10n**18n);});
 it.each([{REWARDS_ARTICLE_CONTRACT:'0x'+'0'.repeat(40)},{REWARDS_DAILY_BUDGET_PNR:'0'},{REWARDS_DAILY_BUDGET_PNR:'1e9'},{REWARDS_DAILY_BUDGET_PNR:'1.1234567890123456789'},{CRON_SECRET:'short'},{REWARDS_RPC_URL:'http://rpc.example.com'}])('rejects invalid server configuration %j',overrides=>expect(()=>rewardWorkerConfig({...env,...overrides})).toThrow());
 it('reserves at most the exact daily cap including integer dust',()=>{const start=Date.parse('2020-01-08T00:00:00Z'),cap=10n**30n+17n;let sum=0n;for(let i=0;i<1440;i++)sum+=minuteBudget(start+i*60000,cap);expect(sum).toBe(cap);expect(()=>minuteBudget(start+1,cap)).toThrow();});
});
describe('canonical influence indexer',()=>{
 it('filters by source/content and derives timestamps from canonical blocks',async()=>{const c=chain();c.getBlock.mockResolvedValue({number:20n,hash,timestamp:1577836801n});const result=await indexArticleVotes(asChain(c),source,[article]);expect(result[0].votes[0]).toMatchObject({voter,effectiveInfluence:10n,timestampMs:1577836801000});expect(c.getLogs.mock.calls[0][0]).toMatchObject({address:influence,strict:true});});
 it('rejects wrong chains before querying logs',async()=>{const c=chain();c.getChainId.mockResolvedValue(1);await expect(indexArticleVotes(asChain(c),source,[article])).rejects.toThrow('CHAIN_MISMATCH');expect(c.getLogs).not.toHaveBeenCalled();});
 it('rejects an invalid block range',async()=>{await expect(indexArticleVotes(asChain(chain()),{...source,fromBlock:21n},[article])).rejects.toThrow('BLOCK_RANGE');});
 it.each([{removed:true},{address:author},{transactionHash:null}])('rejects invalid chain logs %j',async overrides=>{const c=chain();c.getLogs.mockResolvedValue([{...log,...overrides}] as never);await expect(indexArticleVotes(asChain(c),source,[article])).rejects.toThrow();});
 it('rejects duplicate logs',async()=>{const c=chain();c.getLogs.mockResolvedValue([log,log]);await expect(indexArticleVotes(asChain(c),source,[article])).rejects.toThrow('DUPLICATE_LOG');});
 it('blocks settlement after a reorg',async()=>{const c=chain();c.getBlock.mockResolvedValueOnce({number:20n,hash,timestamp:1578528000n}).mockResolvedValue({number:20n,hash:tx,timestamp:1578528000n});c.getLogs.mockResolvedValue([]);await expect(indexArticleVotes(asChain(c),source,[article])).rejects.toThrow('CHAIN_REORG');});
 it('does not turn a failed provider page into zero votes',async()=>{const c=chain();c.getLogs.mockRejectedValue(new Error('RPC failed'));await expect(indexArticleVotes(asChain(c),source,[article])).rejects.toThrow('RPC failed');});
});
function ledger(batch:Record<string,unknown>|null) {
 const rpc=vi.fn(async(name:string,_args?:Record<string,unknown>)=>({data:name==='next_article_reward_slot'?'2020-01-08T00:00:00Z':name==='reserve_article_reward_batch'?batch:true,error:null}));
 const pending={select:()=>pending,eq:()=>pending,order:()=>pending,limit:()=>pending,maybeSingle:async()=>({data:null,error:null})};
 return {rpc,from:()=>pending};
}
function batch(through='20') {return {slot_start:'2020-01-08T00:00:00Z',budget:'1000000000000000000',chain_id:80002,distributor,influence_contract:influence,from_block:'0',through_block:through,through_block_hash:hash,index_cursor:'0',articles_snapshot:[article],indexed_votes:{},state:'reserved'};}
describe('durable worker',()=>{
 it('prepares a deterministic plan without sending transactions',async()=>{const db=ledger(batch()),c=chain();c.getBlock.mockImplementation(async (args?:{blockNumber?:bigint})=>({number:20n,hash,timestamp:args?.blockNumber===1n?1577836801n:1578528000n}));const result=await new RewardWorker(db as unknown as SupabaseClient,asChain(c),rewardWorkerConfig(env)).run();expect(result.status).toBe('prepared');const finish=db.rpc.mock.calls.find(([name])=>name==='finish_article_reward_batch');expect(finish?.[1]?.p_plan).toMatchObject({distributed:'900000000000000000',reserve:'100000000000000000',allocations:[{authorAmount:'700000000000000000',curatorAmount:'200000000000000000'}]});});
 it('checkpoints long ranges instead of losing indexed progress',async()=>{const db=ledger(batch('20000')),c=chain();c.getLogs.mockResolvedValue([]);const result=await new RewardWorker(db as unknown as SupabaseClient,asChain(c),rewardWorkerConfig(env)).run();expect(result).toMatchObject({status:'indexing',nextBlock:'10000'});expect(db.rpc.mock.calls.some(([name])=>name==='finish_article_reward_batch')).toBe(false);});
 it('records provider errors as blocked and never prepares a partial allocation',async()=>{const db=ledger(batch()),c=chain();c.getLogs.mockRejectedValue(new Error('private provider URL'));await expect(new RewardWorker(db as unknown as SupabaseClient,asChain(c),rewardWorkerConfig(env)).run()).rejects.toThrow('REWARD_PROCESSING_FAILED');});
 it('does not execute another active lease',async()=>{const db=ledger(null);expect((await new RewardWorker(db as unknown as SupabaseClient,asChain(chain()),rewardWorkerConfig(env)).run()).status).toBe('busy_or_empty');});
});
describe('protected reward processor',()=>{
 it('rejects requests with no secret and malformed or Unicode bearer tokens',async()=>{vi.stubEnv('CRON_SECRET','x'.repeat(32));for(const token of ['', 'wrong', 'é'.repeat(32)]) {const response=await processRewards(new Request('https://example.com/api/rewards/process',{headers:{Authorization:'Bearer '+token}}));expect(response.status).toBe(401);}});
 it('fails closed with sanitized errors when runtime configuration is missing',async()=>{vi.stubEnv('CRON_SECRET','x'.repeat(32));vi.stubEnv('SUPABASE_URL','');vi.spyOn(console,'error').mockImplementation(()=>{});const response=await processRewards(new Request('https://example.com/api/rewards/process',{headers:{Authorization:'Bearer '+'x'.repeat(32)}}));expect(response.status).toBe(503);expect(await response.json()).toEqual({status:'blocked',code:'REWARDS_NOT_CONFIGURED'});});
});

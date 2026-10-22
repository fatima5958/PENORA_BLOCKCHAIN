import { parseAbiItem, type PublicClient, type Hex } from 'viem';
import { articleContentId } from '../../lib/rewards/merkle';
import type { RewardArticle, VerifiedRewardVote } from '../../lib/rewards/articleRewards';
const event=parseAbiItem('event VoteInfluenceCast(bytes32 indexed contentId, address indexed voter, uint256 voteWeightBps, uint256 remainingManaBps, uint256 effectiveInfluence, int8 direction)');

/** A failed page, incomplete range or changed chain anchor blocks settlement; no partial empty fallback. */
export async function indexArticleVotes(client:PublicClient,config:{chainId:number;influence:`0x${string}`;fromBlock:bigint;throughBlock:bigint;throughHash:`0x${string}`},articles:Array<Omit<RewardArticle,'votes'>>) {
  if(config.fromBlock<0n||config.throughBlock<config.fromBlock) throw new Error('REWARD_INVALID_BLOCK_RANGE');
  if(await client.getChainId()!==config.chainId) throw new Error('REWARD_CHAIN_MISMATCH');
  const before=await client.getBlock({blockNumber:config.throughBlock});
  if(before.hash?.toLowerCase()!==config.throughHash.toLowerCase()) throw new Error('REWARD_CHAIN_REORG');
  const byContent=new Map(articles.map(article=>[articleContentId(article.id).toLowerCase(),article.id]));
  const output=new Map<string,VerifiedRewardVote[]>(articles.map(article=>[article.id,[]]));
  const timestamps=new Map<bigint,number>();
  const hashes=new Map<bigint,string>();
  const seen=new Set<string>();
  for(let from=config.fromBlock;from<=config.throughBlock;from+=1000n) {
    const to=from+999n>config.throughBlock?config.throughBlock:from+999n;
    const logs=await client.getLogs({address:config.influence,event,args:{contentId:[...byContent.keys()] as Hex[]},fromBlock:from,toBlock:to,strict:true});
    for(const log of logs) {
      if(log.removed || log.blockNumber===null || log.transactionHash===null || log.logIndex===null) throw new Error('REWARD_NONCANONICAL_LOG');
      if(log.address.toLowerCase()!==config.influence.toLowerCase() || log.blockNumber<from || log.blockNumber>to) throw new Error('REWARD_INVALID_LOG_SOURCE');
      const articleId=byContent.get(log.args.contentId.toLowerCase());
      if(!articleId) continue;
      const id=`${config.chainId}:${log.transactionHash.toLowerCase()}:${log.logIndex}`;
      if(seen.has(id)) throw new Error('REWARD_DUPLICATE_LOG');
      seen.add(id);
      if(!timestamps.has(log.blockNumber)) {
        const block=await client.getBlock({blockNumber:log.blockNumber});
        if(block.hash?.toLowerCase()!==log.blockHash?.toLowerCase()) throw new Error('REWARD_CHAIN_REORG');
        hashes.set(log.blockNumber,block.hash!.toLowerCase());
        timestamps.set(log.blockNumber,Number(block.timestamp)*1000);
      }
      if(hashes.get(log.blockNumber)!==log.blockHash?.toLowerCase()) throw new Error('REWARD_CHAIN_REORG');
      output.get(articleId)!.push({eventId:id,voter:log.args.voter,direction:log.args.direction as 1|-1,effectiveInfluence:log.args.effectiveInfluence,timestampMs:timestamps.get(log.blockNumber)!});
    }
  }
  const after=await client.getBlock({blockNumber:config.throughBlock});
  if(after.hash?.toLowerCase()!==before.hash?.toLowerCase()) throw new Error('REWARD_CHAIN_REORG');
  return articles.map(article=>({...article,votes:output.get(article.id)!}));
}

import { timingSafeEqual } from 'node:crypto';
import { rewardWorkerConfig, RewardsConfigurationError } from '../../src/server/rewards/config';
import { createRewardWorker } from '../../src/server/rewards/worker';

export async function POST(request:Request) {
  const secret=process.env.CRON_SECRET;
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
  const supplied=Buffer.from(token),expected=Buffer.from(secret??'');
  if(!secret || supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) {
    return Response.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
  }
  try {
    const result=await createRewardWorker(rewardWorkerConfig()).run();
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    // Never expose provider URLs, credentials or raw database errors in a response/log.
    const code=error instanceof RewardsConfigurationError?'REWARDS_NOT_CONFIGURED':'REWARD_PROCESSING_BLOCKED';
    console.error('Reward worker blocked',{code});
    return Response.json({status:'blocked',code},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
export const GET=POST;

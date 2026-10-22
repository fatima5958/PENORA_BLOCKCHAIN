import { isAddress, parseUnits, zeroAddress } from 'viem';
export class RewardsConfigurationError extends Error {
  constructor(public readonly missing: string[]) { super('Reward worker configuration is incomplete'); }
}
export function rewardWorkerConfig(env: NodeJS.ProcessEnv = process.env) {
  const required = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','CRON_SECRET','REWARDS_RPC_URL','REWARDS_ARTICLE_CONTRACT','REWARDS_INFLUENCE_CONTRACT','REWARDS_DAILY_BUDGET_PNR','REWARDS_INFLUENCE_START_BLOCK'];
  const missing = required.filter(key => !env[key]);
  if(missing.length) throw new RewardsConfigurationError(missing);
  for(const key of ['REWARDS_ARTICLE_CONTRACT','REWARDS_INFLUENCE_CONTRACT']) {
    if(!isAddress(env[key]!) || env[key]!.toLowerCase()===zeroAddress) throw new RewardsConfigurationError([key]);
  }
  for(const key of ['SUPABASE_URL','REWARDS_RPC_URL']) {
    try { if(new URL(env[key]!).protocol!=='https:') throw new Error(); } catch { throw new RewardsConfigurationError([key]); }
  }
  if(!/^\d+(\.\d{1,18})?$/.test(env.REWARDS_DAILY_BUDGET_PNR!) || !/^\d+$/.test(env.REWARDS_INFLUENCE_START_BLOCK!)) throw new RewardsConfigurationError(['REWARDS_DAILY_BUDGET_PNR','REWARDS_INFLUENCE_START_BLOCK']);
  const dailyBudget=parseUnits(env.REWARDS_DAILY_BUDGET_PNR!,18);
  if(dailyBudget<=0n || dailyBudget>=2n**256n) throw new RewardsConfigurationError(['REWARDS_DAILY_BUDGET_PNR']);
  if(env.CRON_SECRET!.length<32) throw new RewardsConfigurationError(['CRON_SECRET']);
  return { supabaseUrl:env.SUPABASE_URL!,serviceKey:env.SUPABASE_SERVICE_ROLE_KEY!,secret:env.CRON_SECRET!,rpcUrl:env.REWARDS_RPC_URL!,chainId:80002,
    distributor:env.REWARDS_ARTICLE_CONTRACT!.toLowerCase() as `0x${string}`,influence:env.REWARDS_INFLUENCE_CONTRACT!.toLowerCase() as `0x${string}`,
    dailyBudget,startBlock:BigInt(env.REWARDS_INFLUENCE_START_BLOCK!) };
}
export function minuteBudget(slotMs:number,dailyBudget:bigint) {
  if(!Number.isSafeInteger(slotMs)||slotMs<0||slotMs%60000!==0||dailyBudget<0n) throw new Error('Invalid reward slot');
  const minute=Math.floor((slotMs%86400000)/60000);
  return dailyBudget/1440n+(minute===1439?dailyBudget%1440n:0n);
}

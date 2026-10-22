import { createWalletClient, custom, decodeEventLog, formatUnits, parseAbi, type Address, type Hash } from 'viem';
import { publicClient, penoraWalletService, getEthereumProvider } from '../wallet/walletService';
import { PENORA_CONTRACT_ADDRESSES, isConfiguredAddress } from '../wallet/contracts';
import { polygonAmoy } from '../wallet/chain';
import { parseTokenAmount } from '../wallet/amount';
import { waitForWalletTransaction } from '../wallet/transactionReceipt';
export const EXCHANGE_ABI=parseAbi([
 'function pnrToken() view returns (address)','function usdtToken() view returns (address)',
 'function pnrPerUsdt() view returns (uint256)','function paused() view returns (bool)',
 'function quoteBuy(uint256 usdtIn) view returns (uint256)',
 'function buy(uint256 usdtIn,uint256 minimumPnr,uint256 deadline) returns (uint256)',
 'event Purchased(address indexed buyer,uint256 usdtIn,uint256 pnrOut)',
]);
const tokenAbi=parseAbi(['function decimals() view returns (uint8)','function balanceOf(address) view returns (uint256)','function allowance(address,address) view returns (uint256)','function approve(address,uint256) returns (bool)']);
export const exchangeAddress=(import.meta.env.PUBLIC_PNR_EXCHANGE_ADDRESS||'') as Address;
export const exchangeConfigured=()=>isConfiguredAddress(exchangeAddress)&&isConfiguredAddress(PENORA_CONTRACT_ADDRESSES.PNR_TOKEN)&&isConfiguredAddress(PENORA_CONTRACT_ADDRESSES.USDT_TOKEN);
export interface MarketSnapshot {rate:bigint;inventory:bigint;paused:boolean;block:bigint;}
export interface BuyQuote {input:bigint;output:bigint;minimum:bigint;createdAt:number;market:MarketSnapshot;}
export function minimumReceived(output:bigint,bps=50) {
 if(output<=0n||!Number.isInteger(bps)||bps<0||bps>100) throw new Error('Invalid slippage');
 const minimum=output*BigInt(10000-bps)/10000n;
 if(minimum===0n) throw new Error('Amount is too small');
 return minimum;
}
export async function readMarket():Promise<MarketSnapshot> {
 if(!exchangeConfigured()) throw new Error('Trading opens after the Amoy exchange is deployed and funded.');
 if(await publicClient.getChainId()!==80002) throw new Error('Amoy network verification failed.');
 const block=await publicClient.getBlockNumber({cacheTime:0});
 const read=(functionName:'pnrToken'|'usdtToken'|'pnrPerUsdt'|'paused')=>publicClient.readContract({address:exchangeAddress,abi:EXCHANGE_ABI,functionName,blockNumber:block});
 const [pnr,usdt,rate,paused,pnrDecimals,usdtDecimals,inventory]=await Promise.all([
  read('pnrToken'),read('usdtToken'),read('pnrPerUsdt'),read('paused'),
  publicClient.readContract({address:PENORA_CONTRACT_ADDRESSES.PNR_TOKEN as Address,abi:tokenAbi,functionName:'decimals',blockNumber:block}),
  publicClient.readContract({address:PENORA_CONTRACT_ADDRESSES.USDT_TOKEN as Address,abi:tokenAbi,functionName:'decimals',blockNumber:block}),
  publicClient.readContract({address:PENORA_CONTRACT_ADDRESSES.PNR_TOKEN as Address,abi:tokenAbi,functionName:'balanceOf',args:[exchangeAddress],blockNumber:block}),
 ]);
 if(String(pnr).toLowerCase()!==PENORA_CONTRACT_ADDRESSES.PNR_TOKEN.toLowerCase()||String(usdt).toLowerCase()!==PENORA_CONTRACT_ADDRESSES.USDT_TOKEN.toLowerCase()||pnrDecimals!==18||usdtDecimals!==6||typeof rate!=='bigint'||rate<=0n||typeof paused!=='boolean') throw new Error('Exchange token configuration could not be verified.');
 return {rate,inventory,paused,block};
}
export async function getBuyQuote(amount:string):Promise<BuyQuote> {
 const input=parseTokenAmount(amount,6),market=await readMarket();
 if(market.paused) throw new Error('The purchase desk is paused.');
 const output=await publicClient.readContract({address:exchangeAddress,abi:EXCHANGE_ABI,functionName:'quoteBuy',args:[input],blockNumber:market.block});
 if(output>market.inventory) throw new Error('Not enough PNR liquidity for this amount.');
 return {input,output,minimum:minimumReceived(output),createdAt:Date.now(),market};
}
export interface PendingBuy {account:Address;hash:Hash;stage:'approval'|'buy';input:string;minimum:string;}
const storageKey=()=>`penora:exchange:v1:80002:${exchangeAddress.toLowerCase()}`;
export function pendingBuy():PendingBuy|null {
 try {const value=JSON.parse(localStorage.getItem(storageKey())||'null');return value&&/^0x[\da-f]{64}$/i.test(value.hash)&&/^0x[\da-f]{40}$/i.test(value.account)&&['buy','approval'].includes(value.stage)&&/^\d+$/.test(value.input)&&/^\d+$/.test(value.minimum)?value:null;}catch{return null;}
}
function savePending(value:PendingBuy|null) {if(value)localStorage.setItem(storageKey(),JSON.stringify(value));else localStorage.removeItem(storageKey());}
export async function reconcileBuy() {
 const pending=pendingBuy(); if(!pending)return null;
 const result=await waitForWalletTransaction(pending.hash);
 if(result.status==='pending'){savePending({...pending,hash:result.hash});return {...result,stage:pending.stage,amount:undefined};}
 let amount:bigint|undefined;
 if(result.status==='confirmed'&&pending.stage==='buy') {
  for(const log of result.receipt!.logs) {
   if(log.address.toLowerCase()!==exchangeAddress.toLowerCase())continue;
   try {const event=decodeEventLog({abi:EXCHANGE_ABI,data:log.data,topics:log.topics});if(event.eventName==='Purchased'&&event.args.buyer.toLowerCase()===pending.account.toLowerCase()&&event.args.usdtIn===BigInt(pending.input)&&event.args.pnrOut>=BigInt(pending.minimum))amount=event.args.pnrOut;}catch{}
  }
  if(amount===undefined)throw new Error('Receipt needs review: the expected purchase event was not verified.');
 }
 savePending(null);
 return {...result,stage:pending.stage,amount};
}
let submitting=false;
export async function buyPnr(quote:BuyQuote,account:Address,onStage:(message:string)=>void) {
 if(submitting||pendingBuy())throw new Error('Resolve the pending transaction before buying again.');
 if(Date.now()-quote.createdAt>60000)throw new Error('Quote expired. Refresh before reviewing again.');
 submitting=true;
 try {
  // Verify storage before requesting any signature, so pending hashes can survive reloads.
  localStorage.setItem('penora:exchange:storage-check','1');localStorage.removeItem('penora:exchange:storage-check');
  const provider=getEthereumProvider();if(!provider)throw new Error('Open this page in your connected wallet browser.');
  const wallet=createWalletClient({chain:polygonAmoy,transport:custom(provider)});
  const assertContext=async()=>{
   const accounts=await wallet.getAddresses();const chain=await wallet.getChainId();
   const current=penoraWalletService.getState();
   if(chain!==80002||accounts[0]?.toLowerCase()!==account.toLowerCase()||current.address?.toLowerCase()!==account.toLowerCase()||!current.isCorrectNetwork)throw new Error('Wallet account or network changed. Review the purchase again.');
  };
  await assertContext();
  const current=await getBuyQuote(formatUnits(quote.input,6));
  if(current.output<quote.minimum)throw new Error('Price moved beyond your minimum. Request a new quote.');
  const usdt=PENORA_CONTRACT_ADDRESSES.USDT_TOKEN as Address;
  const [balance,allowance]=await Promise.all([
   publicClient.readContract({address:usdt,abi:tokenAbi,functionName:'balanceOf',args:[account]}),
   publicClient.readContract({address:usdt,abi:tokenAbi,functionName:'allowance',args:[account,exchangeAddress]}),
  ]);
  if(balance<quote.input)throw new Error('Insufficient test USDT balance.');
  if(allowance<quote.input) {
   // A reset supports USDT tokens that reject changing a nonzero allowance directly.
   for(const approval of (allowance>0n?[0n,quote.input]:[quote.input])) {
    onStage(approval===0n?'Reset USDT approval in your wallet':'Approve the exact USDT amount in your wallet');
    await assertContext();
    const {request}=await publicClient.simulateContract({address:usdt,abi:tokenAbi,functionName:'approve',args:[exchangeAddress,approval],account});
    await assertContext();const hash=await wallet.writeContract(request);
    savePending({account,hash,stage:'approval',input:quote.input.toString(),minimum:quote.minimum.toString()});
    onStage('Waiting for USDT approval confirmation…');const receipt=await reconcileBuy();
    if(receipt?.status!=='confirmed')throw new Error(receipt?.status==='pending'?'Approval is pending. Check its status before retrying.':'Approval failed or was cancelled.');
   }
  }
  await assertContext();
  if(Date.now()-quote.createdAt>60000)throw new Error('Approval completed. Refresh your quote before purchasing.');
  const block=await publicClient.getBlock();
  const {request}=await publicClient.simulateContract({address:exchangeAddress,abi:EXCHANGE_ABI,functionName:'buy',args:[quote.input,quote.minimum,block.timestamp+180n],account});
  await assertContext();onStage('Confirm your PNR purchase in your wallet');
  const hash=await wallet.writeContract(request);
  savePending({account,hash,stage:'buy',input:quote.input.toString(),minimum:quote.minimum.toString()});
  onStage('Purchase submitted. Waiting for onchain confirmation…');
  return await reconcileBuy();
 } finally {submitting=false;}
}

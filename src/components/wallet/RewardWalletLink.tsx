import React, { useEffect, useRef, useState } from 'react';
import { toHex } from 'viem';
import { supabase } from '../../lib/supabaseClient';
import { getEthereumProvider } from '../../lib/wallet/walletService';
export function RewardWalletLink({address}:{address:string|null}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const context=useRef(0);
  useEffect(()=>{context.current++;setBusy(false);setMessage('');return()=>{context.current++;};},[address]);
  const link=async()=>{
    if(!address||busy) return;
    const version=context.current;
    setBusy(true);setMessage('');
    try {
      const {data}=await supabase.auth.getSession();
      if(!data.session?.access_token) throw new Error('Sign in with a verified account session before linking rewards.');
      const send=async(body:unknown)=>{
        const response=await fetch('/api/rewards/wallet',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session!.access_token}`},body:JSON.stringify(body)});
        const result=await response.json(); if(!response.ok) throw new Error(result.error||'Verification unavailable'); return result;
      };
      const challenge=await send({step:'challenge',address});
      if(version!==context.current) return;
      const eth=getEthereumProvider();
      if(!eth) throw new Error('Connect your wallet first.');
      const accounts=await eth.request({method:'eth_accounts'});
      if(accounts?.[0]?.toLowerCase()!==address.toLowerCase()) throw new Error('Wallet account changed. Please try again.');
      const signature=await eth.request({method:'personal_sign',params:[toHex(challenge.message),address]});
      if(version!==context.current) return;
      const result=await send({step:'verify',id:challenge.id,signature});
      if(version===context.current) setMessage(result.verified?'Reward wallet verified. New article settlements will use this address.':'Verification unavailable.');
    } catch(error) {
      if(version===context.current) setMessage(error instanceof Error?error.message:'Reward wallet verification failed.');
    } finally { if(version===context.current) setBusy(false); }
  };
  return <section className="rounded-2xl border border-[#007c8b]/20 bg-[var(--wallet-surface)] p-5 space-y-2">
    <h2 className="font-semibold text-[var(--wallet-text)]">Your blog reward wallet</h2>
    <p className="text-sm text-[var(--wallet-muted)]">Link your account to a wallet you control. Signing verifies ownership and does not send tokens.</p>
    <button type="button" disabled={!address||busy} onClick={link} className="rounded-xl bg-[#007c8b] text-white px-4 py-2 disabled:opacity-50">{busy?'Verifying…':'Use connected wallet for blog rewards'}</button>
    {message&&<p role="status" className="text-sm text-[var(--wallet-muted)] break-words">{message}</p>}
  </section>;
}

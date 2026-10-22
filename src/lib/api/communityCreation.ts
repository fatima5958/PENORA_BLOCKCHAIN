import {supabase} from '../supabaseClient';
import type {CommunityRecord} from './types';
export const COMMUNITY_MIN_REPUTATION=65;
export interface CommunityCreationInput {name:string;slug:string;description:string;requestId:string;}
export interface CommunityCreationStatus {reputation:number|null;minimum:number;eligible:boolean;}
export function suggestCommunitySlug(name:string) {return name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48).replace(/-$/,'');}
export function validateCommunity(input:CommunityCreationInput):string|null {
 const name=input.name.trim(),slug=input.slug.trim(),description=input.description.trim();
 if(name.length<3||name.length>60)return 'Name must be 3–60 characters.';
 if(slug.length<3||slug.length>48||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))return 'Community URL must be 3–48 lowercase letters, numbers or single hyphens.';
 if(description.length<10||description.length>1000)return 'Description must be 10–1,000 characters.';
 if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(input.requestId))return 'Refresh the creation form and try again.';
 return null;
}
export async function getCommunityCreationStatus():Promise<{data:CommunityCreationStatus|null;error:string|null}> {
 try {
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return {data:null,error:'A verified account session is required to create communities.'};
  const {data,error}=await supabase.rpc('community_creation_status');
  if(error||!data||data.minimum!==COMMUNITY_MIN_REPUTATION||typeof data.eligible!=='boolean'||(data.reputation!==null&&!Number.isInteger(data.reputation)))return {data:null,error:'Unable to verify community creation eligibility. Please retry.'};
  return {data,error:null};
 }catch{return {data:null,error:'Unable to verify community creation eligibility. Please retry.'};}
}
export async function createCommunity(input:CommunityCreationInput):Promise<{data:CommunityRecord|null;error:string|null}> {
 const validation=validateCommunity(input);if(validation)return {data:null,error:validation};
 try {
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return {data:null,error:'A verified account session is required to create communities.'};
  const {data,error}=await supabase.rpc('create_community',{p_name:input.name.trim(),p_slug:input.slug.trim(),p_description:input.description.trim(),p_request_id:input.requestId});
  if(error)return {data:null,error:error.code==='23505'?'This community name or URL is already taken.':error.code==='42501'?'Community creation requires a verified profile with reputation 65 or higher.':'Community could not be saved. Retry with the same details to check the original request.'};
  const row=Array.isArray(data)?data[0]:data;
  if(!row?.id||row.id!==input.requestId||row.created_by!==user.id)return {data:null,error:'Community creation could not be confirmed. Please retry the same request.'};
  return {data:row as CommunityRecord,error:null};
 }catch{return {data:null,error:'Community could not be saved. Retry with the same details to check the original request.'};}
}

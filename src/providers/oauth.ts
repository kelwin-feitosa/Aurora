import type {Env,ProviderId,ProviderHTTP,Tokens} from '../types.ts';
import {randomToken,pkceChallenge,sha256,seal,unseal} from '../infra/crypto.ts';
import {addConnection} from '../infra/store.ts';
import {GmailAdapter} from './gmail.ts';
import {OutlookAdapter} from './outlook.ts';
import {safePublicOrigin} from '../infra/security.ts';
import {readBoundedJson} from './http.ts';

const GOOGLE_AUTH='https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN='https://oauth2.googleapis.com/token';
const MSG_AUTHORIZE='https://login.microsoftonline.com';
function tenant(env:Env):string{
 const input=env.MICROSOFT_TENANT??'organizations';
 if(!/^(organizations|common|[0-9a-fA-F-]{36})$/.test(input))throw new Error('INVALID_MS_TENANT');
 return input;
}
export function oauthEnabled(env:Env,p:ProviderId):boolean{return p==='gmail'?Boolean(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET):Boolean(env.MICROSOFT_CLIENT_ID);}
export function callbackUrl(env:Env,p:ProviderId):string{return `${safePublicOrigin(env)}/api/oauth/callback/${p}`;}
export async function beginOauth(env:Env,p:ProviderId,sessionHash:string):Promise<string>{
 if(!sessionHash||sessionHash.length!==43)throw new Error('OAUTH_SESSION_REQUIRED');
 if(!oauthEnabled(env,p))throw new Error('PROVIDER_NOT_CONFIGURED');
 const state=randomToken(32),stateHash=await sha256(state),verifier=randomToken(32),challenge=await pkceChallenge(verifier),now=Date.now();
 const ciphertext=await seal(env.APP_SECRET,verifier,`oauth:${stateHash}`);
 await env.DB.prepare('INSERT INTO oauth_pending(state_hash,provider,verifier_ciphertext,expires_at,session_hash) VALUES(?,?,?,?,?)').bind(stateHash,p,ciphertext,now+10*60_000,sessionHash).run();
 const url=new URL(p==='gmail'?GOOGLE_AUTH:`${MSG_AUTHORIZE}/${tenant(env)}/oauth2/v2.0/authorize`);
 url.searchParams.set('client_id',p==='gmail'?env.GOOGLE_CLIENT_ID!:env.MICROSOFT_CLIENT_ID!);
 url.searchParams.set('redirect_uri',callbackUrl(env,p));url.searchParams.set('response_type','code');url.searchParams.set('state',state);
 url.searchParams.set('code_challenge',challenge);url.searchParams.set('code_challenge_method','S256');
 if(p==='gmail'){
  url.searchParams.set('access_type','offline');url.searchParams.set('prompt','consent');
  url.searchParams.set('scope','openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar.calendarlist.readonly');
 }else{
  url.searchParams.set('scope','openid profile email offline_access Mail.Read Calendars.ReadWrite User.Read');
 }
 return url.toString();
}
async function exchange(http:ProviderHTTP,url:string,fields:URLSearchParams):Promise<Record<string,unknown>>{
 const resp=await http.fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:fields,redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!resp.ok)throw new Error(`TOKEN_EXCHANGE_${resp.status}`);
 return await readBoundedJson<Record<string,unknown>>(resp,64*1024);
}
export async function finishOauth(env:Env,p:ProviderId,state:string,code:string,sessionHash:string,http:ProviderHTTP={fetch:globalThis.fetch}):Promise<string>{
 if(!sessionHash||sessionHash.length!==43)throw new Error('OAUTH_SESSION_REQUIRED');
 if(!state||state.length>200||!code||code.length>4096)throw new Error('INVALID_OAUTH_CALLBACK');
 const hash=await sha256(state);
 const row=await env.DB.prepare('SELECT * FROM oauth_pending WHERE state_hash=?').bind(hash).first<{provider:ProviderId;verifier_ciphertext:string;expires_at:number;used_at:number|null;session_hash:string|null}>();
 if(!row||row.provider!==p||row.session_hash!==sessionHash||row.used_at!==null||row.expires_at<Date.now())throw new Error('OAUTH_STATE_INVALID_OR_EXPIRED');
 const claim=await env.DB.prepare('UPDATE oauth_pending SET used_at=? WHERE state_hash=? AND session_hash=? AND used_at IS NULL AND expires_at>?').bind(Date.now(),hash,sessionHash,Date.now()).run();
 if((claim.meta?.changes??0)!==1)throw new Error('OAUTH_REPLAY_BLOCKED');
 const verifier=await unseal(env.APP_SECRET,row.verifier_ciphertext,`oauth:${hash}`);
 const fields=new URLSearchParams({grant_type:'authorization_code',client_id:p==='gmail'?env.GOOGLE_CLIENT_ID!:env.MICROSOFT_CLIENT_ID!,code,redirect_uri:callbackUrl(env,p),code_verifier:verifier});
 if(p==='gmail') fields.set('client_secret',env.GOOGLE_CLIENT_SECRET!);
 if(p==='outlook'&&env.MICROSOFT_CLIENT_SECRET)fields.set('client_secret',env.MICROSOFT_CLIENT_SECRET);
 const url=p==='gmail'?GOOGLE_TOKEN:`${MSG_AUTHORIZE}/${tenant(env)}/oauth2/v2.0/token`;
 const response=await exchange(http,url,fields);
 if(typeof response.access_token!=='string'||typeof response.refresh_token!=='string'||typeof response.expires_in!=='number')throw new Error('MISSING_LONG_LIVED_OAUTH_TOKEN');
 const identity=p==='gmail'?new GmailAdapter(http):new OutlookAdapter(http);
 const email=await identity.whoAmI(response.access_token);
 const id=crypto.randomUUID();
 const tokens:Tokens={access_token:response.access_token,refresh_token:response.refresh_token,expires_at:Date.now()+Math.max(60,response.expires_in-90)*1000,scope:String(response.scope??'')};
 const cipher=await seal(env.APP_SECRET,JSON.stringify(tokens),`token:${id}:${p}`);
 await addConnection(env.DB,p,id,email.slice(0,255),cipher,Date.now());
 return id;
}
export async function validAccessToken(env:Env,connection:{id:string;provider:ProviderId;token_ciphertext:string},http:ProviderHTTP={fetch:globalThis.fetch}):Promise<string>{
 const tokens=JSON.parse(await unseal(env.APP_SECRET,connection.token_ciphertext,`token:${connection.id}:${connection.provider}`)) as Tokens;
 if(tokens.expires_at>Date.now()+90_000)return tokens.access_token;
 const p=connection.provider;
 const data=new URLSearchParams({grant_type:'refresh_token',refresh_token:tokens.refresh_token,client_id:p==='gmail'?env.GOOGLE_CLIENT_ID!:env.MICROSOFT_CLIENT_ID!});
 if(p==='gmail')data.set('client_secret',env.GOOGLE_CLIENT_SECRET!);
 if(p==='outlook'&&env.MICROSOFT_CLIENT_SECRET)data.set('client_secret',env.MICROSOFT_CLIENT_SECRET);
 const refreshed=await exchange(http,p==='gmail'?GOOGLE_TOKEN:`${MSG_AUTHORIZE}/${tenant(env)}/oauth2/v2.0/token`,data);
 if(typeof refreshed.access_token!=='string'||typeof refreshed.expires_in!=='number')throw new Error('TOKEN_REFRESH_FAILED');
 const updated:Tokens={...tokens,access_token:refreshed.access_token,refresh_token:typeof refreshed.refresh_token==='string'?refreshed.refresh_token:tokens.refresh_token,expires_at:Date.now()+Math.max(30,refreshed.expires_in-90)*1000};
 const cipher=await seal(env.APP_SECRET,JSON.stringify(updated),`token:${connection.id}:${p}`);
 const saved=await env.DB.prepare('UPDATE connections SET token_ciphertext=?, updated_at=? WHERE id=? AND token_ciphertext=?').bind(cipher,Date.now(),connection.id,connection.token_ciphertext).run();
 if(Number(saved.meta?.changes??0)!==1){
  // Another request may have rotated the refresh token. Never return stale credentials.
  const latest=await env.DB.prepare('SELECT token_ciphertext FROM connections WHERE id=?').bind(connection.id).first<{token_ciphertext:string}>();
  if(!latest)throw new Error('CONNECTION_REMOVED_DURING_REFRESH');
  const other=JSON.parse(await unseal(env.APP_SECRET,latest.token_ciphertext,`token:${connection.id}:${p}`)) as Tokens;
  if(other.expires_at<=Date.now()+15000)throw new Error('TOKEN_REFRESH_RACE_RECONNECT');
  return other.access_token;
 }
 return updated.access_token;
}

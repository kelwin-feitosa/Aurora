/** Aurora Web Push — opt-in, EMPTY payload, generic notification only.
 * RFC 8292 VAPID (ES256). No home-grown payload encryption or personal data.
 * An accepted request to a push gateway is NOT proof of device delivery.
 */
import type {Env, ProviderHTTP} from '../types.ts';
import {b64url,fromB64url,seal,unseal,sha256} from '../infra/crypto.ts';
const encoder=new TextEncoder();
export function validatePushEndpoint(raw:string):URL {
 if(typeof raw!=='string'||raw.length>2000)throw new Error('PUSH_ENDPOINT_INVALID');
 let url:URL;try{url=new URL(raw);}catch{throw new Error('PUSH_ENDPOINT_INVALID');}
 const host=url.hostname.toLowerCase();
 // Strict official push service hostname allowlist, no arbitrary fetch/SSRF.
 const supported=host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host==='push.services.mozilla.com'||host.endsWith('.push.apple.com');
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!supported)throw new Error('PUSH_ENDPOINT_REJECTED');
 return url;
}
export function pushConfigured(env:Env):boolean{
 if(env.PUSH_ENABLED!=='1'||!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY||!env.VAPID_CONTACT)return false;
 try {const key=fromB64url(env.VAPID_PUBLIC_KEY),priv=fromB64url(env.VAPID_PRIVATE_KEY);return key.length===65&&key[0]===4&&priv.length===32&&(/^mailto:[^\s@]+@[^\s@]+$/.test(env.VAPID_CONTACT)||/^https:\/\//.test(env.VAPID_CONTACT));} catch{return false;}
}
export function validatePushKeys(keys:unknown):void{
 if(!keys||typeof keys!=='object')throw new Error('PUSH_KEYS_INVALID');
 const k=keys as Record<string,unknown>;
 if(typeof k.p256dh!=='string'||typeof k.auth!=='string')throw new Error('PUSH_KEYS_INVALID');
 try {if(fromB64url(k.p256dh).length!==65||fromB64url(k.auth).length<16)throw new Error();}
 catch{throw new Error('PUSH_KEYS_INVALID');}
}
export async function subscribePush(env:Env,session:string,endpoint:string,keys:unknown,now=Date.now()):Promise<string>{
 if(!pushConfigured(env))throw new Error('PUSH_NOT_CONFIGURED');
 validatePushEndpoint(endpoint);validatePushKeys(keys);
 const id='push_'+(await sha256('push:'+endpoint)).slice(0,43);
 const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE state='active' AND id<>?").bind(id).first<{n:number}>();
 if((count?.n??0)>=8)throw new Error('PUSH_DEVICE_LIMIT');
 const enc=await seal(env.APP_SECRET,endpoint,'push-endpoint:'+id);
 await env.DB.prepare(`INSERT INTO push_subscriptions(id,session_hash,endpoint_ciphertext,state,consent_at,last_sent_at,updated_at)
  VALUES(?,?,?,'active',?,?,?) ON CONFLICT(id) DO UPDATE SET
  session_hash=excluded.session_hash,endpoint_ciphertext=excluded.endpoint_ciphertext,state='active',
  consent_at=excluded.consent_at,last_sent_at=excluded.last_sent_at,
  next_attempt_at=0,failures=0,last_status=NULL,updated_at=excluded.updated_at`)
  .bind(id,session,enc,now,now,now).run();
 return id;
}
export async function unsubscribePush(env:Env,_session:string,id:string,now=Date.now()):Promise<boolean>{
 if(!/^push_[A-Za-z0-9_-]{43}$/.test(id))throw new Error('PUSH_ID_INVALID');
 const r=await env.DB.prepare("UPDATE push_subscriptions SET state='revoked',updated_at=? WHERE id=? AND state='active'").bind(now,id).run();
 return Number(r.meta?.changes??0)===1;
}
export async function listPush(env:Env,_session:string):Promise<Array<{id:string;created_at:number;last_status:string|null}>>{
 const data=(await env.DB.prepare("SELECT id,consent_at,last_status FROM push_subscriptions WHERE state='active' ORDER BY consent_at DESC LIMIT 10").all<{id:string;consent_at:number;last_status:string|null}>()).results;
 return data.map(x=>({id:x.id,created_at:x.consent_at,last_status:x.last_status}));
}
export function isQuiet(now:number,zone:string,start:string,end:string):boolean{
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end))throw new Error('QUIET_HOURS_INVALID');
 const local=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(now));
 if(start===end)return false;
 return start<end?local>=start&&local<end:local>=start||local<end;
}
export async function vapidJwt(env:Env,endpoint:string,now=Date.now()):Promise<string>{
 if(!pushConfigured(env))throw new Error('PUSH_NOT_CONFIGURED');
 const url=validatePushEndpoint(endpoint),pub=fromB64url(env.VAPID_PUBLIC_KEY!);
 const jwk={kty:'EC',crv:'P-256',x:b64url(pub.slice(1,33)),y:b64url(pub.slice(33)),d:env.VAPID_PRIVATE_KEY!,ext:false};
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const header=b64url(encoder.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
 const claims=b64url(encoder.encode(JSON.stringify({aud:url.origin,exp:Math.floor(now/1000)+3600,sub:env.VAPID_CONTACT})));
 const input=`${header}.${claims}`;
 const signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,encoder.encode(input)));
 return `${input}.${b64url(signature)}`;
}
export async function dispatchPush(env:Env,http:ProviderHTTP={fetch:globalThis.fetch},now=Date.now()):Promise<{status:string}>{
 if(!pushConfigured(env))return {status:'disabled'};
 const pref=await env.DB.prepare('SELECT quiet_start,quiet_end,quiet_zone FROM push_preferences WHERE id=1').first<{quiet_start:string;quiet_end:string;quiet_zone:string}>();
 if(pref&&isQuiet(now,pref.quiet_zone,pref.quiet_start,pref.quiet_end))return {status:'quiet'};
 // One device per tick to keep Free-tier requests and D1 usage predictable.
 const sub=await env.DB.prepare(`SELECT p.id,p.endpoint_ciphertext,p.last_sent_at,p.failures FROM push_subscriptions p
 WHERE p.state='active' AND p.next_attempt_at<=? ORDER BY p.last_sent_at ASC LIMIT 1`).bind(now)
  .first<{id:string;endpoint_ciphertext:string;last_sent_at:number;failures:number}>();
 if(!sub)return {status:'none'};
 const pending=await env.DB.prepare("SELECT id FROM academic_items WHERE state='review' AND created_at>? LIMIT 1").bind(sub.last_sent_at).first();
 if(!pending)return {status:'none'};
 let status='unknown',next=now+15*60_000,revoked=false,sent=false;
 try{
  const endpoint=await unseal(env.APP_SECRET,sub.endpoint_ciphertext,'push-endpoint:'+sub.id);
  validatePushEndpoint(endpoint);
  const token=await vapidJwt(env,endpoint,now);
  const response=await http.fetch(endpoint,{method:'POST',headers:{TTL:'300',Urgency:'normal',Authorization:`vapid t=${token},k=${env.VAPID_PUBLIC_KEY}`},redirect:'error'});
  if([201,202].includes(response.status)){status='gateway_accepted';sent=true;}
  else if([404,410].includes(response.status)){status='subscription_expired';revoked=true;}
  else if(response.status===429){status='rate_limited';next=now+60*60_000;}
  else {status='gateway_rejected';next=now+Math.min(6*60*60_000,5*60_000*2**Math.min(sub.failures,6));}
 }catch{status='delivery_unknown';next=now+Math.min(6*60*60_000,5*60_000*2**Math.min(sub.failures,6));}
 await env.DB.prepare("UPDATE push_subscriptions SET state=?,last_sent_at=?,next_attempt_at=?,failures=?,last_status=?,updated_at=? WHERE id=?")
  .bind(revoked?'revoked':'active',sent?now:sub.last_sent_at,sent?0:next,sent?0:sub.failures+1,status,now,sub.id).run();
 return {status};
}

/** Log out/revoke a browser session: explicit user action also disables its push consent.
 * Natural cookie expiration does NOT disable background notifications on that device. */
export async function revokePushBySession(env:Env,session:string,now=Date.now()):Promise<void>{
 await env.DB.prepare("UPDATE push_subscriptions SET state='revoked',updated_at=? WHERE session_hash=? AND state='active'").bind(now,session).run();
}

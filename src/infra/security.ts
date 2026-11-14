import type {Env} from '../types.ts';
import {equalConstantTime,hmac,randomToken,sha256,fromB64url} from './crypto.ts';

const EXPIRY=8*60*60;
/** All sessions have server-side revocation. The database stores only a hash of the cookie. */
export async function issueSession(env:Env):Promise<string>{
 const now=Date.now();
 const payload=`${now+EXPIRY*1000}.${randomToken(24)}`;
 const sig=await hmac(env.APP_SECRET,`session.${payload}`);
 const token=`${payload}.${sig}`;
 const id=await sha256(`session:${token}`);
 await env.DB.prepare('INSERT INTO sessions(id_hash,created_at,expires_at,last_seen_at) VALUES(?,?,?,?)').bind(id,now,now+EXPIRY*1000,now).run();
 return token;
}
function tokenFromRequest(req:Request):string|null{
 const part=(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('aurora_session='));
 return part?.slice('aurora_session='.length)??null;
}
/** Returns a non-secret DB identifier only if the signed cookie is valid and not revoked. */
export async function currentSessionHash(env:Env,req:Request):Promise<string|null>{
 const token=tokenFromRequest(req);if(!token||token.length>320)return null;
 const fields=token.split('.');if(fields.length!==3)return null;
 const [exp,nonce,sig]=fields;
 if(!exp||!nonce||!sig||!/^[0-9]{13}$/.test(exp)||Number(exp)<=Date.now()||Number(exp)>Date.now()+EXPIRY*1000)return null;
 const expected=await hmac(env.APP_SECRET,`session.${exp}.${nonce}`);
 if(!equalConstantTime(sig,expected))return null;
 const id=await sha256(`session:${token}`);
 const row=await env.DB.prepare('SELECT id_hash FROM sessions WHERE id_hash=? AND revoked_at IS NULL AND expires_at>?').bind(id,Date.now()).first();
 return row?id:null;
}
export async function readSession(env:Env,req:Request):Promise<boolean>{return Boolean(await currentSessionHash(env,req));}
export async function revokeSession(env:Env,req:Request):Promise<boolean>{
 const hash=await currentSessionHash(env,req);if(!hash)return false;
 const result=await env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE id_hash=? AND revoked_at IS NULL').bind(Date.now(),hash).run();
 return Number(result.meta?.changes??0)===1;
}
export function sessionCookie(token:string):string{
 return `aurora_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${EXPIRY}`;
}
export function clearSessionCookie():string{return 'aurora_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';}
export function securityHeaders():HeadersInit{return {
 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', 'Referrer-Policy':'no-referrer',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()', 'Cache-Control':'no-store, private',
 'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};}
export function allowedOrigin(env:Env,req:Request):boolean {
 const origin=req.headers.get('origin');
 return origin===new URL(env.PUBLIC_ORIGIN).origin;
}
export async function verifyPassphrase(env:Env,passphrase:string):Promise<boolean>{
 // Secret used only server-side. Hashing both inputs reduces visible timing differences.
 return equalConstantTime(await sha256(passphrase),await sha256(env.INSTALLATION_PASSPHRASE));
}
export function safePublicOrigin(env:Env):string{
 const url=new URL(env.PUBLIC_ORIGIN);
 if(url.protocol!=='https:' && url.hostname!=='localhost' && url.hostname!=='127.0.0.1')throw new Error('PUBLIC_ORIGIN must be HTTPS');
 if(url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('PUBLIC_ORIGIN must be origin only');
 return url.origin;
}
export function configReady(env:Env):boolean{
 try{safePublicOrigin(env);if(!env.INSTALLATION_PASSPHRASE||env.INSTALLATION_PASSPHRASE.length<20) return false;return fromB64url(env.APP_SECRET).length===32;}catch{return false;}
}
export function sanitizeCode(input:unknown,max=100):string {return String(input??'').replace(/[^A-Za-z0-9_:\-/]/g,'_').slice(0,max);}

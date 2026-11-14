/** Web Crypto everywhere: Cloudflare Workers and Node.js >=22. */
const encoder = new TextEncoder();
const decoder = new TextDecoder();
export function b64url(buffer:Uint8Array):string {
  let str=''; for(let i=0;i<buffer.length;i++) str+=String.fromCharCode(buffer[i]!);
  return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function fromB64url(s:string):Uint8Array {
  if(!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('Invalid base64url');
  const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
export function randomToken(bytes=32):string {const b=new Uint8Array(bytes);crypto.getRandomValues(b);return b64url(b);}
export async function sha256(message:string):Promise<string> {return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(message))));}
export async function shaHex(message:string):Promise<string> {return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(message)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function secretKey(secret:string):Promise<CryptoKey>{
  const decoded=fromB64url(secret); if(decoded.length!==32) throw new Error('APP_SECRET must be 32 random bytes base64url');
  return crypto.subtle.importKey('raw',decoded.buffer as ArrayBuffer,'AES-GCM',false,['encrypt','decrypt']);
}
export async function seal(secret:string,plaintext:string,context:string):Promise<string> {
 const iv=new Uint8Array(12);crypto.getRandomValues(iv);
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(context)},await secretKey(secret),encoder.encode(plaintext));
 return `v1.${b64url(iv)}.${b64url(new Uint8Array(data))}`;
}
export async function unseal(secret:string,ciphertext:string,context:string):Promise<string> {
 const [version,iv64,body64,...rest]=ciphertext.split('.');
 if(version!=='v1'||!iv64||!body64||rest.length)throw new Error('Invalid ciphertext version');
 const iv=fromB64url(iv64); if(iv.length!==12)throw new Error('Invalid IV');
 const data=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode(context)},await secretKey(secret),fromB64url(body64));
 return decoder.decode(data);
}
export async function hmac(secret:string,message:string):Promise<string>{
 const key=await crypto.subtle.importKey('raw',fromB64url(secret).buffer as ArrayBuffer,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return b64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(message))));
}
export function equalConstantTime(a:string,b:string):boolean{
 const aa=encoder.encode(a),bb=encoder.encode(b);let d=aa.length^bb.length;
 const max=Math.max(aa.length,bb.length); for(let i=0;i<max;i++)d|=(aa[i]??0)^(bb[i]??0);
 return d===0;
}
export async function pkceChallenge(verifier:string):Promise<string>{return sha256(verifier);}

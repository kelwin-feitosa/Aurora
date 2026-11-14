import type {ProviderHTTP} from '../types.ts';
export class ApiError extends Error{
 status:number;code:string;constructor(status:number,code:string){super(`Provider API ${status}: ${code}`);this.status=status;this.code=code;this.name='ApiError';}
}
export async function apiJson<T>(http:ProviderHTTP,url:string,token:string,options:RequestInit={}):Promise<T>{
 const u=new URL(url);if(u.username||u.password||u.port||u.hash||u.protocol!=='https:'||!['gmail.googleapis.com','www.googleapis.com','graph.microsoft.com','oauth2.googleapis.com','login.microsoftonline.com'].includes(u.hostname))throw new Error('BLOCKED_EXTERNAL_URL');
 const headers=new Headers(options.headers);headers.set('Authorization',`Bearer ${token}`);headers.set('Accept','application/json');
 const resp=await http.fetch(url,{...options,headers,redirect:'error',signal:options.signal??AbortSignal.timeout(12000)});
 if(!resp.ok){const hint=resp.status===401?'UNAUTHORIZED':resp.status===403?'FORBIDDEN':resp.status===404?'NOT_FOUND':resp.status===429?'RATE_LIMITED':resp.status>=500?'SERVER_ERROR':'REQUEST_FAILED';throw new ApiError(resp.status,hint);}
 if(resp.status===204)return null as T;
 return readBoundedJson<T>(resp,512*1024);
}
/** Hard cap applies even if the server lies about Content-Length. The same
 * bounded reader protects OAuth token exchanges, not only resource APIs. */
export async function readBoundedJson<T>(resp:Response,max:number):Promise<T>{
 const declared=Number(resp.headers.get('content-length')??'0');
 if(!Number.isFinite(declared)||declared<0||declared>max)throw new Error('PROVIDER_RESPONSE_TOO_LARGE');
 const reader=resp.body?.getReader();if(!reader)throw new Error('PROVIDER_EMPTY_RESPONSE');
 const parts:Uint8Array[]=[];let used=0;
 while(true){const {done,value}=await reader.read();if(done)break;used+=value.byteLength;
  if(used>max){await reader.cancel();throw new Error('PROVIDER_RESPONSE_TOO_LARGE');}parts.push(value);
 }
 const bytes=new Uint8Array(used);let offset=0;for(const chunk of parts){bytes.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
export function safeGraphUrl(url:string):string{
 const u=new URL(url);
 if(url.length>16000||u.protocol!=='https:'||u.hostname!=='graph.microsoft.com'||u.pathname!=='/v1.0/me/mailFolders/inbox/messages/delta')throw new Error('GRAPH_DELTA_URL_BLOCKED');
 if(u.username||u.password||u.port||u.hash)throw new Error('GRAPH_DELTA_URL_INVALID');
 return u.toString();
}
export function stripMarkup(html:string):string{
 return html.replace(/<\s*(script|style|iframe|svg|form)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s{2,}/g,' ').slice(0,14000);
}
export function asText(s:string):string{return s.replace(/\u0000/g,'').slice(0,14000);}

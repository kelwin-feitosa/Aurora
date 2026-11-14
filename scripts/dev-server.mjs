import {createServer} from 'node:http';
import {SQLiteD1} from './sqlite-adapter.mjs';
import {randomBytes} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import worker from '../src/index.ts';
const port=Number(process.env.PORT||8787),origin=`http://localhost:${port}`;
const db=new SQLiteD1(process.env.AURORA_LOCAL_DB_PATH || new URL('../aurora-local.db',import.meta.url).pathname);
function dotenv(file){if(!existsSync(file))return{};const ret={};for(const line of readFileSync(file,'utf8').split('\n')){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)ret[m[1]]=m[2];}return ret;}
const vars={...dotenv(new URL('../.dev.vars',import.meta.url).pathname),...process.env};
const env={DB:db,PUBLIC_ORIGIN:origin,APP_SECRET:vars.APP_SECRET||randomBytes(32).toString('base64url'),INSTALLATION_PASSPHRASE:vars.INSTALLATION_PASSPHRASE||'local-test-not-for-production-2026',GOOGLE_CLIENT_ID:vars.GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET:vars.GOOGLE_CLIENT_SECRET,MICROSOFT_CLIENT_ID:vars.MICROSOFT_CLIENT_ID,MICROSOFT_CLIENT_SECRET:vars.MICROSOFT_CLIENT_SECRET,MICROSOFT_TENANT:vars.MICROSOFT_TENANT};
if(!vars.APP_SECRET||!vars.INSTALLATION_PASSPHRASE)console.warn('AVISO: servidor local com segredos efêmeros de desenvolvimento. Não exponha publicamente.');
createServer(async(req,res)=>{
 try{const chunks=[];let byteCount=0;for await(const chunk of req){byteCount+=chunk.length;
   if(byteCount>8192){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:'PAYLOAD_TOO_LARGE'}));return;}
   chunks.push(chunk);}
  const body=Buffer.concat(chunks);
  const headers=new Headers();for(const [k,v]of Object.entries(req.headers)){if(v)headers.set(k,Array.isArray(v)?v.join(','):v);}
  const request=new Request(origin+req.url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:body});
  const answer=await worker.fetch(request,env);res.writeHead(answer.status,Object.fromEntries(answer.headers.entries()));res.end(Buffer.from(await answer.arrayBuffer()));
 }catch(e){res.statusCode=500;res.end('Falha local');}
}).listen(port,'127.0.0.1',()=>console.log(`Aurora DEV local: ${origin} (somente loopback)`));

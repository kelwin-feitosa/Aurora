#!/usr/bin/env node
/** Isolated localhost HTTP smoke; never touches the user's SQLite database. */
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const folder=mkdtempSync(join(tmpdir(),'aurora-http-'));
const port=19000+Math.floor(Math.random()*30000),origin=`http://localhost:${port}`;
const secret=randomBytes(32).toString('base64url');
const pass='smoke-test-password-private-only-2026';
const server=spawn(process.execPath,['--experimental-strip-types','--experimental-sqlite',new URL('../scripts/dev-server.mjs',import.meta.url).pathname],{cwd:new URL('../',import.meta.url).pathname,env:{...process.env,PORT:String(port),AURORA_LOCAL_DB_PATH:join(folder,'app.db'),APP_SECRET:secret,INSTALLATION_PASSPHRASE:pass},stdio:'ignore'});
let logged=false;
try{
 for(let attempt=0;attempt<100;attempt++){
  try{const r=await fetch(origin+'/api/session');if(r.status===200){logged=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,80));
 }
 assert.ok(logged,'Servidor local não respondeu');
 let r=await fetch(origin+'/');assert.equal(r.status,200);
 r=await fetch(origin+'/api/data');assert.equal(r.status,401);
 r=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({passphrase:pass})});
 assert.equal(r.status,200);
 const cookie=r.headers.get('set-cookie').split(';')[0];
 r=await fetch(origin+'/api/data',{headers:{Cookie:cookie}});assert.equal(r.status,200);
 const data=await r.json();assert.ok(Array.isArray(data.connections));
 r=await fetch(origin+'/api/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin}});assert.equal(r.status,200);
 r=await fetch(origin+'/api/data',{headers:{Cookie:cookie}});assert.equal(r.status,401);
 console.log('HTTP smoke: 200 página; 401 privado; 200 login/dados/logout; 401 cookie revogado.');
}finally{server.kill('SIGTERM');rmSync(folder,{recursive:true,force:true});}

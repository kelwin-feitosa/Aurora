import {performance} from 'node:perf_hooks';import {writeFileSync} from 'node:fs';
import {classify} from '../src/domain/classifier.ts';
import {SQLiteD1} from '../scripts/sqlite-adapter.mjs';
import {seal,unseal,randomToken} from '../src/infra/crypto.ts';
function measure(values){const sorted=values.toSorted((a,b)=>a-b);const q=(f)=>Number(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*f))]?.toFixed(4)??0);return {n:values.length,p50_ms:q(.50),p95_ms:q(.95),p99_ms:q(.99),max_ms:q(.999),mean_ms:Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(4))};}
const message={id:'x',revision:'0',subject:'Prova de Matemática',body:'Prova de Matemática em 18/11/2026 às 15h30 na sala 204.',receivedAt:'2026-11-10T10:00:00Z'};
for(let i=0;i<500;i++)classify(message);
const parsing=[];for(let i=0;i<3000;i++){const t=performance.now();classify(message);parsing.push(performance.now()-t);}
const db=new SQLiteD1();const now=Date.now();await db.prepare("INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES('x','gmail','test','none',?,?)").bind(now,now).run();
const inserts=[];for(let i=0;i<1000;i++){const t=performance.now();await db.prepare('INSERT OR IGNORE INTO inbox(connection_id,remote_id,remote_revision,received_at) VALUES(?,?,?,?)').bind('x','m'+i,'0',now).run();inserts.push(performance.now()-t);}
const lookups=[];for(let i=0;i<1000;i++){const t=performance.now();await db.prepare('SELECT id FROM inbox WHERE connection_id=? AND remote_id=? AND remote_revision=?').bind('x','m'+i,'0').first();lookups.push(performance.now()-t);}
const key=randomToken(),vault=[];for(let i=0;i<150;i++){const t=performance.now();const sealed=await seal(key,'synthetic-token','binding:test');await unseal(key,sealed,'binding:test');vault.push(performance.now()-t);}
const result={executed_at:new Date().toISOString(),runtime:process.version,environment:'Node.js localhost, SQLite nativo (NÃO é D1/Workers)',note:'Tempos por operação isolada. Não representam CPU da Cloudflare, disponibilidade nem acurácia em e-mails reais.',samples:{classification:measure(parsing),sqlite_insert:measure(inserts),sqlite_index_lookup:measure(lookups),aes_gcm_roundtrip:measure(vault)},rss_bytes:process.memoryUsage().rss};
writeFileSync(new URL('results.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));db.close();

/** Synthetic SQL statement count per cycle (including batch statements); NOT D1 telemetry. */
import {randomBytes} from 'node:crypto';
import {SQLiteD1} from '../scripts/sqlite-adapter.mjs';
import {seal} from '../src/infra/crypto.ts';
import {runCycle} from '../src/app/pipeline.ts';
function response(v,status=200){return new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});}
function budgetDB(db){let executed=0;const wrap=(s)=>({bind(...params){s.bind(...params);return this;},async first(){executed++;return s.first();},async all(){executed++;return s.all();},async run(){executed++;return s.run();}});return{get executed(){return executed;},prepare(sql){return wrap(db.prepare(sql));},batch(stmts){executed+=stmts.length;return db.batch(stmts);}};}
for(const connections of [1,2]){
 const native=new SQLiteD1(), db=budgetDB(native),now=Date.now();
 const env={DB:db,APP_SECRET:randomBytes(32).toString('base64url'),PUBLIC_ORIGIN:'https://test.example',INSTALLATION_PASSPHRASE:'synthetic-secret-long-for-test',SYNC_LIMIT:'1'};
 for(let i=0;i<connections;i++){const p=i===0?'gmail':'outlook',id=i===0?'g1':'o1';const tokens={access_token:'fake',refresh_token:'fake',expires_at:now+3600000};
  await db.prepare('INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,p,'synthetic',await seal(env.APP_SECRET,JSON.stringify(tokens),`token:${id}:${p}`),now,now).run();
 }
 const before=db.executed;
 const mock={async fetch(url,init={}){const u=String(url),m=init.method??'GET';
  if(u.endsWith('/profile'))return response({historyId:'200',emailAddress:'synthetic@school.test'});
  if(u.includes('/messages?'))return response({messages:[{id:'x1'}]});
  if(u.includes('/messages/x1?'))return response({id:'x1',internalDate:String(now-86400000),payload:{headers:[{name:'Subject',value:'Prova de Anatomia'}],mimeType:'text/plain',body:{data:Buffer.from('Prova de Anatomia em 18/11/2026 às 15h.\nEntregar relatório em 25/11/2026.').toString('base64url')}}});
  if(u.includes('/mailFolders/inbox/messages/delta'))return response({value:[{id:'ms1'}],'@odata.deltaLink':'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=200'});
  if(u.includes('/me/messages/ms1?'))return response({id:'ms1',subject:'Prova de Anatomia',body:{contentType:'text',content:'Prova de Anatomia em 18/11/2026 às 15h.\nEntregar relatório em 25/11/2026.'},receivedDateTime:'2026-11-10T12:00:00Z'});
  if(u.includes('/calendarList'))return response({items:[{id:'gcal',summary:'Aurora • g1'}]});
  if(u.includes('/me/calendars?'))return response({value:[{id:'mscal',name:'Aurora • o1'}]});
  if(u.includes('/calendarView'))return response({value:[]});
  if(u.includes('/events/')&&m==='GET')return response({},404);
  if(u.endsWith('/events')&&m==='POST'){const obj=JSON.parse(init.body);return response({id:obj.id||'new-ms',transactionId:obj.transactionId},201);}
  throw Error('UNEXPECTED_SYNTHETIC_URL');
 }};
 await runCycle(env,mock,now);
 const inbox=(await native.prepare('SELECT COUNT(*) AS n FROM inbox').first()).n;
 const outbox=(await native.prepare('SELECT state FROM outbox').all()).results;
 if(db.executed-before>49)throw new Error('SYNTHETIC_MULTI_D1_QUERY_BUDGET_EXCEEDED');
 console.log(JSON.stringify({connections,cycle:1,d1_statements_executed:db.executed-before,provider_calls:(await native.prepare('SELECT provider_calls FROM usage_daily').first()).provider_calls,inbox_rows:inbox,outbox:outbox.map(x=>x.state)}));
 if(connections===2){const previous=db.executed;await runCycle(env,mock,now+900000);const delta=db.executed-previous;
  if(delta>44)throw new Error('SYNTHETIC_D1_QUERY_BUDGET_EXCEEDED_SECOND_CYCLE');
  console.log(JSON.stringify({connections,cycle:2,d1_statements_executed:delta,provider_calls:(await native.prepare('SELECT provider_calls FROM usage_daily').first()).provider_calls,inbox_rows:(await native.prepare('SELECT COUNT(*) AS n FROM inbox').first()).n}));
 }
 native.close();
}

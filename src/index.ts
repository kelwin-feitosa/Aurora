import type {Env,ExecutionContext} from './types.ts';
import {handle} from './web/handler.ts';
import {runCycle} from './app/pipeline.ts';
import {dispatchPush} from './app/push.ts';
export default {
 async fetch(request:Request,env:Env):Promise<Response>{return handle(request,env);},
 async scheduled(_event:unknown,env:Env,ctx:ExecutionContext):Promise<void>{
  ctx.waitUntil((async()=>{
   const now=Date.now();
   try{await env.DB.prepare("INSERT INTO runtime_state(key,value) VALUES('cron_last_attempt',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(now).run();
    // Push opt-in runs separately from mailbox sync to preserve per-invocation budgets.
    if(env.PUSH_ENABLED==='1'&&Math.floor(now/180000)%5===0){
     const push=await dispatchPush(env);
     // No active device, quiet period or no new review: do not sacrifice mailbox throughput.
     if(push.status==='none'||push.status==='quiet')await runCycle(env);
    }else await runCycle(env);
    await env.DB.prepare("INSERT INTO runtime_state(key,value) VALUES('cron_last_success',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(Date.now()).run();
   }catch{
    try{await env.DB.prepare('INSERT INTO audit(at,action,detail_code) VALUES(?,?,?)').bind(Date.now(),'CRON_ERROR','UNEXPECTED_PIPELINE_FAILURE').run();}
    catch{console.error('AURORA_CRON_FAILED_AUDIT_UNAVAILABLE');}
   }
  })());
 }
};

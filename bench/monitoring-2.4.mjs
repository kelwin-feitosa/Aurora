/**
 * Synthetic, labelled workload. No real messages, HTTP, D1 or Worker telemetry.
 * Independent observations: Gmail quota pricing in units, not currency.
 * Reproducible on Node >=22: npm run bench:monitoring24
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {triageEnvelope,DEFAULT_RULES} from '../src/domain/monitoring.ts';

const SIZES=[100,1000,10000], RATES=[0,.05,.10,.25,.5,.75,.9,1];
const VAGUE_SHARES=[0,.25], REPEATS=5;
const cases=[];
function percentile(numbers,q){const xs=[...numbers].sort((a,b)=>a-b);return xs[Math.min(xs.length-1,Math.ceil(q*xs.length)-1)];}
for(const n of SIZES)for(const rate of RATES)for(const vague of VAGUE_SHARES){
 const relevantCount=Math.round(n*rate),vagueCount=Math.round(relevantCount*vague);
 let outcome=null;const sampleMs=[];
 for(let run=0;run<REPEATS;run++){
  let selected=0,missed=0,accepted=0;const start=performance.now();
  for(let i=0;i<n;i++){
   const isRelevant=i<relevantCount,isVague=isRelevant&&i<vagueCount;
   const envelope={
    id:String(i),receivedAt:'2026-11-14T10:00:00Z',
    sender:isRelevant?'professor@externo.test':'ofertas@loja.test',
    subject:!isRelevant?'Cupom desconto exclusivo':isVague?'Olá':'Prova de matemática em 18/11/2026'
   };
   const t=triageEnvelope(envelope,DEFAULT_RULES);
   if(t.action==='read'){accepted++;if(isRelevant)selected++;}
   else if(isRelevant)missed++;
  }
  sampleMs.push(performance.now()-start);
  const r={accepted,selected,missed};
  if(outcome&&JSON.stringify(outcome)!==JSON.stringify(r))throw new Error('NONDETERMINISTIC_TRIAGE');
  outcome=r;
 }
 const {accepted,missed}=outcome;
 cases.push({
  n,relevance_rate:rate,generic_subject_share:vague,actual_relevant:relevantCount,
  triaged_full:accepted,false_negatives:missed,
  recall:relevantCount?Number(((relevantCount-missed)/relevantCount).toFixed(4)):null,
  baseline_full_get:n,metadata_first_get:n+accepted,
  outlook_delta_reuse_get:accepted,
  gmail_baseline_units:60*n,gmail_metadata_first_units:20*n+60*accepted,
  ms_p50:percentile(sampleMs,.5).toFixed(4),
  ms_p95:percentile(sampleMs,.95).toFixed(4)
 });
}
const columns=Object.keys(cases[0]);
const csv=[columns.join(','),...cases.map(r=>columns.map(k=>r[k]??'').join(','))].join('\n')+'\n';
mkdirSync('artifacts',{recursive:true});
writeFileSync('artifacts/benchmark-monitoring-2.4.csv',csv);
writeFileSync('artifacts/benchmark-monitoring-2.4.json',JSON.stringify({
 evidence:'synthetic-only; no CPU Worker, D1 rows, OAuth account, human-labelled corpus or external device',
 measured_environment:{node:process.version,platform:process.platform,repeats:REPEATS},
 gmail_quota_reference:'https://developers.google.com/workspace/gmail/api/reference/quota',
 graph_select_reference:'https://learn.microsoft.com/en-us/graph/delta-query-messages',
 rows:cases
},null,2)+'\n');
if(cases.length!==48)throw new Error('MISSING_SCENARIOS');
const representative=cases.filter(x=>x.n===100&&x.relevance_rate===.25);
console.log(JSON.stringify({scenarios:cases.length,repeats:REPEATS,representative,files:['artifacts/benchmark-monitoring-2.4.csv','artifacts/benchmark-monitoring-2.4.json']},null,2));
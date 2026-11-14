import {triageEnvelope,DEFAULT_RULES} from '../src/domain/monitoring.ts';
const rules={...DEFAULT_RULES};
const sizes=[100,1000,10000];const relevantRates=[.1,.4,.75];
const rows=[];
for(const n of sizes)for(const relevantRatio of relevantRates){
 let read=0,skipped=0;
 const start=performance.now();
 for(let i=0;i<n;i++){
  const relevant=i<Math.round(n*relevantRatio);
  const x=triageEnvelope({id:String(i),sender:relevant?'docente@univ.edu.br':'vendas@shop.test',subject:relevant?'Prova 18/11/2026':'Cupom desconto exclusivo',receivedAt:''},rules);
  if(x.action==='read')read++;else skipped++;
 }
 const elapsedMs=performance.now()-start;
 // Gmail after May-2026 quota docs: metadata=20; full=60. Excludes list/history and other calls.
 rows.push({messages:n,academic_ratio:relevantRatio,headers_only:skipped,full_reads:read,baseline_get_calls:n,new_get_calls:n+read,baseline_gmail_units:n*60,new_gmail_units:n*20+read*60,additional_http_calls:read,metadata_classifier_ms:+elapsedMs.toFixed(3)});
}
console.log(JSON.stringify({benchmark:'synthetic-envelope-only-2.3',node:process.version,rows},null,2));

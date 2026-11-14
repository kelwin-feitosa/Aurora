/** Fixed synthetic evaluation set. No real emails, no claim of production accuracy. */
import {readFileSync,writeFileSync} from 'node:fs';
import {classify as legacy} from '../references/aurora-1.6/src/domain/classifier.ts';
import {classify as current} from '../src/domain/classifier.ts';
import {applyAutomationPolicy} from '../src/domain/trust.ts';
const path=new URL('corpus-2.0.jsonl',import.meta.url);
const cases=readFileSync(path,'utf8').trim().split('\n').map(line=>JSON.parse(line));
const trusted={AUTO_APPROVE_MODE:'trusted-senders',TRUSTED_SENDER_ADDRESSES:'professor@school.edu'};
function score(fn){
 const m={tp:0,fp:0,tn:0,fn:0,by_tag:{}};
 for(const item of cases){
  const got=fn(item).state==='approved',expected=item.should_auto;
  const key=got?(expected?'tp':'fp'):(expected?'fn':'tn');m[key]++;
  m.by_tag[item.tag]??={n:0,errors:0};m.by_tag[item.tag].n++;
  if(got!==expected)m.by_tag[item.tag].errors++;
 }
 return {...m,auto_precision:m.tp+m.fp?m.tp/(m.tp+m.fp):null,auto_recall:m.tp+m.fn?m.tp/(m.tp+m.fn):null};
}
const out={evaluated_at:new Date().toISOString(),dataset:'sintético independente de contas; 68 mensagens criadas por templates; dados artificiais; rótulos manuais por tipo de caso',n:cases.length,
 before_1_6:score(m=>legacy(m)),after_2_0_trusted_allowlist:score(m=>applyAutomationPolicy(trusted,m,[current(m)])[0]),after_2_0_safe_default:score(m=>applyAutomationPolicy({},m,[current(m)])[0]),
 note:'Métrica é APENAS autorização de criação automática no corpus sintético; não é precisão acadêmica real. O modo padrão seguro sacrifica recall automático.'};
const dest=new URL('results-synthetic-2.0.json',import.meta.url);writeFileSync(dest,JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));

#!/usr/bin/env node
/** Extra-safety remote restore: only to a NEW proven-empty D1, no in-place overwrite.
 * Side effects require THREE explicit confirmations, and credentials from Wrangler.
 */
import {spawnSync} from 'node:child_process';
import {mkdtempSync,existsSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decryptD1,quarantineSql} from './d1-backup-crypto.mjs';
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('Uso: AURORA_BACKUP_PASSPHRASE=... node scripts/restore-cloud-to-new.mjs ARQUIVO.aurd1 --database=NOVO_D1 --confirm-new-empty=NOVO_D1 --confirm-remote-write');process.exit(0);}
const backup=args.find(x=>!x.startsWith('--'));
const database=args.find(x=>x.startsWith('--database='))?.slice(11);
if(!backup||!database||!args.includes(`--confirm-new-empty=${database}`)||!args.includes('--confirm-remote-write'))throw Error('RESTAURACAO_REMOTA_EXIGE_CONFIRMACAO_EXPLICITA');
if(!/^[A-Za-z0-9_-]{1,70}$/.test(database)||['AURORA_DB','aurora-pessoal'].includes(database))throw Error('RESTORE_TARGET_MUST_BE_NEW_DATABASE');
const root=fileURLToPath(new URL('../',import.meta.url));
const binary=process.env.AURORA_WRANGLER_BIN||join(root,'node_modules','.bin','wrangler');
if(!existsSync(binary))throw Error('WRANGLER_NOT_INSTALLED');
const pass=process.env.AURORA_BACKUP_PASSPHRASE;
if(!pass||pass.length<20)throw Error('BACKUP_PASSPHRASE_AT_LEAST_20_CHARACTERS');
const {AURORA_BACKUP_PASSPHRASE:_,...safeEnv}=process.env;
function command(params){
 const result=spawnSync(binary,params,{cwd:root,env:safeEnv,encoding:'utf8',timeout:120000});
 if(result.error||result.status!==0)throw Error('D1_WRANGLER_OPERATION_FAILED_REVIEW_TARGET');
 return result.stdout;
}
// Read-only check before any SQL is uploaded. Never trust a '--new' flag alone.
const output=command(['d1','execute',database,'--remote','--json','--command',"SELECT COUNT(*) AS table_count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"]);
let parsed;
try{parsed=JSON.parse(output);}catch{throw Error('UNRECOGNIZED_WRANGLER_RESPONSE_BLOCKED');}
const count=Array.isArray(parsed)?parsed[0]?.results?.[0]?.table_count:parsed?.results?.[0]?.table_count;
if(count!==0)throw Error('RESTORE_TARGET_NOT_PROVEN_EMPTY');
process.umask(0o077);const dir=mkdtempSync(join(tmpdir(),'aurora-d1-restore-'));
try{
 const sql=quarantineSql(decryptD1(readFileSync(backup),pass).toString('utf8'));
 const temp=join(dir,'restore-quarantined.sql');writeFileSync(temp,sql,{mode:0o600,flag:'wx'});
 command(['d1','execute',database,'--remote',`--file=${temp}`,'--skip-confirmation']);
 console.log('Importação solicitada em D1 NOVO: '+database+'. Conexões pausadas, sessões revogadas e ações pendentes bloqueadas.');
 console.log('Inspecione tabelas e eventos antes de trocar o binding DB e configurar o mesmo APP_SECRET. Nenhuma conta foi reativada.');
}finally{rmSync(dir,{recursive:true,force:true});}

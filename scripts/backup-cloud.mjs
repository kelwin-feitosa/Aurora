#!/usr/bin/env node
/** Export authorized D1 via Wrangler into owner-only temp, encrypt immediately, remove plaintext. */
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,existsSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {encryptD1} from './d1-backup-crypto.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('Uso: AURORA_BACKUP_PASSPHRASE=senha-forte node scripts/backup-cloud.mjs --confirm-remote-read --output=/CAMINHO/arquivo.aurd1 [--database=AURORA_DB]');process.exit(0);}
if(!args.includes('--confirm-remote-read'))throw Error('CONFIRMACAO_LEITURA_REMOTA_OBRIGATORIA');
const flag=(name,def)=>args.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3)??def;
const output=resolve(flag('output','aurora-d1-backup.aurd1'));
const db=flag('database','AURORA_DB');if(!/^[A-Za-z0-9_-]{1,70}$/.test(db))throw Error('INVALID_DATABASE_NAME');
if(existsSync(output))throw Error('BACKUP_OUTPUT_EXISTS_NO_OVERWRITE');
const passphrase=process.env.AURORA_BACKUP_PASSPHRASE;
if(!passphrase||passphrase.length<20)throw Error('BACKUP_PASSPHRASE_AT_LEAST_20_CHARACTERS');
const binary=process.env.AURORA_WRANGLER_BIN||join(root,'node_modules','.bin','wrangler');
if(!existsSync(binary))throw Error('WRANGLER_NOT_INSTALLED_NO_CLOUD_EXPORT');
process.umask(0o077);
const dir=mkdtempSync(join(tmpdir(),'aurora-d1-export-'));
try{
 const plaintext=join(dir,'export.sql');
 const {AURORA_BACKUP_PASSPHRASE:_,...safeEnv}=process.env;
 const result=spawnSync(binary,['d1','export',db,'--remote',`--output=${plaintext}`,'--skip-confirmation'],{cwd:root,env:safeEnv,encoding:'utf8',timeout:120000});
 if(result.error||result.status!==0||!existsSync(plaintext))throw Error('D1_EXPORT_FAILED_VERIFY_WRANGLER_AUTH_AND_PERMISSIONS');
 chmodSync(plaintext,0o600);
 const encrypted=encryptD1(readFileSync(plaintext),passphrase);
 writeFileSync(output,encrypted,{mode:0o600,flag:'wx'});
 console.log(`Backup D1 cifrado: ${output}. Guarde a senha fora da nuvem e fora do projeto.`);
}finally{rmSync(dir,{recursive:true,force:true});}

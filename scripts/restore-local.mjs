#!/usr/bin/env node
/** Restore is preview-only by default. Applying disables connections and blocks uncertain writes. */
import {DatabaseSync} from 'node:sqlite';
import {pbkdf2Sync,createDecipheriv,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,renameSync,unlinkSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const backupPath=process.argv[2];if(!backupPath)throw Error('Uso: node scripts/restore-local.mjs backup.aurbk [--apply --replace]');
const vars=readFileSync(join(root,'.dev.vars'),'utf8');const match=vars.match(/^APP_SECRET=(.+)$/m);if(!match)throw Error('APP_SECRET da instalação é necessária para restaurar tokens');
const secret=Buffer.from(match[1].trim(),'base64url');if(secret.length!==32)throw Error('APP_SECRET inválido');
const file=readFileSync(backupPath);if(file.length<49||file.subarray(0,4).toString()!=='AUR1')throw Error('Formato de backup inválido');
const salt=file.subarray(4,20),iv=file.subarray(20,32),tag=file.subarray(32,48),enc=file.subarray(48);
const key=pbkdf2Sync(secret,salt,150000,32,'sha256');const decipher=createDecipheriv('aes-256-gcm',key,iv,{authTagLength:16});decipher.setAAD(Buffer.from('AURORA_LOCAL_DB_BACKUP_V1'));decipher.setAuthTag(tag);
const plain=Buffer.concat([decipher.update(enc),decipher.final()]);
const temp=join(root,`.aurora-restore-${randomBytes(5).toString('hex')}.sqlite`);
writeFileSync(temp,plain,{mode:0o600,flag:'wx'});
try{
 const db=new DatabaseSync(temp);const check=db.prepare('PRAGMA integrity_check').get();if(check.integrity_check!=='ok')throw Error('Backup SQLite com falha de integridade');
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name);
 if(!['connections','inbox','academic_items','outbox','preferences'].every(t=>tables.includes(t)))throw Error('Esquema incompleto no backup');
 const counts={connections:db.prepare('SELECT COUNT(*) n FROM connections').get().n,items:db.prepare('SELECT COUNT(*) n FROM academic_items').get().n,outbox:db.prepare('SELECT COUNT(*) n FROM outbox').get().n};
 console.log('Prévia do backup (sem aplicar):',JSON.stringify(counts));
 if(process.argv.includes('--apply')&&process.argv.includes('--replace')){
  db.exec("UPDATE connections SET enabled=0,last_error='RESTORED_REVIEW_REQUIRED',locked_until=0");
  db.exec("UPDATE outbox SET state='blocked',last_error='RESTORED_REVIEW_REQUIRED',locked_until=0 WHERE state!='committed'");
  if(tables.includes('calendar_changes'))db.exec("UPDATE calendar_changes SET state='blocked',last_error='RESTORED_REVIEW_REQUIRED',locked_until=0 WHERE state!='committed'");
  db.close();
  const target=join(root,'aurora-local.db');
  if(existsSync(target)){
   const safe=target+`.before-restore-${Date.now()}`;
   renameSync(target,safe);chmodSync(safe,0o600);console.log('Banco anterior preservado em:',safe);
  }
  renameSync(temp,target);chmodSync(target,0o600);
  console.log('Restaurado com conexões PAUSADAS e ações externas não confirmadas BLOQUEADAS. Revise antes de reativar.');
 }else{db.close();console.log('Modo seguro: nenhum banco existente alterado. Use --apply --replace SOMENTE com Aurora parado e após revisar backup.');}
}finally{if(existsSync(temp))unlinkSync(temp);}

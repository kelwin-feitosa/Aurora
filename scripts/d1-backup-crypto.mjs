/** Offline encrypted SQL snapshot format AURD1B01. Not used inside Workers. */
import {randomBytes,scryptSync,createCipheriv,createDecipheriv} from 'node:crypto';
export const MAGIC=Buffer.from('AURD1B01');
const AAD=Buffer.from('AURORA_D1_REMOTE_BACKUP_V1');
const MAX_SIZE=16*1024*1024;
function derive(passphrase,salt){
 if(typeof passphrase!=='string'||passphrase.length<20||passphrase.length>2048)throw new Error('BACKUP_PASSPHRASE_AT_LEAST_20_CHARACTERS');
 return scryptSync(passphrase,salt,32,{N:1<<15,r:8,p:1,maxmem:64*1024*1024});
}
export function encryptD1(sql,passphrase){
 const data=Buffer.isBuffer(sql)?sql:Buffer.from(sql);
 if(!data.length||data.length>MAX_SIZE)throw new Error('D1_SQL_SIZE_OUT_OF_RANGE');
 const salt=randomBytes(16),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',derive(passphrase,salt),iv);
 cipher.setAAD(AAD);const encrypted=Buffer.concat([cipher.update(data),cipher.final()]);
 return Buffer.concat([MAGIC,salt,iv,cipher.getAuthTag(),encrypted]);
}
export function decryptD1(blob,passphrase){
 const data=Buffer.isBuffer(blob)?blob:Buffer.from(blob);
 if(data.length<=52||data.length>MAX_SIZE+100||!data.subarray(0,8).equals(MAGIC))throw new Error('INVALID_D1_BACKUP_FORMAT');
 const salt=data.subarray(8,24),iv=data.subarray(24,36),tag=data.subarray(36,52);
 const decryptor=createDecipheriv('aes-256-gcm',derive(passphrase,salt),iv);decryptor.setAAD(AAD);decryptor.setAuthTag(tag);
 return Buffer.concat([decryptor.update(data.subarray(52)),decryptor.final()]);
}
/** Fail closed: an imported snapshot is inactive until a human reviews it. */
export function quarantineSql(sql){
 const body=String(sql);
 if(!/\bCREATE TABLE\s+(?:IF NOT EXISTS\s+)?["'`]?connections\b/i.test(body)||!/\bCREATE TABLE\s+(?:IF NOT EXISTS\s+)?["'`]?outbox\b/i.test(body))throw new Error('D1_BACKUP_REQUIRED_TABLES_ABSENT');
 return body+'\n-- AURORA 1.6 RESTORE QUARANTINE: no automatic replay after disaster recovery.\n'
  +"UPDATE connections SET enabled=0,locked_until=0,last_error='RESTORED_REVIEW_REQUIRED';\n"
  +"UPDATE outbox SET state='blocked',locked_until=0,last_error='RESTORED_REVIEW_REQUIRED' WHERE state!='committed';\n"
  +"UPDATE calendar_changes SET state='blocked',locked_until=0,last_error='RESTORED_REVIEW_REQUIRED' WHERE state!='committed';\n"
  +"UPDATE oauth_pending SET used_at=COALESCE(used_at,0);\n"
  +"UPDATE sessions SET revoked_at=COALESCE(revoked_at,0);\n";
}

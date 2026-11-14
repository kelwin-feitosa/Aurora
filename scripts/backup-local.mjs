#!/usr/bin/env node
/** Encrypted snapshot of the local SQLite database. App secret is never written to backup. */
import {DatabaseSync,backup} from 'node:sqlite';
import {randomBytes,createCipheriv,pbkdf2Sync} from 'node:crypto';
import {readFileSync,writeFileSync,unlinkSync,existsSync,mkdirSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const dbPath=join(root,'aurora-local.db'),varsPath=join(root,'.dev.vars');
function readSecret(){if(!existsSync(varsPath))throw Error('Arquivo .dev.vars ausente');const match=readFileSync(varsPath,'utf8').match(/^APP_SECRET=(.+)$/m);if(!match||match[1].length<32)throw Error('APP_SECRET indisponível');return Buffer.from(match[1].trim(),'base64url');}
if(!existsSync(dbPath))throw Error('Banco local não encontrado. Inicie uma instalação antes de fazer backup.');
const secret=readSecret();if(secret.length!==32)throw Error('APP_SECRET inválido');
const out=process.argv[2]||join(root,`aurora-backup-${new Date().toISOString().slice(0,10)}.aurbk`);
if(existsSync(out))throw Error('Arquivo de destino já existe: não sobrescrevendo backup.');
const temp=join(root,`.aurora-backup-${randomBytes(5).toString('hex')}.sqlite`);
let database;
try{
 // Default-deny file access while the plaintext staging backup exists.
 process.umask(0o077);
 database=new DatabaseSync(dbPath);await backup(database,temp);chmodSync(temp,0o600);database.close();database=undefined;
 const plain=readFileSync(temp),salt=randomBytes(16),iv=randomBytes(12),key=pbkdf2Sync(secret,salt,150000,32,'sha256');
 const cipher=createCipheriv('aes-256-gcm',key,iv,{authTagLength:16});cipher.setAAD(Buffer.from('AURORA_LOCAL_DB_BACKUP_V1'));
 const body=Buffer.concat([cipher.update(plain),cipher.final()]);const tag=cipher.getAuthTag();
 writeFileSync(out,Buffer.concat([Buffer.from('AUR1'),salt,iv,tag,body]),{mode:0o600,flag:'wx'});
 console.log('Backup local cifrado criado:',out,'(',plain.length,'bytes antes de cifrar)');
 console.log('IMPORTANTE: guarde sua APP_SECRET separadamente com segurança; o backup depende dela.');
}finally{if(database)database.close();if(existsSync(temp))unlinkSync(temp);}

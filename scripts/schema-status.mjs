#!/usr/bin/env node
/** Non-destructive local schema inspection, explicit backup before manual apply. */
import {existsSync,copyFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {SQLiteD1} from './sqlite-adapter.mjs';
const file=resolve(process.argv.find(x=>x.startsWith('--db='))?.slice(5)||'aurora-local.db');
const apply=process.argv.includes('--apply');
if(!existsSync(file)){console.error('Banco local inexistente. Inicie o servidor local ou forneça --db=CAMINHO');process.exit(2);}
const expected=readdirSync(new URL('../migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort();
const db=new SQLiteD1(file,false);
let applied=[];try{applied=(await db.prepare('SELECT file FROM _local_migrations').all()).results.map(x=>x.file)}catch{console.error('Banco sem histórico de migração local');db.close();process.exit(2)}
db.close();
const pending=expected.filter(x=>!applied.includes(x));
console.log(JSON.stringify({database:file,applied:applied.length,pending},null,2));
if(apply&&pending.length){const backup=file+'.pre-aurora-1.2.bak';copyFileSync(file,backup);console.log('Backup antes das migrações:',backup);
 const upgraded=new SQLiteD1(file,true);upgraded.close();console.log('Migrações aplicadas. Valide o resultado antes de remover o backup.');}
else if(pending.length){console.log('Para aplicar com backup, pare a aplicação e use --apply');process.exitCode=1;}

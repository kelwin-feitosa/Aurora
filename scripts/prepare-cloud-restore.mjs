#!/usr/bin/env node
/** Decrypt an owner-held backup to a guarded SQL file; NEVER mutate D1 automatically. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {decryptD1,quarantineSql} from './d1-backup-crypto.mjs';
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('Uso: AURORA_BACKUP_PASSPHRASE=senha node scripts/prepare-cloud-restore.mjs arquivo.aurd1 --output=/local/RESTORE-QUARANTINE.sql --confirm-plaintext');process.exit(0);}
const source=args.find(x=>!x.startsWith('--'));const targetArg=args.find(x=>x.startsWith('--output='));
if(!source||!targetArg||!args.includes('--confirm-plaintext'))throw Error('RESTAURACAO_SEGURA_EXIGE_ORIGEM_DESTINO_E_CONFIRMACAO');
const passphrase=process.env.AURORA_BACKUP_PASSPHRASE;
if(!passphrase||passphrase.length<20)throw Error('BACKUP_PASSPHRASE_AT_LEAST_20_CHARACTERS');
const target=resolve(targetArg.slice(9));if(existsSync(target))throw Error('RESTORE_OUTPUT_EXISTS_NO_OVERWRITE');
process.umask(0o077);
const sql=decryptD1(readFileSync(resolve(source)),passphrase).toString('utf8');
writeFileSync(target,quarantineSql(sql),{mode:0o600,flag:'wx'});
console.log('Arquivo SQL de recuperação preparado e QUARENTENADO:',target);
console.log('NÃO importe no banco de produção: crie um D1 NOVO E VAZIO, restaure com a CLI oficial e revise antes de ativar conexões.');

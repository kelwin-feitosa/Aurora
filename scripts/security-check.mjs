#!/usr/bin/env node
/** A limited dependency-free release hygiene scan; NOT a replacement for SAST or npm audit. */
import {existsSync,readdirSync,readFileSync,lstatSync} from 'node:fs';
import {join,relative} from 'node:path';
const root=new URL('../',import.meta.url).pathname;
const forbidden=['.dev.vars','.env','.vapid-keys.local','aurora-local.db','node_modules','.git'];
const suspiciousName=/(\.pem$|\.key$|\.p12$|\.pfx$|id_rsa$|token\.json$)/i;
let errors=[];let files=0;
function walk(folder){for(const name of readdirSync(folder)){
 const path=join(folder,name),rel=relative(root,path).replaceAll('\\','/'),info=lstatSync(path);
 if(info.isSymbolicLink()){errors.push('SYMLINK_IN_RELEASE: '+rel);continue;}
 if(info.isDirectory()){if(name==='node_modules'||name==='.git')continue;walk(path);continue;}
 if(forbidden.includes(name)||suspiciousName.test(name))errors.push('FORBIDDEN_FILE: '+rel);
 if(info.size>20*1024*1024)errors.push('FILE_TOO_LARGE: '+rel);
 files++;
 }}
walk(root);
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
if(pkg.scripts?.deploy?.includes('--env production'))errors.push('UNREVIEWED_PROD_DEPLOY');
if(existsSync(join(root,'package-lock.json')))console.log('npm lockfile encontrado');
else console.log('AVISO: sem package-lock; npm ci e auditoria de dependências pendentes por acesso ao registry.');
console.log(`Arquivos conferidos: ${files}`);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log('OK: verificação local de artefatos/secrets passou (não equivale a SAST independente).');

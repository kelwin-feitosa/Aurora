#!/usr/bin/env node
import {existsSync,readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const strict=process.argv.includes('--strict');
let failed=false;
function check(title,ok,details){console.log((ok?'OK':'PENDENTE')+' | '+title+(details?' | '+details:''));if(!ok)failed=true;}
check('Node.js >=22',Number(process.versions.node.split('.')[0])>=22,process.versions.node);
for(const f of ['src/index.ts','src/web/ui.ts','wrangler.jsonc','migrations/0001_init.sql','migrations/0005_item_fingerprint.sql','migrations/0013_sync_health.sql','migrations/0014_push_subscriptions.sql','migrations/0015_onboarding_progress.sql'])check('Arquivo '+f,existsSync(join(root,f)));
const secretsPath=join(root,'.dev.vars');
if(existsSync(secretsPath)){
 const content=readFileSync(secretsPath,'utf8'),get=k=>content.match(new RegExp('^'+k+'=(.*)$','m'))?.[1]||'';
 check('APP_SECRET formato base64url e 32 bytes',Buffer.from(get('APP_SECRET'),'base64url').length===32);
 check('Senha da instalação longa',get('INSTALLATION_PASSPHRASE').length>=20);
 check('Google OAuth configurado',Boolean(get('GOOGLE_CLIENT_ID')&&get('GOOGLE_CLIENT_SECRET')),'Opcional para usar somente Outlook');
 check('Microsoft OAuth configurado',Boolean(get('MICROSOFT_CLIENT_ID')),'Opcional para usar somente Gmail');
}else console.log('PENDENTE | .dev.vars local inexistente. Execute npm run setup para usar em localhost.');
if(!existsSync(join(root,'package-lock.json')))console.log('PENDENTE | package-lock.json: instalar dependências em ambiente com acesso ao npm e versionar lockfile antes de lançamento.');
console.log('AVISO | OAuth e Cloudflare reais não são testados pelo doctor local.');

if(strict){
 const wrangler=readFileSync(join(root,'wrangler.jsonc'),'utf8');
 check('Release: package-lock.json obrigatório',existsSync(join(root,'package-lock.json')));
 check('Release: banco D1 provisionado',!wrangler.includes('00000000-0000-0000-0000-000000000000'));
 check('Release: origem Cloudflare real',!wrangler.includes('YOUR-SUBDOMAIN.workers.dev'));
 if(failed)process.exitCode=2;
 console.log('OBS: ainda é obrigatória homologação externa OAuth, D1 real, CPU Worker e dispositivos; este doctor não a substitui.');
}

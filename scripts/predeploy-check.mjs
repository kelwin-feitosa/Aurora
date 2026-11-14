#!/usr/bin/env node
/* Fail closed rather than accidentally deploy with example identifiers. */
import {readFileSync} from 'node:fs';
const txt=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
const faults=[];
if(txt.includes('00000000-0000-0000-0000-000000000000'))faults.push('D1 database_id ainda é placeholder: configure o binding real');
if(txt.includes('YOUR-SUBDOMAIN.workers.dev'))faults.push('PUBLIC_ORIGIN ainda é placeholder: defina o endereço HTTPS verdadeiro');
if(!txt.includes('"binding": "DB"'))faults.push('Binding DB não encontrado');
if(!txt.includes('"triggers"'))faults.push('Agendamento de sincronização não encontrado');
if(faults.length){for(const f of faults)console.error('BLOQUEADO:',f);process.exitCode=1;}
else console.log('Pré-checagem local de configuração aprovada. NÃO verifica secrets, políticas OAuth, quotas ou deploy remoto.');

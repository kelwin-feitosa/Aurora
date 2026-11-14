#!/usr/bin/env node
/** Local wizard: creates ONLY local secrets. Never uploads or collects provider passwords. */
import {randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const project=fileURLToPath(new URL('../',import.meta.url));
const file=join(project,'.dev.vars');
const ask=createInterface({input,output});
const headline='✦ Aurora — Assistente de configuração local';
function reply(text){output.write(text+'\n');}
try{
 reply('\n'+headline+'\n');reply('Este assistente cria a configuração para rodar o Aurora NO SEU computador.');
 reply('Ele não acessa sua faculdade, não cria contas de nuvem nem executa comandos sem autorização.\n');
 if(existsSync(file)){reply('Já existe uma configuração. Para proteger credenciais, este assistente não a sobrescreve.');process.exitCode=1;}
 else{
  const proceed=(await ask.question('Deseja continuar? [s/N] ')).trim().toLowerCase();
  if(proceed==='s'||proceed==='sim'){
   const appSecret=randomBytes(32).toString('base64url');
   const passphrase='aurora-'+randomBytes(24).toString('base64url');
   reply('\nO Aurora utiliza OAuth oficial. Se ainda não possui credenciais, você poderá configurá-las depois.');
   const google=(await ask.question('Client ID Google (Enter para deixar vazio): ')).trim();
   const googleSecret=(await ask.question('Client secret Google (Enter para deixar vazio): ')).trim();
   const ms=(await ask.question('Client ID Microsoft (Enter para deixar vazio): ')).trim();
   const msSecret=(await ask.question('Client secret Microsoft (Enter para deixar vazio): ')).trim();
   for(const value of [google,googleSecret,ms,msSecret]){if(/[\r\n]/.test(value))throw new Error('Caracteres inválidos nas credenciais');}
   const contents=[`APP_SECRET=${appSecret}`,`INSTALLATION_PASSPHRASE=${passphrase}`,`GOOGLE_CLIENT_ID=${google}`,`GOOGLE_CLIENT_SECRET=${googleSecret}`,`MICROSOFT_CLIENT_ID=${ms}`,`MICROSOFT_CLIENT_SECRET=${msSecret}`,`MICROSOFT_TENANT=organizations`,`AUTO_APPROVE_MODE=review`,`TRUSTED_SENDER_ADDRESSES=`].join('\n')+'\n';
   writeFileSync(file,contents,{mode:0o600,flag:'wx'});
   reply('\n✓ Configuração criada no arquivo local .dev.vars (fora do Git).');
   reply('\nSUA SENHA DE ACESSO AO AURORA (guarde em um gerenciador de senhas):\n'+passphrase+'\n');
   reply('Para iniciar na sua máquina: npm run dev');
   reply('Depois abra http://localhost:8787 no navegador.');
   reply('Para hospedar sem manter o PC ligado, consulte docs/INSTALACAO.md e siga o deploy oficial.');
   reply('ATENÇÃO: o deploy na nuvem precisa de secrets próprios, PUBLIC_ORIGIN correto e OAuth registrados.');
  }else reply('Instalação cancelada sem alterações.');
 }
}finally{ask.close();}

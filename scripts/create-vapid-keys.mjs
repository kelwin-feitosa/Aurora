/** Generate owner-controlled Web Push VAPID keys offline. Never commit the output. */
import {generateKeyPairSync} from 'node:crypto';
import fs from 'node:fs';
const out=new URL('../.vapid-keys.local',import.meta.url);
if(fs.existsSync(out)){console.error('Arquivo .vapid-keys.local já existe. Nada foi sobrescrito.');process.exit(2);}
const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const pub=publicKey.export({format:'jwk'}),priv=privateKey.export({format:'jwk'});
const raw=Buffer.concat([Buffer.from([4]),Buffer.from(pub.x,'base64url'),Buffer.from(pub.y,'base64url')]);
const contents=`# Chaves pessoais — não compartilhar nem colocar no Git.\n# Configure como secrets na Cloudflare (Worker > Settings > Variables and Secrets).\nPUSH_ENABLED=1\nVAPID_PUBLIC_KEY=${raw.toString('base64url')}\nVAPID_PRIVATE_KEY=${priv.d}\nVAPID_CONTACT=mailto:SEU-EMAIL-DE-CONTATO\n`;
fs.writeFileSync(out,contents,{flag:'wx',mode:0o600});
console.log('Chaves geradas em .vapid-keys.local com permissão restrita. Configure VAPID_CONTACT e instale os segredos na sua instância; NÃO compartilhe o arquivo.');

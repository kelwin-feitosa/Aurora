import fs from 'node:fs';
const root=new URL('../src/web/',import.meta.url);
const files=[['HTML','ui.html'],['CSS','style.css'],['JS','client.js'],['PWA_MANIFEST','manifest.webmanifest'],['SERVICE_WORKER','sw.js'],['OFFLINE_PAGE','offline.html'],['OFFLINE_CSS','offline.css'],['INSTALL_HTML','install.html'],['INSTALL_CSS','install.css'],['INSTALL_JS','install.js'],['DEMO_HTML','demo.html']];
let result='// AUTO-GENERATED: edit sources under src/web/, then npm run build.\n';
for(const [key,file] of files){const str=fs.readFileSync(new URL(file,root),'utf8');result+=`export const ${key}:string = ${JSON.stringify(str)};\n`;}
for(const [key,file] of [['ICON_192','icons/aurora-192.png'],['ICON_512','icons/aurora-512.png'],['ICON_MASKABLE','icons/aurora-maskable-512.png']]){result+=`export const ${key}:string = ${JSON.stringify(fs.readFileSync(new URL(file,root)).toString('base64'))};\n`;}
fs.writeFileSync(new URL('ui.ts',root),result);

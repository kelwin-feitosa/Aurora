import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const root=new URL('../src/web/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.webmanifest',root),'utf8'));
assert.equal(manifest.id,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');
assert.equal(manifest.lang,'pt-BR');
for(const icon of manifest.icons){const file=new URL('.'+icon.src.slice('/assets'.length),root);assert.ok(statSync(file).size>0);}
const files=['ui.html','client.js','style.css','sw.js','install.js','install.css','manifest.webmanifest'];
const version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
const result={version,files:{},total_gzip_bytes:0};
for(const file of files){const bytes=readFileSync(new URL(file,root));const gzip=gzipSync(bytes,{level:9}).length;result.files[file]={raw:bytes.length,gzip};result.total_gzip_bytes+=gzip;}
assert.ok(result.total_gzip_bytes<60000,'frontend exceeds compact static payload budget');
const sw=readFileSync(new URL('sw.js',root),'utf8');assert.match(sw,/startsWith\('\/api\/\'\)/);assert.match(sw,/STATIC\.has/);
console.log(JSON.stringify(result,null,2));

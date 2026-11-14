import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {join} from 'node:path';
export class SQLiteD1 {
 constructor(file=':memory:',migrate=true){this.native=new DatabaseSync(file);if(file!==':memory:')fs.chmodSync(file,0o600);this.native.exec('PRAGMA foreign_keys=ON;');this.native.exec('PRAGMA busy_timeout=3000;');if(migrate)this.migrate();}
 migrate(){this.native.exec('CREATE TABLE IF NOT EXISTS _local_migrations(file TEXT PRIMARY KEY)');for(const file of fs.readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort()){if(this.native.prepare('SELECT file FROM _local_migrations WHERE file=?').get(file))continue;const sql=fs.readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8');this.native.exec('BEGIN IMMEDIATE');try{this.native.exec(sql);this.native.prepare('INSERT INTO _local_migrations(file) VALUES(?)').run(file);this.native.exec('COMMIT')}catch(e){this.native.exec('ROLLBACK');throw e}}}
 prepare(sql){const db=this.native;const statement=db.prepare(sql);let params=[];return{bind(...v){params=v.map(x=>x===undefined?null:x);return this},async first(){return statement.get(...params)??null},async all(){return{results:statement.all(...params)}},async run(){const r=statement.run(...params);return{success:true,meta:{changes:r.changes,last_row_id:r.lastInsertRowid}}}};}
 async batch(statements){this.native.exec('BEGIN IMMEDIATE');try{const result=[];for(const statement of statements)result.push(await statement.run());this.native.exec('COMMIT');return result;}catch(e){this.native.exec('ROLLBACK');throw e;}}
 close(){this.native.close();}
}

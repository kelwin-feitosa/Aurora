import {randomBytes} from 'node:crypto';
import {SQLiteD1} from '../scripts/sqlite-adapter.mjs';
export function setup(){const db=new SQLiteD1();const env={DB:db,APP_SECRET:randomBytes(32).toString('base64url'),INSTALLATION_PASSPHRASE:'key-for-tests-only-very-long-2026',PUBLIC_ORIGIN:'https://aurora.example.test',GOOGLE_CLIENT_ID:'test-google',GOOGLE_CLIENT_SECRET:'test-secret',MICROSOFT_CLIENT_ID:'test-ms',MICROSOFT_CLIENT_SECRET:'test-ms-secret',SYNC_LIMIT:'3',AUTO_APPROVE_MODE:'trusted-senders',TRUSTED_SENDER_ADDRESSES:'professor@school.edu'};return {db,env,close:()=>db.close()};}
export function fakeResponse(o,status=200){return new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json'}});}
export function mail(subject,body,id='a'){return{id,revision:'0',subject,body,receivedAt:'2026-11-10T10:00:00.000Z'};}

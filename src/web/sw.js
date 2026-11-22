/* Aurora PWA - only public immutable assets are cacheable. Never cache personal data. */
'use strict';
const CACHE='aurora-public-v2.2.0';
const STATIC=new Set(['/assets/aurora.css','/assets/aurora.js','/assets/icons/aurora-192.png','/assets/icons/aurora-512.png','/assets/icons/aurora-maskable-512.png','/assets/manifest.webmanifest','/offline.html','/assets/offline.css']);
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{const cache=await caches.open(CACHE); await cache.addAll([...STATIC]);})());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('aurora-public-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const u=new URL(req.url);
 if(u.origin!==self.location.origin)return;
 // Explicit bypass for every authenticated/API/OAuth route, private HTML or dynamic resource.
 if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/oauth/')||!STATIC.has(u.pathname)){
   if(req.mode==='navigate')event.respondWith(fetch(req,{cache:'no-store'}).catch(async()=>{
      return await (await caches.open(CACHE)).match('/offline.html')||Response.error();
   }));
   return;
 }
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const found=await cache.match(u.pathname);
  if(found)return found;
  const res=await fetch(req,{cache:'no-store'});
  if(res.ok&&res.type==='basic')await cache.put(u.pathname,res.clone());
  return res;
 })());
});
self.addEventListener('message',event=>{
 // Only a same-origin browser client may request a service-worker activation.
 // Reject unknown senders and malformed URLs instead of trusting the payload.
 const senderUrl=event.source?.url;
 if(typeof senderUrl!=='string')return;
 let sameOrigin=false;
 try{sameOrigin=new URL(senderUrl).origin===self.location.origin;}catch{return;}
 if(!sameOrigin)return;
 if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
 // No authentication data, inbox state or tokens ever travel through this channel.
});

// Empty-payload Web Push: never put email content on the lock screen.
self.addEventListener('push',event=>{
 event.waitUntil(self.registration.showNotification('Aurora', {
  body:'Há informações acadêmicas para conferir no aplicativo.',
  tag:'aurora-review',renotify:false,icon:'/assets/icons/aurora-192.png',
  data:{path:'/'}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=clients.find(c=>new URL(c.url).origin===self.location.origin);
  if(existing){await existing.focus();return;}
  await self.clients.openWindow('/');
 })());
});

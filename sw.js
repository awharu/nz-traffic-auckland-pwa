const STATIC_CACHE = 'static-v1';
const IMG_CACHE = 'img-v1';
const CORE_ASSETS = [ '/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png' ];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(STATIC_CACHE).then(c=>c.addAll(CORE_ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', (e)=>{
  e.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>![STATIC_CACHE, IMG_CACHE].includes(k)).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/icons/') || CORE_ASSETS.includes(url.pathname)){
    e.respondWith(caches.match(e.request).then(r=>r || fetch(e.request)));
    return;
  }
  if (/\.(jpg|jpeg|png)$/i.test(url.pathname)){
    e.respondWith((async()=>{
      const cache = await caches.open(IMG_CACHE);
      const cached = await cache.match(e.request);
      const net = fetch(e.request).then(resp=>{ cache.put(e.request, resp.clone()); return resp; }).catch(()=>cached);
      return cached || net;
    })());
    return;
  }
});
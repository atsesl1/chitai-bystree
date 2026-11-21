const VERSION = 'aa9cc36e4561cf56';
const ASSETS = ["./","./install.js","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png","./icons/apple-touch.png"];
const shell = self.registration.scope;
const prefix = 'chitai-bystree:' + new URL(shell).pathname + ':';
const name = prefix + VERSION;
const assets = new Set(ASSETS.map(path => new URL(path, shell).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(name);
    await cache.addAll([...assets].map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const obsolete = (await caches.keys()).filter(key => key.startsWith(prefix) && key !== name);
    await Promise.all(obsolete.map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const url = request.mode === 'navigate' && new URL(request.url).pathname === new URL(shell).pathname ? shell : request.url;
  if (!assets.has(url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(name);
    return (await cache.match(url)) ?? fetch(request);
  })());
});

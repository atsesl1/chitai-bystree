const VERSION = 'cf610435882475ed';
const ASSETS = ["./","./install.js","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png","./icons/apple-touch.png"];
const shell = self.registration.scope;
const prefix = 'chitai-bystree:' + new URL(shell).pathname + ':';
const assets = new Set(ASSETS.map(path => new URL(path, shell).href));
let database;

function openDatabase() {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open(prefix + 'offline', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('files');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { database = null; reject(request.error); };
    });
  }
  return database;
}

async function withFiles(mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', mode);
    let request;
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onabort = () => reject(transaction.error ?? new Error('Offline storage unavailable'));
    try { request = action(transaction.objectStore('files')); }
    catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const files = await Promise.all([...assets].map(async url => {
      const response = await fetch(url, { cache: 'reload', redirect: 'error' });
      if (response.status !== 200) throw new Error('Offline asset unavailable');
      const headers = new Headers(response.headers);
      // Response bodies are already decoded when read as bytes.
      for (const name of ['content-length', 'content-encoding', 'transfer-encoding']) headers.delete(name);
      return { url, bytes: await response.arrayBuffer(), headers: [...headers] };
    }));
    // Commit the whole release before the new worker can serve it after a cold launch.
    await withFiles('readwrite', store => {
      for (const { url, ...file } of files) store.put(file, [VERSION, url]);
    });
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await withFiles('readwrite', store => {
      const keys = store.getAllKeys();
      keys.onsuccess = () => {
        for (const key of keys.result) if (key[0] !== VERSION) store.delete(key);
      };
    });
    await self.clients.claim();
    // Cleanup of the previous storage format is optional for the new offline reader.
    try {
      for (const key of await caches.keys()) if (key.startsWith(prefix)) await caches.delete(key);
    } catch {}
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const key = request.mode === 'navigate' && url.pathname === new URL(shell).pathname ? shell : url.href;
  if (!assets.has(key)) return;
  event.respondWith((async () => {
    const file = await withFiles('readonly', store => store.get([VERSION, key]));
    return file ? new Response(file.bytes, { headers: file.headers }) : fetch(request);
  })());
});

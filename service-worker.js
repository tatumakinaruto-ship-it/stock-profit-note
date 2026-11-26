const CACHE = 'stock-profit-note-v5';
const APP_PATH = '/stock-profit-note/';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await caches.open(CACHE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function patchIndex(response) {
  if (!response || !response.ok) return response;
  let html = await response.text();
  const before = "$('mDate').value=new Date().toISOString().slice(0,10);render();";
  const after = "$('mDate').value=new Date().toISOString().slice(0,10);";
  const attach = "$('refreshPrices').addEventListener('click',refreshMarketPrices);updatePriceMeta();";
  const attachFixed = attach + 'render();';
  if (html.includes(before) && html.includes(attach)) {
    html = html.replace(before, after).replace(attach, attachFixed);
  }
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set('cache-control', 'no-store');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const isIndex = request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === APP_PATH;
  if (isIndex) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        return await patchIndex(response);
      } catch (error) {
        const cached = await caches.match('./index.html');
        return cached ? await patchIndex(cached) : Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        const cache = await caches.open(CACHE);
        await cache.put(request, copy);
      }
      return response;
    } catch (error) {
      return Response.error();
    }
  })());
});

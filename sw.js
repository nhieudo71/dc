/* Service Worker — giúp app chạy offline hoàn toàn (cache app shell + thư viện + font) */
const CACHE = 'dancu-cache-v1';
const CORE = ['./', 'index.html', 'xlsx.full.min.js'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(()=>{})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // KHÔNG cache lời gọi AI Gemini (luôn cần mạng, dữ liệu động)
  if (url.hostname.includes('generativelanguage.googleapis.com')) return;

  const isDoc = req.mode === 'navigate' ||
                (req.destination === 'document') ||
                (url.origin === location.origin && url.pathname.endsWith('index.html'));

  if (isDoc) {
    // HTML: network-first (luôn lấy bản mới khi online), offline thì dùng cache
    e.respondWith(
      fetch(req).then(res => {
        caches.open(CACHE).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('index.html') || caches.match('./')))
    );
    return;
  }

  // Còn lại (xlsx cục bộ, font Google, CDN…): cache-first + nạp ngầm cập nhật
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          caches.open(CACHE).then(c => c.put(req, res.clone()));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// Service worker của trang Viết tắt (iPhone/Android): mở được khi mất mạng.
// Trang viettat.html: ưu tiên MẠNG (luôn có bản mới sau khi deploy), mất mạng mới dùng bản đã lưu. Biểu tượng: lưu sẵn.
// Dữ liệu viết tắt + hình KHÔNG qua đây (trang tự lưu bản sao trong localStorage; gọi GAS là khác miền nên sw bỏ qua).
const V = 'viettat-v1', SHELL = ['viettat.html', 'viettat.webmanifest', 'viettat-icon-192.png', 'viettat-icon-180.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(r).then((res) => { if (res && res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)).catch(() => {}); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || (r.mode === 'navigate' ? caches.match('viettat.html') : Response.error()))));
});

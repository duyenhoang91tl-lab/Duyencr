// Service worker CRM (R10c). ƯU TIÊN MẠNG: có mạng thì luôn lấy bản mới nhất (không kẹt bản cũ sau deploy, như bản tối thiểu trước đây).
// Mạng chậm (>4 giây) hoặc mất mạng → dùng bản đã lưu của CHÍNH tệp đó để CRM vẫn mở được; trong lúc đó vẫn tải bản mới nền để lần sau có sẵn.
// CHỈ xử lý GET cùng miền (index.html, js/, css/, icon). Gọi GAS/Supabase/Worker (khác miền), POST, Range: bỏ qua, để trình duyệt tự tải.
// Dữ liệu khách/đơn KHÔNG nằm ở đây (đi qua GAS) nên offline chỉ mở được khung giao diện, chưa có dữ liệu mới.
const V = 'crm-shell-v1', SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png'], SLOW_MS = 4000;
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request;
  let u; try { u = new URL(r.url); } catch (x) { return; }
  if (r.method !== 'GET' || u.origin !== location.origin || r.headers.has('range')) return;
  e.respondWith(netFirst(r, e));
});
function fromCache(r) { return caches.match(r, { ignoreSearch: true }).then((m) => m || (r.mode === 'navigate' ? caches.match('index.html') : undefined)); }
function netFirst(r, e) {
  const net = fetch(r).then((res) => { if (res && res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)).catch(() => {}); } return res; });
  const slow = new Promise((ok) => setTimeout(() => ok(null), SLOW_MS));
  return Promise.race([net, slow]).then((res) => {
    if (res) return res;                                                   // mạng trả lời kịp
    return fromCache(r).then((m) => { if (m) { e.waitUntil(net.catch(() => {})); return m; } return net; });   // chậm: có bản lưu thì dùng, không thì cứ đợi mạng
  }).catch(() => fromCache(r).then((m) => m || Response.error()));       // mất mạng hẳn
}

#!/usr/bin/env node
// R10c — sw.js của CRM: ưu tiên mạng, rơi về bản lưu khi chậm/mất mạng, bỏ qua khác miền/POST. Chạy: node tools/test-crm-sw.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..'); let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const src = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
function mk(netImpl) {
  const store = {}, handlers = {};
  const cache = { put: async (r, res) => { store[r.url] = res; }, add: async () => {} };
  const ctx = { console, URL, Promise, setTimeout, location: { origin: 'https://x.io' }, Response: { error: () => 'ERR' },
    caches: { open: async () => cache, keys: async () => [], delete: async () => true, match: async (r) => { const k = typeof r === 'string' ? 'https://x.io/' + r : r.url; const hit = store[k] || store[k.split('?')[0]]; return hit; } },
    fetch: netImpl, self: { addEventListener: (n, f) => { handlers[n] = f; }, skipWaiting() {}, clients: { claim() {} } } };
  vm.createContext(ctx); vm.runInContext(src.replace('SLOW_MS = 4000', 'SLOW_MS = 40'), ctx);
  const run = async (req) => { let p, waited = []; handlers.fetch({ request: req, respondWith: (x) => { p = x; }, waitUntil: (x) => waited.push(x) }); return p === undefined ? 'PASSTHROUGH' : await p; };
  return { run, store };
}
const R = (url, o) => Object.assign({ url, method: 'GET', mode: 'cors', headers: { has: () => false } }, o || {});
(async () => {
  const good = { ok: true, tag: 'NET', clone() { return { ok: true, tag: 'COPY' }; } };
  let a = mk(async () => good);
  ok(await a.run(R('https://x.io/js/a.js')) === good, 'có mạng: trả bản MẠNG (không kẹt bản cũ)');
  await new Promise((r) => setTimeout(r, 5)); ok(a.store['https://x.io/js/a.js'] && a.store['https://x.io/js/a.js'].tag === 'COPY', 'có mạng: lưu 1 bản sao để dành');
  ok(await a.run(R('https://script.google.com/macros/s/x/exec')) === 'PASSTHROUGH', 'khác miền (GAS): bỏ qua');
  ok(await a.run(R('https://x.io/a', { method: 'POST' })) === 'PASSTHROUGH', 'POST: bỏ qua');
  ok(await a.run(R('https://x.io/a.mp4', { headers: { has: (h) => h === 'range' } })) === 'PASSTHROUGH', 'Range: bỏ qua');
  let off = mk(async () => { throw new Error('offline'); }); off.store['https://x.io/js/a.js'] = { tag: 'OLD' };
  ok((await off.run(R('https://x.io/js/a.js?v=2'))).tag === 'OLD', 'mất mạng: dùng bản đã lưu (bỏ qua ?v=)');
  ok(await off.run(R('https://x.io/js/none.js')) === 'ERR', 'mất mạng + chưa lưu: báo lỗi (không treo)');
  off.store['https://x.io/index.html'] = { tag: 'HOME' };
  ok((await off.run(R('https://x.io/chua-co', { mode: 'navigate' }))).tag === 'HOME', 'mất mạng, mở trang: rơi về index.html');
  let slow = mk(() => new Promise((r) => setTimeout(() => r(good), 300))); slow.store['https://x.io/js/s.js'] = { tag: 'OLD' };
  ok((await slow.run(R('https://x.io/js/s.js'))).tag === 'OLD', 'mạng chậm (>ngưỡng): dùng bản đã lưu cho nhanh');
  let slow2 = mk(() => new Promise((r) => setTimeout(() => r(good), 120)));
  ok(await slow2.run(R('https://x.io/js/new.js')) === good, 'mạng chậm nhưng chưa có bản lưu: đợi mạng');
  ok(/SHELL = \[[^\]]*\]/.test(src) && [...(src.match(/SHELL = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g))].every((m) => m[1] === './' || fs.existsSync(path.join(root, m[1]))), 'tệp tải sẵn đều tồn tại');
  ok(/register\('sw\.js'\)/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')), 'index.html vẫn đăng ký sw.js');
  console.log(bad ? '\n' + bad + ' LỖI' : '\nTẤT CẢ ĐẠT'); process.exit(bad ? 1 : 0);
})();

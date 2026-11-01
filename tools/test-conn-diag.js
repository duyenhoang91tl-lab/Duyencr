#!/usr/bin/env node
// Test (jsdom) cho js/59-conn-diag.js: ghi log request, lỗi đồng bộ hiện trên màn trống, báo cáo "Chẩn đoán kết nối" + gợi ý đúng từng tình huống.
// CẦN: npm i jsdom (thiếu thì tự bỏ qua).  node tools/test-conn-diag.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP: chua cai jsdom'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'js', '59-conn-diag.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WORKER = 'https://cache.test', DIRECT = 'https://script.google.test/exec';
function boot(net, o) {
  o = o || {};
  const dom = new JSDOM('<!doctype html><body><div id="data-view" style="display:none"></div><div id="empty-view" style="display:flex"><div class="empty-title">Tải file Excel để bắt đầu</div></div></body>', { runScripts: 'outside-only', url: 'https://crm.test/' });
  const w = dom.window, calls = [];
  w.eval("var gsUrl = '" + WORKER + "'; var WORKER_URL = '" + WORKER + "'; var GAS_URL_DIRECT = '" + DIRECT + "'; var allCustomers = " + JSON.stringify(o.customers || []) + "; var customerMap = {}; var cskhData = {}; var _authAccount = { username: 'duyen', role: 'admin' }; var _autoSyncFailCount = 3; var _careSince = ''; var _cskhFailCount = 0;");
  w.esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  w.toast = () => {}; w.syncFromGS = () => {};
  if (o.token !== false) { w.localStorage.setItem('ome_sess_token', 'T'); w.localStorage.setItem('ome_sess_exp', String(o.exp || Date.now() + 86400000)); }
  w.eval("function showSyncErrorBanner(msg){ var b=document.createElement('div'); b.id='sync-err-banner'; b.textContent='Auto-sync thất bại '+(msg||''); document.getElementById('data-view').appendChild(b); }");
  w.fetch = async (url, opts) => {
    calls.push(url); const r = net(url);
    if (r === 'abort') throw new Error('net::ERR_CONNECTION_ABORTED');
    return { ok: r.status === 200, status: r.status, headers: { get: (h) => (h === 'x-crm-cache' ? (r.cache || '') : null) }, text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)) };
  };
  w.eval(code);
  return { w, d: w.document, calls };
}
const okRes = (body) => ({ status: 200, body });
(async () => {
  // 1) log request: thành công + lỗi mạng
  let t = boot((u) => (/action=customers/.test(u) ? 'abort' : okRes({ ok: true })));
  await t.w.fetch(WORKER + '?action=count').catch(() => {}); await t.w.fetch(WORKER + '?action=customers&src=web').catch(() => {}); await t.w.fetch('https://khac.test/x').catch(() => {});
  const log = t.w.eval('_gsNetLog'); ok(log.length === 2, 'chi ghi request toi may chu du lieu (khong ghi trang khac): ' + log.length);
  ok(log[0].a === 'count' && log[0].st === 200 && /ERR_CONNECTION_ABORTED/.test(log[1].err), 'ghi trang thai + loi mang cu the');

  // 2) lỗi đồng bộ hiện trên màn trống (không chỉ trong data-view bị ẩn)
  t.w.showSyncErrorBanner('GAS lỗi: Cần đăng nhập');
  ok(t.d.getElementById('sync-err-banner') && /Cần đăng nhập/.test(t.d.getElementById('ev-neterr').textContent), 'loi hien tren man trong, kem ly do that');
  ok(/KHÔNG phải “chưa có file”/.test(t.d.getElementById('ev-neterr').textContent) && t.d.querySelectorAll('#ev-neterr button').length === 2, 'noi ro khong phai chua co file + nut Thu lai/Chan doan');
  t.w.showSyncErrorBanner('lan 2'); ok(t.d.querySelectorAll('#ev-neterr').length === 1, 'khong nhan doi hop bao loi');
  t = boot(() => okRes({})); t.d.getElementById('empty-view').style.display = 'none'; t.w.showSyncErrorBanner('x'); ok(!t.d.getElementById('ev-neterr'), 'man trong dang an (co du lieu) thi khong chen hop bao');

  // 3) báo cáo: Worker hỏng, Apps Script thẳng OK
  t = boot((u) => (u.startsWith(DIRECT) ? okRes({ ok: true, ver: 'v13.99' }) : 'abort')); t.w.openConnDiag(); await sleep(60);
  let rep = t.d.getElementById('cd-pre').textContent;
  ok(/Máy chủ dữ liệu: https:\/\/cache\.test.*\[qua Worker cache\]/.test(rep) && /có token phiên/.test(rep) && /duyen\/admin/.test(rep), 'bao cao co trang thai dang nhap + may chu');
  ok(/1\) count qua Worker: LỖI MẠNG.*ERR_CONNECTION_ABORTED/.test(rep) && /2\) count gọi THẲNG Apps Script: HTTP 200.*ver=v13\.99/.test(rep), 'do Worker (loi) va Apps Script thang (ok) rieng');
  ok(/Worker KHÔNG gọi được nhưng Apps Script gọi thẳng được/.test(rep) && /\?worker=0/.test(rep), 'goi y: Worker bi chan tren mang nay -> ?worker=0');
  // 4) cả hai hỏng
  t = boot(() => 'abort'); t.w.openConnDiag(); await sleep(60); rep = t.d.getElementById('cd-pre').textContent; ok(/đang không ra Internet/.test(rep), 'ca hai hong -> khong ra Internet');
  // 5) customers báo lỗi đăng nhập + chưa có token
  t = boot((u) => (/action=customers/.test(u) ? okRes({ error: 'Cần đăng nhập' }) : okRes({ ok: true })), { token: false }); t.w.openConnDiag(); await sleep(60); rep = t.d.getElementById('cd-pre').textContent;
  ok(/BÁO LỖI: Cần đăng nhập/.test(rep) && /KHÔNG có token/.test(rep) && /máy chủ báo lỗi "Cần đăng nhập"/.test(rep) && /Chưa có token/.test(rep), 'customers bao loi + chua co token');
  // 6) phiên hết hạn
  t = boot(() => okRes({ ok: true, rows: [] }), { exp: Date.now() - 1000 }); t.w.openConnDiag(); await sleep(60); ok(/ĐÃ HẾT HẠN/.test(t.d.getElementById('cd-pre').textContent) && /Phiên đăng nhập đã hết hạn/.test(t.d.getElementById('cd-pre').textContent), 'phien het han');
  // 7) mọi thứ OK nhưng trang vẫn 0 khách -> lỗi xử lý phía trang
  t = boot((u) => okRes(/action=customers/.test(u) ? { rows: [{ phone: '1' }, { phone: '2' }] } : { ok: true, ver: 'x' })); t.w.openConnDiag(); await sleep(60); rep = t.d.getElementById('cd-pre').textContent;
  ok(/3\) customers \(đầy đủ\) qua Worker: HTTP 200.*rows=2/.test(rep) && /allCustomers=0/.test(rep) && /lỗi xử lý phía trang/.test(rep), 'server OK + 0 khach -> loi phia trang');
  // 8) kiểm tra đầy đủ chạy thêm cskh + orders
  t = boot(() => okRes({ ok: true, rows: [], orders: [] })); t.w.openConnDiag(); await sleep(40); t.d.getElementById('cd-deep').click(); await sleep(80);
  ok(/4\) cskhDuyenLite/.test(t.d.getElementById('cd-pre').textContent) && /5\) orders/.test(t.d.getElementById('cd-pre').textContent), 'kiem tra day du them cskh + orders');
  console.log('ALL CONN DIAG TESTS PASSED');
})().catch((e) => { console.error('FAIL (exception):', e); process.exit(1); });

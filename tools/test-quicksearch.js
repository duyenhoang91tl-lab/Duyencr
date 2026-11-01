#!/usr/bin/env node
// Test: tim nhanh (header #qs-input + thanh Bao cao #rpt-qs-input) -> mo the khach ben phai (openDp) KHONG roi bao cao. Duyen yeu cau 2026-10-23.
// Chay: NODE_PATH=<noi cai jsdom>/node_modules node tools/test-quicksearch.js -> "QUICKSEARCH TESTS PASSED"
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'js', '29-sidenav.js'), 'utf8');
const i0 = src.indexOf('var _qs = {'); ok(i0 > 0, 'thieu khoi _qs trong js/29');
const code = src.slice(i0);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const dom = new JSDOM('<body class="rpt-mode"><div id="rpt-bar"><input id="rpt-qs-input"></div></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  const log = { fetch: [], open: [], pull: [], toast: [] };
  w.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  w.toast = m => log.toast.push(m);
  w.normPhone = s => { const d = String(s || '').replace(/\D/g, ''); return d.length === 9 ? '0' + d : d; };
  w.gsUrl = 'https://gas.test/exec';
  w.allCustomers = [{ phone: '0901111222', name: 'Nguyễn Thị Bích' }, { phone: '0903333444', name: 'Trần Văn A' }];
  w.customerMap = { '0901111222': w.allCustomers[0], '0903333444': w.allCustomers[1] };
  w.careData = { '0901111222': { cs: 'ninhnga99' } };
  w.openDp = p => log.open.push(p);
  w._pullSearchCustomer_ = async p => { log.pull.push(p); w.customerMap[p] = { phone: p, name: 'Ngoai pham vi' }; return p; };
  let delay = 0;
  w.fetch = async url => { log.fetch.push(url); await sleep(delay); const q = decodeURIComponent(url.split('q=')[1]);
    const rs = /1011t09/i.test(q) ? [{ src: 'Mã bộ đếm (Base)', code: '1011T09/2026', phone: '0901111222', date: '2026-10-01', product: 'HAT NG' }] : [{ src: 'DT TỔNG', code: q + '-x', phone: '0903333444' }];
    return { json: async () => ({ ok: true, results: rs }) }; };
  w.eval(code);
  const inp = w.document.getElementById('rpt-qs-input');
  const type = v => { inp.value = v; inp.dispatchEvent(new w.Event('input', { bubbles: true })); };
  const key = k => inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));
  const box = () => w.document.getElementById('qs-res');

  // 1) ma bo dem cua Duyen: go -> khung ket qua hien dong 📦 -> Enter -> openDp dung khach, tab van la bao cao (rpt-mode)
  type('1011T09/2026'); await sleep(450);
  ok(/searchOrder/.test(log.fetch[0]) && /1011T09%2F2026/.test(log.fetch[0]), 'goi searchOrder voi ma: ' + log.fetch[0]);
  ok(box().style.display === 'block' && /1011T09\/2026/.test(box().textContent) && /0901111222/.test(box().textContent), 'khung ket qua hien ma don + SDT');
  ok(/Nguyễn Thị Bích/.test(box().textContent), 'hien ten khach lay tu customerMap');
  key('Enter'); await sleep(20);
  ok(JSON.stringify(log.open) === '["0901111222"]', 'Enter mo the khach: ' + JSON.stringify(log.open));
  ok(box().style.display === 'none', 'chon xong an khung');
  ok(w.document.body.classList.contains('rpt-mode'), 'van o man bao cao (khong chuyen tab)');

  // 2) ten co dau go khong dau
  log.open.length = 0; type('nguyen thi bich'); await sleep(450);
  ok(/Nguyễn Thị Bích/.test(box().textContent) && /ninhnga99/.test(box().textContent), 'tim ten khong dau + hien CS');
  box().querySelector('.qs-i').click(); await sleep(20);
  ok(log.open[0] === '0901111222', 'bam dong khach mo the');
  // 3) SDT 1 phan
  type('0903333'); await sleep(450); key('Enter'); await sleep(20);
  ok(log.open[1] === '0903333444', 'Enter chon dong dau (SDT go 1 phan)');
  // 4) SDT ngoai danh sach -> tra cuu rieng roi mo
  type('0909999999'); await sleep(450);
  ok(/Tra cứu khách theo SĐT/.test(box().textContent), 'goi y tra cuu SDT ngoai danh sach');
  key('Enter'); await sleep(30);
  ok(log.pull[0] === '0909999999' && log.open[2] === '0909999999', 'nap rieng khach roi mo the: ' + JSON.stringify(log));
  // 5) go tiep khi ket qua cu chua ve -> bo ket qua cu
  delay = 200; const nF = log.fetch.length; type('ABC123'); await sleep(350); type('ABC1234'); await sleep(900);
  ok(log.fetch.length === nF + 2, 'goi 2 lan');
  ok(!/ABC123-x/.test(box().textContent.replace(/ABC1234-x/g, '')) , 'ket qua cu (ABC123) bi bo, chi con ABC1234: ' + box().textContent);
  // 6) Escape
  key('Escape'); ok(box().style.display === 'none', 'Esc an khung');
  // 7) khong khop
  delay = 0; type('zzzzqq'); await sleep(450); ok(/Không có khách/.test(box().textContent), 'bao khong khop');
  // 8) tai khoan test: khong tim ma don, khong tra cuu ngoai danh sach
  w.document.body.classList.add('demo-mode'); const n2 = log.fetch.length, p2 = log.pull.length;
  type('1011T09/2026'); await sleep(450); ok(log.fetch.length === n2, 'demo-mode khong goi searchOrder');
  type('0908888888'); await sleep(450); ok(!/Tra cứu khách theo SĐT/.test(box().textContent), 'demo-mode khong goi y tra cuu ngoai danh sach');
  ok(log.pull.length === p2, 'demo-mode khong nap khach ngoai');
  console.log('QUICKSEARCH TESTS PASSED');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

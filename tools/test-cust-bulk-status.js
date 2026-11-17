#!/usr/bin/env node
// Test R5a bước 3: đổi Tình trạng CS / Trạng thái KH hàng loạt (js/84-cust-bulk-status.js). NODE_PATH=<jsdom> node tools/test-cust-bulk-status.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const src82 = fs.readFileSync(path.join(ROOT, 'js', '82-cust-select.js'), 'utf8'), src84 = fs.readFileSync(path.join(ROOT, 'js', '84-cust-bulk-status.js'), 'utf8');
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const B = require(path.join(ROOT, 'js', '84-cust-bulk-status.js'));
const cust = { 1: { phone: '1' }, 2: { phone: '2' }, 3: { phone: '3' }, 4: { phone: '4' }, 5: { phone: '5' } };
const care = { 1: { status: 'goi_lai', khStatus: 'KH-A', note: 'giu' }, 2: { status: 'da_goi' }, 4: { status: 'moi' } };
const look = (p) => cust[p] || null, scope = (c) => c.phone !== '5', auto = (s) => (s === 'moi' ? 'KH-Moi' : '');
let P = B.bsPlan_(['1', '2', '3', '4', '5', '9'], 'status', 'moi', look, care, scope, { autoKh: auto });
ok(P.rows.map((r) => r.phone).join() === '1,2,3' && P.same === 1 && P.noScope === 1 && P.notFound === 1, 'status->moi: doi 1,2,3; bo qua 4 (da dung), 5 (ngoai pham vi), 9 (khong thay)');
ok(P.rows[0].kh === '' && P.rows[1].kh === 'KH-Moi' && P.rows[2].kh === 'KH-Moi' && P.autoKh === 2, 'tu dien Trang thai KH chi cho khach CHUA co KH (khach 1 da co KH-A -> giu nguyen)');
ok(P.byFrom.goi_lai === 1 && P.byFrom.da_goi === 1 && P.byFrom['(trống)'] === 1 && B.bsSummary_(P).split(', ').length === 3, 'tom tat nguon: goi_lai 1, da_goi 1, (trong) 1');
P = B.bsPlan_(['1', '2'], 'khStatus', 'KH-B', look, care, scope, { autoKh: auto });
ok(P.rows.length === 2 && P.autoKh === 0 && P.rows[0].from === 'KH-A' && P.rows[1].from === '', 'khStatus: khong tu dien them; from dung');
ok(B.bsPlan_(['1', '2'], 'status', '', look, care, scope).rows.length === 0, 'gia tri rong -> KHONG co dong nao (tranh vo tinh xoa trang thai)');
ok(B.bsPlan_(['1'], 'zzz', 'x', look, care, scope).rows.length === 0, 'truong la -> bo qua');
const big = {}, ph = []; for (let i = 0; i < 136000; i++) { big[i] = { phone: String(i) }; ph.push(String(i)); }
let t0 = Date.now(); const PB = B.bsPlan_(ph, 'status', 'moi', (p) => big[p], {}, () => true, { autoKh: auto }); const dt = Date.now() - t0;
ok(PB.rows.length === 136000 && dt < 2000, 'ke hoach 136k khach nhanh (' + dt + 'ms)');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('(bo qua jsdom)'); }
if (JSDOM) {
  const dom = new JSDOM('<table><thead><tr><th id="th-name"><div class="th-inner">K</div></th></tr></thead><tbody id="table-body"></tbody></table>', { runScripts: 'outside-only' });
  const w = dom.window, audits = [], toasts = [], synced = [], saved = []; let filters = 0;
  w.careData = JSON.parse(JSON.stringify(care)); w.allCust = cust; w.gsUrl = 'https://x';
  w.toast = (m) => toasts.push(m); w.logAudit = (a, p, o, n) => audits.push([a, p, o, n]); w._touchCare = (p) => { w.careData[p].updated = 'T'; }; w.saveLS = (k, v) => saved.push(k);
  w._invalidateFilterCache = () => {}; w.queueCareSync = (p) => synced.push(p); w.updateStats = () => {}; w.updateSidebarBadges = () => {}; w.applyFilters = () => { filters++; };
  w._customerByPhone = look; w._inUserScope = scope; w._hAutoKh_ = auto; w._hIsChot_ = (v) => v === 'chot';
  w.esc = (s) => String(s); w._buildCareStatusOptions = () => '<option value="">— Chọn —</option><optgroup label="Gọi"><option value="goi_lai">Gọi - lại</option><option value="moi">Gọi - mới</option></optgroup><optgroup label="Chốt"><option value="chot">Chốt - xong</option></optgroup>';
  w._buildCustStatusOptions = () => '<option value="">— Chọn —</option><option value="KH-A">KH A</option><option value="KH-B">KH B</option>';
  w._vt = { list: [{ phone: '1' }, { phone: '2' }, { phone: '3' }] }; w._rowHtml = (c) => '<tr data-phone="' + c.phone + '"><td class="col-name">' + c.phone + '</td></tr>';
  w._renderVirtualWindow = () => { w.document.getElementById('table-body').innerHTML = w._vt.list.map((c) => w._rowHtml(c)).join(''); };
  w.renderTable = (l) => { w._vt.list = l; w._renderVirtualWindow(); };
  w.eval(src82); w.eval(src84); w.renderTable(w._vt.list);
  const D = w.document; D.querySelectorAll('.cs-sel-box').forEach((b) => b.click());
  const bar = D.getElementById('cs-selbar');
  ok(!!bar.querySelector('[data-cs-act="run:set-status"]') && !!bar.querySelector('[data-cs-act="run:set-kh"]'), 'thanh co 2 nut: Tinh trang CS + Trang thai KH');
  bar.querySelector('[data-cs-act="run:set-status"]').click();
  let m = D.getElementById('bs-modal'); ok(!!m && /3 khách đã chọn/.test(m.textContent), 'mo hop thoai doi tinh trang cho 3 khach');
  const opts = [...m.querySelectorAll('#bs-to option')].map((o) => o.value);
  ok(opts.includes('goi_lai') && opts.includes('moi') && !opts.includes('chot') && !m.querySelector('optgroup[label="Chốt"]'), 'nhom "Chot" bi an khoi danh sach (phai dat trong ho so)');
  ok(m.querySelector('[data-bs="go"]').disabled === true, 'chua chon -> nut Ap dung khoa');
  const sel = m.querySelector('#bs-to'); sel.value = 'moi'; sel.dispatchEvent(new w.Event('change'));
  ok(/3<\/b> \/ 3 khách sẽ đổi Tình trạng CS → <b>moi/.test(m.querySelector('#bs-preview').innerHTML) && /2 khách chưa có Trạng thái KH/.test(m.textContent), 'xem truoc: 3/3 khach -> moi; bao 2 khach se tu dien KH');
  m.querySelector('[data-bs="go"]').click();
  const cd = w.careData;
  ok(cd[1].status === 'moi' && cd[2].status === 'moi' && cd[3].status === 'moi', 'ghi status moi cho 3 khach');
  ok(cd[1].note === 'giu' && cd[1].khStatus === 'KH-A' && cd[2].khStatus === 'KH-Moi' && cd[3].khStatus === 'KH-Moi', 'GIU NGUYEN du lieu khac (note, KH co san); tu dien KH cho khach chua co');
  ok(cust[1].careStatus === 'moi' && cd[1].updated === 'T', 'cap nhat c.careStatus + _touchCare');
  ok(saved.length === 1 && saved[0] === 'ome_care' && filters === 1 && synced.join() === '1,2,3', 'luu LS 1 lan, loc lai 1 lan, queueCareSync tung khach');
  ok(audits.some((a) => a[1] === '2' && a[2] === 'da_goi' && a[3] === 'moi') && audits.some((a) => a[1] === '2' && /KH-Moi/.test(a[3])), 'nhat ky tung khach (tinh trang + KH tu dien)');
  ok(!D.getElementById('bs-modal') && !bar.classList.contains('is-open') && toasts.some((t) => /Đã đổi Tình trạng CS cho 3 khách → moi/.test(t)), 'dong hop thoai, bo chon, bao da doi');
  // Trang thai KH
  D.querySelectorAll('.cs-sel-box').forEach((b) => b.click());
  bar.querySelector('[data-cs-act="run:set-kh"]').click();
  m = D.getElementById('bs-modal'); const s2 = m.querySelector('#bs-to'); s2.value = 'KH-B'; s2.dispatchEvent(new w.Event('change'));
  ok(!m.textContent.includes('tự điền'), 'doi Trang thai KH: khong co dong tu dien');
  m.querySelector('[data-bs="go"]').click();
  ok(cd[1].khStatus === 'KH-B' && cd[2].khStatus === 'KH-B' && cd[1].status === 'moi', 'doi khStatus 3 khach, status khong bi dung');
  ok(audits.some((a) => a[1] === '1' && a[2] === 'KH: KH-A' && a[3] === 'KH: KH-B'), 'nhat ky KH: KH-A -> KH-B');
}
ok(/js\/84-cust-bulk-status\.js/.test(idx) && idx.indexOf('js/84-cust-bulk-status.js') > idx.indexOf('js/83-cust-bulk-cs.js') && idx.indexOf('js/84-cust-bulk-status.js') > idx.indexOf('js/13-fn-bp'), 'index.html nap js/84 sau js/83 va js/13');
console.log(fail ? '\nFAILED ' + fail : '\nALL CUST-BULK-STATUS TESTS PASSED'); process.exit(fail ? 1 : 0);

#!/usr/bin/env node
// Test R5a bước 2: Gán CS hàng loạt (js/83-cust-bulk-cs.js). Chạy: NODE_PATH=<jsdom> node tools/test-cust-bulk-cs.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const src83 = fs.readFileSync(path.join(ROOT, 'js', '83-cust-bulk-cs.js'), 'utf8'), src82 = fs.readFileSync(path.join(ROOT, 'js', '82-cust-select.js'), 'utf8');
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const B = require(path.join(ROOT, 'js', '83-cust-bulk-cs.js'));
const cust = { 1: { phone: '1', careCS: 'An' }, 2: { phone: '2', careCS: 'Binh' }, 3: { phone: '3' }, 4: { phone: '4', careCS: 'Lan' }, 5: { phone: '5', careCS: 'An' } };
const care = { 2: { cs: 'Cuong' }, 4: { cs: 'Lan' } };   // careData.cs ưu tiên hơn careCS
const look = (p) => cust[p] || null, scope = (c) => c.phone !== '5';
const P = B.bcPlan_(['1', '2', '3', '4', '5', '9'], 'Lan', look, care, scope);
ok(P.rows.length === 3 && P.rows.map((r) => r.phone).join() === '1,2,3', 'doi 1,2,3 sang Lan');
ok(P.same === 1 && P.noScope === 1 && P.notFound === 1, 'bo qua: 1 da la Lan, 1 ngoai pham vi, 1 khong tim thay');
ok(P.rows[1].from === 'Cuong', 'careData.cs uu tien hon careCS (khach 2: Cuong, khong phai Binh)');
ok(P.rows[2].from === '' && P.byFrom['(chưa có CS)'] === 1 && P.byFrom.An === 1 && P.byFrom.Cuong === 1, 'tom tat nguon: An 1, Cuong 1, chua co CS 1');
ok(B.bcSummary_(P).split(', ').length === 3, 'bcSummary_ 3 nhom');
const E = B.bcEntries_(P); ok(E.length === 1 && E[0].csName === 'Lan' && E[0].phones.join() === '1,2,3', 'bcEntries_ dung dinh dang cho _applyCareCSToAssigned');
ok(B.bcEntries_(B.bcPlan_(['4'], 'Lan', look, care, scope)).length === 0, 'khong co ai doi -> khong co entry');
ok(B.bcPlan_(['1'], 'an', look, care, scope).same === 1, 'so ten khong phan biet hoa-thuong');
ok(B.bcPlan_(['1', '2'], '', look, care, scope).rows.length === 0, 'CS nhan rong -> KHONG co dong nao (tranh vo tinh xoa CS cua khach)');
// hieu nang
const big = {}; const ph = []; for (let i = 0; i < 136000; i++) { big[i] = { phone: String(i), careCS: 'X' }; ph.push(String(i)); }
let t0 = Date.now(); const PB = B.bcPlan_(ph, 'Y', (p) => big[p], {}, () => true); const dt = Date.now() - t0;
ok(PB.rows.length === 136000 && dt < 1500, 'ke hoach 136k khach nhanh (' + dt + 'ms)');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('(bo qua jsdom)'); }
if (JSDOM) {
  const dom = new JSDOM('<table><thead><tr><th id="th-name"><div class="th-inner">K</div></th></tr></thead><tbody id="table-body"></tbody></table>', { runScripts: 'outside-only' });
  const w = dom.window, calls = [], toasts = [], audits = [];
  w.currentUser = { role: 'admin', name: 'Admin' }; w.teams = [{ leader: 'Lan', members: ['An', 'Binh'] }]; w.accounts = [];
  w.careData = JSON.parse(JSON.stringify(care)); w.toast = (m) => toasts.push(m); w.logAudit = (a, p, o, n) => audits.push([a, p, o, n]);
  w.clAllowedNames_ = () => ['An', 'Binh', 'Lan']; w._customerByPhone = look; w._inUserScope = scope; w._applyCareCSToAssigned = (e) => { calls.push(e); return e[0].phones.length; };
  w._vt = { list: [{ phone: '1' }, { phone: '2' }] }; w._rowHtml = (c) => '<tr data-phone="' + c.phone + '"><td class="col-name">' + c.phone + '</td></tr>';
  w._renderVirtualWindow = () => { w.document.getElementById('table-body').innerHTML = w._vt.list.map((c) => w._rowHtml(c)).join(''); };
  w.renderTable = (l) => { w._vt.list = l; w._renderVirtualWindow(); };
  w.eval(src82); w.eval(src83); w.renderTable(w._vt.list);
  const D = w.document; D.querySelectorAll('.cs-sel-box').forEach((b) => b.click());
  const bar = D.getElementById('cs-selbar');
  const btn = bar.querySelector('[data-cs-act="run:assign-cs"]');
  ok(!!btn && /Gán CS/.test(btn.textContent), 'admin thay nut "Gan CS" tren thanh');
  btn.click();
  const m = D.getElementById('bc-modal'); ok(!!m && /2 khách đã chọn/.test(m.textContent), 'mo hop thoai gan CS cho 2 khach');
  ok(m.querySelector('[data-bc="go"]').disabled === true, 'chua chon CS -> nut Giao bi khoa');
  const sel = m.querySelector('#bc-to'); sel.value = 'Lan'; sel.dispatchEvent(new w.Event('change'));
  ok(/2<\/b> \/ 2 khách sẽ chuyển sang <b>Lan/.test(m.querySelector('#bc-preview').innerHTML) && !m.querySelector('[data-bc="go"]').disabled, 'xem truoc: 2/2 khach -> Lan; nut Giao bat');
  m.querySelector('[data-bc="go"]').click();
  ok(calls.length === 1 && calls[0][0].csName === 'Lan' && calls[0][0].phones.join() === '1,2', 'goi _applyCareCSToAssigned dung 1 lan voi dung SDT');
  ok(audits.length === 1 && audits[0][0] === 'bulk_assign_cs' && /→ Lan/.test(audits[0][3]), 'ghi nhat ky 1 dong tong');
  ok(!D.getElementById('bc-modal') && !bar.classList.contains('is-open') && toasts.some((t) => /Đã gán 2 khách cho Lan/.test(t)), 'dong hop thoai, bo chon, bao da gan');
  // CS thuong: khong thay nut
  w.currentUser = { role: 'cs', name: 'An' }; D.querySelectorAll('.cs-sel-box')[0].click();
  ok(!w.document.getElementById('cs-selbar').querySelector('[data-cs-act="run:assign-cs"]'), 'CS thuong KHONG thay nut Gan CS');
}
ok(/js\/83-cust-bulk-cs\.js/.test(idx) && idx.indexOf('js/83-cust-bulk-cs.js') > idx.indexOf('js/82-cust-select.js') && idx.indexOf('js/83-cust-bulk-cs.js') > idx.indexOf('js/74-cs-leave-ui.js'), 'index.html nap js/83 sau js/82 va js/74');
ok(/_applyCareCSToAssigned\(bcEntries_/.test(src83) && !/setOrderCareCSBatch/.test(src83), 'dung lai _applyCareCSToAssigned, khong viet lai duong ghi');
console.log(fail ? '\nFAILED ' + fail : '\nALL CUST-BULK-CS TESTS PASSED'); process.exit(fail ? 1 : 0);

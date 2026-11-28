#!/usr/bin/env node
// Test Node (khong can jsdom): TAI KHOAN TEST phia trinh duyet.
// NGUYEN NHAN GOC can test: js/08 _inUserScope tra true cuoi ham cho role 'demo' => thay het danh sach du chi chon 1 sale.
// Chay: node tools/test-demo-scope-ui.js -> "ALL DEMO SCOPE UI TESTS PASSED" neu dat.
const fs = require('fs'), vm = require('vm'), path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let fails = 0;
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); fails++; } else console.log('  ok  ' + m); };

// ── 1) js/08 _inUserScope ──
const s08 = rd('js/08-fn-invalidatefiltercache.js');
const i0 = s08.indexOf('function _inUserScope(c){'), j0 = s08.indexOf('\n}\n', i0);
if (i0 < 0) throw new Error('khong thay _inUserScope');
const fnSrc = s08.slice(i0, j0 + 3);
const mk = cu => {
  const ctx = { currentUser: cu, teams: [], _assignAllIndex: {}, _heldBy: c => c.holder || '', _teamMemberSet: () => new Set(), _leadMonthOk_: () => true };
  vm.createContext(ctx); vm.runInContext(fnSrc, ctx); return ctx;
};
const cust = (holder, extra) => Object.assign({ phone: '0911', holder, careCSSet: new Set([holder]), csSet: new Set([holder]) }, extra || {});
let c = mk({ role: 'demo', name: 'Test', names: ['salea'], username: 'tester', viewNames: [] });
ok(c._inUserScope(cust('salea')) === true, 'demo chon salea: thay khach cua salea');
ok(c._inUserScope(cust('saleb')) === false, 'demo chon salea: KHONG thay khach cua saleb (truoc day thay het)');
ok(c._inUserScope(cust('QUAY')) === false, 'demo: khong thay khach nhom Quay');
c = mk({ role: 'demo', name: 'Test', names: ['salea'], username: 'tester', viewNames: ['QUAY'] });
ok(c._inUserScope(cust('QUAY')) === false, 'demo: viewNames (Quay/CSKH) KHONG duoc cong them');
c = mk({ role: 'demo', name: '', names: [], username: 'tester', viewNames: [] });
ok(c._inUserScope(cust('salea')) === false, 'demo chua chon sale (chi co ten dang nhap): khong thay khach nao');
c = mk({ role: 'cs', name: 'salea', names: ['salea'], viewNames: ['QUAY'] });
ok(c._inUserScope(cust('QUAY')) === true && c._inUserScope(cust('saleb')) === false, 'CS thuong khong doi: van duoc cong ten Quay, khong thay saleb');
c = mk({ role: 'admin' });
ok(c._inUserScope(cust('saleb')) === true, 'admin khong doi: thay het');
c = mk({ role: 'viewer', names: ['a'] });   // (viewer names rong tra false ca o ban goc 6062ce3: khong lien quan thay doi nay)
ok(c._inUserScope(cust('saleb')) === true, 'viewer/CEO khong doi: thay het');

// ── 2) js/51 chan POST o trinh duyet ──
const calls = [], toasts = [];
const win = { fetch: (u, o) => { calls.push([u, o]); return Promise.resolve({ fromNetwork: true }); } };
const store = { ome_demo_token: 'tok' };
const ctx51 = {
  window: win, document: { documentElement: {}, body: {}, createTreeWalker() {}, createElement() { return {}; } }, console,
  localStorage: { getItem: k => store[k] ?? null }, URL: { createObjectURL() { return 'blob:x'; }, revokeObjectURL() {} },
  HTMLAnchorElement: { prototype: { click() {} } }, Blob: function () {}, NodeFilter: { SHOW_TEXT: 4 }, crypto: {}, TextEncoder,
  setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, Response, Promise, Date, JSON, String,
  gsUrl: 'https://gas.example/exec', toast: m => toasts.push(m)
};
vm.createContext(ctx51); vm.runInContext(rd('js/51-demo-guard.js'), ctx51);
(async () => {
  const GS = 'https://gas.example/exec';
  let r = await win.fetch(GS, { method: 'POST', body: '{"src":"web","token":"' + 'x'.repeat(200) + '","action":"saveSingle","phone":"0911"}' });
  ok(!r.fromNetwork && calls.length === 0, 'demo: POST saveSingle bi chan o trinh duyet, KHONG goi mang');
  const j = await r.json();
  ok(j.ok === false && j.code === 'FORBIDDEN' && /chỉ xem/.test(j.error), 'demo: tra {ok:false,code:FORBIDDEN} de hieu');
  ok(toasts.length === 1 && /chỉ xem/.test(toasts[0]), 'demo: bao 1 cau "chi xem"');
  await win.fetch(GS, { method: 'POST', body: '{"action":"setSetting","key":"a"}' });
  ok(toasts.length === 1 && calls.length === 0, 'demo: bao khong don dap (4 giay), van khong goi mang');
  r = await win.fetch(GS + '?action=customers', { method: 'GET' });
  ok(r.fromNetwork === true && calls.length === 1, 'demo: GET van di binh thuong');
  r = await win.fetch(GS, { method: 'POST', body: '{"src":"web","action":"webLogin","username":"a"}' });
  ok(r.fromNetwork === true, 'demo: webLogin van duoc gui');
  r = await win.fetch('https://other.example/x', { method: 'POST', body: '{"action":"saveSingle"}' });
  ok(r.fromNetwork === true, 'POST toi domain khac GAS khong bi dung toi');
  delete store.ome_demo_token;
  const n0 = calls.length;
  r = await win.fetch(GS, { method: 'POST', body: '{"action":"saveSingle"}' });
  ok(r.fromNetwork === true && calls.length === n0 + 1, 'tai khoan thuong (khong co demoToken): POST di binh thuong');

  // ── 3) js/14: nhanh demo da do phien khac sua (perms theo vai tro) — chi kiem khong ep nhay vao bao cao & khong cong viewNames
  const s14 = rd('js/14-fn-aasplit.js');
  ok(s14.indexOf("switchTab('salesreport'") === -1 || !/acct\.role === 'demo'\) \{[\s\S]{0,900}switchTab\('salesreport'/.test(s14), 'js/14: demo khong bi ep nhay vao bao cao');
  // index.html: dung ban cache-bust moi de trinh duyet tai file da sua
  const idx = rd('index.html');
  ['js/51-demo-guard.js'].forEach(f => {
    const mm = idx.match(new RegExp('src="' + f.replace(/[.]/g, '\\.') + '\\?v=([0-9a-z]+)"'));
    ok(!!mm && mm[1] >= '20261127d', 'index.html: ' + f + ' dung ?v=' + (mm && mm[1]) + ' (da tang de Ctrl+F5 tai ban moi)');
  });
  console.log(fails ? '\n' + fails + ' TEST FAIL' : '\nALL DEMO SCOPE UI TESTS PASSED');
  process.exit(fails ? 1 : 0);
})();

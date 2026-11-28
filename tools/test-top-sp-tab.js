#!/usr/bin/env node
// Test giao dien tab "Top san pham ban" (js/95). Chay: node tools/test-top-sp-tab.js
const fs = require('fs'), vm = require('vm');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../js/95-top-sp-tab.js', 'utf8');
const wrap = { innerHTML: '' }; const calls = []; let reg = null; let nextRes = null;
const sample = { ok: true, dateFrom: '2026-11-21', dateTo: '2026-11-21', totalProducts: 2, totalQty: 9, totalOrders: 4, excludedQty: 3, teams: ['Team A', 'Team B', '(chưa có Team)'],
  rows: [{ key: 'c:VB03', name: 'Vòng bạc', code: 'VB03', soLuong: 5, orders: 2 }, { key: 'c:NV01', name: 'Nhẫn <vàng>', code: 'NV01', soLuong: 4, orders: 2 }], exclude: [{ key: 'c:QT99', name: 'Quà tặng' }] };
function mk(role) {
  const ctx = { gsUrl: 'https://gas.test/exec', currentUser: { role }, localStorage: { getItem: () => 'TOK' }, confirm: () => true, console,
    document: { getElementById: id => id === 'xt-wrap-topsp' ? wrap : null }, fmt: n => String(n), esc: s => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    registerExtraTab: (id, label, fn) => { reg = { id, label, fn }; },
    fetch: async (url, o) => { calls.push({ url, body: o && o.body ? JSON.parse(o.body) : null }); return { json: async () => nextRes || sample }; } };
  vm.createContext(ctx); vm.runInContext(src, ctx); return ctx;
}
(async () => {
  let c = mk('admin');
  ok(reg && reg.id === 'topsp', 'dang ky tab topsp');
  reg.fn(); await new Promise(r => setTimeout(r, 20));
  ok(calls[0].url.includes('action=topProducts') && calls[0].url.includes('token=TOK') && /dateFrom=\d{4}-\d{2}-\d{2}/.test(calls[0].url), 'goi topProducts mac dinh hom nay + token');
  ok(wrap.innerHTML.includes('Vòng bạc') && wrap.innerHTML.includes('Nhẫn &lt;vàng&gt;'), 'hien bang xep hang va escape HTML');
  ok(wrap.innerHTML.includes('Loại</button>'), 'admin thay nut Loai');
  vm.runInContext('_tsToggleTeam("Team A")', c); await new Promise(r => setTimeout(r, 20));
  ok(calls[calls.length - 1].url.includes('team=Team%20A'), 'bam chip Team A -> gui team=Team A');
  vm.runInContext('_tsToggleTeam("Team B")', c); await new Promise(r => setTimeout(r, 20));
  ok(calls[calls.length - 1].url.includes('team=Team%20A%2CTeam%20B'), 'chon 2 team -> cach nhau dau phay');
  vm.runInContext('_tsToggleTeam("")', c); await new Promise(r => setTimeout(r, 20));
  ok(/team=&/.test(calls[calls.length - 1].url), 'bam Tat ca -> bo loc team');
  vm.runInContext('_tsSetRange("yday")', c); await new Promise(r => setTimeout(r, 20));
  const u = calls[calls.length - 1].url, f = u.match(/dateFrom=([\d-]+)/)[1], t = u.match(/dateTo=([\d-]+)/)[1];
  ok(f === t && f < new Date().toISOString().slice(0, 10) + 'x', 'Hom qua: tu = den');
  vm.runInContext('_tsSetRange("7d")', c); await new Promise(r => setTimeout(r, 20));
  const u7 = calls[calls.length - 1].url; ok((new Date(u7.match(/dateTo=([\d-]+)/)[1]) - new Date(u7.match(/dateFrom=([\d-]+)/)[1])) / 864e5 === 6, '7 ngay = 6 ngay chenh lech (gom hom nay)');
  vm.runInContext('_tsExcludeRow(0)', c); await new Promise(r => setTimeout(r, 20));
  const post = calls.filter(x => x.body).pop();
  ok(post && post.body.action === 'saveTopSpExclude' && post.body.token === 'TOK' && post.body.list.length === 2 && post.body.list[1].key === 'c:VB03', 'bam Loai -> gui danh sach cu + SP moi');
  vm.runInContext('_ts.exQ = "Phí ship"; _tsAddExcludeByName()', c); await new Promise(r => setTimeout(r, 20));
  const post2 = calls.filter(x => x.body).pop(); ok(post2.body.list.some(x => x.name === 'Phí ship' && x.key === 'x:phi ship'), 'them theo ten -> khoa x:<ten bo dau>');
  vm.runInContext('_tsUnexclude(0)', c); await new Promise(r => setTimeout(r, 20));
  const post3 = calls.filter(x => x.body).pop(); ok(post3.body.list.length === 0, 'Bo loai muc duy nhat -> gui danh sach rong');
  nextRes = { ok: false, error: 'Chi admin / leader / quan ly moi duoc sua cau hinh nay.' };
  vm.runInContext('tspSaveExclude([])', c); await new Promise(r => setTimeout(r, 20));
  ok(wrap.innerHTML.includes('⚠') && wrap.innerHTML.includes('Chi admin'), 'server tu choi (FORBIDDEN) -> hien canh bao, khong bao da luu');
  nextRes = null;
  c = mk('cs'); reg.fn(); await new Promise(r => setTimeout(r, 20));
  ok(!wrap.innerHTML.includes('🚫 Loại'), 'CS thuong KHONG thay nut Loai');
  vm.runInContext('_ts.showEx = true; _tsRender()', c);
  ok(wrap.innerHTML.includes('Chỉ admin / leader / quản lý được sửa') && !wrap.innerHTML.includes('Bỏ loại'), 'CS xem duoc danh sach loai tru nhung khong sua');

  // --- API dung chung cho Bao cao B ---
  c = mk('admin');
  const K = (a, b) => vm.runInContext('tspKey(' + JSON.stringify(a) + ',' + JSON.stringify(b) + ')', c);
  ok(K('nv 01', 'x') === 'c:NV01' && K('', 'Nhẫn  Vàng') === 'n:nhan vang' && K('(không rõ mã #1)', 'Đá Quý') === 'n:da quy', 'tspKey giong server (ma / ten bo dau / khong ro ma)');
  nextRes = { ok: true, onlyConfig: true, teams: ['Team A', '(chưa có Team)'], exclude: [{ key: 'c:QT99', name: 'Quà tặng' }, { key: 'x:phi ship', name: 'Phí ship' }] };
  const before = calls.length;
  await new Promise(r => vm.runInContext('tspLoadConfig(function(){ globalThis.__done = 1; })', c) || setTimeout(r, 20)); await new Promise(r => setTimeout(r, 20));
  ok(calls[before].url.includes('onlyConfig=1') && c.__done === 1, 'tspLoadConfig goi onlyConfig=1');
  vm.runInContext('tspLoadConfig()', c); await new Promise(r => setTimeout(r, 10)); ok(calls.length === before + 1, 'nap 1 lan/phien (khong goi lai)');
  const X = p => vm.runInContext('tspIsExcluded(' + JSON.stringify(p) + ')', c);
  ok(X({ code: 'qt99', name: 'abc' }) && X({ code: '', name: 'PHI  SHIP' }) && X({ code: 'ZZ', name: 'QUA TANG' }) && !X({ code: 'NV01', name: 'Nhẫn vàng' }), 'tspIsExcluded: theo ma, theo ten bo dau, khong loai nham SP khac');
  let hooked = null; c.vm = vm; vm.runInContext('function _bprdOnExcludeChange_(ch){ globalThis.__hook = ch; }', c);
  nextRes = { ok: true, count: 3, list: [{ key: 'a', name: 'A' }] };
  await vm.runInContext('tspSaveExclude([{key:"a",name:"A"}])', c);
  ok(c.__hook === true && vm.runInContext('tspExclude()', c).length === 1, 'luu xong -> cap nhat cfg + goi hook _bprdOnExcludeChange_(true)');
  ok(vm.runInContext('tspExcludePanelHtml("b")', c).includes('id="ts-exq-b"'), 'khung loai tru co id rieng theo ngu canh');
  console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);
})();

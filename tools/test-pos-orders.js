#!/usr/bin/env node
// Test (2026-11-17) js/88-pos-orders.js — BUOC 2/7 "Danh sach KH khop don POS": nap `donDaily`, giu posOrdersByPhone trong RAM.
// Kiem: dung map {phone:[{ds,name,sales,rev,shares}]} (moi nhat truoc), bo dong sai, chi xu ly khi noi dung doi, khong chong 2 request, khong tut ve 90 ngay khi da mo rong,
// posOrdersEnsureCovers_ goi dung `days` theo ngay xa, tran 400 ngay bao limit, GAS cu (error) giu du lieu cu, khong ghi localStorage.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js/88-pos-orders.js'), 'utf8');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
function boot(handler) {
  const calls = [], ls = {};
  const ctx = { console, Date, Math, JSON, Object, Array, String, Number, Promise, setTimeout, gsUrl: 'https://gas.test/exec',
    localStorage: { setItem: (k, v) => { ls[k] = v; } }, saveLS: (k, v) => { ls[k] = v; },
    fetch: async (u) => { calls.push(u); const body = await handler(u, calls.length); return { text: async () => body }; } };
  vm.createContext(ctx); vm.runInContext(src, ctx); ctx.__calls = calls; ctx.__ls = ls; return ctx;
}
const rowsA = (days) => ({ ok: true, ver: 'donDaily-v1', days, from: ago(days - 1), to: ago(0), n: 3, skipped: { noPhone: 1, noPhoneRev: 500000, noDate: 0, noDateRev: 0 }, rows: [
  ['0912345678', ago(5), 'Lê Thảo', ['biichnguyen1993', 'x2'], 3300000, [['biichnguyen1993', 1650000], ['x2', 1650000]]],
  ['0912345678', ago(2), 'Lê Thảo', ['biichnguyen1993'], 1000000, [['biichnguyen1993', 1000000]]],
  ['0987654321', ago(1), 'Huỳnh Kim', ['abc'], 500000, [['abc', 500000]]],
  ['', ago(1), 'khong sdt', ['abc'], 1, []],          // bo: khong SDT
  ['0911111111', '16/11/2026', 'sai ngay', ['abc'], 1, []],   // bo: ngay sai dinh dang
  ['0922222222'],                                       // bo: thieu cot
] });
(async () => {
  // 1) build
  let C = boot(async () => JSON.stringify(rowsA(90)));
  let r = await vm.runInContext('posOrdersSync_()', C);
  const map = vm.runInContext('posOrdersByPhone', C), meta = vm.runInContext('posOrdersMeta', C);
  ok(r.ok && r.changed && Object.keys(map).join() === '0912345678,0987654321', 'nap donDaily: 2 SDT hop le, bo dong khong SDT / ngay sai / thieu cot');
  ok(map['0912345678'].length === 2 && map['0912345678'][0].ds === ago(2) && map['0912345678'][1].ds === ago(5), 'don moi nhat dung truoc');
  ok(map['0912345678'][1].shares.biichnguyen1993 === 1650000 && map['0912345678'][1].shares.x2 === 1650000 && map['0912345678'][1].rev === 3300000 && map['0912345678'][1].sales.join() === 'biichnguyen1993,x2', 'phan chia theo sale + doanh thu ca don + danh sach sale giu nguyen');
  ok(meta.ok && meta.days === 90 && meta.n === 6 && meta.skipped.noPhone === 1 && vm.runInContext('posOrdersVer', C) === 1, 'meta: days, n, skipped (cho thanh doi soat buoc 6), posOrdersVer=1');
  ok(vm.runInContext('posOrdersOf_("0987654321")', C).length === 1 && vm.runInContext('posOrdersOf_("000")', C).length === 0, 'posOrdersOf_: co / khong co');
  ok(Object.keys(C.__ls).length === 0, 'KHONG ghi localStorage (chi RAM)');
  ok(/action=donDaily&days=90$/.test(C.__calls[0]), 'goi dung action donDaily&days=90 (' + C.__calls[0] + ')');
  // 2) khong hoi lai khi moi tai (<2 phut); ep (force) thi hoi, noi dung y het => changed=false, khong dung lai map
  r = await vm.runInContext('posOrdersSync_()', C); ok(r.ok && r.cached && C.__calls.length === 1, 'moi tai < 2 phut: khong goi lai GAS');
  const mapRef = vm.runInContext('posOrdersByPhone', C);
  r = await vm.runInContext('posOrdersSync_({force:true})', C);
  ok(C.__calls.length === 2 && r.ok && !r.changed && vm.runInContext('posOrdersByPhone', C) === mapRef && vm.runInContext('posOrdersVer', C) === 1, 'ep tai: noi dung y het -> khong dung lai map, posOrdersVer khong doi');
  // 3) khong chong 2 request cung luc
  let slow = 0; C = boot(async () => { slow++; await new Promise(r => setTimeout(r, 30)); return JSON.stringify(rowsA(90)); });
  const p1 = vm.runInContext('posOrdersSync_()', C), p2 = vm.runInContext('posOrdersSync_()', C); await Promise.all([p1, p2]);
  ok(slow === 1, 'goi 2 lan cung luc chi 1 request (' + slow + ')');
  // 4) mo rong khoang: ngay xa 200 ngay truoc -> days=201 (+-1), force; nhip dinh ky sau do KHONG tut ve 90
  C = boot(async (u) => { const d = +/days=(\d+)/.exec(u)[1]; return JSON.stringify(rowsA(d)); });
  await vm.runInContext('posOrdersSync_()', C);
  ok(vm.runInContext('posOrdersCovers_("' + ago(30) + '")', C) === true && vm.runInContext('posOrdersCovers_("' + ago(200) + '")', C) === false, 'posOrdersCovers_: 30 ngay truoc co, 200 ngay truoc chua');
  let e = await vm.runInContext('posOrdersEnsureCovers_("' + ago(200) + '")', C);
  const d2 = +/days=(\d+)/.exec(C.__calls[1])[1];
  ok(e.ok && e.covered && !e.limit && Math.abs(d2 - 201) <= 1 && vm.runInContext('posOrdersMeta.days', C) === d2, 'EnsureCovers 200 ngay truoc: goi days=' + d2 + ', da phu');
  vm.runInContext('posOrdersMeta.loadedAt = 0', C); await vm.runInContext('posOrdersSync_()', C);
  ok(+/days=(\d+)/.exec(C.__calls[2])[1] === d2, 'nhip dinh ky sau khi mo rong van tai ' + d2 + ' ngay, khong tut ve 90');
  e = await vm.runInContext('posOrdersEnsureCovers_("' + ago(10) + '")', C); ok(e.covered && C.__calls.length === 3, 'ngay gan (da phu): khong goi them');
  // 5) tran 400 ngay
  C = boot(async (u) => { const d = +/days=(\d+)/.exec(u)[1]; return JSON.stringify(rowsA(d)); });
  e = await vm.runInContext('posOrdersEnsureCovers_("' + ago(900) + '")', C);
  ok(/days=400$/.test(C.__calls[0]) && e.limit === true && e.covered === false, 'qua 400 ngay: goi days=400, bao limit (GAS gioi han)');
  // 6) GAS cu (khong biet action) / loi mang / JSON hong: giu du lieu cu, khong nem loi
  let mode = 'ok'; C = boot(async () => mode === 'ok' ? JSON.stringify(rowsA(90)) : mode === 'old' ? JSON.stringify({ error: 'Unknown action' }) : mode === 'bad' ? '<html>' : (() => { throw new Error('net'); })());
  await vm.runInContext('posOrdersSync_()', C); const keep = vm.runInContext('posOrdersByPhone', C);
  for (const m of ['old', 'bad', 'net']) { mode = m; r = await vm.runInContext('posOrdersSync_({force:true})', C); ok(r.ok === false && !!r.error && vm.runInContext('posOrdersByPhone', C) === keep && vm.runInContext('posOrdersMeta.ok', C) === true, 'loi "' + m + '": bao loi, GIU du lieu cu'); }
  mode = 'ok'; r = await vm.runInContext('posOrdersSync_({force:true})', C); ok(r.ok, 'sau loi, lan sau van tai duoc (khong ket _posOrdersBusy)');
  // 7) khong gsUrl
  C = boot(async () => '{}'); vm.runInContext('gsUrl = ""', C); r = await vm.runInContext('posOrdersSync_()', C); ok(r.ok === false && C.__calls.length === 0, 'chua cau hinh gsUrl: khong goi');
  // 8) 0 don van la hop le (khong coi la loi)
  C = boot(async () => JSON.stringify({ ok: true, days: 90, from: ago(89), to: ago(0), n: 0, rows: [] })); r = await vm.runInContext('posOrdersSync_()', C);
  ok(r.ok && Object.keys(vm.runInContext('posOrdersByPhone', C)).length === 0 && vm.runInContext('posOrdersMeta.ok', C), '0 don: hop le, map rong');
  console.log(bad ? '\n' + bad + ' FAIL' : '\nALL OK'); process.exit(bad ? 1 : 0);
})();

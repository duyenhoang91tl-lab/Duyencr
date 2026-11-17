#!/usr/bin/env node
// Test js/88-pos-orders.js (DANH SACH KH KHOP DON POS, buoc 2/7): client tai + giu don POS theo tung don (donDaily). Chay: node tools/test-pos-orders.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js/88-pos-orders.js'), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const J = (days, rows, extra) => JSON.stringify(Object.assign({ ok: true, ver: 'donDaily-v1', days, from: '2026-08-20', to: '2026-11-17', n: rows.length, skipped: { noPhone: 1, noPhoneRev: 1000000, noDate: 0, noDateRev: 0 }, rows }, extra || {}));
const ROWS = [
  ['0912345678', '2026-11-16', 'Lê phương thảo', ['biichnguyen1993', 'ninhnga99', 'thuydinh95'], 3000000, [['biichnguyen1993', 1000000], ['ninhnga99', 1000000], ['thuydinh95', 1000000]]],
  ['0912345678', '2026-11-10', 'Phương Thảo', ['ninhnga99'], 500000, [['ninhnga99', 500000]]],
  ['0987654321', '2026-11-16', 'Phương Thùy', ['biichnguyen1993'], 1500000, [['biichnguyen1993', 1500000]]]
];
function boot(responses, opts) {
  const calls = [], order = [];
  const ctx = { console, Promise, Date, JSON, Object, Array, String, Number, Math, setTimeout, gsUrl: 'https://gs.example/exec', order,
    _gsFetchTO_: (url) => { calls.push(url); const r = responses.shift(); if (r instanceof Error) return Promise.reject(r); order.push('fetch'); return Promise.resolve({ text: () => Promise.resolve(r) }); },
    syncFromGS: async function (o) { order.push('sync-start'); await new Promise(r => setTimeout(r, 20)); if (opts && opts.syncThrows) throw new Error('boom'); order.push('sync-end'); return 'synced'; } };
  ctx.calls = calls; vm.createContext(ctx); vm.runInContext(src, ctx);
  return ctx;
}
(async () => {
  // 1) parse thuan
  let c = boot([]);
  const P = vm.runInContext('posOrdersParse_', c)(JSON.parse(J(90, ROWS)));
  ok(P.n === 3 && Object.keys(P.byPhone).length === 2, 'parse: 3 don / 2 SDT');
  ok(P.byPhone['0912345678'][0].ds === '2026-11-16' && P.byPhone['0912345678'][1].ds === '2026-11-10', 'moi SDT sap moi nhat truoc');
  ok(P.byPhone['0912345678'][0].shares.length === 3 && P.byPhone['0912345678'][0].shares[0][1] === 1000000 && P.byPhone['0912345678'][0].rev === 3000000, 'giu sales/shares/rev cua don the chung 3 sale');
  ok(vm.runInContext('posOrdersParse_', c)({ error: 'x' }) === null && vm.runInContext('posOrdersParse_', c)(null) === null, 'JSON loi/khong co rows -> null');
  ok(vm.runInContext('posOrdersParse_', c)({ rows: [[ '', '2026-11-16', 'a', [], 1, [] ], null, ['0911111111', '', 'b', [], 1, []], ['0911111111', '2026-11-16', 'ok', [], 5] ] }).n === 1, 'bo dong thieu SDT/ngay/null');
  // 2) tai + giu, y het lan truoc thi khong doi
  c = boot([J(90, ROWS), J(90, ROWS)]);
  let ch = await vm.runInContext('posOrdersFetch_(90)', c);
  ok(ch === true && c.posOrdersByPhone['0987654321'].length === 1 && c.posOrders.days === 90 && c.posOrders.skipped.noPhone === 1, 'tai lan 1: doi=true, giu byPhone/days/skipped');
  ok(/action=donDaily&days=90$/.test(c.calls[0]), 'URL dung action=donDaily&days=90');
  ch = await vm.runInContext('posOrdersFetch_(90)', c);
  ok(ch === false, 'lan 2 noi dung y het -> khong doi');
  // 3) GAS cu (khong biet action) / loi mang -> giu du lieu cu + bao loi
  c = boot([J(90, ROWS), JSON.stringify({ error: 'Unknown action' }), new Error('mang dut'), '<html>502</html>']);
  await vm.runInContext('posOrdersFetch_(90)', c);
  ch = await vm.runInContext('posOrdersFetch_(90)', c);
  ok(ch === false && c.posOrders.err === 'Unknown action' && c.posOrders.n === 3, '{error} -> giu du lieu cu, ghi err');
  ch = await vm.runInContext('posOrdersFetch_(90)', c); ok(ch === false && /mang dut/.test(c.posOrders.err) && c.posOrders.n === 3, 'loi mang -> giu du lieu cu');
  ch = await vm.runInContext('posOrdersFetch_(90)', c); ok(ch === false && /JSON/.test(c.posOrders.err) && c.posOrders.n === 3, 'HTML 502 -> khong JSON, giu du lieu cu');
  c = boot([JSON.stringify({ ok: false })]); await vm.runInContext('posOrdersFetch_(90)', c);
  ok(/deploy lại/.test(c.posOrders.err), 'GAS chua co action -> nhac deploy lai');
  // 4) EnsureDays: chi tai them khi rong hon; khong thu hep; bao listener
  c = boot([J(90, ROWS), J(180, ROWS.concat([['0933000999', '2026-06-01', 'Khach xa', ['ninhnga99'], 700000, [['ninhnga99', 700000]]]])), J(90, ROWS, { n: 3 })]);
  let notified = 0; vm.runInContext('posOrdersOnChange_', c)(() => notified++);
  await vm.runInContext('posOrdersFetch_(90)', c);
  ch = await vm.runInContext('posOrdersEnsureDays_(60)', c); ok(ch === false && c.calls.length === 1, 'Ensure 60 ngay khi da co 90 -> khong tai');
  ch = await vm.runInContext('posOrdersEnsureDays_(180)', c); ok(ch === true && notified === 1 && c.calls.length === 2 && /days=180$/.test(c.calls[1]) && c.posOrdersByPhone['0933000999'], 'Ensure 180 -> tai them, bao listener, co khach xa');
  await vm.runInContext('posOrdersFetch_(90)', c); ok(c.posOrders.days === 180 && c.posOrdersByPhone['0933000999'], 'tai lai 90 khong thu hep cua so da mo rong 180');
  await vm.runInContext('posOrdersEnsureDays_(99999)', c); ok(/days=400$/.test(c.calls[c.calls.length - 1]), 'days kep toi da 400');
  // 5) boc syncFromGS: nang -> tai SONG SONG (fetch truoc sync-end), listener bao SAU sync-end; nhip nhe khong tai
  c = boot([J(90, ROWS)]); notified = 0; const seen = [];
  vm.runInContext('posOrdersOnChange_', c)(() => { notified++; seen.push(c.order.slice().join(',')); });
  const r = await vm.runInContext('syncFromGS({ pullOrders: true })', c);
  ok(r === 'synced', 'syncFromGS van tra ket qua goc');
  ok(c.order.join(',') === 'sync-start,fetch,sync-end' || c.order.join(',') === 'fetch,sync-start,sync-end', 'tai donDaily chay SONG SONG voi dong bo (' + c.order.join(',') + ')');
  ok(notified === 1 && /sync-end/.test(seen[0]), 'listener bao SAU khi dong bo xong');
  c.calls.length = 0; await vm.runInContext('syncFromGS({ pullOrders: false })', c); ok(c.calls.length === 0, 'nhip nhe 3s khi da co du lieu -> khong tai');
  // nhip nhe nhung chua tai duoc lan nao: thu lai (>=60s)
  c = boot([J(90, ROWS)]); await vm.runInContext('syncFromGS({ pullOrders: false })', c); ok(c.calls.length === 1, 'chua tai lan nao -> nhip nhe tu thu tai (lan dau)');
  await vm.runInContext('(function(){ posOrders.loadedAt = 0; })()', c);
  const n1 = c.calls.length; await vm.runInContext('syncFromGS({ pullOrders: false })', c); ok(c.calls.length === n1, 'thu lai bi gian cach 60s (khong goi lien tiep)');
  // 6) dong bo goc nem loi -> loi truyen len nhu cu, nhung van cho tai donDaily xong + bao listener
  c = boot([J(90, ROWS)], { syncThrows: true }); notified = 0; vm.runInContext('posOrdersOnChange_', c)(() => notified++);
  let thrown = ''; try { await vm.runInContext('syncFromGS({ pullOrders: true })', c); } catch (e) { thrown = e.message; }
  ok(thrown === 'boom' && c.posOrders.n === 3 && notified === 1, 'dong bo goc loi: loi van truyen len, du lieu POS van duoc tai + bao listener');
  console.log(fails ? '\nCO LOI' : '\nTAT CA QUA'); process.exit(fails ? 1 : 0);
})();

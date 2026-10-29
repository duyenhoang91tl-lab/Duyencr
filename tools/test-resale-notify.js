#!/usr/bin/env node
// Test: thong bao "khach mua lai o sale khac" (gas_v13.js _rbFindEvents_/_rbText_/_rbNotify_) — chay HAM THAT, gia lap sheet Notifications.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log: () => {} }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
const TODAY = '2026-10-29';
const row = (date, phone, the, rev, src, extra) => Object.assign({ ngayTaoDon: date, soDienThoai: phone, theSale: the, giaTriSauGiam: rev, nguonDon: src, khachHang: 'Chị Lan', trangThai: '' }, extra || {});
const F = (rows, nd, lb) => ctx._rbFindEvents_(rows, TODAY, nd || 2, lb || 365);

// 1) Ca Duyen mo ta: don cu cua sale A, khach mua lai o sale B -> bao sale A
let ev = F([row('10/10/2026', '0901234567', 'anhNP1999, Đang giao hàng', 2000000, 'Page A'), row('28/10/2026', '0901234567', 'dungnguyen1995', 3500000, 'Page B – Facebook')]);
ok(ev.length === 1 && ev[0].prevSales.join() === 'anhNP1999' && ev[0].curSales.join() === 'dungnguyen1995', 'khach cua A mua lai o B -> 1 su kien, bao A (khong lay "Đang giao hàng" lam sale)');
ok(ev[0].revenue === 3500000 && ev[0].source === 'Page B – Facebook' && ev[0].date === '2026-10-28', 'doanh thu / kenh / ngay dung theo DON MOI');
ok(ctx._rbText_(ev[0]) === 'Khách Chị Lan đang mua lại đơn doanh thu 3.500.000đ tại kênh Page B – Facebook, Sale dungnguyen1995 bán', 'cau thong bao dung mau "khach A dang mua lai don doanh thu B tai kenh C, Sale D ban"');

// 2) Khong bao khi
ok(F([row('10/10/2026', '0901234567', 'anhNP1999', 1, 'x'), row('28/10/2026', '0901234567', 'anhNP1999', 1, 'x')]).length === 0, 'chinh sale A mua lai -> KHONG bao');
ok(F([row('28/10/2026', '0901234567', 'anhNP1999', 1, 'x'), row('28/10/2026', '0901234567', 'dungnguyen1995', 1, 'x')]).length === 0, 'cung ngay (don dau tien cua khach) -> khong phai mua lai');
ok(F([row('10/10/2026', '0901234567', 'anhNP1999', 1, 'x', { trangThai: 'Đã hoàn' }), row('28/10/2026', '0901234567', 'dungnguyen1995', 1, 'x')]).length === 0, 'don cu bi hoan -> khong tinh la sale cu cua khach');
ok(F([row('10/10/2026', '0901234567', 'anhNP1999', 1, 'x'), row('28/10/2026', '0901234567', 'dungnguyen1995', 1, 'x', { trangThai: 'Đã hoàn' })]).length === 0, 'don moi bi hoan -> khong bao');
ok(F([row('10/10/2026', '0901234567', 'anhNP1999', 1, 'x'), row('20/10/2026', '0901234567', 'dungnguyen1995', 1, 'x')]).length === 0, 'don moi qua ngay (ngoai cua so 2 ngay) -> khong bao lai khi quet lai');
ok(F([row('10/10/2026', '0901234567', 'anhNP1999', 1, 'x'), row('20/10/2026', '0901234567', 'dungnguyen1995', 1, 'x')], 14).length === 1, 'cua so 14 ngay thi bao');
ok(F([row('10/10/2024', '0901234567', 'anhNP1999', 1, 'x'), row('28/10/2026', '0901234567', 'dungnguyen1995', 1, 'x')]).length === 0, 'don cu hon 365 ngay -> khong con la khach cua A');
ok(F([row('28/10/2026', '', 'dungnguyen1995', 1, 'x'), row('10/10/2026', '', 'anhNP1999', 1, 'x')]).length === 0, 'khong co SDT -> bo qua');

// 3) Gom don tach / nhieu dong cung ngay; nhieu sale cu; sale chung
ev = F([row('01/10/2026', '0901234567', 'anhNP1999, bichnguyen1993', 1, 'x'), row('28/10/2026', '0901234567', 'dungnguyen1995', 5000000, 'Page B'), row('28/10/2026', '0901234567', 'dungnguyen1995, anhNP1999', 4000000, 'Page C')]);
ok(ev.length === 1 && ev[0].revenue === 9000000 && ev[0].source === 'Page B, Page C', 'don tach/2 dong cung ngay -> gop 1 su kien, cong doanh thu, gop kenh');
ok(ev[0].prevSales.join() === 'bichnguyen1993' && ev[0].curSales.join(', ') === 'dungnguyen1995, anhNP1999', 'sale co trong don moi (anhNP1999) khong bi bao; chi bao bichnguyen1993');

// 4) Ghi thong bao: map sale -> tai khoan CRM, bo admin, khong bao nguoi ban don moi, chong trung
const sheet = []; const fakeSh = { getLastRow: () => sheet.length + 1, getDataRange: () => ({ getValues: () => [['id'].concat(Array(9).fill('')), ...sheet] }),
  getRange: (r, c, n) => ({ setValues: (vals) => { vals.forEach((x) => sheet.push(x)); } }) };
ctx.getSheet_ = () => fakeSh;
const users = [{ username: 'lanA', name: 'Lan', names: ['anhNP1999'], role: 'cs', active: true }, { username: 'adm', name: 'Duyen', names: ['anhNP1999'], role: 'admin', active: true },
  { username: 'huy', name: 'Huy', names: ['dungnguyen1995'], role: 'cs', active: true }, { username: 'oldA', name: 'Cu', names: ['anhNP1999'], role: 'cs', active: false }];
ev = F([row('10/10/2026', '0901234567', 'anhNP1999', 2000000, 'Page A'), row('28/10/2026', '0901234567', 'dungnguyen1995', 3500000, 'Page B')]);
let n = ctx._rbNotify_(ev, users);
ok(n === 1 && sheet.length === 1 && sheet[0][1] === 'lanA', 'chi bao lanA (bo admin, bo tai khoan da khoa, bo sale ban don moi)');
ok(sheet[0][3] === 'resale' && sheet[0][4] === 'resale' && sheet[0][5] === '0901234567' && sheet[0][6] === '2026-10-28' && /Page B/.test(sheet[0][7]), 'dong Notifications: kind/refType=resale, refId=SDT, refId2=ngay, text co kenh');
n = ctx._rbNotify_(ev, users);
ok(n === 0 && sheet.length === 1, 'quet lai KHONG ghi trung (chong bao lai)');
ev = F([row('10/10/2026', '0901234567', 'anhNP1999', 2000000, 'Page A'), row('28/10/2026', '0901234567', 'dungnguyen1995', 3500000, 'Page B'), row('29/10/2026', '0901234567', 'khac99', 1000000, 'Page D')]);
n = ctx._rbNotify_(ev, users);
ok(n >= 1 && sheet.some((r) => r[6] === '2026-10-29' && r[1] === 'lanA'), 'don moi o ngay khac -> thong bao moi (khoa theo ngay)');
console.log(fail ? '\nFAIL: ' + fail : '\nTAT CA DAT'); process.exit(fail ? 1 : 0);

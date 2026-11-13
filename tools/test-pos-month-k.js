#!/usr/bin/env node
// Test Bao cao K — Chot thang (posKReport_). Chay ham GAS THAT. Chay: node tools/test-pos-month-k.js
const fs = require('fs'), vm = require('vm'), path = require('path');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const J = x => JSON.parse(JSON.stringify(x));
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8'), ctx);
vm.runInContext(`
  var __s = {}; getSetting_ = function(k) { return __s[k] == null ? null : __s[k]; };
  var __last = false; _todayYm_ = function() { return '2026-11'; }; _isLastDayOfMonthVn_ = function() { return __last; };
  _salePersonKeyFn_ = function() { return function(n) { return String(n || '').trim().toLowerCase(); }; };
  var __rev = {}; var __unatt = 0; _posRevenueBySaleCached_ = function(ym) { var b = JSON.parse(JSON.stringify(__rev[ym] || {})), t = 0; Object.keys(b).forEach(function(n){ t += b[n]; }); return { total: t + (__unatt || 0), bySale: b }; };
`, ctx);
const set = (k, v) => { ctx.__tmp = JSON.stringify(v); vm.runInContext('__s["' + k + '"] = __tmp', ctx); };
const K = m => J(vm.runInContext('posKReport_("' + m + '")', ctx));
ctx.__revData = null;
const setRev = o => { ctx.__r = o; vm.runInContext('__rev = __r', ctx); };

set('saleChannels', { An: 'online', Binh: 'offline', Chi: 'probation', Dung: 'online', Hoa: 'online' });
set('saleChannelPeriods', { Dung: [{ from: '2026-12-01', channel: 'offline' }], Hoa: [{ from: '', channel: 'probation' }, { from: '2026-11-15', channel: 'online' }], Lan: [{ from: '2026-01-01', channel: 'offline' }] });
set('saleDepts', { Em: 'sale', Gia: 'ketoan', An: 'sale' });
setRev({ '2026-11': { An: 1000, Binh: 500, Chi: 700, Em: 300, Gia: 900, Hoa: 200, Lan: 100, Khac: 50 }, '2026-10': { An: 800, Binh: 400, Em: 250 } });

let r = K('2026-11'), names = r.rows.map(x => x.name).sort().join(',');
ok(names === 'An,Binh,Em,Hoa,Lan', 'chi gom Online + Van phong + phong Sale (loai thu viec Chi, ke toan Gia, nguoi ngoai Khac) -> ' + names);
ok(r.rows.find(x => x.name === 'An').group === 'Online', 'nguoi vua Online vua phong Sale: uu tien nhom Online, chi 1 dong');
ok(r.rows.find(x => x.name === 'Em').group.indexOf('Sale') >= 0, 'nguoi chi o phong ban Sale vao nhom Phong Sale');
ok(r.rows.find(x => x.name === 'Lan').group === 'Văn phòng', 'sale chi co moc ngay (offline tu 2026-01) van thuoc nhom Van phong');
ok(r.rows.some(x => x.name === 'Hoa'), 'Hoa thu viec den 15/11 roi len Online: tinh tai CUOI thang 11 la Online -> co mat');
ok(r.rows.some(x => x.name === 'Dung') === false, 'Dung khong co doanh thu thang 11 -> khong hien dong 0');
ok(r.applied === false && r.total.deduction === 0 && r.total.net === r.total.revenue && /Chưa chốt/.test(r.reason), 'chua chot thang 10: khong tru, applied:false + ly do');
ok(r.total.revenue === 1000 + 500 + 300 + 200 + 100, 'tong doanh thu chi cong thanh vien');

// ===== Duyên 2026-11-11: recon — đối chiếu tổng Báo cáo B với K =====
vm.runInContext('__unatt = 1000', ctx);
r = K('2026-11');
const rc = r.recon;
ok(rc && rc.inScope === r.total.revenue, 'recon.inScope = tong doanh thu trong K');
ok(rc.outsideTotal === 700 + 900 + 50 && rc.outsideCount === 3, 'recon: sale ngoai pham vi = Chi(thu viec 700) + Gia(ke toan 900) + Khac 50 -> ' + rc.outsideTotal);
ok(rc.outside[0].name === 'Gia' && rc.outside[1].name === 'Chi', 'recon: liet ke ngoai pham vi xep doanh thu giam dan');
ok(rc.unattributed === 1000, 'recon: phan khong gan duoc cho sale nao = 1000');
ok(rc.inScope + rc.outsideTotal + rc.unattributed === rc.allTotal, 'recon: Tong B = trong K + ngoai pham vi + khong gan duoc');
vm.runInContext('__unatt = 0', ctx);

set('posMonthSnapshots', { '2026-10': { closedAt: '2026-10-31', total: 1450, bySale: { An: 900, Binh: 400, Em: 250, Chi: 999 } } });
r = K('2026-11');
const an = r.rows.find(x => x.name === 'An'), bi = r.rows.find(x => x.name === 'Binh');
ok(r.applied && an.deduction === 100 && an.net === 900, 'da chot thang 10: An tru 100 (900 chot − 800 hien tai), sau hoan/huy 900');
ok(bi.deduction === 0 && bi.net === 500, 'Binh khong doi -> tru 0');
ok(r.rows.every(x => x.name !== 'Chi'), 'nguoi khong thuoc pham vi khong lot vao du co snapshot');
ok(r.total.deduction === 100 && r.total.net === r.total.revenue - 100, 'tong tru / tong sau hoan huy khop');
ok(r.rows[0].net >= r.rows[r.rows.length - 1].net, 'sap xep giam dan theo doanh thu sau hoan/huy');
ok(r.canClose === false && /Chưa chốt được/.test(r.canCloseReason), 'giua thang chua cho chot');
vm.runInContext('__last = true', ctx); ok(K('2026-11').canClose === true, 'ngay cuoi thang cho chot');
ok(K('bad').month === '2026-11', 'thang sai dinh dang -> mac dinh thang nay');
console.log(fails ? '\n' + fails + ' LOI' : '\nTAT CA QUA'); process.exit(fails ? 1 : 0);

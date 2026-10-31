// Test: _srCloseRateSectionsFromBase_ forceBy — Thuong phat doi Sale ep dem don theo NGUOI TAO, bao cao A/B (khong truyen) van theo Settings closeRateBy. Chay: node tools/test-closerate-forceby.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } }
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
let setting = 'saleban', captured = null;
const rows = [
  { ngayTao: '01/10/2026', nguoiTao: 'Hoa', saleBan: 'Hoa, Mai', kenhBan: 'Fb', trangThai: 'ok', bhZero: false },
  { ngayTao: '01/10/2026', nguoiTao: 'Hoa', saleBan: 'Nam', kenhBan: 'Fb', trangThai: 'ok', bhZero: false },
  { ngayTao: '01/10/2026', nguoiTao: 'Ngoai', saleBan: 'Mai', kenhBan: 'Fb', trangThai: 'ok', bhZero: false }];
const ctx = {
  Logger: { log() {} }, _dateStrToVnYmd_: s => s, _pkTrackedDatesByPageAndSale_: () => ({ datesByPage: { p: 1 } }), _closeRateBy_: () => setting,
  readDTTong_: () => rows, _isExcludedOrderStatus_: () => false, dateInRange_: () => true, parseVNDate_: () => new Date(),
  _salePersonKeyFn_: () => (n => String(n).toLowerCase()), buildPancakeReport_: () => ({ byCS: [{ name: 'Hoa', tongTT: 5 }, { name: 'Mai', tongTT: 5 }] }),
  _salePersonKeyWithOrphanFold_: pk => pk, readSaleDirectory_: () => ({ byName: { nam: 1 } }),
  _srCloseRateSections_: (norm) => { captured = norm; return { saleCloseRate: [] }; },
};
vm.createContext(ctx); vm.runInContext(grab('_srCloseRateSectionsFromBase_'), ctx);
const F = vm.runInContext('_srCloseRateSectionsFromBase_', ctx), f = { dateFrom: '2026-10-01', dateTo: '2026-10-01' };
F(f, undefined, 'nguoitao');
ok(captured.map(x => x.saleBanRaw).join('|') === 'Hoa|Hoa|', 'forceBy=nguoitao (Settings dang saleban): don gan cho NGUOI TAO (Hoa, Hoa); nguoi tao ngoai danh sach -> (chua gan)');
F(f);
ok(captured.map(x => x.saleBanRaw).join('|') === 'Hoa, Mai|Nam|Mai', 'khong truyen forceBy (Bao cao A/B): van theo Settings = saleban, KHONG doi');
setting = 'nguoitao'; F(f);
ok(captured.map(x => x.saleBanRaw).join('|') === 'Hoa|Hoa|', 'khong truyen forceBy, Settings = nguoitao: nhu cu');
setting = 'nguoitao'; F(f, undefined, 'saleban');
ok(captured.map(x => x.saleBanRaw).join('|') === 'Hoa, Mai|Nam|Mai', 'forceBy=saleban ep duoc chieu nguoc lai');
setting = 'saleban'; F(f, undefined, 'bay');
ok(captured.map(x => x.saleBanRaw).join('|') === 'Hoa, Mai|Nam|Mai', 'forceBy la gia tri la -> bo qua, theo Settings');
process.exit(fail ? 1 : 0);

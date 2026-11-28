#!/usr/bin/env node
// Test GAS "Top san pham ban" (_topSpAggregate_ / _topSpKey_). Chay: node tools/test-top-products.js
const fs = require('fs'), vm = require('vm');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
const grab = n => { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('missing ' + n); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } };
// ham phu thuoc thuc te lay tu gas_v13.js
const names = ['_normTxt_', 'splitMulti_', '_isNumericTag_', 'parseVNDate_', 'dateInRange_', '_vnYmd_', '_vnYmdParts_', '_vnMidnight_', '_dateStrToVnYmd_', '_stripVN_', '_donHasExcludedStatus_', '_isExcludedOrderStatus_', '_topSpFold_', '_topSpKey_', '_topSpAggregate_'];
const ctx = vm.createContext({ Utilities: {}, Logger: { log() {} } });
let code = 'var TOPSP_UNASSIGNED_TEAM_ = "(chưa có Team)";\n';
// _bizRules_ doc Settings -> thay bang danh sach mac dinh THAT trong gas_v13.js (POS_EXCLUDED_ORDER_STATUSES_)
code += src.match(/^var POS_EXCLUDED_ORDER_STATUSES_ = .*$/m)[0] + '\nfunction _bizRules_(){ var o={}; POS_EXCLUDED_ORDER_STATUSES_.forEach(function(x){o[x]=1;}); return { posSet: o }; }\n';
const missing = [];
names.forEach(n => { try { code += grab(n) + '\n'; } catch (e) { missing.push(n); } });
if (missing.length) { console.log('thieu ham:', missing.join(',')); process.exit(2); }
// bien toan cuc ma cac ham tren co the dung
const consts = src.match(/^var (VN_OFFSET_MS|EXCLUDED_ORDER_STATUS[A-Z_]*|DON_EXCLUDE[A-Z_]*|_EXCL[A-Z_]*)\s*=.*$/gm) || [];
try { vm.runInContext(consts.join('\n') + '\n' + code, ctx); } catch (e) { console.log('LOI nap:', e.message); process.exit(2); }
const A = vm.runInContext('_topSpAggregate_', ctx), K = vm.runInContext('_topSpKey_', ctx);
const row = (ngay, sale, sp, ma, sl, tt) => ({ ngayTaoDon: ngay, theSale: sale, sanPham: sp, maSanPham: ma, soLuong: sl, trangThai: tt || '' });
const team = { ninh: 'Team A', yen: 'Team A', anh: 'Team B' };
const teamOf = s => team[s] || '(chưa có Team)';
const rows = [
  row('21/11/2026', 'ninh', 'Nhẫn vàng,Dây chuyền', 'NV01;DC02', '2,1'),
  row('21/11/2026', 'anh', 'Nhẫn vàng,Quà tặng', 'NV01;QT99', '1,3'),
  row('21/11/2026', 'ninh,anh', 'Vòng bạc', 'VB03', '4'),
  row('20/11/2026', 'ninh', 'Nhẫn vàng', 'NV01', '10'),
  row('21/11/2026', 'yen', 'Dây chuyền', 'DC02', '5', 'Đã hoàn'),
  row('21/11/2026', 'nguoila', 'Vòng bạc', 'VB03', '1'),
];
let r = A(rows, { dateFrom: '2026-11-21', dateTo: '2026-11-21', teamOf });
ok(r.rows[0].code === 'VB03' && r.rows[0].soLuong === 5, 'top ngay 21: Vong bac 4+1 = 5 (khong lay ngay 20)');
const nv = r.rows.find(x => x.code === 'NV01'); ok(nv && nv.soLuong === 3 && nv.orders === 2, 'Nhan vang 2+1 = 3 SL, 2 don');
ok(!r.rows.some(x => x.code === 'DC02' && x.soLuong === 6), 'don Da hoan bi loai (khong cong 5 day chuyen)');
const dc = r.rows.find(x => x.code === 'DC02'); ok(dc && dc.soLuong === 1, 'Day chuyen chi con 1 (don hoan bi bo)');
r = A(rows, { dateFrom: '2026-11-21', dateTo: '2026-11-21', teams: ['Team B'], teamOf });
ok(r.rows.find(x => x.code === 'VB03').soLuong === 4 && !r.rows.find(x => x.code === 'DC02'), 'loc Team B: gom don anh + don ninh,anh (ban chung)');
r = A(rows, { dateFrom: '2026-11-21', dateTo: '2026-11-21', teams: ['Team A'], teamOf });
ok(r.rows.find(x => x.code === 'VB03').soLuong === 4, 'Team A cung tinh DU don chung 4 (khong chia)');
r = A(rows, { dateFrom: '2026-11-21', dateTo: '2026-11-21', teams: ['(chưa có Team)'], teamOf });
ok(r.rows.length === 1 && r.rows[0].soLuong === 1, 'loc "chua co Team": chi don cua nguoi la');
r = A(rows, { dateFrom: '2026-11-20', dateTo: '2026-11-21', teamOf });
ok(r.rows.find(x => x.code === 'NV01').soLuong === 13, 'khoang 2 ngay: Nhan vang 3 + 10 = 13');
r = A(rows, { dateFrom: '2026-11-21', dateTo: '2026-11-21', teamOf, exclude: [{ key: 'c:QT99', name: 'Quà tặng' }] });
ok(!r.rows.some(x => x.code === 'QT99') && r.excludedQty === 3 && r.excludedHit.length === 1, 'loai tru theo ma: QT99 khong vao thong ke, dem 3 bi loai');
r = A(rows, { dateFrom: '2026-11-21', dateTo: '2026-11-21', teamOf, exclude: [{ key: 'n:khac', name: 'QUA TANG' }] });
ok(!r.rows.some(x => x.code === 'QT99'), 'loai tru theo TEN (khong dau/hoa thuong) cung chan duoc');
r = A(rows, { dateFrom: '2026-11-21', dateTo: '2026-11-21', teamOf, limit: 2 });
ok(r.rows.length === 2 && r.totalProducts >= 3, 'limit 2 nhung totalProducts van day du');
ok(K('nv01', 'x') === 'c:NV01' && K('', 'Nhẫn Vàng') === K('', 'nhan vang') && K('(không rõ mã #1)', 'Abc').indexOf('n:') === 0, 'khoa: uu tien ma, khong ma thi theo ten bo dau');

// --- onlyConfig: tra team + loai tru, KHONG doc don ---
{
  const g = n => grab(n);
  let read = 0;
  const c2 = vm.createContext({ Logger: { log() {} }, SH_TEAM: 'Team', getCrmSS_: () => ({ getSheetByName: () => ({}) }), readTeams_: () => [{ name: 'Team A' }, { name: 'Team B' }],
    _makeTeamResolver_: () => () => 'Team A', getSetting_: () => JSON.stringify([{ key: 'c:QT99', name: 'Quà tặng' }]), readDonChiTiet_: () => { read++; return []; }, _mergeTachDon_: r => r,
    _vnYmd_: () => '2026-11-21', _normTxt_: x => x });
  vm.runInContext('var TOPSP_UNASSIGNED_TEAM_ = "(chưa có Team)";\n' + g('readTopSpExclude_') + '\n' + g('_topSpAggregate_').replace(/^/, '') + '\n' + g('buildTopProducts_'), c2);
  const cfg = vm.runInContext('buildTopProducts_({onlyConfig:"1"})', c2);
  ok(cfg.ok && cfg.onlyConfig && cfg.teams.join() === 'Team A,Team B,(chưa có Team)' && cfg.exclude.length === 1 && cfg.exclude[0].key === 'c:QT99', 'onlyConfig tra teams + exclude');
  ok(read === 0, 'onlyConfig KHONG doc sheet don (nhanh)');
}
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);

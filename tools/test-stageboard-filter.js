#!/usr/bin/env node
// Test GAS: Bang don theo giai doan LOC theo ngay tao / phong ban / team / sale / nguon (Duyen 23/10/2026) + tra SDT khach.
// Chay: node tools/test-stageboard-filter.js (ham that cua gas_v13.js, du lieu gia, khong goi mang).
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const grab = (name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
const grabVar = (name) => { const m = src.match(new RegExp('^var ' + name + '\\s*=[^;]*;', 'm')); if (!m) throw new Error('khong thay bien ' + name); return m[0]; };
// danh tinh gia: thuydinh95 == thuydinh1995 (cung 1 nguoi)
const ID = { thuydinh95: 'thuydinh', thuydinh1995: 'thuydinh' };
const ctx = {
  _salePersonKeyFn_: () => (n) => { const k = String(n).trim().toLowerCase(); return ID[k] || k; },
  readSaleDepts_: () => { const raw = { Hapham1987: 'thanhpham', Hoale1996: 'thanhpham', yenth2003: 'sanxuat', ninhnga99: 'sale', thuydinh1995: 'sale' }, byNorm = {}; Object.keys(raw).forEach(n => { byNorm[n.toLowerCase()] = { name: n, key: raw[n] }; }); return { raw, byNorm }; },
  readDeptList_: () => [{ key: 'sale', label: 'Sale' }, { key: 'sanxuat', label: 'Sản xuất' }, { key: 'thanhpham', label: 'Thành phẩm' }],
  readTeams_: () => [{ name: 'Team Nga', leader: 'ninhnga99', members: ['huyenmai1990'] }, { name: 'Team Thùy', leader: '', members: ['thuydinh1995'] }],
  getCrmSS_: () => ({ getSheetByName: () => null }), SH_TEAM: 'Teams',
  _makeTeamResolver_: () => { const m = { ninhnga99: 'Team Nga', huyenmai1990: 'Team Nga', thuydinh1995: 'Team Thùy', thuydinh95: 'Team Thùy' }; return (n) => m[String(n).trim().toLowerCase()] || ''; },
  _isExcludedOrderStatus_: () => false,
};
vm.createContext(ctx);
['_stripVN_', '_normTxt_', '_ttFold_', '_ttParseVn_', '_ttParseFilterDate_', '_ttSplitList_', '_ttNameTokens_', '_ttBoardFilterCompile_', '_ttBoardBuild_', '_ttBoardOptions_'].forEach(n => vm.runInContext(n === '_isExcludedOrderStatus_' ? '' : grab(n), ctx));
['TT_STAGE_ORDER_', 'TT_LOOKBACK_DAYS_', 'TT_BOARD_DONE_DAYS_', 'TT_BOARD_CAP_'].forEach(n => vm.runInContext(grabVar(n), ctx));
let fails = 0; const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; console.log('FAIL', m, '\n  co :', JSON.stringify(a), '\n  can:', JSON.stringify(b)); } else console.log('ok  ', m); };
const now = Date.UTC(2026, 9, 23, 6, 0);   // 23/10/2026 13:00 gio VN
const vn = (d, m, h) => String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/2026 ' + String(h || 9).padStart(2, '0') + ':00:00';
const O = (id, o) => Object.assign({ id, giaiDoan: 'Phân loại đơn', trangThai: '', ngayTao: vn(21, 10), thoiGianHT: '', saleBan: 'ninhnga99', giaoCho: 'Hapham1987', kenhBan: 'Quầy Hào Nam', sanPham: 'SP ' + id, giaTriDon: 1000, maBoDem: id + 'T10/2026', soDienThoai: '0837923113' }, o || {});
const orders = [
  O('A1'),                                                                                              // Team Nga, thanh pham, Quay Hao Nam, 21/10
  O('A2', { saleBan: 'thuydinh1995', giaoCho: 'yenth2003', kenhBan: 'Fanpage Nhẫn', ngayTao: vn(15, 10) }),   // Team Thuy, san xuat, 15/10
  O('A3', { saleBan: 'huyenmai1990, anhNP1999', giaoCho: '', kenhBan: 'Quầy Hào Nam', ngayTao: vn(22, 10) }), // 2 sale, khong ai co phong
  O('A4', { saleBan: 'thuydinh95', giaoCho: 'Hoale1996', kenhBan: 'Zalo OA', giaiDoan: 'Kho thành phẩm', ngayTao: vn(20, 10) }),  // ten khac cua thuydinh
  O('OLD', { ngayTao: vn(1, 8), saleBan: 'ninhnga99' }),                                              // 83 ngay truoc: ngoai lookback 60
  O('DONEOLD', { giaiDoan: 'Đóng hàng', ngayTao: vn(5, 10), thoiGianHT: vn(8, 10) }),                  // dong hang cach day 15 ngay: ngoai 7 ngay
  O('DONENEW', { giaiDoan: 'Đóng hàng', ngayTao: vn(18, 10), thoiGianHT: vn(21, 10) }),
];
const run = (p, names) => { const opt = { sales: {}, kenh: {} }, flt = ctx._ttBoardFilterCompile_(p); const st = ctx._ttBoardBuild_(orders.map(o => Object.assign({}, o)), [], names || '', now, 24, { 'dong hang': true }, flt, opt); return { st, opt, flt }; };
const ids = (r) => [].concat.apply([], r.st.map(s => s.items.map(i => i.id))).sort();
const cnt = (r) => r.st.reduce((a, s) => a + s.count, 0);

eq(ids(run({})), ['A1', 'A2', 'A3', 'A4', 'DONENEW'], 'khong loc: giu gioi han mac dinh (OLD >60 ngay va DONEOLD >7 ngay bi bo)');
eq(run({}).flt.active, false, 'khong loc -> active=false');

// --- ngay tao ---
eq(ids(run({ dateFrom: '2026-10-20', dateTo: '2026-10-21' })), ['A1', 'A4'], 'loc ngay 20-21/10 (gom ca 2 dau moc, tinh theo gio VN)');
eq(ids(run({ dateFrom: '2026-10-22' })), ['A3'], 'chi co "tu ngay": 22/10 tro di');
eq(ids(run({ dateTo: '2026-10-15' })).sort(), ['A2', 'DONEOLD', 'OLD'].sort(), 'chi co "den ngay" 15/10: don cu OLD (83 ngay) va DONEOLD hien ra vi co loc ngay -> bo gioi han mac dinh');
eq(ids(run({ dateFrom: '2026-10-21', dateTo: '2026-10-15' })), ids(run({ dateFrom: '2026-10-15', dateTo: '2026-10-21' })), 'chon nguoc ngay (tu > den) -> tu dong dao lai');
eq(ids(run({ dateFrom: '21/10/2026', dateTo: '21/10/2026' })), ['A1'], 'chap nhan dd/MM/yyyy; 1 ngay duy nhat');
eq(ids(run({ dateFrom: 'abc' })), ids(run({})), 'ngay sai dinh dang -> bo qua, khong vo');
{ const r = run({ dateFrom: '2026-10-21', dateTo: '2026-10-21' }); eq(r.st.find(s => s.name === 'Đóng hàng').count, 0, 'cot Dong hang cung loc theo ngay tao (DONENEW tao 18/10 khong nam trong 21/10)'); }

// --- phong ban (sale HOAC nguoi dang xu ly) ---
eq(ids(run({ depts: 'sanxuat' })), ['A2'], 'phong San xuat: don A2 (giaoCho yenth2003)');
eq(ids(run({ depts: 'thanhpham' })), ['A1', 'A4', 'DONENEW'], 'phong Thanh pham: theo nguoi dang xu ly (Hapham1987, Hoale1996)');
eq(ids(run({ depts: 'sale' })), ['A1', 'A2', 'A4', 'DONENEW'], 'phong Sale: theo sale ban (ke ca ten khac cua cung nguoi: thuydinh95)');
eq(ids(run({ depts: '__none' })), ['A3'], '(chua phan phong): don khong ai thuoc phong nao');
eq(ids(run({ depts: 'sanxuat|__none' })), ['A2', 'A3'], 'chon nhieu phong (OR)');

// --- team ---
eq(ids(run({ teams: 'Team Nga' })), ['A1', 'A3', 'DONENEW'], 'Team Nga: sale ninhnga99 / huyenmai1990 (don A3 co 2 sale, 1 trong team)');
eq(ids(run({ teams: 'Team Thùy' })), ['A2', 'A4'], 'Team Thuy: ke ca ten phu thuydinh95');
eq(ids(run({ teams: 'team nga' })), ['A1', 'A3', 'DONENEW'], 'ten team khong phan biet hoa/thuong');

// --- sale ---
eq(ids(run({ sales: 'thuydinh1995' })), ['A2', 'A4'], 'loc sale thuydinh1995 -> gom ca don ghi ten thuydinh95 (cung nguoi)');
eq(ids(run({ sales: 'anhNP1999' })), ['A3'], 'loc 1 trong 2 sale cua don nhieu sale');
eq(ids(run({ sales: 'ninhnga99|anhNP1999' })), ['A1', 'A3', 'DONENEW'], 'nhieu sale (OR)');

// --- nguon / kenh ban ---
eq(ids(run({ kenh: 'Fanpage Nhẫn' })), ['A2'], 'loc nguon Fanpage Nhan');
eq(ids(run({ kenh: 'quầy hào nam' })), ['A1', 'A3', 'DONENEW'], 'ten nguon khong phan biet hoa/thuong');
eq(ids(run({ kenh: 'Zalo OA|Fanpage Nhẫn' })), ['A2', 'A4'], 'nhieu nguon (OR)');

// --- ket hop (AND giua cac bo loc) ---
eq(ids(run({ depts: 'thanhpham', kenh: 'Zalo OA' })), ['A4'], 'phong + nguon (AND)');
eq(ids(run({ teams: 'Team Nga', dateFrom: '2026-10-22' })), ['A3'], 'team + ngay (AND)');
eq(ids(run({ sales: 'ninhnga99', depts: 'sanxuat' })), [], 'khong don nao thoa tat ca -> rong, khong loi');
eq(cnt(run({ sales: 'thuydinh1995' })), 2, 'so dem moi cot dung sau khi loc (count theo don da loc)');

// --- pham vi CS (names) van co hieu luc + bo loc chi thu hep them ---
eq(ids(run({}, 'thuydinh1995')), ['A2'], 'CS thuydinh1995 (khong co ten phu thuydinh95 trong names) chi thay don ghi dung ten cua minh');
eq(ids(run({ kenh: 'Quầy Hào Nam' }, 'ninhnga99')), ['A1', 'DONENEW'], 'pham vi sale + bo loc nguon: chi thu hep, khong mo rong ra don cua nguoi khac');

// --- danh sach lua chon cua bo loc: tinh tren pham vi, KHONG bi bo loc cua chinh no thu hep ---
{ const a = run({}), b = run({ kenh: 'Zalo OA', teams: 'Team Thùy' });
  eq(Object.keys(b.opt.sales).sort(), Object.keys(a.opt.sales).sort(), 'danh sach Sale lua chon khong doi khi dang loc');
  eq(Object.keys(b.opt.kenh).sort(), Object.keys(a.opt.kenh).sort(), 'danh sach Nguon lua chon khong doi khi dang loc');
  const o = ctx._ttBoardOptions_(a.opt);
  eq(o.kenh, ['Fanpage Nhẫn', 'Quầy Hào Nam', 'Zalo OA'], 'options.kenh: tu cac don trong pham vi, sap xep');
  eq(o.sales.indexOf('anhNP1999') !== -1 && o.sales.indexOf('huyenmai1990') !== -1, true, 'options.sales tach don nhieu sale thanh tung ten');
  eq(o.teams, ['Team Nga', 'Team Thùy'], 'options.teams: ten team');
  eq(o.depts.map(d => d.key), ['sale', 'sanxuat', 'thanhpham', '__none'], 'options.depts: phong ban + (chua phan phong)');
}

// --- the co SDT khach + nguon ---
{ const r = run({}); const it = r.st.find(s => s.name === 'Phân loại đơn').items.find(i => i.id === 'A1');
  eq([it.phone, it.kenh], ['0837923113', 'Quầy Hào Nam'], 'the mang SDT khach + nguon');
  const r2 = ctx._ttBoardBuild_([Object.assign(O('NOPH'), { soDienThoai: undefined })], [], '', now, 24, {});
  eq(r2.find(s => s.name === 'Phân loại đơn').items[0].phone, '', 'don khong co SDT -> chuoi rong (khong undefined)'); }
console.log(fails ? '\n' + fails + ' CA SAI' : '\nTAT CA PASS'); process.exit(fails ? 1 : 0);

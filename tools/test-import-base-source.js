#!/usr/bin/env node
// Test: CAP NHAT "KENH BAN" (cot M) CUA BASE TU BAO CAO NGUON (action importBaseSource, gas_v13.js doImportBaseSource_) — 2026-11-21.
// Khop theo MA DON (cot T) hoac MA BO DEM (cot U); chi ghi cot M; khong xoa trang; bo qua khop mo ho; xem truoc khong ghi; hoan tac duoc.
// Sheet gia, khong goi mang. Chay: node tools/test-import-base-source.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
function fnSrc(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name);
  let d = 0, k = src.indexOf('{', i); for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); } }
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const consts = 'var DT_TONG_WIDTH=20,DON_CHITIET_WIDTH=17,DT_COL_NGAYTAO=0,DT_COL_PHONE=3,DT_COL_THOIGIANHT=10,DT_COL_KENHBAN=12,DT_COL_SANPHAM=14,DT_COL_GIATRIDON=17,DT_COL_ID=19,DT_COL_BODEM=20,' +
  'SH_IMPORT_UPD_LOG="Nhat ky cap nhat",IMPORT_UPD_LOG_HEADERS=["thoiGian","sheet","dong","khoaDon","cot","giaTriCu","giaTriMoi"],IMPORT_UPD_MAX_ROWS=1500,IMPORT_UPD_RUN_GAP=40,IMPORT_UPD_BUDGET_MS=240000,VN_OFFSET_MS=7*3600*1000,' +
  'DT_TONG_SHEET="DT TONG ",DON_CHITIET_SHEET="du lieu don",SH_IMPORT_BATCH="Nhat ky lan nhap",IMPORT_BATCH_HEADERS=["batchId","thoiGian","nguoi","sheet","dongDau","soDong","dauVan","updLogDau","updLogSo","trangThai","hoanTacLuc","hoanTacBoi"],' +
  'SH_IMPORT_UNDO_BACKUP="Sao luu hoan tac",IMPORT_UNDO_MAX_ROWS=5000,DON_COL_GHICHU=16,BASESRC_MAX_ITEMS=50000;';
const names = ['_bsKey_', 'doImportBaseSource_', 'doImportBaseSourceLocked_', '_impColName_', '_impCellStr_', '_impCellEq_', '_impApplyUpdPlan_', '_impHm_', '_impOrderKeyParts_',
  '_rowKeyExact_', '_rowIsBlank_', 'normPhone_', 'normOrderDate_', 'parseVNDate_', '_vnMidnight_', '_vnYmd_', '_vnYmdParts_', '_normMoney_', '_normTxt_',
  '_impWho_', '_impFp_', '_impKeyDropHm_', '_impColIdx_', '_impCellFromStr_', '_impBatchLog_', '_impReadBatch_', '_impScanSheet_', '_impNearest_', '_impLocateAppended_', '_impPlanRestore_', 'doImportUndo_', '_impUndoLocked_'];
const SHEETS = {}; let dirty = [];
function mkSheet(name, rows) {
  const sh = { name, rows: (rows || []).map(r => r.slice()), formulas: {},
    getName() { return name; }, getLastRow() { return this.rows.length; }, getMaxColumns() { return 40; },
    getRange(r, c, n, w) { const t = this; n = n || 1; w = w || 1; return {
      getValues: () => { const o = []; for (let i = 0; i < n; i++) { const x = t.rows[r - 1 + i] || []; const q = x.slice(c - 1, c - 1 + w); while (q.length < w) q.push(''); o.push(q); } return o; },
      getFormulas: () => { const o = []; for (let i = 0; i < n; i++) { const q = []; for (let j = 0; j < w; j++) q.push(t.formulas[(r + i) + ',' + (c + j)] || ''); o.push(q); } return o; },
      setValues: v => { v.forEach((x, i) => { const cur = t.rows[r - 1 + i] || (t.rows[r - 1 + i] = []); while (cur.length < c - 1 + x.length) cur.push(''); x.forEach((y, q) => { cur[c - 1 + q] = y; }); }); },
      setValue: y => { const cur = t.rows[r - 1] || (t.rows[r - 1] = []); while (cur.length < c) cur.push(''); cur[c - 1] = y; } }; },
    deleteRows(start, n) { this.rows.splice(start - 1, n); } };
  SHEETS[name] = sh; return sh;
}
const ctx = { JSON, Object, Array, String, Number, Date, Math, isNaN, parseInt, parseFloat, console, Logger: { log() {} },
  jsonOut_: o => o, getSheet_: (n, h) => SHEETS[n] || mkSheet(n, [h || []]), getDTSS_: () => ({ getSheetByName: n => SHEETS[n] || null }), getCrmSS_: () => ({ getSheetByName: n => SHEETS[n] || null }),
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) }, SpreadsheetApp: { flush() {} }, CacheService: { getScriptCache: () => ({ removeAll() {} }) },
  Utilities: { formatDate: () => '20261121_090000' }, sbMarkOrdersDirty_(k, why) { dirty.push(k + ':' + why); },
  _sessUser_: t => (t === 'tok' ? { username: 'duyenht' } : null) };
vm.createContext(ctx); vm.runInContext(consts + names.map(fnSrc).join('\n'), ctx);

const BASE = 'DT TONG ';
const HDR = new Array(21).fill('h');
// dong Base: A ngayTao, D SDT, K thoiGianHT, M kenhBan, R giaTriDon, T ID, U ma bo dem
const base = (id, bodem, phone, kenh, gia) => { const r = new Array(21).fill(''); r[0] = '05/11/2026'; r[3] = phone; r[10] = '06/11/2026'; r[12] = kenh; r[17] = gia; r[19] = id; r[20] = bodem; return r; };
const setup = rows => { Object.keys(SHEETS).forEach(k => delete SHEETS[k]); dirty = []; mkSheet(BASE, [HDR].concat(rows.map(r => r.slice()))); };
const kenh = () => SHEETS[BASE].rows.slice(1).map(r => r[12]);
const snapExceptM = () => JSON.stringify(SHEETS[BASE].rows.map(r => r.filter((_, j) => j !== 12)));

// ---------- 1) khop theo MA DON (cot T) + MA BO DEM (cot U); xem truoc KHONG ghi ----------
setup([
  base('3456789001', 'DH101T11/2026', '0901111111', '', 5000000),        // trong -> dien theo ma don
  base('3456789002', 'DH102T11/2026', '0902222222', '', 3000000),        // trong -> dien theo ma bo dem
  base('3456789003', 'DH103T11/2026', '0903333333', 'Zalo', 1000000),    // da co, file doi -> cap nhat
  base('3456789004', 'DH104T11/2026', '0904444444', 'Facebook', 2000000) // da co, file giong -> khong doi
]);
const before = JSON.stringify(SHEETS[BASE].rows), beforeNoM = snapExceptM();
const FILE = [{ ma: '3456789001', kenh: 'Fanpage A' }, { ma: 'DH102T11/2026', kenh: 'Landipage' }, { ma: '3456789003', kenh: 'Messenger' }, { ma: '3456789004', kenh: 'facebook' }];
let r = ctx.doImportBaseSource_(FILE, true, 'duyenht');
ok(r.ok && r.dryRun && r.wouldUpdateRows === 3 && r.matchedSame === 1 && r.unmatched === 0, 'xem truoc: se cap nhat 3 don (T, U, doi), 1 don giong (khong phan biet hoa/thuong) -> bo qua');
ok(JSON.stringify(SHEETS[BASE].rows) === before && !SHEETS['Nhat ky lan nhap'], 'xem truoc KHONG ghi gi, khong tao nhat ky');
ok(r.preview.length === 3 && r.preview[0].ma === '3456789001' && r.preview[0].dong === 2 && r.preview[2].cu === 'Zalo' && r.preview[2].moi === 'Messenger', 'xem truoc liet ke ma/dong/gia tri cu/moi');
r = ctx.doImportBaseSource_(FILE, false, 'duyenht');
ok(r.ok && r.updatedRows === 3 && r.updatedCells === 3 && /^imp_/.test(r.batchId), 'nhap that: cap nhat 3 o, co batchId ' + r.batchId);
ok(kenh().join('|') === 'Fanpage A|Landipage|Messenger|Facebook', 'cot M: 3 o moi dung, o giong giu nguyen "Facebook" (khong bi doi hoa/thuong)');
ok(snapExceptM() === beforeNoM, 'KHONG cot nao khac cot M bi dong vao');
ok(SHEETS['Nhat ky cap nhat nhap'] === undefined && SHEETS['Nhat ky cap nhat'].rows.length === 4 && SHEETS['Nhat ky cap nhat'].rows[3][4] === 'M' && SHEETS['Nhat ky cap nhat'].rows[3][5] === 'Zalo' && SHEETS['Nhat ky cap nhat'].rows[3][6] === 'Messenger', 'nhat ky cap nhat: cot M, gia tri cu "Zalo" -> moi "Messenger"');
ok(dirty.join() === 'dt:importBaseSource', 'danh dau Supabase can dong bo lai (dt)');
const bl = SHEETS['Nhat ky lan nhap'].rows;
ok(bl.length === 2 && bl[1][3] === BASE && bl[1][5] === 0 && bl[1][8] === 3 && bl[1][9] === 'ok' && bl[1][2] === 'duyenht', 'nhat ky lan nhap: sheet Base, 0 dong them, 3 o cap nhat, nguoi nhap duyenht');
const afterOnce = JSON.stringify(SHEETS[BASE].rows);
r = ctx.doImportBaseSource_(FILE, false, 'duyenht');
ok(r.ok && r.updatedCells === 0 && !r.batchId && r.matchedSame === 4 && JSON.stringify(SHEETS[BASE].rows) === afterOnce, 'nhap lai cung file: khong doi gi, khong tao nhat ky moi');

// ---------- 2) hoan tac lan nhap nguon ----------
let u = ctx.doImportUndo_(bl[1][0], true, 'duyenht');
ok(u.ok && u.dryRun && u.wouldDelete === 0 && u.wouldRestoreCells === 3, 'xem truoc hoan tac: khoi phuc 3 o, KHONG xoa dong nao');
u = ctx.doImportUndo_(bl[1][0], false, 'duyenht');
ok(u.ok && u.deleted === 0 && u.restoredCells === 3 && JSON.stringify(SHEETS[BASE].rows) === before, 'hoan tac that: sheet tro lai Y NHU truoc khi nhap (ke ca o trong)');

// ---------- 3) khong bao gio xoa trang / khong doan khi mo ho ----------
setup([
  base('11', 'BH5T11/2026', '0905555555', 'Zalo', 100),
  base('12', 'TRUNG1', '0906666666', '', 100), base('13', 'TRUNG1', '0907777777', '', 100),   // cung ma bo dem tren 2 dong -> mo ho
  base('14', 'DH14', '0908888888', '', 100),
  base('15', 'DH15', '0909999999', 'Zalo', 100)
]);
r = ctx.doImportBaseSource_([
  { ma: '11', kenh: '' },                                      // nguon rong -> bo qua, KHONG xoa "Zalo"
  { ma: 'TRUNG1', kenh: 'Facebook' },                          // khop 2 dong -> bo qua
  { ma: 'KHONGCO', kenh: 'Facebook' },                         // khong khop dong nao
  { ma: 'DH14', kenh: 'Tiktok' }, { ma: 'dh14', kenh: 'Shopee' },   // cung ma 2 nguon khac nhau -> bo qua
  { ma: '', kenh: 'Facebook' },                                // khong co ma
  { ma: 'DH15', kenh: 'Landipage' }
], false, 'duyenht');
ok(r.ok && r.emptyKenh === 1 && r.ambiguous === 1 && r.ambiguousSample[0] === 'TRUNG1' && r.unmatched === 1 && r.unmatchedSample[0] === 'KHONGCO' && r.conflictInFile === 1 && r.noKey === 1, 'dem dung: rong 1, mo ho 1, khong khop 1, xung dot trong file 1, thieu ma 1');
ok(r.updatedCells === 1 && r.updatedRows === 1, 'chi 1 o duoc cap nhat');
ok(kenh()[0] === 'Zalo' && kenh()[1] === '' && kenh()[2] === '' && kenh()[3] === '' && kenh()[4] === 'Landipage', 'o "Zalo" khong bi xoa; 2 dong mo ho + dong xung dot van trong; chi DH15 doi thanh Landipage');

// ---------- 4) chuan hoa khoa: so 0 dau, khoang trang, hoa/thuong; 1 don bi nhac 2 lan (ma don + ma bo dem) ----------
setup([base('0123456', 'bh7t11/2026', '0901234567', '', 100), base('987654', 'X', '0907654321', '', 100)]);
r = ctx.doImportBaseSource_([{ ma: ' 123456 ', kenh: 'Zalo' }, { ma: 'BH7T11/2026 ', kenh: 'zalo' }, { ma: '00987654', kenh: 'Web' }], false, 'duyenht');
ok(r.updatedCells === 2 && r.updatedRows === 2 && r.conflictInFile === 0 && kenh().join('|') === 'Zalo|Web', 'ma co so 0 dau / khoang trang / khac hoa-thuong van khop; 1 don bi nhac 2 lan CUNG nguon -> chi ghi 1 lan');
setup([base('0123456', 'bh7t11/2026', '0901234567', '', 100), base('987654', 'X', '0907654321', '', 100)]);
r = ctx.doImportBaseSource_([{ ma: '123456', kenh: 'Zalo' }, { ma: 'BH7T11/2026', kenh: 'Facebook' }, { ma: '987654', kenh: 'Web' }], false, 'duyenht');
ok(r.updatedCells === 1 && r.conflictInFile === 1 && kenh().join('|') === '|Web', '1 don bi nhac 2 lan voi 2 nguon KHAC nhau -> BO QUA don do (khong ghi de lan luot), don kia van cap nhat');
ok(SHEETS['Nhat ky cap nhat'].rows.length === 2, 'nhat ky chi co 1 dong (don hop le), khong co dong cho don xung dot');

// ---------- 5) khong ghi de o la CONG THUC ----------
setup([base('21', 'A21', '0901', '', 100), base('22', 'A22', '0902', '', 100)]);
SHEETS[BASE].formulas['2,13'] = '=VLOOKUP(1,X:Y,2,0)';   // o M dong 2 la cong thuc
r = ctx.doImportBaseSource_([{ ma: '21', kenh: 'Zalo' }, { ma: '22', kenh: 'Web' }], false, 'duyenht');
// Luu y mock: _impApplyUpdPlan_ ghi lai cum dong voi (cong thuc || gia tri) nen o cong thuc duoc ghi lai Y NGUYEN chuoi cong thuc (Google Sheets thuc se giu la cong thuc).
ok(SHEETS[BASE].rows[1][12] === '=VLOOKUP(1,X:Y,2,0)' && SHEETS[BASE].rows[2][12] === 'Web', 'o cong thuc giu nguyen (khong bi thay bang "Zalo"), o thuong cap nhat');
ok(r.updatedCells === 1, 'chi dem 1 o da ghi (o cong thuc khong tinh)');

// ---------- 6) kiem tra dau vao / quyen ----------
ok(ctx.doImportBaseSource_([], false, 'x').error && ctx.doImportBaseSource_(null, false, 'x').error, 'khong co dong nao -> bao loi');
Object.keys(SHEETS).forEach(k => delete SHEETS[k]);
ok(ctx.doImportBaseSource_([{ ma: '1', kenh: 'a' }], false, 'x').error.indexOf('Không tìm thấy sheet') >= 0, 'thieu sheet DT TONG -> bao loi ro, khong ghi');
ok(/importBaseSource: 1/.test(src.match(/var OWNER_ONLY_ACTIONS_ = \{[^}]*\}/)[0]), 'action nam trong OWNER_ONLY_ACTIONS_ (chi chu so huu)');
ok(/action === 'importBaseSource'\)\s+return doImportBaseSource_\(data\.items, data\.dryRun, _impWho_\(data\.token\)\)/.test(src), 'doPost goi doImportBaseSource_ voi items/dryRun/token');

// ---------- 7) file lon: 1.200 don, chay nhanh va dung ----------
const big = []; for (let i = 0; i < 1200; i++) big.push(base(String(5000 + i), 'B' + i, '09' + (10000000 + i), i % 3 === 0 ? 'Zalo' : '', 100));
setup(big);
const t0 = Date.now();
r = ctx.doImportBaseSource_(big.map((_, i) => ({ ma: String(5000 + i), kenh: 'Facebook' })), false, 'duyenht');
ok(r.updatedCells === 1200 && SHEETS[BASE].rows.slice(1).every(x => x[12] === 'Facebook') && Date.now() - t0 < 5000, '1.200 don: cap nhat het, dung, nhanh (' + (Date.now() - t0) + 'ms)');

console.log(fail ? '\n' + fail + ' LOI' : '\nTAT CA XANH');
process.exit(fail ? 1 : 0);

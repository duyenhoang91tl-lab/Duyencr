#!/usr/bin/env node
// Test: nhap file Base/Pos KHONG BAO GIO xoa/ghi de dong cu; bo qua don da co; them dong moi; dryRun khong ghi gi.
// Chay: node tools/test-import-safe.js -> "ALL IMPORT-SAFE TESTS PASSED". Sheet gia, khong goi mang.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
function fnSrc(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name);
  let d = 0, k = src.indexOf('{', i); for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); } }
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok   ' + m); };
const consts = 'var DT_TONG_WIDTH=20,DON_CHITIET_WIDTH=17,DT_COL_NGAYTAO=0,DT_COL_PHONE=3,DT_COL_THOIGIANHT=10,DT_COL_SANPHAM=14,DT_COL_GIATRIDON=17,DT_COL_ID=19,DT_COL_BODEM=20,SH_IMPORT_UPD_LOG="log",IMPORT_UPD_LOG_HEADERS=[1,2,3,4,5,6,7],IMPORT_UPD_MAX_ROWS=1500,VN_OFFSET_MS=7*3600*1000;';
const fns = ['_impColName_','_impCellStr_','_impCellEq_','_impDiffRow_','_impHm_','_impHmUnknown_','_impHmCompat_','_impOrderKeyParts_','_impOrderKey_','_impFindExist_','doImportSheetRows_','doImportSheetRowsLocked_','_rowKeyExact_','_rowIsBlank_','_autoDedupExactRowsInSheet_','normPhone_','normOrderDate_','parseVNDate_','_vnMidnight_','_vnYmd_','_vnYmdParts_','_normMoney_','_normTxt_'].map(fnSrc).join('\n');
function mkSheet(rows, formulas) {
  const sh = { rows: rows.map(r => r.slice()), deleted: 0, formulas: formulas || {},
    getLastRow() { return this.rows.length + 1; }, getMaxColumns() { return 40; }, getName() { return 'DT TỔNG '; },
    getRange(r, c, n, w) { const t = this; return {
      getValues: () => t.rows.slice(r - 2, r - 2 + n).map(x => { const o = x.slice(c - 1, c - 1 + w); while (o.length < w) o.push(''); return o; }),
      getFormulas: () => t.rows.slice(r - 2, r - 2 + n).map((x, i) => { const o = []; for (let q = 0; q < w; q++) o.push(t.formulas[(r + i) + ':' + (c - 1 + q)] || ''); return o; }),
      setValues: v => { v.forEach((x, i) => { const cur = t.rows[r - 2 + i] || []; while (cur.length < c - 1 + x.length) cur.push(''); x.forEach((y, q) => { cur[c - 1 + q] = y; }); t.rows[r - 2 + i] = cur; }); } }; },
    deleteRow() { this.deleted++; } };
  return sh;
}
let sheet, logSheet = mkSheet([]);
const ctx = { JSON, Object, Array, String, Number, Date, Math, isNaN, parseInt, parseFloat, console,
  jsonOut_: o => o, getSheet_: () => logSheet, getDTSS_: () => ({ getSheetByName: () => sheet }), DT_TONG_SHEET: 'DT TỔNG ', DON_CHITIET_SHEET: 'dữ liệu đơn',
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) }, SpreadsheetApp: { flush() {} },
  CacheService: { getScriptCache: () => ({ removeAll() {} }) }, sbMarkOrdersDirty_() {}, _autoDedupLog_() {} };
vm.createContext(ctx); vm.runInContext(consts + fns, ctx);
const row = (id, ph, rev, extra) => { const r = new Array(20).fill(''); r[0] = '01/10/2026 09:00'; r[3] = ph; r[10] = '02/10/2026 10:00'; r[14] = 'SP'; r[17] = rev; r[19] = id; if (extra) r[18] = extra; return r; };
// Sheet cu: 2 dong GIONG HET trong 20 cot dau nhung dong cu thu 2 co ghi chu o cot U (ngoai vung) -> dedup cu se XOA nham
const old1 = row('A1', '0911111111', 1000000), old2 = row('A1', '0911111111', 1000000);
old2[20] = 'ghi chu NV';
sheet = mkSheet([old1, old2, row('A2', '0922222222', 2000000)]);
const file = [row('A1', '0911111111', 1000000), row('A2', '0922222222', '2.000.000'), row('B3', '0933333333', 3000000), row('B3', '0933333333', 3000000)];
const before = JSON.stringify(sheet.rows);
let r = ctx.doImportSheetRows_('base', file, true);
ok(r.dryRun && r.wouldWrite === 1 && r.skippedExisting === 2 && JSON.stringify(sheet.rows) === before, 'xem truoc: 1 moi, 2 da co, KHONG ghi gi');
r = ctx.doImportSheetRows_('base', file);
ok(r.ok && r.written === 1 && r.skippedExisting === 2, 'nhap that: them 1 dong moi, bo qua 2 don da co (+ dong trung trong file)');
ok(sheet.rows.length === 4 && JSON.stringify(sheet.rows.slice(0, 3)) === before, 'dong cu giu nguyen 100% (ca dong co ghi chu o cot U), dong moi nam cuoi');
ok(sheet.deleted === 0, 'khong xoa dong nao');
r = ctx.doImportSheetRows_('base', file);
ok(r.written === 0 && sheet.rows.length === 4, 'nhap lai cung file: khong them gi, khong doi');
// ===== CAP NHAT don cu khi file moi doi =====
const r0 = (id, ph, rev, st, note) => { const r = row(id, ph, rev); r[7] = st || ''; r[18] = note || ''; return r; };
const o1 = r0('U1', '0944444444', 1000000, 'Dang giao', 'ghi chu NV cu'), o2 = r0('U2', '0955555555', 2000000, 'Moi');
o2[2] = 'Sale X';
sheet = mkSheet([o1, o2, row('U3', '0966666666', 3000000)], { '3:2': '=A3&"x"' });    // o2.Giao cho (cot C, dong 3) la CONG THUC
logSheet = mkSheet([]);
const f1 = r0('U1', '0944444444', '1.000.000', 'Hoan thanh', '');        // trang thai doi, ghi chu RONG trong file (khong duoc xoa ghi chu cu), tien chi khac dinh dang
const f2 = r0('U2', '0955555555', 2000000, 'Hoan thanh'); f2[2] = 'Sale Y';  // trang thai doi + Giao cho doi nhung o do la cong thuc
f2[0] = new Date(Date.UTC(2026, 9, 1, 2, 0));                              // cung ngay gio duoi dang Date -> khong coi la doi
const f3 = row('U3', '0966666666', 3000000);                                 // y het -> bo qua
let pv = ctx.doImportSheetRows_('base', [f1, f2, f3], true, true);
ok(pv.dryRun && pv.wouldUpdateRows === 2 && pv.wouldUpdateCells === 3 && pv.skippedExisting === 3, 'xem truoc cap nhat: 2 don (3 o dem ca o cong thuc; ghi that se bo o cong thuc); don y het khong tinh');
const snap = JSON.stringify(sheet.rows);
ok(JSON.stringify(sheet.rows) === snap && logSheet.rows.length === 0, 'xem truoc khong ghi gi');
let rs = ctx.doImportSheetRows_('base', [f1, f2, f3], false, true);
ok(rs.updatedRows === 2 && rs.updatedCells === 2 && rs.written === 0, 'cap nhat that: 2 don, 2 o');
ok(sheet.rows[0][7] === 'Hoan thanh' && sheet.rows[0][18] === 'ghi chu NV cu', 'U1: trang thai doi, GHI CHU CU GIU (file de trong khong xoa)');
ok(sheet.rows[1][7] === 'Hoan thanh' && (sheet.rows[1][2] === '=A3&"x"') && sheet.rows[1][2] !== 'Sale Y', 'U2: trang thai doi; o CONG THUC duoc giu nguyen cong thuc, khong bi ghi de bang Sale Y');
ok(JSON.stringify(sheet.rows[2]) === JSON.stringify(row('U3', '0966666666', 3000000)), 'U3 y het: khong doi');
ok(logSheet.rows.length === 2 && logSheet.rows.some(l => l[4] === 'H' && l[5] === 'Dang giao' && l[6] === 'Hoan thanh'), 'nhat ky luu gia tri cu -> moi');
rs = ctx.doImportSheetRows_('base', [f1, f2, f3], false, true);
ok(rs.updatedRows === 0 && rs.written === 0 && logSheet.rows.length === 2, 'nhap lai file: khong cap nhat them');
rs = ctx.doImportSheetRows_('base', [r0('U1', '0944444444', 1000000, 'Huy')], false);
ok(!rs.updatedRows && sheet.rows[0][7] === 'Hoan thanh', 'khong bat updateExisting (client cu): chi bo qua, khong sua');
// ===== POS: khoa don CHIU DUOC lech GIO (HANDOFF 2026-10-20: xem truoc bao "0 da co / 1.436 moi") =====
// Cot Pos: [1]=ngay(+gio) [3]=ten khach [4]=SDT [8]=san pham [9]=ma SP [10]=so luong [11]=gia sau giam [12]=COD
const pos = (ngay, ph, ten, sp, ma, sl, gia, cod, extra) => { const r = new Array(17).fill(''); r[0] = 1; r[1] = ngay; r[3] = ten; r[4] = ph; r[8] = sp; r[9] = ma; r[10] = sl; r[11] = gia; r[12] = cod; if (extra !== undefined) r[16] = extra; return r; };
const dt = (d, h, m) => new Date(Date.UTC(2026, 9, d, h - 7, m));                // Date theo gio VN (UTC+7)
const keyP = (r) => ctx._impOrderKey_('pos', r), partsP = (r) => ctx._impOrderKeyParts_('pos', r);
ok(partsP(pos('05/10/2026 14:32', '0901', 'A', 'Nhan', 'N1', 1, 1000000, 500000)).k === partsP(pos('05/10/2026', '0901', 'A', 'Nhan', 'N1', 1, 1000000, 500000)).k, 'Pos: khoa KHONG gio giong nhau du 1 ben co gio, 1 ben chi co ngay');
ok(ctx._impHmUnknown_('') && ctx._impHmUnknown_('00:00') && !ctx._impHmUnknown_('09:15'), "'' va '00:00' = chua biet gio; 09:15 la gio that");
ok(ctx._impHmCompat_('', '14:32') && ctx._impHmCompat_('00:00', '14:32') && ctx._impHmCompat_('14:32', '14:32') && !ctx._impHmCompat_('09:15', '14:40'), 'gio tuong thich: 1 ben chua biet gio, hoac cung gio; 2 gio that khac nhau thi KHONG');
ok(keyP(pos('05/10/2026 14:32', '0901', 'A', 'Nhan', 'N1', 1, 1000000, 0)) === 'p|05/10/2026|14:32|0901|a|nhan|n1|1|1000000|0'.replace('05/10/2026', ctx.normOrderDate_('05/10/2026')).replace('|a|', '|' + ctx._normTxt_('A') + '|').replace('|nhan|', '|' + ctx._normTxt_('Nhan') + '|').replace('|n1|', '|' + ctx._normTxt_('N1') + '|'), '_impOrderKey_ van ra khoa day du dang cu (co gio)');
// Sheet co gio that / 00:00 / Date, file chi co NGAY (dung tinh huong bao 0 da co)
const sP = [pos('05/10/2026 14:32', '0901111111', 'Hoa', 'Nhan vang', 'NV1', 1, 5000000, 2500000), pos(dt(6, 0, 0), '0902222222', 'Lan', 'Vong bac', 'VB1', 2, 3000000, 0),
            pos('07/10/2026 00:00', '0903333333', 'Mai', 'Day chuyen', 'DC1', 1, 4000000, 4000000), pos(dt(8, 10, 5), '0904444444', 'Nga', 'Charm', 'CH1', 3, 900000, 0)];
sheet = mkSheet(sP.map(x => x.slice())); logSheet = mkSheet([]);
const fileP = [pos('05/10/2026', '0901111111', 'Hoa', 'Nhan vang', 'NV1', 1, 5000000, 2500000), pos('06/10/2026', '0902222222', 'Lan', 'Vong bac', 'VB1', 2, '3.000.000', 0),
               pos('07/10/2026', '0903333333', 'Mai', 'Day chuyen', 'DC1', 1, 4000000, 4000000), pos('08/10/2026', '0904444444', 'Nga', 'Charm', 'CH1', 3, 900000, 0),
               pos('09/10/2026', '0905555555', 'Van', 'Khuyen tai', 'KT1', 1, 2000000, 0)];
let pv2 = ctx.doImportSheetRows_('pos', fileP, true);
ok(pv2.dryRun && pv2.skippedExisting === 4 && pv2.wouldWrite === 1, 'Pos xem truoc: file chi co NGAY vs Sheet co gio/00:00/Date -> 4 da co, 1 moi (truoc day bao 0 da co / 5 moi)');
const snapP = JSON.stringify(sheet.rows);
let wp = ctx.doImportSheetRows_('pos', fileP);
ok(wp.written === 1 && sheet.rows.length === 5 && JSON.stringify(sheet.rows.slice(0, 4)) === JSON.stringify(JSON.parse(snapP).slice(0, 4)) && sheet.rows[4][4] === '0905555555', 'Pos nhap that: chi them 1 don moi, 4 don cu khong bi them trung');
wp = ctx.doImportSheetRows_('pos', fileP); ok(wp.written === 0 && sheet.rows.length === 5, 'Pos nhap lai: khong them gi');
// Nguoc lai: file CO gio, Sheet chi co ngay
sheet = mkSheet([pos('10/10/2026', '0906666666', 'Tu', 'Nhan', 'N2', 1, 1000000, 0)]);
pv2 = ctx.doImportSheetRows_('pos', [pos('10/10/2026 16:20', '0906666666', 'Tu', 'Nhan', 'N2', 1, 1000000, 0)], true);
ok(pv2.skippedExisting === 1 && pv2.wouldWrite === 0, 'Pos: file co gio, Sheet chi co ngay -> van la don da co');
// 2 don THAT khac gio (cung khach/san pham/gia) van la 2 don rieng
sheet = mkSheet([pos('11/10/2026 09:15', '0907777777', 'Dao', 'Nhan', 'N3', 1, 1000000, 0)]);
pv2 = ctx.doImportSheetRows_('pos', [pos('11/10/2026 14:40', '0907777777', 'Dao', 'Nhan', 'N3', 1, 1000000, 0)], true);
ok(pv2.skippedExisting === 0 && pv2.wouldWrite === 1, 'Pos: 2 gio THAT khac nhau (09:15 vs 14:40) cung khach+san pham+gia -> la 2 don, KHONG bi nuot');
// Trung trong file: cung don khi 1 dong co gio, 1 dong chi ngay -> chi 1 dong moi
sheet = mkSheet([]);
pv2 = ctx.doImportSheetRows_('pos', [pos('12/10/2026 11:00', '0908888888', 'Ba', 'Nhan', 'N4', 1, 1000000, 0), pos('12/10/2026', '0908888888', 'Ba', 'Nhan', 'N4', 1, 1000000, 0)], true);
ok(pv2.wouldWrite === 1 && pv2.skippedDupInFile === 1, 'Pos: cung don 1 dong co gio + 1 dong chi ngay trong file -> chi 1 dong moi');
// Cap nhat don cu: khop duoc dong cu du lech gio; cot ngay KHONG bi coi la "doi" chi vi file thieu gio
sheet = mkSheet([pos('13/10/2026 15:45', '0909999999', 'Cu', 'Nhan', 'N5', 1, 1000000, 0, 'ghi chu cu')]); logSheet = mkSheet([]);
const upd = pos('13/10/2026', '0909999999', 'Cu', 'Nhan', 'N5', 1, 1000000, 0, 'ghi chu moi');
let up = ctx.doImportSheetRows_('pos', [upd], true, true);
ok(up.skippedExisting === 1 && up.wouldWrite === 0 && up.wouldUpdateRows === 1 && up.wouldUpdateCells === 1, 'Pos cap nhat: khop don cu du lech gio, chi 1 o doi (cot ghi chu), cot ngay khong bi coi la doi');
up = ctx.doImportSheetRows_('pos', [upd], false, true);
ok(up.updatedRows === 1 && sheet.rows[0][16] === 'ghi chu moi' && String(sheet.rows[0][1]).indexOf('15:45') >= 0, 'Pos cap nhat that: ghi o ghi chu, GIU nguyen ngay-gio cu 15:45');
console.log('ALL IMPORT-SAFE TESTS PASSED');

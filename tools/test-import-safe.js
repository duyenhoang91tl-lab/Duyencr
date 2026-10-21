#!/usr/bin/env node
// Test: nhap file Base/Pos KHONG BAO GIO xoa/ghi de dong cu; bo qua don da co; them dong moi; dryRun khong ghi gi.
// Chay: node tools/test-import-safe.js -> "ALL IMPORT-SAFE TESTS PASSED". Sheet gia, khong goi mang.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
function fnSrc(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name);
  let d = 0, k = src.indexOf('{', i); for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); } }
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok   ' + m); };
const consts = 'var DT_TONG_WIDTH=20,DON_CHITIET_WIDTH=17,DT_COL_NGAYTAO=0,DT_COL_PHONE=3,DT_COL_THOIGIANHT=10,DT_COL_SANPHAM=14,DT_COL_GIATRIDON=17,DT_COL_ID=19,DT_COL_BODEM=20,SH_IMPORT_UPD_LOG="log",IMPORT_UPD_LOG_HEADERS=[1,2,3,4,5,6,7],IMPORT_UPD_MAX_ROWS=1500,VN_OFFSET_MS=7*3600*1000;';
const fns = ['_impColName_','_impCellStr_','_impCellEq_','_impDiffRow_','_impHm_','_impOrderKey_','doImportSheetRows_','doImportSheetRowsLocked_','_rowKeyExact_','_rowIsBlank_','_autoDedupExactRowsInSheet_','normPhone_','normOrderDate_','parseVNDate_','_vnMidnight_','_vnYmd_','_vnYmdParts_','_normMoney_','_normTxt_'].map(fnSrc).join('\n');
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
// ===== POS: file chi co NGAY (khong gio) phai khop dong da co (Date nua dem '00:00' hoac co gio) — loi 20/10/2026 bao '0 da co / 1.436 moi' =====
const prow = (d, ph, name, sp, v, extra) => { const r = new Array(17).fill(''); r[0] = 1; r[1] = d; r[3] = name; r[4] = ph; r[8] = sp; r[9] = 'MA'; r[10] = 1; r[11] = v; r[12] = 0; if (extra) r[16] = extra; return r; };
sheet = mkSheet([
  prow(new Date(Date.UTC(2026, 9, 18, 17, 0)), '0977359792', 'C Hanh', 'NHAN', 5850000),          // Date = 19/10/2026 00:00 gio VN (Sheets tu doi chuoi thanh Date)
  prow('19/10/2026 14:22', '0965023033', 'C Nhung', 'VONG', 17730000),                              // dong cu co GIO
  prow('18/10/2026', '0989030761', 'C Thu', 'CHARM', 550000)]);                                      // dong cu chuoi chi co ngay
const pf = [prow('19/10/2026', '0977359792', 'C Hanh', 'NHAN', 5850000), prow('19/10/2026', '0965023033', 'C Nhung', 'VONG', 17730000),
            prow('18/10/2026', '0989030761', 'C Thu', 'CHARM', 550000), prow('19/10/2026', '0911000111', 'C Moi', 'NHAN', 1000000)];
const pb = JSON.stringify(sheet.rows);
let pr = ctx.doImportSheetRows_('pos', pf, true);
ok(pr.wouldWrite === 1 && pr.skippedExisting === 3, 'Pos chi co ngay: khop dong da co (Date nua dem / co gio / chuoi ngay) -> chi 1 dong moi that su');
pr = ctx.doImportSheetRows_('pos', pf);
ok(pr.written === 1 && sheet.rows.length === 4 && JSON.stringify(sheet.rows.slice(0, 3)) === pb.slice(0, 0) + JSON.stringify(JSON.parse(pb)), 'Pos: chi them dong moi, 3 dong cu nguyen ven');
pr = ctx.doImportSheetRows_('pos', pf);
ok(pr.written === 0 && sheet.rows.length === 4, 'Pos: nhap lai -> khong them gi');
console.log('ALL IMPORT-SAFE TESTS PASSED');

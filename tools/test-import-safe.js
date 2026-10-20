#!/usr/bin/env node
// Test: nhap file Base/Pos KHONG BAO GIO xoa/ghi de dong cu; bo qua don da co; them dong moi; dryRun khong ghi gi.
// Chay: node tools/test-import-safe.js -> "ALL IMPORT-SAFE TESTS PASSED". Sheet gia, khong goi mang.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
function fnSrc(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name);
  let d = 0, k = src.indexOf('{', i); for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); } }
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok   ' + m); };
const consts = 'var DT_TONG_WIDTH=20,DON_CHITIET_WIDTH=17,DT_COL_NGAYTAO=0,DT_COL_PHONE=3,DT_COL_THOIGIANHT=10,DT_COL_SANPHAM=14,DT_COL_GIATRIDON=17,DT_COL_ID=19,VN_OFFSET_MS=7*3600*1000;';
const fns = ['_impHm_','_impOrderKey_','doImportSheetRows_','doImportSheetRowsLocked_','_rowKeyExact_','_rowIsBlank_','_autoDedupExactRowsInSheet_','normPhone_','normOrderDate_','_normMoney_','_normTxt_'].map(fnSrc).join('\n');
function mkSheet(rows) {
  const sh = { rows: rows.map(r => r.slice()), deleted: 0,
    getLastRow() { return this.rows.length + 1; }, getMaxColumns() { return 40; },
    getRange(r, c, n, w) { const t = this; return { getValues: () => t.rows.slice(r - 2, r - 2 + n).map(x => { const o = x.slice(0, w); while (o.length < w) o.push(''); return o; }),
      setValues: v => { v.forEach((x, i) => { t.rows[r - 2 + i] = x.slice(); }); } }; },
    deleteRow() { this.deleted++; } };
  return sh;
}
let sheet;
const ctx = { JSON, Object, Array, String, Number, Date, Math, isNaN, parseInt, parseFloat, console,
  jsonOut_: o => o, getDTSS_: () => ({ getSheetByName: () => sheet }), DT_TONG_SHEET: 'DT TỔNG ', DON_CHITIET_SHEET: 'dữ liệu đơn',
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
console.log('ALL IMPORT-SAFE TESTS PASSED');

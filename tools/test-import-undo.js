#!/usr/bin/env node
// Test: HOAN TAC LAN NHAP FILE — nhat ky lan nhap, xem truoc, xoa dung dong da them (dinh vi bang dau van), khoi phuc o cap nhat
// (chi o chua bi sua tay), sao luu dong bi xoa, 1 lan duy nhat. Sheet gia, khong goi mang.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
function fnSrc(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name);
  let d = 0, k = src.indexOf('{', i); for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); } }
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const consts = 'var DT_TONG_WIDTH=20,DON_CHITIET_WIDTH=17,DT_COL_NGAYTAO=0,DT_COL_PHONE=3,DT_COL_THOIGIANHT=10,DT_COL_SANPHAM=14,DT_COL_GIATRIDON=17,DT_COL_ID=19,DT_COL_BODEM=20,' +
  'SH_IMPORT_UPD_LOG="Nhat ky cap nhat",IMPORT_UPD_LOG_HEADERS=["thoiGian","sheet","dong","khoaDon","cot","giaTriCu","giaTriMoi"],IMPORT_UPD_MAX_ROWS=1500,VN_OFFSET_MS=7*3600*1000,' +
  'DT_TONG_SHEET="DT TONG ",DON_CHITIET_SHEET="du lieu don",SH_IMPORT_BATCH="Nhat ky lan nhap",IMPORT_BATCH_HEADERS=["batchId","thoiGian","nguoi","sheet","dongDau","soDong","dauVan","updLogDau","updLogSo","trangThai","hoanTacLuc","hoanTacBoi"],' +
  'SH_IMPORT_UNDO_BACKUP="Sao luu hoan tac",IMPORT_UNDO_MAX_ROWS=5000;';
const names = ['_impColName_', '_impCellStr_', '_impCellEq_', '_impDiffRow_', '_impHm_', '_impHmUnknown_', '_impHmCompat_', '_impOrderKeyParts_', '_impOrderKey_', '_impFindExist_', 'doImportSheetRows_', 'doImportSheetRowsLocked_',
  '_rowKeyExact_', '_rowIsBlank_', 'normPhone_', 'normOrderDate_', 'parseVNDate_', '_vnMidnight_', '_vnYmd_', '_vnYmdParts_', '_normMoney_', '_normTxt_',
  '_impWho_', '_impFp_', '_impKeyDropHm_', '_impColIdx_', '_impCellFromStr_', '_impBatchLog_', '_impReadBatch_', 'importBatchesList_', '_impScanSheet_', '_impNearest_', '_impLocateAppended_', '_impPlanRestore_', 'doImportUndo_', '_impUndoLocked_'];
// ---- sheet gia: rows[0] = tieu de (dong 1) ----
const SHEETS = {};
function mkSheet(name, rows) {
  const sh = { name, rows: (rows || []).map(r => r.slice()),
    getName() { return name; }, getLastRow() { return this.rows.length; }, getMaxColumns() { return 40; },
    getRange(r, c, n, w) { const t = this; n = n || 1; w = w || 1; return {
      getValues: () => { const o = []; for (let i = 0; i < n; i++) { const x = t.rows[r - 1 + i] || []; const q = x.slice(c - 1, c - 1 + w); while (q.length < w) q.push(''); o.push(q); } return o; },
      getFormulas: () => { const o = []; for (let i = 0; i < n; i++) o.push(new Array(w).fill('')); return o; },
      setValues: v => { v.forEach((x, i) => { const cur = t.rows[r - 1 + i] || (t.rows[r - 1 + i] = []); while (cur.length < c - 1 + x.length) cur.push(''); x.forEach((y, q) => { cur[c - 1 + q] = y; }); }); },
      setValue: y => { const cur = t.rows[r - 1] || (t.rows[r - 1] = []); while (cur.length < c) cur.push(''); cur[c - 1] = y; } }; },
    deleteRows(start, n) { this.rows.splice(start - 1, n); this.deletedBlocks = (this.deletedBlocks || 0) + 1; } };
  SHEETS[name] = sh; return sh;
}
const ctx = { JSON, Object, Array, String, Number, Date, Math, isNaN, parseInt, parseFloat, console, Logger: { log() {} },
  jsonOut_: o => o, getSheet_: (n, h) => SHEETS[n] || mkSheet(n, [h || []]), getDTSS_: () => ({ getSheetByName: n => SHEETS[n] || null }), getCrmSS_: () => ({ getSheetByName: n => SHEETS[n] || null }),
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) }, SpreadsheetApp: { flush() {} }, CacheService: { getScriptCache: () => ({ removeAll() {} }) },
  Utilities: { formatDate: () => '20261020_103000' }, sbMarkOrdersDirty_() {}, _autoDedupLog_() {},
  _sessUser_: t => (t === 'tok' ? { username: 'duyenht' } : null) };
vm.createContext(ctx); vm.runInContext(consts + names.map(fnSrc).join('\n'), ctx);
const POS = 'du lieu don', BASE = 'DT TONG ';
const H17 = new Array(17).fill('h'), H20 = new Array(20).fill('h');
const pos = (ngay, ph, ten, sp, ma, sl, gia, cod, note) => { const r = new Array(17).fill(''); r[0] = 1; r[1] = ngay; r[3] = ten; r[4] = ph; r[8] = sp; r[9] = ma; r[10] = sl; r[11] = gia; r[12] = cod; r[16] = note || ''; return r; };
const setup = (existing) => { Object.keys(SHEETS).forEach(k => delete SHEETS[k]); mkSheet(POS, [H17].concat(existing.map(r => r.slice()))); };
const snap = () => JSON.stringify(SHEETS[POS].rows);
const E1 = pos('05/10/2026 14:32', '0901111111', 'Hoa', 'Nhan', 'N1', 1, 5000000, 0, 'ghi chu cu 1'), E2 = pos('06/10/2026 09:00', '0902222222', 'Lan', 'Vong', 'V1', 2, 3000000, 0, 'ghi chu cu 2');
const NEW1 = pos('08/10/2026', '0903333333', 'Mai', 'Day', 'D1', 1, 4000000, 0), NEW2 = pos('08/10/2026', '0904444444', 'Nga', 'Charm', 'C1', 3, 900000, 0), NEW3 = pos('09/10/2026', '0905555555', 'Van', 'Tai', 'T1', 1, 2000000, 0);

// ---------- 1) nhap tao nhat ky ----------
setup([E1, E2]);
const before = snap();
let r = ctx.doImportSheetRows_('pos', [NEW1, NEW2, NEW3], false, false, 'duyenht');
ok(r.ok && r.written === 3 && /^imp_/.test(r.batchId), 'nhap that tra batchId: ' + r.batchId);
const bl = SHEETS['Nhat ky lan nhap'].rows;
ok(bl.length === 2 && bl[1][0] === r.batchId && bl[1][2] === 'duyenht' && bl[1][3] === POS && bl[1][4] === 4 && bl[1][5] === 3 && bl[1][6].split(',').length === 3 && bl[1][9] === 'ok', 'nhat ky: nguoi nhap, dong dau 4, 3 dong, 3 dau van, trang thai ok');
ok(ctx.doImportSheetRows_('pos', [NEW1], true, false, 'duyenht').batchId === undefined, 'xem truoc (dryRun) KHONG tao nhat ky');
ok(SHEETS['Nhat ky lan nhap'].rows.length === 2, 'sheet nhat ky khong them dong khi xem truoc');
r = ctx.doImportSheetRows_('pos', [NEW1, NEW2, NEW3], false, false, 'duyenht');
ok(r.written === 0 && !r.batchId, 'nhap lai khong them gi -> khong tao nhat ky moi');
const BID = bl[1][0];

// ---------- 2) hoan tac dong da them ----------
let u = ctx.doImportUndo_(BID, true, '');
ok(u.code === 'AUTH', 'khong dang nhap (who rong) -> bi tu choi');
u = ctx.doImportUndo_(BID, true, 'duyenht');
ok(u.ok && u.dryRun && u.wouldDelete === 3 && u.missing === 0 && u.wouldRestoreCells === 0 && snap().indexOf('0903333333') >= 0, 'xem truoc hoan tac: se xoa 3 dong, chua xoa that');
u = ctx.doImportUndo_(BID, false, 'duyenht');
ok(u.ok && u.deleted === 3 && SHEETS[POS].rows.length === 3 && JSON.stringify(SHEETS[POS].rows) === before, 'hoan tac that: xoa dung 3 dong, sheet tro lai Y NHU truoc khi nhap');
const bk = SHEETS['Sao luu hoan tac'].rows;
ok(bk.length === 1 + 3 && bk[1][0] === BID && bk[1][4] === 1 && String(bk.map(x => x.join('|')).join('~')).indexOf('0903333333') >= 0, 'dong bi xoa duoc SAO LUU truoc (kem batchId, dong goc)');
ok(SHEETS['Nhat ky lan nhap'].rows[1][9] === 'da-hoan-tac' && SHEETS['Nhat ky lan nhap'].rows[1][11] === 'duyenht', 'nhat ky danh dau da-hoan-tac + nguoi hoan tac');
ok(ctx.doImportUndo_(BID, false, 'duyenht').error.indexOf('đã được hoàn tác') >= 0, 'hoan tac lan 2 -> bao da hoan tac, khong lam gi');
ok(ctx.doImportUndo_('imp_khong_co', true, 'duyenht').error.indexOf('Không tìm thấy') >= 0, 'batchId khong ton tai -> bao loi');

// ---------- 3) dong da bi CHEN/XOA phia tren sau khi nhap -> dinh vi bang dau van, khong xoa nham ----------
setup([E1, E2]);
r = ctx.doImportSheetRows_('pos', [NEW1, NEW2, NEW3], false, false, 'duyenht');
SHEETS[POS].rows.splice(1, 0, pos('01/10/2026 08:00', '0907777777', 'Chen', 'X', 'X1', 1, 100000, 0));   // NV chen 1 dong o tren (dong 2)
SHEETS[POS].rows.splice(2, 1);                                                                          // roi xoa dong E1 (dong 3)
SHEETS[POS].rows.splice(2, 0, pos('02/10/2026 10:00', '0908888888', 'Chen2', 'Y', 'Y1', 1, 100000, 0)); // chen them 1 dong nua
const tamRows = SHEETS[POS].rows.length;
u = ctx.doImportUndo_(r.batchId, false, 'duyenht');
ok(u.ok && u.deleted === 3 && u.missing === 0 && SHEETS[POS].rows.length === tamRows - 3, 'vi tri da lech (chen/xoa dong): van xoa DUNG 3 dong da nhap');
const left = SHEETS[POS].rows.map(x => x[4]).join();
ok(left.indexOf('0907777777') >= 0 && left.indexOf('0908888888') >= 0 && left.indexOf('0902222222') >= 0 && left.indexOf('0903333333') < 0 && left.indexOf('0905555555') < 0, 'dong cua nguoi khac (chen tay) con nguyen, 3 dong nhap da bi xoa');

// ---------- 4) dong da nhap bi NV xoa tay truoc -> missing, khong xoa nham dong khac ----------
setup([E1, E2]);
r = ctx.doImportSheetRows_('pos', [NEW1, NEW2, NEW3], false, false, 'duyenht');
SHEETS[POS].rows.splice(4, 1);   // NV tu xoa NEW2
u = ctx.doImportUndo_(r.batchId, true, 'duyenht');
ok(u.wouldDelete === 2 && u.missing === 1, 'dong da bi xoa tay truoc: xem truoc bao missing=1, xoa 2 dong con lai');
const rowsBeforeUndo = SHEETS[POS].rows.length;
u = ctx.doImportUndo_(r.batchId, false, 'duyenht');
ok(u.deleted === 2 && SHEETS[POS].rows.length === rowsBeforeUndo - 2 && SHEETS[POS].rows.length === 3, 'chi xoa 2 dong con ton tai, 2 dong cu con nguyen');

// ---------- 5) cap nhat o -> khoi phuc gia tri cu, giu o da bi sua tay ----------
setup([E1.slice(), E2.slice()]);
const F1 = pos('05/10/2026', '0901111111', 'Hoa', 'Nhan', 'N1', 1, 5000000, 0, 'ghi chu MOI 1');     // doi ghi chu o E1
const F2 = pos('06/10/2026', '0902222222', 'Lan', 'Vong', 'V1', 2, 3000000, 0, 'ghi chu MOI 2');     // doi ghi chu o E2
r = ctx.doImportSheetRows_('pos', [F1, F2, NEW1], false, true, 'duyenht');
ok(r.ok && r.written === 1 && r.updatedCells === 2 && r.batchId, 'nhap + cap nhat 2 o: batchId ' + r.batchId);
ok(SHEETS[POS].rows[1][16] === 'ghi chu MOI 1' && SHEETS[POS].rows[2][16] === 'ghi chu MOI 2', 'cap nhat da ghi 2 o');
SHEETS[POS].rows[2][16] = 'NV sua tay sau do';                                                    // NV sua tay o thu 2
u = ctx.doImportUndo_(r.batchId, true, 'duyenht');
ok(u.wouldDelete === 1 && u.wouldRestoreCells === 1 && u.skippedEdited === 1, 'xem truoc: xoa 1 dong, khoi phuc 1 o, BO QUA 1 o da bi NV sua tay');
u = ctx.doImportUndo_(r.batchId, false, 'duyenht');
ok(u.ok && u.deleted === 1 && u.restoredCells === 1, 'hoan tac that');
ok(SHEETS[POS].rows[1][16] === 'ghi chu cu 1', 'o chua bi sua: khoi phuc ve gia tri CU "ghi chu cu 1"');
ok(SHEETS[POS].rows[2][16] === 'NV sua tay sau do', 'o NV da sua tay: GIU NGUYEN (khong ghi de)');
ok(SHEETS[POS].rows.length === 3 && SHEETS[POS].rows.slice(1).map(x => x[4]).join() === '0901111111,0902222222', 'dong moi (NEW1) da xoa, 2 dong cu con');

// ---------- 6) lan nhap chi cap nhat (khong them dong) van hoan tac duoc ----------
setup([E1.slice()]);
r = ctx.doImportSheetRows_('pos', [pos('05/10/2026', '0901111111', 'Hoa', 'Nhan', 'N1', 1, 5000000, 0, 'moi')], false, true, 'duyenht');
ok(r.written === 0 && r.updatedCells === 1 && r.batchId, 'chi cap nhat: van tao nhat ky (soDong 0)');
u = ctx.doImportUndo_(r.batchId, false, 'duyenht');
ok(u.ok && u.deleted === 0 && u.restoredCells === 1 && SHEETS[POS].rows[1][16] === 'ghi chu cu 1', 'hoan tac lan chi cap nhat: khoi phuc o, khong xoa dong');

// ---------- 7) dong cu bi chen lam lech so dong trong nhat ky cap nhat ----------
setup([E1.slice(), E2.slice()]);
r = ctx.doImportSheetRows_('pos', [pos('06/10/2026', '0902222222', 'Lan', 'Vong', 'V1', 2, 3000000, 0, 'moi 2')], false, true, 'duyenht');
SHEETS[POS].rows.splice(1, 0, pos('01/10/2026 08:00', '0907777777', 'Chen', 'X', 'X1', 1, 100000, 0));   // chen dong -> E2 doi tu dong 3 sang 4
u = ctx.doImportUndo_(r.batchId, false, 'duyenht');
ok(u.ok && u.restoredCells === 1 && SHEETS[POS].rows.find(x => x[4] === '0902222222')[16] === 'ghi chu cu 2', 'dong da dich cho: van tim dung dong theo KHOA DON de khoi phuc o');

// ---------- 8) nhap qua lon -> khong hoan tac duoc (khong co dau van) ----------
setup([E1.slice()]);
const big = []; for (let i = 0; i < 5001; i++) big.push(pos('10/10/2026', '09' + String(10000000 + i), 'K' + i, 'SP', 'M' + i, 1, 1000 + i, 0));
r = ctx.doImportSheetRows_('pos', big, false, false, 'duyenht');
ok(r.ok && r.written === 5001 && SHEETS['Nhat ky lan nhap'].rows[1][9] === 'khong-hoan-tac-duoc' && SHEETS['Nhat ky lan nhap'].rows[1][6] === '', 'nhap > 5000 dong: van nhap, danh dau khong-hoan-tac-duoc');
ok(ctx.doImportUndo_(r.batchId, false, 'duyenht').error.indexOf('quá lớn') >= 0, 'hoan tac lan qua lon -> bao ro, khong xoa gi');

// ---------- 9) danh sach lan nhap ----------
setup([E1.slice()]);
ctx.doImportSheetRows_('pos', [NEW1], false, false, 'duyenht'); ctx.doImportSheetRows_('pos', [NEW2], false, false, 'duyenht');
const lst = ctx.importBatchesList_();
ok(lst.ok && lst.items.length === 2 && lst.items[0].written === 1 && lst.items[0].canUndo && lst.items[0].who === 'duyenht', 'importBatchesList_: moi nhat truoc, co canUndo');
// ---------- 10) tien ich ----------
ok(ctx._impKeyDropHm_('p|2026-10-05|14:32|0901|a') === 'p|2026-10-05|0901|a' && ctx._impKeyDropHm_('id|A1') === 'id|A1', '_impKeyDropHm_ bo gio khoi khoa Pos, giu khoa khac');
ok(ctx._impColIdx_('A') === 0 && ctx._impColIdx_('Q') === 16 && ctx._impColIdx_('AA') === 26 && ctx._impColName_(ctx._impColIdx_('AB')) === 'AB', '_impColIdx_ nguoc voi _impColName_');
ok(ctx._impCellFromStr_('5000000') === 5000000 && ctx._impCellFromStr_('0901234567') === '0901234567' && ctx._impCellFromStr_('abc') === 'abc' && ctx._impCellFromStr_('2026-10-05T07:32:00.000Z') instanceof Date, '_impCellFromStr_: so->Number, SDT 0xxx giu chuoi, ISO->Date');
ok(/importUndo: 1, importBatches: 1/.test(src), 'importUndo/importBatches nam trong OWNER_ONLY_ACTIONS_ (chi chu so huu)');
ok(/action === 'importUndo'\)\s+return doImportUndo_\(data\.batchId, data\.dryRun, _impWho_\(data\.token\)\)/.test(src), 'doPost co action importUndo');
console.log(fail ? '\nFAILED ' + fail : '\nALL IMPORT-UNDO TESTS PASSED'); process.exit(fail ? 1 : 0);

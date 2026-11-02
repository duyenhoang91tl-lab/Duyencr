#!/usr/bin/env node
// Test: nhap file Base/Pos KHONG BAO GIO xoa/ghi de dong cu; bo qua don da co; them dong moi; dryRun khong ghi gi.
// Chay: node tools/test-import-safe.js -> "ALL IMPORT-SAFE TESTS PASSED". Sheet gia, khong goi mang.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
function fnSrc(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name);
  let d = 0, k = src.indexOf('{', i); for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); } }
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok   ' + m); };
const consts = 'var SH_IMPORT_BATCH="batch",IMPORT_BATCH_HEADERS=["batchId","thoiGian","nguoi","sheet","dongDau","soDong","dauVan","updLogDau","updLogSo","trangThai","hoanTacLuc","hoanTacBoi"],IMPORT_UNDO_MAX_ROWS=5000,DT_TONG_WIDTH=20,DON_CHITIET_WIDTH=17,DT_COL_NGAYTAO=0,DT_COL_PHONE=3,DT_COL_THOIGIANHT=10,DT_COL_SANPHAM=14,DT_COL_GIATRIDON=17,DT_COL_ID=19,DT_COL_BODEM=20,SH_IMPORT_UPD_LOG="log",IMPORT_UPD_LOG_HEADERS=[1,2,3,4,5,6,7],IMPORT_UPD_MAX_ROWS=1500,IMPORT_UPD_RUN_GAP=40,IMPORT_UPD_BUDGET_MS=240000,VN_OFFSET_MS=7*3600*1000,SH_POS_DEDUP_LOG="poslog",POS_DEDUP_LOG_HEADERS=[1,2,3,4,5],POS_COL_TRANGTHAI=14,POS_DEDUP_MAX_DELETE=3000,DON_COL_GHICHU=16;';
const fns = ['_impFp_','_impBatchLog_','_impColName_','_impCellStr_','_impCellEq_','_impDiffRow_','_impApplyUpdPlan_','_impHm_','_impHmUnknown_','_impHmCompat_','_impOrderKeyParts_','_impOrderKey_','_impFindExist_','doImportSheetRows_','doImportSheetRowsLocked_','_rowKeyExact_','_rowIsBlank_','_autoDedupExactRowsInSheet_','_posDedupKeyParts_','_dedupePosRelaxedInSheet_','_impPosCleanup_','normPhone_','normOrderDate_','parseVNDate_','_vnMidnight_','_vnYmd_','_vnYmdParts_','_normMoney_','_normTxt_'].map(fnSrc).join('\n');
function mkSheet(rows, formulas) {
  const sh = { rows: rows.map(r => r.slice()), deleted: 0, formulas: formulas || {},
    getLastRow() { return this.rows.length + 1; }, getMaxColumns() { return 40; }, getName() { return 'DT TỔNG '; },
    getRange(r, c, n, w) { const t = this; return {
      getValues: () => t.rows.slice(r - 2, r - 2 + n).map(x => { const o = x.slice(c - 1, c - 1 + w); while (o.length < w) o.push(''); return o; }),
      getFormulas: () => t.rows.slice(r - 2, r - 2 + n).map((x, i) => { const o = []; for (let q = 0; q < w; q++) o.push(t.formulas[(r + i) + ':' + (c - 1 + q)] || ''); return o; }),
      setValues: v => { v.forEach((x, i) => { const cur = t.rows[r - 2 + i] || []; while (cur.length < c - 1 + x.length) cur.push(''); x.forEach((y, q) => { cur[c - 1 + q] = y; }); t.rows[r - 2 + i] = cur; }); } }; },
    deleteRow() { this.deleted++; }, deleteRows(r, n) { this.rows.splice(r - 2, n); this.deleted += n; } };
  return sh;
}
let sheet, logSheet = mkSheet([]), batchSheet = mkSheet([]), posLogSheet = mkSheet([]);   // batchSheet = 'Nhat ky lan nhap' (rieng, de khong lan voi nhat ky cap nhat o)
const ctx = { JSON, Object, Array, String, Number, Date, Math, isNaN, parseInt, parseFloat, console,
  jsonOut_: o => o, getSheet_: (n) => n === 'batch' ? batchSheet : n === 'poslog' ? posLogSheet : logSheet, getDTSS_: () => ({ getSheetByName: () => sheet }), DT_TONG_SHEET: 'DT TỔNG ', DON_CHITIET_SHEET: 'dữ liệu đơn',
  Logger: { log() {} }, Utilities: { formatDate: () => '20261021_000000' }, LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) }, SpreadsheetApp: { flush() {} },
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
ok(sheet.rows[1][7] === 'Hoan thanh' && sheet.rows[1][2] !== 'Sale Y' && (sheet.rows[1][2] === '=A3&"x"' || sheet.rows[1][2] === 'Sale X'), 'U2: trang thai doi; o CONG THUC duoc giu nguyen cong thuc, khong bi ghi de bang Sale Y');
ok(JSON.stringify(sheet.rows[2]) === JSON.stringify(row('U3', '0966666666', 3000000)), 'U3 y het: khong doi');
ok(logSheet.rows.length === 2 && logSheet.rows.some(l => l[4] === 'H' && l[5] === 'Dang giao' && l[6] === 'Hoan thanh'), 'nhat ky luu gia tri cu -> moi');
rs = ctx.doImportSheetRows_('base', [f1, f2, f3], false, true);
ok(rs.updatedRows === 0 && rs.written === 0 && logSheet.rows.length === 2, 'nhap lai file: khong cap nhat them');
rs = ctx.doImportSheetRows_('base', [r0('U1', '0944444444', 1000000, 'Huy')], false);
ok(!rs.updatedRows && sheet.rows[0][7] === 'Hoan thanh', 'khong bat updateExisting (client cu): chi bo qua, khong sua');
// ===== Dong cu CHUA co ID (cot T rong) + file co ID & trang thai 'That bai': phai CAP NHAT dong cu, khong them trung =====
{
  const oldN = row('', '0977777777', 5000000); oldN[7] = 'Dang xu ly';
  const oldD = row('D9', '0988888888', 6000000); oldD[7] = 'Dang xu ly';
  sheet = mkSheet([oldN, oldD]); logSheet = mkSheet([]);
  const fN = row('N1', '0977777777', 5000000); fN[7] = 'That bai';
  const fD = row('D8', '0988888888', 6000000); fD[7] = 'That bai';   // ID KHAC dong cu co ID -> la don khac, khong duoc khop
  const rr = ctx.doImportSheetRows_('base', [fN, fD], false, true);
  ok(rr.updatedRows === 1 && rr.written === 1 && sheet.rows[0][7] === 'That bai' && sheet.rows[0][19] === 'N1' && sheet.rows[1][7] === 'Dang xu ly', 'dong cu thieu ID: cap nhat trang thai That bai + dien ID; ID khac thi la don moi');
}
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
// ===== POS end-to-end (yeu cau Duyen 22/10/2026): Sheet DA CO 2 dong trung (khac STT/Trang thai/Ghi chu) -> nhap file = don trung + ghi de TT/ghi chu moi =====
{
  const nga = (stt, tt, gc) => { const r = new Array(17).fill(''); r[0] = stt; r[1] = '21/10/2026'; r[3] = 'Phạm Phương Nga'; r[4] = '837923113'; r[7] = 'Quầy Hào Nam';
    r[8] = 'TRANG SỨC NHẪN NG MẪU A-SIZE 2 ,QUÀ HỘP TRANG SỨC ,LÁ BỒ ĐỀ'; r[9] = 'NN-TA-2 ;QHTS ;LA-BD'; r[10] = '1 ,1 ,2001'; r[11] = 7950000; r[12] = 6950000; r[14] = tt; r[16] = gc; return r; };
  const other = nga(9, 'Mới', ''); other[3] = 'Khách Khác'; other[4] = '0911222333';
  sheet = mkSheet([nga(1, 'Mới', 'TT TM CỌC 1TR'), nga(2, 'Mới', 'TT TM CỌC 1TR'), other]); posLogSheet = mkSheet([]); logSheet = mkSheet([]);
  const fileRow = nga(7, 'Đã xác nhận', 'TT TM CỌC 1TR - đã CK đủ');   // file moi: STT khac, TT + ghi chu doi
  const pv = ctx.doImportSheetRows_('pos', [fileRow], true, true);
  ok(pv.dryRun && sheet.rows.length === 3 && pv.wouldWrite === 0 && pv.skippedExisting === 1, 'Pos xem truoc: don da co (khong them dong), KHONG xoa gi khi xem truoc');
  const done = ctx.doImportSheetRows_('pos', [fileRow], false, true);
  ok(done.ok && done.written === 0 && done.dedupedAfter === 1 && sheet.rows.length === 2, 'Pos nhap that: tu don dong trung (dedupedAfter = 1), con 2 dong');
  ok(sheet.rows[0][14] === 'Đã xác nhận' && sheet.rows[0][16] === 'TT TM CỌC 1TR - đã CK đủ', 'dong con lai mang Trang thai + Ghi chu MOI tu file Pos');
  ok(sheet.rows[1][3] === 'Khách Khác' && posLogSheet.rows.length === 1, 'don khac khong bi dung; dong bi xoa co sao luu');
  const again = ctx.doImportSheetRows_('pos', [fileRow], false, true);
  ok(again.written === 0 && again.dedupedAfter === 0 && sheet.rows.length === 2, 'nhap lai cung file: khong doi gi');
  // file khop dong DAU nhung KHONG co gi doi (TT/ghi chu da moi san) + dong cuoi cu: dong cuoi KHONG duoc ghi de nguoc lai
  sheet = mkSheet([nga(1, 'Đã xác nhận', 'ghi chu moi'), nga(2, 'Mới', 'ghi chu cu')]); posLogSheet = mkSheet([]);
  const same = ctx.doImportSheetRows_('pos', [nga(5, 'Đã xác nhận', 'ghi chu moi')], false, true);
  ok(same.dedupedAfter === 1 && sheet.rows.length === 1 && sheet.rows[0][14] === 'Đã xác nhận' && sheet.rows[0][16] === 'ghi chu moi', 'file khop dong dau, khong doi: dong cuoi (cu) KHONG ghi de nguoc lai');
  const baseRow = row('B1', '0911111111', 1000000);
  sheet = mkSheet([baseRow, baseRow.slice()]); const rb = ctx.doImportSheetRows_('base', [baseRow], false, true);
  ok(rb.dedupedAfter === 0 && sheet.rows.length === 2, 'nhap Base: khong ap dung don kieu Pos');
}
// ===== FILE NHIEU NGAY (897 dong, 24/10/2026): cap nhat hang tram don cu PHAI gom lenh goi API, khong 4 lenh/don =====
// NGUYEN NHAN GOC loi 'Failed to fetch' khi up Pos 15-24/10: vong cap nhat cu goi getRange/getValues/getFormulas/setValues rieng tung don -> vuot thoi gian Apps Script.
{
  const N = 897, mk = i => { const r = new Array(17).fill(''); r[0] = i; r[1] = '15/10/2026 09:00'; r[3] = 'KH' + i; r[4] = '09' + String(10000000 + i); r[8] = 'SP' + i; r[9] = 'M' + i; r[10] = 1; r[11] = 1000000 + i; r[12] = 0; r[14] = 'Dang xu ly'; r[16] = (i % 5 === 0) ? 'ghi chu NV' : ''; return r; };
  const oldRows = [], fileRows = [];
  for (let i = 0; i < N; i++) { oldRows.push(mk(i)); const f = mk(i); f[14] = (i % 7 === 0) ? 'Dang xu ly' : 'Hoan thanh'; f[16] = (i % 3 === 0) ? 'ghi chu moi' : ''; fileRows.push(f); }
  const fm = {}; fm[(2 + 10) + ':14'] = '=IF(1,"CT","")';          // o Trang thai cua dong 12 la CONG THUC -> khong duoc ghi de
  sheet = mkSheet(oldRows, fm); logSheet = mkSheet([]);
  let calls = 0; const rawGet = sheet.getRange.bind(sheet);
  sheet.getRange = function (a, b, c, d) { calls++; const g = rawGet(a, b, c, d); return { getValues: () => { calls++; return g.getValues(); }, getFormulas: () => { calls++; return g.getFormulas(); }, setValues: v => { calls++; return g.setValues(v); } }; };
  const pvB = ctx.doImportSheetRows_('pos', fileRows, true, true);
  ok(pvB.dryRun && pvB.skippedExisting === N && pvB.wouldWrite === 0 && pvB.wouldUpdateRows > 800, 'file 897 dong: xem truoc thay ~hang tram don cu doi (' + pvB.wouldUpdateRows + ')');
  calls = 0; const t0 = Date.now();
  const wB = ctx.doImportSheetRows_('pos', fileRows, false, true);
  ok(wB.ok && wB.written === 0 && wB.updatedRows > 800, 'file 897 dong: cap nhat that ' + wB.updatedRows + ' don / ' + wB.updatedCells + ' o');
  ok(calls < 60, 'so lenh goi Sheet gon (' + calls + ' lenh) — cu la ~' + (wB.updatedRows * 4) + ' lenh, vuot thoi gian Apps Script');
  ok(sheet.rows.every((r, i) => (i === 10) || (i % 7 === 0 ? r[14] === 'Dang xu ly' : r[14] === 'Hoan thanh')), 'trang thai moi ghi dung tung don (tru o cong thuc dong 12, don khong doi giu nguyen)');
  ok(sheet.rows[10][14] !== 'Hoan thanh', 'o CONG THUC khong bi ghi de');
  ok(sheet.rows.every((r, i) => i % 3 === 0 ? r[16] === 'ghi chu moi' : (i % 5 === 0 ? r[16] === 'ghi chu NV' : r[16] === '')), 'ghi chu: file co gia tri -> cap nhat; file de trong -> GIU ghi chu cu, khong xoa');
  ok(sheet.rows.every((r, i) => r[4] === oldRows[i][4] && r[3] === oldRows[i][3] && r[11] === oldRows[i][11]), 'cot khac (SDT, ten, gia) khong bi dong vao');
  ok(logSheet.rows.length === wB.updatedCells, 'nhat ky ghi dung 1 dong / o doi (' + logSheet.rows.length + ')');
  const w2 = ctx.doImportSheetRows_('pos', fileRows, false, true);
  ok(w2.written === 0 && (w2.updatedCells || 0) <= 1, 'nhap lai cung file: khong con gi de cap nhat');
}
console.log('ALL IMPORT-SAFE TESTS PASSED');

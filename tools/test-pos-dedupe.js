#!/usr/bin/env node
// Test: dọn trùng Pos "dữ liệu đơn" — bỏ qua STT (A), Trạng thái (O), Ghi chú (Q); ghi đè TT/ghi chú mới nhất; sao lưu trước khi xoá.
// Chạy: node tools/test-pos-dedupe.js -> "ALL POS-DEDUPE TESTS PASSED". Sheet giả, không gọi mạng.
// Ví dụ thật của Duyên (21/10/2026): 2 dòng "Phạm Phương Nga 837923113 ... TT TM CỌC 1TR" nằm trùng trong sheet.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
function fnSrc(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name);
  let d = 0, k = src.indexOf('{', i); for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); } }
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok   ' + m); };
const consts = 'var DON_CHITIET_WIDTH=17,DON_COL_GHICHU=16,POS_COL_TRANGTHAI=14,POS_DEDUP_MAX_DELETE=3000,SH_POS_DEDUP_LOG="poslog",POS_DEDUP_LOG_HEADERS=[1,2,3,4,5],SH_IMPORT_UPD_LOG="updlog",IMPORT_UPD_LOG_HEADERS=[1,2,3,4,5,6,7],VN_OFFSET_MS=7*3600*1000;';
const fns = ['_posDedupKeyParts_','_dedupePosRelaxedInSheet_','_impPosCleanup_','_impColName_','_impCellStr_','_impCellEq_','_impHm_','_impHmUnknown_','_impHmCompat_','_impFindExist_','_rowIsBlank_','normPhone_','normOrderDate_','parseVNDate_','_vnMidnight_','_vnYmd_','_vnYmdParts_','_normMoney_','_normTxt_','_autoDedupExactRowsInSheet_','_rowKeyExact_'].map(fnSrc).join('\n');
function mkSheet(rows, formulas) {
  return { rows: rows.map(r => r.slice()), deleted: 0, formulas: formulas || {}, failBackup: false,
    getLastRow() { return this.rows.length + 1; }, getMaxColumns() { return 40; }, getName() { return 'dữ liệu đơn'; },
    getRange(r, c, n, w) { const t = this; return {
      getValues: () => t.rows.slice(r - 2, r - 2 + n).map(x => { const o = x.slice(c - 1, c - 1 + w); while (o.length < w) o.push(''); return o; }),
      getFormulas: () => { const out = []; for (let i = 0; i < n; i++) { const o = []; for (let q = 0; q < w; q++) o.push(t.formulas[(r + i) + ':' + (c - 1 + q)] || ''); out.push(o); } return out; },
      setValues: v => { if (t.failBackup) throw new Error('loi sao luu'); v.forEach((x, i) => { const cur = t.rows[r - 2 + i] || []; while (cur.length < c - 1 + x.length) cur.push(''); x.forEach((y, q) => { cur[c - 1 + q] = y; }); t.rows[r - 2 + i] = cur; }); } }; },
    deleteRows(r, n) { this.rows.splice(r - 2, n); this.deleted += n; } };
}
let sheet, posLog = mkSheet([]), updLog = mkSheet([]), dirty = 0;
const ctx = { JSON, Object, Array, String, Number, Date, Math, isNaN, parseInt, parseFloat, console,
  getSheet_: n => n === 'poslog' ? posLog : updLog, DON_CHITIET_SHEET: 'dữ liệu đơn', Logger: { log() {} },
  CacheService: { getScriptCache: () => ({ removeAll() {} }) }, sbMarkOrdersDirty_() { dirty++; }, _autoDedupLog_() {}, SpreadsheetApp: { flush() {} } };
vm.createContext(ctx); vm.runInContext(consts + fns, ctx);
const reset = (rows, f) => { sheet = mkSheet(rows, f); posLog = mkSheet([]); updLog = mkSheet([]); dirty = 0; };

// Dòng Pos đúng như Duyên dán (cột A = STT, B = ngày, ... O = Trạng thái, P = thẻ phân loại, Q = ghi chú nội bộ)
const nga = (stt, tt, ghichu, ngay) => { const r = new Array(17).fill('');
  r[0] = stt; r[1] = ngay || '21/10/2026'; r[3] = 'Phạm Phương Nga'; r[4] = '837923113'; r[7] = 'Quầy Hào Nam';
  r[8] = 'TRANG SỨC NHẪN NG MẪU A-SIZE 2 ,QUÀ HỘP TRANG SỨC ,LÁ BỒ ĐỀ'; r[9] = 'NN-TA-2 ;QHTS ;LA-BD'; r[10] = '1 ,1 ,2001';
  r[11] = 7950000; r[12] = 6950000; r[14] = tt; r[15] = 'NHẪN ;QUÀ TẶNG ;QUÀ TẶNG'; r[16] = ghichu; return r; };
const khac = () => { const r = nga(3, 'Mới', ''); r[3] = 'Nguyễn Văn B'; r[4] = '0912345678'; r[8] = 'NHẪN KHÁC'; return r; };

// 1) Đúng ví dụ của Duyên: 2 dòng y hệt
reset([nga(1, 'Mới', 'TT TM CỌC 1TR'), nga(1, 'Mới', 'TT TM CỌC 1TR'), khac()]);
let r = ctx._dedupePosRelaxedInSheet_(sheet);
ok(r.deleted === 1 && r.groups === 1 && r.updatedCells === 0 && sheet.rows.length === 2, '2 dòng y hệt của Duyên -> còn 1, không ghi đè gì');
ok(sheet.rows[1][3] === 'Nguyễn Văn B', 'đơn khác không bị đụng');
ok(posLog.rows.length === 1 && JSON.parse(posLog.rows[0][4])[3] === 'Phạm Phương Nga', 'dòng bị xoá được sao lưu nguyên văn vào nhật ký');

// 2) Khác STT + Trạng thái + Ghi chú (bộ dọn cũ KHÔNG xoá được) -> xoá + ghi đè TT/ghi chú mới nhất vào dòng giữ lại
reset([nga(5, 'Mới', 'TT TM CỌC 1TR'), khac(), nga(9, 'Đã xác nhận', 'TT TM CỌC 1TR - đã CK đủ')]);
const old = JSON.stringify(sheet.rows);
ok(ctx._autoDedupExactRowsInSheet_(mkSheet(sheet.rows), 17).deleted === 0, 'bộ dọn CŨ (giống y hệt mọi cột) KHÔNG xoá được cặp này (nguyên nhân gốc)');
r = ctx._dedupePosRelaxedInSheet_(sheet);
ok(r.deleted === 1 && r.updatedCells === 2 && sheet.rows.length === 2, 'khác STT/TT/ghi chú -> xoá dòng thừa, ghi đè 2 ô');
ok(sheet.rows[0][14] === 'Đã xác nhận' && sheet.rows[0][16] === 'TT TM CỌC 1TR - đã CK đủ' && sheet.rows[0][0] === 5, 'dòng giữ lại (đầu tiên) nhận Trạng thái + Ghi chú MỚI NHẤT, giữ nguyên STT cũ');
ok(updLog.rows.length === 2 && updLog.rows.some(l => l[4] === 'O' && l[5] === 'Mới' && l[6] === 'Đã xác nhận') && updLog.rows.some(l => l[4] === 'Q'), 'nhật ký lưu giá trị CŨ -> MỚI của ô bị ghi đè (cột O, Q)');
ok(dirty === 0, '(hàm lõi không tự đánh dấu Supabase — việc của _impPosCleanup_)');

// 3) Dòng mới nhất để TRỐNG ghi chú/trạng thái -> KHÔNG xoá trắng ô cũ
reset([nga(1, 'Đã xác nhận', 'Ghép cùng đơn 980T09'), nga(2, '', '')]);
r = ctx._dedupePosRelaxedInSheet_(sheet);
ok(r.deleted === 1 && r.updatedCells === 0 && sheet.rows[0][14] === 'Đã xác nhận' && sheet.rows[0][16] === 'Ghép cùng đơn 980T09', 'dòng mới trống TT/ghi chú -> giữ giá trị cũ, không xoá trắng');

// 4) Nhóm 3 dòng: lấy giá trị KHÔNG rỗng của dòng cuối cùng có giá trị
reset([nga(1, 'Mới', 'a'), nga(2, 'Đang giao', ''), nga(3, '', '')]);
r = ctx._dedupePosRelaxedInSheet_(sheet);
ok(r.deleted === 2 && sheet.rows.length === 1 && sheet.rows[0][14] === 'Đang giao' && sheet.rows[0][16] === 'a', 'nhóm 3 dòng: TT = "Đang giao" (mới nhất có giá trị), ghi chú giữ "a"');

// 5) Khác ở cột KHÁC (giá, số lượng, sản phẩm, khách) => ĐƠN KHÁC, không đụng
reset([nga(1, 'Mới', ''), (() => { const x = nga(2, 'Mới', ''); x[11] = 8950000; return x; })(), (() => { const x = nga(3, 'Mới', ''); x[10] = '1 ,1 ,2002'; return x; })()]);
r = ctx._dedupePosRelaxedInSheet_(sheet);
ok(r.deleted === 0 && sheet.rows.length === 3, 'khác giá / khác số lượng -> 3 đơn riêng, không xoá');

// 6) Giờ: chỉ-ngày (hoặc 00:00) khớp dòng có giờ; 2 giờ THẬT khác nhau là 2 đơn riêng
reset([nga(1, 'Mới', '', '21/10/2026 09:15'), nga(2, 'Mới', '', '21/10/2026')]);
ok(ctx._dedupePosRelaxedInSheet_(sheet).deleted === 1, 'có giờ vs chỉ-ngày -> cùng 1 đơn');
reset([nga(1, 'Mới', '', '21/10/2026 09:15'), nga(2, 'Mới', '', '21/10/2026 14:40')]);
ok(ctx._dedupePosRelaxedInSheet_(sheet).deleted === 0, '09:15 vs 14:40 -> 2 đơn riêng, không xoá');
reset([nga(1, 'Mới', '', '21/10/2026 09:15'), nga(2, 'Mới', '', '21/10/2026'), nga(3, 'Mới', '', '21/10/2026 14:40')]);
r = ctx._dedupePosRelaxedInSheet_(sheet);
ok(r.deleted === 1 && sheet.rows.length === 2 && sheet.rows[1][0] === 3, '09:15 + chỉ-ngày + 14:40: chỉ-ngày nhập vào 09:15, 14:40 vẫn là đơn riêng');

// 7) SĐT thiếu số 0 đầu / giá dạng chuỗi có dấu chấm vẫn khớp
reset([nga(1, 'Mới', ''), (() => { const x = nga(2, 'Mới', ''); x[4] = '0837923113'; x[11] = '7.950.000'; x[12] = '6,950,000'; return x; })()]);
ok(ctx._dedupePosRelaxedInSheet_(sheet).deleted === 1, '837923113 == 0837923113, "7.950.000" == 7950000 -> trùng');

// 8) Ô Trạng thái của dòng giữ lại là CÔNG THỨC -> không ghi đè (nhưng dòng thừa vẫn xoá)
reset([nga(1, 'Mới', ''), nga(2, 'Hoàn thành', '')], { '2:14': '=IF(1,"Mới")' });
r = ctx._dedupePosRelaxedInSheet_(sheet);
ok(r.deleted === 1 && r.updatedCells === 0 && sheet.rows[0][14] === 'Mới', 'ô công thức không bị ghi đè');

// 9) Sao lưu lỗi -> KHÔNG xoá, KHÔNG ghi đè gì
reset([nga(1, 'Mới', ''), nga(2, 'Hoàn thành', 'x')]); posLog.failBackup = true;
r = ctx._dedupePosRelaxedInSheet_(sheet);
ok(r.deleted === 0 && sheet.rows.length === 2 && sheet.rows[0][14] === 'Mới', 'sao lưu lỗi -> dừng, dữ liệu nguyên vẹn');

// 10) Dòng trống / không đủ định danh (không SĐT, không tên+SP) -> không đụng
const trong = new Array(17).fill(''); const tong = new Array(17).fill(''); tong[1] = 'Tổng'; tong[11] = 123;
reset([trong, tong, tong.slice()]);
ok(ctx._dedupePosRelaxedInSheet_(sheet).deleted === 0, 'dòng trống / dòng "Tổng" không bị coi là trùng');

// 11) Nhiều nhóm + dòng liền kề xoá bằng 1 lệnh, chỉ số không lệch
const A = (s, tt) => nga(s, tt, ''), B = () => khac();
reset([A(1, 'Mới'), A(2, 'Mới'), A(3, 'Mới'), B(), (() => { const x = khac(); x[0] = 4; x[14] = 'Hủy'; return x; })()]);
r = ctx._dedupePosRelaxedInSheet_(sheet);
ok(r.deleted === 3 && r.groups === 2 && sheet.rows.length === 2 && sheet.rows[0][3] === 'Phạm Phương Nga' && sheet.rows[1][3] === 'Nguyễn Văn B' && sheet.rows[1][14] === 'Hủy', '2 nhóm (3 dòng + 2 dòng) -> còn 2 dòng, đúng thứ tự, TT "Hủy" của dòng mới nhất được ghi đè');

// 12) Chạy lại lần 2: không còn gì để làm (idempotent)
const snap = JSON.stringify(sheet.rows);
r = ctx._dedupePosRelaxedInSheet_(sheet);
ok(r.deleted === 0 && r.updatedCells === 0 && JSON.stringify(sheet.rows) === snap, 'chạy lại: không đổi gì');

// 13) _impPosCleanup_: chỉ chạy cho Pos; Base bỏ qua; có thay đổi thì đánh dấu Supabase
reset([nga(1, 'Mới', ''), nga(2, 'Mới', '')]);
ok(ctx._impPosCleanup_('base', sheet).deleted === 0 && sheet.rows.length === 2 && dirty === 0, 'nhập Base: không dọn kiểu Pos');
ok(ctx._impPosCleanup_('pos', sheet).deleted === 1 && dirty === 1, 'nhập Pos: dọn + đánh dấu Supabase dirty');

// 14) Trần xoá mỗi lần chạy: 3003 dòng y hệt -> lần 1 xoá đúng 3000, lần 2 xoá nốt 2, còn 1 dòng
reset(Array.from({ length: 3003 }, (_, i) => nga(i + 1, 'Mới', '')));
r = ctx._dedupePosRelaxedInSheet_(sheet);
ok(r.deleted === 3000 && sheet.rows.length === 3, 'vượt trần: lần 1 xoá đúng 3000 dòng');
r = ctx._dedupePosRelaxedInSheet_(sheet);
ok(r.deleted === 2 && sheet.rows.length === 1, 'lần 2 xoá nốt, còn đúng 1 dòng');
console.log('ALL POS-DEDUPE TESTS PASSED');

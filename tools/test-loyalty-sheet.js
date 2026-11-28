#!/usr/bin/env node
// Test SỔ ĐIỂM + LỊCH SỬ HẠNG (gas_v13.js, bước 2b): đồng bộ từ đơn POS (idempotent), hoàn đơn, dùng điểm, chống bấm 2 lần, quyền.
// Chạy: node tools/test-loyalty-sheet.js -> "ALL LOYALTY SHEET TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sheets = {};
function mkSheet() { return { rows: [], getLastRow() { return this.rows.length; }, getMaxColumns() { return 30; }, getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }, appendRow(r) { this.rows.push(r.slice()); }, setFrozenRows() {}, insertColumnsAfter() {},
  getRange(r, c, nr, nc) { const s = this; return { getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const x = s.rows[r - 1 + i] || [], row = []; for (let j = 0; j < nc; j++) row.push(x[c - 1 + j] === undefined ? '' : x[c - 1 + j]); o.push(row); } return o; },
    setValues: v => { for (let i = 0; i < v.length; i++) { s.rows[r - 1 + i] = s.rows[r - 1 + i] || []; for (let j = 0; j < v[i].length; j++) s.rows[r - 1 + i][c - 1 + j] = v[i][j]; } }, setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; } }; } }; }
const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet()) };
let tokenUser = { role: 'sale', username: 'hoa' };
const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, isFinite, encodeURIComponent, RegExp,
  Logger: { log() {} }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {}, tryLock: () => true }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, getProperties: () => ({}) }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {}, removeAll() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
  Utilities: { getUuid: () => 'x', formatDate: () => '261117120000' }, SpreadsheetApp: { openById: () => ss } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8'), ctx, { filename: 'gas_v13.js' });
ctx.SpreadsheetApp = { openById: () => ss };
ctx._sessUser_ = () => tokenUser;
let pos = [];
ctx.readDonChiTiet_ = () => pos;
ctx.getSetting_ = () => '';
const J = o => JSON.parse(o.getContent());
const PH = '0912345678', o = (d, v, st) => ({ soDienThoai: PH, ngayTaoDon: d, giaTriSauGiam: v, trangThai: st || '' });
const get = () => J(ctx.loyaltyDoGet_('loyaltyGet', { token: 't', phone: PH }));
const rowsOf = n => (sheets[n] ? sheets[n].rows.slice(1) : []);
// 1) đơn POS → điểm + lịch sử hạng; gọi lại KHÔNG nhân đôi
pos = [o('10/01/2026', 16000000), o('10/02/2026', 12000000), o('10/03/2026', 3000000), { soDienThoai: '0999999999', ngayTaoDon: '10/01/2026', giaTriSauGiam: 5e7 }];
let g = get();
ok(g.ok && g.points.earned === 310 && g.points.balance === 310, 'earn 160+120+30=310: ' + JSON.stringify(g.points));
ok(g.tier === 'vip' && g.tierLabel === 'Vip' && g.tierHistory.length === 2 && g.tierHistory[1].toLabel === 'Vip' && g.tierHistory[1].cumulative === 31000000, 'hạng Vip + lịch sử: ' + JSON.stringify(g.tierHistory));
g = get(); ok(rowsOf('LoyaltyPoints').length === 3 && rowsOf('LoyaltyTier').length === 2 && g.synced.earn === 0, 'đồng bộ lại không nhân đôi');
ok(String(rowsOf('LoyaltyPoints')[0][1]) === '912345678' || String(rowsOf('LoyaltyPoints')[0][1]) === PH, 'SĐT chuẩn hoá lưu');
ok(!rowsOf('LoyaltyPoints').some(r => String(r[1]).indexOf('999999999') >= 0), 'không lẫn đơn của SĐT khác');
// 2) đơn cùng ngày cùng giá trị = 2 đơn riêng (không gộp)
pos.push(o('10/03/2026', 3000000)); g = get(); ok(g.points.earned === 340, 'đơn trùng ngày+giá trị tính riêng: ' + g.points.earned);
// 3) dùng điểm: trừ 100 điểm = 100.000đ; chống bấm 2 lần theo refKey; vượt số dư bị cắt
let r = J(ctx.loyaltyDoPost_('loyaltyRedeem', { token: 't', phone: PH, orderValue: 2000000, points: 100, refKey: 'R1' }));
ok(r.ok && r.redeemed.points === 100 && r.redeemed.discount === 100000 && r.redeemed.payable === 1900000 && r.points.balance === 240, 'redeem 100: ' + JSON.stringify(r));
r = J(ctx.loyaltyDoPost_('loyaltyRedeem', { token: 't', phone: PH, orderValue: 2000000, points: 100, refKey: 'R1' }));
ok(!r.ok && r.code === 'DUPLICATE' && get().points.balance === 240, 'cùng refKey không trừ lần 2');
r = J(ctx.loyaltyDoPost_('loyaltyRedeem', { token: 't', phone: PH, orderValue: 5000000, points: 9999 })); ok(r.ok && r.redeemed.points === 240 && r.points.balance === 0, 'không vượt số dư: ' + JSON.stringify(r));
r = J(ctx.loyaltyDoPost_('loyaltyRedeem', { token: 't', phone: PH, orderValue: 5000000, points: 10 })); ok(!r.ok && /Khong co diem/.test(r.error), 'hết điểm → báo lỗi');
ok(!J(ctx.loyaltyDoPost_('loyaltyRedeem', { token: 't', phone: '', orderValue: 1, points: 1 })).ok, 'thiếu SĐT');
// 4) đơn bị hoàn SAU khi đã tích → refund đúng điểm đơn đó (idempotent); hạng KHÔNG tụt
pos[2].trangThai = 'Hoàn đơn'; g = get();
const refunds = rowsOf('LoyaltyPoints').filter(x => x[2] === 'refund');
ok(refunds.length === 1 && refunds[0][5] === 30, 'refund 30 điểm đơn 3tr: ' + JSON.stringify(refunds));
ok(g.points.deficit === 30 && g.points.balance === 0, 'đã dùng hết rồi mới hoàn → thiếu hụt 30: ' + JSON.stringify(g.points));
get(); ok(rowsOf('LoyaltyPoints').filter(x => x[2] === 'refund').length === 1, 'refund không nhân đôi');
ok(g.tier === 'vip', 'hạng giữ trọn đời, không tụt khi hoàn');
// 5) đơn hoàn chưa từng tích → không tạo điểm
pos.push(o('11/03/2026', 4000000, 'Hủy đơn')); const n0 = rowsOf('LoyaltyPoints').length; get(); ok(rowsOf('LoyaltyPoints').length === n0, 'đơn hủy chưa tích → không có dòng');
// 6) quyền + tham số
tokenUser = null; ok(J(ctx.loyaltyDoGet_('loyaltyGet', { token: 'x', phone: PH })).code === 'AUTH', 'chưa đăng nhập GET');
ok(J(ctx.loyaltyDoPost_('loyaltyRedeem', { token: 'x', phone: PH, orderValue: 1000000, points: 5 })).code === 'AUTH', 'chưa đăng nhập POST');
tokenUser = { role: 'sale', username: 'hoa' }; ok(!J(ctx.loyaltyDoGet_('loyaltyGet', { token: 't', phone: '' })).ok, 'GET thiếu SĐT');
// 8) hoàn tác dùng điểm (chỉ admin, thêm dòng — không xoá; ghi AuditLog)
tokenUser = { role: 'sale', username: 'hoa' };
pos = [o('10/01/2026', 16000000), o('10/02/2026', 12000000)];
sheets.LoyaltyPoints.rows = [sheets.LoyaltyPoints.rows[0]]; sheets.LoyaltyTier.rows = [sheets.LoyaltyTier.rows[0]];
g = get(); ok(g.points.balance === 280, 'làm lại từ đầu 160+120: ' + g.points.balance);
r = J(ctx.loyaltyDoPost_('loyaltyRedeem', { token: 't', phone: PH, orderValue: 3000000, points: 50, refKey: 'U1' })); ok(r.ok && r.points.balance === 230, 'dùng 50');
const redeemKey = get().ledger.find(x => x.type === 'redeem').key;
ok(J(ctx.loyaltyDoPost_('loyaltyUndo', { token: 't', phone: PH, key: redeemKey })).code === 'FORBIDDEN', 'sale KHÔNG được hoàn tác');
tokenUser = { role: 'admin', username: 'duyen' };
ok(!J(ctx.loyaltyDoPost_('loyaltyUndo', { token: 't', phone: PH, key: 'khong|co' })).ok, 'key không tồn tại');
ok(!J(ctx.loyaltyDoPost_('loyaltyUndo', { token: 't', phone: PH, key: 'earn|' + rowsOf('LoyaltyPoints')[0][3] })).ok, 'không hoàn tác được dòng earn');
r = J(ctx.loyaltyDoPost_('loyaltyUndo', { token: 't', phone: PH, key: redeemKey }));
ok(r.ok && r.undone.points === 50 && r.points.balance === 280 && r.points.redeemed === 0, 'admin hoàn tác: ' + JSON.stringify(r));
ok(rowsOf('LoyaltyPoints').some(x => x[2] === 'redeem') && rowsOf('LoyaltyPoints').some(x => x[2] === 'undo'), 'dòng redeem cũ GIỮ NGUYÊN, thêm dòng undo');
g = get(); ok(g.ledger.find(x => x.type === 'redeem').undone === true && g.points.balance === 280, 'sổ đánh dấu đã hoàn tác');
ok(J(ctx.loyaltyDoPost_('loyaltyUndo', { token: 't', phone: PH, key: redeemKey })).code === 'DUPLICATE', 'hoàn tác lần 2 bị chặn');
ok(sheets.AuditLog && sheets.AuditLog.rows.some(x => x[2] === 'loyalty:undo' && x[1] === 'duyen' && String(x[4]).includes('50 diem')), 'ghi AuditLog loyalty:undo');
// 9) báo giá quyền lợi thẻ (9c-1): chỉ đọc; thẻ theo lịch sử POS + đơn CRM hợp lệ
let crmRows = []; ctx._crmReadAll_ = () => crmRows;
const quote = (phone, items) => J(ctx.loyaltyDoPost_('loyaltyBenefitQuote', { token: 't', phone, items }));
const Q = [{ name: 'Nhẫn bạc trơn', qty: 1, price: 1500000 }, { name: 'Charm 24k hoa sen', qty: 1, price: 500000 }];
const before = sheets.LoyaltyPoints.rows.length;
pos = []; let q = quote('0900000001', Q);
ok(q.ok && q.level === 'none' && q.discount === 0 && q.freeShip === false && q.history.orders === 0, 'khách mới (0 đơn): không thẻ: ' + JSON.stringify(q));
pos = [{ soDienThoai: '0900000002', ngayTaoDon: '10/01/2026', giaTriSauGiam: 2000000, trangThai: '' }];
q = quote('0900000002', Q); ok(q.level === 'vip' && q.discount === 75000 && q.freeShip === true && q.lines[1].rule === 'excluded', 'đã có 1 đơn POS → VIP: giảm 5% dòng thường, charm 24k không giảm, miễn ship: ' + JSON.stringify(q));
pos = [{ soDienThoai: '0900000003', ngayTaoDon: '10/01/2026', giaTriSauGiam: 2000000, trangThai: 'Hoàn đơn' }];
q = quote('0900000003', Q); ok(q.level === 'none', 'đơn POS đã hoàn không tính là đã mua');
pos = []; crmRows = [{ phone: '0900000004', status: 'Mới', total: 3000000 }];
ok(quote('0900000004', Q).level === 'none', 'đơn CRM mới (chưa xác nhận) chưa tính');
crmRows = [{ phone: '0900000004', status: 'Đã giao', total: 3000000 }];
ok(quote('0900000004', Q).level === 'vip', 'đơn CRM đã giao tính là đã mua');
crmRows = [{ phone: '0900000004', status: 'Hoàn', total: 3000000 }, { phone: '0900000004', status: 'Hủy', total: 3000000 }];
ok(quote('0900000004', Q).level === 'none', 'đơn CRM hoàn/hủy không tính');
pos = [{ soDienThoai: '0900000005', ngayTaoDon: '10/01/2026', giaTriSauGiam: 30000000, trangThai: '' }]; crmRows = [{ phone: '0900000005', status: 'Đang giao', total: 20000000 }];
q = quote('0900000005', Q); ok(q.level === 'super' && q.history.cumulative === 50000000 && q.discount === 150000 && q.lines[1].pct === 0, 'POS 30tr + CRM 20tr = 50tr → SUPER (10%): ' + JSON.stringify(q));
ok(!J(ctx.loyaltyDoPost_('loyaltyBenefitQuote', { token: 't', phone: '', items: Q })).ok && !J(ctx.loyaltyDoPost_('loyaltyBenefitQuote', { token: 't', phone: PH, items: [] })).ok, 'thiếu SĐT / đơn rỗng → lỗi');
tokenUser = null; ok(J(ctx.loyaltyDoPost_('loyaltyBenefitQuote', { token: 'x', phone: PH, items: Q })).code === 'AUTH', 'chưa đăng nhập → AUTH'); tokenUser = { role: 'sale', username: 'hoa' };
ok(sheets.LoyaltyPoints.rows.length === before, 'báo giá CHỈ ĐỌC: không ghi sổ điểm');
// 7) dispatch qua doGet/doPost
const viaGet = J(ctx.doGet({ parameter: { action: 'loyaltyGet', token: 't', phone: PH } })); ok(viaGet.ok && viaGet.phone, 'doGet có route loyaltyGet');
const viaPost = J(ctx.doPost({ postData: { contents: JSON.stringify({ action: 'loyaltyRedeem', token: 't', phone: PH, orderValue: 1000000, points: 5 }) } }));
ok(viaPost && (viaPost.ok === false || viaPost.ok === true) && viaPost.error !== 'Unknown action', 'doPost có route loyaltyRedeem: ' + JSON.stringify(viaPost));
console.log('ALL LOYALTY SHEET TESTS PASSED');

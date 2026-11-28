#!/usr/bin/env node
// Test ĐƠN CRM bước 4a (gas_v13.js): đổi trạng thái / huỷ đơn — đường đi hợp lệ, huỷ/hoàn bắt buộc lý do, quyền, bấm 2 lần, không đụng tiền/sheet khác.
// Chạy: node tools/test-crm-order-status.js -> "ALL CRM ORDER STATUS TESTS PASSED".
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
// 28/11: đơn CRM nay tự TÍCH điểm. File này chỉ kiểm phép tính DÙNG điểm/hoàn điểm nên tắt bước tích để các số dư giữ ổn định; tích điểm có test riêng: tools/test-crm-order-earn.js.
ctx._loyaltyCrmEarn_ = () => ({ points: 0 }); ctx._loyaltyCrmRevoke_ = () => ({ points: 0, earned: 0 });
const J = o => JSON.parse(o.getContent());
const rowsOf = n => (sheets[n] ? sheets[n].rows.slice(1) : []);
const save = (order, refKey) => J(ctx.crmOrderDoPost_('crmOrderSave', { token: 't', order, refKey }));
const list = (p) => J(ctx.crmOrderDoGet_('crmOrders', Object.assign({ token: 't' }, p || {})));
const base = { phone: '0943028399', custName: 'Đỗ hằng', source: 'Online', warehouse: 'KHO ONLINE', saleName: 'linhTT1997', tags: ['linhTT1997'], items: [{ code: 'DTTT-CT-TYPE B', name: 'DÂY TREO THÂN TÀI NGỌC CẨM THẠCH TYPE B', qty: 1, price: 990000, discType: 'pct', discValue: 10 }], shipFee: 40000, paid: 300000 };


const PH = '0943028399', bal = () => J(ctx.loyaltyDoGet_('loyaltyGet', { token: 't', phone: PH })).points.balance;
const rowsL = () => rowsOf('LoyaltyPoints');
const get = id => list().orders.find(o => o.orderId === id);
const st = (orderId, status, note) => J(ctx.crmOrderDoPost_('crmOrderStatus', { token: 't', orderId, status, note }));
const saveP = (pts, refKey, extra) => J(ctx.crmOrderDoPost_('crmOrderSave', { token: 't', refKey, pointsUse: pts, order: Object.assign({}, base, extra || {}) }));
tokenUser = { role: 'admin', username: 'boss' };
// khách có 160 điểm (đơn POS 16.000.000đ × 1% ÷ 1.000)
pos = [{ soDienThoai: PH, ngayTaoDon: '10/01/2026', giaTriSauGiam: 16000000 }];
ok(bal() === 160, 'khách có 160 điểm: ' + bal());
// 1) không dùng điểm: như cũ, 2 cột điểm = 0, KHÔNG đụng sổ điểm
let r = saveP(0, 'P0'); ok(r.ok && r.order.total === 931000 && r.order.pointsUsed === 0 && r.order.pointsDiscount === 0, 'không dùng điểm: ' + JSON.stringify(r.order).slice(0, 120));
ok(rowsL().filter(x => x[2] === 'redeem').length === 0 && bal() === 160, 'không dùng điểm thì không ghi sổ điểm');
// 2) dùng 100 điểm = 100.000đ trừ thẳng: 931.000 − 100.000 = 831.000; chuyển khoản 300.000 → còn thiếu 531.000
r = saveP(100, 'P1'); const A = r.order && r.order.orderId;
ok(r.ok && r.order.pointsUsed === 100 && r.order.pointsDiscount === 100000 && r.order.total === 831000 && r.order.due === 531000, 'dùng 100 điểm: ' + JSON.stringify(r).slice(0, 220));
ok(bal() === 60, 'số dư còn 60: ' + bal());
const red = rowsL().filter(x => x[2] === 'redeem'); ok(red.length === 1 && red[0][0] === 'redeem|' + PH + '|crm|' + A && Number(red[0][5]) === 100 && Number(red[0][6]) === 931000, 'sổ điểm: khoá theo mã đơn, giá trị đơn gốc 931.000: ' + JSON.stringify(red));
let g = get(A); ok(g.pointsUsed === 100 && g.pointsDiscount === 100000 && g.total === 831000, 'đọc lại đơn giữ số điểm/tiền giảm');
// 3) chống bấm Lưu 2 lần (cùng refKey) → trả đơn cũ, KHÔNG trừ điểm lần 2
r = saveP(100, 'P1'); ok(r.ok && r.duplicate === true && r.order.orderId === A && bal() === 60 && rowsL().filter(x => x[2] === 'redeem').length === 1, 'cùng refKey không trừ điểm lần 2');
// 4) quá mức: vượt số dư → TỪ CHỐI, không tạo đơn, không trừ điểm; báo mức tối đa
const nOrders = rowsOf('Đơn CRM').length;
r = saveP(61, 'P2'); ok(!r.ok && r.code === 'POINTS' && r.maxPoints === 60 && /toi da dung duoc 60/.test(r.error), 'vượt số dư: ' + JSON.stringify(r).slice(0, 200));
ok(rowsOf('Đơn CRM').length === nOrders && bal() === 60, 'bị từ chối thì không ghi đơn, không trừ điểm');
// vượt giá trị đơn ÷ 1.000: đơn 50.000đ chỉ dùng được tối đa 50 điểm
r = saveP(60, 'P3', { items: [{ name: 'Nhỏ', qty: 1, price: 50000 }], shipFee: 0, paid: 0 }); ok(!r.ok && r.maxPoints === 50, 'vượt giá trị đơn ÷ 1.000: ' + JSON.stringify(r).slice(0, 160));
r = saveP(50, 'P3b', { items: [{ name: 'Nhỏ', qty: 1, price: 50000 }], shipFee: 0, paid: 0 }); ok(r.ok && r.order.total === 0 && r.order.due === 0 && r.order.pointsDiscount === 50000 && bal() === 10, 'dùng hết giá trị đơn → 0đ: ' + JSON.stringify(r.order).slice(0, 160));
// client không ép được số điểm/tiền giảm bằng cách gửi sẵn trong order
r = saveP(0, 'P4', { pointsUsed: 999, pointsDiscount: 999999 }); ok(r.ok && r.order.pointsUsed === 0 && r.order.pointsDiscount === 0 && r.order.total === 931000, 'bỏ qua pointsUsed/pointsDiscount client gửi trong order');
// SĐT khác không có điểm
r = saveP(10, 'P5', { phone: '0900000009' }); ok(!r.ok && r.code === 'POINTS' && r.maxPoints === 0, 'khách không có điểm bị từ chối');
// 5) Hủy đơn A (đã dùng 100 điểm) → hoàn đúng 100 điểm, trạng thái đổi, dòng undo trong sổ
r = st(A, 'Hủy', 'Khách đổi ý'); ok(r.ok && r.order.status === 'Hủy' && r.pointsRefunded === 100, 'hủy hoàn 100 điểm: ' + JSON.stringify(r).slice(0, 160));
ok(bal() === 110, 'số dư 10 + 100 = 110: ' + bal());
ok(rowsL().filter(x => x[2] === 'undo' && x[0] === 'undo|redeem|' + PH + '|crm|' + A).length === 1, 'có đúng 1 dòng undo');
r = st(A, 'Hủy', 'bấm lại'); ok(r.ok && r.unchanged === true && bal() === 110, 'bấm hủy lần 2 không hoàn thêm');
// 6) Hoàn đơn đã giao cũng hoàn điểm; đơn không dùng điểm Hủy thì không đụng sổ
r = saveP(60, 'P6'); const B = r.order.orderId; ok(r.ok && bal() === 50, 'đơn B dùng 60 điểm: ' + bal());
['Đã xác nhận', 'Đang giao', 'Đã giao'].forEach(s => ok(st(B, s).ok, 'B → ' + s));
ok(bal() === 50, 'đơn đã giao không hoàn điểm');
r = st(B, 'Hoàn', 'Khách trả'); ok(r.ok && r.pointsRefunded === 60 && bal() === 110, 'Hoàn đơn đã giao hoàn 60 điểm: ' + JSON.stringify(r).slice(0, 120));
const C0 = saveP(0, 'P7').order.orderId, nU = rowsL().filter(x => x[2] === 'undo').length; r = st(C0, 'Hủy', 'x'); ok(r.ok && r.pointsRefunded === 0 && rowsL().filter(x => x[2] === 'undo').length === nU, 'đơn không dùng điểm: hủy không đụng sổ điểm');
// 7) admin đã hoàn tác tay (loyaltyUndo) trước khi Hủy → Hủy vẫn thành công, không hoàn 2 lần
r = saveP(50, 'P8'); const D = r.order.orderId; ok(r.ok && bal() === 60, 'đơn D dùng 50: ' + bal());
ok(J(ctx.loyaltyDoPost_('loyaltyUndo', { token: 't', phone: PH, key: 'redeem|' + PH + '|crm|' + D })).ok && bal() === 110, 'admin hoàn tác tay');
r = st(D, 'Hủy', 'sau khi admin hoàn tác'); ok(r.ok && r.order.status === 'Hủy' && r.pointsRefunded === 0 && bal() === 110, 'Hủy sau hoàn tác tay: không hoàn lần 2: ' + JSON.stringify(r).slice(0, 140));
// 8) ghi đơn lỗi sau khi đã trừ điểm → điểm được hoàn lại, không mất
const shO = sheets['Đơn CRM'], origGR = shO.getRange; let boom = false;
shO.getRange = function (r, c, nr, nc) { const x = origGR.call(this, r, c, nr, nc); if (boom && nc === 45) return Object.assign({}, x, { setValues() { throw new Error('sheet loi'); } }); return x; };
const before = bal(); boom = true; r = saveP(40, 'P9'); boom = false;
ok(!r.ok && /sheet loi/.test(r.error) && bal() === before, 'ghi đơn lỗi → điểm hoàn lại: ' + JSON.stringify(r).slice(0, 140) + ' bal=' + bal());
shO.getRange = origGR;
// 9) Hủy mà hoàn điểm lỗi thật → dừng, trạng thái giữ nguyên
r = saveP(30, 'P10'); const E = r.order.orderId; const origU = ctx._loyaltyUndoApply_; ctx._loyaltyUndoApply_ = () => ({ ok: false, error: 'hong' });
r = st(E, 'Hủy', 'x'); ctx._loyaltyUndoApply_ = origU; ok(!r.ok && /Khong hoan duoc diem/.test(r.error) && get(E).status === 'Mới', 'hoàn điểm lỗi thì không đổi trạng thái: ' + JSON.stringify(r).slice(0, 140));
ok(st(E, 'Hủy', 'thử lại').ok && get(E).status === 'Hủy', 'thử lại thành công');
// 10) nút admin cũ vẫn chỉ admin; sale không hoàn tác tay được
tokenUser = { role: 'sale', username: 'hoa' }; ok(J(ctx.loyaltyDoPost_('loyaltyUndo', { token: 't', phone: PH, key: 'x' })).code === 'FORBIDDEN', 'loyaltyUndo vẫn chỉ admin');
console.log('ALL CRM ORDER POINTS TESTS PASSED');

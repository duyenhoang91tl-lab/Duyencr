#!/usr/bin/env node
// Test ĐƠN CRM (gas_v13.js, bước 1 backend): tính tiền đúng số liệu clip Pancake POS, kiểm dữ liệu, ghi sheet RIÊNG "Đơn CRM" (không đụng DT Tổng), chống bấm Lưu 2 lần, quyền xem.
// Chạy: node tools/test-crm-order.js -> "ALL CRM ORDER TESTS PASSED".
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
const J = o => JSON.parse(o.getContent());
const rowsOf = n => (sheets[n] ? sheets[n].rows.slice(1) : []);
const save = (order, refKey) => J(ctx.crmOrderDoPost_('crmOrderSave', { token: 't', order, refKey }));
const list = (p) => J(ctx.crmOrderDoGet_('crmOrders', Object.assign({ token: 't' }, p || {})));
const base = { phone: '0943028399', custName: 'Đỗ hằng', source: 'Online', warehouse: 'KHO ONLINE', saleName: 'linhTT1997', tags: ['linhTT1997'], items: [{ code: 'DTTT-CT-TYPE B', name: 'DÂY TREO THÂN TÀI NGỌC CẨM THẠCH TYPE B', qty: 1, price: 990000, discType: 'pct', discValue: 10 }], shipFee: 40000, paid: 300000 };

// 1) số liệu ĐÚNG CLIP đơn #M49143: 990.000 − KM 10% (99.000) + ship 40.000 = 931.000; chuyển khoản 300.000 → còn thiếu 631.000
let n = ctx._crmOrderNormalize_(base).order;
ok(n.gross === 990000 && n.itemDiscount === 99000 && n.shipFee === 40000 && n.total === 931000 && n.paid === 300000 && n.due === 631000, 'số tiền clip M49143: ' + JSON.stringify(n));
// 1b) số liệu ĐÚNG CLIP đơn mới (TTTL-CX 1.250.000 + ship 40.000 = 1.290.000, chưa thanh toán → còn thiếu 1.290.000)
n = ctx._crmOrderNormalize_({ phone: '0912345678', items: [{ code: 'TTTL-CX', name: 'TÚI TIỀN TỤ LỘC CANXIT', qty: 1, price: 1250000 }], shipFee: 40000 }).order;
ok(n.total === 1290000 && n.due === 1290000 && n.itemDiscount === 0, 'đơn 1.250.000 + ship: ' + JSON.stringify(n));

// 2) giảm giá: dòng theo %, đơn theo đ, không vượt giá trị; miễn phí giao hàng; phụ thu; SL nhiều
n = ctx._crmOrderNormalize_({ phone: '0912345678', items: [{ name: 'A', qty: 3, price: 100000, discType: 'amt', discValue: 50000 }, { name: 'B', qty: 1, price: 200000, discType: 'pct', discValue: 150 }], discType: 'amt', discValue: 1e9, freeShip: true, shipFee: 40000, surcharge: 15000 }).order;
ok(n.gross === 500000 && n.itemDiscount === 250000 && n.orderDiscount === 250000 && n.shipFee === 0 && n.surcharge === 15000 && n.total === 15000 && n.qty === 4 && n.itemCount === 2, 'giảm giá bị chặn ở giá trị / % tối đa 100: ' + JSON.stringify(n));
n = ctx._crmOrderNormalize_({ phone: '0912345678', items: [{ name: 'A', qty: 1, price: 100000 }], paid: 999999999 }).order; ok(n.due === 0, 'trả dư → còn thiếu 0');
// SĐT chuẩn hoá (+84), người nhận mặc định = SĐT khách
n = ctx._crmOrderNormalize_({ phone: '+84 912 345 678', items: [{ name: 'A', qty: 1, price: 1 }] }).order; ok(n.phone === '0912345678' && n.recvPhone === '0912345678', 'chuẩn hoá SĐT: ' + n.phone);

// 3) từ chối dữ liệu sai
const bad = o => ctx._crmOrderNormalize_(o).error;
ok(/so dien thoai/.test(bad({ items: [{ name: 'A', qty: 1, price: 1 }] })), 'thiếu SĐT');
ok(/chua co san pham/.test(bad({ phone: '0912345678', items: [] })), 'không có sản phẩm');
ok(/so luong/.test(bad({ phone: '0912345678', items: [{ name: 'A', qty: 0, price: 1 }] })), 'SL = 0');
ok(/thieu ten/.test(bad({ phone: '0912345678', items: [{ qty: 1, price: 1 }] })), 'thiếu tên/mã');
ok(/am/.test(bad({ phone: '0912345678', items: [{ name: 'A', qty: 1, price: -5 }] })), 'giá âm');
ok(/qua nhieu/.test(bad({ phone: '0912345678', items: Array.from({ length: 61 }, () => ({ name: 'A', qty: 1, price: 1 })) })), '> 60 dòng');

// 4) lưu: sheet RIÊNG 'Đơn CRM', KHÔNG đụng DT Tổng/OrderData; client không ép được tổng tiền
let r = save(Object.assign({}, base, { total: 1, due: 1, gross: 1 }), 'K1');
ok(r.ok && r.duplicate === false && /^CRM\d{6}-0001$/.test(r.order.orderId) && r.order.total === 931000 && r.order.status === 'Mới' && r.order.createdBy === 'hoa', 'lưu đơn + server tự tính tiền: ' + JSON.stringify(r));
ok(Object.keys(sheets).join('|') === 'Đơn CRM', 'chỉ tạo sheet "Đơn CRM", không đụng sheet khác: ' + Object.keys(sheets));
ok(rowsOf('Đơn CRM').length === 1 && String(rowsOf('Đơn CRM')[0][13]) === '0943028399', 'đúng 1 dòng, SĐT giữ số 0');
// 5) chống bấm Lưu 2 lần (cùng refKey) → trả đơn cũ, KHÔNG thêm dòng; refKey khác → đơn mới số thứ tự tiếp
r = save(base, 'K1'); ok(r.ok && r.duplicate === true && r.order.orderId.endsWith('-0001') && rowsOf('Đơn CRM').length === 1, 'cùng refKey không tạo đơn 2: ' + JSON.stringify(r).slice(0, 150));
r = save(base, 'K2'); ok(r.ok && r.order.orderId.endsWith('-0002') && rowsOf('Đơn CRM').length === 2, 'mã đơn tăng dần: ' + r.order.orderId);
r = save(base); r = save(base); ok(rowsOf('Đơn CRM').length === 4, 'không refKey → mỗi lần 1 đơn');
// 6) đọc lại: items nguyên vẹn (JSON), số là số; lọc theo SĐT; quyền
let g = list(); ok(g.ok && g.total === 4 && g.orders[0].items[0].name.indexOf('NGỌC CẨM THẠCH') > 0 && g.orders[0].total === 931000 && g.orders[0].items[0].discount === 99000, 'đọc lại đơn: ' + JSON.stringify(g).slice(0, 200));
save({ phone: '0912345678', items: [{ name: 'X', qty: 2, price: 5000 }] }, 'K9');
ok(list({ phone: '0912345678' }).total === 1 && list({ phone: '0943028399' }).total === 4, 'lọc theo SĐT');
tokenUser = { role: 'sale', username: 'an' }; ok(list().total === 0, 'tài khoản khác chỉ thấy đơn của mình');
save({ phone: '0900000001', items: [{ name: 'Y', qty: 1, price: 1000 }] }, 'K10'); ok(list().total === 1, 'sale an thấy đơn của an');
tokenUser = { role: 'admin', username: 'boss' }; ok(list().total === 6, 'admin xem tất cả: ' + list().total);
ok(list({ from: '2099-01-01' }).total === 0 && list({ to: '2000-01-01' }).total === 0 && list({ limit: 2 }).orders.length === 2, 'lọc ngày + limit');
tokenUser = null; ok(J(ctx.crmOrderDoPost_('crmOrderSave', { token: 'x', order: base })).code === 'AUTH' && J(ctx.crmOrderDoGet_('crmOrders', { token: 'x' })).code === 'AUTH', 'chưa đăng nhập bị chặn');
ok(rowsOf('Đơn CRM').length === 6, 'đơn bị chặn không ghi sheet');
// 7) saveOrders (DT Tổng) vẫn TẮT, không bị mở lại
ok(/ngung ho tro/.test(J(ctx.saveOrders_([{}])).error), 'saveOrders vẫn tắt');
// 8) dispatch qua doGet/doPost
tokenUser = { role: 'sale', username: 'hoa' };
ctx._sessUser_ = () => tokenUser;
const viaPost = J(ctx.doPost({ postData: { contents: JSON.stringify({ action: 'crmOrderSave', token: 't', order: base, refKey: 'K50' }) }, parameter: {} }));
ok(viaPost.ok && viaPost.order.orderId, 'doPost điều hướng crmOrderSave: ' + JSON.stringify(viaPost).slice(0, 120));
const viaGet = J(ctx.doGet({ parameter: { action: 'crmOrders', token: 't' } }));
ok(viaGet.ok && viaGet.total >= 1, 'doGet điều hướng crmOrders');
console.log('ALL CRM ORDER TESTS PASSED');

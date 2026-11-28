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
const J = o => JSON.parse(o.getContent());
const rowsOf = n => (sheets[n] ? sheets[n].rows.slice(1) : []);
const save = (order, refKey) => J(ctx.crmOrderDoPost_('crmOrderSave', { token: 't', order, refKey }));
const list = (p) => J(ctx.crmOrderDoGet_('crmOrders', Object.assign({ token: 't' }, p || {})));
const base = { phone: '0943028399', custName: 'Đỗ hằng', source: 'Online', warehouse: 'KHO ONLINE', saleName: 'linhTT1997', tags: ['linhTT1997'], items: [{ code: 'DTTT-CT-TYPE B', name: 'DÂY TREO THÂN TÀI NGỌC CẨM THẠCH TYPE B', qty: 1, price: 990000, discType: 'pct', discValue: 10 }], shipFee: 40000, paid: 300000 };


const st = (orderId, status, note) => J(ctx.crmOrderDoPost_('crmOrderStatus', { token: 't', orderId, status, note }));
const get = id => list().orders.find(o => o.orderId === id);
tokenUser = { role: 'sale', username: 'hoa' };
const A = save(base, 'S1').order.orderId, B = save(base, 'S2').order.orderId, C = save(base, 'S3').order.orderId;
// 1) hàm thuần: bảng chuyển trạng thái
ok(ctx._crmStatusCheck_('Mới', 'Đã xác nhận', '') === '', 'Mới → Đã xác nhận được');
ok(/Khong the/.test(ctx._crmStatusCheck_('Mới', 'Đã giao', '')), 'không nhảy cóc Mới → Đã giao');
ok(/ly do/.test(ctx._crmStatusCheck_('Mới', 'Hủy', '  ')), 'Hủy thiếu lý do bị chặn');
ok(ctx._crmStatusCheck_('Đã giao', 'Hoàn', 'khách trả') === '' && /Khong the/.test(ctx._crmStatusCheck_('Đã giao', 'Hủy', 'x')), 'đã giao chỉ Hoàn, không Hủy');
ok(/Khong the/.test(ctx._crmStatusCheck_('Hủy', 'Mới', '')) && /Khong the/.test(ctx._crmStatusCheck_('Hoàn', 'Đã giao', '')), 'Hủy/Hoàn là trạng thái cuối');
ok(/khong hop le/.test(ctx._crmStatusCheck_('Mới', 'Bay màu', '')), 'trạng thái lạ bị từ chối');
ok(ctx._crmStatusCheck_('', 'Đã xác nhận', '') === '', 'trạng thái rỗng coi như Mới');
// 2) luồng đầy đủ A: Mới → Đã xác nhận → Đang giao → Đã giao → Hoàn; ghi người/giờ/lý do; tiền KHÔNG đổi
const total0 = get(A).total;
let r = st(A, 'Đã xác nhận'); ok(r.ok && r.order.status === 'Đã xác nhận' && r.order.statusBy === 'hoa' && r.order.statusAt > 0, 'xác nhận: ' + JSON.stringify(r).slice(0, 150));
ok(!st(A, 'Đã giao').ok, 'không cho nhảy cóc');
ok(get(A).status === 'Đã xác nhận', 'nhảy cóc bị từ chối thì trạng thái giữ nguyên');
ok(st(A, 'Đang giao').ok && st(A, 'Đã giao').ok, 'Đang giao → Đã giao');
r = st(A, 'Hoàn'); ok(!r.ok && /ly do/.test(r.error), 'Hoàn thiếu lý do');
r = st(A, 'Hoàn', 'Khách trả vì sai size'); ok(r.ok && r.order.statusNote === 'Khách trả vì sai size', 'Hoàn có lý do');
ok(!st(A, 'Mới').ok && !st(A, 'Đã giao').ok, 'Hoàn là cuối, không mở lại');
let g = get(A); ok(g.status === 'Hoàn' && g.statusNote === 'Khách trả vì sai size' && g.total === total0 && g.items.length === 1, 'đọc lại: trạng thái + lý do, tiền/sản phẩm nguyên vẹn: ' + JSON.stringify(g).slice(0, 200));
// 3) huỷ đơn mới; bấm lần 2 cùng trạng thái không lỗi, không ghi lại
r = st(B, 'Hủy', 'Khách đổi ý'); ok(r.ok && r.order.status === 'Hủy', 'huỷ đơn Mới');
const at = get(B).statusAt; r = st(B, 'Hủy', 'bấm lại'); ok(r.ok && r.unchanged === true && get(B).statusAt === at && get(B).statusNote === 'Khách đổi ý', 'bấm huỷ lần 2 không ghi đè lý do');
// 4) quyền: sale khác không đổi được đơn của hoa; admin đổi được
tokenUser = { role: 'sale', username: 'an' }; r = st(C, 'Đã xác nhận'); ok(!r.ok && /do minh tao/.test(r.error) && get(C) === undefined, 'sale khác bị chặn');
tokenUser = { role: 'admin', username: 'boss' }; r = st(C, 'Đã xác nhận'); ok(r.ok && get(C).status === 'Đã xác nhận' && get(C).statusBy === 'boss', 'admin đổi được đơn của người khác');
// 5) đầu vào xấu
ok(!st('', 'Hủy', 'x').ok && /ma don/.test(st('', 'Hủy', 'x').error), 'thiếu mã đơn');
ok(!st('CRM999999-0001', 'Hủy', 'x').ok && /Khong tim thay/.test(st('CRM999999-0001', 'Hủy', 'x').error), 'mã đơn không tồn tại');
tokenUser = null; ok(st(A, 'Hủy', 'x').code === 'AUTH', 'chưa đăng nhập bị chặn');
// 6) chỉ đúng sheet "Đơn CRM" bị đụng; số dòng không đổi; đơn cũ thiếu 3 cột cuối (sheet tạo trước bước 4a) vẫn đổi được
ok(Object.keys(sheets).join('|') === 'Đơn CRM' && rowsOf('Đơn CRM').length === 3, 'không tạo sheet khác, không thêm dòng');
tokenUser = { role: 'admin', username: 'boss' };
sheets['Đơn CRM'].rows.forEach((row, i) => { if (i > 0) row.length = 39; });   // mô phỏng sheet cũ 39 cột
ok(list().ok && st(B, 'Hủy').unchanged === true, 'đọc sheet cũ 39 cột không lỗi');
const D = save(base, 'S4').order.orderId; sheets['Đơn CRM'].rows[sheets['Đơn CRM'].rows.length - 1].length = 39;
ok(st(D, 'Đã xác nhận').ok && get(D).status === 'Đã xác nhận', 'đổi trạng thái được trên dòng cũ thiếu cột');
// 7) điều hướng doPost
tokenUser = { role: 'admin', username: 'boss' }; ctx._sessUser_ = () => tokenUser;
const E = save(base, 'S5').order.orderId;
const viaPost = J(ctx.doPost({ postData: { contents: JSON.stringify({ action: 'crmOrderStatus', token: 't', orderId: E, status: 'Hủy', note: 'test' }) }, parameter: {} }));
ok(viaPost.ok && viaPost.order.status === 'Hủy', 'doPost điều hướng crmOrderStatus: ' + JSON.stringify(viaPost).slice(0, 120));
console.log('ALL CRM ORDER STATUS TESTS PASSED');

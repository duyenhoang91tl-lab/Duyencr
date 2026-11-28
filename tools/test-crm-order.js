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

// 2b) thuế % do người lên đơn TỰ ĐIỀN: thuế dòng = làm tròn((SL×giá − giảm giá dòng) × thuế%) và CỘNG vào tiền cần thu; mặc định 0; chặn 0–100
n = ctx._crmOrderNormalize_({ phone: '0912345678', items: [{ name: 'A', qty: 2, price: 500000, discType: 'pct', discValue: 10, taxPct: 8 }, { name: 'B', qty: 1, price: 100000 }], shipFee: 30000 }).order;
ok(n.items[0].tax === 72000 && n.items[1].tax === 0 && n.tax === 72000 && n.total === 1000000 - 100000 + 100000 + 72000 + 30000 && n.due === n.total, 'thuế 8% trên 900.000 = 72.000 cộng vào tổng: ' + JSON.stringify([n.tax, n.total]));
n = ctx._crmOrderNormalize_({ phone: '0912345678', items: [{ name: 'A', qty: 1, price: 1000, taxPct: 999 }, { name: 'B', qty: 1, price: 1000, taxPct: -5 }] }).order;
ok(n.items[0].taxPct === 100 && n.items[0].tax === 1000 && n.items[1].taxPct === 0 && n.total === 3000, 'thuế bị chặn 0–100: ' + JSON.stringify([n.items[0].taxPct, n.items[1].taxPct, n.total]));

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
// 28/11: đơn CRM nay TÍCH ĐIỂM → ngoài "Đơn CRM" chỉ thêm sổ "LoyaltyPoints" (xem test-crm-order-earn.js); KHÔNG sheet nào khác (kho/DT/Pos...).
ok(Object.keys(sheets).join('|') === 'Đơn CRM|LoyaltyPoints', 'chỉ có sheet "Đơn CRM" + sổ điểm "LoyaltyPoints", không đụng sheet khác: ' + Object.keys(sheets));
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

// 9) QUYỀN XEM theo cấp bậc: admin/CEO = tất cả | Trưởng phòng = các phòng được giao | Trưởng team = team mình | nhân viên = của mình
const U = (username, name, role, team) => ({ username, name, names: [name], role, team: team || '', active: true });
const users = [U('boss', 'Boss', 'admin'), U('ceo1', 'Giám Đốc', 'ceo'), U('tp1', 'Trưởng Phòng 1', 'tp', 'phong1'), U('truonga', 'Trưởng A', 'leader', 'Team A'),
  U('mai', 'Mai', 'cs'), U('nam', 'Nam', 'cs'), U('truongb', 'Trưởng B', 'leader', 'Team B'), U('binh', 'Bình', 'cs')];
ctx.readUsers_ = () => users;
ctx.readTeams_ = () => [{ id: 'a', name: 'Team A', leader: 'Trưởng A', members: ['Mai', 'Nam'] }, { id: 'b', name: 'Team B', leader: 'Trưởng B', members: ['Bình'] }];
ctx.readSaleDepts_ = () => ({ raw: { 'Trưởng A': 'phong1', 'Mai': 'phong1', 'Nam': 'phong1', 'Trưởng B': 'phong2', 'Bình': 'phong2' }, byNorm: {} });
const mk = (code) => ({ phone: '0977000' + code, items: [{ name: 'SP' + code, qty: 1, price: 1000 }] });
const as = (u) => { tokenUser = users.find(x => x.username === u); };
['mai', 'nam', 'binh', 'truonga', 'truongb'].forEach((u, i) => { as(u); ok(save(mk('10' + i), 'S' + u).ok, 'tạo đơn bởi ' + u); });
as('boss'); ok(save(Object.assign(mk('200'), { saleName: 'Mai' }), 'Sboss').order.saleName === 'Mai', 'admin lên đơn hộ Sale Mai');
as('mai'); ok(save(mk('201'), 'Smai2').order.saleName === 'Mai', 'saleName mặc định = tên người tạo');
const mine = (u) => { as(u); const g = list({ limit: 500 }); return { scope: g.scope, phones: g.orders.map(o => o.phone).filter(p => p.indexOf('0977000') === 0).sort().join(',') }; };
const ph = (c) => '0977000' + c;
let m = mine('mai'); ok(m.scope === 'own' && m.phones === [ph('100'), ph('200'), ph('201')].sort().join(','), 'nhân viên Mai thấy đơn mình tạo + đơn Sale=Mai: ' + JSON.stringify(m));
m = mine('nam'); ok(m.scope === 'own' && m.phones === ph('101'), 'nhân viên Nam chỉ thấy đơn mình: ' + JSON.stringify(m));
m = mine('truonga'); ok(m.scope === 'team' && m.phones === [ph('100'), ph('101'), ph('103'), ph('200'), ph('201')].sort().join(','), 'Trưởng team A thấy Mai + Nam + mình + đơn Sale=Mai, KHÔNG thấy team B: ' + JSON.stringify(m));
m = mine('truongb'); ok(m.scope === 'team' && m.phones === [ph('102'), ph('104')].sort().join(','), 'Trưởng team B chỉ thấy team B: ' + JSON.stringify(m));
m = mine('tp1'); ok(m.scope === 'dept' && m.phones === [ph('100'), ph('101'), ph('103'), ph('200'), ph('201')].sort().join(','), 'Trưởng phòng 1 thấy cả phòng 1 (team A), không thấy phòng 2: ' + JSON.stringify(m));
m = mine('ceo1'); ok(m.scope === 'all' && m.phones.split(',').length === 7, 'CEO (viewer) thấy tất cả: ' + JSON.stringify(m));
m = mine('boss'); ok(m.scope === 'all' && m.phones.split(',').length === 7, 'admin thấy tất cả');
// vai trò lạ / chưa gán phòng → mặc định CHỈ đơn của mình (không lộ dữ liệu)
tokenUser = U('stranger', 'Người Lạ', 'vaitrolalam'); ok(list().total === 0, 'vai trò lạ chỉ thấy của mình (hiện chưa có đơn)');
tokenUser = Object.assign(U('tp2', 'Trưởng Phòng 2', 'tp', ''), {}); ok(list().total === 0, 'Trưởng phòng chưa được giao phòng nào → chỉ đơn của mình');
tokenUser = U('tp3', 'TP3', 'tp', 'phong2'); const rsv = ctx.readUsers_; ctx.readUsers_ = () => users.concat([tokenUser]);
m = list({ limit: 500 }); ok(m.scope === 'dept' && m.orders.map(o => o.phone).sort().join(',') === [ph('102'), ph('104')].sort().join(','), 'Trưởng phòng 2 chỉ thấy phòng 2: ' + JSON.stringify(m.orders.map(o => o.phone)));
ctx.readUsers_ = rsv;
console.log('ALL CRM ORDER TESTS PASSED');

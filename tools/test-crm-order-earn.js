#!/usr/bin/env node
// Test ĐIỂM TÍCH của ĐƠN CRM (gas_v13.js, Duyên 28/11): đơn CRM tích điểm khi tạo; hết hạn 31/12 năm tạo; Hủy/Hoàn trừ lại điểm đã tích, KHÔNG ÂM.
// Chạy: node tools/test-crm-order-earn.js -> "ALL CRM ORDER EARN TESTS PASSED".
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
const rowsOf = n => (sheets[n] ? sheets[n].rows.slice(1) : []);
const save = (order, refKey) => J(ctx.crmOrderDoPost_('crmOrderSave', { token: 't', order, refKey }));
const list = (p) => J(ctx.crmOrderDoGet_('crmOrders', Object.assign({ token: 't' }, p || {})));
const base = { phone: '0943028399', custName: 'Đỗ hằng', source: 'Online', warehouse: 'KHO ONLINE', saleName: 'linhTT1997', tags: ['linhTT1997'], items: [{ code: 'DTTT-CT-TYPE B', name: 'DÂY TREO THÂN TÀI NGỌC CẨM THẠCH TYPE B', qty: 1, price: 990000, discType: 'pct', discValue: 10 }], shipFee: 40000, paid: 300000 };

const T = () => ctx._vnYmd_(new Date()), YEAR = Number(T().slice(0, 4));
const ddmmyyyy = () => { const t = T(); return t.slice(8, 10) + '/' + t.slice(5, 7) + '/' + t.slice(0, 4); };
const L = ph => rowsOf('LoyaltyPoints').filter(x => String(x[1]) === ph);
const bal = ph => J(ctx.loyaltyDoGet_('loyaltyGet', { token: 't', phone: ph })).points;
const st = (orderId, status, note) => J(ctx.crmOrderDoPost_('crmOrderStatus', { token: 't', orderId, status, note }));
const saveP = (ph, pts, refKey, extra) => J(ctx.crmOrderDoPost_('crmOrderSave', { token: 't', refKey, pointsUse: pts, order: Object.assign({}, base, { phone: ph }, extra || {}) }));
const small = n => ({ items: [{ name: 'Nhỏ', qty: 1, price: n }], shipFee: 0, paid: 0, freeShip: false, discValue: 0 });
tokenUser = { role: 'admin', username: 'boss' };

// 1) đơn CRM tích điểm: 931.000 (đơn mẫu, có ship, CK 300.000 không ảnh hưởng) × 1% ÷ 1.000 = 9 điểm; sổ ghi ngày tạo đơn
const P1 = '0911000001';
let r = saveP(P1, 0, 'E1'); const A = r.order.orderId;
ok(r.ok && r.order.total === 931000 && r.pointsEarned === 9 && r.pointsExpireOn === YEAR + '-12-31' && !r.pointsEarnError, 'tạo đơn 931.000 → tích 9 điểm, hết hạn 31/12/' + YEAR + ': ' + JSON.stringify(r).slice(0, 180));
let rows = L(P1); ok(rows.length === 1 && rows[0][0] === 'earn|crm|' + A && rows[0][2] === 'earn' && rows[0][3] === 'crm|' + A && rows[0][4] === T() && Number(rows[0][5]) === 9 && Number(rows[0][6]) === 931000, 'sổ điểm: 1 dòng earn khoá earn|crm|<mã đơn>, ngày tạo, 9 điểm, đơn 931.000: ' + JSON.stringify(rows[0]));
ok(bal(P1).balance === 9 && bal(P1).expiresOn === YEAR + '-12-31', 'số dư 9 điểm, hạn dùng 31/12/' + YEAR);
// bấm Lưu lại cùng refKey → trả đơn cũ, KHÔNG tích lần 2
r = saveP(P1, 0, 'E1'); ok(r.ok && r.duplicate === true && r.pointsEarned === 9 && L(P1).length === 1 && bal(P1).balance === 9, 'cùng refKey không tích lần 2');
// 2) tích TÍNH SAU KHI TRỪ ĐIỂM: khách có 160 điểm (POS) dùng 100 điểm → tổng 831.000 → tích 8 (không phải 9)
const P2 = '0911000002'; pos = [{ soDienThoai: P2, ngayTaoDon: ddmmyyyy(), giaTriSauGiam: 16000000 }];
ok(bal(P2).balance === 160, 'khách có 160 điểm từ POS: ' + bal(P2).balance);
r = saveP(P2, 100, 'E2'); const B = r.order.orderId;
ok(r.ok && r.order.total === 831000 && r.order.pointsUsed === 100 && r.pointsEarned === 8, 'dùng 100 điểm → cần thu 831.000 → tích 8: ' + JSON.stringify(r).slice(0, 200));
ok(bal(P2).balance === 160 - 100 + 8, 'số dư = 160 − 100 + 8 = 68: ' + bal(P2).balance);
// điểm tích từ đơn trước DÙNG ĐƯỢC ở đơn sau (cùng năm)
const P3 = '0911000003'; r = saveP(P3, 0, 'E3a'); ok(r.pointsEarned === 9 && bal(P3).balance === 9, 'đơn 1 tích 9');
r = saveP(P3, 9, 'E3b', small(50000)); ok(r.ok && r.order.pointsUsed === 9 && r.order.total === 41000 && r.pointsEarned === 0, 'đơn 2 dùng 9 điểm tích từ đơn 1: 50.000 − 9.000 = 41.000 (tích 0 vì 410 đ < 1 điểm): ' + JSON.stringify(r).slice(0, 160));
ok(bal(P3).balance === 0, 'dùng hết còn 0');
// 3) HẾT HẠN: sang năm sau quỹ năm này không còn
const led = L(P1).map(x => ({ type: String(x[2]), key: String(x[0]), orderId: String(x[3]), date: String(x[4]), points: Number(x[5]) }));
let nx = ctx._loyaltyBalance_(led, (YEAR + 1) + '-01-02'); ok(nx.balance === 0 && nx.expired === 9, 'đầu năm sau: số dư 0, hết hạn 9 điểm: ' + JSON.stringify(nx));
nx = ctx._loyaltyBalance_(led, YEAR + '-12-31'); ok(nx.balance === 9, 'ngày 31/12 vẫn còn dùng được');
// 4) HỦY đơn → trừ lại đúng điểm đã tích
r = st(A, 'Hủy', 'Khách đổi ý'); ok(r.ok && r.order.status === 'Hủy' && r.pointsRevoked === 9 && r.pointsRevokeCapped === false, 'hủy đơn A trừ lại 9 điểm: ' + JSON.stringify(r).slice(0, 200));
ok(bal(P1).balance === 0, 'số dư về 0 (không âm): ' + JSON.stringify(bal(P1)));
rows = L(P1).filter(x => x[2] === 'refund'); ok(rows.length === 1 && rows[0][0] === 'refund|crm|' + A && Number(rows[0][5]) === 9, 'sổ có đúng 1 dòng refund|crm|<mã đơn> 9 điểm');
r = st(A, 'Hủy', 'bấm lại'); ok(r.ok && r.unchanged === true && L(P1).filter(x => x[2] === 'refund').length === 1, 'bấm hủy lần 2 không trừ thêm');
// 5) HOÀN đơn đã giao cũng trừ
const P4 = '0911000004'; r = saveP(P4, 0, 'E4'); const C = r.order.orderId; ok(bal(P4).balance === 9, 'đơn C tích 9');
['Đã xác nhận', 'Đang giao', 'Đã giao'].forEach(s => ok(st(C, s).ok && bal(P4).balance === 9, 'C → ' + s + ' giữ nguyên điểm'));
r = st(C, 'Hoàn', 'Khách trả hàng'); ok(r.ok && r.pointsRevoked === 9 && bal(P4).balance === 0, 'Hoàn đơn đã giao trừ 9 điểm: ' + JSON.stringify(r).slice(0, 150));
// 6) KHÔNG ÂM — khách đã tiêu hết điểm của đơn A rồi đơn A bị hủy: chỉ trừ phần còn lại (0), số dư không âm, không để "nợ" trừ vào điểm tích sau
const P5 = '0911000005'; r = saveP(P5, 0, 'E5a'); const D = r.order.orderId; ok(bal(P5).balance === 9, 'D tích 9');
r = saveP(P5, 9, 'E5b', small(20000)); ok(r.ok && r.order.pointsUsed === 9 && bal(P5).balance === 0, 'khách dùng hết 9 điểm ở đơn khác');
r = st(D, 'Hủy', 'hủy sau khi khách đã tiêu điểm'); ok(r.ok && r.pointsRevoked === 0 && r.pointsRevokeCapped === true, 'hủy D: chỉ trừ được 0/9 điểm (không âm): ' + JSON.stringify(r).slice(0, 200));
ok(bal(P5).balance === 0 && bal(P5).deficit === 0, 'số dư 0, KHÔNG có nợ điểm: ' + JSON.stringify(bal(P5)));
rows = L(P5).filter(x => x[2] === 'refund'); ok(rows.length === 1 && Number(rows[0][5]) === 0 && /chi tru 0\/9/.test(String(rows[0][7])), 'sổ ghi dòng refund 0 điểm kèm ghi chú đã dùng bớt: ' + JSON.stringify(rows[0]));
r = saveP(P5, 0, 'E5c'); ok(r.pointsEarned === 9 && bal(P5).balance === 9, 'đơn mua sau vẫn được cộng đủ 9 điểm (không bị trừ nợ cũ)');
// trừ một phần: tích 9, dùng 4 → còn 5 → hủy chỉ trừ 5
const P6 = '0911000006'; r = saveP(P6, 0, 'E6a'); const F = r.order.orderId; saveP(P6, 4, 'E6b', small(20000));
ok(bal(P6).balance === 5, 'còn 5 điểm'); r = st(F, 'Hủy', 'x'); ok(r.ok && r.pointsRevoked === 5 && r.pointsRevokeCapped === true && bal(P6).balance === 0, 'hủy F trừ 5/9 điểm, số dư 0');
// 7) đơn vừa dùng điểm vừa tích → Hủy: hoàn điểm đã dùng + trừ điểm đã tích → số dư về đúng trước khi mua
const P7 = '0911000007'; pos = [{ soDienThoai: P7, ngayTaoDon: ddmmyyyy(), giaTriSauGiam: 16000000 }];
const before = bal(P7).balance; r = saveP(P7, 100, 'E7'); const G = r.order.orderId; ok(r.pointsEarned === 8 && bal(P7).balance === before - 100 + 8, 'mua: −100 +8');
r = st(G, 'Hủy', 'x'); ok(r.ok && r.pointsRefunded === 100 && r.pointsRevoked === 8 && bal(P7).balance === before, 'hủy: hoàn 100 điểm đã dùng + trừ 8 điểm đã tích → về ' + before + ': ' + JSON.stringify(r).slice(0, 200));
// 8) đơn tích từ NĂM TRƯỚC (quỹ đã hết hạn) → hủy ghi đủ số điểm, KHÔNG ảnh hưởng số dư năm nay
const P8 = '0911000008'; ctx._loyaltyAppend_('LoyaltyPoints', ctx.LOYALTY_HEADERS_, [['earn|crm|OLD1', P8, 'earn', 'crm|OLD1', (YEAR - 1) + '-12-30', 50, 5000000, 'Don CRM OLD1', 'x', new Date()]]);
saveP(P8, 0, 'E8'); const b8 = bal(P8).balance;
let rv = ctx._loyaltyCrmRevoke_({ phone: P8, orderId: 'OLD1' }, 'Hủy', 'boss'); ok(rv.points === 50 && rv.capped === false && bal(P8).balance === b8, 'đơn năm trước: ghi đủ 50 điểm, số dư năm nay không đổi (' + b8 + ')');
// 9) đơn chưa từng tích (0 điểm) / đã revoke rồi → không ghi gì thêm
const P9 = '0911000009'; r = saveP(P9, 0, 'E9', small(50000)); const H = r.order.orderId; ok(r.ok && r.pointsEarned === 0 && L(P9).length === 0, 'đơn 50.000đ (0 điểm) không ghi sổ');
r = st(H, 'Hủy', 'x'); ok(r.ok && r.pointsRevoked === 0 && L(P9).length === 0, 'hủy đơn không có điểm: không ghi sổ');
// 10) tích lỗi KHÔNG làm hỏng đơn; bấm Lưu lại cùng refKey tích bù (khoá cố định, không tích 2 lần)
const P10 = '0911000010', origE = ctx._loyaltyCrmEarn_; ctx._loyaltyCrmEarn_ = () => { throw new Error('so cai hong'); };
r = saveP(P10, 0, 'E10'); const I = r.order && r.order.orderId; ok(r.ok && I && r.pointsEarned === 0 && /so cai hong/.test(r.pointsEarnError) && L(P10).length === 0, 'tích lỗi: đơn vẫn lưu, báo pointsEarnError: ' + JSON.stringify(r).slice(0, 160));
ctx._loyaltyCrmEarn_ = origE; r = saveP(P10, 0, 'E10'); ok(r.ok && r.duplicate === true && r.order.orderId === I && r.pointsEarned === 9 && L(P10).length === 1, 'lưu lại cùng refKey: tích bù 9 điểm');
r = saveP(P10, 0, 'E10'); ok(L(P10).length === 1, 'lưu lại lần nữa: vẫn 1 dòng');
// 11) đơn đã Hủy mà client bấm lưu lại cùng refKey → không tích
r = st(I, 'Hủy', 'x'); ok(r.ok && r.pointsRevoked === 9, 'hủy I trừ 9'); r = saveP(P10, 0, 'E10'); ok(r.duplicate === true && r.pointsEarned === 0 && bal(P10).balance === 0, 'đơn đã hủy: lưu lại không tích');
// 12) trừ điểm lỗi thật → dừng, trạng thái giữ nguyên, làm lại được
const P12 = '0911000012'; r = saveP(P12, 0, 'E12'); const K = r.order.orderId, origR = ctx._loyaltyCrmRevoke_; ctx._loyaltyCrmRevoke_ = () => { throw new Error('hong so'); };
r = st(K, 'Hủy', 'x'); ctx._loyaltyCrmRevoke_ = origR; ok(!r.ok && /Khong tru duoc diem da tich/.test(r.error) && J(ctx.crmOrderDoGet_('crmOrders', { token: 't' })).orders.find(o => o.orderId === K).status === 'Mới' && bal(P12).balance === 9, 'trừ điểm lỗi: không đổi trạng thái, điểm còn nguyên');
r = st(K, 'Hủy', 'thử lại'); ok(r.ok && r.pointsRevoked === 9 && bal(P12).balance === 0, 'thử lại thành công, trừ đúng 1 lần');
// 13) không đụng sheet nào ngoài Đơn CRM + sổ điểm
ok(Object.keys(sheets).filter(n => n !== 'Đơn CRM' && n !== 'LoyaltyPoints' && n !== 'LoyaltyTier' && n !== 'AuditLog').length === 0, 'không đụng sheet khác: ' + Object.keys(sheets));
console.log('ALL CRM ORDER EARN TESTS PASSED');

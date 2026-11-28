#!/usr/bin/env node
// Test ĐƠN CRM bước 4c (gas_v13.js): trừ kho khi Đã xác nhận, cộng trả khi Hủy/Hoàn — sổ cái chống trừ 2 lần, combo, thiếu tồn, bị giữ, kho tắt.
// Chạy: node tools/test-crm-order-stock.js -> "ALL CRM ORDER STOCK TESTS PASSED".
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
const retry = id => J(ctx.crmOrderDoPost_('crmOrderStockRetry', { token: 't', orderId: id }));
function seed(name, headers, rows) { const sh = ctx.getSheet_(name, headers); rows.forEach(r => sh.getRange(sh.getLastRow() + 1, 1, 1, r.length).setValues([r])); return sh; }
const ton = (kho, code) => { const r = sheets['TonKho'].rows.slice(1).find(x => x[0] === kho && String(x[1]).toUpperCase() === code); return r ? Number(r[3]) : null; };
const ledger = id => { const r = (sheets['TonKhoTruDon'] ? sheets['TonKhoTruDon'].rows.slice(1) : []).find(x => x[0] === 'CRM|' + id); return r ? { status: r[4], applied: JSON.parse(r[5] || '[]'), shortage: r[6], problems: r[7] } : null; };
const logs = () => (sheets['TonKhoLog'] ? sheets['TonKhoLog'].rows.slice(1) : []);
const mk = (items, ref) => save({ phone: '0943028399', custName: 'An', items }, ref).order.orderId;
const it = (code, qty, name) => ({ code, name: name || 'SP ' + code, qty, price: 100000 });
tokenUser = { role: 'sale', username: 'hoa' };
seed('Kho', ctx.KHO_HEADERS, [['K1', 'Kho 1', '[]', '[]', true, '', '', ''], ['K2', 'Kho 2', '[]', '[]', true, '', '', '']]);
seed('TonKho', ctx.TONKHO_HEADERS, [['K1', 'A', 'SP A', 10, '', '', '', 1], ['K1', 'B', 'SP B', 20, '', '', '', 1], ['K1', 'C', 'SP C', 1, '', '', '', 1], ['K1', 'DUP', 'Trung kho', 5, '', '', '', 1], ['K2', 'DUP', 'Trung kho', 5, '', '', '', 1]]);
seed('KhoCombo', ctx.KHOCOMBO_HEADERS, [['CB1', 'Combo 1', JSON.stringify([{ code: 'A', qty: 1 }, { code: 'B', qty: 2 }]), true]]);

// 1) kho TẮT (mặc định): đổi trạng thái bình thường, kho KHÔNG đổi, báo status off
let o1 = mk([it('A', 2)], 'R1'); let r = st(o1, 'Đã xác nhận');
ok(r.ok && r.stock && r.stock.status === 'off' && ton('K1', 'A') === 10 && !ledger(o1), 'kho tắt → không trừ, không ghi sổ: ' + JSON.stringify(r.stock));
// bật
seed('KhoCauHinh', ctx.KHOCFG_HEADERS, [['mode', 'on']]);
// 2) Đã xác nhận → trừ; sổ cái da_tru; log tru_don có ref
let o2 = mk([it('A', 2), it('B', 3)], 'R2'); r = st(o2, 'Đã xác nhận');
ok(r.ok && r.stock.status === 'deducted' && r.stock.lines === 2 && ton('K1', 'A') === 8 && ton('K1', 'B') === 17, 'xác nhận → trừ A-2, B-3: ' + JSON.stringify(r.stock));
ok(ledger(o2).status === 'da_tru' && ledger(o2).applied.length === 2, 'sổ cái da_tru');
ok(logs().filter(x => x[6] === 'tru_don' && x[11] === 'CRM|' + o2).length === 2, 'log tru_don có ref CRM|mã đơn');
// 3) chống trừ 2 lần: chạy lại trừ kho cho đơn đã trừ
tokenUser = { role: 'admin', username: 'admin' };
r = retry(o2); ok(r.ok && r.stock.status === 'already' && ton('K1', 'A') === 8, 'chạy lại không trừ lần 2');
tokenUser = { role: 'sale', username: 'hoa' };
// 4) Đang giao → Đã giao không đụng kho; Hoàn → cộng trả đúng số đã trừ
st(o2, 'Đang giao'); st(o2, 'Đã giao'); ok(ton('K1', 'A') === 8, 'đổi trạng thái giữa chừng không đụng kho');
r = st(o2, 'Hoàn', 'khách trả'); ok(r.ok && r.stock.status === 'returned' && ton('K1', 'A') === 10 && ton('K1', 'B') === 20 && ledger(o2).status === 'da_hoan', 'Hoàn → cộng trả đủ: ' + JSON.stringify(r.stock));
ok(logs().some(x => x[6] === 'hoan_don' && x[11] === 'CRM|' + o2), 'log hoan_don');
// 5) Mới → Hủy (chưa trừ): không cộng bậy
let o3 = mk([it('A', 5)], 'R3'); r = st(o3, 'Hủy', 'khách đổi ý'); ok(r.ok && r.stock.status === 'none' && ton('K1', 'A') === 10, 'Hủy đơn chưa trừ → kho không đổi');
// 6) thiếu tồn: trừ tối đa bằng tồn, báo thiếu; Hủy trả đúng số ĐÃ trừ (không trả 3)
let o4 = mk([it('C', 3)], 'R4'); r = st(o4, 'Đã xác nhận');
ok(r.stock.status === 'deducted' && ton('K1', 'C') === 0 && /C thieu 2/.test(r.stock.shortage.join()), 'thiếu tồn: trừ 1, báo thiếu 2: ' + JSON.stringify(r.stock));
r = st(o4, 'Hủy', 'hết hàng'); ok(r.stock.status === 'returned' && ton('K1', 'C') === 1, 'Hủy trả đúng 1 (không âm, không dư)');
// 7) combo: CB1 = A×1 + B×2, mua 2 → A-2, B-4
let o5 = mk([it('CB1', 2, 'Combo 1')], 'R5'); r = st(o5, 'Đã xác nhận');
ok(r.stock.status === 'deducted' && ton('K1', 'A') === 8 && ton('K1', 'B') === 16, 'combo khai báo → trừ theo thành phần: ' + JSON.stringify(r.stock));
// 8) bị GIỮ: thiếu mã / combo chưa khai báo / mã ở 2 kho chưa đặt ưu tiên → vẫn đổi được trạng thái, KHÔNG trừ gì, ghi sổ cho_duyet
let o6 = mk([it('A', 1), { name: 'Nhẫn không mã', qty: 1, price: 1 }], 'R6'); r = st(o6, 'Đã xác nhận');
ok(r.ok && r.order.status === 'Đã xác nhận' && r.stock.status === 'held' && /chua co ma/.test(r.stock.reasons[0]) && ton('K1', 'A') === 8 && ledger(o6).status === 'cho_duyet', 'thiếu mã → giữ, không trừ A (kể cả dòng có mã): ' + JSON.stringify(r.stock));
let o7 = mk([it('CB9', 1, 'Combo lạ')], 'R7'); r = st(o7, 'Đã xác nhận'); ok(r.stock.status === 'held' && /Combo chua khai bao: CB9/.test(r.stock.reasons[0]), 'combo chưa khai báo → giữ');
let o8 = mk([it('DUP', 1)], 'R8'); r = st(o8, 'Đã xác nhận'); ok(r.stock.status === 'held' && /nhieu kho/.test(r.stock.reasons[0]) && ton('K1', 'DUP') === 5, 'mã ở 2 kho chưa đặt ưu tiên → giữ');
// 9) đặt ưu tiên rồi admin chạy lại → trừ; người thường không chạy lại được
seed('KhoCauHinh', ctx.KHOCFG_HEADERS, [['priority', JSON.stringify(['K2', 'K1'])]]);
r = retry(o8); ok(!r.ok && /admin/.test(r.error), 'không phải admin → không chạy lại được');
tokenUser = { role: 'admin', username: 'admin' }; r = retry(o8);
ok(r.ok && r.stock.status === 'deducted' && ton('K2', 'DUP') === 4 && ton('K1', 'DUP') === 5 && ledger(o8).status === 'da_tru', 'admin chạy lại sau khi đặt ưu tiên → trừ kho K2');
r = retry(o3); ok(!r.ok && /Chi chay lai/.test(r.error), 'đơn đã Hủy không chạy lại được');
tokenUser = { role: 'sale', username: 'hoa' };
// 10) mã không thuộc kho nào → không chặn, không ghi sổ
let o9 = mk([it('DICHVU', 1)], 'R9'); r = st(o9, 'Đã xác nhận'); ok(r.ok && r.stock.status === 'no_stock' && !ledger(o9), 'mã ngoài kho → bỏ qua');
// 11) kho tắt SAU khi đã trừ: Hủy vẫn cộng trả
sheets['KhoCauHinh'].rows.forEach(x => { if (x[0] === 'mode') x[1] = 'off'; });
r = st(o5, 'Hủy', 'đổi ý'); ok(r.stock.status === 'returned' && ton('K1', 'A') === 10 && ton('K1', 'B') === 20, 'kho đã tắt vẫn cộng trả hàng đã trừ');
sheets['KhoCauHinh'].rows.forEach(x => { if (x[0] === 'mode') x[1] = 'on'; });
// 12) lỗi kho thật → DỪNG, trạng thái giữ nguyên (đơn vẫn ở Mới)
let o10 = mk([it('A', 1)], 'R10'); const keep = ctx._tonkhoLoad_; ctx._tonkhoLoad_ = () => { throw new Error('sheet hong'); };
r = st(o10, 'Đã xác nhận'); ctx._tonkhoLoad_ = keep;
ok(!r.ok && /Loi kho/.test(r.error) && get(o10).status === 'Mới', 'lỗi kho → báo lỗi, đơn giữ nguyên Mới');
r = st(o10, 'Đã xác nhận'); ok(r.ok && r.stock.status === 'deducted', 'hết lỗi → thử lại được');
// 13) chạy trừ kho đơn POS KHÔNG báo đơn CRM là "mồ côi"
seed('KhoCauHinh', ctx.KHOCFG_HEADERS, [['start', '01/11/2026']]);
const rep = ctx._tkdRun_({ apply: false, rows: [] }); ok(rep.ok && rep.orphans.length === 0, 'đơn CRM không bị báo mồ côi: ' + JSON.stringify(rep.orphans));
// 14) khoá sổ cái tách khỏi đơn POS
ok((sheets['TonKhoTruDon'].rows.slice(1).every(x => String(x[0]).indexOf('CRM|') === 0)), 'mọi khoá sổ cái của đơn CRM đều có tiền tố CRM|');
console.log('ALL CRM ORDER STOCK TESTS PASSED');

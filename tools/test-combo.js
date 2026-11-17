#!/usr/bin/env node
// Test COMBO co san (GAS): parse dong san pham, doc sheet COMBO, tim khong dau + so chu, het han, comboSave/comboDelete (admin).
// Chay: node tools/test-combo.js -> "ALL COMBO TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const H = ['Mã combo', 'Tên combo', 'Sản phẩm', 'Giá combo', 'Điều kiện / Ghi chú', 'Từ ngày', 'Đến ngày', 'Từ khóa', 'Hoạt động'];
const data = [
  ['CB1', 'Combo Lắc cỏ 4 lá + nhẫn', 'Lắc cỏ 4 lá | Bạc 925 | 16cm | 1\n2 x Nhẫn bạc trơn | | Size 12', '1.299', 'Chỉ áp dụng online', '', '', 'bốn lá, may mắn', true],
  ['CB2', 'Combo hết hạn', 'Dây chuyền Bạc Ý', 990000, '', '', '2020-01-01', '', true],
  ['CB3', 'Combo tắt', 'Nhẫn', 100, '', '', '', '', false],
];
let tokenUser = { role: 'admin' };
const sheet = { rows: [H.slice()].concat(data.map(r => r.slice())),
  getLastRow() { return this.rows.length; },
  getRange(r, c, nr, nc) { const s = this; return { getValues: () => s.rows.slice(r - 1, r - 1 + nr).map(x => { const o = []; for (let i = 0; i < nc; i++) o.push(x[c - 1 + i] === undefined ? '' : x[c - 1 + i]); return o; }),
    setValues: v => { for (let i = 0; i < v.length; i++) { s.rows[r - 1 + i] = s.rows[r - 1 + i] || []; for (let j = 0; j < v[i].length; j++) s.rows[r - 1 + i][c - 1 + j] = v[i][j]; } return { setFontWeight() {} }; } }; },
  deleteRow(n) { this.rows.splice(n - 1, 1); }, setFrozenRows() {} };
const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, isFinite, encodeURIComponent,
  Logger: { log() {} }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {}, tryLock: () => true }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, getProperties: () => ({}) }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {}, removeAll() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
  Utilities: { getUuid: () => 'x', formatDate: () => '261117120000' } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8'), ctx, { filename: 'gas_v13.js' });
ctx.SpreadsheetApp = { openById: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }) };
ctx._sessUser_ = () => tokenUser;
const J = o => JSON.parse(o.getContent());

// parse
const it = ctx._comboParseItems_('Lắc cỏ 4 lá | Bạc 925 | 16cm | 2\n3 x Nhẫn\n\nDây | | ');
ok(it.length === 3 && it[0].qty === 2 && it[0].chatLieu === 'Bạc 925' && it[1].qty === 3 && it[1].name === 'Nhẫn' && it[2].qty === 1, 'parse items');
// doc
const l = J(ctx.jsonOut_(ctx.comboList_('')));
ok(l.ok && l.total === 3, 'list total');
ok(l.rows[0].code === 'CB1' && l.rows[0].usable && l.rows[0].price === 1299 && l.rows[0].items.length === 2 && l.rows[0].items[1].qty === 2, 'CB1 parsed + usable first');
ok(l.rows.find(r => r.code === 'CB2').expired && !l.rows.find(r => r.code === 'CB2').usable, 'expired');
ok(l.rows.find(r => r.code === 'CB3').active === false, 'inactive');
// tim
const q = s => J(ctx.jsonOut_(ctx.comboList_(s))).rows.map(r => r.code);
ok(q('combo bốn lá')[0] === 'CB1', 'so chu bon->4 / tu khoa');
ok(q('lac co 4 la').join() === 'CB1', 'khong dau');
ok(q('may man').join() === 'CB1', 'tu khoa cot');
ok(q('nhan bac tron')[0] === 'CB1', 'tim trong san pham');
ok(q('xyz khong co').length === 0, 'khong khop');
// luu
let r = J(ctx.comboSave_({ token: 't', combo: { name: 'Combo mới', items: [{ name: 'Vòng', qty: 2 }], price: 500000, keywords: 'vong' } }));
ok(r.ok && r.created && r.code === 'CB261117120000' && sheet.rows.length === 5, 'save new');
r = J(ctx.comboSave_({ token: 't', combo: { code: 'cb1', name: 'Sửa', itemsText: 'A | | | 1', price: 10 } }));
ok(r.ok && !r.created && sheet.rows[1][1] === 'Sửa', 'upsert theo ma (khong phan biet hoa thuong)');
ok(J(ctx.comboSave_({ token: 't', combo: { name: '', items: [{ name: 'a' }], price: 1 } })).error, 'thieu ten');
ok(J(ctx.comboSave_({ token: 't', combo: { name: 'x', items: [], price: 1 } })).error, 'thieu sp');
ok(J(ctx.comboSave_({ token: 't', combo: { name: 'x', items: [{ name: 'a' }], price: 0 } })).error, 'thieu gia');
ok(J(ctx.comboSave_({ token: 't', combo: { name: 'x', items: [{ name: 'a' }], price: 1, start: '2026-05-02', end: '2026-05-01' } })).error, 'ngay nguoc');
tokenUser = { role: 'sale' };
ok(J(ctx.comboSave_({ token: 't', combo: { name: 'x', items: [{ name: 'a' }], price: 1 } })).code === 'FORBIDDEN', 'non-admin save');
ok(J(ctx.comboDelete_({ token: 't', code: 'CB1' })).code === 'FORBIDDEN', 'non-admin delete');
tokenUser = { role: 'admin' };
ok(J(ctx.comboDelete_({ token: 't', code: 'cb1' })).ok && !sheet.rows.some(x => x[0] === 'CB1'), 'delete');
ok(J(ctx.comboDelete_({ token: 't', code: 'NOPE' })).error, 'delete missing');
// doGet routing
const g = J(ctx.doGet({ parameter: { action: 'comboList', q: 'vong' } }));
ok(g.ok && g.rows.length === 1, 'doGet comboList');
console.log('ALL COMBO TESTS PASSED');

#!/usr/bin/env node
// Test GAS comboImage_: extension lay byte anh combo (Drive) — CHI anh thuoc combo DANG AP DUNG (chong doc Drive tuy y).
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('ok   ' + m); };
const ID1 = '1AbCdEfGhIjKlMnOpQrSt', ID2 = '1ZyXwVuTsRqPoNmLkJiHg', ID3 = '1QqQqQqQqQqQqQqQqQqQq';
const H = ['Mã combo', 'Tên combo', 'Sản phẩm', 'Giá combo', 'Điều kiện / Ghi chú', 'Từ ngày', 'Đến ngày', 'Từ khóa', 'Hoạt động', 'Ảnh'];
const data = [
  ['CB1', 'Combo A', 'Nhẫn | | 12', '1.299', '', '', '', '', true, 'https://drive.google.com/file/d/' + ID1 + '/view\nhttps://drive.google.com/uc?export=view&id=' + ID2],
  ['CB2', 'Combo het han', 'Nhẫn', 990000, '', '', '2020-01-01', '', true, 'https://drive.google.com/file/d/' + ID3 + '/view'],
];
const sheet = { rows: [H.slice()].concat(data.map(r => r.slice())), getLastRow() { return this.rows.length; },
  getRange(r, c, nr, nc) { const s = this; return { getValues: () => s.rows.slice(r - 1, r - 1 + nr).map(x => { const o = []; for (let i = 0; i < nc; i++) o.push(x[c - 1 + i] === undefined ? '' : x[c - 1 + i]); return o; }), setValues() {} }; },
  setFrozenRows() {}, getMaxColumns() { return 10; }, insertColumnsAfter() {} };
let driveCalls = [];
const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, isFinite, encodeURIComponent,
  Logger: { log() {} }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {}, tryLock: () => true }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, getProperties: () => ({}) }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {}, removeAll() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
  Utilities: { getUuid: () => 'x', formatDate: () => '261117120000', base64Encode: b => Buffer.from(b).toString('base64') },
  DriveApp: { getFileById: id => ({ getBlob: () => { driveCalls.push(id); return { getBytes: () => [1, 2, 3], getContentType: () => 'image/jpeg' }; } }) } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8'), ctx, { filename: 'gas_v13.js' });
ctx.SpreadsheetApp = { openById: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }) };
const J = o => JSON.parse(o.getContent());
let r = ctx.comboImage_(ID1);
ok(r.ok && r.base64 === 'AQID' && r.mimeType === 'image/jpeg', 'anh link /file/d/ cua combo dang ap dung -> tra base64');
r = ctx.comboImage_(ID2); ok(r.ok, 'anh link uc?export=view&id= cung nhan');
driveCalls = []; r = ctx.comboImage_(ID3);
ok(!r.ok && r.code === 'FORBIDDEN' && !driveCalls.length, 'anh cua combo HET HAN -> tu choi, KHONG cham Drive');
driveCalls = []; r = ctx.comboImage_('1NotInAnyComboAtAll12345');
ok(!r.ok && r.code === 'FORBIDDEN' && !driveCalls.length, 'ID bat ky ngoai combo -> tu choi (chong doc Drive tuy y)');
ok(!ctx.comboImage_('abc').ok && !ctx.comboImage_('').ok && !ctx.comboImage_('../../x/y/z/w/v/u/t/s').ok, 'ID sai dinh dang -> tu choi');
const g = J(ctx.doGet({ parameter: { action: 'comboImage', id: ID1 } }));
ok(g.ok && g.base64 === 'AQID', 'doGet route comboImage');
console.log('ALL COMBO-IMAGE TESTS PASSED');

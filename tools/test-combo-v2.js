#!/usr/bin/env node
// Test COMBO v2 (GAS, 18/11/2026): dong SP co Vang/Don gia/Qua, ship + freeship + CTKM combo tao san (giam tien / tang qua <=2 anh), tinh gia, chu hien thi theo mau Duyen.
// Chay: node tools/test-combo-v2.js -> "ALL COMBO-V2 TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const mkSheet = (maxCols, header) => ({ rows: [header.slice()], maxCols, getLastRow() { return this.rows.length; },
  getRange(r, c, nr, nc) { const s = this; return { getValues: () => s.rows.slice(r - 1, r - 1 + nr).map(x => { const o = []; for (let i = 0; i < nc; i++) o.push(x[c - 1 + i] === undefined ? '' : x[c - 1 + i]); return o; }),
    setValues: v => { for (let i = 0; i < v.length; i++) { s.rows[r - 1 + i] = s.rows[r - 1 + i] || []; for (let j = 0; j < v[i].length; j++) s.rows[r - 1 + i][c - 1 + j] = v[i][j]; } return { setFontWeight() {} }; } }; },
  deleteRow(n) { this.rows.splice(n - 1, 1); }, setFrozenRows() {}, getMaxColumns() { return this.maxCols; }, insertColumnsAfter(c, n) { this.maxCols += n; } });
const sheets = { COMBO: mkSheet(10, ['Mã combo', 'Tên combo', 'Sản phẩm', 'Giá combo', 'Điều kiện / Ghi chú', 'Từ ngày', 'Đến ngày', 'Từ khóa', 'Hoạt động', 'Ảnh']) };   // sheet COMBO CU 10 cot, CTKM_COMBO chua co
let tokenUser = { role: 'admin' }; const shared = [];
const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, isFinite, encodeURIComponent,
  Logger: { log() {} }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {}, tryLock: () => true }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, getProperties: () => ({}) }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {}, removeAll() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
  Utilities: { getUuid: () => 'x', formatDate: () => '261118171102' },
  DriveApp: { Access: { ANYONE_WITH_LINK: 'A' }, Permission: { VIEW: 'V' }, getFileById: id => ({ setSharing: () => { shared.push(id); } }) } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8'), ctx, { filename: 'gas_v13.js' });
ctx.SpreadsheetApp = { openById: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet(7, ['x'])) }) };
ctx._sessUser_ = () => tokenUser;
const J = o => JSON.parse(o.getContent());

// 1) dong SP: dong cu 4 truong giu nguyen; co vang/gia/qua thi 7 truong
const legacy = 'Lắc cỏ 4 lá | Bạc 925 | 16cm | 1\nNhẫn bạc trơn |  | Size 12 | 2';
ok(ctx._comboItemsToText_(ctx._comboParseItems_(legacy)) === legacy, 'dong cu round-trip KHONG doi (Pancake/Zalo cu doc nhu truoc)');
const ext = ctx._comboParseItems_('CHARM BI | (mặc định) | SIZE 3 | 2 | 10k | 380000 |\nQuà túi | | | 1 | | | qua\nA | | | 1 | 20k | abc | ');
ok(ext[0].vang === '10k' && ext[0].price === 380000 && ext[0].gift === false && ext[0].qty === 2, 'parse vang/gia');
ok(ext[1].gift === true && ext[1].price === 0, 'parse qua');
ok(ext[2].vang === '' && ext[2].price === 0, 'vang la 20k bi bo, gia rac = 0');
ok(ctx._comboItemsToText_(ext).split('\n')[0] === 'CHARM BI | (mặc định) | SIZE 3 | 2 | 10k | 380000 | ' && ctx._comboItemsToText_(ext).split('\n')[1] === 'Quà túi |  |  | 1 |  |  | qua', 'serialize 7 truong');
ok(ctx._comboParseItems_(ctx._comboItemsToText_(ext))[0].vang === '10k', 'round-trip 7 truong');

// 2) CTKM combo tao san
const save = c => J(ctx.ctkmComboSave_({ token: 't', ctkm: c }));
ok(save({ name: '', type: 'giam', amount: 1 }).error, 'thieu ten');
ok(save({ name: 'x', type: 'giam', amount: 0 }).error, 'giam tien can so tien');
ok(save({ name: 'x', type: 'qua' }).error, 'tang qua can qua hoac anh');
tokenUser = { role: 'sale' }; ok(save({ name: 'x', type: 'giam', amount: 1 }).code === 'FORBIDDEN', 'non-admin khong luu CTKM combo'); tokenUser = { role: 'admin' };
const r1 = save({ name: 'Giảm 200k', type: 'giam', amount: 200 });   // 200 = 200k
ok(r1.ok && r1.created && r1.code === 'KM261118171102' && sheets.CTKM_COMBO.rows.length === 2, 'tao CTKM giam, tu tao sheet CTKM_COMBO');
ok(sheets.CTKM_COMBO.rows[1][3] === 200000, '200 -> 200.000d');
const r2 = save({ name: 'Tặng túi', type: 'qua', gift: 'Túi tiền lam thủy', images: ['https://x.com/1.png', 'https://x.com/2.png', 'https://x.com/3.png'], code: 'KMQUA' });
ok(r2.ok && r2.code === 'KMQUA' && sheets.CTKM_COMBO.rows[2][5].split('\n').length === 2, 'anh qua toi da 2');
ok(save({ name: 'Tặng túi v2', type: 'qua', gift: 'Túi', code: 'kmqua' }).created === false && sheets.CTKM_COMBO.rows.length === 3, 'sua theo ma (khong phan biet hoa thuong)');
save({ name: 'Cũ', type: 'giam', amount: 50000, code: 'KMOLD', active: false });
const ls = J(ctx.doGet({ parameter: { action: 'ctkmComboList' } }));
ok(ls.ok && ls.rows.length === 3 && ls.rows.find(x => x.code === 'KMQUA').type === 'qua' && ls.rows.find(x => x.code === 'KMOLD').active === false && ls.rows.find(x => x.code === 'KMOLD').amount === 50000, 'doGet ctkmComboList');

// 3) luu combo kem ship/freeship/CTKM; doc ra gia
const cs = c => J(ctx.comboSave_({ token: 't', combo: c }));
const items = [{ name: 'CHARM BI MẪU SỐ 10 SIZE 3', chatLieu: '(mặc định)', size: '', qty: 2, vang: '10k', price: 380000 }, { name: 'CHUỖI LAM THỦY 6 LI', size: '1 VÒNG ĐƠN', qty: 1, price: 1550000 }, { name: 'HẠT ĐỒNG ĐIẾU LAM THỦY', size: '(mặc định)', qty: 1, price: 990000 }];
const sv = cs({ name: 'Vòng cầu đơn', code: 'CB261118171102', price: 3300000, items, ship: 40000, ctkmCodes: ['km261118171102', 'KMOLD', 'NOPE'] });
ok(sv.ok && sheets.COMBO.maxCols === 13 && sheets.COMBO.rows[1].length === 13 && sheets.COMBO.rows[1][12] === 'KM261118171102,KMOLD,NOPE' && sheets.COMBO.rows[1][10] === 40000 && sheets.COMBO.rows[1][11] === false, 'luu 13 cot, sheet cu 10 cot duoc mo rong');
let c = J(ctx.jsonOut_(ctx.comboList_(''))).rows[0];
ok(c.discount === 200000 && c.finalPrice === 3100000 && c.total === 3140000 && c.ship === 40000 && c.freeship === false, 'giam 200k (CTKM tat va ma la bi bo), con 3.100.000, +ship 40k = 3.140.000: ' + JSON.stringify([c.discount, c.finalPrice, c.total]));
ok(c.listTotal === 3300000 && c.ctkms.length === 1 && c.gifts.length === 0, 'tong niem yet = 3.300.000, 1 CTKM dang ap dung');
// 4) CHU HIEN THI theo mau Duyen
const want = ['🎁 Vòng cầu đơn (CB261118171102)', 'Giá combo: 3.300.000đ giảm 200k còn 3.100.000đ', '- CHARM BI MẪU SỐ 10 10k SIZE 3 380 × 2 = 760', '- CHUỖI LAM THỦY 6 LI · 1 VÒNG ĐƠN 1.550', '- HẠT ĐỒNG ĐIẾU LAM THỦY 990', '- 40k ship tổng: 3.140.000đ'].join('\n');
ok(ctx._comboFormatText_(c) === want, 'chu hien thi:\n' + ctx._comboFormatText_(c));
// freeship + qua
cs({ name: 'Vòng cầu đơn', code: 'CB261118171102', price: 3300000, items: items.concat([{ name: 'Túi nhung', qty: 1, gift: true }]), freeship: true, ship: 40000, ctkmCodes: 'KM261118171102,KMQUA' });
c = J(ctx.jsonOut_(ctx.comboList_(''))).rows[0];
ok(c.freeship === true && c.total === 3100000 && c.gifts.length === 1 && c.gifts[0].gift === 'Túi', 'freeship: bo ship; CTKM qua hien trong gifts');
const t = ctx._comboFormatText_(c);
ok(t.includes('- 🎁 Túi nhung (quà tặng)') && t.includes('- 🎁 Quà tặng: Túi') && t.endsWith('- Freeship tổng: 3.100.000đ') && !t.includes('ship tổng: 3.140'), 'chu: dong qua + freeship');
ok(c.listTotal === 3300000, 'dong qua KHONG cong vao tong niem yet');
// combo cu (khong ship/CTKM) khong doi
cs({ name: 'Cũ', code: 'CBOLD', price: 990000, itemsText: 'Dây chuyền Bạc Ý' });
const o = J(ctx.jsonOut_(ctx.comboList_(''))).rows.find(x => x.code === 'CBOLD');
ok(o.discount === 0 && o.total === 990000 && o.ship === 0 && ctx._comboFormatText_(o).split('\n').length === 3, 'combo cu: khong giam/ship, chu gon');
// xoa CTKM
ok(J(ctx.ctkmComboDelete_({ token: 't', code: 'kmold' })).ok && !sheets.CTKM_COMBO.rows.some(x => x[0] === 'KMOLD'), 'xoa CTKM combo');
ok(J(ctx.ctkmComboDelete_({ token: 't', code: 'NOPE' })).error, 'xoa khong co');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
ok(/action === 'ctkmComboSave'/.test(src) && /action === 'ctkmComboDelete'/.test(src), 'doPost co route CTKM combo');
console.log('ALL COMBO-V2 TESTS PASSED');

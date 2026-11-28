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
const shared = [];
const sheet = { rows: [H.slice()].concat(data.map(r => r.slice())),
  getLastRow() { return this.rows.length; },
  getRange(r, c, nr, nc) { const s = this; return { getValues: () => s.rows.slice(r - 1, r - 1 + nr).map(x => { const o = []; for (let i = 0; i < nc; i++) o.push(x[c - 1 + i] === undefined ? '' : x[c - 1 + i]); return o; }),
    setValues: v => { for (let i = 0; i < v.length; i++) { s.rows[r - 1 + i] = s.rows[r - 1 + i] || []; for (let j = 0; j < v[i].length; j++) s.rows[r - 1 + i][c - 1 + j] = v[i][j]; } return { setFontWeight() {} }; } }; },
  deleteRow(n) { this.rows.splice(n - 1, 1); }, setFrozenRows() {}, maxCols: 9, getMaxColumns() { return this.maxCols; }, insertColumnsAfter(c, n) { this.maxCols += n; } };
const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, isFinite, encodeURIComponent,
  Logger: { log() {} }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {}, tryLock: () => true }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, getProperties: () => ({}) }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {}, removeAll() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
  Utilities: { getUuid: () => 'x', formatDate: () => '261117120000' },
  DriveApp: { Access: { ANYONE_WITH_LINK: 'A' }, Permission: { VIEW: 'V' }, getFileById: id => ({ setSharing: (a, b) => { shared.push(id + ':' + a + ':' + b); } }) } };
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
// ── 2026-11-18: ANH COMBO (cot 10 'Anh') ──
ok(sheet.maxCols === 13 && String(sheet.rows[0][9]) === 'Ảnh' && String(sheet.rows[0][10]) === 'Ship (đ)' && String(sheet.rows[0][12]) === 'CTKM combo', 'sheet cu 9 cot: tu them cot Anh + Ship/Freeship/CTKM (cot 10-13) + tieu de');
const FID = '1AbCdEfGhIjKlMnOpQrStUv';
ok(JSON.stringify(ctx._comboImageUrls_('https://drive.google.com/file/d/' + FID + '/view?usp=sharing\nhttps://drive.google.com/uc?export=view&id=' + FID + '2\nhttps://cdn.example.com/a.jpg\nhttps://drive.google.com/drive/folders/' + FID + '\nrac roi')) ===
  JSON.stringify(['https://drive.google.com/thumbnail?id=' + FID + '&sz=w600', 'https://drive.google.com/thumbnail?id=' + FID + '2&sz=w600', 'https://cdn.example.com/a.jpg']), 'doi link Drive -> thumbnail, giu link http, BO link thu muc va chu rac');
ok(ctx._comboImageUrls_('a\nb\nhttps://x.com/1.png\nhttps://x.com/2.png\nhttps://x.com/3.png\nhttps://x.com/4.png\nhttps://x.com/5.png\nhttps://x.com/6.png\nhttps://x.com/7.png').length === 6 && ctx._comboImageUrls_('https://x.com/1.png\nhttps://x.com/2.png\nhttps://x.com/3.png', 2).length === 2, 'anh combo toi da 6, anh qua toi da 2');
r = J(ctx.comboSave_({ token: 't', combo: { name: 'Combo co anh', items: [{ name: 'Vòng' }], price: 500000, images: ['https://drive.google.com/uc?export=view&id=' + FID, 'rac', 'https://cdn.example.com/b.jpg'] } }));
const saved = sheet.rows[sheet.rows.length - 1];
ok(r.ok && saved[9] === 'https://drive.google.com/uc?export=view&id=' + FID + '\nhttps://cdn.example.com/b.jpg', 'luu anh: moi link 1 dong, link rac bi bo');
ok(shared.some(x => x.indexOf(FID + ':A:V') === 0), 'file Drive duoc bat chia se bat ky ai co link');
const lst = J(ctx.jsonOut_(ctx.comboList_('combo co anh'))).rows[0];
ok(lst.images.length === 2 && /thumbnail\?id=/.test(lst.images[0]) && lst.images[1] === 'https://cdn.example.com/b.jpg' && /uc\?export=view/.test(lst.imagesText), 'comboList tra images (thumbnail) + imagesText');
ok(J(ctx.jsonOut_(ctx.comboList_(''))).rows.find(x => x.code === 'CB1' || x.code === 'CB2').images.length === 0, 'combo cu khong co anh: images = []');
r = J(ctx.comboSave_({ token: 't', combo: { code: lst.code, name: 'Combo co anh', items: [{ name: 'Vòng' }], price: 500000, images: [] } }));
ok(r.ok && sheet.rows[sheet.rows.length - 1][9] === '', 'sua + bo het anh: o Anh rong');
console.log('ALL COMBO TESTS PASSED');

// ── Buoc 2: tich hop priceAsk_ + client js/38-pro-dock.js ──
ok(ctx._comboVnd_(1299) === 1299000 && ctx._comboVnd_(990000) === 990000, 'priceVnd quy doi nghin/dong');
sheet.rows.push(['CB9', 'Combo Lắc cỏ 4 lá + nhẫn', 'Lắc cỏ 4 lá | Bạc 925 | 16cm | 1\n2 x Nhẫn bạc trơn | | Size 12', '1.299', 'Chỉ online', '', '2099-01-01', 'bốn lá, may mắn', true]);
ctx.readPriceCatalog_ = () => [{ 'Nhóm': 'Lắc', 'Tên sản phẩm': 'Lắc cỏ 4 lá', 'Chất liệu': 'Bạc 925', 'Kiểu/Size': '16cm', 'Giá bán': '2.310' }];
ctx._priceCatalogRowsCached_ = () => ctx.readPriceCatalog_();
let pa = ctx.priceAsk_('Lắc cỏ bốn lá bao nhiêu tiền');
ok(pa.ok && Array.isArray(pa.combos) && pa.combos.some(c => c.code === 'CB9'), 'priceAsk_ kem combo (cau dai, loose)');
ok(pa.combos.every(c => c.usable), 'chi combo dang ap dung');
pa = ctx.priceAsk_('nhẫn mạ vàng 24k');
ok(pa.ok && pa.combos.length === 0, 'khong lien quan -> khong combo');
const dock = require('../js/38-pro-dock.js');
const txt = dock.proPriceFormat_({ ok: true, found: false, suggestions: ['A'], combos: [{ name: 'Combo X', code: 'CB1', priceVnd: 1299000, items: [{ name: 'Lắc', qty: 2, chatLieu: 'Bạc', size: '16cm' }], note: 'online', end: '2099-01-31' }] });
ok(/COMBO CÓ SẴN/.test(txt) && /1\.299\.000đ/.test(txt) && /2 × Lắc \(Bạc, 16cm\)/.test(txt) && /đến 31\/01\/2099/.test(txt), 'client format combo');
ok(/Giá theo BẢNG GIÁ/.test(dock.proPriceFormat_({ ok: true, found: true, text: 'x', combos: [] })) && !/COMBO/.test(dock.proPriceFormat_({ ok: true, found: true, text: 'x', combos: [] })), 'khong combo -> y nhu cu');

// ── Luot 2 buoc 4/5 (18/11/2026): combo hien theo mau moi + o tich 'Combo' o Tro ly AI gia ──
ok(pa.combos.length === 0 || pa.combos.every(c => typeof c.text === 'string'), 'priceAsk_ thuong: moi combo co text');
let pa2 = ctx.priceAsk_('Lắc cỏ bốn lá bao nhiêu tiền');
ok(pa2.combos.length >= 1 && pa2.combos[0].text.startsWith('🎁 Combo Lắc cỏ 4 lá + nhẫn') && /Giá combo: 1\.299\.000đ/.test(pa2.combos[0].text), 'combo kem chu hien thi mau moi');
const po = ctx.priceAsk_('combo', null, true);
ok(po.ok && po.comboOnly === true && po.found === false && po.combos.length >= 1 && po.combos.every(c => c.text.startsWith('🎁 ')), 'comboOnly: chi combo (khong tra san pham le), co text');
ok(ctx.priceAsk_('combo xyz khong co', null, true).combos.length === 0, 'comboOnly khong khop -> []');
const gco = J(ctx.doGet({ parameter: { action: 'priceAsk', q: 'combo', combo: '1' } }));
ok(gco.comboOnly === true && gco.combos.length >= 1 && !('suggestions' in gco && gco.suggestions.length), 'doGet priceAsk&combo=1');
const t2 = dock.proPriceFormat_({ ok: true, found: false, comboOnly: true, combos: [{ name: 'X', text: '🎁 X (C)\nGiá combo: 3.300.000đ giảm 200k còn 3.100.000đ\n- A 380 × 2 = 760', note: 'online', end: '2099-01-31' }], suggestions: [] });
ok(t2.includes('giảm 200k còn 3.100.000đ') && t2.includes('📝 online') && t2.includes('⏰ đến 31/01/2099') && !t2.includes('•') && !/Không có sản phẩm lẻ/.test(t2), 'client dung c.text + ghi chu/han, comboOnly khong bao thieu SP le');
ok(/Không có combo đang áp dụng/.test(dock.proPriceFormat_({ ok: true, found: false, comboOnly: true, combos: [], suggestions: [] })), 'comboOnly khong ket qua: bao ro');
const im = dock.proComboImages_([{ name: 'X', images: ['https://a/1.png'], gifts: [{ gift: 'Túi', images: ['https://a/g.png'] }] }]);
ok(im.length === 2 && im[1].name === '🎁 Quà: Túi', 'anh qua tang hien kem anh combo');
let seen = ''; dock.proPriceRequest_('https://s/exec', 'combo', async u => { seen = u; return { json: async () => ({ ok: true, combos: [], comboOnly: true }) }; }, 1000, true).then(() => {
  ok(/&combo=1$/.test(seen), 'proPriceRequest_ them combo=1 khi tich');
  console.log('ALL COMBO STEP2 TESTS PASSED'); });


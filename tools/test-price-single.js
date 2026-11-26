#!/usr/bin/env node
// Test HOI GIA 1 TU ("điếu") phai ra san pham nhu "hạt đồng điếu" (GAS: _priceVariantsForPrompt_ allowSingle, priceAsk_).
// NGUYEN NHAN GOC (Duyen 18/11/2026: tim "điếu" khong ra, "hạt đồng điếu" lai ra): _priceVariantsForPrompt_ bat buoc >= 2 TU KHOP ten SP (hit >= 2)
// de tranh bao gia nham — nen cau hoi chi 1 tu (toks.length == 1) khong bao gio dat nguong, roi rot xuong nhanh "goi y" thay vi hien gia.
// Chay: node tools/test-price-single.js -> "ALL PRICE-SINGLE TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const R = (ten, cl, size, gia, sap) => { const o = { 'Tên sản phẩm': ten, 'Chất liệu': cl, 'Kiểu/Size': size, 'Giá thường': gia }; if (sap) o['Giá SAPHIA'] = sap; return o; };
const rows = [
  R('HẠT ĐỒNG ĐIẾU LAM THỦY', 'BẠC 925', '', 990),
  R('HẠT ĐỒNG ĐIẾU HỒNG', 'BẠC 925', '', 890),
  R('VÒNG CUỐN 3', 'NGỌC BÍCH', 'SIZE 1', 4550),
  R('CHARM BI MẪU SỐ 10', 'VÀNG 10K', 'SIZE 3', 380),
  R('TRANG SỨC LẮC CÓ 4 LÁ', 'BẠC', '', 1200),
  R('LẮC TỲ HƯU THIÊN LỘC', 'BẠC', '', 9250),
  R('LẮC NGỌC TAM HỶ', 'BẠC', '', 9150),
  R('LẮC HỒ LY', 'BẠC', '', 7000),
];
const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, isFinite, encodeURIComponent,
  Logger: { log() {} }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, getProperties: () => ({}) }) },
  CacheService: { getScriptCache: () => ({ get: k => (k === 'price_catalog_v4' ? JSON.stringify(rows) : null), put() {}, putAll() {}, remove() {}, removeAll() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
  Utilities: { getUuid: () => 'x' } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8'), ctx, { filename: 'gas_v13.js' });

// 1) cau nhieu tu van chay nhu cu (khong hoi quy)
const multi = ctx._priceVariantsForPrompt_('hạt đồng điếu');
ok(/HẠT ĐỒNG ĐIẾU LAM THỦY/.test(multi) && /990/.test(multi), '"hạt đồng điếu" ra gia (hanh vi cu)');

// 2) CA LOI: 1 tu mac dinh (khong allowSingle) van KHONG ra -> chung to cau hoi khach/AI khac KHONG bi anh huong
ok(ctx._priceVariantsForPrompt_('điếu') === '', 'khong allowSingle: 1 tu van bo qua (khong nhet bang gia vao prompt chat khach)');

// 3) allowSingle (hoi gia chu dong): "điếu" ra DU 2 san pham dong dieu
const one = ctx._priceVariantsForPrompt_('điếu', { allowSingle: true });
ok(/HẠT ĐỒNG ĐIẾU LAM THỦY/.test(one) && /HẠT ĐỒNG ĐIẾU HỒNG/.test(one), '"điếu" allowSingle ra ca 2 san pham dong dieu');
ok(!/VÒNG CUỐN/.test(one) && !/CHARM/.test(one), '"điếu" khong keo san pham khong lien quan');
ok(/990/.test(one) && /890/.test(one), '"điếu" kem gia that');

// 3b) tu CHUNG nhieu SP (> 3 ten khac nhau) -> '' de client hien goi y chip, khong bao gia vo doan 3 SP bat ky
ok(ctx._priceVariantsForPrompt_('lắc', { allowSingle: true }) === '', '"lắc" khop 4 SP khac ten -> rong (de goi y chip)');
const lacSug = ctx.priceAsk_('lắc');
ok(lacSug.ok && lacSug.found === false && lacSug.suggestions.length >= 4, 'priceAsk_("lắc") -> found:false + goi y >= 4 ten: ' + JSON.stringify(lacSug).slice(0, 200));
// 4) tu nhieu nghia / tu nhieu: khong gay hoi quy
ok(ctx._priceVariantsForPrompt_('gia', { allowSingle: true }) === '', 'chi con tu nhieu (gia) -> rong');
ok(ctx._priceVariantsForPrompt_('khach hoi gia', { allowSingle: true }) === '', 'toan tu nhieu -> rong');
ok(ctx._priceVariantsForPrompt_('zzzz', { allowSingle: true }) === '', 'tu khong co trong bang -> rong');

// 5) khong dau / viet hoa / 1 tu so ("4")
ok(/HẠT ĐỒNG ĐIẾU/.test(ctx._priceVariantsForPrompt_('DIEU', { allowSingle: true })), 'DIEU khong dau hoa');
ok(ctx._priceVariantsForPrompt_('4', { allowSingle: true }) === '' || !/ĐIẾU/.test(ctx._priceVariantsForPrompt_('4', { allowSingle: true })), 'so 1 chu so khong keo SP khong lien quan');

// 6) action priceAsk (duong that cua tro ly AI "Gia san pham"): 1 tu -> found:true co gia
const a = ctx.priceAsk_('điếu');
ok(a.ok && a.found === true && /990/.test(a.text) && /890/.test(a.text), 'priceAsk_("điếu") found:true co gia');
const b = ctx.priceAsk_('hạt đồng điếu');
ok(b.ok && b.found === true && /990/.test(b.text), 'priceAsk_("hạt đồng điếu") van found:true');
const c = ctx.priceAsk_('xyzxyz');
ok(c.ok && c.found === false, 'priceAsk_ khong co -> found:false (khong bia)');

console.log('ALL PRICE-SINGLE TESTS PASSED');

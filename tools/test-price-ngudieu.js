// Test HOI GIA 1 TU ("điếu") phai ra san pham nhu "hạt đồng điếu" (GAS: _priceVariantsForPrompt_ allowSingle, priceAsk_).
// NGUYEN NHAN GOC (Duyen 18/11/2026: tim "điếu" khong ra, "hạt đồng điếu" lai ra): _priceVariantsForPrompt_ bat buoc >= 2 TU KHOP ten SP (hit >= 2)
// de tranh bao gia nham — nen cau hoi chi 1 tu (toks.length == 1) khong bao gio dat nguong, roi rot xuong nhanh "goi y" thay vi hien gia.
// Chay: node tools/test-price-single.js -> "ALL PRICE-SINGLE TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const R = (ten, cl, size, gia, sap) => { const o = { 'Tên sản phẩm': ten, 'Chất liệu': cl, 'Kiểu/Size': size, 'Giá thường': gia }; if (sap) o['Giá SAPHIA'] = sap; return o; };
const rows = [
  R('VÒNG TAY NGŨ ĐIẾU', 'CẨM THẠCH TYPE B', '', 1250),
  R('VÒNG TAY NGŨ ĐIẾU MIX LU', 'CẨM THẠCH TYPE B', '', 1650),
  R('VÒNG TAY NGŨ ĐIẾU MIX CỎ', 'CẨM THẠCH TYPE B', '', 1650),
  R('CHARM NGŨ ĐIẾU MINI MIX (5 ĐIẾU)', 'BẠCH NGỌC', 'MINI', 250),
  R('VÒNG TAY ĐỒNG NGŨ ĐIẾU DÒNG A', 'ĐỒNG', '', 300),
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

const t = "// Test: tim 'ngu dieu' phai ra CA 'CHARM NGU DIEU MINI MIX' (khong bi cat o 3 SP dau). NGUYEN NHAN GOC: maxNames = 3 cat cung theo thu tu sheet.";
const a = ctx._priceVariantsForPrompt_('Ngũ điếu', { allowSingle: true });
ok(/CHARM NGŨ ĐIẾU MINI MIX/.test(a), '"Ngũ điếu" phai ra charm ngu dieu mini mix');
ok(/VÒNG TAY NGŨ ĐIẾU MIX CỎ/.test(a) && /VÒNG TAY ĐỒNG NGŨ ĐIẾU DÒNG A/.test(a), '"Ngũ điếu" ra du ca vong tay');
const b = ctx._priceVariantsForPrompt_('mini', { allowSingle: true });
ok(/CHARM NGŨ ĐIẾU MINI MIX/.test(b) && /250/.test(b), '"mini" ra charm mini kem gia');
const c = ctx._priceVariantsForPrompt_('Ngũ điếu');
ok((c.match(/SẢN PHẨM:/g) || []).length <= 3, 'AI chat khach (khong allowSingle) van gioi han 3 SP');
console.log('ALL NGUDIEU TESTS PASSED');

#!/usr/bin/env node
// Test TIM BANG GIA (Tro ly AI "Gia san pham") khi chu o dang TO HOP (NFD: "a" + dau roi) — sheet DANH_MUC dan tu Mac/iOS, hoac cau hoi gui tu Mac/iOS.
// NGUYEN NHAN GOC (Duyen 18/11/2026 "search bang gia AI loi"): _stripVN_ chi doi bang ky tu DUNG SAN (NFC); chu NFD giu nguyen dau roi, roi regex [^a-z0-9\s] biet dau roi
// thanh khoang trang -> ten SP vo thanh "ha t do ng die u" -> KHONG tu nao khop (ca "hạt đồng điếu" day du cung khong ra).
// Chay: node tools/test-price-nfd.js -> "ALL PRICE-NFD TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok   ' + m); };
const D = s => String(s).normalize('NFD');
const mk = (ten, cl, size, gia, nfd) => ({ 'Tên sản phẩm': nfd ? D(ten) : ten, 'Chất liệu': nfd ? D(cl) : cl, 'Kiểu/Size': size, 'Giá thường': gia });
function load(nfd) {
  const rows = [mk('HẠT ĐỒNG ĐIẾU LAM THỦY', 'BẠC 925', '', 990, nfd), mk('HẠT ĐỒNG ĐIẾU HỒNG', 'BẠC 925', '', 890, nfd), mk('VÒNG CUỐN 3', 'NGỌC BÍCH', 'SIZE 1', 4550, nfd),
    mk('LẮC TỲ HƯU THIÊN LỘC', 'BẠC', '', 9250, nfd), mk('LẮC HỒ LY', 'BẠC', '', 7000, nfd), mk('NHẪN TRƠN 3 LI', 'VÀNG 18K', 'SIZE 10', 2100, nfd)];
  const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, isFinite, encodeURIComponent,
    Logger: { log() {} }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, getProperties: () => ({}) }) },
    CacheService: { getScriptCache: () => ({ get: k => (k === 'price_catalog_v4' ? JSON.stringify(rows) : null), put() {}, putAll() {}, remove() {}, removeAll() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) }, Utilities: { getUuid: () => 'x' } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8'), ctx, { filename: 'gas_v13.js' });
  return ctx;
}
for (const nfd of [false, true]) {
  const ctx = load(nfd), tag = nfd ? 'sheet NFD' : 'sheet NFC';
  for (const asNfd of [false, true]) {
    const q = s => (asNfd ? D(s) : s), qt = tag + ', cau hoi ' + (asNfd ? 'NFD' : 'NFC');
    let a = ctx.priceAsk_(q('hạt đồng điếu'));
    ok(a.ok && a.found === true && /990/.test(a.text) && /890/.test(a.text), qt + ': "hạt đồng điếu" ra gia 990 + 890');
    a = ctx.priceAsk_(q('điếu'));
    ok(a.found === true && /990/.test(a.text), qt + ': "điếu" (1 tu) ra gia');
    a = ctx.priceAsk_(q('tỳ hưu'));
    ok(a.found === true && /9250/.test(a.text), qt + ': "tỳ hưu" ra LẮC TỲ HƯU 9250');
    a = ctx.priceAsk_(q('giá lắc hồ ly bao nhiêu'));
    ok(a.found === true && /7000/.test(a.text), qt + ': "giá lắc hồ ly bao nhiêu" ra 7000');
    a = ctx.priceAsk_(q('nhẫn trơn 3 li'));
    ok(a.found === true && /2100/.test(a.text), qt + ': "nhẫn trơn 3 li" ra 2100');
  }
  ok(ctx.priceAsk_('xyzxyz').found === false, tag + ': tu khong co -> found:false (khong bia)');
  ok(ctx._stripVN_(D('Điếu Hạt Đồng')) === 'dieu hat dong', tag + ': _stripVN_ gom to hop ve khong dau');
}
console.log('ALL PRICE-NFD TESTS PASSED');

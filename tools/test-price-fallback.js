#!/usr/bin/env node
// Test DANH SACH GIA DU PHONG GON (GAS priceQa_ khi AI loi): gom theo chat lieu, SIZE lien tiep kem gia DONG, chat lieu trong = cung dong tren, o chat lieu nhieu dong.
// NGUYEN NHAN GOC (Duyen 21/11/2026, kem anh): AI loi -> hien danh sach gia goc moi SIZE 1 dong "- Chat lieu: ... | Kieu/Size: SIZE 1 | Gia thuong: 6350" (gia nghin chua doi ra dong; o chat lieu nhieu dong lam SIZE 1 vo dong;
// size 2,3 ghi "(khong ghi)"). Ham gom phia client (compactPriceText_) khong xu ly duoc ca nay. Chay: node tools/test-price-fallback.js -> "ALL PRICE-FALLBACK TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.error('FAIL: ' + m); } else console.log('ok   ' + m); };
const R = (ten, cl, size, gia, extra) => Object.assign({ 'Nhóm sản phẩm': 'NHẪN 10K', 'Tên sản phẩm': ten, 'Chất liệu': cl, 'Kiểu/Size': size, 'Giá thường': gia }, extra || {});
const MAT1 = 'VÀNG 10K\nNgọc bích, lam thủy, cẩm thạch type B\nĐá Tourmaline ( Xanh lá, vàng, hồng tím )\nĐá moon trắng';
let rows = [
  R('TRANG SỨC NHẪN TỶ HƯU THIÊN LỘC', MAT1, 'SIZE 1', 6350), R('TRANG SỨC NHẪN TỶ HƯU THIÊN LỘC', '', 'SIZE 2', 7350), R('TRANG SỨC NHẪN TỶ HƯU THIÊN LỘC', '', 'SIZE 3', 8350),
  R('VÒNG CUỐN BẠC', 'BẠC 925', '12', 450), R('VÒNG CUỐN BẠC', 'BẠC 925', '13', 480), R('VÒNG CUỐN BẠC', 'VÀNG 10K', '12', '2.310', { 'Giá RUBY': 2900 }), R('VÒNG CUỐN BẠC', 'BẠC 925', '14', 510),
  R('CHARM ĐƠN GIẢN', 'BẠC', '', 120), R('CHARM ĐƠN GIẢN', 'BẠC', '(mặc định)', 130),
];
const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, parseFloat, isNaN, isFinite, encodeURIComponent,
  Logger: { log() {} }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, getProperties: () => ({}) }) },
  CacheService: { getScriptCache: () => ({ get: k => (k === 'price_catalog_v4' ? JSON.stringify(rows) : null), put() {}, putAll() {}, remove() {}, removeAll() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) }, Utilities: { getUuid: () => 'x' } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8'), ctx, { filename: 'gas_v13.js' });
const aiFail = () => { ctx.callAI_ = () => { throw new Error('quota het'); }; };
const eq = (a, b, m) => ok(a === b, m + (a === b ? '' : '\n--- được:\n' + a + '\n--- cần:\n' + b));

// 1) CA TRONG ANH
aiFail(); let r = ctx.priceQa_('nhẫn tỷ hưu thiên lộc');
ok(r.ok && r.found && r.aiError, 'AI loi -> found + aiError (danh sach du phong)');
eq(r.text, ['Giá theo bảng giá:', '', 'SẢN PHẨM: TRANG SỨC NHẪN TỶ HƯU THIÊN LỘC',
  'Chất liệu: VÀNG 10K · Ngọc bích, lam thủy, cẩm thạch type B · Đá Tourmaline ( Xanh lá, vàng, hồng tím ) · Đá moon trắng',
  '• SIZE 1: 6.350.000đ', '• SIZE 2: 7.350.000đ', '• SIZE 3: 8.350.000đ'].join('\n'), 'ca trong anh: ten 1 lan, chat lieu 1 lan, 3 size lien tiep gia DONG (o chat lieu nhieu dong gop 1 dong; size 2,3 chat lieu trong = cung chat lieu)');
ok(!/\(không ghi\)/.test(r.text) && !/6350/.test(r.text) && !/\| Kiểu\/Size/.test(r.text), 'khong con "(khong ghi)", gia nghin tho, hay dong "| Kieu/Size"');
ok(/- Chất liệu: VÀNG 10K\nNgọc bích/.test(r.base) && /\| Kiểu\/Size: SIZE 1 \| Giá thường: 6350/.test(r.base), 'r.base (chuoi cho prompt AI) GIU NGUYEN dang cu — khong anh huong prompt');

// 2) nhieu chat lieu, chat lieu khong lien tiep van gop, size so -> "size N", gia RUBY
r = ctx.priceQa_('vòng cuốn bạc');
eq(r.text, ['Giá theo bảng giá:', '', 'SẢN PHẨM: VÒNG CUỐN BẠC', 'Chất liệu: BẠC 925', '• size 12: 450.000đ', '• size 13: 480.000đ', '• size 14: 510.000đ', 'Chất liệu: VÀNG 10K', '• size 12: 2.310.000đ'].join('\n'),
  'nhieu chat lieu: BAC 925 gom ca dong khong lien tiep (12,13,14), 2.310 = 2.310.000đ, size so -> "size N"');
// 3) khong size
r = ctx.priceQa_('charm đơn giản'); eq(r.text, ['Giá theo bảng giá:', '', 'SẢN PHẨM: CHARM ĐƠN GIẢN', 'Chất liệu: BẠC', '• 120.000đ', '• 130.000đ'].join('\n'), 'khong co size / "(mac dinh)": chi gia, khong ghi "(mac dinh)"');
// 4) hoi loai da -> gia RUBY kem nhan
r = ctx.priceQa_('vòng cuốn bạc ruby'); ok(/Giá RUBY 2\.900\.000đ/.test(r.text) && /không có giá riêng cho RUBY/.test(r.text), 'hoi RUBY: nhan gia + ghi chu "khong co gia rieng" giu nguyen: ' + r.text.split('\n').slice(0, 6).join(' / '));
// 5) ham dinh dang
const F = ctx._priceFmtDong_;
ok(F('2.310') === '2.310.000đ' && F('6350') === '6.350.000đ' && F(990) === '990.000đ' && F('6,5') === '6.500đ' && F('6350đ') === '6.350.000đ', 'dinh dang dong: 2.310 / 6350 / 990 / 6,5 / 6350đ');
ok(F('') === '' && F('liên hệ') === 'liên hệ' && F('0') === '0', 'gia rong / chu / 0 giu nguyen, khong bia');
ok(ctx._priceFmtPrices_(['Giá thường: 6350', 'Giá RUBY: 7000']) === 'Giá thường 6.350.000đ · Giá RUBY 7.000.000đ', 'nhieu gia -> kem nhan');
// 6) AI thanh cong: khong doi gi
ctx.callAI_ = () => ({ getContent: () => JSON.stringify({ ok: true, text: 'Nhẫn size 1 là 6.350.000đ ạ', provider: 'groq' }) });
r = ctx.priceQa_('nhẫn tỷ hưu thiên lộc'); ok(r.text === 'Nhẫn size 1 là 6.350.000đ ạ' && !r.aiError && r.provider === 'groq', 'AI thanh cong: tra nguyen van AI, khong aiError');
// 7) hinh dang ket qua priceAsk_ khong doi (khong ro ri truong moi), khong tim thay
const pa = ctx.priceAsk_('nhẫn tỷ hưu thiên lộc'); ok(pa.found === true && !('blocks' in pa) && typeof pa.text === 'string', 'priceAsk_ khong them truong moi vao ket qua cong khai: ' + Object.keys(pa).join());
aiFail(); r = ctx.priceQa_('zzzzqqq'); ok(r.ok && r.found === false, 'khong tim thay -> found:false (khong goi AI, khong bia)');
// 8) nhieu san pham -> moi san pham 1 khoi
rows = rows.concat([R('TRANG SỨC NHẪN TỶ HƯU THIÊN LỘC BẠC', 'BẠC', 'SIZE 1', 1500)]);
r = ctx.priceQa_('nhẫn tỷ hưu thiên lộc'); ok((r.text.match(/SẢN PHẨM:/g) || []).length >= 1 && /1\.500\.000đ|6\.350\.000đ/.test(r.text), 'nhieu SP khop: van hien gia dong');
console.log(bad ? '\n' + bad + ' LOI' : '\nALL PRICE-FALLBACK TESTS PASSED'); process.exit(bad ? 1 : 0);

#!/usr/bin/env node
// Test: Zalo AI — moi loi API cua cac ham goi {ok,error} chi hien 1 cau "Lỗi API" (extension-zalo/zalo-content.js _zaiApiErr_), SONG SONG voi Pancake AI (tools/test-pancake-apierr.js, ddaf130 / Duyen 22/10/2026).
// Chay: node tools/test-zalo-apierr.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'extension-zalo', 'zalo-content.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok   ' + m); };
const warns = [];
const hc = /const ZAI_API_ERR = [^\n]*;/.exec(src)[0];
const i = src.indexOf('function _zaiApiErr_(');
let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) { j = k + 1; break; } }
const ctx = { console: { warn: (...a) => warns.push(a.join(' ')) }, String }; vm.createContext(ctx);
vm.runInContext(hc.replace('const ZAI_API_ERR', 'var ZAI_API_ERR') + '\n' + src.slice(i, j), ctx);
const E = (tag, raw) => ctx._zaiApiErr_(tag, raw);
let r = E('GET_PRICE_FLAT', 'Failed to fetch');
ok(r.ok === false && r.error === 'Lỗi API' && r.errorRaw === 'Failed to fetch', 'loi mang/GAS -> "Lỗi API", giu errorRaw de tra');
ok(warns.length === 1 && /Failed to fetch/.test(warns[0]), 'chi tiet goc di vao console.warn');
ok(E('X', 'Groq 429: rate limit ... try again in 12s').error === 'Lỗi API', 'loi dai -> "Lỗi API"');
ok(E('GET_PRICE_FLAT', 'GAS_NO_FLAT').error === 'GAS_NO_FLAT' && E('GET_CTKM', 'GAS_NO_CTKM').error === 'GAS_NO_CTKM', 'ma noi bo GAS_NO_FLAT / GAS_NO_CTKM giu nguyen (code so khop chuoi)');
ok(E('X', 'Chưa cài đặt URL GAS. Nhấn ⚙.').error.indexOf('Chưa cài đặt') === 0 && E('csStats', 'Chưa chọn CS.').error === 'Chưa chọn CS.' && E('GET_DRIVE_IMAGE', 'Thiếu link ảnh.').error === 'Thiếu link ảnh.', 'thieu URL / chua chon CS / thieu link: giu huong dan');
ok(E('X', undefined).error === 'Lỗi API' && E('X', '').errorRaw === '', 'loi rong -> van "Lỗi API"');
// 4 ham goi + cho hien thi: khong con tien to "Lỗi ...:" truoc loi API (tranh "Lỗi: Lỗi API")
ok((src.match(/return _zaiApiErr_\(/g) || []).length >= 5, 'cac ham _zaiBldCall_/_zaiImgCall_/_zaiTplCall_/_zaiFetchCsStats_ deu tra qua _zaiApiErr_');
ok(!/'Lỗi (tải danh mục|tìm|xoá mẫu|lưu mẫu): ' \+ (escAttrZai_)?\(?resp/.test(src) && !/>Lỗi: \$\{escAttrZai_\(resp\?\.error/.test(src), 'khong con tien to "Lỗi ...:" truoc loi cua resp');
console.log('ALL ZALO-APIERR TESTS PASSED');

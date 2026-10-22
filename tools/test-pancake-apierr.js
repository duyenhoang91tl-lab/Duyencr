#!/usr/bin/env node
// Test: Pancake AI — moi loi API chi hien 1 cau "Lỗi API" (extension-pancake/pancake-content.js normalizeApiResp_). Chay: node tools/test-pancake-apierr.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok   ' + m); };
const i = src.indexOf("const PK_API_ERR"); const j = src.indexOf('function safeSendMessage_');
const ctx = { console: { warn() {} }, String, Object }; vm.createContext(ctx); vm.runInContext(src.slice(i, j).replace('const PK_API_ERR', 'var PK_API_ERR'), ctx);
const N = (type, resp) => ctx.normalizeApiResp_({ type }, resp);
let r = N('LOOKUP_CUSTOMER', { ok: false, error: 'Không gọi được GAS: Failed to fetch' });
ok(r.error === 'Lỗi API' && r.errorRaw === 'Không gọi được GAS: Failed to fetch', 'loi mang/GAS -> "Lỗi API", giu errorRaw de tra');
r = N('FETCH_SUGGESTION', { ok: false, error: 'Groq 429: rate limit ... try again in 12s' });
ok(r.error === 'Lỗi API', 'loi AI dai -> "Lỗi API"');
ok(N('VERIFY_LOGIN', { ok: false, error: 'Sai mật khẩu' }).error === 'Sai mật khẩu', 'dang nhap: giu thong bao sai mat khau');
ok(N('GET_FLAT', { ok: false, error: 'GAS_NO_FLAT' }).error === 'GAS_NO_FLAT', 'ma noi bo GAS_NO_FLAT giu nguyen (code so khop)');
ok(N('FETCH_SUGGESTION', { ok: false, error: 'Chưa cấu hình URL Web App GAS...' }).error.indexOf('Chưa cấu hình') === 0, 'thieu cau hinh: giu huong dan');
ok(N('X', { ok: true, data: 1 }).ok === true && N('X', undefined) === undefined, 'ket qua thanh cong / khong co phan hoi: khong dong vao');
ok(!/Lỗi: \$\{escapeHtml\(resp\?\.error/.test(src) && !/'Lỗi[^']*: ' \+ \(?resp\?\.error/.test(src), 'khong con tien to "Lỗi ...:" truoc loi API (tranh "Lỗi: Lỗi API")');
console.log('ALL PANCAKE-APIERR TESTS PASSED');

// Test _reportCacheKey_: khoa cache bao cao KHONG vuot 250 ky tu du chon nhieu Sale (loi "Argument too large: key"). Chay: node tools/test-report-cache-key.js
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const i = src.indexOf('function _reportCacheKey_(prefix, filters) {'), j = src.indexOf('function _scopeReport_() {');
const ctx = { JSON, String, Utilities: { DigestAlgorithm: { MD5: 'MD5' }, Charset: { UTF_8: 'u8' },
  computeDigest: (alg, s) => Array.from(crypto.createHash('md5').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b) } };   // GAS tra byte co dau (-128..127)
vm.createContext(ctx); vm.runInContext(src.slice(i, j), ctx);
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
const sales = ['anhtrinh1995', 'trangNH2005', 'yenNTH2004', 'ninhLTK1984', 'anhNP1999', 'Thuydinh1995', 'ninhnga99', 'phuongthao2000', 'thanhNP', 'haPTN', 'Biichnguyen1993', 'Dungnguyen1995', 'Huongly1998', 'huyenmaii1990', 'minhquach1995', 'Nguyễn Thị Hải Yến'];
const f = sale => ({ dateFrom: '01/10/2026', dateTo: '31/10/2026', dateField: 'ngayTao', sale, kenh: [], sanPham: '', byCreator: false });
const long = ctx._reportCacheKey_('salesA_', f(sales));
ok(('salesA_' + JSON.stringify(f(sales))).length > 250, 'bo loc 16 Sale that su vuot 250 ky tu (' + ('salesA_' + JSON.stringify(f(sales))).length + ') — dung ca gay loi');
ok(long.length <= 250 && /^salesA_h_[0-9a-f]{32}$/.test(long), 'khoa dai duoc rut gon: ' + long);
ok(long === ctx._reportCacheKey_('salesA_', f(sales)), 'cung bo loc -> cung khoa (cache dung duoc)');
ok(long !== ctx._reportCacheKey_('salesA_', f(sales.slice(1))), 'bo loc khac -> khoa khac');
ok(ctx._reportCacheKey_('salesB4_', f(sales)) !== long, 'prefix khac nhau (A/B/C/G) -> khong dung chung khoa');
const short = ctx._reportCacheKey_('salesA_', f(['saleA']));
ok(short === 'salesA_' + JSON.stringify(f(['saleA'])) && short.length <= 200, 'khoa ngan GIU NGUYEN nhu cu (khong doi hanh vi)');
ok(ctx._reportCacheKey_('salesC_', f([])).indexOf('salesC_{') === 0, 'khong loc Sale: giu nguyen');
const many = ctx._reportCacheKey_('salesG_pos3_', Object.assign(f(sales), { nguon: sales, marketer: sales }));
ok(many.length <= 250 && /h_[0-9a-f]{32}$/.test(many), 'ca nguon/marketer rat dai van <= 250');
console.log('ALL REPORT CACHE KEY TESTS PASSED');

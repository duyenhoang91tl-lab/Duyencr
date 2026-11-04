// Test: ép sale theo từng đơn (Settings orderSaleOverride) — gas_v13.js _orderSaleOvrMap_/_applyOrderSaleOvr_. Chạy: node tools/test-order-sale-override.js
const fs = require('fs'); const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thieu ' + n); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] == '{') d++; else if (src[k] == '}') { d--; if (!d) return src.slice(i, k + 1); } } }
let SETTING = {}; const re = src.match(/var COUNTER_CODE_INNER_ = [^\n]*/)[0] + '\n' + src.match(/var COUNTER_CODE_RE_SRC_ = [^\n]*/)[0];
const mod = new Function('S', 'var __s=S;function _csJsonSetting_(k,f){return __s[k]===undefined?f:JSON.parse(__s[k]);}\n' + re + '\n' +
  ['_normCounterCode_', '_counterCodeNoYear_', '_extractCounterCodes_'].map(grab).join('\n') + '\n' + ['_orderSaleOvrMap_', '_applyOrderSaleOvr_'].map(grab).join('\n') + '\nreturn {m:_orderSaleOvrMap_,a:_applyOrderSaleOvr_};');
let bad = 0; const ok = (c, t) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if (!c) bad++; };
const cfg = { orderSaleOverride: JSON.stringify({ '162t10/2026': 'yenNTH2004', '430T10': ' thuyha88 ', 'X1T10/2026': '' }) };
const M = mod(cfg).m(); const A = mod(cfg).a;
ok(M['162T10'] === 'yenNTH2004' && M['430T10'] === 'thuyha88' && !('X1T10' in M), 'map chuẩn hoá: hoa/thường, bỏ năm, cắt khoảng trắng, bỏ tên rỗng');
// đơn ghép Base chia đôi Yến+Hà → ép 100% Yến, giữ nguyên giá trị đơn
let r = A({ ghiChu: '162T10/2026', giaTriSauGiam: 15060000, ghepShares: [{ name: 'yenNTH2004', frac: .5 }, { name: 'thuyha88', frac: .5 }], ghepDu: 1060000, ghepDuSale: 'thuyha88' }, ['162T10/2026'], M);
ok(r.ghepShares.length === 1 && r.ghepShares[0].name === 'yenNTH2004' && r.ghepShares[0].frac === 1 && r.giaTriSauGiam === 15060000 && r.ghepDu === undefined, '162T10 đơn ghép → 100% Yến (15.060.000), bỏ phần dư chia Hà');
// đơn không ghép được (thẻ Pos 2 người) → theSale = Hà
r = A({ ghiChu: '430T10/2026', theSale: 'yenNTH2004, thuyha88' }, [], M);
ok(r.theSale === 'thuyha88' && r.saleOvr === 'thuyha88', '430T10 không ghép Base → thẻ ép thành Hà (lấy mã từ ghi chú khi codes rỗng)');
// đơn khác không đổi; không có setting → không đổi
const o3 = { ghiChu: '999T10/2026', theSale: 'a, b' }; ok(A(o3, ['999T10/2026'], M) === o3, 'đơn khác giữ nguyên (cùng đối tượng)');
ok(A(o3, [], mod({}).m()) === o3 && Object.keys(mod({}).m()).length === 0, 'chưa cài setting → không đổi gì');
process.exit(bad ? 1 : 0);

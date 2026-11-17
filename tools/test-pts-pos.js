// Tích điểm: tính theo đơn Pos nếu khách có đơn Pos, không thì lùi về Base (Duyên chốt 16/11/2026). Chạy: node tools/test-pts-pos.js
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../js/05-fn-saveeditphone.js', 'utf8');
const a = src.indexOf('function _ptsFold_'), b = src.indexOf('function fmtVND');
assert(a > 0 && b > a, 'không tìm thấy khối tích điểm');
const ctx = { PTS_RATE: 0.01, PTS_VALUE: 1000, _posOrdersCache: {} }; vm.createContext(ctx); vm.runInContext(src.slice(a, b), ctx);
let ok = 0; const t = (n, f) => { f(); ok++; console.log('ok  ' + n); };
const base = { phone: '0901', orders: [{ revenue: 1235000, note: '' }] };
t('chưa có đơn Pos → Base: 1.235.000đ = 12 điểm', () => { const p = ctx._ptsOfCustomer_(base); assert.equal(p.src, 'base'); assert.equal(p.earned, 12); assert.equal(p.n, 1); });
ctx._posOrdersCache['0901'] = [{ revenue: 1235000, note: '' }, { revenue: 5900000, note: 'Tích điểm: tiêu 50k' }, { revenue: 3000000, note: '' }];
t('có đơn Pos → dùng Pos, KHÔNG cộng thêm Base (12+59+30=101, tiêu 50)', () => { const p = ctx._ptsOfCustomer_(base); assert.equal(p.src, 'pos'); assert.equal(p.n, 3); assert.equal(p.earned, 101); assert.equal(p.spent, 50); assert.equal(p.left, 51); });
t('per khoá theo đúng dòng Pos', () => { const p = ctx._ptsOfCustomer_(base); assert.equal(p.per.get(ctx._posOrdersCache['0901'][1]).earn, 59); });
t('Pos rỗng → lùi về Base', () => { ctx._posOrdersCache['0901'] = []; assert.equal(ctx._ptsOfCustomer_(base).src, 'base'); });
t('khách khác không dính cache của khách này', () => { ctx._posOrdersCache['0901'] = [{ revenue: 1000000 }]; assert.equal(ctx._ptsOfCustomer_({ phone: '0999', orders: [] }).src, 'base'); });
t('hộp điểm ghi rõ nguồn', () => { ctx._posOrdersCache['0901'] = [{ revenue: 1000000 }]; assert(ctx._ptsBoxHtml_(ctx._ptsOfCustomer_(base)).includes('theo 1 đơn Pos')); });
console.log(ok + '/6 đạt');

#!/usr/bin/env node
// Test GIA NIEM YET THEO POS cho form combo (GAS): don gia tung SP tu cot T, don gan nhat thang, bo don huy/hoan, khop ten/size/chat lieu, action posPrice.
// Chay: node tools/test-pos-price.js -> "ALL POS-PRICE TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, isFinite, encodeURIComponent,
  Logger: { log() {} }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, getProperties: () => ({}) }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, putAll() {}, remove() {}, removeAll() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
  Utilities: { getUuid: () => 'x' } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8'), ctx, { filename: 'gas_v13.js' });
const row = (o) => { const r = new Array(20).fill(''); r[1] = o.d; r[8] = o.names; r[9] = o.codes || ''; r[10] = o.qty; r[14] = o.st || ''; r[19] = o.gia; return r; };

// 1) don gia tung SP (vi du POS Duyen gui: 3 mau ma, 5 SP)
const parts = ctx._donListPriceParts_('4.550.000;380.000;6.350.000', '1,3,1');
ok(parts && parts.join() === '4550000,380000,6350000', 'tach 3 don gia');
ok(ctx._donListPriceParts_('4.550.000;380.000', '1,3,1') === null, 'lech so luong -> null (khong doan)');
ok(ctx._donListPriceParts_(380000, '3').join() === '380000', 'o so 1 SP');
ok(ctx._donListPriceParts_('', '1') === null && ctx._donListPriceParts_('abc', '1') === null, 'rong/rac -> null');

const vals = [
  row({ d: '10/11/2026', names: 'VÒNG CUỐN 3 (NG BÍCH)', codes: 'VC3-NB', qty: '1', gia: '4.300.000' }),                     // cu hon
  row({ d: '12/11/2026', names: 'VÒNG CUỐN 3 (NG BÍCH),CHARM BI MẪU SỐ 10 SIZE 3,TRANG SỨC NHẪN TÚI TIỀN (NGỌC BÍCH)', codes: 'VC3-NB;CV10K-BV-SIZE 3;NTT-NB', qty: '1,3,1', gia: '4.550.000;380.000;6.350.000' }),
  row({ d: '15/11/2026', names: 'VÒNG CUỐN 3 (NG BÍCH)', codes: 'VC3-NB', qty: '1', st: 'Hủy đơn', gia: '9.999.000' }),                    // huy -> bo
  row({ d: '', names: 'NHẪN BẠC TRƠN SIZE 12', codes: 'NBT-12', qty: '2', gia: '450.000' }),                                       // thieu ngay -> ke thua 15/11
  row({ d: '16/11/2026', names: 'DÂY CHUYỀN A,DÂY CHUYỀN B', codes: 'A;B', qty: '1,1', gia: '100.000' }),                           // lech gia -> bo
];
const list = ctx._posLastPricesFromRows_(vals);
const by = n => list.find(x => x.n === n);
ok(by('VÒNG CUỐN 3 (NG BÍCH)').p === 4550000 && by('VÒNG CUỐN 3 (NG BÍCH)').d === '2026-11-12', 'don gan nhat thang (12/11 4.550.000), don huy 15/11 bi bo');
ok(by('CHARM BI MẪU SỐ 10 SIZE 3').p === 380000 && by('TRANG SỨC NHẪN TÚI TIỀN (NGỌC BÍCH)').p === 6350000, 'cac SP con lai cua don 3 mau ma');
ok(by('NHẪN BẠC TRƠN SIZE 12').d === '2026-11-15' && by('NHẪN BẠC TRƠN SIZE 12').p === 450000, 'dong thieu ngay ke thua ngay dong tren');
ok(!by('DÂY CHUYỀN A'), 'don lech so gia/SP bi bo');
// thu tu dong khong theo ngay: dong SAU nhung ngay CU hon khong de len
const l2 = ctx._posLastPricesFromRows_([ row({ d: '20/11/2026', names: 'X', qty: '1', gia: '200.000' }), row({ d: '01/11/2026', names: 'X', qty: '1', gia: '100.000' }) ]);
ok(l2.length === 1 && l2[0].p === 200000, 'don ngay moi hon thang du nam tren');

// 2) khop ten / size / chat lieu
const m = q => ctx._posMatchOne_(list, q);
let r = m({ t: 'Vòng cuốn 3', c: 'Ngọc bích' });
ok(r.found && r.price === 4550000 && r.code === 'VC3-NB' && r.date === '2026-11-12', 'Vong cuon 3 + chat lieu viet tat NG BICH van ra gia POS');
r = m({ t: 'Charm bi mẫu số 10', s: 'Size 3' });
ok(r.found && r.price === 380000, 'khop size 3');
ok(!m({ t: 'Charm bi mẫu số 10', s: 'Size 4' }).found, 'size khac -> khong tra gia size khac');
ok(!m({ t: 'Charm bi mẫu số 1', s: 'Size 3' }).found, 'token 1 khong khop nham 10 (khop theo tu nguyen)');
ok(m({ t: 'Tên khác hẳn', m: 'Nhẫn túi tiền' }).found, 'khop theo ten thuong mai m khi t khong khop');
ok(!m({}).found && !m({ t: 'zzz' }).found, 'rong / khong co');
// nhieu dong cung ten: uu tien khop chat lieu
const l3 = [{ n: 'NHẪN TRƠN (VÀNG)', c: '', p: 1, d: '2026-11-01' }, { n: 'NHẪN TRƠN (BẠC)', c: '', p: 2, d: '2026-10-01' }];
ok(ctx._posMatchOne_(l3, { t: 'Nhẫn trơn', c: 'Bạc' }).price === 2, 'uu tien chat lieu khop dung du don cu hon');

// 3) doc sheet (cat N dong cuoi) + action
let rows = vals.slice();
const sheet = { getLastRow: () => rows.length + 1, getMaxColumns: () => 30, getRange: (rr, c, nr, nc) => ({ getValues: () => rows.slice(rr - 2, rr - 2 + nr).map(x => x.slice(0, nc)) }) };
ctx.getDTSS_ = () => ({ getSheetByName: n => (n === 'dữ liệu đơn' ? sheet : null) });
const J = o => JSON.parse(o.getContent());
const res = ctx.posPrice_(JSON.stringify([{ t: 'Vòng cuốn 3', c: 'Ngọc bích' }, { t: 'Charm bi mẫu số 10', s: 'Size 9' }]));
ok(res.ok && res.results.length === 2 && res.results[0].price === 4550000 && !res.results[1].found, 'posPrice_ song song voi q');
ok(!ctx.posPrice_('khong phai json').ok && !ctx.posPrice_('{"a":1}').ok, 'q sai -> loi ro rang');
ok(ctx.posPrice_(JSON.stringify(new Array(60).fill({ t: 'x' }))).results.length === 40, 'toi da 40 query');
ctx.getDTSS_ = () => ({ getSheetByName: () => null });
ok(ctx.posPrice_('[{"t":"a"}]').results[0].found === false, 'khong co sheet -> khong co gia (khong vo)');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
ok(/action === 'posPrice'\) return jsonOut_\(posPrice_\(/.test(src), 'doGet co action posPrice');
console.log('ALL POS-PRICE TESTS PASSED');

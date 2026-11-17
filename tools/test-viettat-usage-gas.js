#!/usr/bin/env node
// Test (2026-11-14): Viet tat — DONG BO LUOT DUNG giua cac may (vietTatUsage_ trong gas_v13.js, sheet/Lock gia).
// Quy tac: cong don delta + tra ve tong; rieng tu tung nguoi; chua biet ten -> FORBIDDEN; chong phinh; du lieu hong khong lam vo; doPost co route. Chay: node tools/test-viettat-usage-gas.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function fn(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('thieu ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
function line(re) { const m = re.exec(src); if (!m) throw new Error('thieu ' + re); return m[0]; }
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const code = [line(/var SH_VIETTAT_USAGE = [^\n]*;/), line(/var VIETTAT_USAGE_MAX_IDS = [^\n]*;/), ...['_stripVN_', '_vtKey_', '_vtSame_', 'vietTatUsage_'].map(fn)].join('\n');
const rows = [], held = { n: 0, max: 0, fail: false };
const sheet = {
  getLastRow: () => rows.length + 1,
  getRange(r, c, nr, nc) { nr = nr || 1; nc = nc || 1; return {
    getValues: () => rows.slice(r - 2, r - 2 + nr).map(x => x.slice(c - 1, c - 1 + nc)),
    setValues: v => { v.forEach((x, i) => x.forEach((y, q) => { rows[r - 2 + i][c - 1 + q] = y; })); } }; },
  appendRow: r => rows.push(r.slice()) };
const LockService = { getScriptLock: () => ({ waitLock() { if (held.fail) throw new Error('timeout'); held.n++; held.max = Math.max(held.max, held.n); }, releaseLock() { held.n--; } }) };
const ctx = { JSON, Object, Array, String, Number, Date, Math, LockService, getSheet_: () => sheet };
vm.createContext(ctx); vm.runInContext(code, ctx);
const hoa = { priv: false, name: 'Hoa' }, binh = { priv: false, name: 'Binh' }, anon = { priv: false, name: '' };
const U = (d, c) => ctx.vietTatUsage_({ delta: d }, c);
const total = (r) => JSON.stringify(Object.keys(r.counts).sort().map(k => [k, r.counts[k]]));

ok(U({ a: 1 }, anon).code === 'FORBIDDEN' && rows.length === 0, 'chua biet ten -> FORBIDDEN, khong ghi gi');
ok(ctx.vietTatUsage_(null, hoa).ok && JSON.stringify(ctx.vietTatUsage_(undefined, hoa).counts) === '{}' && rows.length === 0, 'delta rong lan dau: tra {} va KHONG tao dong (chi keo tong)');
let r = U({ vt_1: 2, vt_2: 1 }, hoa); ok(r.ok && total(r) === '[["vt_1",2],["vt_2",1]]' && rows.length === 1 && rows[0][0] === 'Hoa', 'lan dau: tao 1 dong cho Hoa + tra tong');
r = U({ vt_1: 3, tpl_mt_7: 1 }, hoa); ok(total(r) === '[["tpl_mt_7",1],["vt_1",5],["vt_2",1]]' && rows.length === 1, 'cong don (2+3=5), id muc tu Mau tin (tpl_mt_7) duoc nhan, van 1 dong');
ok(total(U({}, { priv: false, name: ' HOA ' })) === total(r), 'so khop ten khong phan biet hoa/thuong/khoang trang -> cung dong');
r = U({ vt_1: 1 }, binh); ok(total(r) === '[["vt_1",1]]' && rows.length === 2, 'Binh co dong RIENG, khong thay so cua Hoa');
ok(total(U({}, hoa)) === '[["tpl_mt_7",1],["vt_1",5],["vt_2",1]]', 'so cua Hoa khong bi Binh lam doi');
// chong phinh / du lieu xau
r = U({ x: 5000 }, binh); ok(r.counts.x === 1000, 'moi id chi +1000/lan (chong gui so khong lo): ' + r.counts.x);
r = U({ 'a b': 1, '': 1, '../../x': 1, ok1: -3, ok2: 0, ok3: 'abc', ok4: 2.9 }, binh); ok(!('a b' in r.counts) && !('' in r.counts) && !('../../x' in r.counts) && !('ok1' in r.counts) && !('ok2' in r.counts) && !('ok3' in r.counts) && r.counts.ok4 === 2, 'id la / so am / 0 / khong phai so bi bo; 2.9 lam tron 2');
r = U('chuoi', binh); ok(r.ok, 'delta khong phai object -> coi nhu rong, khong loi'); r = U([1, 2], binh); ok(r.ok, 'delta la mang -> bo qua');
const big = {}; for (let i = 0; i < 300; i++) big['id' + i] = 1; r = U(big, hoa);
ok(Object.keys(r.counts).length <= 3 + 200, 'toi da 200 id moi lan gui: ' + Object.keys(r.counts).length);
const many = {}; for (let i = 0; i < 200; i++) many['b' + i] = 1; U(many, hoa); r = U({ c0: 1 }, hoa);
for (let k = 0; k < 4; k++) { const d = {}; for (let i = 0; i < 100; i++) d['z' + k + '_' + i] = 1; U(d, hoa); }
r = U({}, hoa); ok(Object.keys(r.counts).length <= 400, 'giu toi da 400 muc: ' + Object.keys(r.counts).length);
ok(r.counts.vt_1 === 5, 'khi cat bot, muc dung NHIEU NHAT duoc giu (vt_1=5 con)');
// du lieu hong trong sheet
rows.push(['Hong', '{khong-phai-json', 1]); r = U({ q: 1 }, { priv: false, name: 'Hong' }); ok(r.ok && total(r) === '[["q",1]]' && JSON.parse(rows[rows.length - 1][1]).q === 1, 'JSON hong trong sheet -> reset an toan, khong loi');
rows.push(['Mang', '[1,2]', 1]); r = U({ q: 1 }, { priv: false, name: 'Mang' }); ok(r.ok && total(r) === '[["q",1]]', 'counts la mang -> bo qua, khong loi');
// khoa
held.n = 0; held.max = 0; U({ a: 1 }, hoa); ok(held.max === 1 && held.n === 0, 'co lay khoa va luon nha khoa');
held.fail = true; r = U({ a: 1 }, hoa); ok(r.code === 'BUSY' && r.ok === false, 'khong lay duoc khoa -> bao BUSY, khong ghi'); held.fail = false;
// route
ok(/if \(action === 'vietTatUsage'\)\s+return jsonOut_\(vietTatUsage_\(data, _tplCaller_\(data\.token, data\.ek, data\.by\)\)\);/.test(src), 'doPost co route action=vietTatUsage');
console.log(bad ? '\n' + bad + ' LOI' : '\nALL VIETTAT-USAGE-GAS TESTS PASSED'); process.exit(bad ? 1 : 0);

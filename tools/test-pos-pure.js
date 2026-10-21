#!/usr/bin/env node
// Test: Bao cao Pos "tinh don thuan" (js/11-fn-srload.js: _srPureCalc_, _srIsAdjusted_, _srAdjTypeText_) + server tra saleThe/dieuChinh (gas_v13.js).
// Chay: node tools/test-pos-pure.js -> "ALL POS-PURE TESTS PASSED"
const fs = require('fs'), vm = require('vm'), path = require('path');
const js = fs.readFileSync(path.join(__dirname, '..', 'js', '11-fn-srload.js'), 'utf8');
const gas = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok   ' + m); };
function fn(src, name) { const i = src.indexOf('function ' + name + '('); let d = 0, k = src.indexOf('{', i); for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); } throw new Error(name); }
const ctx = { Number, String, Math, Object };
vm.createContext(ctx);
vm.runInContext("var _SR_UNASSIGNED_ = '(chưa gán sale)';" + ['_srPureCalc_', '_srIsAdjusted_', '_srAdjTypeText_'].map(n => fn(js, n)).join('\n'), ctx);
const orders = [
  { saleThe: 'a1,b2', giaTriSauGiam: 1000, cod: 400 },                                   // chia deu 2 sale
  { saleThe: 'a1', giaTriSauGiam: 3000, giaTriPos: 500, saleShares: [{ name: 'c3', frac: 1 }], dieuChinh: 'base', cod: 0 },   // ghep Base: thuan van la a1 voi gia POS GOC 500
  { saleThe: '', giaTriSauGiam: 2000, saleRatio: 0.3, cod: 100 },                       // quay chua gan
  { saleThe: 'b2', giaTriSauGiam: 100, dieuChinh: 'acct', acctStatus: 'daXacNhan', saleShares: [{ name: 'a1', frac: 0.5 }, { name: 'b2', frac: 0.5 }], cod: 0 },
];
const r = ctx._srPureCalc_(orders), by = {}; r.forEach(x => by[x.name] = x);
ok(by.a1.orders === 2 && by.a1.giaTri === 500 + 500 && by.a1.cod === 200, 'a1: 2 don, 500 (nua don chia deu) + 500 (gia Pos goc cua don ghep Base, KHONG phai 3000)');
ok(by.b2.orders === 2 && by.b2.giaTri === 500 + 100, 'b2: chia deu + don ke toan tinh thuan theo The (100)');
ok(by['(chưa gán sale)'].orders === 1 && by['(chưa gán sale)'].giaTri === 2000 && r[r.length - 1].name === '(chưa gán sale)', 'don khong co sale tren The -> (chua gan sale), xep cuoi, KHONG nhan he so quay 30/70');
ok(!ctx._srIsAdjusted_(orders[0]) && ctx._srIsAdjusted_(orders[1]) && ctx._srIsAdjusted_(orders[2]) && ctx._srIsAdjusted_(orders[3]), 'nhan dien don da dieu chinh: ghep Base / quay 30-70 / ke toan');
ok(ctx._srAdjTypeText_(orders[1]) === 'Ghép đơn Base (mã bộ đếm)' && /^Quầy 30\/70$/.test(ctx._srAdjTypeText_(orders[2])) && /Chia theo file kế toán \(đã xác nhận/.test(ctx._srAdjTypeText_(orders[3])), 'nhan loai dieu chinh doc duoc');
ok(/saleThe: _donSaleNamesFromThe_\(m\.theSale\)\.join\(','\)/.test(gas) && /dieuChinh: m\.acctStatus \? 'acct'/.test(gas), 'server tra saleThe + dieuChinh cho tung don Bao cao B');
ok(/_srPurePanelHtml_\(d\);.*\n\s*return html;/.test(js) && /function _srPureExport_/.test(js) && /XLSX\.writeFile\(wb, fn\)/.test(js), 'panel nam CUOI Bao cao B + co xuat Excel');
console.log('ALL POS-PURE TESTS PASSED');

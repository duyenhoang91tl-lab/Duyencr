#!/usr/bin/env node
// Test: token Thẻ chỉ gồm chữ số ("8", "10") KHÔNG phải tên sale (Duyên 2026-10-23: Báo cáo tính đơn thuần chia doanh số cho "8", "10").
// Chạy: node tools/test-sale-the-numeric.js -> "SALE THE NUMERIC TESTS PASSED". Nạp NGUYÊN gas_v13.js + hàm thật _srOrdNames_/_srPureCalc_ ở js/11.
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(), DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
// danh sách "known" CỐ Ý chứa "8" và "10" (trường hợp xấu nhất: ai đó từng nhập nhầm vào PancakeNameMap) + 1 tên có khoảng trắng
vm.runInContext("_pancakeKnownSaleNameSet_ = function(){ var o = {}; ['8','10','trịnh phương anh'].forEach(function(k){ o[k] = 1; }); return o; };", ctx);
const names = t => JSON.stringify(vm.runInContext('_donSaleNamesFromThe_(' + JSON.stringify(t) + ')', ctx));
ok(names('ninhnga99, 8') === '["ninhnga99"]', 'ninhnga99 + 8 => chi ninhnga99: ' + names('ninhnga99, 8'));
ok(names('8, 10, Thuydinh1995') === '["Thuydinh1995"]', '8,10 + sale that => chi sale that');
ok(names('8') === '[]' && names('10') === '[]' && names(' 8 , 10 ') === '[]', 'the chi co so => khong co sale nao');
ok(names('ninhnga99,Thuydinh1995') === '["ninhnga99","Thuydinh1995"]', 'don chia 2 sale that van chia 2');
ok(names('Trịnh Phương Anh, 8') === '["Trịnh Phương Anh"]', 'ten co khoang trang trong danh sach known van giu');
ok(names('8, haPTN') === '["haPTN"]', 'fallback: bo so, giu token khong khoang trang');
ok(names('VIP, 10') === '["VIP"]' || names('VIP, 10') === '[]', 'tag chu + so: khong bao gio ra 10: ' + names('VIP, 10'));
ok(names('') === '[]' && names(null) === '[]', 'rong');
// client: _srOrdNames_ + _srPureCalc_ theo đúng ví dụ báo cáo của Duyên
const j11 = fs.readFileSync(path.join(__dirname, '..', 'js', '11-fn-srload.js'), 'utf8');
let code = "var _SR_UNASSIGNED_='(chưa gán sale)';\n";
for (const n of ['_srOrdNames_', '_srOrderShares_', '_srPureCalc_']) {
  const i = j11.indexOf('function ' + n + '('); ok(i >= 0, 'thieu ham ' + n);
  let d = 0; for (let k = j11.indexOf('{', i); k < j11.length; k++) { if (j11[k] === '{') d++; else if (j11[k] === '}') { d--; if (!d) { code += j11.slice(i, k + 1) + '\n'; break; } } }
}
const C = new Function(code + 'return {_srOrdNames_,_srPureCalc_};')();
ok(JSON.stringify(C._srOrdNames_('ninhnga99, 8,10 ,x1')) === '["ninhnga99","x1"]', 'client _srOrdNames_ bo token toan so');
const r = C._srPureCalc_([{ saleThe: 'ninhnga99,8', giaTriPos: 1000, cod: 100 }, { saleThe: '10', giaTriPos: 500, cod: 0 }, { saleThe: '8,10', giaTriPos: 700, cod: 0 }], 'pure');
ok(r.rows.length === 1 && r.rows[0].name === 'ninhnga99' && r.rows[0].giaTri === 1000 && r.rows[0].orders === 1, 'bao cao thuan: ninhnga99 nhan CA don (khong chia cho "8"); don chi co 8/10 vao muc chua gan sale: ' + JSON.stringify(r));
ok(r.unassigned.orders === 2 && r.unassigned.giaTri === 1200, 'don chi co 8/10 => "chua gan sale" (2 don, 1.200)');
console.log('SALE THE NUMERIC TESTS PASSED');

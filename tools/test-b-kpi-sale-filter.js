#!/usr/bin/env node
// Test the KPI Bao cao B khi LOC SALE = phan cua sale (khop bang Theo Sale), khong phai ca don. Chay: node tools/test-b-kpi-sale-filter.js
// Ca thuc 10/11/2026: ngocNB2003saleoff 7 don — the cu 120.527.000 / COD 89.899.000, bang Theo Sale 113.812.000 / 84.859.000.
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../js/11-fn-srload.js', 'utf8');
const grab = n => { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('missing ' + n); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
const ctx = vm.createContext({ _srState: { byCreator: false } });
vm.runInContext(grab('_srKeepSelectedSales_') + '\n' + grab('_srBKpiForSaleFilter_'), ctx);
const K = vm.runInContext('_srBKpiForSaleFilter_', ctx);
const d = { totalOrders: 7, totalGiaTri: 120527000, totalCod: 89899000 };
const rows = [{ name: 'ngocNB2003saleoff', orders: 7, giaTri: 113812000, cod: 84859000 }];
let r = K(d, rows, ['ngocNB2003saleoff'], false);
ok(r.giaTri === 113812000 && r.cod === 84859000 && r.orders === 7, 'loc Ngoc -> KPI = phan cua Ngoc, so don giu 7');
r = K(d, rows, [], false);
ok(r.giaTri === 120527000 && r.cod === 89899000, 'khong loc Sale -> giu so backend');
r = K(d, rows, ['ngocNB2003saleoff'], true);
ok(r.giaTri === 120527000, 'che do nguoi tao don -> giu so backend');
r = K(d, [{ name: 'khac', orders: 1, giaTri: 5, cod: 0 }], ['ngocNB2003saleoff'], false);
ok(r.giaTri === 120527000, 'sale loc khong co dong nao -> khong ve 0, giu so backend');
r = K(d, [{ name: 'A', orders: 3, giaTri: 10, cod: 1 }, { name: 'B', orders: 2, giaTri: 20, cod: 2 }, { name: 'C', orders: 9, giaTri: 99, cod: 9 }], ['a', 'b'], false);
ok(r.giaTri === 30 && r.cod === 3, 'loc nhieu sale -> cong phan cua cac sale duoc chon, bo sale khac');
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);

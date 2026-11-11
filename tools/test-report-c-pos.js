#!/usr/bin/env node
// Test Bao cao C lay so tu POS (Bao cao B) cho 2 ky + ap loc Sale/Kenh nhu nhau. Stub cac ham GAS, chay that buildSalesReportC_. Chay: node tools/test-report-c-pos.js
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
const grab = n => { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('missing ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
const calls = [];
const ord = (nguon, sale, bsx, v) => ({ ngayTaoDon: '05/11/2026', nguonDon: nguon, theSale: sale, sanPham: 'X', trangThai: 'Mới', giaTriSauGiam: v, bsx, posRow: 7 });
const store = {};
const ctx = vm.createContext({ VN_OFFSET_MS: 7 * 3600e3, calls,
  _reportCacheKey_: (p, f) => p + JSON.stringify(f), _cacheGetBig_: k => (k in store ? store[k] : null), _cachePutBig_: (k, v) => { store[k] = v; },
  readKPITargets_: () => ({}), getKPI_: () => 0, readDTTong_: () => { throw new Error('khong duoc doc DT Tong o che do Pos'); },
  _expandSaleFilterWithPancakeAliases_: a => a, _saleWantedFn_: () => () => true, _foldTermsCSV_: () => [], _pMatchAny_: () => true,
  _normTxt_: s => String(s).toLowerCase(), _isExcludedOrderStatus_: () => false, _isNumericTag_: () => false, splitMulti_: (s) => String(s).split(','),
  readPancakePageMap_: () => ({ '111': 'Page HT3' }), readPancakePageMapByName_: () => ({}),
  _donKenhFromNguon_: (n, byId) => { const m = /\((\d+)\)\s*$/.exec(n); return m ? (byId[m[1]] || '') : ''; },
  _resolvePeriods_: () => ({ curFrom: '2026-11-01', curTo: '2026-11-09', prevFrom: '2026-10-01', prevTo: '2026-10-09', curKey: '', prevKey: '', curLabel: 'c', prevLabel: 'p' }),
  buildSalesReportB_: f => { calls.push(f); return { orders: f.dateFrom === '2026-11-01'
    ? [ord('Facebook / Hien (111)', 'a, b', [['a', 600], ['b', 400]], 1000), ord('Quay Hao Nam', 'a', [['a', 500]], 500)]
    : [ord('Facebook / Hien (111)', 'a', [['a', 300]], 300), ord('x', '', [['(chưa gán sale)', 50]], 50)] }; } });
vm.runInContext(grab('buildSalesReportC_'), ctx);
let r = vm.runInContext('buildSalesReportC_', ctx)({ sale: ['a'], kenh: [], sanPham: 'X' });
ok(r.source === 'pos' && calls.length === 2, 'che do Pos: goi B dung 2 lan (moi ky 1 lan), khong doc DT Tong');
ok(calls[0].dateFrom === '2026-11-01' && calls[0].dateTo === '2026-11-09' && calls[1].dateFrom === '2026-10-01' && calls[1].dateTo === '2026-10-09', 'ky nay / ky truoc dung khoang ngay tuy chinh');
ok(calls.every(c => c.sale[0] === 'a' && c.sanPham === 'X'), 'bo loc Sale + San pham cua mau loc nhanh ap CHO CA 2 KY');
const emp = n => r.byEmployee.find(x => x.name === n);
ok(emp('a').resultCur === 1100 && emp('b').resultCur === 400 && emp('a').resultPrev === 300, 'theo Sale = phan chia tung sale (600+500 / 400), ky truoc 300');
ok(!r.byEmployee.some(x => x.name === '(chưa gán sale)'), 'bo dong (chua gan sale) nhu Bao cao B');
const k = n => r.byKenh.find(x => x.name === n);
ok(k('Page HT3').resultCur === 1000 && k('Page HT3').resultPrev === 300 && k('Quay Hao Nam').resultCur === 500, 'kenh ban suy tu Nguon don qua PancakePageMap; khong khop giu Nguon don');
ok(r.ordersCur.length === 2 && r.ordersCur[0].saleBan === 'a, b' && r.ordersCur[0].kenhBan === 'Page HT3', 'ordersCur cho drill: saleBan = ten theo phan chia, kenhBan chuan');
calls.length = 0; r = vm.runInContext('buildSalesReportC_', ctx)({ sale: [], kenh: ['Page HT3'] });
ok(r.byKenh.length === 1 && r.byKenh[0].name === 'Page HT3' && r.byEmployee.every(x => x.name !== 'Quay'), 'loc Kenh ap cho ca 2 ky (chi con Page HT3)');
// Khoi dong cache song song: part=cur / part=prev chi tinh 1 ky, roi request that doc cache (khong goi B lai)
for (const k in store) delete store[k]; calls.length = 0;
const C = vm.runInContext('buildSalesReportC_', ctx);
let w1 = C({ sale: ['a'], part: 'cur' }), w2 = C({ sale: ['a'], part: 'prev' });
ok(w1.warm === 'cur' && w2.warm === 'prev' && calls.length === 2 && calls[0].dateFrom === '2026-11-01' && calls[1].dateFrom === '2026-10-01', 'part=cur/prev: moi request chi tinh 1 ky (B goi 1 lan)');
calls.length = 0; r = C({ sale: ['a'] });
ok(calls.length === 0 && r.byEmployee.find(x => x.name === 'a').resultCur === 1100, 'request that sau khi khoi dong: doc cache, KHONG goi B lai, so van dung');
calls.length = 0; r = C({ sale: ['a'], kenh: ['Page HT3'] });
ok(calls.length === 0 && r.byKenh.length === 1, 'doi loc Kenh van dung lai cache don Pos (khong tinh lai B)');
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);

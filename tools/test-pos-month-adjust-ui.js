#!/usr/bin/env node
// Test GIAO DIEN Bao cao B voi d.posAdjust (chot thang Pos, Duyen 2026-11-02): cot "Tru hoan/huy", the Tong gia tri, banner, khung Chot thang.
const fs = require('fs'), vm = require('vm'), path = require('path');
const js = fs.readFileSync(path.join(__dirname, '..', 'js', '11-fn-srload.js'), 'utf8');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
function fnSrc(name) { const i = js.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name); let j = js.indexOf('{', i), d = 0, k = j; for (; k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}') { d--; if (!d) break; } } return js.slice(i, k + 1); }
const money = n => Math.round(n).toLocaleString('en-US') + 'đ';
const ctx = { esc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), fmt: n => String(Math.round(n || 0)), _srMoney: money,
  _srState: { bSaleView: 'table', bSaleSearch: '', bSale: [], bTeamSearch: '', bNguonSearch: '', bMktSearch: '' },
  _srIsAdmin: () => false, _srViewToggleHtml: () => '', _srColTh_: (a, b, c) => '<th>' + c + '</th>', _srDrillAttr_: () => '', _srKeepSelectedSales_: r => r, _srApplyColFilters_: r => r,
  _srTotalRowHtml_: cells => '<tr class="tot">' + cells.map(c => '<td>' + c + '</td>').join('') + '</tr>', _srCloseRateKpiCard_: () => '', _srCloseRateBarHtml_: () => '',
  _SR_COLTH_ROWSFN_: {}, _SR_COLTH_GETTER_: {}, _srNoDataHtml_: () => 'NODATA', _srMergeStoreIntoBySale_: function(rows){ return { rows: rows, storeTotal: 0 }; }, _srPosMonthPanelHtml_: () => '', _srBaseCheckPanelHtml_: () => '', _srChartSvg: () => 'CHART' };
vm.createContext(ctx);
vm.runInContext(fnSrc('_srPosAdjustBannerHtml_') + '\n' + fnSrc('_srRenderB'), ctx);
let h;
const base = { totalOrders: 10, totalGiaTri: 1050000, totalCod: 0, bySale: [
  { name: 'anhtrinh1995', orders: 6, giaTri: 550000, giaTriGoc: 700000, truHoanHuy: 150000, cod: 0 }, { name: 'yenNTH2004', orders: 4, giaTri: 500000, giaTriGoc: 500000, truHoanHuy: 0, cod: 0 }] };
try { h = vm.runInContext('_srRenderB', ctx)(Object.assign({ posAdjust: { applied: true, month: '2026-11', prevMonth: '2026-10', closedAt: '2026-10-31', totalDeduction: 150000 } }, base)); }
catch (e) { console.log('FAIL render: ' + e.message); process.exit(1); }
ok(/Đã trừ hoàn\/hủy tháng 2026-10/.test(h) && /mốc chốt 2026-10-31/.test(h) && /−150,000đ/.test(h), 'banner xanh: da tru hoan/huy thang 10, moc chot, tong tru 150.000');
ok(/Trừ hoàn\/hủy 2026-10/.test(h) && /\(sau trừ\)/.test(h), 'bang Theo Sale co cot "Tru hoan/huy" + nhan (sau tru)');
ok(/−150,000đ<\/td>/.test(h) && />—<\/td>/.test(h), 'dong anhtrinh1995 hien −150.000, sale khong bi hoan hien —');
ok(/550,000đ/.test(h) && /1,050,000đ/.test(h), 'gia tri sau tru 550.000 va the tong 1.050.000');
ok(/class="tot"><td>Tổng<\/td><td>10<\/td><td>1050000đ<\/td><td>150000đ<\/td>/.test(h.replace(/,/g, '')), 'dong Tong: 10 don, 1.050.000, tru 150.000 (du 6 cot khop header)');
ok(/đã trừ hoàn\/hủy 2026-10/.test(h), 'the Tong gia tri ghi chu da tru');
// khong ap -> bang cu (5 cot), khong cot tru
h = vm.runInContext('_srRenderB', ctx)(Object.assign({ posAdjust: { applied: false, reason: 'Chưa chốt tháng 2026-10 nên chưa trừ hoàn/hủy.' } }, base));
ok(!/Trừ hoàn\/hủy 2026-10/.test(h) && /Chưa chốt tháng 2026-10/.test(h) && /🔓/.test(h), 'chua chot: khong co cot tru, co ghi chu xam ly do');
h = vm.runInContext('_srRenderB', ctx)(base);
ok(!/🔒|🔓|Trừ hoàn/.test(h), 'khoang ngay tuy y (khong posAdjust): giao dien nhu cu, khong banner');
// khung chot thang: mac dinh thang dung
const panelSrc = fnSrc('_srPosMonthPanelHtml_');
function panel(y, m, d) { const c2 = { _srIsAdmin: () => true, Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(y, m - 1, d); } } }; vm.createContext(c2); vm.runInContext(panelSrc, c2); return c2._srPosMonthPanelHtml_(); }
ok(/id="sr-posm-close" value="2026-10"/.test(panel(2026, 10, 31)), 'NGAY CUOI thang 10: o "Chot thang" mac dinh = thang 10 (chot chinh thang nay)');
ok(/id="sr-posm-close" value="2026-09"/.test(panel(2026, 10, 15)), 'giua thang 10: mac dinh chot thang 9 (thang truoc) nhu cu');
ok(/id="sr-posm-close" value="2026-10"/.test(panel(2026, 11, 1)), 'mung 1 thang 11: mac dinh chot thang 10');
ok(/_srLoad\(\)/.test(fnSrc('_srPosMonthClose_')), 'sau khi chot tai lai Bao cao B (bang Theo Sale nhay theo moc)');
console.log(fails ? '\nFAILED ' + fails : '\nALL POS MONTH UI TESTS PASSED'); process.exit(fails ? 1 : 0);

#!/usr/bin/env node
// Test GIAO DIEN Bao cao B voi d.posAdjust (chot thang Pos). NGU NGHIA MOI (Duyen 2026-11-05): B luon hien FULL doanh thu chuan (the Tong + bang Theo Sale KHONG tru);
// cuoi thang (da chot thang truoc) co THEM khoi rieng "Chot thang: tru hoan/huy thang truoc" ngay duoi bang Theo Sale. Cung test khung Chot thang.
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
vm.runInContext(fnSrc('_srBhPrepaidBannerHtml_') + '\n' + fnSrc('_srPosAdjustBannerHtml_') + '\n' + fnSrc('_srPosAdjustBlockHtml_') + '\n' + fnSrc('_srRenderB'), ctx);
let h;
const base = { totalOrders: 10, totalGiaTri: 1200000, totalCod: 0, bySale: [
  { name: 'anhtrinh1995', orders: 6, giaTri: 700000, giaTriGoc: 700000, truHoanHuy: 150000, giaTriSauTru: 550000, cod: 0 }, { name: 'yenNTH2004', orders: 4, giaTri: 500000, giaTriGoc: 500000, truHoanHuy: 0, giaTriSauTru: 500000, cod: 0 }] };
const adjRows = [{ name: 'anhtrinh1995', orders: 6, giaTri: 700000, truHoanHuy: 150000, giaTriSauTru: 550000 }, { name: 'yenNTH2004', orders: 4, giaTri: 500000, truHoanHuy: 0, giaTriSauTru: 500000 }, { name: 'chiCoHoan', orders: 0, giaTri: 0, truHoanHuy: 30000, giaTriSauTru: -30000 }];
try { h = vm.runInContext('_srRenderB', ctx)(Object.assign({ posAdjust: { applied: true, month: '2026-11', prevMonth: '2026-10', closedAt: '2026-10-31', totalDeduction: 180000, rows: adjRows } }, base)); }
catch (e) { console.log('FAIL render: ' + e.message); process.exit(1); }
const hc = h.replace(/,/g, '');
const mainTbl = hc.slice(hc.indexOf('Theo Sale'), hc.indexOf('Chốt tháng 2026-11'));   // phan bang Theo Sale chinh (truoc khoi tru)
ok(/Chốt tháng 2026-11: trừ hoàn\/hủy tháng 2026-10/.test(h) && /mốc chốt 2026-10-31/.test(h), 'co KHOI rieng "Chot thang: tru hoan/huy thang 10" voi moc chot');
ok(!/Đã trừ hoàn\/hủy|sau trừ\)|<th[^>]*>Trừ hoàn/.test(mainTbl) && !/Trừ hoàn\/hủy 2026-10<\/th>/.test(mainTbl), 'bang Theo Sale chinh KHONG co cot/nhan tru hoan/huy');
ok(/anhtrinh1995<\/td><td class="r">6<\/td><td class="r">700000đ<\/td>/.test(mainTbl) && /class="tot"><td>Tổng<\/td><td>10<\/td><td>1200000đ<\/td><td>120000đ<\/td>/.test(mainTbl), 'bang Theo Sale giu DOANH THU CHUAN: anhtrinh1995 700.000 (khong tru), dong Tong 10 don / 1.200.000')
ok(/<div class="kpi-val" style="color:#16a34a">1200000đ<\/div><div class="kpi-label"><b>Tổng giá trị đơn hàng sau giảm giá<\/b>/.test(hc), 'the Tong gia tri = doanh thu chuan 1.200.000, khong ghi chu "da tru"');
ok(h.indexOf('Chốt tháng 2026-11') > h.indexOf('Theo Sale') && h.indexOf('Chốt tháng 2026-11') > h.indexOf('Tổng</td><td>10</td>'), 'khoi tru nam SAU bang Theo Sale (sau dong Tong cua bang chinh)')
const blk = hc.slice(hc.indexOf('Chốt tháng 2026-11'));
ok(/anhtrinh1995<\/td><td class="r">700000đ<\/td><td class="r"[^>]*>−150000đ<\/td><td class="r"><b>550000đ<\/b>/.test(blk), 'khoi tru: anhtrinh1995 chuan 700.000, tru −150.000, sau tru 550.000');
ok(/yenNTH2004<\/td><td class="r">500000đ<\/td><td class="r"[^>]*>—<\/td><td class="r"><b>500000đ<\/b>/.test(blk), 'khoi tru: sale khong bi hoan hien — va sau tru = chuan');
ok(/chiCoHoan<\/td><td class="r">0đ<\/td><td class="r"[^>]*>−30000đ<\/td><td class="r"><b>-30000đ<\/b>/.test(blk), 'sale chi co hoan/huy thang truoc (thang nay khong co don) van hien: chuan 0, tru −30.000');
ok(/class="tot"><td>Tổng<\/td><td>1200000đ<\/td><td>−180000đ<\/td><td>1020000đ<\/td>/.test(blk), 'dong Tong khoi tru: chuan 1.200.000, tru −180.000, sau tru 1.020.000');
// tim nhanh theo ten loc ca khoi tru
ctx._srState.bSaleSearch = 'yen';
h = vm.runInContext('_srRenderB', ctx)(Object.assign({ posAdjust: { applied: true, month: '2026-11', prevMonth: '2026-10', closedAt: '2026-10-31', totalDeduction: 180000, rows: adjRows } }, base));
ok(!/chiCoHoan/.test(h) && /yenNTH2004/.test(h), 'o tim nhanh loc ca khoi tru');
ctx._srState.bSaleSearch = '';
// da chot nhung khong co don hoan/huy sau chot
h = vm.runInContext('_srRenderB', ctx)(Object.assign({ posAdjust: { applied: true, month: '2026-11', prevMonth: '2026-10', closedAt: '2026-10-31', totalDeduction: 0, rows: [adjRows[1]] } }, base));
ok(/Không có đơn tháng 2026-10 nào phát sinh hoàn\/hủy sau khi chốt/.test(h), 'khong co hoan/huy sau chot: ghi ro, khong bao tru 0');
// khong ap -> bang cu (5 cot), khong cot tru
h = vm.runInContext('_srRenderB', ctx)(Object.assign({ posAdjust: { applied: false, reason: 'Chưa chốt tháng 2026-10 nên chưa trừ hoàn/hủy.' } }, base));
ok(!/Trừ hoàn\/hủy tháng/.test(h) && !/🔒/.test(h) && /Chưa chốt tháng 2026-10/.test(h) && /🔓/.test(h), 'chua chot: khong co khoi tru, co ghi chu xam ly do');
h = vm.runInContext('_srRenderB', ctx)(base);
ok(!/🔒|🔓|Trừ hoàn/.test(h), 'khoang ngay tuy y (khong posAdjust): giao dien nhu cu, khong banner');
h = vm.runInContext('_srRenderB', ctx)(Object.assign({ bhPrepaid: { count: 27, total: 63405000 } }, base));
ok(/Đã trừ tiền trả trước của đơn Bảo hành/.test(h) && /27 đơn/.test(h) && /−63,405,000đ/.test(h), 'Bao cao B: banner vang "da tru tien tra truoc don Bao hanh" 27 don, −63.405.000');
h = vm.runInContext('_srRenderB', ctx)(Object.assign({ bhPrepaid: { count: 0, total: 0 } }, base));
ok(!/Đã trừ tiền trả trước/.test(h), 'khong co don BH tru: khong hien banner');
// khung chot thang: mac dinh thang dung
const panelSrc = fnSrc('_srPosMonthPanelHtml_');
function panel(y, m, d) { const c2 = { _srIsAdmin: () => true, Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(y, m - 1, d); } } }; vm.createContext(c2); vm.runInContext(panelSrc, c2); return c2._srPosMonthPanelHtml_(); }
ok(/id="sr-posm-close" value="2026-10"/.test(panel(2026, 10, 31)), 'NGAY CUOI thang 10: o "Chot thang" mac dinh = thang 10 (chot chinh thang nay)');
ok(/id="sr-posm-close" value="2026-09"/.test(panel(2026, 10, 15)), 'giua thang 10: mac dinh chot thang 9 (thang truoc) nhu cu');
ok(/id="sr-posm-close" value="2026-10"/.test(panel(2026, 11, 1)), 'mung 1 thang 11: mac dinh chot thang 10');
ok(/_srLoad\(\)/.test(fnSrc('_srPosMonthClose_')), 'sau khi chot tai lai Bao cao B (bang Theo Sale nhay theo moc)');
console.log(fails ? '\nFAILED ' + fails : '\nALL POS MONTH UI TESTS PASSED'); process.exit(fails ? 1 : 0);

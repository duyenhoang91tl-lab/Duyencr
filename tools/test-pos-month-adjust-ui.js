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
vm.runInContext(fnSrc('_srPosAdjustBannerHtml_') + '\n' + fnSrc('_srPosAdjustBlockHtml_') + '\n' + fnSrc('_srBKpiForSaleFilter_') + '\n' + fnSrc('_srRenderB'), ctx);
let h;
const base = { totalOrders: 10, totalGiaTri: 1200000, totalCod: 0, bySale: [
  { name: 'anhtrinh1995', orders: 6, giaTri: 700000, giaTriGoc: 700000, truHoanHuy: 150000, giaTriSauTru: 550000, cod: 0 }, { name: 'yenNTH2004', orders: 4, giaTri: 500000, giaTriGoc: 500000, truHoanHuy: 0, giaTriSauTru: 500000, cod: 0 }] };
const adjRows = [{ name: 'anhtrinh1995', orders: 6, giaTri: 700000, truHoanHuy: 150000, giaTriSauTru: 550000 }, { name: 'yenNTH2004', orders: 4, giaTri: 500000, truHoanHuy: 0, giaTriSauTru: 500000 }, { name: 'chiCoHoan', orders: 0, giaTri: 0, truHoanHuy: 30000, giaTriSauTru: -30000 }];
const REF = { month: '2026-10', soDon: 3, tongGiaTri: 640000, truncated: false, orders: [
  { ngay: '05/10/2026', posRow: 2, nguonDon: 'Facebook', theSale: 'anhtrinh1995', sales: ['anhtrinh1995'], giaTri: 150000, trangThai: 'Đã hoàn', khachHang: 'Khách A', soDienThoai: '0900000002' },
  { ngay: '20/10/2026', posRow: 3, nguonDon: 'Zalo', theSale: 'yenNTH2004, anhtrinh1995', sales: ['yenNTH2004', 'anhtrinh1995'], giaTri: 400000, trangThai: 'Đang hoàn', khachHang: 'Khách <b>B</b>', soDienThoai: '0900000003' },
  { ngay: '28/10/2026', posRow: 5, nguonDon: 'Facebook', theSale: 'menbui2002', sales: ['menbui2002'], giaTri: 90000, trangThai: 'Đã hoàn', khachHang: 'Khách C', soDienThoai: '0900000005' }] };
const PA = (extra) => Object.assign({ applied: true, month: '2026-11', prevMonth: '2026-10', closedAt: '2026-10-31', totalDeduction: 180000, rows: adjRows, refund: REF }, extra || {});
const R = (pa) => vm.runInContext('_srRenderB', ctx)(Object.assign({ posAdjust: pa }, base));
try { h = R(PA()); } catch (e) { console.log('FAIL render: ' + e.message); process.exit(1); }
const hc = h.replace(/,/g, '');
const mi = hc.indexOf('Đơn hoàn/hủy tháng 2026-10');
const mainTbl = hc.slice(hc.indexOf('Theo Sale'), mi);   // bang Theo Sale chinh (truoc khoi hoan/huy)
const blk = hc.slice(mi);
ok(mi > -1 && /Đơn hoàn\/hủy tháng 2026-10 <span class="sr-sub">· <b>3<\/b> đơn · <b[^>]*>640000đ<\/b> · phát sinh sau chốt 180000đ<\/span>/.test(hc), 'khoi "Don hoan/huy thang 10": MOT dong tieu de ngan: 3 don · 640.000 · phat sinh sau chot 180.000');
ok(!/Đã trừ hoàn|sau trừ\)|Sau trừ|Trừ hoàn|trừ hoàn|đã chốt 2026|mốc chốt|KHÔNG bị trừ/.test(hc), 'KHONG co cot/chu "Sau tru", "Tru hoan/huy", va khong co hop ghi chu giai thich (Duyen 2026-11-06 bo ghi chu thua)');
ok(/anhtrinh1995<\/td><td class="r">6<\/td><td class="r">700000đ<\/td>/.test(mainTbl) && /class="tot"><td>Tổng<\/td><td>10<\/td><td>1200000đ<\/td><td>120000đ<\/td>/.test(mainTbl), 'bang Theo Sale giu DOANH THU CHUAN: anhtrinh1995 700.000, tong 1.200.000');
ok(/<div class="kpi-val" style="color:#16a34a">1200000đ<\/div><div class="kpi-label"><b>Tổng giá trị đơn hàng sau giảm giá<\/b>/.test(hc), 'the Tong gia tri = doanh thu chuan 1.200.000');
ok(mi > hc.indexOf('Tổng</td><td>10</td>'), 'khoi hoan/huy nam SAU bang Theo Sale (sau dong Tong cua bang chinh)');
ok(/anhtrinh1995<\/td><td class="r">2<\/td><td class="r">350000đ<\/td>/.test(blk) && /yenNTH2004<\/td><td class="r">1<\/td><td class="r">200000đ<\/td>/.test(blk) && /menbui2002<\/td><td class="r">1<\/td><td class="r">90000đ<\/td>/.test(blk), 'theo Sale: anhtrinh1995 2 don 150k + 400k/2 = 350k; yenNTH2004 1 don 200k (don 2 sale chia deu); menbui2002 90k');
ok(/class="tot"><td>Tổng \(đơn không trùng\)<\/td><td>3<\/td><td>640000đ<\/td>/.test(blk), 'dong Tong dem don KHONG trung (3 don, 640.000) du don nhieu Sale hien o nhieu dong');
ok(/<td style="white-space:nowrap">20\/10\/2026<\/td><td class="r">3<\/td><td>Zalo<\/td><td>yenNTH2004 anhtrinh1995<\/td><td class="r">400000đ<\/td><td>Đang hoàn<\/td><td>Khách &lt;b>B&lt;\/b><\/td><td>0900000003<\/td>/.test(blk), 'bang don: ngay, dong Pos, nguon, the, gia tri, trang thai, khach (da escape HTML), SDT');
h = R(PA({ totalDeduction: 0 }));
ok(!/phát sinh sau chốt/.test(h) && /<b>3<\/b> đơn/.test(h), 'khong co phat sinh sau chot: khong ghi them');
// tim nhanh theo ten loc ca khoi hoan/huy
ctx._srState.bSaleSearch = 'menbui';
h = R(PA());
const blk2 = h.replace(/,/g, '').slice(h.indexOf('Đơn hoàn/hủy tháng 2026-10'));
ok(/<b>1<\/b> đơn · <b[^>]*>90000đ<\/b>/.test(blk2) && !/Zalo/.test(blk2) && /menbui2002/.test(blk2), 'o tim nhanh loc ca khoi hoan/huy (chi con don menbui2002, tieu de dem lai)');
ctx._srState.bSaleSearch = '';
// > 200 don: chi hien 200 dong dau + nhac tai file
const many = Array.from({ length: 230 }, (_, i) => ({ ngay: '01/10/2026', posRow: 100 + i, nguonDon: 'FB', theSale: 'a', sales: ['a'], giaTri: 10, trangThai: 'Đã hoàn', khachHang: 'k', soDienThoai: '0' }));
h = R(PA({ refund: { month: '2026-10', soDon: 230, tongGiaTri: 2300, truncated: false, orders: many } }));
ok((h.slice(h.lastIndexOf('<tbody>')).match(/<tr>/g) || []).length === 200 && /Chỉ hiện 200\/230 đơn đầu/.test(h), 'nhieu don: bang chi hien 200 dong dau + nhac tai file Excel lay du 230');
h = R(PA({ refund: { month: '2026-10', soDon: 5000, tongGiaTri: 50000, truncated: true, orders: many } }));
ok(/chỉ tải 3\.000 đơn đầu/.test(h), 'cat 3.000 don: ghi ngan ngay tieu de');
h = R(PA({ totalDeduction: 0, refund: { month: '2026-10', soDon: 0, tongGiaTri: 0, truncated: false, orders: [] } }));
ok(/Đơn hoàn\/hủy tháng 2026-10 <span class="sr-sub">· không có đơn<\/span>/.test(h) && !/Số đơn hoàn\/hủy<\/th>/.test(h), 'thang da chot khong co don hoan/huy: ghi "khong co don", khong hien bang rong');
h = R({ applied: true, month: '2026-11', prevMonth: '2026-10', closedAt: '2026-10-31', totalDeduction: 0, rows: [] });
ok(!/Đơn hoàn\/hủy tháng/.test(h), 'backend cu (chua co posAdjust.refund) -> khong hien khoi, khong loi');
// khong ap -> chi ghi chu xam, KHONG co bao cao
h = R({ applied: false, reason: 'Chưa chốt tháng 2026-10 nên chưa có báo cáo đơn hoàn/hủy tháng 2026-10.' });
ok(!/Đơn hoàn\/hủy tháng 2026-10 </.test(h) && !/🔒/.test(h) && /Chưa chốt tháng 2026-10/.test(h) && /🔓/.test(h), 'chua chot: KHONG co bao cao don hoan/huy, chi co ghi chu xam ly do');
h = vm.runInContext('_srRenderB', ctx)(base);
ok(!/🔒|🔓|Đơn hoàn\/hủy tháng/.test(h), 'khoang ngay tuy y (khong posAdjust): giao dien nhu cu, khong banner');
// khung chot thang: mac dinh thang dung
const panelSrc = fnSrc('_srPosMonthPanelHtml_');
function panel(y, m, d) { const c2 = { _srIsAdmin: () => true, Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(y, m - 1, d); } } }; vm.createContext(c2); vm.runInContext(panelSrc, c2); return c2._srPosMonthPanelHtml_(); }
ok(/id="sr-posm-close" value="2026-10"/.test(panel(2026, 10, 31)), 'NGAY CUOI thang 10: o "Chot thang" mac dinh = thang 10 (chot chinh thang nay)');
ok(/id="sr-posm-close" value="2026-09"/.test(panel(2026, 10, 15)), 'giua thang 10: mac dinh chot thang 9 (thang truoc) nhu cu');
ok(/id="sr-posm-close" value="2026-10"/.test(panel(2026, 11, 1)), 'mung 1 thang 11: mac dinh chot thang 10');
ok(/_srLoad\(\)/.test(fnSrc('_srPosMonthClose_')), 'sau khi chot tai lai Bao cao B (bang Theo Sale nhay theo moc)');
console.log(fails ? '\nFAILED ' + fails : '\nALL POS MONTH UI TESTS PASSED'); process.exit(fails ? 1 : 0);

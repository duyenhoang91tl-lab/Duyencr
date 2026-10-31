#!/usr/bin/env node
// Test BAM O BAO CAO A/B -> XEM DON CHI TIET (js/59-report-drill.js + phan gop trong gas_v13.js). Chay ham GAS THAT voi du lieu gia roi dua qua cua so chi tiet (jsdom).
// Chay: NODE_PATH=<noi co jsdom> node tools/test-report-drill.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const J = x => JSON.parse(JSON.stringify(x));
// ── GAS ──
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(R('gas_v13.js'), ctx, { filename: 'gas_v13.js' });
vm.runInContext(`
  var __rows = [], __don = [];
  readDTTong_ = function() { return __rows; }; readDonChiTiet_ = function() { return __don; }; _mergeTachDon_ = function(r) { return r; };
  getSetting_ = function() { return null; };
  readPancakePageMap_ = function() { return {}; }; readPancakePageMapByName_ = function() { return {}; }; readPancakeMap_ = function() { return {}; };
  _pkStatsRowsMemo_ = function() { return []; }; _pkTrackedDatesByPageAndSale_ = function() { return { datesByPage: {}, datesBySale: {} }; };
  buildPancakeReport_ = function() { return { byCS: [], byPage: [] }; }; _pancakeKnownSaleNameSet_ = function() { return {}; };
  _expandSaleFilterWithPancakeAliases_ = function(a) { return a; };
  readTeams_ = function() { return [{ id: 't1', name: 'Team Online', leader: '', members: ['anhtrinh1995', 'yenNTH2004'] }, { id: 't2', name: 'Phòng Kế toán', leader: '', members: ['menbui2002', 'phongketoan'] }]; };
  readMktTeams_ = function() { return [{ id: 'm1', name: 'MKT Hoa', pages: ['K1'] }]; }; readUsers_ = function() { return []; };
  _mktKenhWeights_ = function() { return { K1: [{ id: 'm1', name: 'MKT Hoa', w: 0.5 }, { id: 'm2', name: 'MKT Lan', w: 0.5 }] }; };
  readKPITargets_ = function() { return {}; }; readSaleDirectory_ = function() { return { list: [] }; };
`, ctx);
const row = (day, sale, val, kenh, phone) => ({ ngayTao: day, kenhBan: kenh || 'K1', saleBan: sale, trangThai: 'Hoàn thành', sanPham: 'Nhẫn', nguoiTao: sale.split(',')[0].trim(), giaTriDon: val, giaTriCoc: 0, id: 'ID' + val, soDienThoai: phone || '0912345678' });
ctx.__rows = [row('05/10/2026', 'anhtrinh1995, menbui2002', 1000000, 'K1', '0900000001'), row('06/10/2026', 'anhtrinh1995', 500000, 'K2', '0900000002'), row('07/10/2026', 'yenNTH2004, phongketoan', 2000000, 'K1', '0900000003'), row('08/10/2026', 'menbui2002', 700000, 'K2', '0900000004')];
const F = { dateFrom: '01/10/2026', dateTo: '31/10/2026' };
const runA = f => J(vm.runInContext('buildSalesReportA_(' + JSON.stringify(Object.assign({}, F, f)) + ')', ctx));
const sum = (os, f, k) => os.reduce((s, o) => s + (((o[f] || []).filter(p => p[0] === k)[0] || [0, 0])[1]), 0);
let A = runA({});
ok(A.orders.every(o => Array.isArray(o.bs) && Array.isArray(o.bt) && typeof o.rs === 'number'), 'A: moi don co bs/bt/rs');
ok(A.orders[0].soDienThoai === '0900000001', 'A: don tra kem SDT khach');
ok(A.bySale.every(r => Math.abs(sum(A.orders, 'bs', r.name) - r.giaTri) <= 2), 'A: tong dong gop theo Sale cua cac don = giaTri tung dong bang Theo Sale');
ok(A.byTeamSale.every(r => Math.abs(sum(A.orders, 'bt', r.name) - r.giaTri) <= 2), 'A: tong dong gop theo Team = bang Theo Team');
ok(A.orders.find(o => o.id === 'ID1000000').bs.length === 2, 'A: don 2 sale -> 2 dong gop (moi nguoi 1/2)');
ok(A.mktKenh && A.mktKenh['MKT Hoa'] && A.mktKenh['MKT Hoa'][0][0] === 'K1' && A.mktKenh['MKT Hoa'][0][1] === 0.5, 'A: mktKenh tra trong so kenh cua tung MKT');
let A2 = runA({ sale: ['anhtrinh1995'] });
ok(A2.bySale.every(r => Math.abs(sum(A2.orders, 'bs', r.name) - r.giaTri) <= 2) && Math.round(A2.orders.reduce((s, o) => s + o.rs, 0)) === Math.round(A2.totalGiaTri), 'A: dang loc Sale: dong gop + o tong van khop');
let A3 = runA({ byCreator: true });
ok(A3.bySale.every(r => Math.abs(sum(A3.orders, 'bs', r.name) - r.giaTri) <= 2), 'A: che do "tinh theo nguoi tao": dong gop khop');
// B
ctx.__rows = []; ctx.__don = [
  { ngayTaoDon: '05/10/2026', trangThai: 'Hoàn thành', theSale: 'anhtrinh1995, menbui2002', soDienThoai: '0900000011', nguonDon: 'Facebook / Page Mot (111)', giaTri: 1000000, giaTriSauGiam: 1000000, sanPham: 'Nhẫn vàng, Vòng', maSanPham: 'N1;V1', soLuong: '1,2', khachHang: 'Khach 1', cod: 0, marketer: 'Hoa', ghiChu: '17T10/2026' },
  { ngayTaoDon: '06/10/2026', trangThai: 'Hoàn thành', theSale: 'anhtrinh1995', soDienThoai: '0900000012', nguonDon: 'Zalo', giaTri: 500000, giaTriSauGiam: 500000, sanPham: 'Nhẫn vàng', maSanPham: 'N1', soLuong: '1', khachHang: 'Khach 2', cod: 100000, marketer: '', ghiChu: '' }];
const B = J(vm.runInContext('buildSalesReportB_({ dateFrom: "2026-10-01", dateTo: "2026-10-31" })', ctx));
ok(B.orders.length === 2 && B.orders.every(o => Array.isArray(o.bs) && Array.isArray(o.bt)), 'B: moi don co bs/bt');
ok(B.bySale.every(r => Math.abs(sum(B.orders, 'bs', r.name) - r.giaTri) <= 2), 'B: dong gop theo Sale = bang Theo Sale');
ok(B.byTeamSale.every(r => Math.abs(sum(B.orders, 'bt', r.name) - r.giaTri) <= 2), 'B: dong gop theo Team = bang Theo Team');
// ── Client (jsdom) ──
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP client: can jsdom'); process.exit(fails ? 1 : 0); }
(async () => {
  const dom = new JSDOM('<body><div id="host"></div></body>', { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window, calls = { phone: [], toast: [], xlsx: [] };
  w.eval(`var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]})};
    var fmt=function(n){return (n||0).toLocaleString('vi-VN')}; var _srMoney=function(n){return fmt(Math.round(n||0))+'₫'};
    var customerMap={'0900000001':{name:'Chi Lan'}}; var normPhone=function(p){return String(p)};
    var _srState={dataA:null,dataB:null}; var toast=function(m){window.__toast=(window.__toast||[]).concat([m])};
    var _custLinkHtml_=function(p,inner){return '<span class="cust-link" data-cust-phone="'+p+'">'+inner+'</span>'};`);
  w.eval(R('js/59-report-drill.js'));
  w._srState.dataA = A; w._srState.dataB = B;
  const cmp = (k, key) => w._srDrillCompute_(k, key);
  let r = cmp('aSale', 'anhtrinh1995');
  ok(r.ok && r.rows.length === 2 && Math.abs(r.rows.reduce((s, x) => s + x.share, 0) - A.bySale.find(x => x.name === 'anhtrinh1995').giaTri) <= 2, 'client A Theo Sale: dung so don (2) va tong khop bang');
  r = cmp('aTeam', 'Phòng Kế toán'); ok(r.ok && Math.abs(r.rows.reduce((s, x) => s + x.share, 0) - A.byTeamSale.find(x => x.name === 'Phòng Kế toán').giaTri) <= 2, 'client A Theo Team: tong khop bang');
  r = cmp('aKenh', 'K1'); ok(r.ok && r.rows.length === 2 && r.rows.reduce((s, x) => s + x.share, 0) === A.byKenh.find(x => x.name === 'K1').giaTri, 'client A Theo Kenh: 2 don K1, tong = bang');
  r = cmp('aMkt', 'MKT Hoa'); ok(r.ok && r.rows.length === 2 && Math.abs(r.rows.reduce((s, x) => s + x.share, 0) - A.byMkt.find(x => x.name === 'MKT Hoa').giaTri) <= 2, 'client A Theo MKT: loc theo kenh cua MKT, nhan trong so 0.5, tong = bang');
  r = cmp('aAll', ''); ok(r.ok && r.rows.length === A.totalOrders && Math.abs(r.rows.reduce((s, x) => s + x.share, 0) - A.totalGiaTri) <= 3, 'client A o tong: du moi don, tong = Tong don');
  r = cmp('bNguon', 'Zalo'); ok(r.ok && r.rows.length === 1 && r.rows[0].o.khachHang === 'Khach 2', 'client B Theo Nguon: dung don');
  r = cmp('bProd', 'V1'); ok(r.ok && r.rows.length === 1 && r.rows[0].extra === 2, 'client B Theo San pham: tim theo ma, kem so luong cua SP do (2)');
  r = cmp('bSale', 'menbui2002'); ok(r.ok && r.rows.length === 1 && r.rows[0].share === 500000, 'client B Theo Sale: don 2 sale -> phan cua menbui2002 = 500.000');
  r = cmp('bMkt', '(chưa gán MKT)'); ok(r.ok && r.rows.length === 1, 'client B Theo MKT: don khong marketer vao dong "(chua gan MKT)"');
  // ── Báo cáo N (tính đơn thuần): nạp đúng các hàm thật của js/11, kiểm tra chia đều theo Thẻ + tổng khớp bảng N ──
  { const j11s = R('js/11-fn-srload.js');
    const grab = n => { const i = j11s.indexOf('function ' + n + '('); let d = 0, k = j11s.indexOf('{', i); for (let e = k; e < j11s.length; e++) { if (j11s[e] === '{') d++; else if (j11s[e] === '}' && --d === 0) return j11s.slice(i, e + 1); } };
    w.eval(R('js/01-fn-splitmulti.js').split('\n').filter(l => /^function isNumTagSale_/.test(l)).join('\n'));
    w.eval("var _SR_UNASSIGNED_='(chưa gán sale)';" + ['_srKeepSelectedSales_', '_srOrdNames_', '_srOrderShares_', '_srPureCalc_', '_srPureOrders_'].map(grab).join('\n'));
    w._srState.bSale = []; w._srState.byCreator = false;
    const nOrders = w._srPureOrders_(B), calc = w._srPureCalc_(nOrders, 'pure');
    let rn = cmp('nSale', 'anhtrinh1995'); const row1 = calc.rows.find(x => x.name === 'anhtrinh1995');
    ok(rn.ok && rn.rows.length === 2 && Math.abs(rn.rows.reduce((s, x) => s + x.share, 0) - row1.giaTri) <= 1, 'client N Theo Sale: 2 don, tong = dong cua bang N');
    rn = cmp('nSale', 'menbui2002'); ok(rn.ok && rn.rows.length === 1 && rn.rows[0].share === 500000, 'client N: don 2 sale chia deu -> menbui2002 = 500.000');
    rn = cmp('nAll', ''); ok(rn.ok && Math.abs(rn.rows.reduce((s, x) => s + x.share, 0) - calc.rows.reduce((s, r) => s + r.giaTri, 0)) <= 1 && /Báo cáo N/.test(String(w._srDrillOpen_('nAll', '') || w.document.getElementById('srd-modal').innerHTML)), 'client N o Tong: tong = tong bang N, cua so ghi Bao cao N');
    w._srDrillClose_();
    ok(/_srDrillAttr_\('nSale'/.test(j11s) && /_srDrillAttr_\('nAll'/.test(j11s), 'js/11 gan o bam duoc: nSale, nAll'); }
  // báo cáo cũ (chưa có bs) -> thông báo rõ, không im lặng/sai số
  const old = J(A); old.orders.forEach(o => { delete o.bs; delete o.bt; delete o.rs; }); w._srState.dataA = old;
  r = cmp('aSale', 'anhtrinh1995'); ok(!r.ok && /Bấm "Lọc"/.test(r.msg), 'du lieu cu (chua co bs): bao bam Loc tai lai, khong hien sai');
  r = cmp('aKenh', 'K1'); ok(r.ok && r.rows.length === 2, 'du lieu cu: o Kenh van xem duoc (khong can bs)');
  w._srState.dataA = A;
  // UI: bấm dòng -> mở cửa sổ; bấm SĐT -> không mở cửa sổ khác; Esc đóng; xuất Excel gọi XLSX
  w.document.getElementById('host').innerHTML = '<table><tr id="tr1" data-drill="aSale" data-drill-key="anhtrinh1995"><td id="td1">anhtrinh1995</td></tr></table><div class="kpi-card" id="kp" data-drill="aAll" data-drill-key=""><span id="kpv">x</span></div>';
  w.document.getElementById('td1').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const modal = w.document.getElementById('srd-modal');
  ok(modal && /2<\/b> đơn/.test(modal.innerHTML) && /khớp bảng/.test(modal.innerHTML), 'bam dong Theo Sale -> mo cua so, hien "2 don" + "khop bang"');
  ok(/data-cust-phone="0900000001"/.test(modal.innerHTML) && /Chi Lan/.test(modal.innerHTML), 'cua so: SDT la chu bam mo ho so + hien ten khach neu da tai');
  ok(modal.style.zIndex === '290', 'cua so nam duoi ngan ho so khach (z-index 290 < 300)');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  ok(!w.document.getElementById('srd-modal'), 'Esc dong cua so');
  w.document.getElementById('kpv').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok(w.document.getElementById('srd-modal') && /Tất cả đơn Base/.test(w.document.getElementById('srd-modal').innerHTML), 'bam o KPI tong -> mo danh sach tat ca don');
  const sheets = []; w.XLSX = { utils: { book_new: () => ({}), aoa_to_sheet: a => { sheets.push(a); return {}; }, book_append_sheet() {} }, writeFile: (wb, n) => { calls.xlsx.push(n); } };
  w._srDrillXlsx_(); ok(calls.xlsx.length === 1 && sheets[0].length === A.totalOrders + 1 && sheets[0][0][0] === 'Ngày tạo', 'Xuat Excel: du tat ca don + dong tieu de');
  // cài đặt đã ghi vào index.html + js/11 gắn đủ 12 điểm
  const idx = R('index.html'), j11 = R('js/11-fn-srload.js');
  ok(/js\/59-report-drill\.js/.test(idx) && idx.indexOf('js/59-report-drill.js') > idx.indexOf('js/11-fn-srload.js'), 'index.html nap js/59 sau js/11');
  ['aAll', 'aSale', 'aTeam', 'aKenh', 'aMkt', 'bAll', 'bSale', 'bTeam', 'bNguon', 'bMkt', 'bProd'].forEach(k => ok(new RegExp("_srDrillAttr_\\('" + k + "'").test(j11), 'js/11 gan o bam duoc: ' + k));
  process.exit(fails ? 1 : 0);
})();

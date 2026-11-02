#!/usr/bin/env node
// Test "Thu nhap tung Sale" (js/63-fn-saleincome.js): chay NGUYEN ham that _computeCommissionData_ (js/01) + _computeSaleIncome_ (js/63).
// Ham thuong/ty le/kenh la stub don gian. Chay: node tools/test-sale-income.js
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const j01 = fs.readFileSync(__dirname + '/../js/01-fn-splitmulti.js', 'utf8'), j63 = fs.readFileSync(__dirname + '/../js/63-fn-saleincome.js', 'utf8');
const fa = j01.indexOf('function _computeCommissionData_('), fb = j01.indexOf('// Build <option> cho 1 trường tự tạo');
ok(fa > 0 && fb > fa, 'tim thay _computeCommissionData_');
const ctx = vm.createContext({
  COMMISSION_THRESHOLD: 15e6, _commThrLabel_: () => '15tr', isNumTagSale_: () => false, splitMulti_: (s, d) => String(s || '').split(d).map(x => x.trim()).filter(Boolean),
  _goldChannelRule_: () => null, _channelCommissionRate_: k => /facebook/i.test(k || '') ? 1 : null,
  _resolveCommissionRate_: n => ({ above15: 1.5, below15: 1, sourceAbove15: 'Mặc định Online', sourceBelow15: 'Mặc định Online' }),
  _saleChannelOf_: n => n === 'ngoc' ? 'probation' : 'online',
  BONUS_PROGRAMS: [{ name: 'GĐ1 thử việc', probationDay: { enabled: true } }, { name: 'Đơn từ 10tr', probationDay: { enabled: false } }],
  _computeBonusData_: () => ({ bySale: [{ name: 'an', total: 30000, items: [{ date: '2026-10-05', scope: 'Theo đơn', program: 'Đơn từ 10tr', amount: 20000, detail: 'Giá trị đơn 12tr', maDonPos: '1T10/2026' }] }, { name: 'ngoc', total: 50000, items: [{ date: '2026-10-14', scope: 'Theo ngày (đơn đầu tiên)', program: 'GĐ1 thử việc', amount: 50000, detail: '<b>đơn đầu</b>' }] }] })
});
vm.runInContext(j01.slice(fa, fb) + '\n' + j63, ctx);
const orders = [
  { saleBan: 'an', giaTriDon: 20e6, nguonDon: 'Zalo' }, { saleBan: 'an', giaTriDon: 5e6, nguonDon: 'Zalo' },
  { saleBan: 'an, binh', giaTriDon: 10e6, nguonDon: 'Facebook / Hiền Tour' }, { saleBan: 'binh', giaTriDon: 8e6, nguonDon: 'Page' }
];
const store = { rows: [
  { koDen: false, tenKh: 'Khach A', phone: '0900', orders: [{ excluded: false, giaTri: 20e6, ymd: '2026-10-03', posRow: 9, nguonDon: 'Quầy', credits: [{ sale: 'an', amount: 3e6 }, { sale: 'binh', amount: 3e6, dup: true }] }] },
  { koDen: true, orders: [{ giaTri: 9e6, credits: [{ sale: 'an', amount: 5e6 }] }] },
  { koDen: false, orders: [{ excluded: true, giaTri: 9e6, credits: [{ sale: 'an', amount: 5e6 }] }] }
] };
const R = vm.runInContext('(function(o,s){ return _computeSaleIncome_(o,s); })', ctx)(orders, store);
const g = n => R.rows.find(r => r.name === n);
// an: Zalo >=15tr 20tr*1.5% = 300000; Zalo <15tr 5tr*1% = 50000; FB (1%, chia 2 => 5tr) = 50000
ok(g('an').tier === 350000, 'an: hoa hong theo muc don theo nguon = 350.000 (' + g('an').tier + ')');
ok(g('an').channelComm === 50000, 'an: hoa hong kenh Facebook 1% x 5tr = 50.000');
ok(g('an').store === 45000, 'an: don chia cua hang 3tr x 1.5% (don 20tr >=15tr) = 45.000; bo Trung/chua den/hoan (' + g('an').store + ')');
ok(g('binh').store === 0, 'binh: phan chia bi Trung khong tinh');
ok(g('an').official === 20000 && g('an').trial === 0, 'an: thuong chinh thuc 20.000');
ok(g('ngoc').trial === 50000 && g('ngoc').official === 0, 'ngoc: thuong thu viec 50.000 (chuong trinh bat probationDay)');
ok(g('an').total === 350000 + 50000 + 45000 + 20000, 'an: tong = tong 5 nhom');
ok(g('an').lines.filter(l => l.group === 'Hoa hồng theo mức đơn').length === 2, 'an: co dong rieng cho tung nguon+bucket');
// tong cac dong chi tiet = tong tung nhom
R.rows.forEach(r => ok(r.lines.reduce((s, l) => s + l.amount, 0) === r.total, r.name + ': tong dong chi tiet = tong (' + r.lines.reduce((s, l) => s + l.amount, 0) + ' vs ' + r.total + ')'));
const c = vm.runInContext('(function(o){ return _computeCommissionData_(o); })', ctx)(orders);
ok(Math.round(c.bySale.find(x => x.name === 'an').commission) === g('an').tier + g('an').channelComm, 'khong lech so voi cot Hoa hong hien co cua Bao cao E');
ok(R.totals.total === R.rows.reduce((s, r) => s + r.total, 0), 'tong cot = tong cac Sale');
// Giao dien: render khong loi, co dong Chi tiet khi mo, canh bao khi thieu du lieu cua hang
Object.assign(ctx, { esc: x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;'), fmt: n => (n || 0).toLocaleString('vi-VN'), _srMoney: n => Math.round(n || 0) + 'd',
  _srTotalRowHtml_: c => '<tr class="tot">' + c.map(x => '<td>' + x + '</td>').join('') + '</tr>', _srState: { eSaleSearch: '', dataEStore: store, incomeOpen: '' } });
const html0 = vm.runInContext('(function(o){ return _srIncomeSectionHtml_({orders:o}); })', ctx)(orders);
ok(/Thu nhập từng Sale/.test(html0) && /Tổng nhận/.test(html0) && !/Hoa hồng kênh\/nguồn % riêng/.test(html0), 'render bang tong hop (chua mo chi tiet)');
ctx._srState.incomeOpen = 'in_0';
const html1 = vm.runInContext('(function(o){ return _srIncomeSectionHtml_({orders:o}); })', ctx)(orders);
ok(/Hoa hồng kênh\/nguồn % riêng/.test(html1) && /Facebook/.test(html1) && /Thưởng chính thức/.test(html1), 'mo Chi tiet: hien nhom + nguon Facebook + thuong');
ctx._srState.dataEStore = null; ctx._srState.dataEStoreErr = 'het phien';
ok(/Chưa tải được dữ liệu đơn chia/.test(vm.runInContext('(function(o){ return _srIncomeSectionHtml_({orders:o}); })', ctx)(orders)), 'thieu du lieu cua hang -> canh bao');
// Xuat Excel: tong hop = tung Sale + dong TONG; chi tiet = moi dong chi tiet 1 dong, tong tien khop
const X = vm.runInContext('(function(o,s){ return _incomeExportRows_(_computeSaleIncome_(o,s)); })', ctx)(orders, store);
ok(X.sum.length === 1 + R.rows.length + 1 && X.sum[X.sum.length - 1][7] === R.totals.total, 'Excel: Tong hop co header + tung Sale + dong TONG khop');
ok(X.det.length - 1 === R.rows.reduce((s, r) => s + r.lines.length, 0), 'Excel: Chi tiet du so dong');
ok(X.det.slice(1).reduce((s, r) => s + r[7], 0) === R.totals.total, 'Excel: tong tien sheet Chi tiet = tong nhan');
ok(X.det[0].length === X.det[1].length, 'Excel: so cot header = so cot dong du lieu');
process.exit(bad ? 1 : 0);

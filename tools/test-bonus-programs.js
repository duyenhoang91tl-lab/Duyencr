#!/usr/bin/env node
// Test Node: thuong theo SAN PHAM (ma x so luong) + theo NGUON (chung online/offline) trong js/12 + buildDonProducts_ trong gas_v13.js.
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const j12 = R('js/12-fn-rendersalesreporttabe.js'), g = R('gas_v13.js'), j01 = R('js/01-fn-splitmulti.js'), j05 = R('js/05-fn-saveeditphone.js');
const fn = (src, n) => { const i = src.indexOf('\nfunction ' + n + '('); if (i < 0) throw new Error('khong thay ' + n); return src.slice(i + 1, src.indexOf('\n}\n', i) + 3); };
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const ctx = { SALE_CHANNELS: { An: 'online', Binh: 'offline' }, BONUS_PROGRAMS: [], _srMoney: n => String(n), accounts: [], _acctNamesOf: () => [] };
vm.createContext(ctx);
vm.runInContext(fn(j05, 'esc') + fn(j01, 'splitMulti_') + ['_bonusProgramApplies_', '_ddmmyyyyToYmd_', '_daysSinceStart_', '_saleStartDate_', '_bonusProductQty_', '_bonusNamesOfOrder_', '_orderRevenueShares_',
  '_bonusNormSrc_', '_bonusSourceOk_', '_bonusOrderProductQtys_', '_bonusAggSources_', '_bonusRequireKw_', '_bonusRequireProductOk_', '_computeBonusData_'].map(n => fn(j12, n)).join('\n'), ctx);
const calc = (progs, orders) => { ctx.P = progs; ctx.O = orders; return JSON.parse(vm.runInContext('BONUS_PROGRAMS = P; JSON.stringify(_computeBonusData_(O))', ctx)); };
const base = { dateFrom: '', dateTo: '', audience: { online: false, offline: false }, product: '', requireProduct: '', tier: { enabled: false, rows: [] }, revenue: { enabled: false, scope: 'order', min: '', max: '' }, firstOrder: { enabled: false, amount: '' }, probationDay: { enabled: false }, bonusAmount: '' };
const o = (id, sale, nguon, ma, sl, val, ngay) => ({ id, saleBan: sale, nguonDon: nguon, maSanPham: ma, soLuong: sl, sanPham: 'x', giaTriDon: val || 1000000, ngayTao: ngay || '05/09/2026 10:00' });
// --- san pham ---
const prod = Object.assign({}, base, { id: 'p1', name: 'Thuong SP', prodRules: { enabled: true, items: [{ code: 'SP1', name: 'Ty huu', amount: '10000' }, { code: 'sp2', name: 'Nhan', amount: 5000 }, { code: 'SP9', name: 'Khong ban', amount: 99999 }] } });
let r = calc([prod], [o(1, 'An', 'fb', 'SP1;SP2;SP3', '2, 1, 4'), o(2, 'An, Binh', 'fb', 'SP1', '3')]);
const an = r.bySale.find(x => x.name === 'An'), bi = r.bySale.find(x => x.name === 'Binh');
ok(an.total === 25000 + 15000, 'An: don1 25k + don2 chia doi 15k = ' + an.total);
ok(bi.total === 15000, 'Binh: nua don2 = ' + bi.total);
ok(an.items.every(x => x.scope === 'Theo sản phẩm'), 'scope');
// 2 chuong trinh SP khac nhau cung don -> cong don
const prodB = Object.assign({}, prod, { id: 'p2', name: 'SP khac', prodRules: { enabled: true, items: [{ code: 'SP3', name: 'Khac', amount: 1000 }] } });
r = calc([prod, prodB], [o(1, 'An', 'fb', 'SP1;SP2;SP3', '2, 1, 4')]);
ok(r.bySale[0].total === 25000 + 4000, 'cong don 2 CT san pham: ' + r.bySale[0].total);
// ma khong khop -> 0 ; tat enabled -> 0
ok(calc([Object.assign({}, prod, { prodRules: { enabled: false, items: prod.prodRules.items } })], [o(1, 'An', 'fb', 'SP1', '2')]).total === 0, 'tat thi 0');
ok(calc([prod], [o(1, 'An', 'fb', 'ZZ', '2')]).total === 0, 'ma khong khop');
// --- nguon ---
const src = Object.assign({}, base, { id: 's1', name: 'Nguon FB', sources: ['Facebook'], tier: { enabled: true, rows: [{ count: 2, bonus: 30000 }] } });
const day = [o(1, 'An', 'facebook', 'A', '1'), o(2, 'An', ' FACEBOOK ', 'A', '1'), o(3, 'An', 'zalo', 'A', '1'),      // An: 2 don FB + 1 zalo -> dat bac 2
  o(4, 'Binh', 'facebook', 'A', '1'), o(5, 'Binh', 'zalo', 'A', '1'), o(6, 'Binh', 'zalo', 'A', '1'),                  // Binh: 1 FB + 2 zalo -> KHONG dat (chi dem FB)
  o(7, 'Chi', 'facebook', 'A', '1'), o(8, 'Chi', 'facebook', 'A', '1')];                                               // Chi chua phan loai kenh -> van duoc (chung online/offline)
r = calc([src], day);
const by = n => (r.bySale.find(x => x.name === n) || { total: 0 }).total;
ok(by('An') === 30000 && by('Binh') === 0 && by('Chi') === 30000, 'theo nguon: ' + JSON.stringify(r.bySale.map(x => [x.name, x.total])));
// CT theo nguon voi audience online: van ap chung (bo qua audience)
r = calc([Object.assign({}, src, { audience: { online: true, offline: false } })], day);
ok(by('Binh') === 0 && by('Chi') === 30000 && by('An') === 30000, 'bo qua audience khi co nguon');
// CT khong co nguon van tinh tat ca (3 don An)
r = calc([Object.assign({}, src, { sources: [] })], day);
ok(by('An') === 30000 && by('Binh') === 30000, 'khong gioi han nguon = nhu cu');
// doanh so ngay chi cong don thuoc nguon
r = calc([Object.assign({}, base, { id: 'r1', name: 'DS FB', sources: ['facebook'], revenue: { enabled: true, scope: 'day', min: 3000000, max: '' }, bonusAmount: 50000 })],
  [o(1, 'An', 'facebook', 'A', '1', 2000000), o(2, 'An', 'zalo', 'A', '1', 5000000)]);
ok(r.total === 0, 'doanh so chi tinh nguon FB (2tr < 3tr): ' + r.total);
// nguon theo don + gia tri don
r = calc([Object.assign({}, base, { id: 'r2', name: 'Don FB', sources: ['facebook'], revenue: { enabled: true, scope: 'order', min: 1000000, max: '' }, bonusAmount: 20000 })],
  [o(1, 'An', 'facebook', 'A', '1', 2000000), o(2, 'An', 'zalo', 'A', '1', 5000000)]);
ok(r.total === 20000, 'don theo nguon: ' + r.total);
// --- GAS buildDonProducts_ ---
const gctx = { _donHasExcludedStatus_: t => /hoan/i.test(t || '') }; vm.createContext(gctx);
vm.runInContext(fn(g, 'splitMulti_') + fn(g, 'buildDonProducts_'), gctx);
gctx.rows = [{ trangThai: '', maSanPham: 'SP1;SP2', sanPham: 'Ty huu, Nhan', soLuong: '2, 1' }, { trangThai: '', maSanPham: 'SP1', sanPham: 'Ty huu', soLuong: '3' }, { trangThai: 'Da hoan', maSanPham: 'SP1', sanPham: 'Ty huu', soLuong: '9' },
  { trangThai: '', maSanPham: 'SP3;SP4', sanPham: 'Chi mot ten', soLuong: '1, 1' }];
const pr = vm.runInContext('buildDonProducts_(rows)', gctx);
ok(pr[0].code === 'SP1' && pr[0].qty === 5 && pr[0].name === 'Ty huu' && pr.find(x => x.code === 'SP2').name === 'Nhan' && pr.find(x => x.code === 'SP3').name === '', 'buildDonProducts_: ' + JSON.stringify(pr));
console.log('ALL BONUS TESTS PASSED');
// --- ve thu form modal (khong loi, co muc 4b/4c) ---
const uctx = { esc: s => String(s == null ? '' : s), _srState: { nguonOptions: ['facebook', 'zalo'], optionsLoaded: true }, gsUrl: '', setTimeout: () => 0, document: { getElementById: () => null }, _bpDraft: null, BONUS_PROGRAMS: [] };
vm.createContext(uctx);
vm.runInContext(['_bonusNormSrc_', '_bonusRequireKw_', '_bpNewProgram', '_bpNormalize_', '_bpProdSectionHtml_', '_bpProdListHtml_', '_bpProdSelHtml_', '_bpSrcSectionHtml_', '_bpSrcListHtml_', '_bpSrcSelHtml_', '_bpNorm_', '_bpProdRefresh_', '_bpSrcRefresh_', '_bpProdToggle', '_bpSrcToggle'].map(n => fn(j12, n)).join('\n') +
  '\nvar _bpProducts=[{code:"SP1",name:"Tỳ hưu",qty:5}], _bpProdLoading=false,_bpProdErr="",_bpProdQuery="",_bpSrcQuery="";_bpDraft=_bpNormalize_(_bpNewProgram());_bpDraft.prodRules.enabled=true;', uctx);
const html = vm.runInContext('_bpProdSectionHtml_(_bpDraft)+_bpSrcSectionHtml_(_bpDraft)', uctx);
ok(/Tỳ hưu/.test(html) && /facebook/.test(html) && /4b\./.test(html) && /4c\./.test(html), 'form render');
vm.runInContext('_bpProdToggle("SP1",true);_bpSrcToggle("zalo",true);', uctx);
ok(vm.runInContext('_bpDraft.prodRules.items.length===1&&_bpDraft.sources[0]==="zalo"', uctx), 'toggle');
console.log('FORM OK');

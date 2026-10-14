// Test: Ty le chot gop dung "cung 1 nguoi" (ten base != ten pos) — chay: node tools/test-closerate-person-fold.js [duong_dan_gas_v13.js]
// Chay ham THAT trong gas_v13.js (_salePersonKeyFn_, _srCloseRateSections_, _normTxt_) voi cac ham doc sheet duoc gia lap.
const fs = require('fs'), vm = require('vm'), path = require('path');
const FILE = process.argv[2] || path.join(__dirname, '..', 'gas_v13.js');
const src = fs.readFileSync(FILE, 'utf8');
const grab = (name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
let fails = 0; const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; console.log('FAIL', m, '\n   co :', JSON.stringify(a), '\n   can:', JSON.stringify(b)); } else console.log('ok  ', m); };

function run(scn) {
  const ctx = {
    _userAliasGroups_: () => scn.userGroups || {},
    readSaleDirectory_: () => ({ list: scn.dir || [] }),
    readPancakeMap_: () => scn.pkMap || {},
    readPancakePageMap_: () => ({ P1: 'K1' }),
    _dateStrToVnYmd_: (x) => x, normOrderDate_: (x) => x,
    _pkTrackedDatesByPageAndSale_: () => ({ datesByPage: { P1: { '2026-10-05': true } } }),
    parseVNDate_: (s) => new Date(s + 'T00:00:00Z'), _vnYmd_: (d) => d.toISOString().slice(0, 10),
    splitMulti_: (raw) => String(raw || '').split(',').map((x) => x.trim()).filter(Boolean),
    _pkStatsRowsMemo_: () => scn.pkRows,
    buildPancakeReport_: () => ({ byCS: scn.byCS, byPage: [{ pageId: 'P1', tongTT: scn.byCS.reduce((s, r) => s + r.tongTT, 0) }] }),
  };
  vm.createContext(ctx);
  ['_normTxt_', '_salePersonKeyFn_', '_srCloseRateSections_'].forEach((n) => { const code = grab(n); if (code) vm.runInContext(code, ctx); });
  const rows = []; (scn.orders || []).forEach(([sale, n]) => { for (let i = 0; i < n; i++) rows.push({ kenhBan: 'K1', dateStr: '2026-10-05', saleBanRaw: sale }); });
  return ctx._srCloseRateSections_(rows, { dateFrom: '2026-10-01', dateTo: '2026-10-31' });
}
const pkRow = (nv, tt) => ['2026-10-05', 'P1', 'Page 1', nv, 0, 0, tt, 0, 0, 0, 0, 0, 0];
const find = (arr, n) => arr.find((r) => r.name.toLowerCase() === n.toLowerCase());

// === Ca chinh: ca cua Duyen. Pancake (tuong tac) ghi 'Thuydinh1995', POS (don) ghi 'thuydinh95', da link o SaleDirectory ===
const scn = {
  dir: [{ maSale: 'TD', tenFacebook: 'Thuý Dinh', userBase: 'thuydinh1995', tenTagPancake: 'thuydinh95' }],
  byCS: [{ name: 'Thuydinh1995', tongTT: 1859 }, { name: 'ninhnga99', tongTT: 2998 }, { name: 'yenNTH2004', tongTT: 1768 }],
  orders: [['thuydinh95', 55], ['ninhnga99', 57], ['yenNTH2004', 25]],
  pkRows: [pkRow('Thuydinh1995', 1000), pkRow('Thuydinh1995', 859), pkRow('ninhnga99', 2998)],
  pkMap: {},
};
let out = run(scn);
const td = find(out.saleCloseRate, 'thuydinh1995');
eq(td && [td.closed, td.held, td.closeRate], [55, 1859, 3], 'thuydinh95 (pos) + Thuydinh1995 (base) = 1 dong 55/1859 = 3%');
eq(out.saleCloseRate.filter((r) => /thuydinh/i.test(r.name)).length, 1, 'khong con dong thuydinh95 rieng (0 tuong tac)');
eq(find(out.saleCloseRate, 'ninhnga99').closeRate, 1.9, 'sale khac khong bi anh huong (57/2998 = 1.9%)');
const pageTd = out.saleCloseByPage.rows.find((r) => /thuydinh/i.test(r.name));
eq(pageTd && [pageTd.total.closed, pageTd.total.held, pageTd.perPage.K1.closed, pageTd.perPage.K1.held], [55, 1859, 55, 1859], 'bang theo Page: gop 1 dong, cong don 2 dong tuong tac (1000+859), khong ghi de');
eq(out.saleCloseByPage.rows.filter((r) => /thuydinh/i.test(r.name)).length, 1, 'bang theo Page: khong tach 2 dong');

// === Don vua ghi ten base vua ghi ten pos: phai CONG DON ===
let o2 = run(Object.assign({}, scn, { orders: [['thuydinh95', 55], ['thuydinh1995', 5]] }));
eq(find(o2.saleCloseRate, 'thuydinh1995').closed, 60, 'don ghi ca 2 ten cua cung 1 nguoi -> cong don 60');

// === 2 dong tuong tac cung nguoi (Pancake tach 2 ten) -> cong tongTT, khong ghi de ===
let o3 = run({ dir: scn.dir, byCS: [{ name: 'thuydinh1995', tongTT: 1000 }, { name: 'thuydinh95', tongTT: 859 }], orders: [['thuydinh95', 55]], pkRows: [] });
eq([find(o3.saleCloseRate, 'thuydinh1995').held, find(o3.saleCloseRate, 'thuydinh1995').closed], [1859, 55], 'hai dong Pancake cung nguoi -> held cong don 1859');

// === Nguon lien ket khac: Users.names / salePersonTags (qua _userAliasGroups_) va PancakeNameMap 1-1 ===
let o4 = run({ userGroups: { thuydinh1995: ['thuydinh1995', 'thuydinh95'], thuydinh95: ['thuydinh1995', 'thuydinh95'] }, byCS: [{ name: 'thuydinh1995', tongTT: 100 }], orders: [['thuydinh95', 3]], pkRows: [] });
eq(find(o4.saleCloseRate, 'thuydinh1995').closed, 3, 'lien ket qua Users.names/salePersonTags');
let o5 = run({ pkMap: { thuydinh95: 'thuydinh1995' }, byCS: [{ name: 'thuydinh1995', tongTT: 100 }], orders: [['thuydinh95', 4]], pkRows: [] });
eq(find(o5.saleCloseRate, 'thuydinh1995').closed, 4, 'lien ket qua PancakeNameMap 1-1');

// === BAO VE: 1 ten Pancake chia 2 sale ('saleA|saleB') KHONG duoc gop 2 NGUOI KHAC NHAU ===
let o6 = run({ pkMap: { SharedAcc: 'saleA|saleB' }, byCS: [{ name: 'saleA', tongTT: 100 }, { name: 'saleB', tongTT: 200 }], orders: [['saleA', 5], ['saleB', 20]], pkRows: [] });
eq([find(o6.saleCloseRate, 'saleA').closed, find(o6.saleCloseRate, 'saleB').closed], [5, 20], 'saleA|saleB khong bi gop thanh 1 nguoi');

// === Khong co lien ket nao: hanh vi cu giu nguyen (2 ten khac nhau = 2 dong) ===
let o7 = run({ byCS: [{ name: 'thuydinh1995', tongTT: 100 }], orders: [['thuydinh95', 3]], pkRows: [] });
eq(o7.saleCloseRate.length, 2, 'chua link thi van tach 2 dong nhu cu (khong tu doan)');
// === Don chua gan sale + khac hoa/thuong ===
let o8 = run({ byCS: [{ name: 'Ninh Nga', tongTT: 10 }], orders: [['ninh nga', 1], ['', 2]], pkRows: [] });
eq([find(o8.saleCloseRate, 'ninh nga').closed, find(o8.saleCloseRate, '(chưa gán sale)').closed], [1, 2], 'khac hoa/thuong gop dung; don chua gan sale giu nguyen');
console.log(fails ? '\n' + fails + ' CA SAI' : '\nTAT CA PASS'); process.exit(fails ? 1 : 0);

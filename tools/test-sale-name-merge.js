#!/usr/bin/env node
// Test GOM TEN SALE THEO NGUOI o Bao cao B (Duyen 2026-11-10: "Thuydinh1995"/"thuydinh95", "Biichnguyen1993"/"biichnguyen1993" bi tach 2 dong).
// Chay ham GAS THAT buildSalesReportB_ + _foldRevMapByPerson_ voi du lieu gia. Chay: node tools/test-sale-name-merge.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const J = x => JSON.parse(JSON.stringify(x));
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
  // Giong code that: chon 1 ten trong nhom thi mo rong ra DU moi ten cung nguoi (thuydinh95 <-> Thuydinh1995)
  _expandSaleFilterWithPancakeAliases_ = function(a) { var out = a.slice(), g = ['thuydinh95', 'Thuydinh1995']; if (a.some(function(x) { return g.indexOf(x) !== -1; })) g.forEach(function(x) { if (out.indexOf(x) === -1) out.push(x); }); return out; };
  readTeams_ = function() { return []; }; readMktTeams_ = function() { return []; };
  // Tai khoan CRM co ten DAY DU o dau danh sach ten (nguyen nhan hien 'Nguyễn Thị Bích' thay vi Biichnguyen1993)
  readUsers_ = function() { return [{ username: 'bich', role: 'cs', name: 'Nguyễn Thị Bích', names: ['Nguyễn Thị Bích', 'Biichnguyen1993'] }, { username: 'ninh', role: 'cs', name: 'ninhLTK', names: ['ninhLTK', 'ninhLTK1984'] }, { username: 'trang', role: 'cs', name: 'Nguyễn Huyền Trang', names: [] }]; };
  _mktKenhWeights_ = function() { return {}; }; readKPITargets_ = function() { return {}; };
  // Danh ba: Base chuan "Thuydinh1995" cung nguoi voi the Pos "thuydinh95"
  readSaleDirectory_ = function() { return { list: [{ maSale: '', code: '', tenFacebook: '', userBase: 'Thuydinh1995', tenTagPancake: 'thuydinh95' }] }; };
`, ctx);
ctx.__acct = { rows: [], byCode: {}, byCodeNoYear: {}, err: '' };
vm.runInContext('_loadAcctSplit_ = function() { return __acct; };', ctx);
let n = 0;
const don = (sale, val) => ({ ngayTaoDon: '02/11/2026', trangThai: 'Hoàn thành', theSale: sale, soDienThoai: '0900000' + String(100 + (n++)), nguonDon: 'Facebook', giaTri: val, giaTriSauGiam: val, sanPham: 'Nhẫn', maSanPham: 'N1', soLuong: '1', khachHang: 'K', cod: 0, marketer: '', ghiChu: '' });
const run = (d, f) => { ctx.__don = d; return J(vm.runInContext('buildSalesReportB_(Object.assign({ dateFrom: "2026-11-01", dateTo: "2026-11-30" }, ' + JSON.stringify(f || {}) + '))', ctx)); };
const row = (B, nm) => B.bySale.filter(r => r.name.toLowerCase() === nm.toLowerCase());

// 1) 2 ten khac nhau cung nguoi (alias danh ba) -> 1 dong, tien + so don cong lai
let B = run([don('thuydinh95', 1000000), don('Thuydinh1995', 2000000)]);
ok(B.bySale.length === 1 && B.bySale[0].giaTri === 3000000 && B.bySale[0].orders === 2, 'thuydinh95 + Thuydinh1995 -> 1 dong 3.000.000 / 2 don (' + B.bySale.map(r => r.name).join('|') + ')');
ok(B.bySale[0].name === 'Thuydinh1995', 'ten hien thi = ten chuan Base "Thuydinh1995" (nhan: ' + B.bySale[0].name + ')');
// 2) chi khac hoa/thuong -> 1 dong
B = run([don('biichnguyen1993', 500000), don('Biichnguyen1993', 700000)]);
ok(B.bySale.length === 1 && B.bySale[0].giaTri === 1200000 && B.bySale[0].orders === 2, 'biichnguyen1993 / Biichnguyen1993 -> 1 dong 1.200.000');
// 3) 1 don co 2 ten cua CUNG nguoi -> 1 don, du tien (khong dem doi)
B = run([don('thuydinh95, Thuydinh1995', 1000000)]);
ok(B.bySale.length === 1 && B.bySale[0].orders === 1 && B.bySale[0].giaTri === 1000000 && B.totalGiaTri === 1000000, '1 don ghi 2 ten cung nguoi: 1 don, 1.000.000 (khong chia doi, khong dem 2 lan)');
// 4) 2 nguoi KHAC nhau van chia deu nhu cu
B = run([don('minhanh99, lanVH1995', 6000000)]);
ok(B.bySale.length === 2 && B.bySale.every(r => r.giaTri === 3000000 && r.orders === 1), '2 nguoi khac nhau: chia deu 3.000.000 moi nguoi, moi nguoi 1 don');
// 5) Tong khong doi + tong bang tong don
B = run([don('thuydinh95', 1000000), don('Thuydinh1995', 2000000), don('minhanh99', 4000000)]);
ok(B.bySale.reduce((s, r) => s + r.giaTri, 0) === B.totalGiaTri && B.totalGiaTri === 7000000, 'tong Theo Sale = tong bao cao = 7.000.000');
// 6) Loc theo 1 ten alias van ra dung nguoi do (khong mat don cua ten kia)
B = run([don('thuydinh95', 1000000), don('Thuydinh1995', 2000000), don('minhanh99', 4000000)], { sale: ['thuydinh95'] });
ok(B.bySale.length === 1 && B.bySale[0].giaTri === 3000000, 'loc sale = thuydinh95 -> chi 1 dong Thuydinh1995 3.000.000 (' + JSON.stringify(B.bySale.map(r => [r.name, r.giaTri])) + ')');
// 7) Theo Team: tien khong bi dem trung
ok(B.byTeamSale.reduce((s, r) => s + r.giaTri, 0) === 3000000, 'Theo Team khop 3.000.000');
// 8) don tra ve: bs (cua so chi tiet) dung ten da gop
B = run([don('thuydinh95', 1000000), don('Thuydinh1995', 2000000)]);
ok(B.orders.every(o => J(o.bs).every(p => p[0] === 'Thuydinh1995')), 'bs cua tung don dung ten da gop (de bam vao dong ra don)');
// 9) _foldRevMapByPerson_: anh chup chot thang luc cu mang ten goc -> khop ten chinh hien tai, khong sinh khoan tru gia
const fold = J(vm.runInContext('_foldRevMapByPerson_({ thuydinh95: 100, Thuydinh1995: 50, minhanh99: 70 }, [{ Thuydinh1995: 1 }])', ctx));
ok(fold.Thuydinh1995 === 150 && fold.minhanh99 === 70 && !fold.thuydinh95, '_foldRevMapByPerson_: thuydinh95 100 + Thuydinh1995 50 -> Thuydinh1995 150');
// 10) Ten chinh co khoang trang -> doi sang username Base (khong hien ten day du)
B = run([don('biichnguyen1993', 500000), don('Biichnguyen1993', 700000)]);
ok(B.bySale.length === 1 && B.bySale[0].name === 'Biichnguyen1993', 'tai khoan CRM ten day du "Nguyễn Thị Bích": bang van hien username Biichnguyen1993 (nhan: ' + B.bySale.map(r => r.name).join('|') + ')');
const pr = J(vm.runInContext('(function(){ var id = _salePersonIdentity_([]); return [id.primary("biichnguyen1993"), id.primary("ninhLTK1984"), id.primary("Nguyễn Huyền Trang")]; })()', ctx));
ok(pr[0] === 'Biichnguyen1993' && pr[1] === 'ninhLTK1984', 'primary: Biichnguyen1993 / ninhLTK1984 (uu tien username co so) (nhan: ' + pr.join(' | ') + ')');
ok(pr[2] === 'Nguyễn Huyền Trang', 'nhom chi co ten day du (khong co username): giu nguyen');
// 11) admin da dat ten chinh o Khop sale (ke ca ten co khoang trang) -> KHONG doi
vm.runInContext('getSetting_ = function(k) { return k === "salePersonTags" ? JSON.stringify({ "Nguyễn Thị Bích": ["Biichnguyen1993"] }) : null; };', ctx);
const pr2 = J(vm.runInContext('_salePersonIdentity_([]).primary("Biichnguyen1993")', ctx));
ok(pr2 === 'Nguyễn Thị Bích', 'ten chinh admin dat o Khop sale duoc giu nguyen (nhan: ' + pr2 + ')');
console.log(fails ? '\nFAILED ' + fails : '\nALL SALE-NAME-MERGE TESTS PASSED'); process.exit(fails ? 1 : 0);

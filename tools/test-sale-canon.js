#!/usr/bin/env node
// Test CHUAN HOA DANH TINH ve TEN CHINH o backend (Duyen 2026-10-15): _salePersonIdentity_ (quy tac ten chinh, danh sach ten cung nguoi), _saleCanonOrders_,
// va Bao cao B tra don voi saleBanValid/saleThe/saleShares da quy ve ten chinh + saleIdentity. Chay: node tools/test-sale-canon.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
vm.runInContext(`
  var __users = [], __tags = '', __dir = [], __pk = {};
  getCrmSS_ = function() { return { getSheetByName: function() { return null; } }; };
  readUsers_ = function() { return __users; };
  getSetting_ = function(k) { return k === 'salePersonTags' ? __tags : ''; };
  readSaleDirectory_ = function() { return { list: __dir, byName: {} }; };
  readPancakeMap_ = function() { return __pk; };
`, ctx);
const set = (u, tags, dir, pk) => { ctx.__users = u || []; ctx.__tags = tags ? JSON.stringify(tags) : ''; ctx.__dir = dir || []; ctx.__pk = pk || {}; };
const U = (username, name, names, role) => ({ username, name, names, role: role || 'cs' });
const prim = (n, obs) => vm.runInContext('_salePersonIdentity_(' + JSON.stringify(obs || []) + ').primary(' + JSON.stringify(n) + ')', ctx);
const members = (n) => vm.runInContext('_salePersonIdentity_().members(' + JSON.stringify(n) + ')', ctx);

// 1) Quy tac ten chinh theo thu tu uu tien
set([U('saleA', 'Anh', ['anhNP1999', 'anhnp99'])]);
eq(prim('anhnp99'), 'anhNP1999', 'ten chinh = ten DAU TIEN cua tai khoan Sale (du dang hoi bang ten phu)'); eq(prim('ANHNP1999'), 'anhNP1999', 'khong phan biet hoa/thuong');
set([U('saleA', 'Anh', ['anhNP1999', 'anhnp99'])], { anhnp99: ['anhNP1999'] });
eq(prim('anhNP1999'), 'anhnp99', 'The (salePersonTags) co uu tien cao nhat: ten chinh cua The');
set([], null, [{ maSale: 'S4', tenFacebook: 'Thu Nguyen', userBase: 'thuNH1986', tenTagPancake: 'thuNH1986tag' }]);
eq(prim('Thu Nguyen'), 'thuNH1986', 'SaleDirectory: ten chinh = user Base'); eq(prim('S4'), 'thuNH1986', 'ma Sale cung ve ten chinh');
set([], null, [], { 'Hai Yen FB': 'yenNTH2004', 'Chung': 'saleX|saleY' });
eq(prim('Hai Yen FB', ['yenNTH2004']), 'Hai Yen FB', 'chua co quy tac -> ten nho nhat theo chu cai trong cac ten da biet (on dinh)');
eq(prim('yenNTH2004'), 'Hai Yen FB', 'tu ten kia cung ra CUNG ten chinh (hai chieu)');
eq(prim('saleX'), 'saleX', 'ten khong ai khop -> giu nguyen'); eq(prim(''), '', 'rong -> rong');
// leader liet ke nhieu nguoi KHONG gop
set([U('saleA', 'Anh', ['anhNP1999']), U('saleD', 'Dung', ['dungnguyen1995']), U('lead1', 'Lan', ['anhNP1999', 'dungnguyen1995'], 'leader')]);
eq(prim('anhNP1999'), 'anhNP1999', 'leader khong lam 2 nguoi thanh 1'); eq(prim('dungnguyen1995'), 'dungnguyen1995', 'nguoi thu 2 giu ten rieng');
// members: moi ten cung nguoi
set([U('saleA', 'Anh', ['anhNP1999', 'anhnp99'])], { anhnp99: ['anhthe1'] });
eq(members('anhNP1999').slice().sort(), ['Anh', 'anhNP1999', 'anhthe1', 'anhnp99'].sort(), 'members: du ten tai khoan + The');

// 2) _saleCanonOrders_: doi + bo trung + gop ty le
set([U('saleA', 'Anh', ['anhNP1999', 'anhnp99']), U('saleD', 'Dung', ['dungnguyen1995'])]);
const cn = (orders) => JSON.parse(vm.runInContext('JSON.stringify((function(){ var c = _saleCanonOrders_(' + JSON.stringify(orders) + '); return { list: c.list(["anhnp99","anhNP1999","dungnguyen1995"]), shares: c.shares([{name:"anhnp99",frac:0.5},{name:"anhNP1999",frac:0.25},{name:"dungnguyen1995",frac:0.25}]), alias: c.aliasMap }; })())', ctx));
let c = cn([{ theSale: 'anhnp99' }, { theSale: 'anhNP1999, dungnguyen1995' }]);
eq(c.list, ['anhNP1999', 'dungnguyen1995'], 'list: 2 ten cua cung 1 nguoi -> 1 (don khong bi chia doi cho cung 1 nguoi)');
eq(c.shares, [{ name: 'anhNP1999', frac: 0.75 }, { name: 'dungnguyen1995', frac: 0.25 }], 'shares: gop ty le cua cung 1 nguoi, tong van = 1');
eq(Object.keys(c.alias).sort(), ['anhNP1999', 'dungnguyen1995'], 'aliasMap gom nguoi co >= 2 ten (ten dang nhap + ten hien thi cua tai khoan cung la ten cua nguoi do)'); ok(c.alias.anhNP1999.indexOf('anhnp99') !== -1, 'aliasMap tra ve ten cung nguoi');

// 3) Bao cao B end-to-end: don Pos ghi 2 the cua cung 1 nguoi
vm.runInContext(`
  readDonChiTiet_ = function() { var d = function(day, the, i) { return { ngayTaoDon: day, trangThai: 'Hoàn thành', theSale: the, soDienThoai: '09000000' + i, nguonDon: 'Facebook / Page Mot (862972056891669)', giaTri: 1000000, giaTriSauGiam: 1000000, sanPham: 'Nhẫn vàng', maSanPham: 'N1', soLuong: 1, khachHang: 'K' + i, cod: 0, marketer: '' }; };
    return [d('05/10/2026', 'anhnp99', 1), d('05/10/2026', 'anhNP1999, anhnp99', 2), d('05/10/2026', 'anhNP1999, dungnguyen1995', 3)]; };
  _mergeTachDon_ = function(r) { return r; };
  readDTTong_ = function() { return []; };
  readPancakePageMap_ = function() { return {}; }; readPancakePageMapByName_ = function() { return {}; }; readPancakeMap_ = function() { return {}; };
  _pkStatsRowsMemo_ = function() { return []; }; _pkTrackedDatesByPageAndSale_ = function() { return { datesByPage: {}, datesBySale: {} }; };
  buildPancakeReport_ = function() { return { byCS: [], byPage: [] }; };
  readTeams_ = function() { return []; }; readMktTeams_ = function() { return []; };
  _pancakeKnownSaleNameSet_ = function() { return {}; };
`, ctx);
const B = vm.runInContext('buildSalesReportB_({ dateFrom: "2026-10-01", dateTo: "2026-10-12" })', ctx);
ok(B.orders && B.orders.length === 3, 'B tra 3 don');
const ord = {}; B.orders.forEach(o => { ord[o.soDienThoai] = o; });
eq(ord['090000001'].saleBanValid, 'anhNP1999', 'don the "anhnp99" -> ten chinh anhNP1999');
eq(ord['090000002'].saleBanValid, 'anhNP1999', 'don ghi 2 the cua CUNG 1 nguoi -> 1 nguoi (khong chia doi)');
eq(ord['090000003'].saleBanValid, 'anhNP1999,dungnguyen1995', 'don 2 nguoi khac nhau -> van 2 nguoi');
eq(ord['090000002'].saleThe, 'anhNP1999', 'saleThe cung duoc quy ve ten chinh');
eq(ord['090000002'].theSale, 'anhNP1999, anhnp99', 'theSale (chuoi tho de doi chieu/xuat Excel) GIU NGUYEN');
ok(B.saleIdentity && B.saleIdentity.anhNP1999 && B.saleIdentity.anhNP1999.indexOf('anhnp99') !== -1, 'B tra saleIdentity: ten chinh -> moi ten cung nguoi');
ok(B.saleIdentity.dungnguyen1995.length === 2 && B.saleIdentity.dungnguyen1995.indexOf('Dung') !== -1, 'nguoi thu 2: gom ten dang nhap + ten hien thi (khong lan sang Anh)');
console.log('ALL SALE CANON TESTS PASSED');

#!/usr/bin/env node
// Test js/89-pos-customers.js (DANH SACH KH KHOP DON POS, buoc 3/7): them khach chi co o POS. Chay: node tools/test-pos-customers.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js/89-pos-customers.js'), 'utf8');
const s02 = fs.readFileSync(path.join(__dirname, '..', 'js/02-fn-showrowerrorbanner.js'), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const names = ['Le phuong thao', 'Phuong Thuy', 'Huynh Kim Nguyet', 'Binh Le', 'Tran tuoi', 'Lo Lem', 'Thanh Phuong', 'Gau Panda', 'C Trang'];
const by = {};
names.forEach((n, i) => { by['09000000' + String(i).padStart(2, '0')] = [{ ds: '2026-11-16', name: n, sales: ['biichnguyen1993'], rev: 1, shares: [] }]; });
by['0911111111'] = [{ ds: '2026-11-10', name: '0911111111', sales: ['x'], rev: 1, shares: [] }, { ds: '2026-11-01', name: 'Ten that', sales: ['x'], rev: 1, shares: [] }];   // moi nhat chi la SDT -> lay ten that cu hon
by['0922222222'] = [{ ds: '2026-11-10', name: 'Khach da co DT tong', sales: ['x'], rev: 1, shares: [] }];
by['0933333333'] = [];   // khong co don
function boot(allC, chg) {
  const ctx = { console, Set, Object, String, Array, posOrdersByPhone: by, allCustomers: allC || [], posOrdersOnChange_: (fn) => { ctx._chg = fn; }, rebuilt: 0, buildCustomers: () => { ctx.rebuilt++; } };
  vm.createContext(ctx); vm.runInContext(src, ctx); return ctx;
}
// 1) inject: them 9 khach + khach ten that; khong ghi de khach co san; khong tao khi khong co don
let c = boot();
const map = { '0922222222': { phone: '0922222222', name: 'Ten tu DT tong', orders: [{}] } };
const n = vm.runInContext('posCustomersInject_', c)(map);
ok(n === 10 && Object.keys(map).length === 11, 'them 10 khach POS-only (9 khach 16/11 + 1 ten that), gop voi 1 khach co san: ' + n);
ok(map['0922222222'].name === 'Ten tu DT tong' && map['0922222222'].orders.length === 1 && !map['0922222222'].posOnly, 'khach co san (DT tong) giu nguyen — khong ghi de ten, khong danh dau posOnly');
ok(map['0911111111'].name === 'Ten that' && map['0900000004'].name === 'Tran tuoi' && map['0900000004'].posOnly === true, 'ten lay tu don POS moi nhat khac SDT; co posOnly');
ok(!map['0933333333'], 'SDT khong co don POS -> khong tao khach');
const k = map['0900000000']; ok(Array.isArray(k.orders) && k.orders.length === 0 && k.sources instanceof Set && k.brands instanceof Set && k._keys instanceof Set && k._rawStatus === '' && '_rawZalo' in k && '_rawNote' in k, 'cung hinh dang khach tao tu careLeads (orders rong + Set + _raw*)');
ok(vm.runInContext('posCustomersInject_', c)(map) === 0, 'chay lai: khong them trung (1 khach/1 SDT)');
// 2) chua tai don POS -> 0
c = boot(); vm.runInContext('posOrdersByPhone = null', c); ok(vm.runInContext('posCustomersInject_', c)({}) === 0, 'chua co don POS -> khong them');
// 3) listener: co SDT POS chua co khach -> dung lai 1 lan; da du khach -> khong
c = boot([{ phone: '0922222222' }]); c._chg(); ok(c.rebuilt === 1, 'co SDT POS chua co khach -> buildCustomers 1 lan');
const all = Object.keys(by).filter(p => by[p].length).map(p => ({ phone: p })); c = boot(all); c._chg(); ok(c.rebuilt === 0, 'moi SDT POS da co khach -> khong dung lai (khong lap)');
c = boot([]); c._chg(); ok(c.rebuilt === 0, 'chua co danh sach khach (chua nap du lieu) -> khong dung lai');
// 4) hook trong js/02 dat TRUOC khi dung allCustomers, SAU cac nhanh tao khach
const iH = s02.indexOf('posCustomersInject_(customerMap)'), iA = s02.indexOf('allCustomers = Object.values(customerMap)'), iC = s02.indexOf('Object.keys(cskhData).forEach(ph => {');
ok(iH > iC && iH < iA && iC > 0, 'hook posCustomersInject_ nam sau nhanh cskhData va truoc allCustomers = ...');
ok(/typeof posCustomersInject_ === 'function'/.test(s02), 'hook co guard typeof (go js/89 van chay)');
console.log(fails ? '\n' + fails + ' LOI' : '\nTAT CA DAT'); process.exit(fails ? 1 : 0);

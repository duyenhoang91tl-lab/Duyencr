#!/usr/bin/env node
// Test doanh thu Team chia theo NGUOI (js/08 _revenueByMembersChannels) — buoc 4/5 ho so chuan. Chay: node tools/test-team-revenue-person.js
const fs = require('fs'), vm = require('vm');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../js/08-fn-invalidatefiltercache.js', 'utf8');
const grab = name => { const i = src.search(new RegExp('function ' + name + '\\(')); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } };
const NINH = ['ninhnga99', 'Ngà Ninh', 'Ninh Nga', 'ninhnga99 pos'];
const mk = (orders) => {
  const ctx = { allCustomers: [{ orders }], _dashIsExcludedStatus: () => false, splitMulti_: (s) => String(s).split(',').map(x => x.trim()).filter(Boolean),
    _personAliases: (n) => NINH.some(x => x.toLowerCase() === String(n).toLowerCase()) ? NINH : [n], console };
  vm.createContext(ctx); ['_groupNamesByPerson', '_revenueByMembersChannels'].forEach(n => vm.runInContext(grab(n), ctx)); return ctx;
};
const rev = (orders, members, ch) => vm.runInContext('_revenueByMembersChannels(' + JSON.stringify(members) + ',' + JSON.stringify(ch || []) + ')', mk(orders));
const O = (cs, revenue) => ({ cs, revenue, status: 'ok', source: 'FB' });
// 1) don cua 1 nguoi gan 2 ten (Base + POS) -> van la 1 nguoi, doanh thu day du, dem 1 don
let r = rev([O('ninhnga99, Ninh Nga', 1000000)], NINH);
ok(r.revenue === 1000000 && r.orders === 1, 'don gan 2 ten cua CUNG 1 nguoi: doanh thu day du, 1 don');
// 2) vi du that: 'ninhnga99, Ninh Nga, thuongBT' = 2 NGUOI -> Ninh 1/2 (truoc day 2/3)
r = rev([O('ninhnga99, Ninh Nga, thuongBT', 900000)], NINH);
ok(r.revenue === 450000, 'Ninh (2 ten) + thuongBT = 2 nguoi -> Ninh nhan 1/2 = 450.000, khong phai 2/3: ' + r.revenue);
r = rev([O('ninhnga99, Ninh Nga, thuongBT', 900000)], ['thuongBT']);
ok(r.revenue === 450000, 'thuongBT cung nhan 1/2 (truoc day chi 1/3)');
// 3) 2 nguoi khac nhau cung team: khong doi so voi truoc
r = rev([O('ninhnga99, thuongBT', 800000)], ['ninhnga99', 'thuongBT']);
ok(r.revenue === 800000, '2 nguoi cung team: doanh thu day du');
r = rev([O('ninhnga99, thuongBT', 800000)], ['thuongBT']);
ok(r.revenue === 400000, 'chi 1 trong 2 nguoi thuoc team: 1/2');
// 4) team chi liet ke 1 ten cua Ninh (ten con lai chua them) van tinh nguoi do
r = rev([O('Ninh Nga', 600000)], ['ninhnga99']);
ok(r.revenue === 600000 && r.orders === 1, 'team co ten ninhnga99, don ghi Ninh Nga (cung nguoi) -> van tinh');
// 5) khong thuoc team / tên không có nhóm: như cũ
r = rev([O('dungNTK1987', 700000)], NINH);
ok(r.revenue === 0 && r.orders === 0, 'nguoi khac khong tinh');
r = rev([O('A, B, C', 300000)], ['A', 'B']);
ok(Math.round(r.revenue) === 200000, 'ten khong co ho so: chia theo so nguoi nhu cu (2/3)');
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);

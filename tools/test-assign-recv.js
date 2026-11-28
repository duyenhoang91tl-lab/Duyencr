#!/usr/bin/env node
// Test Chia data: nguon nguoi nhan "Danh sach Sale" / "Tai khoan dang nhap CRM" (js/07 _assignSaleNames, _assignAcctEntries, _assignRecvList). Chay: node tools/test-assign-recv.js
const fs = require('fs'), vm = require('vm');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../js/07-openassignmodal.js', 'utf8');
const grab = name => { const i = src.search(new RegExp('function ' + name + '\\(')); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } };
const ctx = {
  _asgCache: { custRef: null }, allCustomers: [{ csSet: new Set(['Ninh']), careCSSet: new Set() }], _dataVersion: 1,
  _allCSNames: () => ['Thao', 'Ninh', 'thao', '84901', 'An'],
  _roleBaseOf: r => r === 'cskh' ? 'cs' : r, _roleLabel: r => r === 'admin' ? 'Admin' : 'CS',
  accounts: [
    { username: 'cskh01', role: 'cskh', names: ['cskh01'] },
    { username: 'thaomt', role: 'cs', names: ['Thao MT', 'thao2'] },
    { username: 'khoa', role: 'cs', names: ['Khoa'], active: false },
    { username: 'xem', role: 'viewer', names: [] },
    { username: 'trung', role: 'cs', names: ['Thao MT'] },
    { username: 'adm', role: 'admin', names: ['Admin'] },
    { username: 'so', role: 'cs', names: ['84901'] },
  ],
};
vm.createContext(ctx);
['_assignAllCSNames', '_assignSaleNames', '_assignAcctEntries', '_assignRecvList'].forEach(n => vm.runInContext(grab(n), ctx));
const sale = vm.runInContext('_assignSaleNames()', ctx);
ok(sale.join() === 'An,Ninh,Thao', 'Danh sach Sale: bo trung (khong phan biet hoa/thuong), bo ten so, sap xep');
const acct = vm.runInContext('_assignAcctEntries()', ctx);
const labels = acct.map(a => a.label).join();
ok(labels === 'adm,cskh01,thaomt', 'Tai khoan: bo tk khoa, viewer, ten CS trung, ten so -> ' + labels);
ok(acct.find(a => a.label === 'thaomt').cs === 'Thao MT', 'Tai khoan thaomt -> nhan data voi ten CS chinh "Thao MT"');
ok(acct.find(a => a.label === 'cskh01').cs === 'cskh01', 'Tai khoan CSKH moi -> dung chinh ten tai khoan');
ok(vm.runInContext('_assignRecvList("acct")', ctx).length === 3 && vm.runInContext('_assignRecvList("sale")', ctx).length === 3, '_assignRecvList chon dung nguon acct/sale');
ok(vm.runInContext('_assignRecvList("all")', ctx).some(r => r.cs === 'Ninh'), 'nguon "Tat ca CS" van nhu cu');
ok(vm.runInContext('_assignRecvList("xxx")', ctx).length >= 1, 'nguon la -> roi ve "Tat ca"');
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);

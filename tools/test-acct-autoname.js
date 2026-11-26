#!/usr/bin/env node
// Test tao tai khoan CSKH KHONG chon Sale (js/15 addAccount) + tai khoan moi hien trong Chia data (js/07 _assignAllCSNames). Chay: node tools/test-acct-autoname.js
const fs = require('fs'), vm = require('vm');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const grab = (file, name) => { const src = fs.readFileSync(__dirname + '/../js/' + file, 'utf8'); const i = src.search(new RegExp('(async )?function ' + name + '\\(')); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } };
const toasts = []; let pushed = 0;
function mk(form, existing) {
  const accounts = existing ? [existing] : [];
  const ctx = { accounts, toasts, console, gsUrl: 'x', _acctOpen: {}, _acctEditing: '', _authAccount: null,
    _aval: id => form[id] == null ? '' : form[id], _acctCollectNames: () => form.names || [], _roleBaseOf: r => r === 'cskh' ? 'cs' : r,
    _findAccount: u => accounts.find(a => a.username.toLowerCase() === u.toLowerCase()), _teamOf: () => null, document: { querySelectorAll: () => [] },
    pushUsers: async () => { pushed++; return {}; }, toast: m => toasts.push(m), logAudit() {}, _acctKey: u => String(u).toLowerCase(), renderAcctModal() {}, _renderAuthHeader() {} };
  vm.createContext(ctx); vm.runInContext(grab('15-fn-hidelogin.js', 'addAccount'), ctx); return ctx;
}
(async () => {
  let c = mk({ 'acct-username': 'cskh01', 'acct-password': '12345678', 'acct-role': 'cs', names: [] });
  await vm.runInContext('addAccount()', c);
  ok(c.accounts.length === 1 && c.accounts[0].username === 'cskh01', 'tao duoc tai khoan CS khong chon Sale');
  ok(c.accounts[0].names.join() === 'cskh01' && c.accounts[0].name === 'cskh01', 'tu dat ten CS = ten tai khoan (names KHONG rong -> khong thanh "thay tat ca")');
  ok(c.accounts[0]._setPw === '12345678' && pushed === 1, 'gui len server (pushUsers) kem mat khau');
  ok(toasts.some(t => t.includes('Đã lưu tài khoản cskh01') && t.includes('Chia data')), 'thong bao huong dan vao Chia data');
  c = mk({ 'acct-username': 'thao', 'acct-password': 'x', 'acct-role': 'cs', names: ['Thao MT', 'thao2'] }); await vm.runInContext('addAccount()', c);
  ok(c.accounts[0].names.join() === 'Thao MT,thao2' && !toasts.slice(-1)[0].includes('chưa chọn Sale'), 'co chon Sale: giu nguyen, khong ghi de ten');
  c = mk({ 'acct-username': 'viewer1', 'acct-password': 'x', 'acct-role': 'viewer', names: [] }); await vm.runInContext('addAccount()', c);
  ok(c.accounts[0].names.length === 0, 'vai tro viewer: van de trong (khong tu dat ten)');
  c = mk({ 'acct-username': 'a b', 'acct-password': 'x', 'acct-role': 'cs', names: [] }); await vm.runInContext('addAccount()', c);
  ok(c.accounts.length === 0, 'ten tai khoan co dau cach van bi chan');
  c = mk({ 'acct-username': 'cskh02', 'acct-password': '', 'acct-role': 'cs', names: [] }); await vm.runInContext('addAccount()', c);
  ok(c.accounts.length === 0 && toasts.slice(-1)[0].includes('mật khẩu'), 'thieu mat khau tai khoan moi van bi chan');
  // Chia data
  const asg = { _asgCache: { custRef: null }, allCustomers: [{ csSet: new Set(['Ninh']), careCSSet: new Set(['Yen']) }], _dataVersion: 1, accounts: [{ role: 'cskh', username: 'cskh01', names: ['cskh01'], active: true }, { role: 'cskh', username: 'cskh09', active: false, names: ['cskh09'] }, { role: 'admin', username: 'ad', names: ['Admin'] }, { role: 'cskh', username: 'cskh03', names: ['84901', 'cskh03b'], active: true }], _roleBaseOf: r => r === 'cskh' ? 'cs' : r };
  vm.createContext(asg); vm.runInContext(grab('07-openassignmodal.js', '_assignAllCSNames'), asg);
  let list = vm.runInContext('_assignAllCSNames()', asg);
  ok(list.includes('cskh01') && list.includes('Ninh') && list.includes('Yen') && list.includes('cskh03b'), 'Chia data thay tai khoan CS moi (chua co khach) + ten tu khach');
  ok(!list.includes('cskh09') && !list.includes('Admin') && !list.includes('84901'), 'khong lay tk bi khoa, admin, hay the so');
  asg.accounts.push({ role: 'cskh', username: 'cskh04', names: ['cskh04'], active: true });
  list = vm.runInContext('_assignAllCSNames()', asg); ok(list.includes('cskh04'), 'them tk moi -> cache vo hieu, thay ngay (khong can tai lai du lieu)');
  console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);
})();

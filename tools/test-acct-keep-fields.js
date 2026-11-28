// Sua tai khoan khong duoc lam mat quyen tab rieng / loai sale / ngay nhan tin / ngay vao. Chay: node tools/test-acct-keep-fields.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const s = fs.readFileSync(path.join(__dirname, '..', 'js', '15-fn-hidelogin.js'), 'utf8');
const f = s.match(/^async function addAccount\([\s\S]*?\n}\n/m)[0];
let fail = 0; const ok = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); if (!v) fail++; };
const form = { 'acct-username': 'lan', 'acct-password': '', 'acct-role': 'cs', 'acct-team-sel': '' };
const g = { Object, String, Array, _aval: id => form[id] || '', _acctCollectNames: () => ['Lan moi'], _roleBaseOf: r => r, _acctCollectMonths_: () => [], _teamOf: () => null,
  accounts: [{ username: 'lan', role: 'cs', names: ['Lan'], active: false, perms: ['salesreport'], saleType: 'online', startDate: '2026-11-09', joinDate: '2026-11-03', hasPass: true }],
  _findAccount: u => g.accounts.find(a => a.username === u) || null, pushUsers: async () => ({ ok: true }), toast() {}, _authAccount: null, _acctEditing: '', _acctOpen: {},
  _acctKey: u => u, renderAcctModal() {}, _renderAuthHeader() {}, gsUrl: 'x', document: { querySelectorAll: () => [] } };
vm.createContext(g); vm.runInContext(f, g);
(async () => {
  await g.addAccount();
  const a = g.accounts[0];
  ok('giu perms, saleType, startDate, joinDate, trang thai khoa', JSON.stringify(a.perms) === '["salesreport"]' && a.saleType === 'online' && a.startDate === '2026-11-09' && a.joinDate === '2026-11-03' && a.active === false);
  ok('truong cua form van duoc cap nhat', a.names.join() === 'Lan moi' && g.accounts.length === 1);
  form['acct-username'] = 'moi'; form['acct-password'] = '123'; await g.addAccount();
  const b = g.accounts[1];
  ok('tai khoan moi: khong chep gi tu tai khoan khac', b.username === 'moi' && b.perms === undefined && b.startDate === undefined && b.active === true);
  process.exit(fail ? 1 : 0);
})();

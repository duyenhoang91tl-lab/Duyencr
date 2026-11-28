// GAS saveUsers_: truong client khong gui thi giu gia tri cu; gui rong thi xoa. Chay: node tools/test-saveusers-keep.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const f = src.match(/^function saveUsers_\([\s\S]*?\n}\n/m)[0];
let fail = 0; const ok = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); if (!v) fail++; };
const old = [{ username: 'Lan', passHash: 'h', role: 'cs', names: ['Lan'], perms: ['salesreport'], saleType: 'online', startDate: '2026-11-09', joinDate: '2026-11-03', viewMonths: [] },
  { username: 'ad', passHash: 'a', role: 'admin', names: ['Admin'], perms: null, saleType: '', startDate: '', joinDate: '' }];
let rows;
const g = { JSON, String, Array, USER_HEADERS: new Array(12).fill('h'), SH_USER: 'Users', jsonOut_: o => o, getSheet_: () => ({ clearContents() {}, getRange: () => ({ setValues: m => { rows = m; } }) }),
  readUsers_: () => JSON.parse(JSON.stringify(old)), _viewMonthsNorm_: a => a || [], _auditUserSig_: () => '', _auditDiffRows_: () => [], _auditCfg_() {}, _pwHash_: () => 'x', _PW_SALT_: '' };
vm.createContext(g); vm.runInContext(f, g);
const admin = { username: 'ad', role: 'admin' };
g.saveUsers_([{ username: 'lan', role: 'cs', names: ['Lan'] }, admin]);
ok('khong gui -> giu perms/saleType/startDate/joinDate', rows[1].slice(7, 11).join('|') === '["salesreport"]|online|2026-11-09|2026-11-03' && rows[1][1] === 'h');
g.saveUsers_([{ username: 'Lan', role: 'cs', names: ['Lan'], perms: null, saleType: '', startDate: '', joinDate: '' }, admin]);
ok('gui rong -> xoa (bo gioi han tab, xoa ngay)', rows[1].slice(7, 11).join('') === '');
g.saveUsers_([{ username: 'moi', role: 'cs' }, admin]);
ok('tai khoan moi: de trong', rows[1].slice(7, 11).join('') === '');
process.exit(fail ? 1 : 0);

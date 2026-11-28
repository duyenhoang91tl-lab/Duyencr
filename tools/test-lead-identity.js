// Dang nhap Truong nhom: nap viewMonths + tai du don POS (js/14 _applyAuthIdentity). Chay: node tools/test-lead-identity.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const s = fs.readFileSync(path.join(__dirname, '..', 'js', '14-fn-aasplit.js'), 'utf8');
const f = s.match(/^function _applyAuthIdentity\([\s\S]*?\n}\n/m)[0];
let days = 0, fail = 0;
const g = { gsUrl: '', document: { body: { classList: { add() {}, remove() {} } }, getElementById: () => null }, localStorage: { removeItem() {} } };
['saveLS', 'setTimeout', '_renderAuthHeader', 'renderRolePill', 'applyFilters', 'updateStats', 'updateSidebarBadges', 'updateBrandList', 'updateMyDataBadge', 'syncCSCombo', '_invalidateFilterCache'].forEach(n => { g[n] = () => {}; });
g._roleBaseOf = r => r; g.posOrdersEnsureDays_ = d => { days = d; };
vm.createContext(g); vm.runInContext(f, g);
const ok = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); if (!v) fail++; };
g._applyAuthIdentity({ username: 'm', role: 'leader', names: ['Mai'], viewMonths: ['2026-06', '2026-04'] });
ok('leader: co viewMonths, tai don POS lui toi 01/04', g.currentUser.viewMonths.length === 2 && days >= (Date.now() - new Date('2026-04-01T00:00:00').getTime()) / 86400000);
days = 0; g._applyAuthIdentity({ username: 'l', role: 'cs', names: ['Lan'], viewMonths: ['2026-04'] });
ok('cs: khong gioi han, khong tai them', g.currentUser.viewMonths.length === 0 && days === 0);
process.exit(fail ? 1 : 0);

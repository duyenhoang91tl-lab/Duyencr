// Chia theo Team chi ghi cac dot MOI, khong ghi de lich su chia. Chay: node tools/test-assign-team-push.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const s = fs.readFileSync(path.join(__dirname, '..', 'js', '13-fn-bpseedofficialonlinetemplate.js'), 'utf8');
const m = s.match(/^function doAssignByTeam\([\s\S]*?\n}\n/m);
let fail = 0; const ok = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); if (!v) fail++; };
if (!m) { console.log('FAIL khong thay ham chia theo Team'); process.exit(1); }
const saved = [];
const g = { Date, Math, Object, console, gsUrl: 'x', teams: [{ id: 't', name: 'A', members: ['Lan', 'Mai'] }], _teamAssignPct: { t: 100 }, _teamMembersList: t => t.members,
  assignHistory: [{ id: 'cu', csName: 'Lead', phones: ['9'] }], saveLS() {}, _invalidateFilterCache() {}, _rebuildAssignIndex() {}, logAudit() {}, toast() {},
  pushAssignToGS: async e => saved.push(e.csName + ':' + e.phones.join()), pushAssignHistToGS: () => saved.push('GHI DE') };
g._getAssignPool = () => ['1', '2', '3'];
vm.createContext(g); vm.runInContext(m[0], g);
g.doAssignByTeam();
setTimeout(() => { ok('2 dot moi duoc ghi tung dot, khong goi ghi de (' + saved.join(' | ') + ')', saved.join('|') === 'Lan:1,2|Mai:3'); process.exit(fail ? 1 : 0); }, 20);

// Tai lich su chia: go dot admin da xoa (deletedIds), giu dot chi co o may, them dot moi. Chay: node tools/test-assign-pull-deleted.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const s = fs.readFileSync(path.join(__dirname, '..', 'js', '07-openassignmodal.js'), 'utf8');
const f = ['function _assignMergeDone_', 'async function pullAssignHistory'].map(n => s.match(new RegExp('^' + n + '\\([\\s\\S]*?\\n}\\n', 'm'))[0]).join('');
let fail = 0; const ok = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); if (!v) fail++; };
let reply, saved, hist, sel, filtered, histShown;
const bs = { value: '' };
const g = { gsUrl: 'x', JSON, String, Set, console, showAssignBackendWarning() {}, saveLS: (k, v) => { saved = v.map(h => h.id).join(); },
  fetch: async () => ({ json: async () => reply }), normPhone: p => String(p).length === 9 ? '0' + p : String(p),
  applyFilters: () => filtered++, renderMyDataTab: () => { sel = bs.value; }, renderAssignHistory: () => hist++,
  document: { getElementById: () => bs, querySelector: () => histShown ? {} : null } };
vm.createContext(g); vm.runInContext('var _assignBackendOK, assignHistory;' + f, g);
const run = async (local, r) => { g.assignHistory = local; reply = r; saved = null; hist = filtered = 0; sel = null; await g.pullAssignHistory(); return g.assignHistory.map(h => h.id).join(); };
const H = (id, date) => ({ id, date, phones: ['0900000001'] });
(async () => {
  bs.value = '2'; histShown = true;
  let ids = await run([H('2', '2026-11-02'), H('1', '2026-11-01'), H('moi-o-may', '2026-11-03')], { assignHistory: [H('1', '2026-11-01')], deletedIds: ['2'] });
  ok('go dot da xoa, giu dot chua gui len may chu', ids === 'moi-o-may,1' && saved === 'moi-o-may,1');
  ok('ve lai man dang mo, bo chon dot vua go, loc lai danh sach', sel === '' && hist === 1 && filtered === 1);
  histShown = false;
  ids = await run([H('2', '2026-11-02')], { assignHistory: [], deletedIds: ['2'] });
  ok('may chu khong con dot nao: van go; dang o tab Tao thi khong ve de', ids === '' && saved === '' && hist === 0);
  ids = await run([H('1', '2026-11-01')], { assignHistory: [H('1', '2026-11-01'), { id: '3', date: '2026-11-04', phones: [900000002], donePhones: [900000002] }, H('2', 'x')], deletedIds: ['2'] });
  ok('them dot moi (chuan hoa SDT), khong them dot da xoa', ids === '3,1' && g.assignHistory[0].donePhones.join() === '0900000002');
  ids = await run([H('1', '2026-11-01')], { assignHistory: [] });
  ok('may chu ban cu (khong deletedIds): khong xoa gi, khong ghi lai', ids === '1' && saved === null && filtered === 0);
  process.exit(fail ? 1 : 0);
})();

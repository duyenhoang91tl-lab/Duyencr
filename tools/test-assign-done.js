// Bam "xong" o "Data cua toi" chi ghi dot bi doi, khong ghi de ca lich su chia. Chay: node tools/test-assign-done.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const s = fs.readFileSync(path.join(__dirname, '..', 'js', '07-openassignmodal.js'), 'utf8');
const f = s.match(/^function toggleMyDataDone\([\s\S]*?\n}\n/m)[0];
const saved = []; let all = 0;
const g = { gsUrl: 'x', saveLS() {}, updateMyDataBadge() {}, renderMyDataTab() {}, pushAssignHistToGS: () => { all++; }, pushAssignToGS: async e => { saved.push(e.id); },
  assignHistory: [{ id: '1', csName: 'Lan', phones: ['a'] }, { id: '2', csName: 'Mai', phones: ['a'] }, { id: '3', csName: 'Lan', phones: ['b'] }] };
vm.createContext(g); vm.runInContext(f, g); g.toggleMyDataDone('a', 'Lan', true);
setTimeout(() => { const ok = all === 0 && saved.join() === '1' && g.assignHistory[0].donePhones.join() === 'a'; console.log((ok ? 'OK  ' : 'FAIL') + ' chi ghi dot 1'); process.exit(ok ? 0 : 1); }, 10);

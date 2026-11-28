// Bam "xong" o "Data cua toi": chi gui DUNG thay doi (1 SDT + id dot), theo dung thu tu bam; khong gui ca dot. Chay: node tools/test-assign-done.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const s = fs.readFileSync(path.join(__dirname, '..', 'js', '07-openassignmodal.js'), 'utf8');
const grab = n => s.match(new RegExp('^(async )?function ' + n + '\\([\\s\\S]*?\\n}\\n', 'm'))[0];
let fail = 0; const ok = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); if (!v) fail++; };
const sent = [], warns = []; let whole = 0, reply = { ok: true }, delay = 15;
const g = { gsUrl: 'x', JSON, Promise, console, saveLS() {}, updateMyDataBadge() {}, renderMyDataTab() {}, pushAssignToGS: async () => { whole++; },
  _writeFail_: (w, why) => warns.push(why),
  fetch: (u, o) => { const b = JSON.parse(o.body), d = delay; delay = 1; return new Promise(r => setTimeout(() => { sent.push(b); r({ json: async () => reply }); }, d)); },
  assignHistory: [{ id: '1', csName: 'Lan', phones: ['a'] }, { id: '2', csName: 'Mai', phones: ['a'] }, { id: '3', csName: 'Lan', phones: ['b'] }] };
vm.createContext(g); vm.runInContext('let _doneQueue_ = Promise.resolve();\n' + grab('_pushDoneToGS_') + grab('_myBatchesOf_') + grab('toggleMyDataDone'), g);
const wait = () => new Promise(r => setTimeout(r, 60));
(async () => {
  g.toggleMyDataDone('a', 'Lan', true); g.toggleMyDataDone('a', 'Lan', false); await wait();
  const b = sent[0];
  ok('chi gui toggleAssignDone dung dot 1 cua Lan, khong gui ca dot', whole === 0 && b.action === 'toggleAssignDone' && b.phone === 'a' && b.csName === 'Lan' && b.ids.join() === '1' && !b.entry);
  ok('tich roi bo tich nhanh: toi may chu dung thu tu', sent.map(x => x.done).join() === 'true,false');
  ok('may cap nhat ngay tai cho', g.assignHistory[0].donePhones.length === 0);
  sent.length = 0; g.toggleMyDataDone('khong-co', 'Lan', true); await wait();
  ok('SDT khong nam trong dot nao: khong gui', sent.length === 0);
  reply = { error: 'ban' }; g.toggleMyDataDone('b', 'Lan', true); await wait();
  reply = { ok: true }; g.toggleMyDataDone('b', 'Lan', false); await wait();
  ok('may chu loi: bao nguoi dung, lan sau van gui tiep', warns.join() === 'ban' && sent.length === 2);
  process.exit(fail ? 1 : 0);
})();

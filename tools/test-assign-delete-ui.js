// Xoa dot chia: chi gui deleteAssign (dung id), may chu loi thi GIU dot o may. Chay: node tools/test-assign-delete-ui.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const s = fs.readFileSync(path.join(__dirname, '..', 'js', '07-openassignmodal.js'), 'utf8');
const grab = n => s.match(new RegExp('^async function ' + n + '\\([\\s\\S]*?\\n}\\n', 'm'))[0];
let fail = 0; const ok = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); if (!v) fail++; };
let reply, sent, msg;
const g = { JSON, String, gsUrl: 'x', confirm: () => true, saveLS() {}, renderAssignHistory() {}, updateMyDataBadge() {}, toast: m => { msg = m; },
  localStorage: { getItem: () => 'tk' }, fetch: async (_, o) => { sent.push(JSON.parse(o.body)); if (reply === 'net') throw new Error('net'); return { json: async () => reply }; } };
vm.createContext(g); vm.runInContext(grab('deleteAssignEntry') + grab('deleteAssignOnGS_'), g);
const run = async r => { reply = r; sent = []; msg = ''; g.assignHistory = [{ id: '1' }, { id: '2' }]; await g.deleteAssignEntry('1'); return g.assignHistory.map(h => h.id).join(); };
(async () => {
  ok('thanh cong: bo dung dot 1, gui deleteAssign + token, khong gui lich su', await run({ ok: true }) === '2' && sent.length === 1 && sent[0].action === 'deleteAssign' && sent[0].ids.join() === '1' && sent[0].token === 'tk' && !sent[0].history);
  ok('may chu chua cap nhat: giu dot, bao thu lai', await run({ error: 'Unknown action: deleteAssign' }) === '1,2' && /chưa cập nhật/.test(msg));
  ok('mat mang: giu dot', await run('net') === '1,2' && /lỗi mạng/.test(msg));
  ok('khong con duong ghi de ca lich su tu web', !fs.readdirSync(path.join(__dirname, '..', 'js')).some(f => f.endsWith('.js') && /saveAssignHistory|pushAssignHistToGS/.test(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'))));
  process.exit(fail ? 1 : 0);
})();

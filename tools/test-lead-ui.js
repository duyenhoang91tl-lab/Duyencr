// Man "Data cua team" cua Truong nhom (js/96). Chay: node tools/test-lead-ui.js
const fs = require('fs'), path = require('path'), { JSDOM } = require('jsdom');
let ok = 0, fail = 0; const t = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); v ? ok++ : fail++; };
const dom = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'https://crm.test/' }); const w = dom.window;
const sent = []; const toasts = [];
const info = { ok: true, own: ['Mai'], teams: ['A'], members: ['Lan', 'Minh'], viewMonths: ['2026-04', '2026-05'], assignHistory: [
  { id: '1', date: '2026-11-20 03:00', csName: 'Mai', label: 'T4', phones: ['0900000001', '0900000002', '0900000003', '0900000004', '0900000005'], donePhones: [] },
  { id: '2', date: '2026-11-21 03:00', csName: 'lan', label: 'x', phones: ['0900000001', '0900000002'], donePhones: ['0900000002'] }] };
w.esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
w.currentUser = { role: 'leader', name: 'Mai' }; w.gsUrl = 'https://gas.test/exec'; w.assignHistory = []; w.saveLS = () => {}; w.toast = m => toasts.push(m); w.confirm = () => true;
w._assignCustMap = () => new Map([['0900000001', { name: 'An', careStatus: 'Đã gọi' }]]);
let care = null; w._applyCareCSToAssigned = e => { care = e; };
w.fetch = async (u, o) => { if (o && o.method === 'POST') { const b = JSON.parse(o.body); sent.push(b); return { json: async () => ({ ok: true, total: b.entries.reduce((s, e) => s + e.phones.length, 0), entries: b.entries.map((e, i) => ({ id: 'n' + i, date: '2026-11-26 04:00', csName: e.csName, label: 'Lead', phones: e.phones, donePhones: [] })) }) }; } return { json: async () => JSON.parse(JSON.stringify(info)) }; };
w.eval(fs.readFileSync(path.join(__dirname, '..', 'js', '96-lead-assign.js'), 'utf8'));
const $ = s => w.document.querySelector(s);
(async () => {
  const pool = w.ldaPool_(info, '');
  t('pool: 5 khach duoc giao cho Lead, 2 da giao cho nhan vien (khop ten khac hoa/thuong)', pool.length === 5 && pool.filter(x => x.distributed).length === 2);
  t('split: vuot qua -> bao loi', !!w.ldaSplit_(['a'], [{ csName: 'x', n: 2 }]).error);
  t('split: khong nhap -> bao loi', !!w.ldaSplit_(['a'], [{ csName: 'x', n: '' }]).error);
  t('chia deu 5 cho 2 = 3+2', JSON.stringify(w.ldaEven_(5, 2)) === '[3,2]');
  const rep = w.ldaReport_(info, [{ primary: 'Lan', names: ['Lan'] }, { primary: 'Minh', names: ['Minh'] }], '', '', p => p === '0900000001' ? 'Đã gọi' : '');
  t('bao cao: Lan 2 giao, 1 xong, 50%, 0 chua lien he; Minh 0', rep[0].total === 2 && rep[0].done === 1 && rep[0].pct === 50 && rep[0].untouched === 0 && rep[1].total === 0);
  t('bao cao: loc ngay chia', w.ldaReport_(info, [{ primary: 'Lan', names: ['Lan'] }], '2026-11-22', '', null)[0].total === 0);
  w.currentUser.role = 'cs'; w.openLeadModal(); t('CS khong mo duoc', !$('#lead-modal'));
  w.currentUser.role = 'leader'; w.openLeadModal(); await new Promise(r => setTimeout(r, 20));
  t('mo man: co dot duoc giao, 2 nhan vien, ghi chu thang', $('#lead-body').textContent.includes('Tổng 5 khách') && w.document.querySelectorAll('.lda-n').length === 2 && /04\/2026, 05\/2026/.test($('#lead-body').textContent));
  w.ldaEvenFill(); w.ldaSubmit(); await new Promise(r => setTimeout(r, 20));
  const b = sent[0];
  t('gui leadAssign: chi 3 khach chua giao, Lan 2 + Minh 1', b && b.action === 'leadAssign' && JSON.stringify(b.entries.map(e => [e.csName, e.phones])) === JSON.stringify([['Lan', ['0900000003', '0900000004']], ['Minh', ['0900000005']]]));
  t('chia xong: cap nhat assignHistory + CS cham soc, con 0 khach chua giao', w.assignHistory.length === 4 && care && care.length === 2 && /chưa giao cho nhân viên: 0/.test($('#lead-body').textContent));
  w.ldaTab('report'); w.ldaOpen('Lan');
  t('tab bao cao: bang + danh sach khach cua Lan', /Cả team/.test($('#lead-body').textContent) && $('#lead-body').textContent.includes('An') && !$('#lda-go'));
  console.log(ok + ' OK, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0);
})();

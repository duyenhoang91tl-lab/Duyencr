// Data cua toi: moi khach co nut Goi / Xem khach / Xong co chu; bam Xong gui dung trang thai nguoc lai. Chay: node tools/test-mydata-buttons.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const s = fs.readFileSync(path.join(__dirname, '..', 'js', '07-openassignmodal.js'), 'utf8');
const a = s.indexOf('function renderMyDataTab('), f = s.slice(a, s.indexOf('body.innerHTML = html;', a)) + 'body.innerHTML = html;\n}';
let fail = 0; const ok = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); if (!v) fail++; };
const els = { 'mydata-cs-sel': { value: 'Lan' }, 'mydata-body': {} };
const A = '0900000001', B = '0900000002';
const g = { document: { getElementById: id => els[id] || null }, allCustomers: [{ phone: A, name: 'Khách <A>', tier: '', careStatus: '' }], _myDataFilter: 'all',
  _myBatchesOf_: () => [{ id: '1', label: 'đợt', date: '2026-11-28', phones: [A, B], donePhones: [B] }], esc: x => String(x).replace(/</g, '&lt;'),
  _ymd: () => '2026-11-28', nextSched: () => null, careBadgeText: () => '' };
vm.createContext(g); vm.runInContext(f, g); g.renderMyDataTab();
const h = els['mydata-body'].innerHTML, rows = h.split('class="my-data-row"').slice(1);
ok('khong con o tich', !/type="checkbox"/.test(h));
ok('moi khach co nut goi dung so', rows.length === 2 && rows[0].includes('href="tel:' + A + '"') && rows[1].includes('href="tel:' + B + '"'));
ok('khach chua xong: nut "✓ Xong" danh dau xong', rows[0].includes("toggleMyDataDone('" + A + "',this.dataset.cs,true)") && rows[0].includes('✓ Xong'));
ok('khach da xong: nut "↩ Chưa xong" bo dau', rows[1].includes("toggleMyDataDone('" + B + "',this.dataset.cs,false)") && rows[1].includes('↩ Chưa xong'));
ok('co nut xem khach, ten khach duoc escape', rows[0].includes('Xem khách') && h.includes('Khách &lt;A>'));
process.exit(fail ? 1 : 0);

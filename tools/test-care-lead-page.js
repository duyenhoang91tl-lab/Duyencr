// Duyen 2026-11-12: them truong "page" (page/fanpage khach den tu) vao "Them KH / Don moi" -> sheet "KH Chăm sóc mới" cot F.
// Chay ham THAT addCareLead_/readCareLeads_ trich tu gas_v13.js voi sheet gia lap (khong goi Google).
const fs = require('fs'), vm = require('vm');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('khong thay ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } }
}
const hdr = /var CARE_LEAD_HEADERS = (\[.*?\]);/.exec(src);
ok(!!hdr && /'page'/.test(hdr[1]), 'CARE_LEAD_HEADERS co cot page');

const rows = [['phone','name','note','cs','createdAt','page']];
const sheet = {
  getLastRow: () => rows.length,
  getRange: (r, c, nr, nc) => ({
    getValues: () => { const o = []; for (let i = 0; i < (nr || 1); i++) { const row = rows[r - 1 + i] || []; const out = []; for (let k = 0; k < (nc || 1); k++) out.push(row[c - 1 + k] === undefined ? '' : row[c - 1 + k]); o.push(out); } return o; },
    getValue: () => (rows[r - 1] && rows[r - 1][c - 1] !== undefined) ? rows[r - 1][c - 1] : '',
    setValues: (v) => { for (let i = 0; i < v.length; i++) rows[r - 1 + i] = v[i].slice(); }
  }),
  appendRow: (v) => rows.push(v.slice())
};
const ctx = {
  SH_CARE_LEAD: 'KH Chăm sóc mới', CARE_LEAD_HEADERS: ['phone','name','note','cs','createdAt','page'],
  getSheet_: () => sheet, getCrmSS_: () => ({ getSheetByName: () => sheet }),
  normPhone_: (s) => String(s).replace(/\D/g, '').replace(/^84/, '0'),
  jsonOut_: (o) => o, CacheService: { getScriptCache: () => ({ remove() {} }) }
};
vm.createContext(ctx);
vm.runInContext(grab('addCareLead_') + '\n' + grab('readCareLeads_'), ctx);

// 1) them moi co page
let r = ctx.addCareLead_({ phone: '0912345678', name: 'A', note: 'n1', cs: 'duyen', page: ' Phong thủy Thu Hiền ' });
ok(r.ok && r.found === false, 'them moi: ok, found=false');
ok(rows[1][5] === 'Phong thủy Thu Hiền', 'page duoc trim va ghi o cot F');
ok(ctx.readCareLeads_()[0].page === 'Phong thủy Thu Hiền', 'readCareLeads_ tra ve page');

// 2) luu lai KHONG gui page (Zalo AI / Pancake AI cu) -> giu page cu
r = ctx.addCareLead_({ phone: '0912345678', name: 'A', note: 'n2', cs: 'duyen' });
ok(r.found === true && rows[1][5] === 'Phong thủy Thu Hiền', 'khong gui page => giu page cu');
ok(rows[1][2] === 'n2', 'cac cot khac van cap nhat');

// 3) gui page moi => ghi de; gui page rong => xoa co chu y
ctx.addCareLead_({ phone: '0912345678', name: 'A', note: 'n3', cs: 'duyen', page: 'Page B' });
ok(rows[1][5] === 'Page B', 'gui page moi => ghi de');
ctx.addCareLead_({ phone: '0912345678', name: 'A', note: 'n4', cs: 'duyen', page: '' });
ok(rows[1][5] === '', 'gui page rong ro rang => xoa');

// 4) khach moi khong gui page => rong, khong loi
ctx.addCareLead_({ phone: '0987654321', name: 'B', note: 'x', cs: 'hoa' });
ok(rows[2][5] === '' && rows[2].length === 6, 'khach moi khong page => cot F rong');

// 5) dong cu 5 cot (sheet tao truoc khi co cot page) doc khong loi
rows.push(['0911111111', 'C', 'old', 'duyen', '2026-01-01']);
const all = ctx.readCareLeads_();
ok(all[all.length - 1].page === '', 'dong cu 5 cot => page rong, khong loi');

// 6) client: modal + gui POST co page
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const js04 = fs.readFileSync(__dirname + '/../js/04-fn-synczalophonesettingsfromgas.js', 'utf8');
const js01 = fs.readFileSync(__dirname + '/../js/01-fn-splitmulti.js', 'utf8');
ok(/id="qa-page"/.test(html), 'index.html co o qa-page');
ok(/'qa-page'/.test(js04) && /page: careLeads\[phone\]\.page \|\| ''/.test(js04), 'js/04 doc qa-page + gui page len GAS');
ok(/page: r\.page\|\|''/.test(js01), 'js/01 keo page ve careLeads');
process.exit(bad ? 1 : 0);

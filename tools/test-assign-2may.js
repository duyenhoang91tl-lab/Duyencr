// Mo phong 2 may + Pancake AI: code web that (js/07) goi code GAS that (gas_v13.js) tren sheet gia. Chay: node tools/test-assign-2may.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const gas = fs.readFileSync(path.join(root, 'gas_v13.js'), 'utf8'), web = fs.readFileSync(path.join(root, 'js', '07-openassignmodal.js'), 'utf8');
const grab = (src, n) => src.match(new RegExp('^(async )?function ' + n + '\\([\\s\\S]*?\\n}\\n', 'm'))[0];
let fail = 0; const ok = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); if (!v) fail++; };
const H = ['id', 'date', 'csName', 'label', 'phones', 'donePhones', 'part']; let rows = [], props = {};
const sh = { getLastRow: () => rows.length + 1, getMaxRows: () => 1000, insertRowsAfter() {}, getDataRange: () => ({ getValues: () => [H].concat(rows) }),
  getRange: (r, c, n = 1, w = 1) => ({ getValues: () => rows.slice(r - 2, r - 2 + n).map(x => x.slice(c - 1, c - 1 + w)), setValues: v => v.forEach((x, i) => { rows[r - 2 + i] = x.slice(); }),
    createTextFinder: t => ({ matchEntireCell: () => ({ findAll: () => rows.map((x, i) => ({ x, i })).filter(o => String(o.x[0]) === t).map(o => ({ getRow: () => o.i + 2 })) }) }) }),
  deleteRow: r => rows.splice(r - 2, 1), deleteRows: (r, n) => rows.splice(r - 2, n) };
const S = { JSON, String, Number, Array, Object, SH_ASSIGN: 'A', ASSIGN_HEADERS: H, jsonOut_: o => JSON.parse(JSON.stringify(o)), getSheet_: () => sh,
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k], setProperty: (k, v) => { props[k] = v; } }) },
  assignRowsOf_: h => [[h.id, h.date, h.csName, h.label, JSON.stringify(h.phones), JSON.stringify(h.donePhones || []), 0]],
  _saleFilterNameSet_: a => ({ [String(a[0]).toLowerCase()]: 1 }), _normTxt_: s => String(s).toLowerCase(), _sessUser_: () => null, _roleBase_: r => r };
vm.createContext(S);
vm.runInContext(['normPhone_', 'readAssign_', 'saveAssignEntry_', 'toggleAssignDone_', '_assignDeletedIds_', '_rememberAssignDeleted_', 'deleteAssign_'].map(n => grab(gas, n)).join(''), S);
const server = async (url, o) => {
  if (!o || o.method !== 'POST') return { json: async () => ({ assignHistory: S.readAssign_(sh), deletedIds: S._assignDeletedIds_() }) };
  const d = JSON.parse(o.body);
  const r = d.action === 'saveAssign' ? S.saveAssignEntry_(d.entry) : d.action === 'toggleAssignDone' ? S.toggleAssignDone_(d.csName, d.phone, d.done, d.ids) : S.deleteAssign_(d);
  return { json: async () => r, text: async () => JSON.stringify(r) };
};
const machine = () => {
  const m = { gsUrl: 'x', JSON, String, Set, console, Promise, fetch: server, saveLS() {}, updateMyDataBadge() {}, renderMyDataTab() {}, renderAssignHistory() {}, showAssignBackendWarning() {}, _writeFail_: (w, why) => { throw new Error(why); },
    normPhone: p => String(p), document: { getElementById: () => null, querySelector: () => null } };
  vm.createContext(m);
  vm.runInContext('var _assignBackendOK, assignHistory = [];\nlet _doneQueue_ = Promise.resolve();\n' + ['_pushDoneToGS_', '_myBatchesOf_', 'toggleMyDataDone', '_assignMergeDone_', 'pullAssignHistory'].map(n => grab(web, n)).join(''), m);
  return m;
};
const A = '0900000001', B = '0900000002';
const row = id => S.readAssign_(sh).find(h => h.id === id);
(async () => {
  rows = [['d1', '2026-11-01', 'Lan', 'dot 1', JSON.stringify([A, B]), '[]', 0], ['d2', '2026-11-02', 'Lan', 'dot 2', JSON.stringify([A]), '[]', 0]];
  const nv = machine(); await nv.pullAssignHistory();
  S.toggleAssignDone_('Lan', B, true);                       // Pancake AI tich B sau khi may nhan vien da tai ve
  nv.toggleMyDataDone(A, 'Lan', true); await vm.runInContext('_doneQueue_', nv);
  ok('web tich A: dau tich B cua Pancake van con', row('d1').donePhones.slice().sort().join() === A + ',' + B);
  S.deleteAssign_({ ids: ['d2'] });                            // admin xoa dot 2 o may khac
  nv.toggleMyDataDone(A, 'Lan', false); await vm.runInContext('_doneQueue_', nv);
  ok('nhan vien bam trong luc con giu dot da xoa: dot KHONG song lai', !row('d2') && row('d1').donePhones.join() === B);
  await nv.pullAssignHistory();
  ok('lan tai tiep theo: may nhan vien go dot da xoa', nv.assignHistory.map(h => h.id).join() === 'd1');
  // ── Dau tich Pancake AI hien tren web cho dot DA TAI VE (khong can xoa du lieu may) ──
  rows = [['d3', '2026-11-03', 'Lan', 'dot 3', JSON.stringify([A, B]), '[]', 0]]; props = {};
  const m = machine(); let drawn = 0; m.document = { getElementById: () => ({ style: { display: 'flex' } }), querySelector: () => null }; m.renderMyDataTab = () => drawn++;
  const done = () => (m.assignHistory[0].donePhones || []).slice().sort().join();
  await m.pullAssignHistory();
  S.toggleAssignDone_('Lan', B, true); await m.pullAssignHistory();
  ok('Pancake tich B: web hien da xong sau lan tai tiep, ve lai tab Data cua toi', done() === B && drawn === 1);
  await m.pullAssignHistory();
  ok('may chu khong doi: khong ve lai', done() === B && drawn === 1);
  S.toggleAssignDone_('Lan', B, false); await m.pullAssignHistory();
  ok('Pancake bo tich B: web bo theo', done() === '' && drawn === 2);
  // web vua bam A nhung may chu CHUA nhan (mang cham) -> lan tai xen giua khong duoc xoa dau
  let release; const gate = new Promise(r => { release = r; });
  m.fetch = async (u, o) => { if (o && o.method === 'POST') await gate; return server(u, o); };
  m.toggleMyDataDone(A, 'Lan', true); S.toggleAssignDone_('Lan', B, true); await m.pullAssignHistory();
  ok('dau vua bam chua gui toi may chu van con, dau cua Pancake van vao', done() === A + ',' + B);
  const old = await (await server('x')).json();                  // cau tra loi cu: chup TRUOC khi may chu nhan A
  release(); await vm.runInContext('_doneQueue_', m);
  m.fetch = async () => ({ json: async () => old }); await m.pullAssignHistory();
  ok('cau tra loi cu ve muon khong xoa dau da bam', done() === A + ',' + B);
  m.fetch = server; await m.pullAssignHistory(); m.toggleMyDataDone(A, 'Lan', false); await vm.runInContext('_doneQueue_', m); await m.pullAssignHistory();
  ok('bo tich A tren web: ca may chu va web deu bo, B con', done() === B && row('d3').donePhones.join() === B);
  // gui loi (mat mang) -> giu dau tren may
  m.fetch = async (u, o) => { if (o && o.method === 'POST') throw new Error('mat mang'); return server(u, o); }; m._writeFail_ = () => {};
  m.toggleMyDataDone(A, 'Lan', true); await vm.runInContext('_doneQueue_', m); await m.pullAssignHistory();
  ok('gui loi: dau tren may khong bi lan tai sau xoa', done() === A + ',' + B);
  // may da luu tu ban cu (chua co moc srvDone), co dau chi o may: giu, dong thoi nhan them dau tu may chu
  m.fetch = server; m.assignHistory = [{ id: 'd3', date: '2026-11-03', csName: 'Lan', phones: [A, B], donePhones: [A] }]; await m.pullAssignHistory();
  ok('du lieu cu tren may: khong mat dau cu, nhan them dau Pancake', done() === A + ',' + B);
  process.exit(fail ? 1 : 0);
})();

// GAS: dot admin da xoa khong "song lai"; "da xong" chi doi dung 1 SDT, khong de dau tich cua nguoi/cong cu khac. Chay: node tools/test-assign-sync-gas.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const grab = n => src.match(new RegExp('^function ' + n + '\\([\\s\\S]*?\\n}\\n', 'm'))[0];
let fail = 0; const ok = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); if (!v) fail++; };
const H = ['id', 'date', 'csName', 'label', 'phones', 'donePhones', 'part'];
let rows = [], props = {}, locked = 0;
const sh = {
  getLastRow: () => rows.length + 1, getMaxRows: () => 1000, insertRowsAfter() {},
  getDataRange: () => ({ getValues: () => [H].concat(rows.map(r => r.slice())) }),
  getRange: (r, c, n = 1, w = 1) => ({
    getValues: () => rows.slice(r - 2, r - 2 + n).map(x => x.slice(c - 1, c - 1 + w)),
    setValues: v => v.forEach((x, i) => { rows[r - 2 + i] = x.slice(); }),
    createTextFinder: t => ({ matchEntireCell: () => ({ findAll: () => rows.map((x, i) => ({ x, i })).filter(o => String(o.x[0]) === t).map(o => ({ getRow: () => o.i + 2 })) }) })
  }),
  deleteRow: r => rows.splice(r - 2, 1), deleteRows: (r, n) => rows.splice(r - 2, n),
  clearContents: () => { rows = []; }
};
// setValues cua saveAssignHistory_ ghi ca dong tieu de tu hang 1
const getRange0 = sh.getRange;
sh.getRange = (r, c, n, w) => r === 1 ? { setValues: v => { rows = v.slice(1).map(x => x.slice()); } } : getRange0(r, c, n, w);
const g = { JSON, String, Number, Array, Object, SH_ASSIGN: 'A', ASSIGN_HEADERS: H, jsonOut_: o => o, getSheet_: () => sh,
  LockService: { getScriptLock: () => ({ tryLock: () => { locked++; return true; }, releaseLock() { locked--; } }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k], setProperty: (k, v) => { props[k] = v; } }) },
  assignRowsOf_: h => [[h.id, h.date, h.csName, h.label, JSON.stringify(h.phones), JSON.stringify(h.donePhones || []), 0]],
  _saleFilterNameSet_: a => ({ [String(a[0]).toLowerCase()]: 1 }), _normTxt_: s => String(s).toLowerCase(),
  _sessUser_: () => null, _roleBase_: r => r };
vm.createContext(g);
vm.runInContext(['normPhone_', 'readAssign_', 'saveAssignEntry_', 'toggleAssignDone_', 'saveAssignHistory_', '_assignDeletedIds_', '_rememberAssignDeleted_', 'deleteAssign_'].map(grab).join(''), g);
const A = '0900000001', B = '0900000002';
const reset = () => { props = {}; rows = [
  ['1', 'd', 'Lan', 'x', JSON.stringify([A, B]), '[]', 0],
  ['2', 'd', 'Lan', 'y', JSON.stringify(['900000001']), '[]', 0],   // sheet mat so 0
  ['3', 'd', 'Mai', 'z', JSON.stringify([A]), '[]', 0]]; };
const done = id => JSON.parse((rows.find(r => r[0] === id) || [, , , , , '[]'])[5]).join();
const ids = () => rows.map(r => r[0]).join();

reset();
g.toggleAssignDone_('Lan', B, true);                       // Pancake AI tich B (khong gui ids)
g.toggleAssignDone_('Lan', A, true, ['1']);                // web tich A, may web chua biet B da tich
ok('tich tren web khong de dau tich cua Pancake', done('1') === B + ',' + A);
ok('chi dong vao dot web gui', done('2') === '' && done('3') === '');
g.toggleAssignDone_('Lan', A, false, ['1']);
ok('bo tich A giu nguyen B', done('1') === B);
let r = g.toggleAssignDone_('Lan', A, true);
ok('khong ids: khop theo ten CS, khop ca SDT mat so 0, giu dung dang tren sheet', r.changed === 2 && done('2') === '900000001' && done('3') === '');
r = g.toggleAssignDone_('Lan', '84900000001', false);
ok('bo tich bang dang 84 go het', r.changed === 2 && done('2') === '' && done('1') === B);
r = g.toggleAssignDone_('Ten khac', A, true, ['3']);
ok('co ids: khong phu thuoc ten CS ghi tren dot', r.changed === 1 && done('3') === A);
r = g.toggleAssignDone_('Lan', '0911111111', true, ['1']);
ok('SDT khong nam trong dot: khong doi gi', r.changed === 0 && done('1') === B);

reset();
g.deleteAssign_({ ids: ['2'] });
const old = { id: '2', date: 'd', csName: 'Lan', label: 'y', phones: [A], donePhones: [A] };
r = g.saveAssignEntry_(old);
ok('may khac gui lai dot da xoa: bo qua', r.skipped === 'deleted' && ids() === '1,3');
r = g.toggleAssignDone_('Lan', A, true, ['2']);
ok('bam "da xong" trong dot da xoa: khong tao lai', r.changed === 0 && ids() === '1,3');
g.saveAssignHistory_([old, { id: '1', phones: [A] }]);
ok('tab ban cu ghi ca lich su: dot da xoa khong quay lai', ids() === '1');
g.saveAssignEntry_({ id: '9', date: 'd', csName: 'Mai', label: 'n', phones: [B] });
ok('dot moi van luu binh thuong', ids() === '1,9');
for (let i = 0; i < 400; i++) g._rememberAssignDeleted_(['1790000000' + String(i).padStart(3, '0') + '_abcd']);
const kept = g._assignDeletedIds_();
ok('danh sach nho khong vuot gioi han 9KB, giu id moi nhat', kept.length <= 300 && props.assignDeletedIds.length <= 8500 && /399_abcd$/.test(kept[kept.length - 1]));
ok('khoa duoc tra het', locked === 0);
ok('doc action=assign tra deletedIds; dispatch chuyen ids', /assignHistory: allAssignH_, deletedIds: _assignDeletedIds_\(\)/.test(src) && /toggleAssignDone_\(data\.csName, data\.phone, !!data\.done, data\.ids\)/.test(src));
process.exit(fail ? 1 : 0);

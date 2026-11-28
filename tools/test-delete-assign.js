// GAS deleteAssign_: chi xoa dung dot chia theo id, giu cac dot khac. Chay: node tools/test-delete-assign.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const f = ['_assignDeletedIds_', '_rememberAssignDeleted_', 'deleteAssign_'].map(n => src.match(new RegExp('^function ' + n + '\\([\\s\\S]*?\\n}\\n', 'm'))[0]).join('');
const props = {};
let fail = 0; const ok = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); if (!v) fail++; };
let rows, max, calls;
const sh = { getLastRow: () => rows.length + 1, getMaxRows: () => max, insertRowsAfter: (_, n) => { max += n; },
  getRange: (r, c, n) => ({ getValues: () => rows.slice(r - 2, r - 2 + n).map(x => [x]) }),
  deleteRows: (start, n) => { if (max - n < 2) throw new Error('khong xoa duoc het dong'); calls++; rows.splice(start - 2, n); max -= n; } };
const g = { String, Array, JSON, PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k], setProperty: (k, v) => { props[k] = v; } }) }, SH_ASSIGN: 'A', ASSIGN_HEADERS: [], jsonOut_: o => o, getSheet_: () => sh, LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  _sessUser_: t => ({ A: { role: 'admin' }, X: { role: 'sep' }, L: { role: 'leader' } })[t] || null, _roleBase_: r => r === 'sep' ? 'admin' : r };
vm.createContext(g); vm.runInContext(f, g);
const reset = a => { rows = a.slice(); max = 1000; calls = 0; };
reset(['a', 'b', 'b', 'c', 'b', 'd']);
let r = g.deleteAssign_({ token: 'A', ids: ['b'] });
ok('xoa du moi dong cua dot b, giu thu tu cac dot khac', r.ok && r.deleted === 3 && rows.join() === 'a,c,d' && calls === 2);
reset(['a', 'b']); r = g.deleteAssign_({ token: 'A', ids: ['khong-co'] });
ok('id khong co tren sheet: ok, khong xoa gi', r.ok && r.deleted === 0 && rows.length === 2);
reset(['a']); max = 2; r = g.deleteAssign_({ token: 'X', ids: ['a'] });
ok('xoa dong du lieu cuoi cung khong loi; vai tro tu tao goc admin duoc xoa', r.ok && rows.length === 0);
reset(['a']); r = g.deleteAssign_({ token: 'L', ids: ['a'] });
ok('Truong nhom / CS bi chan', r.code === 'FORBIDDEN' && rows.length === 1);
r = g.deleteAssign_({ token: 'A', ids: [] });
ok('thieu id -> bao loi', !!r.error && rows.length === 1);
ok('nho id dot da xoa (ke ca id khong con tren sheet), khong nho lan bi chan', JSON.parse(props.assignDeletedIds).join() === 'b,khong-co,a');
process.exit(fail ? 1 : 0);

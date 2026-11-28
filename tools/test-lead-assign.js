// Truong nhom (Lead): chia lai data cho team, gioi han thang, khong ghi de lich su chia. Chay: node tools/test-lead-assign.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const grab = n => { const m = src.match(new RegExp('^function ' + n + '\\([\\s\\S]*?\\n}\\n', 'm')) || src.match(new RegExp('^function ' + n + '\\(.*}[ \\t]*(//.*)?\\n', 'm')); if (!m) throw new Error('khong thay ' + n); return m[0]; };
let ok = 0, fail = 0; const t = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); v ? ok++ : fail++; };
const J = v => JSON.stringify(v);
const lead = { username: 'lead1', name: 'Mai', names: ['Mai'], role: 'leader', team: 'A', viewMonths: [] };
const teams = [{ name: 'A', leader: 'Mai', members: ['Lan', 'Minh'] }, { name: 'B', leader: 'Hoa', members: ['Tu'] }];
let aliases = {}, history, written, saved, users = { L: lead, C: { username: 'lan', name: 'Lan', names: ['Lan'], role: 'cs' }, A: { username: 'ad', role: 'admin' } };
const orders = { '0900000001': ['15/04/2026'], '0900000002': ['02/09/2026'], '0900000003': ['30/06/2026'], '0900000009': ['01/09/2026'] };
const ctx = {
  console, JSON, Math, Date, Object, Array, String, Number, RegExp,
  LEAD_ASSIGN_MAX_: 20000, SH_ASSIGN: 'AssignData', SH_TEAM: 'Teams', ASSIGN_HEADERS: ['id', 'date', 'csName', 'label', 'phones', 'donePhones', 'part'],
  Logger: { log: () => {} }, jsonOut_: o => o,
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  Utilities: { formatDate: () => '2026-11-26 04:00' },
  getCrmSS_: () => ({ getSheetByName: () => ({}) }),
  getSheet_: () => ({ getLastRow: () => 1, getRange: () => ({ setValues: r => { written = r; } }) }),
  readTeams_: () => teams, readAssign_: () => JSON.parse(J(history)),
  assignRowsOf_: h => [[h.id, h.date, h.csName, h.label, J(h.phones), '[]', 0]],
  saveAssignEntry_: e => saved.push(e), saveAssignHistory_: h => ({ overwritten: h.length }),
  _sessUser_: tk => users[tk] || null, _roleBase_: r => r === 'leadx' ? 'leader' : r,
  normPhone_: p => String(p || '').replace(/\D/g, ''),
  parseVNDate_: s => { const m = String(s || '').match(/^(\d+)\/(\d+)\/(\d+)/); return m ? { y: +m[3], mo: +m[2] } : null; },
  _vnYmdParts_: d => d,
  _cacheGetBig_: () => null,
  readAllOrders_: () => Object.keys(orders).map(p => ({ phone: p, date: orders[p][0] })),
  readOrdersByPhone_: p => (orders[p] || []).map(d => ({ date: d })),
  readDonChiTiet_: () => [{ soDienThoai: '0900000004', ngayTaoDon: '05/05/2026' }], findDonRowsByPhone_: () => [],
  _viewExtraNames_: () => ({ names: [] }),
  _userAliasGroups_: () => aliases,
  _scopeAssignIndex_: () => { const i = {}; history.forEach(h => h.phones.forEach(p => (i[p] = i[p] || []).push(h.csName))); return i; }
};
vm.createContext(ctx);
['_normTxt_', '_viewMonthsNorm_', '_leadMonths_', '_leadOwnNames_', '_stripVN_', '_scopeNameKey_', '_scopeSameNameKeys_', '_leadNameResolver_', '_leadOwnKeys_', '_leadTeam_', '_ymOfOrderDate_', '_phoneHasOrderInMonths_', '_leadMonthFilterSet_', '_leadUser_', 'leadAssignInfo_', 'leadAssign_', 'saveAssignHistoryGuarded_', '_scopeAllowedNames_', '_scopeVerdict_'].forEach(n => vm.runInContext(grab(n), ctx));
const reset = () => { written = null; saved = []; history = [
  { id: '1', csName: 'Mai', phones: ['0900000001', '0900000002'], donePhones: [] },
  { id: '2', csName: 'Lan', phones: ['0900000003'], donePhones: [] },
  { id: '3', csName: 'Tu', phones: ['0900000009'], donePhones: [] }]; };

reset();
t('thang: loc sai dinh dang, bo trung, sap xep', J(ctx._viewMonthsNorm_(['2026-06', '2026-4', '2026-04', 'x', '2026-06', '2026-13'])) === J(['2026-04', '2026-06']));
let r = ctx.leadAssignInfo_({ parameter: { token: 'L' } });
t('info: team A, thanh vien Lan + Minh (khong gom minh)', r.ok && J(r.members) === J(['Lan', 'Minh']) && J(r.teams) === J(['A']));
t('info: chi dot chia cua minh + thanh vien (khong co team B)', J(r.assignHistory.map(h => h.id)) === J(['1', '2']));
t('info: CS khong duoc dung', ctx.leadAssignInfo_({ parameter: { token: 'C' } }).code === 'FORBIDDEN');
t('info: khong token', ctx.leadAssignInfo_({ parameter: {} }).code === 'AUTH');

r = ctx.leadAssign_({ token: 'L', label: 'dot 1', entries: [{ csName: 'lan', phones: ['0900000001'] }, { csName: 'Minh', phones: ['0900000002', '0900000001'] }] });
t('chia lai: 2 dot, ten chuan theo team, 1 SDT chi 1 nguoi', r.ok && r.total === 2 && J(r.entries.map(e => [e.csName, e.phones])) === J([['Lan', ['0900000001']], ['Minh', ['0900000002']]]));
t('chia lai: ghi noi them 2 dong, nhan co ten Lead', written.length === 2 && written[0][3] === 'Lead Mai: dot 1');
written = null; r = ctx.leadAssign_({ token: 'L', entries: [{ csName: 'Tu', phones: ['0900000001'] }] });
t('chia cho nguoi team khac -> chan, khong ghi', r.code === 'FORBIDDEN' && !written);
r = ctx.leadAssign_({ token: 'L', entries: [{ csName: 'Lan', phones: ['0900000001'] }, { csName: 'Minh', phones: ['0900000009'] }] });
t('chia SDT chua duoc chia cho minh -> chan toan bo', r.code === 'FORBIDDEN' && !written);
t('CS goi thang leadAssign -> chan', ctx.leadAssign_({ token: 'C', entries: [{ csName: 'Minh', phones: ['0900000003'] }] }).code === 'FORBIDDEN');

r = ctx.saveAssignHistoryGuarded_({ token: 'C', history: [{ id: '2', csName: 'Lan', phones: [], donePhones: ['0900000003'] }, { id: '1', csName: 'Mai', donePhones: ['0900000001'] }] });
t('CS gui ca lich su: chi cap nhat "xong" dot cua minh, khong ghi de sheet', r.doneOnly && r.written === 1 && saved.length === 1 && saved[0].id === '2' && saved[0].phones.length === 1);
t('admin / khong token: ghi de nhu cu', ctx.saveAssignHistoryGuarded_({ token: 'A', history: [1] }).overwritten === 1 && ctx.saveAssignHistoryGuarded_({ history: [1, 2] }).overwritten === 2);

// Dot chia ghi ten khac cach viet / ten dang nhap / the Khop sale
aliases = { lan: ['Lan', 'lanpk95'] };
written = null; history = [
  { id: 'u', csName: 'lead1', phones: ['0900000001'] },
  { id: 'd', csName: 'M\u00e0i', phones: ['0900000002'] },
  { id: 't', csName: 'lanpk95', phones: ['0900000003'] },
  { id: 'x', csName: 'Tu', phones: ['0900000009'] }];
r = ctx.leadAssignInfo_({ parameter: { token: 'L' } });
t('ten dang nhap / co dau / the khop sale: van vao man cua Lead, ten quy ve team', J(r.assignHistory.map(h => [h.id, h.csName])) === J([['u', 'lead1'], ['d', 'Mai'], ['t', 'Lan']]));
r = ctx.leadAssign_({ token: 'L', entries: [{ csName: 'Minh', phones: ['0900000001', '0900000002'] }] });
t('chia lai duoc data ghi theo ten dang nhap / co dau', r.ok && r.total === 2);
written = null; r = ctx.leadAssign_({ token: 'L', entries: [{ csName: 'Minh', phones: ['0900000003'] }] });
t('data cua thanh vien (the khop sale) khong tinh la cua Lead', r.code === 'FORBIDDEN' && !written);
history = [{ id: 'd', csName: 'M\u00e0i', phones: ['0900000009'] }];
const lmA = Object.assign({}, lead, { viewMonths: ['2026-04'] });
t('loc thang: data chia cho Lead ghi ten co dau van xem duoc du ngoai thang', ctx._scopeVerdict_(lmA, '0900000009', () => ({})) === true && ctx._leadMonthFilterSet_(lmA, { '0900000009': 1 }, ['2026-04'])['0900000009'] === 1);
aliases = {};

// Gioi han thang 4,5,6
const lm = Object.assign({}, lead, { viewMonths: ['2026-04', '2026-05', '2026-06'] });
const team = { '0900000001': 1, '0900000002': 1, '0900000003': 1, '0900000004': 1, '0900000009': 1 };
history = [{ id: '1', csName: 'Mai', phones: ['0900000002'] }];
const set = ctx._leadMonthFilterSet_(lm, team, lm.viewMonths);
t('loc thang: giu don T4/T6 (DT tong) + T5 (du lieu don) + data chia thang cho Lead (T9)', J(Object.keys(set).sort()) === J(['0900000001', '0900000002', '0900000003', '0900000004']));
const have = () => ({ Lan: 1 });
t('tra 1 SDT: trong thang -> duoc; ngoai thang -> chan; duoc chia thang -> duoc', ctx._scopeVerdict_(lm, '0900000001', have) === true && ctx._scopeVerdict_(lm, '0900000009', have) === false && ctx._scopeVerdict_(lm, '0900000002', have) === true);
t('trong thang nhung ngoai team -> chan', ctx._scopeVerdict_(lm, '0900000001', () => ({ Tu: 1 })) === false);
t('khong cai thang -> nhu cu', ctx._scopeVerdict_(lead, '0900000009', have) === true);
t('thang chi ap cho truong nhom; vai tro tu tao goc leader cung ap', ctx._leadMonths_({ role: 'cs', viewMonths: ['2026-04'] }).length === 0 && ctx._leadMonths_({ role: 'leadx', viewMonths: ['2026-04'] }).length === 1);
console.log(ok + ' OK, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0);

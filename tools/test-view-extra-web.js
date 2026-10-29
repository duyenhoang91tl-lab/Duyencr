// Test web: _inUserScope cong them viewNames (nhom Sale "Quay" + phong CSKH) cho doi sale Online/Van phong (2026-10-29).
// Chay: node tools/test-view-extra-web.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../js/08-fn-invalidatefiltercache.js', 'utf8');
function grab(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } }
const ctx = { teams: [{ name: 'Team A', leader: 'Truong A', members: ['Hoa Online', 'Nam VP'] }], _assignIndex: {}, _assignAllIndex: {}, currentUser: null };
vm.createContext(ctx);
['_teamMemberSet', '_heldBy', '_inUserScope'].forEach(n => vm.runInContext(grab(n), ctx));
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const cust = (phone, cs, extra) => Object.assign({ phone, careCS: cs, csSet: new Set(), careCSSet: new Set() }, extra || {});
const own = cust('0901', 'Hoa Online'), quay = cust('0902', 'Lan Quầy'), cskh = cust('0903', 'Quỳnh CS'), other = cust('0904', 'Nguoi Khac');
const orderQuay = cust('0905', '', { csSet: new Set(['Lan Quầy']) });   // khach co don do sale Quay ban

// 1) Sale Online (cs) co viewNames -> thay own + Quay + CSKH, KHONG thay nguoi khac
ctx.currentUser = { role: 'cs', name: 'Hoa Online', names: ['Hoa Online'], viewNames: ['Lan Quầy', 'Quỳnh CS'] };
ctx.__c = [own, quay, cskh, other, orderQuay];
const res = vm.runInContext('__c.map(_inUserScope)', ctx);
ok(JSON.stringify(res) === JSON.stringify([true, true, true, false, true]), 'cs sale Online: thay minh + Quay + CSKH (ke ca don do Quay ban), khong thay nguoi khac');
// 2) Khong co viewNames (thu viec / CSKH) -> nhu cu, chi minh
ctx.currentUser = { role: 'cs', name: 'Tan', names: ['Tan'], viewNames: [] };
ctx.__c = [cust('1', 'Tan'), quay, cskh];
ok(JSON.stringify(vm.runInContext('__c.map(_inUserScope)', ctx)) === '[true,false,false]', 'khong co viewNames: chi khach cua minh');
// 3) viewNames undefined (tai khoan cu) -> khong loi
ctx.currentUser = { role: 'cs', name: 'Tan', names: ['Tan'] };
ok(vm.runInContext('_inUserScope(__c[1])', ctx) === false, 'viewNames undefined: khong loi, khong mo rong');
// 4) leader sale co viewNames: team + Quay + CSKH
ctx.currentUser = { role: 'leader', name: 'Truong A', names: ['Truong A'], team: 'Team A', viewNames: ['Lan Quầy', 'Quỳnh CS'] };
ctx.__c = [own, quay, cskh, other];
ok(JSON.stringify(vm.runInContext('__c.map(_inUserScope)', ctx)) === '[true,true,true,false]', 'leader sale: team + Quay + CSKH');
// 5) leader khong co team nhung co viewNames
ctx.currentUser = { role: 'leader', name: 'Zed', names: ['Zed'], team: '', viewNames: ['Lan Quầy'] };
ok(JSON.stringify(vm.runInContext('[__c[1], __c[2]].map(_inUserScope)', ctx)) === '[true,false]', 'leader khong team + viewNames: chi them Quay');
// 6) admin khong doi
ctx.currentUser = { role: 'admin', name: 'Admin', names: [], viewNames: [] };
ok(vm.runInContext('_inUserScope(__c[3])', ctx) === true, 'admin: van thay tat ca');
// 7) doi viewNames giua chung (dang nhap lai) -> mang gop tinh lai, khong dung ban cache cu
ctx.currentUser = { role: 'cs', name: 'Hoa Online', names: ['Hoa Online'], viewNames: ['Lan Quầy'] };
vm.runInContext('_inUserScope(__c[1])', ctx);
ctx.currentUser.viewNames = ['Quỳnh CS'];
ok(vm.runInContext('_inUserScope(__c[1])', ctx) === false && vm.runInContext('_inUserScope(__c[2])', ctx) === true, 'viewNames doi -> khong dung cache cu');
process.exit(fail ? 1 : 0);

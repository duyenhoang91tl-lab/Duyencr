#!/usr/bin/env node
// Test Chia data theo Team: Phong ban Sale nhu Team + tao nhanh Team (js/07). Chay: node tools/test-assign-team.js
const fs = require('fs'), vm = require('vm');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../js/07-openassignmodal.js', 'utf8');
const grab = name => { const i = src.search(new RegExp('(async )?function ' + name + '\\(')); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } };
const toasts = []; let pushed = 0, saved = 0;
const mk = role => {
  const ctx = { teams: [{ id: 't1', name: 'Team A', members: ['An'] }], currentUser: { role }, toast: m => toasts.push(m), prompt: () => 'Team Moi', saveLS: () => saved++, logAudit() {}, pushTeamsToGS: () => pushed++,
    _genTeamId: () => 'tNew', V9_TEAM_COLORS: ['#111'], _dedupePeopleNames: n => n.filter((x, i) => n.indexOf(x) === i), renderAssignCreate() {}, document: { getElementById: () => null },
    _advAssign: { selectedCS: new Set(['Binh', 'Chi']), selectedTeams: new Set(), selectMode: 'cs' }, _asgDept: { loaded: false, loading: false, err: '', list: [] }, console };
  vm.createContext(ctx); ['_assignBuildDeptTeams', '_assignTeamById', '_advAssignQuickTeam', '_advAssignSetMode'].forEach(n => vm.runInContext(grab(n), ctx)); return ctx;
};
let c = mk('admin');
const dl = [{ key: 'sale', label: 'Phòng Sale' }, { key: 'cskh', label: 'CSKH' }, { key: 'rong', label: 'Trống' }];
const sd = { Zed: 'sale', Anh: 'sale', 84901: 'sale', Lan: 'cskh', Xa: 'khac' };
const d = vm.runInContext('_assignBuildDeptTeams(' + JSON.stringify(dl) + ',' + JSON.stringify(sd) + ')', c);
ok(d.length === 2 && d[0].id === 'dept:sale' && d[0].members.join() === 'Anh,Zed', 'phong ban -> Team ao, thanh vien sap xep, bo ten so');
ok(!d.some(x => x.id === 'dept:rong'), 'phong khong co thanh vien bi bo');
ok(vm.runInContext('_assignBuildDeptTeams(null,null)', c).length === 0 && vm.runInContext('_assignBuildDeptTeams([{key:"a"}],[1])', c).length === 0, 'du lieu hong/khong co -> rong, khong loi');
c._asgDept.list = d;
ok(vm.runInContext('_assignTeamById("dept:cskh")', c).members[0] === 'Lan' && vm.runInContext('_assignTeamById("t1")', c).name === 'Team A' && !vm.runInContext('_assignTeamById("zz")', c), 'tim Team theo id: Team that + phong ban');
vm.runInContext('_advAssignQuickTeam()', c);
ok(c.teams.length === 2 && c.teams[1].name === 'Team Moi' && c.teams[1].members.join() === 'Binh,Chi' && c.teams[1].leader === '', 'tao nhanh Team tu nguoi dang chon');
ok(c._advAssign.selectedTeams.has('tNew') && pushed === 1 && saved === 1, 'tu chon Team moi + luu local + day GS');
vm.runInContext('_advAssignQuickTeam()', c);
ok(c.teams.length === 2 && toasts.slice(-1)[0].includes('Đã có Team'), 'trung ten Team -> chan');
c = mk('cs'); vm.runInContext('_advAssignQuickTeam()', c);
ok(c.teams.length === 1 && toasts.slice(-1)[0].includes('Chỉ Admin'), 'khong phai Admin -> khong tao duoc');
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);

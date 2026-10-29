// Test web bao cao: doi sale Online/Van phong chon them ten nhom Quay + phong CSKH (2026-10-29).
// Chay: node tools/test-view-extra-report.js
const fs = require('fs'), vm = require('vm');
const read = f => fs.readFileSync(__dirname + '/../js/' + f, 'utf8');
const s10 = read('10-fn-pkkpipct.js'), s09 = read('09-fn-deleteteam.js'), s08 = read('08-fn-invalidatefiltercache.js'), s13 = read('13-fn-bpseedofficialonlinetemplate.js');
function grab(src, name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } }
const ctx = { teams: [{ name: 'Team A', leader: 'Truong A', members: ['Hoa Online', 'Nam VP'] }], _srState: {}, _pkState: {}, currentUser: null };
vm.createContext(ctx);
vm.runInContext(grab(s08, '_teamMemberSet'), ctx);
['_srIsAdmin', '_srMyNames', '_srLeaderTeamNames', '_srViewNames', '_srViewScopeOptions', '_srEnforceScope', '_srEnforceScopeBase_'].forEach(n => vm.runInContext(grab(s10, n), ctx));
vm.runInContext(grab(s09, '_pkEnforceScope'), ctx);
vm.runInContext(grab(s13, '_srbHasViewScope_'), ctx);
vm.runInContext("var _SR_VIEW_KEYS_ = ['sale','bSale','cSale','eSale','fSale','gSale','lSale','mSale'];", ctx);
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const J = v => JSON.stringify(v);
const run = code => vm.runInContext(code, ctx);

// 1) cs sale Online co viewNames: lan dau -> mac dinh ten minh; options = minh + Quay/CSKH
ctx.currentUser = { role: 'cs', name: 'Hoa Online', names: ['Hoa Online'], viewNames: ['Lan Quầy', 'Quỳnh CS'] };
ctx._srState = {};
run('_srEnforceScope()');
ok(J(ctx._srState.bSale) === '["Hoa Online"]' && J(ctx._srState.sale) === '["Hoa Online"]', 'cs sale: mac dinh chi ten minh');
ok(J(ctx._srState.viewScopeOptions) === '["Hoa Online","Lan Quầy","Quỳnh CS"]', 'cs sale: options = minh + Quay + CSKH');
ok(run('_srbHasViewScope_()') === true, '_srbHasViewScope_ = true');
// 2) chon them Quay o Bao cao B (bSale) va E -> giu lai sau khi render lai
ctx._srState.bSale = ['Hoa Online', 'Lan Quầy']; ctx._srState.eSale = ['Quỳnh CS'];
run('_srEnforceScope()');
ok(J(ctx._srState.bSale) === '["Hoa Online","Lan Quầy"]' && J(ctx._srState.eSale) === '["Quỳnh CS"]', 'lua chon Quay/CSKH duoc giu sau khi render lai');
// 3) co chon ten NGOAI pham vi (nguoi khac) -> bi loai, ve mac dinh
ctx._srState.bSale = ['Nguoi Khac', 'Hoa Online'];
run('_srEnforceScope()');
ok(J(ctx._srState.bSale) === '["Hoa Online"]', 'ten ngoai pham vi bi loai (ve mac dinh)');
ctx._srState.cSale = ['Nguoi Khac'];
run('_srEnforceScope()');
ok(J(ctx._srState.cSale) === '["Hoa Online"]', 'chi chon ten ngoai pham vi -> ve mac dinh ten minh');
// 4) bo tick Quay -> ve ten minh
ctx._srState.sale = ['Hoa Online'];
run('_srEnforceScope()');
ok(J(ctx._srState.sale) === '["Hoa Online"]', 'bo chon Quay -> ten minh');
// 5) leader sale: team mac dinh cho E; chon them Quay duoc giu; "Ca team" (leaderTeamOptions) khong gom Quay/CSKH
ctx.currentUser = { role: 'leader', name: 'Truong A', names: ['Truong A'], team: 'Team A', viewNames: ['Lan Quầy'] };
ctx._srState = {};
run('_srEnforceScope()');
ok(J(ctx._srState.eSale.slice().sort()) === J(['Hoa Online', 'Nam VP', 'Truong A'].sort()), 'leader sale: E mac dinh = ca team');
ok(J(ctx._srState.leaderTeamOptions.slice().sort()) === J(['Hoa Online', 'Nam VP', 'Truong A'].sort()), 'leaderTeamOptions van chi la team (nut "Ca team" khong gom Quay)');
ok(ctx._srState.viewScopeOptions.indexOf('Lan Quầy') >= 0 && ctx._srState.viewScopeOptions.indexOf('Nam VP') >= 0, 'leader: viewScopeOptions = team + Quay');
ctx._srState.eSale = ['Lan Quầy']; ctx._srState.eSaleCustomized = true;
run('_srEnforceScope()');
ok(J(ctx._srState.eSale) === '["Lan Quầy"]', 'leader chon rieng Quay o E -> duoc giu');
// 6) khong co viewNames (thu viec / CSKH) -> hanh vi CU 100%
ctx.currentUser = { role: 'cs', name: 'Tan', names: ['Tan'], viewNames: [] };
ctx._srState = { bSale: ['Lan Quầy'], eSale: ['Lan Quầy'] };
run('_srEnforceScope()');
ok(J(ctx._srState.bSale) === '["Tan"]' && J(ctx._srState.eSale) === '["Tan"]', 'khong co viewNames: bi khoa ve ten minh nhu cu');
ok(run('_srbHasViewScope_()') === false && J(ctx._srState.viewScopeOptions) === '[]', 'khong co viewNames: khong mo bo loc');
// 7) admin khong doi
ctx.currentUser = { role: 'admin', name: 'Admin', names: [], viewNames: ['X'] };
ctx._srState = { bSale: ['A', 'B'] };
run('_srEnforceScope()');
ok(J(ctx._srState.bSale) === '["A","B"]' && run('_srbHasViewScope_()') === false, 'admin: khong bi dong vao');
// 8) KPI Pancake: pham vi = minh + viewNames
ctx.currentUser = { role: 'cs', name: 'Hoa Online', names: ['Hoa Online'], viewNames: ['Lan Quầy', 'Quỳnh CS'] };
run('_pkEnforceScope()');
ok(J(ctx._pkState.kpiSaleScope) === '["Hoa Online","Lan Quầy","Quỳnh CS"]', 'KPI Pancake: minh + Quay + CSKH');
ctx.currentUser = { role: 'cs', name: 'Tan', names: ['Tan'], viewNames: [] };
run('_pkEnforceScope()');
ok(J(ctx._pkState.kpiSaleScope) === '["Tan"]', 'KPI Pancake: khong viewNames -> chi minh');
// 9) menu bao cao da noi vao
ok(/_srbHasViewScope_\(\)\)\{\s*\/\/ Sale Online/.test(s13) && s13.indexOf("'bSale', function(){ return _srState.viewScopeOptions") > 0, 'menu bao cao A/C/E/F/G/L/M va B co bo loc Sale cho view-scope');
process.exit(fail ? 1 : 0);

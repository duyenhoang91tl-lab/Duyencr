#!/usr/bin/env node
// Test Node: TAI KHOAN TEST (role 'demo') PHIA WEB — dat danh tinh khong ep tab bao cao, va khong cho nao coi demo la admin.
// Bo sung cho tools/test-demo-scope-ui.js (loc khach + chan POST) va tools/test-demo-scope.js (may chu).
// NGUYEN NHAN GOC can test: js/14 tung ep demo chi con 5 tab bao cao; js/09, 11, 12, 67 tung coi demo ngang admin nen hien nut sua.
// Chay: node tools/test-demo-scope-web.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8').replace(/\r\n/g, '\n');
const fn = (src, name) => { const i = src.indexOf('\nfunction ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); const j = src.indexOf('\n}\n', i); return src.slice(i + 1, j + 3); };
let fails = 0;
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); fails++; } else console.log('  ok  ' + m); };

// ── 1) Dat danh tinh: khong ep tab, giu demo-mode ──
const cls = new Set(); const store = { ome_demo_token: 'T' };
const idn = {
  currentUser: null, _bootstrapAdmin: true, cskhData: {}, cskhMeta: {}, switched: 0,
  _roleBaseOf: (r) => r, _demoPurgeAndReload_: () => false, saveLS: () => {}, setTimeout: (f) => f(), switchTab: () => { idn.switched++; },
  localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } },
  document: { body: { classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) } }, getElementById: () => null, querySelector: () => null }
};
vm.createContext(idn);
const full = fn(read('14-fn-aasplit.js'), '_applyAuthIdentity');
const cut = full.indexOf('if (typeof _applyUserTabPermissions');
vm.runInContext(full.slice(0, cut) + '}\n', idn);
idn._applyAuthIdentity({ username: 'tester', role: 'demo', names: ['salea'] });
ok(idn.currentUser.perms === null, 'demo khong bi ep con 5 tab bao cao');
ok(idn.switched === 0, 'demo khong bi tu chuyen sang Bao cao');
ok(cls.has('demo-mode'), 'van bat demo-mode (an nut quan tri)');
ok(idn.currentUser.role === 'demo' && idn.currentUser.names.join() === 'salea', 'giu role demo + sale duoc chon');
idn._applyAuthIdentity({ username: 'tester', role: 'demo', names: ['salea'], perms: ['tab-kh'] });
ok(String(idn.currentUser.perms) === 'tab-kh', 'perms admin dat rieng cho tai khoan test van duoc ton trong');

// ── 2) Khong cho nao coi demo la admin de hien nut sua ──
['09-fn-deleteteam.js', '11-fn-srload.js', '12-fn-rendersalesreporttabe.js', '67-pancake-namemap-modal.js'].forEach((f) => {
  ok(!/role\s*===?\s*'admin'\s*\|\|\s*[\w.]*role\s*===?\s*'demo'/.test(read(f)), f + ': demo khong duoc tinh la admin');
});

// ── 3) An cac man may chu khong phuc vu (Duyen chot 2026-11-28) ──
const s05 = read('05-fn-saveeditphone.js');
const els = {};
const mkEl = () => ({ style: { display: '' }, attrs: {}, classList: { contains: () => false }, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, removeAttribute(k) { delete this.attrs[k]; } });
const tab = { currentUser: null, _PERM_TAB_DEFS: ['tab-kh', 'tab-zaloai', 'tab-chat', 'tab-media', 'tab-teamchat', 'tab-task', 'uploaddata', 'salesreport'].map((id) => ({ id })),
  document: { querySelector: (q) => { const m = q.match(/data-bar-id="([^"]+)"/); return m ? (els[m[1]] || null) : null; } }, switchTab: () => {} };
['tab-kh', 'tab-zaloai', 'tab-chat', 'tab-media', 'tab-teamchat', 'tab-task', 'uploaddata', 'salesreport', 'stageboard', 'plib', 'crmorders', 'combo'].forEach((id) => { els[id] = mkEl(); });
vm.createContext(tab);
const decl = s05.match(/\nvar _DEMO_HIDDEN_TABS_ = \[[^\]]*\];/);
const one = s05.match(/\nfunction _demoTabHidden_\(id\)\{[^\n]*\}/);
ok(!!decl && !!one, 'js/05 co danh sach man an cua tai khoan test');
vm.runInContext(decl[0] + one[0] + '\n' + fn(s05, '_tabAllowedForUser') + fn(s05, '_applyUserTabPermissions'), tab);
const HID = ['tab-zaloai', 'tab-chat', 'tab-media', 'tab-teamchat', 'tab-task', 'stageboard', 'plib', 'crmorders', 'uploaddata'];
tab.currentUser = { role: 'demo', perms: null };
tab._applyUserTabPermissions();
ok(HID.every((id) => els[id].style.display === 'none'), 'demo: 9 man khong dung duoc deu bi an (ca man phu stageboard/plib/crmorders)');
ok(['tab-kh', 'salesreport', 'combo'].every((id) => els[id].style.display !== 'none'), 'demo: Danh sach KH / Bao cao / Combo van hien');
tab.currentUser = { role: 'demo', perms: ['tab-kh', 'tab-chat'] };
ok(tab._tabAllowedForUser('tab-chat') === false && tab._tabAllowedForUser('tab-kh') === true, 'demo: cap quyen rieng cung khong mo duoc man may chu khong phuc vu');
tab.currentUser = { role: 'cs', perms: null };
tab._applyUserTabPermissions();
ok(HID.every((id) => els[id].style.display !== 'none'), 'doi sang tai khoan thuong: cac man hien lai');
tab.currentUser = { role: 'cs', perms: ['tab-kh'] }; els.stageboard.style.display = '';
tab._applyUserTabPermissions();
ok(els.stageboard.style.display === '' && els['tab-chat'].style.display === 'none', 'tai khoan thuong co phan quyen rieng: hanh vi nhu cu');
// Neu may chu mo action doc cho 1 man dang an thi phai nghi lai danh sach
const gas = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const lists = (gas.match(/var DEMO_ALLOWED_GET_ = \{[\s\S]*?\};/) || [''])[0] + (gas.match(/var DEMO_SESSION_EXTRA_GET_ = \[[\s\S]*?\];/) || [''])[0];
const opened = ['vietTat', 'messageTemplates', 'pkChatInbox', 'mlibList', 'chatChannels', 'tasks', 'stageBoard', 'plibList', 'crmOrders'].filter((a) => new RegExp('\\b' + a + '\\b').test(lists));
ok(lists.length > 100 && opened.length === 0, 'may chu van chua mo action doc cua cac man dang an (neu mo, bo id khoi _DEMO_HIDDEN_TABS_): ' + opened.join(','));
// May chu tu choi quyen khong duoc hien khung "Apps Script ban cu"
const s07 = read('07-openassignmodal.js');
let banner = 0;
const asg = { gsUrl: 'u', assignHistory: [], _assignBackendOK: true, console: { warn() {} }, toast: () => {}, showAssignBackendWarning: () => { banner++; }, fetch: async () => ({ json: async () => ({ error: 'x', code: 'FORBIDDEN' }) }) };
vm.createContext(asg);
const pull = s07.slice(s07.indexOf('\nasync function pullAssignHistory('), s07.indexOf('\n}\n', s07.indexOf('\nasync function pullAssignHistory(')) + 3);
vm.runInContext(pull + fn(s07, '_checkAssignResp'), asg);
(async () => {
  await asg.pullAssignHistory(); asg._checkAssignResp('{"error":"x","code":"FORBIDDEN"}');
  ok(banner === 0, 'may chu tu choi quyen: khong hien khung Copy Apps Script');
  asg._checkAssignResp('{"error":"Unknown action"}');
  ok(banner === 1, 'backend cu that su: van canh bao nhu truoc');
  if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
  console.log('ALL DEMO WEB SCOPE TESTS PASSED');
})();

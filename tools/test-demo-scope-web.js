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

if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL DEMO WEB SCOPE TESTS PASSED');

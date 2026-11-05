#!/usr/bin/env node
// Test lui nhip auto-sync khi loi lien tiep + timeout FULL customers 150s (2026-11-04).
const fs = require('fs'), path = require('path'), vm = require('vm');
const js5 = fs.readFileSync(path.join(__dirname, '..', 'js', '05-fn-saveeditphone.js'), 'utf8');
const js1 = fs.readFileSync(path.join(__dirname, '..', 'js', '01-fn-splitmulti.js'), 'utf8');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const i = js5.indexOf('function _autoSyncDelayMs_'), j = js5.indexOf('async function autoSyncLoop');
const ctx = { AUTO_SYNC_MS: 5000 }; vm.createContext(ctx); vm.runInContext(js5.slice(i, j), ctx);
const d = n => ctx._autoSyncDelayMs_(n);
ok(d(0) === 5000 && d(1) === 5000 && d(undefined) === 5000, 'chua loi / loi 1 lan: van 5s');
ok(d(2) === 10000 && d(3) === 20000 && d(4) === 40000, 'loi 2,3,4 lan lien tiep: 10s, 20s, 40s');
ok(d(5) === 60000 && d(50) === 60000, 'tran 60s (khong bao gio dung han)');
ok(/_autoSyncTimer = setTimeout\(autoSyncLoop, _autoSyncDelayMs_\(_autoSyncFailCount\)\)/.test(js5), 'autoSyncLoop dung nhip lui');
ok(/_gsFetchTO_\(careUrl, _wantCareFull \? 150000 : 60000\)/.test(js1), 'FULL customers cho toi 150s, delta van 60s');
ok(/const _failAtStart = _autoSyncFailCount \|\| 0;/.test(js1) && /if \(\(_autoSyncFailCount \|\| 0\) === _failAtStart\) _autoSyncFailCount = 0;/.test(js1), 'dong bo thanh cong (khong them loi) -> dat lai bo dem loi lien tiep ve 0');
console.log(fails ? '\nFAILED ' + fails : '\nALL AUTOSYNC TESTS PASSED'); process.exit(fails ? 1 : 0);

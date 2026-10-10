#!/usr/bin/env node
// Test Node: getSetting_/getSettingsMulti_ chi doc cot A + 1 o (khong doc ca sheet Settings); client _aaPullCfg/_aaSaveNow khong chan UI, khong bi ban cu ghi de.
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const g = R('gas_v13.js'), c14 = R('js/14-fn-aasplit.js');
const fn = (src, n) => { const i = src.indexOf('\nfunction ' + n + '('); if (i < 0) throw new Error(n); return src.slice(i + 1, src.indexOf('\n}\n', i) + 3); };
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
// ---- GAS ----
const rows = [['key', 'value'], ['adminKey', ' KEY1 \n'], ['gasSourceChunk_0', 'X'.repeat(45000)], ['autoAssignCfg', '{"a":1}'], ['autoAssignState', ''], ['demoToken', 'T'], ['  autoAssignCfg ', 'dup'], ['apiGemini', 'S']];
let cellReads = 0, rangeReads = [];
const sheet = { getLastRow: () => rows.length, getDataRange: () => { throw new Error('KHONG duoc doc ca sheet'); },
  getRange: (r, c, n, w) => { rangeReads.push([r, c, n || 1, w || 1]); return { getValues: () => rows.slice(r - 1, r - 1 + n).map(x => x.slice(c - 1, c - 1 + w)), getValue: () => { cellReads++; return rows[r - 1][c - 1]; } }; } };
const ctx = { SH_SET: 'S', getCrmSS_: () => ({ getSheetByName: () => sheet }) };
vm.createContext(ctx);
vm.runInContext(fn(g, '_isSensitiveSettingKey_') + fn(g, 'getSetting_') + fn(g, 'getSettingsMulti_'), ctx);
ok(vm.runInContext("getSetting_('adminKey')", ctx) === 'KEY1', 'trim gia tri');
ok(vm.runInContext("getSetting_('autoAssignCfg')", ctx) === '{"a":1}', 'lay dong DAU khop (key co khoang trang sau van la dong 7, khong lay)');
ok(vm.runInContext("getSetting_('autoAssignState')", ctx) === null, 'rong -> null');
ok(vm.runInContext("getSetting_('nope')", ctx) === null, 'khong co -> null');
ok(rangeReads.every(r => r[3] === 1 && (r[1] === 1 || r[1] === 2)), 'chi doc 1 cot: ' + JSON.stringify(rangeReads.slice(0, 3)));
ok(rangeReads.every(r => r[2] === 1 || r[2] === rows.length - 1), 'khong doc nhieu o cot B');
const m = JSON.parse(vm.runInContext("JSON.stringify(getSettingsMulti_(['autoAssignCfg','autoAssignState','adminKey','demoToken','apiGemini','nope']))", ctx));
ok(m.autoAssignCfg === '{"a":1}' && m.autoAssignState === null && !('adminKey' in m) && !('demoToken' in m) && !('apiGemini' in m) && m.nope === null, 'multi + bo key nhay cam: ' + JSON.stringify(m));
// ---- Client ----
const store = {}; let posts = [], gets = [], failPost = 0, serverCfg = '{"enabled":true,"teams":{}}';
const cctx = { gsUrl: 'https://w/x', saveLS: (k, v) => store[k] = v, console, _aaCfg: { lastRun: '', lastResult: null, enabled: false, teams: {} }, _aaDefaultCfg: () => ({ enabled: false, teams: {} }), teams: [], _aaMembersOf: t => [], toast: m => cctx.__t.push(m), __t: [],
  document: { getElementById: () => null }, setTimeout,
  fetch: async (url, o) => {
    if (o && o.method === 'POST') { posts.push(JSON.parse(o.body)); if (failPost-- > 0) return { json: async () => ({ error: 'x' }) }; await new Promise(r => setTimeout(r, 30)); return { json: async () => ({ ok: true }) }; }
    gets.push(url);
    if (/action=getSettings/.test(url)) return { json: async () => (cctx.__legacy ? { error: 'unknown' } : { values: { autoAssignCfg: serverCfg, autoAssignState: '{"lastRun":"2026-10-10","by":"server"}' } }) };
    if (/key=autoAssignCfg/.test(url)) return { json: async () => ({ value: serverCfg }) };
    return { json: async () => ({ value: '{"lastRun":"2026-10-10","by":"server"}' }) }; } };
vm.createContext(cctx);
const a = c14.indexOf('var _aaDirty'), b2 = c14.indexOf('function _aaPersistState');
const post = c14.slice(c14.indexOf('// Ghi 1 key Settings'), c14.indexOf('var _aaDirty'));
vm.runInContext(post + c14.slice(a, b2) + c14.slice(c14.indexOf('async function _aaPullCfg'), c14.indexOf('function _aaMembersOf(t)')) + c14.slice(c14.indexOf('// Lưu KHÔNG chặn'), c14.indexOf('function toggleNoActionChip')), cctx);
(async () => {
  const run = c => vm.runInContext(c, cctx);
  await run('_aaPullCfg()');
  ok(gets.length === 1 && run('_aaCfg.enabled') === true && run('_aaCfg.lastBy') === 'server', 'pull 1 lan goi: ' + gets.length);
  // dirty -> khong ghi de cau hinh nhung van cap nhat trang thai
  run('_aaCfg.enabled=false; _aaDirty=true'); gets = [];
  await run('_aaPullCfg()'); ok(run('_aaCfg.enabled') === false && run('_aaCfg.lastRun') === '2026-10-10', 'dirty khong bi ban server ghi de');
  // GAS cu khong co getSettings -> lui ve 2 lan getSetting
  cctx.__legacy = true; run('_aaDirty=false'); gets = []; await run('_aaPullCfg()'); ok(gets.length === 3 && run('_aaCfg.enabled') === true, 'fallback GAS cu: ' + gets.length);
  // luu: UI khong cho, thanh cong -> dirty=false
  run('_aaDirty=true'); const t0 = Date.now(); const p = run('_aaSaveNow()'); ok(Date.now() - t0 < 20 && store.ome_auto_assign_cfg, 'luu may ngay lap tuc'); await p;
  ok(run('_aaDirty') === false && posts.length === 1 && cctx.__t.some(x => /Đã lưu/.test(x)), 'luu xong');
  // loi 2 lan -> bao loi, dirty giu nguyen; thu lai 1 lan trong 1 lan luu
  posts = []; run('_aaDirty=true'); failPost = 2; await run('_aaSaveNow()'); ok(posts.length === 2 && run('_aaDirty') === true && cctx.__t.some(x => /chưa lên được server/.test(x)), 'loi 2 lan');
  failPost = 1; posts = []; await run('_aaSaveNow()'); ok(posts.length === 2 && run('_aaDirty') === false, 'loi 1 lan -> thu lai OK');
  // bam lien tiep: gop
  posts = []; const p1 = run('_aaSaveNow()'); const p2 = run('_aaSaveNow()'); await p1; await p2; await new Promise(r => setTimeout(r, 120));
  ok(posts.length === 2, 'bam 2 lan gop thanh 2 POST (1 + 1 lan luu lai ban moi nhat): ' + posts.length);
  console.log('ALL SETTINGS-FAST TESTS PASSED');
})();

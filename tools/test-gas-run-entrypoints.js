#!/usr/bin/env node
// Test chong tai dien loi: "ham co dau _ o cuoi ten la RIENG TU trong Apps Script — bi AN khoi danh sach chon ham, khong Run tu Editor duoc" (vd dedupePosNow_, installAutoDedupTrigger_).
// Quy uoc: moi ham admin phai CHAY TAY tu Editor phai CONG KHAI (khong co _ cuoi). Ham private chi goi tu code / trigger.
// Chay: node tools/test-gas-run-entrypoints.js -> "ALL GAS RUN ENTRYPOINT TESTS PASSED".
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const gas = fs.readFileSync(path.join(ROOT, 'gas_v13.js'), 'utf8');
const priv = new Set(Array.from(gas.matchAll(/^function\s+([A-Za-z0-9_]+_)\s*\(/gm)).map(m => m[1]));
const pub = new Set(Array.from(gas.matchAll(/^function\s+([A-Za-z0-9]+)\s*\(/gm)).map(m => m[1]));
function walk(d, out) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (n === 'node_modules' || n === 'dist' || n === '.git') continue; const st = fs.statSync(p); if (st.isDirectory()) walk(p, out); else out.push(p); } return out; }

// 1) Khong con huong dan nao bao "chon <ham co _ cuoi>" (Editor khong hien ham do)
const files = ['gas_v13.js', 'index.html', 'README.md'].map(f => path.join(ROOT, f)).filter(fs.existsSync)
  .concat(walk(path.join(ROOT, 'js'), []).filter(f => f.endsWith('.js')), walk(path.join(ROOT, 'docs'), []).filter(f => f.endsWith('.md')));
const bad = [];
const re = /(chon|chọn)\s+(ham|hàm)?\s*[\"'`“]?(?:<b>)?\s*([A-Za-z][A-Za-z0-9]*_)(?![A-Za-z0-9_])/gi;
for (const f of files) { const lines = fs.readFileSync(f, 'utf8').split('\n'); lines.forEach((l, i) => { let m; re.lastIndex = 0; while ((m = re.exec(l))) bad.push(path.relative(ROOT, f) + ':' + (i + 1) + ' -> ' + m[3]); }); }
ok(bad.length === 0, 'con huong dan bao chon ham PRIVATE (co _ cuoi) — Editor khong hien ham do:\n  ' + bad.join('\n  '));

// 2) moi ham cai/go trigger va *Now_ phai co ham CONG KHAI goi no
const need = Array.from(priv).filter(n => /^(install|remove|uninstall)[A-Za-z0-9]*_$/.test(n) || /Now_$/.test(n));
const lacking = need.filter(n => {
  const re2 = new RegExp('^function\\s+([A-Za-z0-9]+)\\s*\\([^)]*\\)\\s*\\{[^\\n]*\\b' + n.replace(/_/g, '_') + '\\s*\\(', 'm');   // ham cong khai goi no ngay dong dau/than ngan
  if (re2.test(gas)) return false;
  // dang nhieu dong: tim than ham cong khai chua loi goi
  for (const m of gas.matchAll(/^function\s+([A-Za-z0-9]+)\s*\([^)]*\)\s*\{/gm)) {
    const body = gas.slice(m.index, m.index + 600); const end = body.indexOf('\n}'); const b = end > -1 ? body.slice(0, end) : body;
    if (b.includes(n + '(')) return false;
  }
  return true;
});
ok(lacking.length === 0, 'ham cai/go trigger hoac *Now_ dang private va KHONG co ham cong khai nao goi (admin khong chay tay duoc): ' + lacking.join(', '));
ok(need.length >= 8, 'tim duoc cac ham can kiem (' + need.length + ')');

// 3) cac ham chay tay da biet phai la cong khai
const MUST = ['dedupePosNow', 'installAutoDedupTrigger', 'removeAutoDedupTrigger', 'chayCaiDatTrigger', 'caiTriggerChiaTuDong', 'goTriggerChiaTuDong', 'chayThuChiaTuDong', 'kiemTraChiaTuDong', 'runDedupeCare', 'sbDonHangCaiTrigger', 'sbDonHangGoTrigger'];
ok(MUST.every(n => pub.has(n)), 'thieu ham cong khai: ' + MUST.filter(n => !pub.has(n)).join(', '));
ok(!MUST.some(n => n.endsWith('_')), 'ten ham chay tay khong co _ cuoi');

// 4) hanh vi: ham cong khai goi dung ham private va GHI KET QUA vao Execution log (return khong hien o Editor)
function fnSrc(name) { const i = gas.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name); let d = 0; const k = gas.indexOf('{', i); for (let j = k; j < gas.length; j++) { if (gas[j] === '{') d++; else if (gas[j] === '}' && --d === 0) return gas.slice(i, j + 1); } }
const logs = []; const calls = [];
const ctx = { Logger: { log: m => logs.push(String(m)) }, dedupePosNow_: () => { calls.push('dedupe'); return 'Da xoa 3 dong'; }, installAutoDedupTrigger_: () => { calls.push('install'); return 'Da tao trigger'; }, removeAutoDedupTrigger_: () => { calls.push('remove'); return 'Da go 1 trigger'; } };
vm.createContext(ctx); vm.runInContext(['dedupePosNow', 'installAutoDedupTrigger', 'removeAutoDedupTrigger', 'chayCaiDatTrigger'].map(fnSrc).join('\n'), ctx);
vm.runInContext('dedupePosNow(); installAutoDedupTrigger(); removeAutoDedupTrigger(); chayCaiDatTrigger();', ctx);
ok(calls.join() === 'dedupe,install,remove,install', 'goi dung ham private: ' + calls.join());
ok(logs.join('|') === 'Da xoa 3 dong|Da tao trigger|Da go 1 trigger|Da tao trigger', 'ket qua duoc ghi vao Execution log: ' + logs.join('|'));

// 5) go trigger: chi go dung handler onChangeDedupTrigger_, dem dung
const trig = [{ h: 'onChangeDedupTrigger_' }, { h: 'autoAssignTick_' }, { h: 'onChangeDedupTrigger_' }];
const c2 = { ScriptApp: { getProjectTriggers: () => trig.map(t => ({ getHandlerFunction: () => t.h, _t: t })), deleteTrigger: x => trig.splice(trig.indexOf(x._t), 1) } };
vm.createContext(c2); vm.runInContext(fnSrc('removeAutoDedupTrigger_'), c2);
const msg = vm.runInContext('removeAutoDedupTrigger_()', c2);
ok(/Da go 2 trigger/.test(msg) && trig.length === 1 && trig[0].h === 'autoAssignTick_', 'go dung 2 trigger don trung, giu trigger chia tu dong: ' + msg);
console.log('ALL GAS RUN ENTRYPOINT TESTS PASSED');

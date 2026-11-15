#!/usr/bin/env node
// R7b — báo cáo I (Chia data Renew) vẽ qua khuôn uiReportFrame_; nội dung KHÔNG đổi so với bản cũ. Chạy: node tools/test-report-i-frame.js
const fs = require('fs'), vm = require('vm'), cp = require('child_process'), path = require('path');
const root = path.join(__dirname, '..'), F = 'js/13-fn-bpseedofficialonlinetemplate.js';
const cur = fs.readFileSync(path.join(root, F), 'utf8');
const old = cp.execSync('git show c8f757b:' + F, { cwd: root, maxBuffer: 1 << 26 }).toString('utf8');
function fn(src, n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thiếu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
function mk(src, frame, data) {
  const ctx = Object.assign({ location: { search: '' }, document: { readyState: 'complete', addEventListener() {} }, console,
    esc: s => String(s == null ? '' : s).replace(/</g, '&lt;'), fmt: n => String(n), _srBarHtml_: () => '<div class="srb-bar" id="BAR"></div>', _srIsAdmin: () => true,
    _hScopeNames_: () => null, _hGroups_: () => [{ name: 'Chốt', noContact: false }, { name: 'KLL', noContact: true }], _hGroupIndex_: g => { const m = {}; g.forEach((x, i) => m[x.name] = i); return m; },
    _hEntryDate_: d => String(d || '').slice(0, 10), _teamOf: cs => ({ name: 'T1' }), _hAutoKh_: st => st ? 'Có' : '', teams: [{ name: 'T1' }] }, data);
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((frame ? fs.readFileSync(path.join(root, 'js/68-ui-kit.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'js/76-report-frame.js'), 'utf8') + '\n' : '') + fn(src, 'renderSalesReportTabI_'), ctx);
  ctx._srState = { iDateFrom: '', iDateTo: '', iCs: '', iCsList: [], iTeam: '' }; return ctx;
}
const DATA = {
  cskhData: { '0901': {}, '0902': {}, '0903': {} },
  assignHistory: [{ date: '2026-10-05', csName: 'A', phones: ['0901', '0902', '0999'], donePhones: ['0901'] }, { date: '2026-11-02', csName: 'B', phones: ['0903'], donePhones: [] }],
  careData: { '0901': { status: 'Chốt', revenue: 500, zalo: 'Đã kết bạn' }, '0902': { status: 'KLL' }, '0903': {} },
  allCustomers: [{ phone: '0901', tier: 'VIP' }],
};
const text = h => h.replace(/<[^>]+>/g, '|').split('|').map(x => x.trim()).filter(Boolean);
for (const [nm, data] of [['có dữ liệu', DATA], ['không có Renew', Object.assign({}, DATA, { cskhData: {} })]]) {
  const run = (src, frame) => { const c = mk(src, frame, data), w = { innerHTML: '' }; c.renderSalesReportTabI_(w); return w.innerHTML; };
  let a, b0, b;
  try { a = run(old, false); b0 = run(cur, false); b = run(cur, true); } catch (e) { fail++; console.log('FAIL I "' + nm + '": lỗi chạy — ' + e.message); continue; }
  t(a === b0, 'I "' + nm + '": thiếu js/76 → HTML y hệt bản cũ');
  const miss = text(a).filter(x => !text(b).includes(x));
  t(!miss.length, 'I "' + nm + '": qua khuôn đủ chữ/số bản cũ' + (miss.length ? ' — THIẾU: ' + miss.join(' | ') : ''));
  t(b.indexOf('data-rf="I"') >= 0 && b.indexOf('id="BAR"') >= 0 && b.indexOf('id="BAR"') < b.indexOf(text(a)[text(a).length - 1] ? 'dash-table' : ''), 'I "' + nm + '": gắn data-rf, thanh lọc nằm trước nội dung');
}
if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');

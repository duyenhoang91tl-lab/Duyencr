#!/usr/bin/env node
// Test Node cho cau hinh danh sach bao cao (reportsConfig): nap NGUYEN khoi trong js/06 + _srEnsureSubAllowed_ + UI js/37.
// Chay: node tools/test-reports-config.js -> "REPORTS CONFIG TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const j06 = fs.readFileSync(path.join(__dirname, '..', 'js', '06-main-renew-sources.js'), 'utf8');
const j37 = fs.readFileSync(path.join(__dirname, '..', 'js', '37-fn-configpage.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const a = j06.indexOf('var _SR_DEFAULT_ITEMS_'), b = j06.indexOf('setTimeout(_syncReportsCfgFromGAS');
const c1 = j37.indexOf('function _cfgRptHtml_'), c2 = j37.indexOf('async function _cfgRptSave');
ok(a > 0 && b > a && c1 > 0 && c2 > c1, 'tim thay cac khoi code that');
const ctx = { loadLS: () => null, saveLS() {}, gsUrl: '', fetch: async () => ({}), _srState: { sub: 'A' }, _srIsAdmin: () => false, esc: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;') };
vm.createContext(ctx); vm.runInContext(j06.slice(a, b) + '\n' + j37.slice(c1, c2), ctx);
const run = e => vm.runInContext(e, ctx);
const names = () => run('_srItems_().map(function(i){return i[0]+(i[2]?"!":"")}).join(",")');
ok(names() === 'A,B,C,D,E,F,G,H,I,L,M', 'mac dinh: bat het (A-I, L, M)');
ok(run('_srEnsureSubAllowed_()') === false, 'mac dinh: khong ep chuyen bao cao');
ok(run('_rcApply_({ A: { enabled: false }, E: { label: "  Hoa hồng   NV " } })') === true, 'co thay doi');
ok(names() === 'A!,B,C,D,E,F,G,H,I,L,M' && run('_srItems_()[4][1]') === 'Hoa hồng NV', 'A bi an; E doi ten (gon khoang trang)');
ok(run('_srEnsureSubAllowed_()') === true && run('_srState.sub') === 'B', 'nguoi thuong dang o A (bi an) => chuyen sang bao cao bat dau tien (B)');
run('_srState.sub = "K"'); ok(run('_srEnsureSubAllowed_()') === false, 'K (con cua G) khong bi anh huong');
ctx._srIsAdmin = () => true; run('_srState.sub = "A"'); ok(run('_srEnsureSubAllowed_()') === false, 'admin khong bi ep chuyen');
ctx._srIsAdmin = () => false;
// tat het / du lieu hong => bat lai het
run('_rcApply_({ A:{enabled:false},B:{enabled:false},C:{enabled:false},D:{enabled:false},E:{enabled:false},F:{enabled:false},G:{enabled:false},H:{enabled:false},I:{enabled:false},L:{enabled:false},M:{enabled:false} })');
ok(names() === 'A,B,C,D,E,F,G,H,I,L,M', 'tat het => coi la hong, bat lai het');
run('_rcApply_("rac")'); ok(names() === 'A,B,C,D,E,F,G,H,I,L,M', 'chuoi rac => mac dinh');
run('_rcApply_({ ZZ: { enabled: false }, B: 5, C: { enabled: true, label: "" } })'); ok(names() === 'A,B,C,D,E,F,G,H,I,L,M' && run('JSON.stringify(REPORTS_CFG)') === '{}', 'ma la / sai kieu / dong mac dinh khong luu');
// UI
run('_rcApply_({ D: { enabled: false, label: "Sale ngoài" } })');
const h = run('_cfgRptHtml_()');
ok(/id="cfg-rpt-on-D"(?! checked)[^>]*>/.test(h) && !/cfg-rpt-on-D" checked/.test(h) && /cfg-rpt-on-A" checked/.test(h) && h.includes('value="Sale ngoài"'), 'UI: D khong tick + ten moi; A tick');
console.log('REPORTS CONFIG TESTS PASSED');

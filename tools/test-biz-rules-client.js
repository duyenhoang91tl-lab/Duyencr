#!/usr/bin/env node
// Test Node cho phia CLIENT cua bizRules: nap NGUYEN doan code that trong js/06 (_bizApply_, _commThrLabel_) va _computeCommissionData_ (js/01).
// Chay: node tools/test-biz-rules-client.js -> "BIZ RULES CLIENT TESTS PASSED". Khong can trinh duyet.
const fs = require('fs'), vm = require('vm'), path = require('path');
const j06 = fs.readFileSync(path.join(__dirname, '..', 'js', '06-main-renew-sources.js'), 'utf8');
const j01 = fs.readFileSync(path.join(__dirname, '..', 'js', '01-fn-splitmulti.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const a = j06.indexOf('let COMMISSION_THRESHOLD'), b = j06.indexOf('setTimeout(_syncBizRulesFromGAS');
ok(a > 0 && b > a, 'tim thay khoi bizRules trong js/06');
const fa = j01.indexOf('function _computeCommissionData_('), fb = j01.indexOf('// Build <option> cho 1 trường tự tạo');
ok(fa > 0 && fb > fa, 'tim thay _computeCommissionData_ trong js/01');
const ctx = { loadLS: () => null, saveLS() {}, gsUrl: '', fetch: async () => ({}), _channelCommissionRate_: () => null,
  _resolveCommissionRate_: () => ({ above15: 2, below15: 1, sourceAbove15: 'x', sourceBelow15: 'x' }), splitMulti_: (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean) };
vm.createContext(ctx);
vm.runInContext(j06.slice(a, b) + '\n' + j01.match(/function isNumTagSale_\(x\)\{[^\n]*\}/)[0] + '\n' + j01.slice(fa, fb), ctx);   // isNumTagSale_: loai STT Pancake
const run = e => vm.runInContext(e, ctx);
const orders = [{ giaTriDon: 16000000, saleBan: 'An' }, { giaTriDon: 12000000, saleBan: 'An' }, { giaTriDon: 25000000, saleBan: 'An' }];
const comm = () => { ctx.__o = orders; return run('_computeCommissionData_(__o)'); };

// mac dinh = cu
ok(run('COMMISSION_THRESHOLD') === 15000000 && run('_commThrLabel_()') === '15tr', 'mac dinh 15tr');
let c = comm(); ok(c.totalOrdersAbove15 === 2 && c.totalOrdersBelow15 === 1 && c.threshold === 15000000, 'mac dinh: 2 don >=15tr, 1 don <15tr');
// doi nguong => cach phan loai doi theo, nhan doi theo
ok(run('_bizApply_({ commissionThreshold: 20000000 })') === true, '_bizApply_ bao co thay doi');
c = comm(); ok(c.totalOrdersAbove15 === 1 && c.totalOrdersBelow15 === 2 && c.threshold === 20000000, 'nguong 20tr: chi don 25tr o tren nguong');
ok(run('_commThrLabel_()') === '20tr', 'nhan 20tr');
run('_bizApply_({ commissionThreshold: 12500000 })'); ok(run('_commThrLabel_()') === '12,5tr', 'nhan 12,5tr (dau phay VN)');
// du lieu hong => mac dinh, khong nem loi
run("_bizApply_('rac')"); ok(run('COMMISSION_THRESHOLD') === 15000000, 'chuoi rac => mac dinh');
run('_bizApply_({ commissionThreshold: -1, quayRatio: 9, posExcludedStatuses: 5 })');
ok(run('COMMISSION_THRESHOLD') === 15000000 && run('BIZ_RULES.quayRatio') === 0.3 && run('BIZ_RULES.posExcludedStatuses.length') === 4, 'sai kieu/ngoai khoang => mac dinh');
ok(run("_bizApply_({ posExcludedStatuses: [], baseExcludedStatuses: ['  A  ', 'a', 'B'] }), BIZ_RULES.posExcludedStatuses.length") === 0 && run('BIZ_RULES.baseExcludedStatuses.join("|")') === 'A|B', 'mang rong hop le; cat khoang trang + bo trung');
console.log('BIZ RULES CLIENT TESTS PASSED');

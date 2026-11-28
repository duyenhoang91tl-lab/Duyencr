#!/usr/bin/env node
// Test: "+ Thêm đơn hàng" ở hồ sơ khách mở màn ➕ Tạo đơn thật có sẵn SĐT (js/99-g). Chạy: node tools/test-order-from-profile.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const log = [];
const ctx = { console, document: { querySelector: () => ({ click: () => log.push('tabclick') }) }, careLeads: { '0966238929': { cs: 'x' } },
  closeDp: () => log.push('closeDp'), switchTab: () => log.push('switchTab'),
  _co: { phone: '', source: '' }, _coNew() { log.push('new'); ctx._co = { phone: '', source: '' }; }, _coRender: () => log.push('render'),
  _coFillCustomer: () => log.push('fill'), _coLoyLoad: () => log.push('loy') };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', '99-g-order-from-profile.js'), 'utf8'), ctx);
ok(ctx._coOpenFromProfile('0966 238.929') === true, 'tra true');
ok(ctx._co.phone === '0966238929', 'SDT chi giu chu so: ' + ctx._co.phone);
ok(ctx._co.source === 'Chăm sóc', 'khach nguon Cham soc -> dien san nguon');
ok(log.join() === 'closeDp,tabclick,new,render,fill,loy', 'thu tu: dong ho so -> sang tab -> don trong -> dien SDT/ten/diem: ' + log.join());
const c2 = vm.createContext({ console, document: {}, closeDp() {} }); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', '99-g-order-from-profile.js'), 'utf8'), c2);
ok(c2._coOpenFromProfile('0966238929') === false, 'thieu js/99-d -> false (nut roi ve form cu)');
console.log('ALL ORDER-FROM-PROFILE TESTS PASSED');

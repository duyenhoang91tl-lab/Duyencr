#!/usr/bin/env node
// Test: bang "Theo Sale" gan nhan "Tong luot don theo sale" + ghi chu (don ban chung tinh cho tung sale), con cac bang khac van "Tong so don".
const fs = require('fs'), vm = require('vm'), path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const s10 = read('js/10-fn-pkkpipct.js'.replace('js/', '')), s34 = read('34-pro-charts.js');
function mk(pro) {
  const ctx = { esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), fmt: (n) => String(Math.round(n)), _srMoney: (n) => Math.round(n) + 'đ',
    _SR_CHART_COLORS: ['#111'], _PRO_CHART_COLORS: ['#222'], document: { documentElement: { classList: { contains: () => pro } } } };
  vm.createContext(ctx);
  vm.runInContext(grab(s34, '_proNum_') + '\n' + grab(s34, '_proKpiStrip_') + '\n' + grab(s10, '_srChartSvg'), ctx);
  return ctx;
}
const rows = [{ name: 'A', giaTri: 100, orders: 5 }, { name: 'B', giaTri: 50, orders: 3 }];
const HINT = { ordersLabel: 'Tổng lượt đơn theo sale', ordersHint: 'Đơn bán chung tính cho từng sale' };
for (const pro of [true, false]) {
  const C = mk(pro);
  const withHint = C._srChartSvg(rows, 'name', 'giaTri', 'pie', true, 'orders', HINT);
  ok(/Tổng lượt đơn theo sale/i.test(withHint) || /TỔNG LƯỢT ĐƠN THEO SALE/.test(withHint), (pro ? 'PRO' : 'cu') + ': co nhan moi');
  ok(!/Tổng số đơn|TỔNG SỐ ĐƠN/.test(withHint), (pro ? 'PRO' : 'cu') + ': khong con nhan cu o bang Theo Sale');
  ok(/Đơn bán chung tính cho từng sale/.test(withHint), (pro ? 'PRO' : 'cu') + ': co ghi chu');
  ok(/8/.test(withHint), 'tong luot don = 8 (5+3)');
  const plain = C._srChartSvg(rows, 'name', 'giaTri', 'pie', true, 'orders');
  ok(/Tổng số đơn|TỔNG SỐ ĐƠN/.test(plain) && !/ℹ️/.test(plain), (pro ? 'PRO' : 'cu') + ': bang khac (kenh/MKT) giu nhan "Tong so don", khong ghi chu');
}
console.log('ALL SR SALE LABEL TESTS PASSED');

// Test _srFetch: loi may chu cua bao cao salesReport* phai bao thang (khong ve toan so 0). Chay: node tools/test-srfetch-error.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js/10-fn-pkkpipct.js'), 'utf8');
const i = src.indexOf('async function _srFetch(action, params){'), j = src.indexOf('// Dung chung cho MOI man hinh bao cao');
let reply; const ctx = { gsUrl: 'https://gs/exec', _srState: {}, AbortController, setTimeout, clearTimeout, encodeURIComponent, fetch: async () => ({ ok: true, text: async () => reply }) };
vm.createContext(ctx); vm.runInContext(src.slice(i, j), ctx);
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
(async () => {
  reply = JSON.stringify({ error: 'Can dang nhap', code: 'AUTH' });
  let r = await ctx._srFetch('salesReportA', {}); ok(r === null && /Máy chủ báo lỗi: Can dang nhap \[AUTH\]/.test(ctx._srState.lastFetchError) && /đăng nhập lại/.test(ctx._srState.lastFetchError), 'salesReportA tra loi -> null + bao loi ro');
  reply = JSON.stringify({ error: 'Loi GAS x' }); r = await ctx._srFetch('salesReportB', {}); ok(r === null && /Loi GAS x/.test(ctx._srState.lastFetchError), 'salesReportB cung bao loi');
  reply = JSON.stringify({ totalOrders: 3 }); r = await ctx._srFetch('salesReportA', {}); ok(r && r.totalOrders === 3 && !ctx._srState.lastFetchError, 'du lieu binh thuong khong doi');
  reply = JSON.stringify({ error: 'x' }); r = await ctx._srFetch('customers', {}); ok(r && r.error === 'x', 'action KHONG phai bao cao: giu nguyen hanh vi cu');
  console.log('ALL SRFETCH ERROR TESTS PASSED');
})();

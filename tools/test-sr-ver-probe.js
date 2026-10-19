// Test khung "0 don" tu hoi phien ban backend (js/11 _srZeroDiagA_). Chay: node tools/test-sr-ver-probe.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js/11-fn-srload.js'), 'utf8');
const i = src.indexOf('function _srZeroDiagA_(d){'), j = src.indexOf('function _srRenderA(d){');
const el = { textContent: '' }; let reply = '{"ver":"v13.55-board-bodem"}', url = '';
const ctx = { gsUrl: 'https://worker.dev', GAS_URL_DIRECT: 'https://script.google.com/x/exec', Date, String, JSON, setTimeout: f => f(),
  document: { getElementById: id => id === 'sr-ver-probe' ? el : null }, e_: x => x,
  fetch: u => { url = u; return Promise.resolve({ text: () => Promise.resolve(reply) }); } };
vm.createContext(ctx); vm.runInContext(src.slice(i, j), ctx);
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
(async () => {
  let h = ctx._srZeroDiagA_({ totalOrders: 0 }); await new Promise(r => setTimeout(r, 5));
  ok(/không trả phần chẩn đoán/.test(h) && /sr-ver-probe/.test(h), 'thieu diag -> khung canh bao + cho hien phien ban');
  ok(/action=count/.test(url) && /v13\.55-board-bodem/.test(el.textContent) && /CHƯA phải bản mới/.test(el.textContent) && /Worker cache/.test(el.textContent), 'hien ver cu + qua Worker: ' + el.textContent);
  reply = '{"ver":"v13.56-diag-a"}'; ctx.gsUrl = ctx.GAS_URL_DIRECT; ctx._srZeroDiagA_({ totalOrders: 0 }); await new Promise(r => setTimeout(r, 5));
  ok(/ĐÃ là bản mới/.test(el.textContent) && /THẲNG Apps Script/.test(el.textContent), 'ver moi + goi thang');
  reply = '<html><body>Rất tiếc, không thể mở</body></html>'; ctx._srZeroDiagA_({ totalOrders: 0 }); await new Promise(r => setTimeout(r, 5));
  ok(/Không đọc được phiên bản/.test(el.textContent) && /Rất tiếc/.test(el.textContent) && !/</.test(el.textContent), 'tra HTML loi -> hien noi dung loi (bo the)');
  ok(ctx._srZeroDiagA_({ totalOrders: 5, diag: null }) === '', 'co don -> khong hien gi');
  console.log('ALL VER PROBE TESTS PASSED');
})();

#!/usr/bin/env node
// Test hộp thoại thống nhất (js/96) bằng jsdom. Chạy: node tools/test-ui-dialogs.js  (cần: npm i --no-save jsdom@24)
const fs = require('fs'), path = require('path'); const { JSDOM } = require('jsdom');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(path.join(__dirname, '../js/96-ui-dialogs.js'), 'utf8');
function mk(html, ls) { const d = new JSDOM(html || '<body></body>', { runScripts: 'outside-only', url: 'https://crm.test/' }); const w = d.window; w.__native = []; w.alert = m => w.__native.push(m); w.confirm = () => true; if (ls) w.localStorage.setItem('ome_native_alert', '1'); w.eval(src); return w; }
const key = (w, k) => w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));
(async () => {
  let w = mk();
  w.alert('Đã lưu xong');
  let ov = w.document.querySelector('.ui-dlg-ov');
  ok(ov && ov.textContent.includes('Đã lưu xong') && w.__native.length === 0, 'alert() hiện hộp CRM, KHÔNG gọi alert gốc');
  ok(w.document.querySelector('.ui-dlg').classList.contains('ok') && w.document.querySelector('.ui-dlg-ic').textContent === '✓', 'thông báo "Đã…" → biểu tượng ✓ xanh');
  key(w, 'Escape'); ok(!w.document.querySelector('.ui-dlg-ov'), 'Esc đóng hộp');
  w.alert('Lỗi khi xuất: timeout'); ok(w.document.querySelector('.ui-dlg').classList.contains('warn'), 'thông báo lỗi → biểu tượng ⚠ vàng'); key(w, 'Enter'); ok(!w.document.querySelector('.ui-dlg-ov'), 'Enter đóng hộp');
  w.alert('A'); w.alert('B'); ok(w.document.querySelectorAll('.ui-dlg-ov').length === 1 && w.document.querySelector('.ui-dlg-msg').textContent === 'A', 'nhiều thông báo xếp hàng: hiện A trước');
  key(w, 'Enter'); ok(w.document.querySelector('.ui-dlg-msg').textContent === 'B', 'đóng A → hiện B'); key(w, 'Escape');
  w.alert('Xem https://docs.google.com/spreadsheets/d/abc123/edit. Xong'); const a = w.document.querySelector('.ui-dlg-msg a');
  ok(a && a.href === 'https://docs.google.com/spreadsheets/d/abc123/edit' && a.rel.includes('noopener') && a.target === '_blank', 'link http(s) bấm được, bỏ dấu chấm cuối, mở tab mới an toàn'); key(w, 'Escape');
  w.alert('<img src=x onerror=window.__xss=1><b>x</b>'); ok(!w.document.querySelector('.ui-dlg-msg img') && !w.__xss && w.document.querySelector('.ui-dlg-msg').textContent.includes('<img'), 'nội dung có HTML KHÔNG bị chèn như HTML (an toàn XSS)'); key(w, 'Escape');
  w.alert('x'); w.document.querySelector('.ui-dlg-ov').dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true })); ok(!w.document.querySelector('.ui-dlg-ov'), 'bấm nền đóng hộp');
  let resolved = false; w.uiAlert('p').then(() => resolved = true); w.document.querySelector('.ui-dlg-btn').click(); await new Promise(r => setTimeout(r, 5)); ok(resolved, 'uiAlert trả Promise, resolve khi đóng');
  w.alert(undefined); ok(w.document.querySelector('.ui-dlg-ov') && w.document.querySelector('.ui-dlg-msg').textContent === '', 'alert(undefined) không lỗi'); key(w, 'Escape');
  w.alert('a'); w.alert('b'); w.eval('1'); ok(w.document.querySelectorAll('#ui-dlg-css').length === 1, 'style chỉ chèn 1 lần'); key(w, 'Escape'); key(w, 'Escape');

  // --- uiConfirm (2026-11-26) ---
  w = mk(); let res = null; w.uiConfirm('Lưu thay đổi?').then(v => res = v);
  ok(w.document.querySelectorAll('.ui-dlg-btn').length === 2 && w.document.querySelector('.ui-dlg-btn.ghost').textContent === 'Hủy' && w.document.querySelector('.ui-dlg-btn:not(.ghost)').textContent === 'Đồng ý', 'uiConfirm: 2 nút Hủy / Đồng ý');
  w.document.querySelector('.ui-dlg-btn:not(.ghost)').click(); await new Promise(r => setTimeout(r, 5)); ok(res === true, 'bấm Đồng ý → true');
  w.uiConfirm('Lưu?').then(v => res = v); w.document.querySelector('.ui-dlg-btn.ghost').click(); await new Promise(r => setTimeout(r, 5)); ok(res === false, 'bấm Hủy → false');
  w.uiConfirm('Lưu?').then(v => res = v); key(w, 'Escape'); await new Promise(r => setTimeout(r, 5)); ok(res === false && !w.document.querySelector('.ui-dlg-ov'), 'Esc → false');
  w.uiConfirm('Lưu?').then(v => res = v); key(w, 'Enter'); await new Promise(r => setTimeout(r, 5)); ok(res === true, 'Enter (việc thường) → Đồng ý');
  w.uiConfirm('Lưu?').then(v => res = v); w.document.querySelector('.ui-dlg-ov').dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true })); await new Promise(r => setTimeout(r, 5)); ok(res === false, 'bấm nền → false (an toàn)');
  w.uiConfirm('Xóa khách này?').then(v => res = v); ok(w.document.querySelector('.ui-dlg-btn:not(.ghost)').classList.contains('danger') && w.document.activeElement.classList.contains('ghost'), 'việc "Xóa…": nút đỏ + tiêu điểm mặc định ở Hủy');
  key(w, 'Enter'); await new Promise(r => setTimeout(r, 5)); ok(res === false, 'Enter khi tiêu điểm ở Hủy → KHÔNG xóa nhầm');
  w.uiConfirm('Ép chuyển?', { danger: false, ok: 'Ép', cancel: 'Thôi' }).then(v => res = v); ok(w.document.querySelector('.ui-dlg-btn:not(.ghost)').textContent === 'Ép' && w.document.querySelector('.ui-dlg-btn.ghost').textContent === 'Thôi', 'tùy chỉnh chữ nút');
  w.document.querySelector('.ui-dlg-btn.ghost').click(); await new Promise(r => setTimeout(r, 5));
  let order = []; w.uiConfirm('A?').then(v => order.push('A' + v)); w.uiConfirm('B?').then(v => order.push('B' + v)); w.document.querySelector('.ui-dlg-btn:not(.ghost)').click(); await new Promise(r => setTimeout(r, 5));
  ok(w.document.querySelector('.ui-dlg-msg').textContent === 'B?', 'nhiều câu hỏi xếp hàng'); w.document.querySelector('.ui-dlg-btn.ghost').click(); await new Promise(r => setTimeout(r, 5)); ok(order.join() === 'Atrue,Bfalse', 'trả đúng kết quả từng câu theo thứ tự');
  w = mk('<body></body>', true); ok(await w.uiConfirm('x') === true && !w.document.querySelector('.ui-dlg-ov'), 'ome_native_alert=1 → dùng confirm gốc');
  // công tắc lui về cũ + rơi về gốc khi chưa có body
  w = mk('<body></body>', true); w.alert('native'); ok(!w.document.querySelector('.ui-dlg-ov'), 'ome_native_alert=1 → không dùng hộp CRM');
  // lúc script nạp, alert gốc đã được bind → kiểm bằng nativeAlert
  w = mk('<body></body>'); ok(typeof w.nativeAlert === 'function' && typeof w.uiAlert === 'function', 'xuất uiAlert + nativeAlert');
  const d2 = new JSDOM('<html></html>', { runScripts: 'outside-only' }); const w2 = d2.window; w2.__n = []; w2.alert = m => w2.__n.push(m); w2.document.body && w2.document.body.remove(); w2.eval(src); w2.alert('sớm'); ok(w2.__n.includes('sớm') || w2.document.querySelector('.ui-dlg-ov'), 'chưa có body → rơi về alert gốc hoặc hiện hộp, không mất thông báo');
  console.log(bad ? bad + ' LỖI' : 'ĐẠT'); process.exit(bad ? 1 : 0);
})();

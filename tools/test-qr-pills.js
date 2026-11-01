#!/usr/bin/env node
// Test L2 — thanh chọn nhanh ngày dạng viên thuốc (js/56-fn-qrpills.js). Chạy: node tools/test-qr-pills.js -> "ALL QR PILLS TESTS PASSED". Phần DOM cần jsdom.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const M = require(path.join(ROOT, 'js', '56-fn-qrpills.js'));
const H = M.qrPillsHtml_;

// ===== HTML =====
let h = H('custom', '_ovQuick(this.value)');
ok(/class="qr-pills"/.test(h) && (h.match(/<button/g) || []).length === 3, '3 nut viên thuốc');
ok(['today', 'thisWeek', 'thisMonth'].every(k => h.includes('value="' + k + '"')) && h.includes('>Hôm nay<') && h.includes('>Tuần này<') && h.includes('>Tháng này<'), 'Hôm nay / Tuần này / Tháng này');
ok(!/qr-b on/.test(h) && !/qr-more on/.test(h), "mốc 'custom' -> không nút nào sáng");
ok(h.includes('onclick="qrPick_(this);_ovQuick(this.value)"'), 'nút gọi qrPick_ rồi đúng biểu thức của màn');
const sel = h.slice(h.indexOf('<select'));
ok(sel.includes('onchange="if(!this.value)return;qrPick_(this);_ovQuick(this.value)"'), 'ô Khác gọi cùng biểu thức, bỏ qua lựa chọn rỗng');
const opts = (sel.match(/<option value="[^"]*"/g) || []).map(s => s.slice(15, -1));
ok(opts.join() === ',yesterday,lastWeek,lastMonth,thisQuarter,lastQuarter,thisYear,lastYear,custom', 'ô Khác chứa các mốc còn lại (không lặp 3 mốc chính): ' + opts.join());
ok(/<option value="" selected>Khác<\/option>/.test(h) && !h.includes('Khác ▾'), 'mặc định hiện "Khác" (không tự thêm mũi tên: trình duyệt đã có mũi tên của ô chọn)');
h = H('thisWeek', 'f(this.value)'); ok(/<button[^>]*class="qr-b on"[^>]*value="thisWeek"/.test(h) && (h.match(/qr-b on/g) || []).length === 1, 'chọn Tuần này -> chỉ nút đó sáng');
h = H('lastMonth', 'f(this.value)'); ok(!/qr-b on/.test(h) && /qr-more on/.test(h) && /<option value="lastMonth" selected>/.test(h), 'chọn mốc ở ô Khác -> ô Khác sáng + chọn đúng mốc');
h = H('', 'f(this.value)'); ok(!/qr-b on/.test(h), 'rỗng = không mốc');
h = H('custom', 'f("a\'b",this.value)&x<y'); ok(!/onclick="[^"]*"[^>]*"[^>]*>/.test(h.replace(/&quot;/g, '')) && h.includes('f(&quot;a\'b&quot;,this.value)&amp;x&lt;y'), 'biểu thức được thoát đúng trong thuộc tính');
ok(H('custom', 'g(this.value)', { style: 'margin-left:6px' }).includes('style="margin-left:6px"'), 'style thêm cho khung');

// ===== CSS =====
const css = fs.readFileSync(path.join(ROOT, 'css', '14-qrpills.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
ok(css.split('}').map(r => r.split('{')[0].trim()).filter(Boolean).every(s => s.split(',').every(x => x.trim().startsWith('.qr-pills'))), 'mọi selector CSS nằm trong .qr-pills');
ok(/var\(--surface/.test(css) && /var\(--blue/.test(css), 'dùng biến màu chung (theo chế độ tối)');

// ===== đã gắn vào các màn =====
const j31 = fs.readFileSync(path.join(ROOT, 'js', '31-fn-orgoverview.js'), 'utf8'), j30 = fs.readFileSync(path.join(ROOT, 'js', '30-fn-teamanalysis.js'), 'utf8'), idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(/qrPillsHtml_\('custom', "_ovQuick\(this\.value\)"\)/.test(j31) && /qrPillsHtml_\('custom', "_taQuick\(this\.value\)"\)/.test(j30), 'Tổng quan KQKD + AI team dùng viên thuốc');
ok(/typeof qrPillsHtml_ === 'function'/.test(j31) && /typeof qrPillsHtml_ === 'function'/.test(j30), 'có phương án dự phòng về ô chọn cũ');
ok(idx.includes('css/14-qrpills.css') && idx.includes('js/56-fn-qrpills.js'), 'index.html nạp CSS + JS');

let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('(bỏ qua phần DOM: chưa cài jsdom)'); console.log('ALL QR PILLS TESTS PASSED (chỉ logic + CSS)'); process.exit(0); }
const src = fs.readFileSync(path.join(ROOT, 'js', '56-fn-qrpills.js'), 'utf8');
const dom = new JSDOM('<body><div id="host"></div></body>', { url: 'http://localhost/', runScripts: 'dangerously' });
const w = dom.window; w.__calls = []; w.f = v => w.__calls.push(v); w.eval(src);
const mount = (key) => { w.document.getElementById('host').innerHTML = w.qrPillsHtml_(key, 'f(this.value)'); return w.document.querySelector('.qr-pills'); };
let g = mount('custom'); const btns = () => Array.from(g.querySelectorAll('button')), more = () => g.querySelector('select');
btns()[0].click(); ok(w.__calls.pop() === 'today' && btns()[0].classList.contains('on') && btns().filter(b => b.classList.contains('on')).length === 1, 'bấm Hôm nay: gọi f("today"), chỉ nút đó sáng');
btns()[2].click(); ok(w.__calls.pop() === 'thisMonth' && btns()[2].classList.contains('on') && !btns()[0].classList.contains('on'), 'bấm Tháng này: chuyển sáng sang nút đó');
more().value = 'lastWeek'; more().dispatchEvent(new w.Event('change')); ok(w.__calls.pop() === 'lastWeek' && more().classList.contains('on') && btns().every(b => !b.classList.contains('on')), 'chọn ở ô Khác: gọi đúng mốc, tắt các nút, ô Khác sáng');
btns()[1].click(); ok(w.__calls.pop() === 'thisWeek' && more().value === '' && !more().classList.contains('on'), 'bấm lại nút: ô Khác trở về "Khác" và hết sáng');
const n0 = w.__calls.length; more().value = ''; more().dispatchEvent(new w.Event('change')); ok(w.__calls.length === n0, 'chọn dòng rỗng "Khác": không gọi hàm');
w.qrPick_(null); w.qrPick_(w.document.body); ok(true, 'qrPick_ với phần tử ngoài nhóm không lỗi');
console.log('ALL QR PILLS TESTS PASSED');

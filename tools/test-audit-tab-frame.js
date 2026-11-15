#!/usr/bin/env node
// R9b — tab "🧾 Nhật ký" vẽ qua khuôn uiReportFrame_ mà BẢNG/số liệu/nút Xuất không đổi. Chạy: node tools/test-audit-tab-frame.js
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
const text = h => h.replace(/<[^>]+>/g, '|').split('|').map(x => x.trim()).filter(Boolean);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fn(src, name) {   // lấy nguyên hàm cấp cao theo tên (khớp ngoặc nhọn)
  const i = src.indexOf('function ' + name + '('); if (i < 0) return '';
  let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  return '';
}
const NAMES = ['_auditActClass', '_auditActLabel', '_auditStats_', 'renderAuditTab'];
function load(src, withFrame, log) {
  const wrap = { innerHTML: '' };
  const ctx = { console, esc, fmt: n => Number(n || 0).toLocaleString('en-US'), auditLog: log, location: { search: '' },
    document: { readyState: 'complete', addEventListener() {}, getElementById: id => id === 'audit-wrap' ? wrap : null } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((withFrame ? R('js/68-ui-kit.js') + '\n' + R('js/76-report-frame.js') + '\n' : '') + NAMES.map(n => fn(src, n)).join('\n'), ctx);
  ctx.wrap = wrap; return ctx;
}
const NEW = R('js/10-fn-pkkpipct.js');
let OLD = ''; try { OLD = cp.execSync('git show 7d1d3e5:js/10-fn-pkkpipct.js', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 27 }).toString(); } catch (e) { OLD = ''; }

const now = new Date(), iso = d => d.toISOString();
const yesterday = new Date(now.getTime() - 36 * 3600 * 1000);
const LOG = [
  { timestamp: iso(now), user: 'Hà', action: 'status', phone: '0901', oldValue: 'A', newValue: 'B' },
  { timestamp: iso(now), user: 'Admin', action: 'config:setting:roleConfig', phone: '', oldValue: '{"x":1}', newValue: '<b>y</b>' },
  { timestamp: iso(yesterday), user: 'Minh', action: 'cs', phone: '0902', oldValue: '', newValue: 'Hà' },
  { timestamp: '', user: '', action: 'del', phone: '0903', oldValue: '', newValue: '' },
  { timestamp: 'không phải ngày', user: 'Hà', action: 'config:users', phone: '', oldValue: '', newValue: 'x' }
];
const many = []; for (let i = 0; i < 700; i++) many.push({ timestamp: iso(now), user: 'u' + (i % 7), action: 'status', phone: '09' + i, oldValue: 'o' + i, newValue: 'n' + i });

if (OLD) {
  for (const [k, log] of [['có dữ liệu', LOG], ['rỗng', []], ['700 dòng', many]]) {
    const a = load(NEW, false, log), b = load(OLD, false, log); a.renderAuditTab(); b.renderAuditTab();
    t(a.wrap.innerHTML === b.wrap.innerHTML && a.wrap.innerHTML.length > 200, 'thiếu js/76: HTML y hệt bản cũ từng ký tự (' + k + ', ' + a.wrap.innerHTML.length + ' ký tự)');
  }
} else console.log('skip so với bản cũ (không có commit 7d1d3e5 trong bản clone này)');

// có khuôn: bảng giữ nguyên, thêm thẻ số + nút Xuất
for (const [k, log] of [['có dữ liệu', LOG], ['rỗng', []], ['700 dòng', many]]) {
  const A = load(NEW, true, log), B = load(NEW, false, log); A.renderAuditTab(); B.renderAuditTab();
  const tbl = h => (h.match(/<table class="audit-table">[\s\S]*<\/table>/) || [''])[0];
  t(tbl(A.wrap.innerHTML) === tbl(B.wrap.innerHTML) && tbl(A.wrap.innerHTML).length > 100, 'có khuôn: bảng nhật ký GIỮ NGUYÊN từng ký tự (' + k + ')');
  t(/data-rf="AUDIT"/.test(A.wrap.innerHTML) && /onclick="exportAudit\(\)"/.test(A.wrap.innerHTML), 'có khuôn: vẽ qua khuôn + nút Xuất CSV gọi exportAudit() (' + k + ')');
  const body = (A.wrap.innerHTML.match(/<tbody>([\s\S]*)<\/tbody>/) || [, ''])[1], rows = (body.match(/<tr>/g) || []).length;
  t(rows === (log.length ? Math.min(500, log.length) : 1), 'có khuôn: số dòng thân bảng đúng (' + rows + ' dòng; tối đa 500; rỗng = 1 dòng báo trống)');
}
// thẻ số
const S = load(NEW, true, LOG), st = S._auditStats_(), by = {}; st.forEach(x => by[x.label] = x);
t(by['Tổng thao tác'].value === '5', 'thẻ số: Tổng thao tác = 5');
t(by['Hôm nay'].value === '2' && by['Hôm nay'].tone === 'success', 'thẻ số: Hôm nay = 2 (bỏ dòng hôm qua, dòng rỗng và dòng ngày hỏng)');
t(by['Đổi cấu hình'].value === '2', 'thẻ số: Đổi cấu hình = 2 (config:setting:roleConfig + config:users)');
t(by['Người thao tác'].value === '3', 'thẻ số: Người thao tác = 3 (Hà, Admin, Minh; bỏ dòng không có người)');
const E = load(NEW, true, []).wrap; const e0 = load(NEW, true, []); e0.renderAuditTab();
t(/Chưa có thao tác nào được ghi/.test(e0.wrap.innerHTML) && /Tổng thao tác/.test(e0.wrap.innerHTML), 'rỗng: vẫn có thẻ số và dòng "Chưa có thao tác nào được ghi"');
const X = load(NEW, true, LOG); X.renderAuditTab();
t(!/<b>y<\/b>/.test(X.wrap.innerHTML) && /&lt;b&gt;y&lt;\/b&gt;/.test(X.wrap.innerHTML), 'giá trị có HTML vẫn được escape trong bảng');
const noLog = load(NEW, true, null); noLog.auditLog = undefined;
try { vm.runInContext('_auditStats_()', noLog); t(true, 'auditLog chưa có → _auditStats_ không lỗi'); } catch (e) { t(false, 'auditLog chưa có → _auditStats_ lỗi: ' + e.message); }

console.log(fail ? '\n' + fail + ' LỖI' : '\nĐẠT HẾT'); process.exit(fail ? 1 : 0);

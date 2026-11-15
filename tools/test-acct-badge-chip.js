#!/usr/bin/env node
// R9b — huy hiệu vai trò / "đã khoá" ở hộp thoại 🔑 Tài khoản vẽ bằng uiChip_ (chỉ HIỂN THỊ). Chạy: node tools/test-acct-badge-chip.js
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'); const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fn(src, name) { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; }
const roleBase = r => ({ leader: 'leader', manager: 'manager', viewer: 'viewer' }[r] || (r === 'admin' ? 'admin' : 'cs'));
function load(src, withKit) {
  const ctx = { console, esc, _roleBaseOf: roleBase, _roleLabel: r => 'Vai ' + r, document: { readyState: 'complete', addEventListener() {}, getElementById: () => null }, location: { search: '' } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((withKit ? R('js/68-ui-kit.js') + '\n' : '') + ['_acctBadgeHtml_', '_acctLockHtml_'].map(n => fn(src, n)).join('\n'), ctx); return ctx;
}
const NEW = R('js/15-fn-hidelogin.js');
const A = load(NEW, true), B = load(NEW, false);
const cls = a => a.role === 'admin' ? 'vip-bg' : ((roleBase(a.role) === 'leader' || roleBase(a.role) === 'manager' || roleBase(a.role) === 'viewer') ? 'blue-bg' : 'green-bg');
const col = a => a.role === 'admin' ? 'var(--vip)' : ((roleBase(a.role) === 'leader' || roleBase(a.role) === 'manager' || roleBase(a.role) === 'viewer') ? 'var(--blue)' : 'var(--green)');
const tone = r => (h => (h.match(/ui-tone-(\w+)/) || [])[1])(A._acctBadgeHtml_({ role: r }, '', ''));
t(tone('admin') === 'brand', 'admin → brand');
['leader', 'manager', 'viewer'].forEach(r => t(tone(r) === 'info', r + ' → info'));
['cs', 'sale', ''].forEach(r => t(tone(r) === 'success', 'vai thường "' + r + '" → success'));
t(/ui-chip/.test(A._acctBadgeHtml_({ role: 'admin' }, '', '')) && />Vai admin</.test(A._acctBadgeHtml_({ role: 'admin' }, '', '')), 'chip có đúng nhãn vai');
// thiếu js/68 → HTML cũ từng ký tự
const oldBadge = a => '<span class="ar-badge" style="background:var(--' + cls(a) + ');color:' + col(a) + '">' + 'Vai ' + a.role + '</span>';
['admin', 'leader', 'manager', 'viewer', 'cs'].forEach(r => { const a = { role: r }; t(B._acctBadgeHtml_(a, cls(a), col(a)) === oldBadge(a), 'thiếu js/68: huy hiệu "' + r + '" y hệt bản cũ'); });
t(B._acctLockHtml_({ active: false }) === '<span style="color:var(--red);font-size:10px">(đã khoá)</span>', 'thiếu js/68: "(đã khoá)" y hệt bản cũ');
t(B._acctLockHtml_({ active: true }) === '' && B._acctLockHtml_({}) === '' && A._acctLockHtml_({ active: true }) === '', 'tài khoản đang mở → không có nhãn khoá (cả 2 chế độ)');
t(/ui-tone-danger/.test(A._acctLockHtml_({ active: false })), 'có js/68: khoá → chip danger');
// không đụng logic ghi
['_acctSave', 'addAccount', 'deleteAccount', 'resetPassword', 'toggleAcctActive'].forEach(n => { if (NEW.indexOf('function ' + n + '(') >= 0) t(true, 'hàm ' + n + ' vẫn còn'); });
let old = ''; try { old = cp.execSync('git show HEAD:js/15-fn-hidelogin.js', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 27 }).toString(); } catch (e) {}
if (old && old !== NEW) { const g = s => ['_acctSave', 'addAccount', 'deleteAccount', 'resetPassword', 'toggleAcctActive'].map(n => fn(s, n)).join('\n'); t(g(old) === g(NEW), 'thân 5 hàm ghi tài khoản KHÔNG đổi so với HEAD'); }
console.log(fail ? '\n' + fail + ' LỖI' : '\nTẤT CẢ ĐẠT'); process.exit(fail ? 1 : 0);

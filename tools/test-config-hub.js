#!/usr/bin/env node
// R9a — trang "⚙ Cấu hình" vẽ qua khung chung (js/76) + trung tâm lối tắt gom nhóm (js/78), SỐ LIỆU/ô nhập/nút LƯU không đổi.
// Chạy: node tools/test-config-hub.js
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
const text = h => h.replace(/<[^>]+>/g, '|').split('|').map(x => x.trim()).filter(Boolean);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── 1) hàm thuần js/78 ──
const H = require(path.join(ROOT, 'js/78-settings-hub.js'));
t(H.uiSettingsHub_([]) === '' && H.uiSettingsHub_(null) === '', 'hub: không có nhóm → chuỗi rỗng (không vẽ khung trống)');
t(H.uiSettingsHub_([{ title: 'A', items: [] }, { title: 'B', items: [{ key: '', label: 'x' }] }]) === '', 'hub: nhóm không có mục hợp lệ bị bỏ');
const hx = H.uiSettingsHub_([{ icon: '<i>', title: '<b>T</b>', desc: 'd&d', items: [{ key: "a'b", label: '<script>x</script>' }, { key: 'clear', label: 'Xoá', tone: 'danger' }] }]);
t(!/<script|<b>T|<i>/.test(hx) && /&lt;script&gt;/.test(hx), 'hub: chữ icon/tiêu đề/nhãn được ESCAPE');
t(/_shRun_\('a&#39;b'\)/.test(hx), 'hub: key trong onclick được escape (không phá được dấu nháy)');
t(/sh-item is-danger" data-sh="clear"/.test(hx) && !/sh-item is-danger" data-sh="a/.test(hx), 'hub: chỉ mục tone=danger mới có class is-danger');

// ── 2) trang Cấu hình: nạp js/37 trong môi trường giả ──
function load(src, withKit, extra) {
  const wrap = { innerHTML: '' }, calls = [], toasts = [], sw = [];
  const ctx = Object.assign({ console, calls, toasts, sw, wrap, location: { search: '' },
    document: { readyState: 'complete', addEventListener() {}, getElementById: id => id === 'cfg-wrap' ? wrap : null, querySelector: () => null, createElement: () => ({}) },
    setInterval: () => 0, setTimeout: () => 0, currentUser: { role: 'admin', name: 'Duyên' }, gsUrl: 'https://x/exec',
    switchTab: function (tab) { sw.push(tab); }, esc, toast: m => toasts.push(m), saveLS() {}, hmRenderChips() {},
    BIZ_RULES: { commissionThreshold: 3000000, baseExcludedStatuses: ['Hủy'], posExcludedStatuses: ['Đã hoàn'], quayRatio: 0.3, quayKeywords: ['cửa hàng'] },
    REPORTS_CFG: { B: { enabled: false, label: '' }, C: { enabled: true, label: 'Kỳ' } },
    _SR_DEFAULT_ITEMS_: [['A', 'Base'], ['B', 'Pos'], ['C', 'So kỳ']] }, extra || {});
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((withKit ? R('js/68-ui-kit.js') + '\n' + R('js/76-report-frame.js') + '\n' + R('js/78-settings-hub.js') + '\n' : '') + src, ctx);
  return ctx;
}
const NEW = R('js/37-fn-configpage.js');
let OLD = null;
try { OLD = cp.execSync('git show 784b347:js/37-fn-configpage.js', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }).toString(); } catch (e) { OLD = null; }
function state(c, o) { vm.runInContext('_cfg.loaded=' + !!o.loaded + ';_cfg.last=' + (o.last || 0) + ';_cfg.vals={ttStageHours:24,hmCycle:30,hmIdle:7};', c); }
function render(c, o) { state(c, o || {}); vm.runInContext('_cfgRender()', c); return c.wrap.innerHTML; }

// 2a) thiếu khuôn → y hệt bản cũ từng ký tự
if (OLD) {
  for (const o of [{ loaded: false }, { loaded: true, last: 0 }, { loaded: true, last: Date.now() - 60000 }]) {
    const a = render(load(NEW, false), o), b = render(load(OLD, false), o);
    t(a === b && a.length > 1000, 'thiếu js/68+76+78: HTML y hệt bản cũ (loaded=' + o.loaded + ', last=' + (o.last ? 'có' : 'không') + ', ' + a.length + ' ký tự)');
  }
} else console.log('skip so với bản cũ (không có commit 784b347 trong bản clone này)');

// 2b) có khuôn → đủ mọi ô nhập / nút lưu / chữ của bản cũ
const kit = render(load(NEW, true), { loaded: true, last: Date.now() - 600000 });
const plain = render(load(NEW, false), { loaded: true, last: Date.now() - 600000 });
t(/data-rf="CFG"/.test(kit) && /data-sh-hub="1"/.test(kit), 'có khuôn: vẽ qua uiReportFrame_ (data-rf="CFG") + trung tâm lối tắt');
const ids = s => (s.match(/id="cfg-[^"]+"/g) || []).sort().join(',');
t(ids(kit) === ids(plain) && ids(kit).length > 100, 'có khuôn: đủ MỌI id ô nhập/nút lưu của bản cũ (' + (ids(plain).match(/cfg-/g) || []).length + ' id)');
const handlers = s => (s.match(/onclick="_cfg[A-Za-z]*Save\([^"]*\)"/g) || []).sort().join(',');
t(handlers(kit) === handlers(plain) && /_cfgSave\(\)/.test(handlers(kit)) && /_cfgBannedSave\(true\)/.test(handlers(kit)), 'có khuôn: các nút Lưu/Về mặc định gọi đúng hàm cũ');
const SHORT_OLD = ['Phòng ban', 'Tài khoản & quyền', 'Mẫu hỏi thăm sau mua', 'Trạng thái chăm sóc', 'Nhật ký', 'Lối tắt cài đặt'];
const missing = text(plain).filter(x => !text(kit).includes(x) && !SHORT_OLD.some(s => x.indexOf(s) >= 0));
t(!missing.length, 'có khuôn: mọi chữ của bản cũ (trừ nhãn lối tắt cũ) còn đủ' + (missing.length ? ' — THIẾU: ' + missing.slice(0, 5).join(' | ') : ''));
['dept', 'acct', 'futpl', 'cstatus', 'audit'].forEach(k => t(new RegExp('data-sh="' + k + '"').test(kit), 'lối tắt cũ "' + k + '" vẫn còn trong trung tâm'));
['Người dùng & quyền', 'Dữ liệu khách hàng', 'Quy trình & mẫu tin', 'Nhật ký & hệ thống', 'Giao diện & trợ giúp'].forEach(g => t(kit.indexOf(g.replace('&', '&amp;')) >= 0, 'có nhóm "' + g + '"'));

// 2c) thẻ số đầu trang
const label = (o) => { const c = load(NEW, true); state(c, o); return text(vm.runInContext('uiStatGrid_(_cfgStats_())', c)).join(' | '); };
t(/Đang tải/.test(label({ loaded: false })), 'thẻ số: chưa nạp → "Đang tải…"');
t(/Chưa chạy/.test(label({ loaded: true, last: 0 })), 'thẻ số: chưa có lần chạy → "Chưa chạy"');
t(/Đang chạy/.test(label({ loaded: true, last: Date.now() - 600000 })), 'thẻ số: 10 phút trước → "Đang chạy"');
t(/Có thể đã tắt/.test(label({ loaded: true, last: Date.now() - 3 * 3600000 })), 'thẻ số: quá 2 giờ → "Có thể đã tắt" (khớp câu giải thích cũ)');
t(/Báo cáo đang ẩn \| 1\/3/.test(label({ loaded: true, last: 1 })), 'thẻ số: đếm đúng báo cáo đang ẩn (B tắt → 1/3)');
t(/Từ cấm \| 0 từ/.test(label({ loaded: true })), 'thẻ số: từ cấm 0 từ');

// ── 3) nhóm lối tắt phủ HẾT mục rời của nhóm "⚙ Settings" ở menu trái ──
const nav = R('js/29-sidenav.js');
const stIds = (nav.match(/k:'st'[^\]]*ids:\[([^\]]*)\]/) || [])[1] || '';
const stActs = (stIds.match(/act:([a-z]+)/g) || []).map(s => s.slice(4));
const hubKeys = (() => { const c = load(NEW, true); c._SN_ACTS = {}; return vm.runInContext('_cfgHubGroups_()', c).reduce((a, g) => a.concat(g.items.map(i => i.key)), []); })();
t(stActs.length >= 12, 'đọc được danh sách mục rời của nhóm Settings (' + stActs.length + ' mục)');
const left = stActs.filter(k => hubKeys.indexOf(k) < 0);
t(!left.length, 'mọi mục act: của nhóm Settings đều có trong trung tâm lối tắt' + (left.length ? ' — CÒN RỜI: ' + left.join(', ') : ''));
t(hubKeys.indexOf('audit') >= 0, 'có lối tắt Nhật ký thay đổi (tab audit)');
const actKeys = Object.keys(JSON.parse('{' + (nav.match(/var ACTS = \{([\s\S]*?)\n  \};/) || [, ''])[1].split('\n').map(l => (l.match(/^    ([a-z]+):/) || [])[1]).filter(Boolean).map(k => '"' + k + '":1').join(',') + '}'));
const bad = hubKeys.filter(k => k !== 'audit' && actKeys.indexOf(k) < 0);
t(!bad.length, 'mọi key của trung tâm lối tắt có thật trong ACTS của menu trái' + (bad.length ? ' — KHÔNG CÓ: ' + bad.join(', ') : ''));

// ── 4) _shRun_ ──
(function () {
  let c = load(NEW, true);
  const rec = []; c.openAcctModal = function (a) { rec.push(['acct', a]); }; c.openFuTplModal = () => rec.push(['futpl']);
  let dark = false, btn = { textContent: 'x' }; c.toggleTheme = () => { dark = !dark; };
  c._SN_ACTS = { acct: { t: 'A', f: 'openAcctModal' }, futpl: { t: 'F', f: 'openFuTplModal' }, theme: { t: () => dark ? '☀ Chế độ sáng' : '🌙 Chế độ tối', f: 'toggleTheme' }, ghost: { t: 'G', f: 'khongCoHam' } };
  c.document.querySelector = s => /data-sh="theme"/.test(s) ? btn : null;
  vm.runInContext("_shRun_('acct');_shRun_('futpl')", c);
  t(rec.length === 2 && rec[0][0] === 'acct' && rec[1][0] === 'futpl', '_shRun_: gọi đúng hàm của mục (openAcctModal, openFuTplModal)');
  vm.runInContext("_shRun_('audit')", c);
  t(c.sw.indexOf('audit') >= 0, "_shRun_('audit') → mở tab audit như lối tắt cũ");
  vm.runInContext("_shRun_('dept')", c);
  t(c.sw.indexOf('overview') >= 0, "_shRun_('dept') → qua _cfgGoDept (mở Tổng quan trước) như lối tắt cũ");
  vm.runInContext("_shRun_('theme')", c);
  t(dark === true && btn.textContent === '☀ Chế độ sáng', '_shRun_(theme): bật chế độ tối rồi đổi nhãn đúng nút (không vẽ lại cả trang)');
  vm.runInContext("_shRun_('ghost');_shRun_('khongCo')", c);
  t(c.toasts.filter(m => /chưa sẵn sàng/.test(m)).length === 2, '_shRun_: hàm/mục không tồn tại → báo "Chức năng chưa sẵn sàng", không lỗi');
})();

console.log(fail ? '\n' + fail + ' LỖI' : '\nĐẠT HẾT');
process.exit(fail ? 1 : 0);

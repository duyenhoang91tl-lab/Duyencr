/* 68-ui-kit.js — BỘ THÀNH PHẦN `ui-*` (R2, HANDOFF.md "KẾ HOẠCH THIẾT KẾ LẠI TOÀN BỘ CRM"): hàm thuần uiXxx_() trả CHUỖI HTML (kiểu proXxx_) + trang mẫu ?ui=kit.
   CSS ở css/20-kit.css (khung Hoàng hôn + màu đổ nhẹ). Mọi chữ truyền vào đều được ESCAPE; chỉ tham số tên `*Html` / `attrs` được chèn nguyên (do code gọi kiểm soát).
   Test: node tools/test-ui-kit.js. Không phụ thuộc hàm nào khác của CRM. */
(function () {
  'use strict';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var TONES = { brand: 1, success: 1, warning: 1, danger: 1, info: 1, neutral: 1 };
  function tone(t) { return TONES[t] ? t : 'brand'; }

  /* R2a — Thẻ số: o = {label, value, note, delta (số % hoặc chữ), tone, icon}. delta số: >0 ▲ xanh, <0 ▼ đỏ nhạt. */
  function uiStat_(o) {
    o = o || {};
    var d = '';
    if (o.delta != null && o.delta !== '') {
      var n = Number(o.delta), isNum = isFinite(n) && String(o.delta).trim() !== '';
      d = isNum ? '<span class="ui-delta' + (n < 0 ? ' down' : '') + '">' + (n < 0 ? '▼ ' : '▲ ') + esc(Math.abs(n)) + '%</span>' : '<span class="ui-delta">' + esc(o.delta) + '</span>';
    }
    return '<div class="ui-stat ui-tone-' + tone(o.tone) + '">' +
      (o.icon ? '<div class="ui-stat-ic">' + esc(o.icon) + '</div>' : '') +
      '<div class="ui-stat-body"><div class="ui-stat-lb">' + esc(o.label) + '</div><div class="ui-stat-n">' + esc(o.value) + '</div>' +
      ((o.note || d) ? '<div class="ui-stat-sub">' + d + (o.note ? '<span>' + esc(o.note) + '</span>' : '') + '</div>' : '') + '</div></div>';
  }
  function uiStatGrid_(items) { return '<div class="ui-stat-grid">' + (items || []).map(uiStat_).join('') + '</div>'; }
  /*@@KIT-JS@@*/

  /* Trang mẫu: ?ui=kit hoặc uiKitOpen_() — lớp phủ toàn màn hình, KHÔNG đụng dữ liệu CRM. */
  function uiKitSections_() {
    var S = [];
    S.push(['Thẻ số (R2a)', uiStatGrid_([
      { icon: '💰', label: 'Doanh thu hôm nay', value: '128.400.000', delta: 12.5, note: 'so với hôm qua', tone: 'brand' },
      { icon: '🧾', label: 'Số đơn', value: '86', delta: -4, note: 'so với hôm qua', tone: 'info' },
      { icon: '✅', label: 'Tỷ lệ chốt', value: '31%', delta: 2, tone: 'success' },
      { icon: '⏰', label: 'Lịch hẹn quá hạn', value: '14', note: 'cần gọi ngay', tone: 'danger' }
    ])]);
    /*@@KIT-SECTIONS@@*/
    return S;
  }
  function uiKitHtml_() {
    return '<div class="ui-kit-h"><h1>Bộ thành phần giao diện — khung Hoàng hôn</h1><button type="button" class="ui-kit-close" onclick="uiKitClose_()">✕ Đóng</button></div>' +
      uiKitSections_().map(function (x) { return '<section class="ui-kit-sec"><h2>' + esc(x[0]) + '</h2>' + x[1] + '</section>'; }).join('');
  }
  function uiKitOpen_() {
    if (typeof document === 'undefined') return null;
    var el = document.getElementById('ui-kit-page');
    if (!el) { el = document.createElement('div'); el.id = 'ui-kit-page'; el.className = 'ui-kit-page'; document.body.appendChild(el); }
    el.innerHTML = uiKitHtml_(); return el;
  }
  function uiKitClose_() { var el = typeof document !== 'undefined' && document.getElementById('ui-kit-page'); if (el) el.remove(); }

  var api = { esc: esc, uiStat_: uiStat_, uiStatGrid_: uiStatGrid_, uiKitHtml_: uiKitHtml_, uiKitOpen_: uiKitOpen_, uiKitClose_: uiKitClose_ /*@@KIT-API@@*/ };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    for (var k in api) if (k.indexOf('ui') === 0) window[k] = api[k];
    if (/[?&]ui=kit\b/.test(location.search)) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', uiKitOpen_); else uiKitOpen_(); }
  }
})();

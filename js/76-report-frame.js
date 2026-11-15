/* 76-report-frame.js — R7a (HANDOFF.md "KẾ HOẠCH THIẾT KẾ LẠI TOÀN BỘ CRM"): KHUÔN CHUNG cho mọi báo cáo A–L.
   Thứ tự cố định: thanh lọc chuẩn → hàng thẻ số → biểu đồ → bảng → Xuất (Excel/ảnh). Hàm THUẦN uiReportFrame_(o) trả CHUỖI HTML (kiểu uiXxx_ của js/68).
   CHƯA áp vào báo cáo nào (R7b làm từng báo cáo, mỗi báo cáo 1 push): file này không đổi số liệu, không đổi báo cáo đang chạy.
   Chữ thường (title/desc/label/empty) được ESCAPE; tham số tên `*Html` / `onclick` do code gọi kiểm soát nên chèn nguyên (như attrs ở js/68).
   Test: node tools/test-report-frame.js. CSS: css/25-report-frame.css (token-only). */
(function () {
  'use strict';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var statGrid = null;
  if (typeof module !== 'undefined' && module.exports) { try { statGrid = require('./68-ui-kit.js').uiStatGrid_; } catch (e) { statGrid = null; } }
  function grid_(items) {
    var f = statGrid || (typeof window !== 'undefined' && window.uiStatGrid_);
    return f ? f(items) : '';
  }

  /* Khối có tiêu đề nhỏ: uiRfSection_(key, tieuDe, noiDungHtml) — rỗng thì bỏ cả khối (không vẽ khung trống). */
  function sec_(key, title, html) {
    if (!html) return '';
    return '<section class="rf-sec rf-' + key + '">' + (title ? '<h3 class="rf-sec-h">' + esc(title) + '</h3>' : '') + html + '</section>';
  }

  /* Nút Xuất: exports = [{label, onclick, icon, kind:'excel'|'image'|…}] — onclick do code gọi truyền (VD "_srKCsv_()"). */
  function exportsHtml_(list) {
    list = (list || []).filter(function (x) { return x && x.label && x.onclick; });
    if (!list.length) return '';
    return '<div class="rf-export">' + list.map(function (x) {
      return '<button type="button" class="btn secondary sm rf-export-btn" data-rf-export="' + esc(x.kind || '') + '" onclick="' + esc(x.onclick) + '">' + (x.icon ? esc(x.icon) + ' ' : '') + esc(x.label) + '</button>';
    }).join('') + '</div>';
  }

  /* uiReportFrame_(o):
       o.id          mã báo cáo ('A'…'L') — gắn data-rf để test/đối chiếu
       o.title/desc  tiêu đề + mô tả ngắn (tuỳ chọn)
       o.barHtml     thanh lọc chuẩn (VD _srBarHtml_())
       o.noticeHtml  banner cảnh báo trên cùng (VD _srEMismatchBanner_())
       o.loading     true → chỉ vẽ "Đang tải…" dưới thanh lọc (thanh lọc vẫn dùng được)
       o.error       chữ lỗi → hộp lỗi (có o.retry = onclick nút Thử lại)
       o.stats       mảng cho uiStat_ ({label,value,note,delta,tone,icon})
       o.chartTitle / o.chartHtml   biểu đồ (SVG sẵn có)
       o.tableTitle / o.tableHtml   bảng; o.empty = chữ khi không có bảng và không có thẻ số
       o.bodyHtml    NỘI DUNG NHIỀU MỤC có tiêu đề riêng (báo cáo chưa tách được thẻ số/biểu đồ/bảng, VD E/F/G) — chèn nguyên, xếp SAU thẻ số/biểu đồ/bảng
       o.afterHtml   khối phụ nằm SAU bảng, trước nút Xuất (VD đối chiếu, chốt tháng) — code gọi kiểm soát, chèn nguyên
       o.exports     mảng nút Xuất (xem exportsHtml_) */
  function uiReportFrame_(o) {
    o = o || {};
    var head = (o.title || o.desc)
      ? '<div class="rf-head">' + (o.title ? '<h2 class="rf-title">' + esc(o.title) + '</h2>' : '') + (o.desc ? '<p class="rf-desc">' + esc(o.desc) + '</p>' : '') + '</div>' : '';
    var out = '<div class="rf" data-rf="' + esc(o.id || '') + '">' + head +
      (o.barHtml ? '<div class="rf-bar">' + o.barHtml + '</div>' : '') + (o.noticeHtml || '');
    if (o.loading) return out + '<div class="rf-state rf-loading">Đang tải…</div></div>';
    if (o.error) {
      return out + '<div class="rf-state rf-error"><div>' + esc(o.error) + '</div>' +
        (o.retry ? '<button type="button" class="btn sm" onclick="' + esc(o.retry) + '">Thử lại</button>' : '') + '</div></div>';
    }
    var stats = (o.stats && o.stats.length) ? grid_(o.stats) : '';
    var chart = o.chartHtml || '', table = o.tableHtml || '';
    if (!stats && !chart && !table && !o.bodyHtml && !o.afterHtml) return out + '<div class="rf-state rf-empty">' + esc(o.empty || 'Chưa có dữ liệu trong bộ lọc này') + '</div></div>';
    return out +
      (stats ? '<div class="rf-stats">' + stats + '</div>' : '') +
      sec_('chart', o.chartTitle, chart) +
      sec_('table', o.tableTitle, table ? '<div class="rf-table-wrap">' + table + '</div>' : '') +
      (o.bodyHtml ? '<div class="rf-body">' + o.bodyHtml + '</div>' : '') +
      (o.afterHtml ? '<div class="rf-after">' + o.afterHtml + '</div>' : '') +
      exportsHtml_(o.exports) + '</div>';
  }

  var api = { uiReportFrame_: uiReportFrame_ };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else for (var k in api) window[k] = api[k];
})();

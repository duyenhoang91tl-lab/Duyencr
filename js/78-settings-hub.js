/* 78-settings-hub.js — R9a (HANDOFF.md "KẾ HOẠCH THIẾT KẾ LẠI TOÀN BỘ CRM"): TRUNG TÂM LỐI TẮT CÀI ĐẶT, gom các mục rời của nhóm "⚙ Settings" theo chủ đề.
   Hàm THUẦN uiSettingsHub_(groups) trả CHUỖI HTML (kiểu uiXxx_ của js/68). Không đổi menu bên trái, không đổi logic lưu cấu hình.
   groups = [{ icon, title, desc, items:[{ key, label, tone }] }] — nhóm không có mục nào thì bỏ cả nhóm. tone 'danger' = nút đỏ (việc xoá).
   Chữ (icon/title/desc/label) được ESCAPE; nút gọi `_shRun_('<key>')` (định nghĩa ở js/37-fn-configpage.js), key cũng được escape.
   Test: node tools/test-config-hub.js. CSS: css/27-settings-hub.css (token-only). */
(function () {
  'use strict';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function itemHtml_(it) {
    var danger = it.tone === 'danger';
    return '<button type="button" class="btn sm sh-item' + (danger ? ' is-danger' : '') + '" data-sh="' + esc(it.key) + '" onclick="_shRun_(\'' + esc(it.key) + '\')">' + esc(it.label) + '</button>';
  }
  function groupHtml_(g) {
    var items = (g.items || []).filter(function (it) { return it && it.key && it.label; });
    if (!items.length) return '';
    return '<div class="sh-grp">' +
      '<h4 class="sh-grp-h">' + (g.icon ? '<span class="sh-grp-ic" aria-hidden="true">' + esc(g.icon) + '</span>' : '') + esc(g.title) + '</h4>' +
      (g.desc ? '<p class="sh-grp-d">' + esc(g.desc) + '</p>' : '') +
      '<div class="sh-items">' + items.map(itemHtml_).join('') + '</div></div>';
  }
  function uiSettingsHub_(groups) {
    var inner = (groups || []).map(groupHtml_).join('');
    if (!inner) return '';
    return '<div class="sh-hub" data-sh-hub="1">' + inner + '</div>';
  }

  var api = { uiSettingsHub_: uiSettingsHub_ };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else for (var k in api) window[k] = api[k];
})();

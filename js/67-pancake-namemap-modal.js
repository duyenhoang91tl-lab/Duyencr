// ════════════════════════════════════════════════════════════════════
//  67-pancake-namemap-modal.js (20/11/2026) — "🔗 Khớp tên Pancake" chuyển từ tab "📥 Báo cáo Pancake" sang CÀI ĐẶT TEAM (Duyên yêu cầu:
//  khớp nhân viên là cài đặt nhân sự, để trong báo cáo Pancake không hợp lý). Menu: ☰ → 👥 Cài đặt team → "🔗 Khớp tên Pancake" (admin).
//  KHÔNG viết lại logic: dùng lại nguyên _pkRenderMapTableHtml / _pkMapSaveClose / _pkMapNameInline / _pkLoadNameMap (js/09) và dữ liệu
//  _pkState.nameMap (sheet PancakeNameMap qua action savePancakeNameMap) — chỉ đổi NƠI HIỂN THỊ. Mượn khung .sm-overlay/.sm-box của "Khớp sale" (css/12-salematch.css).
//  _pkMapNameInline (js/09) gọi _pnmRender() sau khi lưu để bảng trong cửa sổ này cập nhật ngay.
//  Phần "Khớp Page Pancake ↔ Kênh bán" vẫn ở tab Báo cáo Pancake (không phải khớp nhân viên).
// ════════════════════════════════════════════════════════════════════
(function(){
  'use strict';
  function ov_(){ return document.getElementById('pnm-overlay'); }
  function isAdmin_(){ return typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin'; }

  function ensure_(){
    var ov = ov_(); if (ov) return ov;
    ov = document.createElement('div'); ov.id = 'pnm-overlay'; ov.className = 'sm-overlay';
    ov.innerHTML = '<div class="sm-box"><div class="sm-head"><b>🔗 Khớp tên Pancake ↔ Sale CRM</b><span class="sm-sp" style="flex:1"></span>' +
      '<button type="button" class="btn secondary sm" id="pnm-close">✕</button></div>' +
      '<div class="sm-note" style="max-width:none;overflow:visible;white-space:normal;text-overflow:clip">Tên “Nhân viên” trên Pancake là tên Facebook cá nhân, thường không khớp tên đăng nhập (Sale) trong CRM — khớp 1 lần, dùng lại cho mọi lần nạp báo cáo sau. ' +
      'Danh sách tên lấy từ các báo cáo Pancake đã nạp (tab “📥 Báo cáo Pancake”).</div>' +
      '<div class="sm-body" id="pnm-body" style="padding:10px 14px"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if (e.target === ov) window.closePancakeNameMapModal(); });
    document.getElementById('pnm-close').addEventListener('click', function(){ window.closePancakeNameMapModal(); });
    return ov;
  }

  // Vẽ lại bảng (gọi sau mỗi lần lưu 1 tên). Giữ nguyên vị trí cuộn để không nhảy lên đầu.
  window._pnmRender = function(){
    var ov = ov_(), body = document.getElementById('pnm-body');
    if (!ov || !body || !ov.classList.contains('open')) return;
    var top = body.scrollTop;
    body.innerHTML = _pkRenderMapTableHtml(isAdmin_());
    body.scrollTop = top;
  };

  window.openPancakeNameMapModal = async function(){
    var ov = ensure_(); ov.classList.add('open');
    var body = document.getElementById('pnm-body');
    if (typeof _pkState === 'undefined' || typeof _pkRenderMapTableHtml !== 'function') { body.innerHTML = '<div class="sm-empty">Chưa tải xong module Pancake — thử lại sau vài giây.</div>'; return; }
    body.innerHTML = '<div class="sm-empty">Đang tải dữ liệu khớp tên…</div>';
    try { await _pkLoadNameMap(); } catch(e){}   // luôn nạp mới (đã chống cache Worker bằng _t) để khớp tên vừa lưu ở máy khác cũng hiện
    window._pnmRender();
  };

  window.closePancakeNameMapModal = function(){
    var ov = ov_(); if (ov) ov.classList.remove('open');
    _pkState.mapOpen = '';
  };
})();

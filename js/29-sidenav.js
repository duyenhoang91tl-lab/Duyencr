// ═══════════════════════════════════════════════════════
//  MENU TÁC VỤ DỌC BÊN TRÁI — ẩn mặc định, bấm "☰" mới hiện, chọn mục xong tự ẩn lại.
//  Chỉ đổi cách hiển thị khối .tabs (xem css/05-sidenav.css); mọi logic tab/quyền giữ nguyên.
// ═══════════════════════════════════════════════════════
(function(){
  function tabsEl(){ return document.querySelector('#data-view .tabs'); }
  function bd(){ return document.getElementById('sn-backdrop'); }
  function btn(){ return document.getElementById('sn-toggle'); }
  function isOpen(){ var t = tabsEl(); return !!(t && t.classList.contains('sn-open')); }
  function setOpen(on){
    var t = tabsEl(); if (!t) return;
    t.classList.toggle('sn-open', !!on);
    var b = bd(); if (b) b.classList.toggle('show', !!on);
  }
  function curLabel(){
    var a = document.querySelector('#data-view .tabs .tab.active');
    if (!a) return '';
    var c = a.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll('.tab-badge,#reportsgroup-list'), function(x){ x.remove(); });
    return (c.textContent || '').replace('▾','').trim();
  }
  function refreshLabel(){
    var b = btn(); if (!b) return;
    var l = curLabel();
    b.innerHTML = '☰ Menu' + (l ? ' <span class="sn-cur">· ' + String(l).replace(/[<>&]/g,'') + '</span>' : '');
  }
  function syncVisible(){
    var b = btn(), dv = document.getElementById('data-view'); if (!b || !dv) return;
    var show = dv.style.display !== 'none';
    b.classList.toggle('sn-on', show);
    if (!show) setOpen(false);
  }
  function init(){
    if (btn()) return;
    var hdr = document.querySelector('header'), dv = document.getElementById('data-view');
    if (!hdr || !dv) return;
    var b = document.createElement('button');
    b.id = 'sn-toggle'; b.type = 'button'; b.title = 'Mở/đóng menu tác vụ';
    b.addEventListener('click', function(e){ e.stopPropagation(); setOpen(!isOpen()); });
    hdr.insertBefore(b, hdr.firstChild);
    var back = document.createElement('div');
    back.id = 'sn-backdrop';
    back.addEventListener('click', function(){ setOpen(false); });
    document.body.appendChild(back);
    // Chọn 1 mục (trừ nút mở nhóm "Báo cáo" và nút ⚙ tuỳ chỉnh) -> tự ẩn menu
    document.addEventListener('click', function(e){
      if (!isOpen()) return;
      var tab = e.target.closest && e.target.closest('#data-view .tabs .tab');
      if (!tab) return;
      if (tab.id === 'v9tab-reportsgroup' && !e.target.closest('#reportsgroup-list')) return;
      if (tab.id === 'v9tab-customize') { setOpen(false); return; }
      setTimeout(function(){ setOpen(false); refreshLabel(); }, 0);
    });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && isOpen()) setOpen(false); });
    new MutationObserver(syncVisible).observe(dv, { attributes:true, attributeFilter:['style'] });
    var t = tabsEl();
    if (t) new MutationObserver(refreshLabel).observe(t, { subtree:true, attributes:true, attributeFilter:['class'] });
    refreshLabel(); syncVisible();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  // _injectV9UI thêm tab muộn -> cập nhật lại nhãn
  setTimeout(refreshLabel, 1200);
})();

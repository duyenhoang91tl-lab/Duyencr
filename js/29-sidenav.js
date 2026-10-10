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
  // Nhóm menu mẹ -> các mục con (theo data-bar-id). Mục chưa khai báo vẫn hiện, dồn vào nhóm "Khác".
  var GROUPS = [
    { k:'kh',  t:'👤 Khách hàng', ids:['tab-kh','tab-schedule','tab-overdue','tab-mydata'] },
    { k:'rp',  t:'📊 Báo cáo',    ids:['salesreport','pancake','kpipancake','mktchecklist','dailybrief','dashboard'] },
    { k:'nv',  t:'👥 Nhân viên',  ids:['team','audit','tab-task'] },
    { k:'ct',  t:'🛠 Công cụ',    ids:['tab-zaloai','uploaddata'] }
  ];
  var closed = {};
  try { closed = JSON.parse(localStorage.getItem('sn_closed') || '{}') || {}; } catch(e){ closed = {}; }
  function gOf(id){ for (var i=0;i<GROUPS.length;i++){ var j=GROUPS[i].ids.indexOf(id); if(j>=0) return {g:i,j:j}; } return {g:GROUPS.length-1,j:50}; }
  function layout(){
    var t = tabsEl(); if (!t) return;
    var activeG = null;
    GROUPS.forEach(function(g,gi){
      var h = t.querySelector('.sn-gh[data-k="'+g.k+'"]');
      if (!h){
        h = document.createElement('div'); h.className = 'sn-gh'; h.setAttribute('data-k', g.k);
        h.innerHTML = '<span>'+g.t+'</span><span class="sn-car">▼</span>';
        h.addEventListener('click', function(e){ e.stopPropagation(); closed[g.k] = !closed[g.k]; try{localStorage.setItem('sn_closed', JSON.stringify(closed));}catch(x){} layout(); });
        t.appendChild(h);
      }
      h.style.order = String(gi*100);
    });
    var cnt = {};
    t.querySelectorAll('.tab[data-bar-id]').forEach(function(el){
      var id = el.getAttribute('data-bar-id');
      if (id === 'reportsgroup') return;
      var r = gOf(id), g = GROUPS[r.g];
      el.setAttribute('data-sn-g', g.k);
      el.style.order = String(r.g*100 + 1 + r.j);
      if (el.classList.contains('active')) activeG = g.k;
      var hid = el.style.display === 'none';
      if (!hid) cnt[g.k] = (cnt[g.k]||0) + 1;
      el.classList.toggle('sn-hide', !!closed[g.k] && g.k !== activeG);
    });
    GROUPS.forEach(function(g){
      var h = t.querySelector('.sn-gh[data-k="'+g.k+'"]');
      h.style.display = cnt[g.k] ? '' : 'none';          // nhóm rỗng (do phân quyền) -> ẩn luôn tiêu đề
      h.classList.toggle('sn-closed', !!closed[g.k] && g.k !== activeG);
    });
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
    layout(); refreshLabel(); syncVisible();
    if (t) new MutationObserver(function(m){ if (m.some(function(x){return !x.target.classList||!x.target.classList.contains('sn-gh');}) ) { clearTimeout(init._lt); init._lt=setTimeout(layout,30); } }).observe(t, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  // _injectV9UI thêm tab muộn -> cập nhật lại nhãn
  setTimeout(function(){ try{ var t=document.querySelector('#data-view .tabs'); if(t) t.dispatchEvent(new Event('x')); }catch(e){} refreshLabel(); }, 1200);
})();

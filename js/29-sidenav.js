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
    { k:'kh',  t:'👤 Thông tin khách hàng', ids:['tab-kh','tab-schedule','tab-overdue','tab-mydata'] },
    { k:'tv',  t:'🧰 Tác vụ',               ids:['tab-zaloai','act:bc','act:bct','act:bcstat','act:futpl','act:bday'] },
    { k:'nv',  t:'🧑‍💼 Thông tin nhân viên',  ids:['tab-task'] },
    { k:'rp',  t:'📊 Báo cáo',              ids:['salesreport','pancake','kpipancake','mktchecklist','dailybrief','dashboard'] },
    { k:'cs',  t:'🔀 Cài đặt chia số',      ids:['act:assign','act:autoassign','act:assignhist'] },
    { k:'tm',  t:'👥 Cài đặt team',         ids:['team','act:acct'] },
    { k:'up',  t:'📤 Up data',              ids:['uploaddata','act:upload','act:sync','act:fullsync','act:dup'] },
    { k:'st',  t:'⚙ Settings',              ids:['act:cstatus','act:khstatus','act:cfield','audit','act:clear'] }
  ];
  // Mục "hành động" (mở modal có sẵn, không phải tab). admin:true = chỉ tài khoản admin thấy.
  var ACTS = {
    acct:       { t:'🔑 Tài khoản đăng nhập', f:'openAcctModal', admin:true },
    assign:     { t:'👥 Chia data', f:'openAssignModal', admin:true },
    autoassign: { t:'⏰ Chia tự động', f:'openAssignModal', tab:'auto', admin:true },
    assignhist: { t:'📋 Lịch sử chia', f:'openAssignModal', tab:'history', admin:true },
    upload:     { t:'📂 Tải file Excel', click:'fi' },
    sync:       { t:'↓ Sync GS', f:'syncFromGS', arg:{pullOrders:true,manual:true} },
    fullsync:   { t:'🔁 Đồng bộ 2 chiều (tải + đẩy)', f:'fullSyncOrdersToGS', admin:true },
    dup:        { t:'🗑️ Đơn trùng', f:'openDupOrdersModal', admin:true },
    bc:         { t:'📣 Chiến dịch từ danh sách lọc', f:'openBroadcastFromCurrentFilter' },
    bct:        { t:'🎯 Chiến dịch theo sản phẩm', f:'openBctModal' },
    bcstat:     { t:'📊 TK chiến dịch', f:'openBcStatModal' },
    futpl:      { t:'📨 Mẫu hỏi thăm tự động', f:'openFuTplModal' },
    bday:       { t:'🎂 Mẫu sinh nhật', f:'openBdayTplModal' },
    cstatus:    { t:function(){ return '⚙ ' + (typeof FIELD_LABEL_CS!=='undefined'?FIELD_LABEL_CS:'Tình trạng chăm sóc'); }, f:'openCareStatusModal', admin:true },
    khstatus:   { t:function(){ return '⚙ ' + (typeof FIELD_LABEL_KH!=='undefined'?FIELD_LABEL_KH:'Trạng thái KH'); }, f:'openKhStatusModal', admin:true },
    cfield:     { t:'➕ Trường tự tạo', f:'openCustomFieldsModal', admin:true },
    clear:      { t:'🧹 Xóa data trên máy', f:'clearData', admin:true }
  };
  function isAdm(){ try { return (typeof _authAccount!=='undefined' && _authAccount && _authAccount.role==='admin') || (typeof _bootstrapAdmin!=='undefined' && _bootstrapAdmin); } catch(e){ return false; } }
  function runAct(k){
    var a = ACTS[k]; if (!a) return;
    setOpen(false);
    if (a.click) { var inp = document.getElementById(a.click); if (inp) inp.click(); return; }
    try {
      var fn = window[a.f];
      if (typeof fn !== 'function') { if (typeof toast==='function') toast('Chức năng chưa sẵn sàng'); return; }
      fn(a.arg);
      if (a.tab && typeof switchAssignTab === 'function') {
        var tabs = document.querySelectorAll('#assign-modal .assign-tab'), idx = {create:0,history:1,report:2,auto:3}[a.tab];
        switchAssignTab(a.tab, tabs[idx]);
      }
    } catch(e){ console.warn('sidenav act', k, e); if (typeof toast==='function') toast('Lỗi mở: ' + e.message); }
  }
  var closed = {};
  try { closed = JSON.parse(localStorage.getItem('sn_closed') || '{}') || {}; } catch(e){ closed = {}; }
  function gOf(id){ for (var i=0;i<GROUPS.length;i++){ var j=GROUPS[i].ids.indexOf(id); if(j>=0) return {g:i,j:j}; } return {g:GROUPS.length-1,j:50}; }
  function layout(){
    var t = tabsEl(); if (!t) return;
    var activeG = null;
    var _a = t.querySelector('.tab.active[data-bar-id]'); if (_a) activeG = GROUPS[gOf(_a.getAttribute('data-bar-id')).g].k;
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
    var demo = document.body.classList.contains('demo-mode') || (typeof currentUser!=='undefined' && currentUser && currentUser.role==='demo');
    Object.keys(ACTS).forEach(function(k){
      var el = t.querySelector('.sn-act[data-act="'+k+'"]');
      if (!el){
        el = document.createElement('div'); el.className = 'sn-act'; el.setAttribute('data-act', k); el.textContent = (typeof ACTS[k].t==='function' ? ACTS[k].t() : ACTS[k].t);
        el.addEventListener('click', function(e){ e.stopPropagation(); runAct(k); });
        t.appendChild(el);
      }
      if (typeof ACTS[k].t==='function') { var _nl = ACTS[k].t(); if (el.textContent !== _nl) el.textContent = _nl; } // chỉ gán khi đổi, tránh MutationObserver gọi layout lặp
      var r = gOf('act:'+k), g = GROUPS[r.g];
      el.setAttribute('data-sn-g', g.k);
      el.style.order = String(r.g*100 + 1 + r.j);
      var ok = !demo && (!ACTS[k].admin || isAdm());
      if (ok) cnt[g.k] = (cnt[g.k]||0) + 1;
      el.classList.toggle('sn-hide', !ok || (!!closed[g.k]));
    });
    t.querySelectorAll('.tab[data-bar-id]').forEach(function(el){
      var id = el.getAttribute('data-bar-id');
      if (id === 'reportsgroup') return;
      var r = gOf(id), g = GROUPS[r.g];
      el.setAttribute('data-sn-g', g.k);
      el.style.order = String(r.g*100 + 1 + r.j);
      if (el.classList.contains('active')) activeG = g.k;
      var hid = el.style.display === 'none';
      // "Quá hạn" đã gộp vào màn "Lịch chăm sóc" (công tắc Theo tuần | Quá hạn) -> ẩn mục riêng, TRỪ khi tài khoản chỉ được cấp quyền Quá hạn mà không có Lịch chăm sóc
      var _mergedOver = (id === 'tab-overdue') && (typeof _tabAllowedForUser !== 'function' || _tabAllowedForUser('tab-schedule'));
      if (_mergedOver) hid = true;
      if (!hid) cnt[g.k] = (cnt[g.k]||0) + 1;
      el.classList.toggle('sn-hide', !!closed[g.k] || _mergedOver);
    });
    GROUPS.forEach(function(g){
      var h = t.querySelector('.sn-gh[data-k="'+g.k+'"]');
      h.style.display = cnt[g.k] ? '' : 'none';          // nhóm rỗng (do phân quyền) -> ẩn luôn tiêu đề
      h.classList.toggle('sn-closed', !!closed[g.k]);
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
      var gk = tab.getAttribute('data-sn-g'); if (gk && closed[gk]) { closed[gk] = false; try{localStorage.setItem('sn_closed', JSON.stringify(closed));}catch(x){} }
      setTimeout(function(){ setOpen(false); refreshLabel(); layout(); }, 0);
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

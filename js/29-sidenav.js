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
    var q = document.getElementById('qs-wrap'); if (q) q.classList.toggle('sn-on', show);
    if (!show) setOpen(false);
  }
  // Nhóm menu mẹ -> các mục con (theo data-bar-id). Mục chưa khai báo vẫn hiện, dồn vào nhóm "Khác".
  var GROUPS = [
    { k:'ov',  t:'🏠 Tổng quan',           ids:['act:notif','overview'] },
    { k:'kh',  t:'👤 Hồ sơ',                ids:['tab-kh','care2','stageboard','tab-schedule','tab-overdue','tab-mydata','tab-task','act:profile'] },   // gộp hồ sơ khách hàng + hồ sơ nhân viên
    { k:'sc',  t:'💬 Social',               ids:['tab-chat','tab-teamchat'] },
    { k:'kho', t:'📦 Kho',                 ids:['act:kho'] },
    { k:'tv',  t:'🧰 Tác vụ',               ids:['tab-zaloai','act:bc','act:bct','act:bcstat','act:futpl','act:bday'] },
    { k:'rp',  t:'📊 Báo cáo',              ids:['salesreport','pancake','kpipancake','mktchecklist','dailybrief','dashboard','act:fureport','act:teamai'] },
    { k:'cs',  t:'🔀 Cài đặt chia số',      ids:['act:assign','act:autoassign','act:assignhist'] },
    { k:'tm',  t:'👥 Cài đặt team',         ids:['team','act:salematch','act:acct'] },
    { k:'up',  t:'📤 Up data',              ids:['uploaddata','act:upload','act:sync','act:fullsync','act:dup'] },
    { k:'st',  t:'⚙ Settings',              ids:['act:roles','act:dept','act:help','act:theme','act:errlog','config','act:cstatus','act:khstatus','act:cfield','act:tier','act:promo','audit','act:clear','act:taskflow'] }
  ];
  // Mục "hành động" (mở modal có sẵn, không phải tab). admin:true = chỉ tài khoản admin thấy.
  var ACTS = {
    roles:      { t:'🛡 Phân quyền', f:'openRoleSettings', admin:true },
    dept:       { t:'🏢 Phòng ban', f:'openDeptSettings', admin:true },
    help:       { t:'❓ Hướng dẫn sử dụng', f:'openHelpModal', open:true },
    theme:      { t:function(){ return (typeof _themeIsDark==='function' && _themeIsDark()) ? '☀ Chế độ sáng' : '🌙 Chế độ tối'; }, f:'toggleTheme', open:true },
    errlog:     { t:'🐞 Nhật ký lỗi (máy này)', f:'openErrLogModal', admin:true },
    notif:      { t:function(){ return (typeof _ntLabel==='function') ? _ntLabel() : '🔔 Thông báo'; }, f:'openNotifModal' },
    kho:        { t:'📦 Tồn kho', f:'openKhoModal' },
    profile:    { t:'🪪 Hồ sơ nhân viên', f:'openProfileModal' },
    salematch:  { t:'🔗 Khớp sale', f:'openSaleMatchModal', admin:true },
    acct:       { t:'🔑 Tài khoản đăng nhập', f:'openAcctModal', admin:true },
    taskflow:   { t:'🧩 Quy trình công việc', f:'openTaskFlowManager', admin:true },
    assign:     { t:'👥 Chia data', f:'openAssignModal', admin:true },
    autoassign: { t:'⏰ Chia tự động', f:'openAssignModal', tab:'auto', admin:true },
    assignhist: { t:'📋 Lịch sử chia', f:'openAssignModal', tab:'history', admin:true },
    upload:     { t:'📂 Tải file Excel', click:'fi' },
    sync:       { t:'↓ Sync GS', f:'syncFromGS', arg:{pullOrders:true,manual:true} },
    fullsync:   { t:'🔁 Đồng bộ 2 chiều (tải + đẩy)', f:'fullSyncOrdersToGS', admin:true },
    dup:        { t:'🗑️ Đơn trùng', f:'openDupOrdersModal', admin:true },
    bc:         { t:'📣 Chiến dịch từ danh sách lọc', f:'openBroadcastFromCurrentFilter' },
    bct:        { t:'🎯 Chiến dịch theo sản phẩm', f:'openBctModal' },
    teamai:     { t:'🤖 AI phân tích team', f:'openTeamAnalysisModal', admin:true },
    bcstat:     { t:'📊 TK chiến dịch', f:'openBcStatModal' },
    futpl:      { t:'📨 Mẫu hỏi thăm tự động', f:'openFuTplModal' },
    fureport:   { t:'📞 Chăm sóc theo mốc', f:'openFuReport' },
    bday:       { t:'🎂 Mẫu sinh nhật', f:'openBdayTplModal' },
    cstatus:    { t:function(){ return '⚙ ' + (typeof FIELD_LABEL_CS!=='undefined'?FIELD_LABEL_CS:'Tình trạng chăm sóc'); }, f:'openCareStatusModal', admin:true },
    khstatus:   { t:function(){ return '⚙ ' + (typeof FIELD_LABEL_KH!=='undefined'?FIELD_LABEL_KH:'Trạng thái KH'); }, f:'openKhStatusModal', admin:true },
    tier:       { t:'🏅 Cấu hình hạng KH', f:'openTierConfig', admin:true },
    promo:      { t:'🎁 Cấu hình khuyến mãi', f:'openPromoConfig', admin:true },
    cfield:     { t:'➕ Trường tự tạo', f:'openCustomFieldsModal', admin:true },
    clear:      { t:'🧹 Xóa data trên máy', f:'clearData', admin:true }
  };
  window._SN_GROUPS = GROUPS; window._SN_ACTS = ACTS;   // cho trang Phân quyền (js/40-fn-rolesettings.js) liệt kê hạng mục
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
        h.innerHTML = '<span>'+g.t+'</span><span class="sn-car" aria-hidden="true"></span>'; // dấu +/− vẽ bằng CSS (không dùng ký tự mũi tên)
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
      var ok = !demo && (!ACTS[k].admin || isAdm()) && (isAdm() || ACTS[k].admin || ACTS[k].open || typeof _featAllowed !== 'function' || _featAllowed('act:' + k));   // phân quyền theo vai trò/bộ phận (js/40)
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
    // Ô tìm nhanh cạnh nút Menu: dùng được ở MỌI màn; gõ xong tự chuyển về "Danh sách KH" và lọc theo từ khoá
    var qw = document.createElement('div'); qw.id = 'qs-wrap';
    qw.innerHTML = '<input id="qs-input" type="search" placeholder="🔍 Tìm nhanh: tên, SĐT, mã đơn..." autocomplete="off">';
    hdr.insertBefore(qw, b.nextSibling);
    var qt;
    qw.firstChild.addEventListener('input', function(){
      var v = this.value; clearTimeout(qt);
      qt = setTimeout(function(){
        var si = document.getElementById('search-input'); if (!si) return;
        var tl = document.querySelector('#data-view .tabs [onclick*="switchTab(\'list\'"]');
        if (v && tl && !tl.classList.contains('active')) tl.click();
        si.value = v; si.dispatchEvent(new Event('input', {bubbles:true}));
      }, 350);
    });
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
      var gk = tab.getAttribute('data-sn-g'); if (gk && closed[gk]) { closed[gk] = false; try{localStorage.setItem('sn_closed', JSON.stringify(closed));}catch(x){} }
      setTimeout(function(){ setOpen(false); refreshLabel(); layout(); }, 0);
    });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && isOpen()) setOpen(false); });
    new MutationObserver(syncVisible).observe(dv, { attributes:true, attributeFilter:['style'] });
    var t = tabsEl();
    if (t) new MutationObserver(refreshLabel).observe(t, { subtree:true, attributes:true, attributeFilter:['class'] });
    window._snLayout = layout;   // js/40-fn-rolesettings.js gọi lại khi quyền đổi
    layout(); refreshLabel(); syncVisible();
    if (t) new MutationObserver(function(m){ if (m.some(function(x){return !x.target.classList||!x.target.classList.contains('sn-gh');}) ) { clearTimeout(init._lt); init._lt=setTimeout(layout,30); } }).observe(t, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  // _injectV9UI thêm tab muộn -> cập nhật lại nhãn
  setTimeout(function(){ try{ var t=document.querySelector('#data-view .tabs'); if(t) t.dispatchEvent(new Event('x')); }catch(e){} refreshLabel(); }, 1200);
})();

// ═══════════════════════════════════════════════════════
//  TÌM THEO MÃ ĐƠN — ô search chính (#search-input). Gõ >=4 ký tự có chữ/số (không phải SĐT thuần)
//  -> hỏi GAS action=searchOrder (ID đơn DT TỔNG + ghi chú đơn Pos) -> xổ danh sách; bấm 1 dòng thì
//  điền SĐT vào ô search để lọc đúng khách đó. Tên/SĐT vẫn lọc như cũ.
// ═══════════════════════════════════════════════════════
var _ordSearchTimer = null, _ordSearchSeq = 0;
function _ordSearchSoon(){
  clearTimeout(_ordSearchTimer);
  var inp = document.getElementById('search-input'), box = document.getElementById('ord-search-res');
  if (!inp || !box) return;
  var q = String(inp.value || '').trim();
  if (q.length < 4 || /^\d{9,11}$/.test(q) || !/\d/.test(q) || typeof gsUrl === 'undefined' || !gsUrl) { box.style.display = 'none'; return; }
  _ordSearchTimer = setTimeout(function(){ _ordSearchRun(q); }, 500);
}
async function _ordSearchRun(q){
  var box = document.getElementById('ord-search-res'); if (!box) return;
  var seq = ++_ordSearchSeq;
  box.style.display = 'block'; box.innerHTML = '<div class="ors-h">Đang tìm mã đơn "' + esc(q) + '"…</div>';
  try {
    var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=searchOrder&q=' + encodeURIComponent(q), { redirect:'follow' });
    var j = await r.json();
    if (seq !== _ordSearchSeq) return;
    if (j && j.error) { box.innerHTML = '<div class="ors-h">' + esc(j.error) + '</div>'; return; }
    var rs = (j && j.results) || [];
    if (!rs.length) { box.innerHTML = '<div class="ors-h">Không có đơn nào khớp mã "' + esc(q) + '" (nếu vừa sửa GAS: nhớ deploy lại)</div>'; return; }
    window.__ordSearchRes = rs;
    box.innerHTML = '<div class="ors-h">' + rs.length + ' đơn khớp mã — bấm để mở khách</div>' + rs.map(function(o,i){
      var nm = (typeof customerMap !== 'undefined' && customerMap[o.phone]) ? customerMap[o.phone].name : '';
      return '<div class="ors-i" onclick="_ordSearchPick(' + i + ')"><b>' + esc(o.code) + '</b> · ' + esc(o.phone || '?') + (nm ? ' · ' + esc(nm) : '') +
        '<div class="ors-s">' + esc(o.src) + (o.date ? ' · ' + esc(o.date) : '') + (o.product ? ' · ' + esc(o.product) : '') + '</div></div>';
    }).join('');
  } catch(e){ if (seq === _ordSearchSeq) box.innerHTML = '<div class="ors-h">Lỗi tìm mã đơn: ' + esc(e.message) + '</div>'; }
}
// ── TRA CUU KHACH NGOAI PHAM VI (Duyen yeu cau 2026-10-21) ──
// Sale go DUNG SDT (9-11 so) hoac chon 1 ma don trong o tim kiem thi xem duoc ho so khach du khach khong thuoc ten minh.
// Nguyen nhan goc khong xem duoc: server (scopeMode=enforce) chi tra danh sach khach/don thuoc pham vi cua sale -> khach khac khong co trong
// customerMap, va lookup/searchOrder bi chan/loc. Nay: lookup kem via=search (server bo qua chan + ghi log 'search-out'), nap 1 khach do
// vao customerMap/careData roi dung lai luong cu (mergeRows + buildCustomers). Danh sach khach van loc theo pham vi nhu cu; chi tra cuu tung khach.
window._oosPhones = window._oosPhones || {};   // phone -> true: khach nap qua tim kiem (js/06 wrapper fetch them via=search cho lookup/donOrdersByPhone/cskhDetail)
var _oosState = {};
async function _pullSearchCustomer_(raw){
  var ph = (typeof normPhone === 'function' ? normPhone(raw) : '') || String(raw || '').replace(/\D/g, '');
  if (!ph || typeof gsUrl === 'undefined' || !gsUrl || typeof customerMap === 'undefined') return null;
  if (customerMap[ph]) return ph;
  if (_oosState[ph] === 'loading' || _oosState[ph] === 'fail') return null;
  _oosState[ph] = 'loading';
  try {
    var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=lookup&via=search&phone=' + encodeURIComponent(ph), { redirect:'follow' });
    var j = await r.json();
    if (!j || j.error || j.ok === false) { _oosState[ph] = 'fail'; if (typeof toast === 'function') toast((j && j.error) || 'Không tra cứu được khách này'); return null; }
    var care = j.care || null, ords = j.orders || [], ck = j.cskh || [], don = j.don || [];
    if (!care && !ords.length && !ck.length && !don.length) { _oosState[ph] = 'fail'; if (typeof toast === 'function') toast('Không tìm thấy khách với SĐT ' + ph); return null; }
    window._oosPhones[ph] = true;
    if (ords.length && typeof mergeRows === 'function') {
      mergeRows(ords.map(function(o){ return {
        date: o.date ? parseVNDate_(o.date) : null,
        year: parseNum(o.year), month: parseNum(o.month),
        cs: o.cs||'', name: o.name||'', phone: o.phone||ph,
        source: o.source||'', revenue: _normRev(o.revenue),
        product: o.product||'', productDetail: o.productDetail||'',
        status: o.status||'', zalo: o.zalo||'', note: o.note||''
      }; }));
    }
    if (care) {
      careData[ph] = {
        status: care.status||'', zalo: care.zalo||'', cs: care.cs||'', note: care.note||'',
        schedGoi: care.schedGoi||'', schedGoiNote: care.schedGoiNote||'', schedSP: care.schedSP||'', schedSPNote: care.schedSPNote||'',
        schedCS: care.schedCS||'', schedCSNote: care.schedCSNote||'', schedHen: care.schedHen||'', schedHenNote: care.schedHenNote||'',
        updated: care.updated||'', khStatus: care.khStatus||'', nickZalos: care.nickZalos||[], zaloPhones: care.zaloPhones||[],
        birthday: care.birthday||'', tag: care.tag||'', custom: (care.custom && typeof care.custom === 'object') ? care.custom : {}
      };
    }
    if (ck.length && typeof cskhData !== 'undefined' && cskhData) { cskhData[ph] = ck; if (typeof _cskhDetailCache !== 'undefined') _cskhDetailCache[ph] = ck; }
    if (!customerMap[ph]) {   // khach chi co o CareData/CSKH/du lieu don (khong co don DT TONG) -> tao dong toi thieu de hien trong danh sach
      customerMap[ph] = { phone: ph, name: (care && care.name) || (ck.find(function(x){ return x && x.name; }) || {}).name || ph, orders: [],
        sources: new Set(), brands: new Set(), _keys: new Set(), _rawStatus: (care && care.status) || '', _rawZalo: (care && care.zalo) || '', _rawNote: (care && care.note) || '' };
    }
    buildCustomers();
    _oosState[ph] = 'done';
    return customerMap[ph] ? ph : null;
  } catch (e) { _oosState[ph] = 'fail'; if (typeof toast === 'function') toast('Lỗi tra cứu khách: ' + (e && e.message || e)); return null; }
}
async function _ordSearchPick(i){
  var o = (window.__ordSearchRes || [])[i], inp = document.getElementById('search-input'), box = document.getElementById('ord-search-res');
  if (box) box.style.display = 'none';
  if (!o || !o.phone || !inp) return;
  var ph = (typeof normPhone === 'function' ? normPhone(o.phone) : '') || o.phone;
  if (typeof customerMap !== 'undefined' && !customerMap[ph] && !customerMap[o.phone]) await _pullSearchCustomer_(ph);   // khach ngoai pham vi: nap rieng khach nay
  var key = (typeof customerMap !== 'undefined' && customerMap[o.phone]) ? o.phone : ph;
  inp.value = key;
  if (typeof applyFilters === 'function') applyFilters();
  if (typeof openDp === 'function' && typeof customerMap !== 'undefined' && customerMap[key]) { try { openDp(key); } catch(e){} }
}
document.addEventListener('click', function(e){
  var box = document.getElementById('ord-search-res');
  if (box && box.style.display !== 'none' && !e.target.closest('.search-wrap')) box.style.display = 'none';
});

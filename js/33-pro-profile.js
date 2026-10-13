/* GIAO DIỆN PRO — P2: Hồ sơ khách 360° (chạy khi <html class="ui-pro"> — nay luôn có sẵn trong index.html; giữ kiểm tra này như lớp bảo vệ).
   Bước 1: thanh giai đoạn (từ CARE_STATUS_TREE) + ô số (ngày từ đơn cuối, số đơn, doanh thu).
   Không sửa openDp/renderDpTab gốc: chỉ bọc lại và chèn khối #dp-pro giữa .dp-hdr và .dp-tabs. */

// ── Hàm thuần (test được bằng Node) ──
// Làm phẳng cây Tình trạng CS ở CẤP 1 và đánh dấu giai đoạn hiện tại (node lá trùng status, hoặc node cha có con trùng status).
function proStageModel_(tree, status){
  var st = String(status||'').trim();
  function has(n){ if (n.value!==undefined && String(n.value)===st) return true; return (n.children||[]).some(has); }
  return (tree||[]).map(function(n){ return { label:n.label, cur: !!st && has(n) }; });
}
// Số ngày kể từ đơn gần nhất (null nếu không có đơn). Đơn chỉ có tháng/năm → tính từ ngày 1 của tháng.
function proDaysSinceLastOrder_(orders, now){
  var best = null;
  (orders||[]).forEach(function(o){
    var t = (o.date instanceof Date && !isNaN(o.date)) ? o.date.getTime() : (o.year ? new Date(o.year<100?2000+o.year:o.year, (o.month||1)-1, 1).getTime() : null);
    if (t!==null && (best===null || t>best)) best = t;
  });
  return best===null ? null : Math.max(0, Math.floor(((now||new Date()).getTime()-best)/86400000));
}
function proKpiHtml_(days, nOrders, rev){
  var f = function(n){ return (n||0).toLocaleString('vi-VN'); };
  var dCls = days===null ? 'purple' : days>180 ? 'red' : days>90 ? 'orange' : 'green';
  return '<div class="pro-grid">'
   + '<div class="pro-kpi '+dCls+'"><span class="k-l">Ngày từ đơn cuối</span><span class="k-v">'+(days===null?'—':f(days))+'</span></div>'
   + '<div class="pro-kpi blue"><span class="k-l">Số đơn</span><span class="k-v">'+f(nOrders)+'</span></div>'
   + '<div class="pro-kpi purple"><span class="k-l">Doanh thu</span><span class="k-v">'+f(rev)+'</span><span class="k-s">đ</span></div>'
   + '</div>';
}
function proStageHtml_(model){
  if (!model.length) return '';
  return '<ul class="pro-stage">'+model.map(function(m){ return '<li class="'+(m.cur?'cur':'')+'" title="'+String(m.label).replace(/"/g,'&quot;')+'">'+String(m.label).replace(/</g,'&lt;')+'</li>'; }).join('')+'</ul>';
}


// ── P2b/P2c: Việc tiếp theo + Dòng thời gian ──
function proEsc_(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function proYmd_(v){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||'')); return m ? m[0] : ''; }
function proDmy_(ymd){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd||'')); return m ? m[3]+'/'+m[2]+'/'+m[1] : '—'; }
// Ghi chú lưu thời gian dạng "HH:MM dd/mm/yyyy" (xem _fmtNoteTime) → ms; không parse được → null
function proNoteTs_(t){ var m = /^(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(t||'').trim()); return m ? new Date(+m[5], +m[4]-1, +m[3], +m[1], +m[2]).getTime() : null; }
// Lịch chưa xong của 1 khách: quá hạn lên đầu, rồi sắp tới theo ngày; tối đa limit
function proNextActions_(scheds, phone, todayYmd, types, limit){
  var list = (scheds||[]).filter(function(x){ return x.phone===phone && !x.done && proYmd_(x.date); })
    .map(function(x){ var d = proYmd_(x.date), t = (types||[]).find(function(y){ return y.key===x.type; }) || {};
      return { id:x.id, date:d, label: x.customLabel || t.label || 'Lịch hẹn', note:x.note||'', state: d<todayYmd ? 'over' : d===todayYmd ? 'today' : 'soon' }; });
  list.sort(function(a,b){ return a.date<b.date ? -1 : a.date>b.date ? 1 : 0; });
  return list.slice(0, limit||3);
}
function proNextHtml_(items){
  if (!items.length) return '<div class="pro-next"><span class="n-pct">—</span><span>Chưa có lịch hẹn nào đang chờ</span><span class="n-act" data-pro-go="schedule">+ Đặt lịch</span></div>';
  var chip = { over:'<span class="pro-chip bad">Quá hạn</span>', today:'<span class="pro-chip warn">Hôm nay</span>', soon:'' };
  return '<div class="pro-card-h" style="margin:4px 0 6px">Việc tiếp theo</div>' + items.map(function(it){
    return '<div class="pro-next"><span class="n-pct" style="color:var(--pro-ink)">'+proDmy_(it.date).slice(0,5)+'</span><span><b>'+proEsc_(it.label)+'</b> '+chip[it.state]+(it.note?'<br><span style="color:var(--muted)">'+proEsc_(String(it.note).slice(0,90))+'</span>':'')+'</span><span class="n-act" data-pro-go="schedule">Xem</span></div>';
  }).join('');
}
// Gộp ghi chú + lịch hẹn + đơn thành 1 dòng thời gian (mới nhất trước). Mục không có ngày xếp cuối.
function proTimeline_(notes, scheds, orders, limit){
  var out = [];
  (notes||[]).forEach(function(n){ out.push({ kind:'note', ts:proNoteTs_(n.time), when:n.time||'', title:(n.user?n.user+': ':'')+String(n.text||'').slice(0,140) }); });
  (scheds||[]).forEach(function(x){ var d = proYmd_(x.date); if (!d) return;
    out.push({ kind:'sched', ts:new Date(d+'T00:00:00').getTime(), when:proDmy_(d), title:(x.done?'✓ ':'')+(x.customLabel||x.typeLabel||'Lịch hẹn')+(x.note?' — '+String(x.note).slice(0,100):'') }); });
  (orders||[]).forEach(function(o){
    var ts = null, when = '—';
    if (o.date instanceof Date && !isNaN(o.date)){ ts = o.date.getTime(); when = proDmy_(o.date.getFullYear()+'-'+String(o.date.getMonth()+1).padStart(2,'0')+'-'+String(o.date.getDate()).padStart(2,'0')); }
    else if (typeof o.date==='string' && proYmd_(o.date)){ ts = new Date(proYmd_(o.date)+'T00:00:00').getTime(); when = proDmy_(o.date); }
    else if (o.year){ var y = o.year<100?2000+o.year:o.year; ts = new Date(y,(o.month||1)-1,1).getTime(); when = (o.month?String(o.month).padStart(2,'0')+'/':'')+y; }
    out.push({ kind:'order', ts:ts, when:when, title:'Đơn '+(Number(o.revenue)||0).toLocaleString('vi-VN')+'đ'+((o.product||o.productDetail)?' — '+String(o.product||o.productDetail).slice(0,80):'') });
  });
  out.sort(function(a,b){ if (a.ts===null && b.ts===null) return 0; if (a.ts===null) return 1; if (b.ts===null) return -1; return b.ts-a.ts; });
  return out.slice(0, limit||30);
}
function proTimelineHtml_(items, total){
  if (!items.length) return '';
  return '<details class="pro-tl-d" style="margin:2px 0 8px"><summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--pro-ink);padding:4px 0">Dòng thời gian ('+total+')</summary><ul class="pro-tl" style="margin-top:8px">'
    + items.map(function(it){ return '<li class="'+it.kind+'"><span class="t-when">'+proEsc_(it.when)+'</span>'+proEsc_(it.title)+'</li>'; }).join('') + '</ul></details>';
}

// Gom dữ liệu 1 khách (dùng cho hồ sơ 360° và trợ lý AI): care, số đơn (ưu tiên Pos), đơn, ghi chú, lịch hẹn của khách, loại lịch
function proProfileData_(c){
  var care = careData[c.phone] || {};
  var ps = (typeof donStatsByPhone!=='undefined') ? donStatsByPhone[c.phone] : null;
  var nOrd = (_posStatsOn && ps) ? (Number(ps.n)||0) : (c.orders||[]).length;
  var types = (typeof SCHED_TYPES!=='undefined') ? SCHED_TYPES : [];
  var mine = (typeof schedules!=='undefined' ? schedules : []).filter(function(x){ return x.phone===c.phone; })
    .map(function(x){ var t = types.find(function(y){ return y.key===x.type; }); return Object.assign({}, x, { typeLabel: t && t.label }); });
  var pos = (typeof _posOrdersCache!=='undefined') ? _posOrdersCache[c.phone] : null;
  var orders = (pos && pos.length) ? pos : (c.orders||[]);
  var notes = (typeof _parseNotes==='function') ? _parseNotes(care.note||c.careNote||'') : [];
  return { care: care, nOrd: nOrd, types: types, mine: mine, orders: orders, notes: notes };
}

// ── Gắn vào giao diện ──
function proRenderProfile_(){
  var host = document.getElementById('dp-pro');
  var on = document.documentElement.classList.contains('ui-pro');
  if (!on){ if (host) host.remove(); return; }
  var c = (typeof allCustomers!=='undefined') ? allCustomers.find(function(x){ return x.phone===currentPhone; }) : null;
  if (!c) return;
  if (!host){
    host = document.createElement('div'); host.id = 'dp-pro';
    var tabs = document.querySelector('#dp .dp-tabs'); if (!tabs) return;
    tabs.parentNode.insertBefore(host, tabs);
  }
  var D = proProfileData_(c), care = D.care, nOrd = D.nOrd, types = D.types, mine = D.mine;
  var wasOpen = !!(host.querySelector('details.pro-tl-d') && host.querySelector('details.pro-tl-d').open);
  var tl = proTimeline_(D.notes, mine, D.orders, 30), tlTotal = D.notes.length + mine.length + D.orders.length;
  host.innerHTML = proStageHtml_(proStageModel_(CARE_STATUS_TREE, care.status||c.careStatus||''))
                 + proKpiHtml_(proDaysSinceLastOrder_(c.orders, new Date()), nOrd, _custRev_(c))
                 + proNextHtml_(proNextActions_(mine, c.phone, _ymd(new Date()), types, 3))
                 + proTimelineHtml_(tl, tlTotal);
  var det = host.querySelector('details.pro-tl-d'); if (det && wasOpen) det.open = true;
  host.onclick = function(e){ var g = e.target.closest && e.target.closest('[data-pro-go]'); if (!g) return;
    var tabEl = document.querySelectorAll('#dp .dp-tab')[1]; if (tabEl && typeof switchDpTab==='function') switchDpTab('schedule', tabEl); };
}
(function(){
  if (typeof openDp==='function'){ var _o = openDp; openDp = function(p){ var r = _o.apply(this, arguments); try{ proRenderProfile_(); }catch(e){ console.warn('[ui-pro]',e); } return r; }; }
  if (typeof renderDpTab==='function'){ var _r = renderDpTab; renderDpTab = function(t){ var r = _r.apply(this, arguments); try{ proRenderProfile_(); }catch(e){ console.warn('[ui-pro]',e); } return r; }; }
})();
if (typeof module!=='undefined') module.exports = { proProfileData_, proNoteTs_, proNextActions_, proNextHtml_, proTimeline_, proTimelineHtml_, proStageModel_, proDaysSinceLastOrder_, proKpiHtml_, proStageHtml_ };

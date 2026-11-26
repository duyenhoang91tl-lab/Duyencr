/* GIAO DIỆN PRO — P2: Hồ sơ khách 360° (chạy khi <html class="ui-pro"> — nay luôn có sẵn trong index.html; giữ kiểm tra này như lớp bảo vệ).
   Bước 1: thanh giai đoạn (từ CARE_STATUS_TREE) + ô số (ngày từ đơn cuối, số đơn, doanh thu).
   Không sửa openDp/renderDpTab gốc: chỉ bọc lại và chèn khối #dp-pro giữa .dp-hdr và .dp-tabs. */

// ── Hàm thuần (test được bằng Node) ──
// Làm phẳng cây Tình trạng CS ở CẤP 1 và đánh dấu giai đoạn hiện tại (node lá trùng status, hoặc node cha có con trùng status).
function proStageModel_(tree, status){
  var st = String(status||'').trim();
  function has(n){ if (n.value!==undefined && String(n.value)===st) return true; return (n.children||[]).some(has); }
  // R14: kèm `value` (node lá) hoặc `children` (node nhóm) để CS bấm đổi Tình trạng CS; label/cur giữ nguyên như cũ.
  return (tree||[]).map(function(n){
    var m = { label:n.label, cur: !!st && has(n) };
    if (n.children && n.children.length){
      m.children = n.children.filter(function(ch){ return ch && ch.value!==undefined && ch.value!==''; })
        .map(function(ch){ return { label: ch.label || ch.value, value: ch.value, cur: !!st && String(ch.value)===st }; });
    } else if (n.value!==undefined && n.value!=='') m.value = n.value;
    return m;
  });
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
// ── B3c: thông tin nhanh dưới 3 thẻ (docs/ROADMAP-CRM-MAU.md): mua gần nhất · dự kiến tái mua (= mua gần nhất + chu kỳ ở trang Cấu hình) · kênh ưu tiên · không nhận quảng bá ──
var PRO_PREF_CHANNELS = [ { v:'zalo', t:'Zalo' }, { v:'phone', t:'Điện thoại' }, { v:'facebook', t:'Facebook' }, { v:'sms', t:'SMS' } ];
function proLastOrderTs_(orders){
  var best = null;
  (orders||[]).forEach(function(o){
    var t = (o.date instanceof Date && !isNaN(o.date)) ? o.date.getTime() : (o.year ? new Date(o.year<100?2000+o.year:o.year, (o.month||1)-1, 1).getTime() : null);
    if (t!==null && (best===null || t>best)) best = t;
  });
  return best;
}
function proFactsHtml_(orders, custom, now, cycle){
  custom = custom || {}; now = now || new Date();
  var fmt = function(ms){ var d = new Date(ms), p = function(n){ return (n<10?'0':'')+n; }; return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear(); };
  var chip = function(txt, cls){ return '<span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:11.5px;margin:2px 4px 2px 0;'+(cls==='red'?'background:#fef2f2;color:#b91c1c;border:1px solid #fca5a5':cls==='warn'?'background:#fff7ed;color:#c2410c;border:1px solid #fdba74':'background:var(--surface2,#f3f4f6);color:var(--text);border:1px solid var(--border)')+'">'+txt+'</span>'; };
  var out = [], last = proLastOrderTs_(orders);
  if (last!==null){
    out.push(chip('🛒 Mua gần nhất: <b>'+fmt(last)+'</b>'));
    var due = last + (cycle||30)*86400000, late = Math.floor((now.getTime()-due)/86400000);
    out.push(late>=0 ? chip('🔄 Dự kiến tái mua: <b>'+fmt(due)+'</b>'+(late>0?' — quá '+late+' ngày':' — hôm nay'), late>0?'warn':'') : chip('🔄 Dự kiến tái mua: <b>'+fmt(due)+'</b> (còn '+(-late)+' ngày)'));
  }
  var pc = PRO_PREF_CHANNELS.find(function(x){ return x.v===custom.prefChannel; });
  if (pc) out.push(chip('⭐ Kênh ưu tiên: <b>'+pc.t+'</b>'));
  if (custom.noPromo) out.push(chip('🚫 Không nhận quảng bá', 'red'));
  return out.length ? '<div style="margin:2px 0 8px">'+out.join('')+'</div>' : '';
}
// opts.phone (R14) → các ô bấm được: ô lá (data-pro-stage-val) đổi ngay; ô nhóm (data-pro-stage-grp) mở hàng chọn mục con. Không có opts.phone → HTML y hệt bản cũ (chỉ xem).
function proStageHtml_(model, opts){
  if (!model.length) return '';
  var ph = opts && opts.phone ? String(opts.phone) : '';
  var esc = function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  if (!ph) return '<ul class="pro-stage">'+model.map(function(m){ return '<li class="'+(m.cur?'cur':'')+'" title="'+String(m.label).replace(/"/g,'&quot;')+'">'+String(m.label).replace(/</g,'&lt;')+'</li>'; }).join('')+'</ul>';
  var subs = '';
  var lis = model.map(function(m, i){
    var act = '', tip = esc(m.label);
    if (m.children && m.children.length){ act = ' role="button" tabindex="0" data-pro-stage-grp="'+i+'" aria-expanded="false"'; tip += ' — bấm để chọn mục con'; 
      subs += '<div class="pro-stage-sub" data-pro-stage-sub="'+i+'" hidden>'+m.children.map(function(ch){
        return '<button type="button" class="pro-stage-opt'+(ch.cur?' cur':'')+'" data-pro-stage-val="'+esc(ch.value)+'">'+esc(ch.label)+'</button>'; }).join('')+'</div>'; }
    else if (m.value!==undefined){ act = ' role="button" tabindex="0" data-pro-stage-val="'+esc(m.value)+'"'; tip += ' — bấm để chuyển Tình trạng CS sang mục này'; }
    return '<li class="'+(m.cur?'cur':'')+'" title="'+tip+'"'+act+'>'+esc(m.label)+'</li>';
  }).join('');
  return '<div class="pro-stage-wrap" data-pro-stage-ph="'+esc(ph)+'"><ul class="pro-stage">'+lis+'</ul>'+subs+'</div>';
}
// R14: CS bấm 1 ô giai đoạn → đổi Tình trạng CS của khách. Hồ sơ đang mở tab Chăm sóc (có ô #cs-status): đặt giá trị rồi gọi ĐÚNG saveCare (cùng nhật ký, khung đơn chốt, tự nhảy Trạng thái KH, đồng bộ GAS).
// Không có form (tab khác / panel Chat): ghi thẳng careData theo đúng các bước của saveCare (nhật ký, KH tự nhảy, lưu máy, hàng đợi đồng bộ).
function proStageSet_(phone, value){
  if (!phone || value==null || value==='' || typeof careData==='undefined') return false;
  var ex = careData[phone] || {};
  if (String(ex.status||'') === String(value)) return false;   // bấm đúng mục đang chọn → không làm gì
  var sel = document.getElementById('cs-status');
  var formOpen = !!sel && typeof currentPhone!=='undefined' && currentPhone===phone && Array.prototype.some.call(sel.options, function(o){ return o.value===String(value); });
  if (formOpen){
    sel.value = String(value);
    if (typeof _hOnCsStatusChange_==='function') _hOnCsStatusChange_();
    saveCare(phone);
  } else {
    if (typeof logAudit==='function') logAudit('status', phone, ex.status||'(trống)', String(value));
    var kh = ex.khStatus || (typeof _hAutoKh_==='function' ? _hAutoKh_(String(value)) : '') || '';
    careData[phone] = Object.assign({}, ex, { status:String(value), khStatus:kh });
    if (typeof _touchCare==='function') _touchCare(phone);
    if (typeof saveLS==='function') saveLS('ome_care', careData);
    if (typeof _invalidateFilterCache==='function') _invalidateFilterCache();
    var c = (typeof allCustomers!=='undefined') ? allCustomers.find(function(x){ return x.phone===phone; }) : null;
    if (c) c.careStatus = String(value);
    if (typeof updateStats==='function') updateStats();
    if (typeof updateSidebarBadges==='function') updateSidebarBadges();
    if (typeof applyFilters==='function') applyFilters();
    if (typeof gsUrl!=='undefined' && gsUrl && typeof queueCareSync==='function') queueCareSync(phone);
    var chot = false; try { chot = typeof _hIsChot_==='function' && _hIsChot_(String(value)); } catch(e){}
    if (typeof toast==='function') toast('✓ Đã chuyển Tình trạng CS → '+(typeof careStatusFullLabel==='function' ? careStatusFullLabel(String(value)) : value)+(chot?' (mở tab Chăm sóc để nhập doanh thu đơn chốt)':''));
  }
  try { proRenderProfile_(); } catch(e){}
  try {
    var conv = (typeof window!=='undefined') ? window._proChatConv_ : null;
    if (conv && typeof proChatInfoRender_==='function' && typeof proChatFindCustomer_==='function'){ var cc = proChatFindCustomer_(conv.phone); if (cc && cc.phone===phone) proChatInfoRender_(conv); }
  } catch(e){}
  return true;
}
// Bấm ô nhóm → bật/tắt hàng mục con của nhóm đó (đóng các nhóm khác); bấm ô lá hoặc mục con → đổi tình trạng.
function proStageClick_(el){
  if (!el) return;
  var wrap = el.closest ? el.closest('[data-pro-stage-ph]') : null; if (!wrap) return;
  var grp = el.getAttribute('data-pro-stage-grp');
  if (grp!==null){
    wrap.querySelectorAll('[data-pro-stage-sub]').forEach(function(d){ var on = d.getAttribute('data-pro-stage-sub')===grp && d.hidden; d.hidden = !on; });
    wrap.querySelectorAll('[data-pro-stage-grp]').forEach(function(l){ l.setAttribute('aria-expanded', String(l.getAttribute('data-pro-stage-grp')===grp && !wrap.querySelector('[data-pro-stage-sub="'+grp+'"]').hidden)); });
    return;
  }
  var v = el.getAttribute('data-pro-stage-val'); if (v===null) return;
  proStageSet_(wrap.getAttribute('data-pro-stage-ph'), v);
}
if (typeof document!=='undefined' && typeof window!=='undefined' && !window._proStageBound_){
  window._proStageBound_ = true;
  document.addEventListener('click', function(e){ var t = e.target && e.target.closest ? e.target.closest('[data-pro-stage-grp],[data-pro-stage-val]') : null; if (t) proStageClick_(t); });
  document.addEventListener('keydown', function(e){ if (e.key!=='Enter' && e.key!==' ') return; var t = e.target && e.target.closest ? e.target.closest('li[data-pro-stage-grp],li[data-pro-stage-val]') : null; if (!t) return; e.preventDefault(); proStageClick_(t); });
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
  return '<details class="pro-tl-d" style="margin:2px 0 8px"><summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--pro-ink);padding:4px 0">Dòng thời gian ('+total+')</summary><ul class="pro-tl" style="margin-top:8px;max-height:calc(var(--vh,1vh)*48);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain">'
    + items.map(function(it){ return '<li class="'+it.kind+'"><span class="t-when">'+proEsc_(it.when)+'</span>'+proEsc_(it.title)+'</li>'; }).join('') + '</ul></details>';
}

// ── R5b (2026-11-15): thanh thao tác nhanh đầu hồ sơ — Gọi · Zalo · Ghi chú · Đặt lịch · Tạo đơn ──
// Gọi = tel:, Zalo = zalo.me/<SĐT> (tab mới); 3 nút còn lại chuyển sang tab tương ứng của hồ sơ và đưa con trỏ vào đúng ô (xem proQuickGo_).
// SĐT chỉ giữ chữ số (và "+" đầu) → không chèn được ký tự lạ vào href. Không có chữ số nào → không vẽ thanh (tránh nút gọi vào hư không).
function proQuickPhone_(phone){ var p = String(phone==null?'':phone).trim(), plus = p.charAt(0)==='+', d = p.replace(/\D/g,''); return d ? (plus?'+':'')+d : ''; }
function proQuickActionsHtml_(phone){
  var p = proQuickPhone_(phone); if (!p) return '';
  var d = p.replace(/\D/g,'');
  return '<div class="pro-qa-bar" role="toolbar" aria-label="Thao tác nhanh">'
    + '<a class="pro-qa" href="tel:'+p+'" data-pro-qa="call">📞 Gọi</a>'
    + '<a class="pro-qa" href="https://zalo.me/'+d+'" target="_blank" rel="noopener" data-pro-qa="zalo">💬 Zalo</a>'
    + '<button type="button" class="pro-qa" data-pro-qa="note">📝 Ghi chú</button>'
    + '<button type="button" class="pro-qa" data-pro-qa="sched">📅 Đặt lịch</button>'
    + '<button type="button" class="pro-qa" data-pro-qa="order">🛒 Tạo đơn</button></div>';
}
// Chỉ số tab trong #dp .dp-tab (khớp _order trong renderDpTab): care 0 · schedule 1 · history 2
function proQuickGo_(kind){
  var tabs = document.querySelectorAll('#dp .dp-tab'), go = function(i, key){ if (tabs[i] && typeof switchDpTab==='function') switchDpTab(key, tabs[i]); };
  if (kind==='note'){ go(0,'care'); if (typeof dpAccShow_==='function') dpAccShow_('care'); var n = document.getElementById('cs-note-new'); if (n){ n.focus(); if (n.scrollIntoView) n.scrollIntoView({ block:'center' }); } }
  else if (kind==='sched'){ go(1,'schedule'); if (typeof dpAccShow_==='function') dpAccShow_('sched'); var t = document.getElementById('new-snote'); if (t) t.focus(); }
  else if (kind==='order'){ go(2,'history'); var f = document.getElementById('add-order-form');
    if (f && f.style.display==='none' && typeof _toggleAddOrderForm==='function') _toggleAddOrderForm();   // đã mở rồi thì KHÔNG bật/tắt lại (hàm gốc là toggle)
    var pr = document.getElementById('mo-product'); if (pr){ pr.focus(); if (pr.scrollIntoView) pr.scrollIntoView({ block:'center' }); } }
}
// R8c: khối "Mức quan tâm" (nóng/ấm/nguội + điểm + LÝ DO) và 1 gợi ý "việc tiếp theo" có nút hành động (dùng lại data-pro-qa của thanh nhanh). s = lsScore_, step = lsNextStep_. Thiếu s → ''.
function proLeadHtml_(s, step){
  if (!s || !s.level) return '';
  var cls = { hot:'ok', warm:'warn', cold:'bad' }, ico = { hot:'🔥', warm:'🌤', cold:'🧊' };
  var why = (s.reasons||[]).slice(0, 4).map(proEsc_).join(' · ');
  return '<div class="pro-lead" id="pro-lead"><div class="pro-card-h" style="margin:4px 0 6px">Mức quan tâm</div>'
    + '<div class="pro-lead-row"><span class="pro-chip '+(cls[s.level]||'')+'">'+(ico[s.level]||'')+' '+proEsc_(s.label||'')+' · '+(Number(s.score)||0)+' điểm</span>'+(s.risk ? '<span class="pro-chip bad">Sắp mất</span>' : '')+'</div>'
    + (why ? '<div class="pro-lead-why">'+why+'</div>' : '')
    + (step ? '<div class="pro-next"><span class="n-pct">→</span><span><b>Gợi ý:</b> '+proEsc_(step.text)+'<br><span style="color:var(--muted)">'+proEsc_(step.why)+'</span></span>'
        + (step.go ? '<button type="button" class="pro-qa" data-pro-qa="'+proEsc_(step.go)+'">'+proEsc_(step.act||'Mở')+'</button>' : '')+'</div>' : '')
    + '</div>';
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

// Dòng thời gian lấy đơn từ _posOrdersCache (đơn Pos, ĐỦ) nếu có, không thì c.orders (đơn Base, thường thiếu). Cache này trước đây CHỈ được tải khi CS mở tab
// "Lịch sử" (js/03 renderHistTab) → mở hồ sơ ở tab Chăm sóc thì dòng thời gian chỉ thấy 1 đơn Base trong khi KPI báo 9 đơn (số đơn lấy từ donStatsByPhone).
// Nay tự gọi tải đơn Pos 1 lần/khách rồi vẽ lại hồ sơ khi xong (thăm dò 0,5s, tối đa ~20s). Không tải được → giữ nguyên đơn Base như cũ.
function proEnsurePosOrders_(phone){
  try {
    if (!phone || typeof _loadPosOrdersForPhone_!=='function' || typeof _posOrdersState==='undefined' || _posOrdersState[phone]) return;
    _loadPosOrdersForPhone_(phone);
    if (_posOrdersState[phone]!=='loading') return;   // bị bỏ qua (khách chưa có đơn Pos) → không cần chờ
    var n = 0, tm = setInterval(function(){
      n++;
      if (typeof currentPhone!=='undefined' && currentPhone!==phone){ clearInterval(tm); return; }
      if (_posOrdersState[phone]==='loading' && n<40) return;
      clearInterval(tm);
      if (_posOrdersState[phone]==='done' && typeof currentPhone!=='undefined' && currentPhone===phone) { try{ proRenderProfile_(); }catch(e){} }
    }, 500);
  } catch(e){ console.warn('[ui-pro] pos orders',e); }
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
  var tl = proTimeline_(D.notes, mine, D.orders, 200), tlTotal = D.notes.length + mine.length + D.orders.length;
  proEnsurePosOrders_(c.phone);   // đơn Pos chỉ tải khi mở tab Lịch sử → hồ sơ tự tải để dòng thời gian đủ đơn
  var leadHtml = ''; try { if (typeof lsScore_==='function'){ var ls_ = lsScore_(c, mine, Date.now()); leadHtml = proLeadHtml_(ls_, typeof lsNextStep_==='function' ? lsNextStep_(ls_, c) : null); } } catch(e){ leadHtml = ''; }   // R8c
  host.innerHTML = proQuickActionsHtml_(c.phone)
                 + leadHtml
                 + proStageHtml_(proStageModel_(CARE_STATUS_TREE, care.status||c.careStatus||''), { phone: c.phone })
                 + proKpiHtml_(proDaysSinceLastOrder_(c.orders, new Date()), nOrd, _custRev_(c))
                 + proFactsHtml_(c.orders, care.custom||c.custom, new Date(), (typeof _hmCfg==='function'?_hmCfg().cycle:30))
                 + proNextHtml_(proNextActions_(mine, c.phone, _ymd(new Date()), types, 3))
                 + proTimelineHtml_(tl, tlTotal);
  var det = host.querySelector('details.pro-tl-d'); if (det && wasOpen) det.open = true;
  host.onclick = function(e){
    var q = e.target.closest && e.target.closest('button[data-pro-qa]'); if (q){ proQuickGo_(q.getAttribute('data-pro-qa')); return; }   // R5b (Gọi/Zalo là thẻ <a> → trình duyệt tự xử lý)
    var g = e.target.closest && e.target.closest('[data-pro-go]'); if (!g) return;
    var tabEl = document.querySelectorAll('#dp .dp-tab')[1]; if (tabEl && typeof switchDpTab==='function') switchDpTab('schedule', tabEl); };
}
(function(){
  if (typeof openDp==='function'){ var _o = openDp; openDp = function(p){ var r = _o.apply(this, arguments); try{ proRenderProfile_(); }catch(e){ console.warn('[ui-pro]',e); } return r; }; }
  if (typeof renderDpTab==='function'){ var _r = renderDpTab; renderDpTab = function(t){ var r = _r.apply(this, arguments); try{ proRenderProfile_(); }catch(e){ console.warn('[ui-pro]',e); } return r; }; }
})();
if (typeof module!=='undefined') module.exports = { proProfileData_, proNoteTs_, proNextActions_, proNextHtml_, proTimeline_, proTimelineHtml_, proStageModel_, proDaysSinceLastOrder_, proKpiHtml_, proStageHtml_, proStageSet_, proStageClick_, proQuickPhone_, proQuickActionsHtml_, proLeadHtml_, proEnsurePosOrders_ };

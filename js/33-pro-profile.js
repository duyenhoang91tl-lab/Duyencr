/* GIAO DIỆN PRO — P2: Hồ sơ khách 360° (chỉ chạy khi <html class="ui-pro">, bật bằng ?ui=pro).
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
   + '<div class="pro-kpi purple"><span class="k-l">Doanh thu</span><span class="k-v" style="font-size:22px">'+f(rev)+'</span><span class="k-s">đ</span></div>'
   + '</div>';
}
function proStageHtml_(model){
  if (!model.length) return '';
  return '<ul class="pro-stage">'+model.map(function(m){ return '<li class="'+(m.cur?'cur':'')+'" title="'+String(m.label).replace(/"/g,'&quot;')+'">'+String(m.label).replace(/</g,'&lt;')+'</li>'; }).join('')+'</ul>';
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
  var care = careData[c.phone] || {};
  var ps = (typeof donStatsByPhone!=='undefined') ? donStatsByPhone[c.phone] : null;
  var nOrd = (_posStatsOn && ps) ? (Number(ps.n)||0) : (c.orders||[]).length;
  host.innerHTML = proStageHtml_(proStageModel_(CARE_STATUS_TREE, care.status||c.careStatus||''))
                 + proKpiHtml_(proDaysSinceLastOrder_(c.orders, new Date()), nOrd, _custRev_(c));
}
(function(){
  if (typeof openDp==='function'){ var _o = openDp; openDp = function(p){ var r = _o.apply(this, arguments); try{ proRenderProfile_(); }catch(e){ console.warn('[ui-pro]',e); } return r; }; }
  if (typeof renderDpTab==='function'){ var _r = renderDpTab; renderDpTab = function(t){ var r = _r.apply(this, arguments); try{ proRenderProfile_(); }catch(e){ console.warn('[ui-pro]',e); } return r; }; }
})();
if (typeof module!=='undefined') module.exports = { proStageModel_, proDaysSinceLastOrder_, proKpiHtml_, proStageHtml_ };

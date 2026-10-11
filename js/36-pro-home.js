/* GIAO DIỆN PRO — P1: Trang chủ (khối chèn ĐẦU màn "🏠 Tổng quan" của js/31). Dùng nền thiết kế css/06-pro.css (pro-card/pro-kpi/pro-next/pro-gauge).
   Không sửa js/31: bọc _ovRender, vẽ màn cũ xong mới chèn #pro-home; lỗi ở khối này bị try/catch, KHÔNG làm hỏng màn cũ.
   Số liệu: _ovScope (phạm vi theo vai trò; % KPI = target/pct có sẵn trong orgOverview), scopedCustomers() (đã memo — chỉ ĐẾM tổng hợp, không vẽ danh sách vì ~136k khách),
   _dueReminders() (lịch đến hạn của CHÍNH tài khoản), _ttCards() (đơn Base kẹt giai đoạn, js/34). */

function proEsc_(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }

// ── Hàm thuần (test được bằng Node) ──
// Đồng hồ nửa vòng. pct null/rỗng/NaN → "—" và không tô vòng. Vòng tô tối đa 100% nhưng số hiện là số thật (vd 130%). Ngưỡng màu cùng _ovPctBar: ≥100 xanh, ≥70 cam, còn lại đỏ.
function proGaugeHtml_(pct, label, sub){
  var has = pct!==null && pct!==undefined && pct!=='' && !isNaN(Number(pct)), n = has ? Number(pct) : 0;
  var v = Math.max(0, Math.min(100, n)), C = Math.PI*52, arc = 'M18 74 A52 52 0 0 1 122 74';
  var tone = n>=100 ? 'ok' : n>=70 ? 'warn' : 'bad';
  return '<div class="pro-gauge"><svg viewBox="0 0 140 84" role="img" aria-label="'+proEsc_(label)+'">'
    + '<path class="g-bg" d="'+arc+'" fill="none" stroke-width="12" stroke-linecap="round"/>'
    + (has && v>0 ? '<path class="g-fg '+tone+'" d="'+arc+'" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="'+(v/100*C).toFixed(1)+' '+C.toFixed(1)+'"/>' : '')
    + '<text class="g-v" x="70" y="68" text-anchor="middle">'+(has ? (Math.round(n*10)/10)+'%' : '—')+'</text></svg>'
    + '<div class="pro-gauge-l">'+proEsc_(label)+'</div>'+(sub?'<div class="pro-gauge-s">'+proEsc_(sub)+'</div>':'')+'</div>';
}
// Phân bố tình trạng chăm sóc: top N theo số khách (thanh dài theo khách nhiều nhất, % theo TỔNG). Trạng thái trống → "Chưa có trạng thái".
function proStatusBarsHtml_(list, topN){
  list = list||[]; var cnt = {}, total = list.length;
  for (var i=0;i<total;i++){ var k = (list[i] && list[i].careStatus) || 'Chưa có trạng thái'; cnt[k] = (cnt[k]||0)+1; }
  var arr = Object.keys(cnt).map(function(k){ return [k,cnt[k]]; }).sort(function(a,b){ return b[1]-a[1]; }).slice(0, topN||8);
  if (!arr.length) return '<div class="pro-muted">Chưa có dữ liệu khách.</div>';
  var mx = arr[0][1]||1;
  return arr.map(function(a){
    var p = Math.round(a[1]/total*1000)/10;
    return '<div class="pro-bar-row"><div class="pro-bar-lbl" title="'+proEsc_(a[0])+'">'+proEsc_(a[0])+'</div><div class="pro-bar"><i style="width:'+Math.max(2,Math.round(a[1]/mx*100))+'%"></i></div><div class="pro-bar-n">'+a[1].toLocaleString('vi-VN')+' · '+p+'%</div></div>';
  }).join('') + '<div class="pro-muted" style="margin-top:6px">Tổng '+total.toLocaleString('vi-VN')+' khách trong phạm vi của bạn.</div>';
}
// Khuyến nghị: quá hạn (date < today) → hôm nay → đơn Base kẹt (nếu đã tải) → nếu không có gì thì báo xong việc. go = tab để mở khi bấm.
function proRecoItems_(due, today, tasks){
  due = due||[]; var out = [], over = 0, now = 0;
  due.forEach(function(x){ var d = String((x&&x.date)||'').slice(0,10); if (!today) now++; else if (d < today) over++; else if (d === today) now++; });   // ngày tương lai (nếu lọt vào) KHÔNG tính; cắt 10 ký tự phòng ngày có kèm giờ
  if (over) out.push({ n:over, tone:'bad', text:'khách có lịch hẹn <b>QUÁ HẠN</b> — gọi sớm để không mất khách', go:'overdue', act:'Xem quá hạn' });
  if (now) out.push({ n:now, tone:'', text:'khách có lịch hẹn <b>HÔM NAY</b>', go:'schedule', act:'Xem lịch hôm nay' });
  (tasks||[]).forEach(function(t){ if (t && t.count>0) out.push({ n:t.count, tone:'bad', text:proEsc_(t.title||'Đơn cần xử lý'), go:'', act:'' }); });
  if (!out.length) out.push({ n:'✓', tone:'', text:'Không còn việc đến hạn — bạn đã xử lý xong hôm nay.', go:'', act:'' });
  return out;
}
function proRecoHtml_(items){
  return (items||[]).map(function(it){
    return '<div class="pro-next'+(it.tone==='bad'?' bad':'')+'"><span class="n-pct">'+proEsc_(it.n)+'</span><span>'+it.text+'</span>'
      + (it.go ? '<span class="n-act" data-home-go="'+proEsc_(it.go)+'">'+proEsc_(it.act)+'</span>' : '')+'</div>';
  }).join('');
}
// o: { label, from, to, c (số liệu tổng hợp của phạm vi), money(fn), ratingHtml, barsHtml, recoHtml }
function proHomeHtml_(o){
  var c = o.c||{}, money = o.money||String, num = function(v){ return (v===null||v===undefined) ? '—' : Number(v).toLocaleString('vi-VN'); };
  return '<div class="pro-home" id="pro-home"><div class="pro-row">'
    + '<div class="pro-card"><div class="pro-card-h"><span>🎯 Hiệu suất · '+proEsc_(o.label)+'</span><span class="pro-sp pro-muted">'+proEsc_(o.from)+' → '+proEsc_(o.to)+'</span></div>'
    +   '<div class="pro-gauges">'+proGaugeHtml_(c.pct,'% KPI','đạt mục tiêu doanh số')+proGaugeHtml_(c.tyLeChot,'Tỷ lệ chốt','trên số khách đã tương tác')+'</div>'
    +   '<div class="pro-foot"><span>👥 '+num(c.soNguoi)+' nhân sự</span><span>'+(o.ratingHtml||'')+'</span></div></div>'
    + '<div class="pro-card"><div class="pro-card-h"><span>💡 Khuyến nghị hôm nay</span><span class="pro-sp pro-muted">việc nên làm ngay</span></div>'+(o.recoHtml||'')+'</div></div>'
    + '<div class="pro-grid">'
    +   '<div class="pro-kpi blue"><span class="k-l">Doanh thu</span><span class="k-v">'+proEsc_(money(c.revenue))+'</span></div>'
    +   '<div class="pro-kpi green"><span class="k-l">Số đơn</span><span class="k-v">'+num(c.orders)+'</span><span class="k-s">đơn thất bại: '+num(c.failed)+'</span></div>'
    +   '<div class="pro-kpi orange"><span class="k-l">Đơn TB / ngày</span><span class="k-v">'+num(c.ordersPerDay)+'</span></div>'
    +   '<div class="pro-kpi purple"><span class="k-l">Giá trị đơn TB</span><span class="k-v">'+proEsc_(money(c.aov))+'</span></div></div>'
    + '<div class="pro-card"><div class="pro-card-h"><span>📊 Tình trạng chăm sóc</span><span class="pro-sp pro-muted">top 8 theo số khách</span></div>'+(o.barsHtml||'')+'</div></div>';
}

// ── Chèn vào màn Tổng quan (cần trình duyệt) ──
function proHomeGo_(tab){
  var el = document.querySelector('[data-bar-id="tab-'+tab+'"]');
  if (el && typeof switchTab==='function') switchTab(tab, el);
}
function proHomeRender_(){
  if (!document.documentElement.classList.contains('ui-pro')) return;
  var body = document.getElementById('ov-body'), d = (typeof _ov!=='undefined' && _ov) ? _ov.data : null;
  if (!body || !d) return;
  var s = _ovScope(d), safe = function(f, dflt){ try { return f(); } catch(e){ return dflt; } };
  var list = typeof scopedCustomers==='function' ? safe(scopedCustomers, []) : [];
  var due = typeof _dueReminders==='function' ? safe(_dueReminders, []) : [];
  var tasks = typeof _ttCards==='function' ? safe(_ttCards, []) : [];
  var html = proHomeHtml_({ label:s.label, from:d.from, to:d.to, c:s.company, money:(typeof _ovMoney==='function'?_ovMoney:String),
    ratingHtml:(typeof _ovRatingCounts==='function' ? _ovRatingCounts(s.company||{}) : ''),
    barsHtml:proStatusBarsHtml_(list, 8), recoHtml:proRecoHtml_(proRecoItems_(due, typeof _remDateStr==='function'?_remDateStr():'', tasks)) });
  var old = document.getElementById('pro-home'); if (old) old.remove();
  body.insertAdjacentHTML('afterbegin', html);
  var host = document.getElementById('pro-home');
  host.onclick = function(e){ var g = e.target.closest && e.target.closest('[data-home-go]'); if (g) proHomeGo_(g.getAttribute('data-home-go')); };
  // Hàng ô số cũ trùng số liệu → ẩn; chỉ ẩn khi đúng là hàng chứa .ov-card (chế độ CS 'self' không có hàng này, giữ nguyên lời nhắn)
  var nx = host.nextElementSibling; if (nx && nx.querySelector('.ov-card')) nx.classList.add('pro-hide-old');
}
(function(){
  if (typeof _ovRender==='function' && !_ovRender._proHome){
    var _o = _ovRender;
    _ovRender = function(){ var r = _o.apply(this, arguments); try { proHomeRender_(); } catch(e){ console.warn('[ui-pro]', e); } return r; };
    _ovRender._proHome = true;
  }
})();
if (typeof module!=='undefined') module.exports = { proGaugeHtml_, proStatusBarsHtml_, proRecoItems_, proRecoHtml_, proHomeHtml_ };

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
// ── R4b/R4c (2026-11-15): so kỳ trước + cảnh báo tụt. NGƯỠNG MẶC ĐỊNH (chưa Duyên chốt — đổi tại đây):
var PRO_DROP_PCT = 20;          // doanh thu sale tụt ≥ 20% so kỳ trước → cảnh báo
var PRO_MIN_PREV_REV = 5000000; // chỉ xét sale có doanh thu kỳ trước ≥ 5 triệu (tránh nhiễu số nhỏ)
var PRO_CLOSE_DROP_PT = 10;     // tỷ lệ chốt tụt ≥ 10 điểm % so kỳ trước
var PRO_MIN_TT = 30;            // ... và cả 2 kỳ đều có ≥ 30 tin nhắn/khách tương tác (mẫu đủ lớn)
function _proDayMs_(ymd){ return Date.parse(String(ymd).slice(0,10)+'T00:00:00Z'); }
function _proYmd_(ms){ return new Date(ms).toISOString().slice(0,10); }
// Kỳ liền trước, CÙNG số ngày. Kỳ hiện tại bị cắt ở hôm nay (khớp orgOverview_ ở GAS: effTo) để không so 10 ngày với 30 ngày. Trả null nếu ngày sai.
function proPrevRange_(from, to, today){
  var f = _proDayMs_(from), t = _proDayMs_(to);
  if (isNaN(f) || isNaN(t) || f > t) return null;
  if (today){ var td = _proDayMs_(today); if (!isNaN(td) && t > td) t = Math.max(f, td); }
  var len = Math.round((t - f)/86400000) + 1, pt = f - 86400000, pf = pt - (len-1)*86400000;
  return { from:_proYmd_(pf), to:_proYmd_(pt), days:len };
}
// % thay đổi (làm tròn 0,1). Kỳ trước 0/thiếu → null (không chia cho 0, không bịa số).
function proDeltaPct_(cur, prev){
  var c = Number(cur), p = Number(prev);
  if (cur===null||cur===undefined||prev===null||prev===undefined||isNaN(c)||isNaN(p)||p<=0) return null;
  return Math.round((c-p)/p*1000)/10;
}
function _proFmtNum_(n){ return String(Math.abs(n)).replace('.',','); }
// HTML mũi tên + số. unit '%' (so tương đối) hoặc ' điểm' (hiệu số điểm %). null → rỗng. 0 → "= kỳ trước".
function proDeltaHtml_(d, unit){
  if (d===null||d===undefined||isNaN(Number(d))) return '';
  d = Number(d); if (d === 0) return '<span class="pro-d">= kỳ trước</span>';
  return '<span class="pro-d '+(d>0?'up':'down')+'">'+(d>0?'▲ ':'▼ ')+_proFmtNum_(d)+(unit||'%')+' so kỳ trước</span>';
}
// Hiệu số điểm giữa 2 tỷ lệ (vd chốt 32% vs 28% → +4). null nếu thiếu.
function proDeltaPts_(cur, prev){
  if (cur===null||cur===undefined||prev===null||prev===undefined||isNaN(Number(cur))||isNaN(Number(prev))) return null;
  return Math.round((Number(cur)-Number(prev))*10)/10;
}
// Cảnh báo tụt: so từng sale (khớp theo tên chuẩn hoá). Trả mảng mục cho khuyến nghị (đã sắp nặng nhất trước, tối đa 3 tên mỗi mục).
function proAlertItems_(curPeople, prevPeople, norm){
  norm = norm || function(x){ return String(x||'').trim().toLowerCase(); };
  var pm = {}, rev = [], cls = [];
  (prevPeople||[]).forEach(function(p){ if (p && p.name) pm[norm(p.name)] = p; });
  (curPeople||[]).forEach(function(c){
    var p = c && c.name ? pm[norm(c.name)] : null; if (!p) return;
    if ((p.revenue||0) >= PRO_MIN_PREV_REV){
      var d = proDeltaPct_(c.revenue||0, p.revenue);
      if (d !== null && d <= -PRO_DROP_PCT) rev.push({ name:c.name, d:d });
    }
    if ((c.tongTT||0) >= PRO_MIN_TT && (p.tongTT||0) >= PRO_MIN_TT){
      var dp = proDeltaPts_(c.tyLeChot, p.tyLeChot);
      if (dp !== null && dp <= -PRO_CLOSE_DROP_PT) cls.push({ name:c.name, d:dp });
    }
  });
  var out = [];
  function mk(arr, label, unit){
    if (!arr.length) return;
    arr.sort(function(a,b){ return a.d - b.d; });
    var top = arr.slice(0,3).map(function(x){ return proEsc_(x.name)+' ('+_proFmtNum_(x.d).replace(/^/,'−')+unit+')'; }).join(', ');
    out.push({ n:arr.length, tone:'bad', text:'<b>'+label+'</b> so kỳ trước: '+top+(arr.length>3?' …':''), go:'', act:'' });
  }
  mk(rev, 'sale tụt doanh số ≥'+PRO_DROP_PCT+'%', '%');
  mk(cls, 'sale tụt tỷ lệ chốt ≥'+PRO_CLOSE_DROP_PT+' điểm', ' điểm');
  return out;
}
var PRO_UNREPLIED_CAP = 100;   // = limit của pkChatInbox_ khi có bộ lọc (gas_v13.js)
// Khuyến nghị: quá hạn (date < today) → hôm nay → đơn Base kẹt (nếu đã tải) → nếu không có gì thì báo xong việc. go = tab để mở khi bấm.
function proRecoItems_(due, today, tasks, unreplied, alerts){
  due = due||[]; var out = [], over = 0, now = 0;
  due.forEach(function(x){ var d = String((x&&x.date)||'').slice(0,10); if (!today) now++; else if (d < today) over++; else if (d === today) now++; });   // ngày tương lai (nếu lọt vào) KHÔNG tính; cắt 10 ký tự phòng ngày có kèm giờ
  if (over) out.push({ n:over, tone:'bad', text:'khách có lịch hẹn <b>QUÁ HẠN</b> — gọi sớm để không mất khách', go:'overdue', act:'Xem quá hạn' });
  if (now) out.push({ n:now, tone:'', text:'khách có lịch hẹn <b>HÔM NAY</b>', go:'schedule', act:'Xem lịch hôm nay' });
  (tasks||[]).forEach(function(t){ if (t && t.count>0) out.push({ n:t.count, tone:'bad', text:proEsc_(t.title||'Đơn cần xử lý'), go:'', act:'' }); });
  // R4a (2026-11-15): hội thoại Pancake chưa trả lời (toàn hộp thư, từ GAS pkChatInbox un=new). null/0/NaN → không hiện; ≥ PRO_UNREPLIED_CAP → "N+" vì server chỉ trả tối đa 100 hội thoại mỗi lần lọc.
  var ur = Number(unreplied);
  if (ur > 0) out.push({ n:(ur >= PRO_UNREPLIED_CAP ? PRO_UNREPLIED_CAP+'+' : ur), tone:'bad', text:'hội thoại Pancake <b>CHƯA TRẢ LỜI</b> — khách đang chờ', go:'chat', act:'Mở chat' });
  (alerts||[]).forEach(function(a){ if (a && a.n) out.push(a); });   // R4c
  if (!out.length) out.push({ n:'✓', tone:'', text:'Không còn việc đến hạn — bạn đã xử lý xong hôm nay.', go:'', act:'' });
  return out;
}
// R8b: mục cảnh báo "khách SẮP MẤT" (nguội quá LS_COLD_DAYS ngày + từng mua + hạng ≥ Tiềm năng; js/77). rk = lsAtRisk_(...) → { n, items:[{c}] } (items đã xếp doanh thu cao trước). n=0/thiếu → null. Tên khách escape; tối đa 3 tên + "…".
function proRiskAlert_(rk, cold){
  if (!rk || !(rk.n > 0)) return null;
  var names = (rk.items||[]).slice(0, 3).map(function(x){ return proEsc_((x && x.c && x.c.name) || ''); }).filter(Boolean);
  return { n: rk.n, tone:'bad', text:'khách <b>SẮP MẤT</b> — đã từng mua nhưng hơn '+(cold||60)+' ngày chưa chăm'+(names.length ? ': '+names.join(', ')+(rk.n > names.length ? '…' : '') : ''), go:'atrisk', act:'Xem khách' };
}
function proRecoHtml_(items){
  return (items||[]).map(function(it){
    return '<div class="pro-next'+(it.tone==='bad'?' bad':'')+'"><span class="n-pct">'+proEsc_(it.n)+'</span><span>'+it.text+'</span>'
      + (it.go ? '<span class="n-act" data-home-go="'+proEsc_(it.go)+'">'+proEsc_(it.act)+'</span>' : '')+'</div>';
  }).join('');
}
// o: { label, from, to, c (số liệu tổng hợp của phạm vi), money(fn), ratingHtml, barsHtml, recoHtml }
function proHomeHtml_(o){
  var c = o.c||{}, pv = o.prev||null, dPt = pv ? proDeltaPts_(c.tyLeChot, pv.tyLeChot) : null, dl = function(k){ return pv ? proDeltaHtml_(proDeltaPct_(c[k], pv[k])) : ''; }, money = o.money||String, num = function(v){ return (v===null||v===undefined) ? '—' : Number(v).toLocaleString('vi-VN'); };
  return '<div class="pro-home" id="pro-home"><div class="pro-row">'
    + '<div class="pro-card"><div class="pro-card-h"><span>🎯 Hiệu suất · '+proEsc_(o.label)+'</span><span class="pro-sp pro-muted">'+proEsc_(o.from)+' → '+proEsc_(o.to)+'</span></div>'
    +   '<div class="pro-gauges">'+proGaugeHtml_(c.pct,'% KPI','đạt mục tiêu doanh số')+proGaugeHtml_(c.tyLeChot,'Tỷ lệ chốt', pv ? ('trên số khách đã tương tác'+(dPt!==null ? ' · '+(dPt>0?'▲ ':dPt<0?'▼ ':'')+(dPt===0?'= kỳ trước':_proFmtNum_(dPt)+' điểm so kỳ trước') : '')) : 'trên số khách đã tương tác')+'</div>'
    +   '<div class="pro-foot"><span>👥 '+num(c.soNguoi)+' nhân sự</span><span>'+(o.ratingHtml||'')+'</span></div></div>'
    + '<div class="pro-card" id="pro-reco"><div class="pro-card-h"><span>💡 Khuyến nghị hôm nay</span><span class="pro-sp pro-muted">việc nên làm ngay</span></div><div id="pro-reco-list">'+(o.recoHtml||'')+'</div></div></div>'
    + '<div class="pro-grid">'
    +   '<div class="pro-kpi blue"><span class="k-l">Doanh thu</span><span class="k-v">'+proEsc_(money(c.revenue))+'</span><span class="k-s">'+dl('revenue')+'</span></div>'
    +   '<div class="pro-kpi green"><span class="k-l">Số đơn</span><span class="k-v">'+num(c.orders)+'</span><span class="k-s">đơn thất bại: '+num(c.failed)+(pv ? ' · ' : '')+dl('orders')+'</span></div>'
    +   '<div class="pro-kpi orange"><span class="k-l">Đơn TB / ngày</span><span class="k-v">'+num(c.ordersPerDay)+'</span><span class="k-s">'+dl('ordersPerDay')+'</span></div>'
    +   '<div class="pro-kpi purple"><span class="k-l">Giá trị đơn TB</span><span class="k-v">'+proEsc_(money(c.aov))+'</span><span class="k-s">'+dl('aov')+'</span></div></div>'
    + '<div class="pro-card"><div class="pro-card-h"><span>📊 Tình trạng chăm sóc</span><span class="pro-sp pro-muted">top 8 theo số khách</span></div>'+(o.barsHtml||'')+'</div></div>';
}

// ── Chèn vào màn Tổng quan (cần trình duyệt) ──
function proHomeGo_(tab){
  if (tab === 'atrisk'){ if (typeof lsOpenList_ === 'function') lsOpenList_('risk'); return; }   // R8b: mở Danh sách KH lọc khách sắp mất
  var el = document.querySelector('[data-bar-id="tab-'+tab+'"]');
  if (el && typeof switchTab==='function') switchTab(tab, el);
}
// Số liệu KỲ TRƯỚC (cùng số ngày): gọi lại orgOverview cho kỳ liền trước (KHÔNG đổi GAS; server có cache nên kỳ đã xem trước đó trả nhanh). Ưu tiên lấy từ _ov.mem nếu người dùng đã xem kỳ đó. Cache theo khoảng; lỗi → null (ẩn mũi tên, KHÔNG báo lỗi).
var _proRisk = { key:'', val:null };   // R8b: cache cảnh báo khách sắp mất
var _proPrev = {};   // key 'from|to' → { d: data|null, at, busy }
function proPrevLoad_(range, cb){
  var key = range.from+'|'+range.to, e = _proPrev[key];
  if (e && (e.busy || Date.now()-e.at < 300000)) return;
  var m = (typeof _ov!=='undefined' && _ov && _ov.mem) ? _ov.mem[key] : null;
  if (m && m.d){ _proPrev[key] = { d:m.d, at:Date.now(), busy:false }; return; }
  if (typeof fetch!=='function' || typeof gsUrl==='undefined' || !gsUrl) return;
  _proPrev[key] = { d:null, at:0, busy:true };
  fetch(gsUrl + (gsUrl.indexOf('?')>-1 ? '&' : '?') + 'action=orgOverview&from='+range.from+'&to='+range.to, { redirect:'follow' })
    .then(function(r){ return r.json(); })
    .then(function(j){ _proPrev[key] = { d:(j && j.ok!==false && !j.error && j.people) ? j : null, at:Date.now(), busy:false }; })
    .catch(function(){ _proPrev[key] = { d:null, at:Date.now(), busy:false }; })
    .then(function(){ try { cb && cb(); } catch(x){} });
}
// Đếm hội thoại chưa trả lời: gọi GAS pkChatInbox (un=new, INBOX), token phiên tự kèm nhờ fetch wrapper (js/06). Cache 60s. Lỗi/hết phiên/không quyền chat → null (không hiện mục, KHÔNG báo lỗi trên Tổng quan).
var _proUr = { n: null, at: 0, busy: false };
function proUnrepliedLoad_(cb){
  if (typeof fetch!=='function' || typeof gsUrl==='undefined' || !gsUrl) return;
  if (Date.now() - _proUr.at < 60000 || _proUr.busy) return;
  _proUr.busy = true;
  fetch(gsUrl + (gsUrl.indexOf('?')>-1 ? '&' : '?') + 'action=pkChatInbox&un=new&type=INBOX', { redirect:'follow' })
    .then(function(r){ return r.json(); })
    .then(function(j){ _proUr.n = (j && !j.error && Array.isArray(j.conversations)) ? j.conversations.length : null; })
    .catch(function(){ _proUr.n = null; })
    .then(function(){ _proUr.at = Date.now(); _proUr.busy = false; try { cb && cb(_proUr.n); } catch(e){} });
}
function proHomeRender_(){
  if (!document.documentElement.classList.contains('ui-pro')) return;
  var body = document.getElementById('ov-body'), d = (typeof _ov!=='undefined' && _ov) ? _ov.data : null;
  if (!body || !d) return;
  var s = _ovScope(d), safe = function(f, dflt){ try { return f(); } catch(e){ return dflt; } };
  var list = typeof scopedCustomers==='function' ? safe(scopedCustomers, []) : [];
  var due = typeof _dueReminders==='function' ? safe(_dueReminders, []) : [];
  var tasks = typeof _ttCards==='function' ? safe(_ttCards, []) : [];
  var today_ = typeof _remDateStr==='function' ? _remDateStr() : '';
  var range_ = proPrevRange_(d.from, d.to, today_), pe_ = range_ ? _proPrev[range_.from+'|'+range_.to] : null, pd_ = pe_ && pe_.d ? pe_.d : null, ps_ = null, alerts_ = [];
  if (pd_){ try { ps_ = _ovScope(pd_); if (s.mode !== 'self') alerts_ = proAlertItems_(s.people, ps_.people, typeof _ovN==='function' ? _ovN : null); } catch(e){ ps_ = null; alerts_ = []; } }
  // R8b: khách sắp mất (cache theo số khách trong phạm vi + phiên bản dữ liệu + ngày + số lịch → đổi kỳ/vẽ lại Tổng quan không quét lại)
  try {
    if (typeof lsAtRisk_ === 'function'){
      var sch_ = (typeof schedules !== 'undefined' && schedules) ? schedules : [], rkKey = [list.length, (typeof _dataVersion !== 'undefined' ? _dataVersion : 0), today_, sch_.length, s.mode||''].join('#');
      if (_proRisk.key !== rkKey){ var by_ = {}; sch_.forEach(function(x){ if (x && !x.done && x.phone) (by_[x.phone] = by_[x.phone] || []).push(x); });
        var rk_ = lsAtRisk_(list, null, Date.now(), 3, null, by_); _proRisk = { key: rkKey, val: proRiskAlert_(rk_, typeof LS_COLD_DAYS !== 'undefined' ? LS_COLD_DAYS : 60) }; }
      if (_proRisk.val) alerts_ = alerts_.concat([_proRisk.val]);
    }
  } catch(e){}
  var html = proHomeHtml_({ label:s.label, from:d.from, to:d.to, c:s.company, money:(typeof _ovMoney==='function'?_ovMoney:String),
    ratingHtml:(typeof _ovRatingCounts==='function' ? _ovRatingCounts(s.company||{}) : ''),
    barsHtml:proStatusBarsHtml_(list, 8), prev:(ps_ ? ps_.company : null), recoHtml:proRecoHtml_(proRecoItems_(due, today_, tasks, _proUr.n, alerts_)) });
  var old = document.getElementById('pro-home'); if (old) old.remove();
  body.insertAdjacentHTML('afterbegin', html);
  var host = document.getElementById('pro-home');
  host.onclick = function(e){ var g = e.target.closest && e.target.closest('[data-home-go]'); if (g) proHomeGo_(g.getAttribute('data-home-go')); };
  // Hàng ô số cũ trùng số liệu → ẩn; chỉ ẩn khi đúng là hàng chứa .ov-card (chế độ CS 'self' không có hàng này, giữ nguyên lời nhắn)
  // Tải số hội thoại chưa trả lời (nếu cache cũ) rồi vẽ lại CHỈ danh sách khuyến nghị
  proUnrepliedLoad_(function(n){ var l = document.getElementById('pro-reco-list'); if (l) l.innerHTML = proRecoHtml_(proRecoItems_(due, today_, tasks, n, alerts_)); });
  if (range_ && !pd_) proPrevLoad_(range_, function(){ if (document.getElementById('pro-home')) proHomeRender_(); });   // tải kỳ trước 1 lần rồi vẽ lại (lần vẽ sau đã có cache → không lặp)
  var nx = host.nextElementSibling; if (nx && nx.querySelector('.ov-card')) nx.classList.add('pro-hide-old');
}
(function(){
  if (typeof _ovRender==='function' && !_ovRender._proHome){
    var _o = _ovRender;
    _ovRender = function(){ var r = _o.apply(this, arguments); try { proHomeRender_(); } catch(e){ console.warn('[ui-pro]', e); } return r; };
    _ovRender._proHome = true;
  }
})();
if (typeof module!=='undefined') module.exports = { proGaugeHtml_, proStatusBarsHtml_, proRecoItems_, proRecoHtml_, proHomeHtml_, PRO_UNREPLIED_CAP, proPrevRange_, proDeltaPct_, proDeltaPts_, proDeltaHtml_, proAlertItems_ };

/* GIAO DIỆN PRO — P4: thanh tab hồ sơ đang mở (dưới cùng) + dock phải + Trợ lý AI hỏi đáp về khách / doanh số.
   - Thanh tab: bọc openDp/closeDp (không sửa hàm gốc), nhớ tối đa 8 khách trong sessionStorage.
   - Trợ lý AI: gửi action=ai + crmAsk:true tới GAS (prompt hệ thống riêng _crmAskSystemPrompt_, gas v13.32+). Ngữ cảnh do web dựng từ số liệu
     NGƯỜI DÙNG ĐƯỢC PHÉP XEM (khách đã mở; Tổng quan qua _ovScope theo vai trò) và ẨN SĐT trước khi gửi. AI chỉ gợi ý, không tự ghi dữ liệu. */

// ── Hàm thuần (test được bằng Node) ──
var PRO_TABS_MAX = 8;
function proTabsAdd_(tabs, item, max){
  var out = (tabs||[]).filter(function(t){ return t.phone!==item.phone; });
  out.push({ phone:item.phone, name:item.name });
  return out.slice(-(max||PRO_TABS_MAX));
}
function proTabsRemove_(tabs, phone){ return (tabs||[]).filter(function(t){ return t.phone!==phone; }); }
// Ẩn số điện thoại trong văn bản tự do trước khi gửi AI: dãy bắt đầu 0/+84 dài ≥9 chữ số (cho phép cách/./-), hoặc ≥9 chữ số liền.
function proScrub_(t){
  return String(t==null?'':t).replace(/(?:\+84|\b0)\d[\d\s.\-]{6,12}\d/g,'[SĐT]').replace(/\d{9,}/g,'[SĐT]');
}
function proClip_(t, n){ t = proScrub_(t).replace(/\s+/g,' ').trim(); return t.length>n ? t.slice(0,n-1)+'…' : t; }
function proMoney_(n){ return (Math.round(Number(n)||0)).toLocaleString('vi-VN')+'đ'; }
function proDmyDate_(d){ return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear(); }
var PRO_RATING_LABEL = { tot:'Làm tốt', trungbinh:'Trung bình', kem:'Cần cải thiện', chuadu:'Chưa đủ dữ liệu' };

// Ngữ cảnh 1 khách (KHÔNG có SĐT). c: {name,tier,careStatus}; D: kết quả proProfileData_; days/rev tính sẵn.
function proCustomerContext_(c, D, days, rev, now){
  var tl = proTimeline_(D.notes, D.mine, D.orders, 60), by = { note:[], sched:[], order:[] };
  tl.forEach(function(it){ if (by[it.kind] && by[it.kind].length<5) by[it.kind].push('- '+(it.when?it.when+' · ':'')+proClip_(it.title, it.kind==='note'?200:120)); });
  var today = proDmyDate_(now||new Date());
  var pend = proNextActions_(D.mine, c.phone, proYmdOf_(now||new Date()), D.types, 5).map(function(x){
    return '- '+proDmy_(x.date)+' · '+proClip_(x.label,40)+(x.note?': '+proClip_(x.note,80):'')+(x.state==='over'?' [QUÁ HẠN]':x.state==='today'?' [HÔM NAY]':''); });
  return ['LOẠI: một khách hàng (đã ẩn SĐT). Hôm nay: '+today,
    'Tên: '+proClip_(c.name||'(chưa có tên)',60)+' | Hạng: '+proClip_(c.tier||'—',20)+' | Tình trạng CS: '+proClip_((D.care&&D.care.status)||c.careStatus||'chưa gán',60),
    'Số đơn: '+(D.nOrd||0)+' | Doanh thu: '+proMoney_(rev)+' | Ngày từ đơn cuối: '+(days===null||days===undefined?'chưa có đơn':days),
    'Lịch hẹn chưa xong:'+(pend.length?'\n'+pend.join('\n'):' (không có)'),
    'Ghi chú gần nhất:'+(by.note.length?'\n'+by.note.join('\n'):' (không có)'),
    'Đơn gần nhất:'+(by.order.length?'\n'+by.order.join('\n'):' (không có)')].join('\n');
}
function proYmdOf_(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
// Ngữ cảnh doanh số theo PHẠM VI người dùng được xem (s = _ovScope(d), d = dữ liệu orgOverview)
function proSalesContext_(s, d){
  var c = s.company||{}, money = proMoney_;
  var people = (s.people||[]).slice().sort(function(a,b){ return (b.revenue||0)-(a.revenue||0); }).slice(0,15);
  var pct = function(v){ return v===null||v===undefined ? '—' : v+'%'; };
  return ['LOẠI: doanh số. Phạm vi: '+proClip_(s.label||'',80)+' | Kỳ: '+d.from+' → '+d.to,
    'Tổng: doanh thu '+money(c.revenue)+' | '+(c.orders||0)+' đơn | TB/đơn '+money(c.aov)+' | %KPI '+pct(c.pct)+' | tỷ lệ chốt '+pct(c.tyLeChot)+' | đơn thất bại '+(c.failed||0)+' | số người '+(c.soNguoi||0),
    'Xếp loại: làm tốt '+(c.tot||0)+', trung bình '+(c.trungbinh||0)+', cần cải thiện '+(c.kem||0)+', chưa đủ dữ liệu '+(c.chuadu||0),
    'Top '+people.length+' theo doanh thu (tên | doanh thu | đơn | %KPI | chốt | thất bại | xếp loại):'
  ].concat(people.map(function(p){ return '- '+proClip_(p.name,40)+' | '+money(p.revenue)+' | '+(p.orders||0)+' | '+pct(p.pct)+' | '+pct(p.tyLeChot)+' | '+(p.failedOrders||0)+' | '+(PRO_RATING_LABEL[p.rating]||'—'); })).join('\n');
}
// Ghép prompt: NGỮ CẢNH + 2 lượt hỏi-đáp gần nhất + CÂU HỎI; tổng ≤ 8500 ký tự (GAS giới hạn 9000)
function proAskPrompt_(context, question, history){
  var h = (history||[]).slice(-4).map(function(m){ return (m.role==='user'?'Hỏi: ':'Đáp: ')+proClip_(m.text,300); }).join('\n');
  var q = proClip_(question, 600);
  var ctx = String(context||''); var room = 8500 - q.length - h.length - 120; if (ctx.length>room) ctx = ctx.slice(0, Math.max(500,room));
  return 'NGỮ CẢNH:\n'+ctx+(h?'\n\nTRAO ĐỔI TRƯỚC:\n'+h:'')+'\n\nCÂU HỎI: '+q;
}
// Gọi GAS; trả {ok,text,provider} hoặc {ok:false,error}. fetchFn tiêm vào để test.
async function proAskRequest_(gsUrl, prompt, fetchFn, timeoutMs){
  if (!gsUrl) return { ok:false, error:'Chưa kết nối Google Sheets (chưa có link GAS).' };
  var ac = (typeof AbortController!=='undefined') ? new AbortController() : null, timer = ac ? setTimeout(function(){ ac.abort(); }, timeoutMs||60000) : null;
  try {
    var r = await fetchFn(gsUrl, { method:'POST', body: JSON.stringify({ action:'ai', crmAsk:true, prompt:prompt }), redirect:'follow', signal: ac ? ac.signal : undefined });
    var d = await r.json();
    if (d && d.ok && d.text) return { ok:true, text:String(d.text), provider:d.provider||'' };
    var err = (d && (d.error||d.message)) || 'AI không trả lời';
    if (/unknown action|crmAsk/i.test(err)) err += ' (backend GAS có thể chưa lên bản v13.32 — xem tab Actions của repo)';
    return { ok:false, error:String(err) };
  } catch(e){ return { ok:false, error: e && e.name==='AbortError' ? 'Quá thời gian chờ — thử lại.' : String(e&&e.message||e) }; }
  finally { if (timer) clearTimeout(timer); }
}
function proAnswerHtml_(t){ return proEsc_(t).replace(/\n/g,'<br>'); }
var PRO_AI_SUGGEST = {
  customer: ['Tóm tắt khách này', 'Nên làm gì tiếp với khách này?', 'Gợi ý tin nhắn chăm sóc'],
  sales: ['Tóm tắt doanh số kỳ này', 'Ai cần hỗ trợ nhất và vì sao?', 'Điểm đáng chú ý nhất là gì?']
};

// ── Giao diện (chỉ khi html.ui-pro) ──
var _proDock = { tabs:[], mode:'', log:[], busy:false };
function proDockOn_(){ return typeof document!=='undefined' && document.documentElement.classList.contains('ui-pro'); }
function proTabsLoad_(){ try { var v = JSON.parse(sessionStorage.getItem('pro_tabs')||'[]'); if (Array.isArray(v)) _proDock.tabs = v.filter(function(t){ return t && t.phone; }).slice(-PRO_TABS_MAX); } catch(e){} }
function proTabsSave_(){ try { sessionStorage.setItem('pro_tabs', JSON.stringify(_proDock.tabs)); } catch(e){} }
function proTabsRender_(){
  var bar = document.getElementById('pro-tabbar');
  if (!proDockOn_() || !_proDock.tabs.length){ if (bar) bar.remove(); document.body.classList.remove('pro-has-tabs'); return; }
  if (!bar){ bar = document.createElement('div'); bar.id = 'pro-tabbar'; document.body.appendChild(bar);
    bar.onclick = function(e){ var x = e.target.closest && e.target.closest('[data-pro-close]'); if (x){ proTabClose_(x.getAttribute('data-pro-close')); return; }
      var t = e.target.closest && e.target.closest('[data-pro-open]'); if (t && typeof openDp==='function'){ document.getElementById('dp-overlay').classList.add('open'); openDp(t.getAttribute('data-pro-open')); } }; }
  var open = document.getElementById('dp-overlay') && document.getElementById('dp-overlay').classList.contains('open');
  bar.innerHTML = _proDock.tabs.map(function(t){ var on = open && typeof currentPhone!=='undefined' && currentPhone===t.phone, nm = String(t.name||t.phone).slice(0,16);
    return '<span class="pro-tab'+(on?' on':'')+'" title="'+proEsc_(t.name||'')+'"><span data-pro-open="'+proEsc_(t.phone)+'">'+proEsc_(nm)+'</span><b data-pro-close="'+proEsc_(t.phone)+'" aria-label="Đóng">×</b></span>'; }).join('');
  document.body.classList.add('pro-has-tabs');
}
function proTabClose_(phone){
  var wasActive = typeof currentPhone!=='undefined' && currentPhone===phone && document.getElementById('dp-overlay').classList.contains('open');
  _proDock.tabs = proTabsRemove_(_proDock.tabs, phone); proTabsSave_();
  if (wasActive && typeof closeDp==='function') closeDp(); else proTabsRender_();
}
function proTabsTrack_(){
  if (!proDockOn_() || typeof currentPhone==='undefined' || typeof allCustomers==='undefined') return;
  var c = allCustomers.find(function(x){ return x.phone===currentPhone; }); if (!c) return;
  _proDock.tabs = proTabsAdd_(_proDock.tabs, { phone:c.phone, name:c.name }, PRO_TABS_MAX); proTabsSave_(); proTabsRender_();
}
// Dock phải + panel trợ lý
function proDockEnsure_(){
  if (!proDockOn_() || document.getElementById('pro-dock')) return;
  var dock = document.createElement('div'); dock.id = 'pro-dock';
  dock.innerHTML = '<button type="button" id="pro-dock-ai" title="Trợ lý AI" aria-label="Trợ lý AI">🤖</button>';
  document.body.appendChild(dock);
  dock.querySelector('#pro-dock-ai').onclick = function(){ proAiToggle_(); };
  var p = document.createElement('div'); p.id = 'pro-ai';
  p.innerHTML = '<div class="pro-ai-h"><b>🤖 Trợ lý AI</b><span class="pro-sp"></span><button type="button" data-ai="close" aria-label="Đóng">×</button></div>'
    + '<div class="pro-ai-modes"><button type="button" data-mode="customer">👤 Khách đang mở</button><button type="button" data-mode="sales">📊 Doanh số</button></div>'
    + '<div class="pro-ai-note">AI chỉ thấy số liệu bạn được phép xem, đã ẩn SĐT. Chỉ là gợi ý — hãy đối chiếu trước khi dùng.</div>'
    + '<div class="pro-ai-log" id="pro-ai-log"></div><div class="pro-ai-sug" id="pro-ai-sug"></div>'
    + '<div class="pro-ai-in"><textarea id="pro-ai-q" rows="2" maxlength="600" placeholder="Hỏi về khách hoặc doanh số…"></textarea><button type="button" id="pro-ai-send" class="btn primary">Gửi</button></div>';
  document.body.appendChild(p);
  p.onclick = function(e){ var t = e.target; if (!t.closest) return;
    if (t.closest('[data-ai="close"]')) { proAiToggle_(false); return; }
    var m = t.closest('[data-mode]'); if (m){ proAiMode_(m.getAttribute('data-mode')); return; }
    var s = t.closest('[data-sug]'); if (s){ document.getElementById('pro-ai-q').value = s.getAttribute('data-sug'); proAiSend_(); return; }
    if (t.closest('#pro-ai-send')) proAiSend_(); };
  document.getElementById('pro-ai-q').onkeydown = function(e){ if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); proAiSend_(); } };
  document.addEventListener('keydown', function(e){ if (e.key==='Escape') proAiToggle_(false); });
}
function proAiToggle_(force){
  var p = document.getElementById('pro-ai'); if (!p) return;
  var open = typeof force==='boolean' ? force : !p.classList.contains('open');
  p.classList.toggle('open', open);
  if (open){ var dpOpen = document.getElementById('dp-overlay') && document.getElementById('dp-overlay').classList.contains('open'); proAiMode_(_proDock.mode || (dpOpen ? 'customer' : 'sales')); }
}
function proAiMode_(m){
  if (m !== _proDock.mode){ _proDock.mode = m; _proDock.log = []; }
  var p = document.getElementById('pro-ai'); if (!p) return;
  p.querySelectorAll('[data-mode]').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-mode')===m); });
  document.getElementById('pro-ai-sug').innerHTML = PRO_AI_SUGGEST[m].map(function(x){ return '<button type="button" class="pro-chip" data-sug="'+proEsc_(x)+'">'+proEsc_(x)+'</button>'; }).join('');
  proAiLogRender_();
}
function proAiLogRender_(){
  var el = document.getElementById('pro-ai-log'); if (!el) return;
  var hint = _proDock.mode==='customer' ? 'Hỏi về khách đang mở trong hồ sơ ('+proEsc_((function(){ try { var c = allCustomers.find(function(x){ return x.phone===currentPhone; }); return c ? c.name : 'chưa mở khách nào'; } catch(e){ return 'chưa mở khách nào'; } })())+').' : 'Hỏi về doanh số theo phạm vi bạn được xem (dữ liệu màn 🏠 Tổng quan).';
  el.innerHTML = (_proDock.log.length ? '' : '<div class="pro-ai-hint">'+hint+'</div>') + _proDock.log.map(function(m){
    return '<div class="pro-ai-m '+m.role+'">'+proAnswerHtml_(m.text)+(m.provider?'<div class="pro-ai-by">AI: '+proEsc_(m.provider)+'</div>':'')+'</div>'; }).join('');
  el.scrollTop = el.scrollHeight;
}
function proAiContext_(){
  if (_proDock.mode==='customer'){
    var c = (typeof allCustomers!=='undefined' && typeof currentPhone!=='undefined') ? allCustomers.find(function(x){ return x.phone===currentPhone; }) : null;
    if (!c) return { error:'Chưa mở khách nào — mở hồ sơ một khách rồi hỏi lại.' };
    return { text: proCustomerContext_(c, proProfileData_(c), proDaysSinceLastOrder_(c.orders, new Date()), _custRev_(c), new Date()) };
  }
  var d = (typeof _ov!=='undefined' && _ov) ? _ov.data : null;
  if (!d || typeof _ovScope!=='function') return { error:'Chưa có số liệu doanh số — mở màn 🏠 Tổng quan để tải trước, rồi hỏi lại.' };
  return { text: proSalesContext_(_ovScope(d), d) };
}
async function proAiSend_(){
  if (_proDock.busy) return;
  var q = document.getElementById('pro-ai-q'), question = (q.value||'').trim(); if (!question) return;
  var ctx = proAiContext_();
  if (ctx.error){ _proDock.log.push({ role:'bot', text:ctx.error }); proAiLogRender_(); return; }
  _proDock.log.push({ role:'user', text:question }); q.value = ''; _proDock.busy = true;
  _proDock.log.push({ role:'bot', text:'⏳ Đang hỏi AI…' }); proAiLogRender_();
  var hist = _proDock.log.slice(0,-2).filter(function(m){ return m.text.indexOf('⏳')!==0; });
  var r = await proAskRequest_(typeof gsUrl!=='undefined' ? gsUrl : '', proAskPrompt_(ctx.text, question, hist), fetch);
  _proDock.log.pop(); _proDock.log.push(r.ok ? { role:'bot', text:r.text, provider:r.provider } : { role:'bot', text:'⚠ '+r.error });
  _proDock.busy = false; proAiLogRender_();
}
(function(){
  if (typeof document==='undefined' || typeof module!=='undefined') return;
  if (typeof openDp==='function' && !openDp._proTab){ var _o = openDp; openDp = function(){ var r = _o.apply(this, arguments); try { proTabsTrack_(); } catch(e){ console.warn('[ui-pro]',e); } return r; }; openDp._proTab = true; }
  if (typeof closeDp==='function' && !closeDp._proTab){ var _c = closeDp; closeDp = function(){ var r = _c.apply(this, arguments); try { proTabsRender_(); } catch(e){} return r; }; closeDp._proTab = true; }
  var init = function(){ try { proTabsLoad_(); proDockEnsure_(); proTabsRender_(); } catch(e){ console.warn('[ui-pro]',e); } };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
if (typeof module!=='undefined') module.exports = { proTabsAdd_, proTabsRemove_, proScrub_, proClip_, proCustomerContext_, proSalesContext_, proAskPrompt_, proAskRequest_, proAnswerHtml_ };

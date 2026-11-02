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
// ── HỎI GIÁ SẢN PHẨM: tra TRỰC TIẾP bảng giá DANH_MUC qua GAS action=priceAsk (không để AI tự nghĩ giá) ──
// Câu hỏi giá: có từ "giá"/"bảng giá"/"đơn giá"/"bao nhiêu tiền"/"nhiêu tiền" (so sánh không dấu).
function proPriceIntent_(q){ return /\bgia\b|bang gia|don gia|bao nhieu tien|nhieu tien/.test(proNorm_(q)); }
async function proPriceRequest_(gsUrl, question, fetchFn, timeoutMs)
{
  if (!gsUrl) return { ok:false, error:'Chưa kết nối Google Sheets (chưa có link GAS).' };
  var ac = (typeof AbortController!=='undefined') ? new AbortController() : null, timer = ac ? setTimeout(function(){ ac.abort(); }, timeoutMs||30000) : null;
  try {
    var url = gsUrl + (String(gsUrl).indexOf('?')>=0 ? '&' : '?') + 'action=priceAsk&q=' + encodeURIComponent(String(question||'').slice(0,200));
    var r = await fetchFn(url, { method:'GET', redirect:'follow', signal: ac ? ac.signal : undefined });
    var d = await r.json();
    if (d && d.ok) return { ok:true, found:!!d.found, text:String(d.text||''), unit:d.unit||'', suggestions:Array.isArray(d.suggestions)?d.suggestions:[] };
    var err = (d && (d.error||d.message)) || 'Không tra được bảng giá';
    if (/unknown action|priceAsk/i.test(err)) err += ' (backend GAS có thể chưa lên bản có tra giá — xem tab Actions của repo)';
    return { ok:false, error:String(err) };
  } catch(e){ return { ok:false, error: e && e.name==='AbortError' ? 'Quá thời gian chờ — thử lại.' : String(e&&e.message||e) }; }
  finally { if (timer) clearTimeout(timer); }
}
function proPriceFormat_(r){
  if (!r || !r.ok) return '⚠ ' + ((r && r.error) || 'Không tra được bảng giá');
  if (r.found) return 'Giá theo BẢNG GIÁ (DANH_MUC), đơn vị nghìn đồng — ví dụ 2.310 = 2.310.000đ:\n' + r.text;
  var sg = (r.suggestions||[]).slice(0,8);
  return 'Chưa tìm thấy sản phẩm khớp rõ trong bảng giá.' + (sg.length ? '\nCó thể bạn muốn hỏi:\n' + sg.map(function(x){ return '• '+x; }).join('\n') : '') + '\nHãy gõ rõ TÊN sản phẩm (kèm chất liệu / size / SAPHIA / RUBY nếu có).';
}
// ── CHI TIẾT SẢN PHẨM (Duyên yêu cầu 2026-10-27): bấm 1 gợi ý → thông tin + các nút chọn (chất liệu → size/kiểu) → giá. GAS action=priceItem. ──
async function proPriceItemRequest_(gsUrl, name, fetchFn, timeoutMs){
  if (!gsUrl) return { ok:false, error:'Chưa kết nối Google Sheets (chưa có link GAS).' };
  var ac = (typeof AbortController!=='undefined') ? new AbortController() : null, timer = ac ? setTimeout(function(){ ac.abort(); }, timeoutMs||30000) : null;
  try {
    var url = gsUrl + (String(gsUrl).indexOf('?')>=0 ? '&' : '?') + 'action=priceItem&name=' + encodeURIComponent(String(name||'').slice(0,200));
    var r = await fetchFn(url, { method:'GET', redirect:'follow', signal: ac ? ac.signal : undefined });
    var d = await r.json();
    if (d && d.ok) return { ok:true, found:!!d.found, name:d.name||name, info:Array.isArray(d.info)?d.info:[], variants:Array.isArray(d.variants)?d.variants:[] };
    var err = (d && (d.error||d.message)) || 'Không tra được chi tiết sản phẩm';
    if (/unknown action|priceItem/i.test(err)) err += ' (backend GAS có thể chưa lên bản có chi tiết sản phẩm — xem tab Actions của repo)';
    return { ok:false, error:String(err) };
  } catch(e){ return { ok:false, error: e && e.name==='AbortError' ? 'Quá thời gian chờ — thử lại.' : String(e&&e.message||e) }; }
  finally { if (timer) clearTimeout(timer); }
}
// Giá trong bảng tính bằng NGHÌN đồng (2.310 = 2.310.000đ) → hiện đủ đồng. Không đọc được thì giữ nguyên chữ gốc + ghi chú đơn vị.
function proPriceMoney_(v){
  if (typeof v==='number' && isFinite(v)) return Math.round(v*1000).toLocaleString('vi-VN')+'đ';
  var t = String(v==null?'':v).trim();
  if (/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(t)) return (parseInt(t.replace(/[.,]/g,''),10)*1000).toLocaleString('vi-VN')+'đ';
  return t+' (nghìn đồng)';
}
var PRO_PRICE_FIELD = { mat:'Chất liệu', size:'Kiểu / Size' }, PRO_PRICE_EMPTY = { mat:'(không ghi chất liệu)', size:'(mặc định)' };
// Bước kế tiếp sau khi đã chọn sel={mat,size} (null = chưa chọn): hỏi chất liệu nếu còn >1, rồi size/kiểu nếu còn >1, hết thì ra giá.
function proPriceNext_(item, sel){
  sel = sel || {};
  var vs = ((item && item.variants) || []).filter(function(v){ return (sel.mat==null || v.mat===sel.mat) && (sel.size==null || v.size===sel.size); });
  function uniq(f){ var o = [], seen = {}; vs.forEach(function(v){ var k = v[f]||''; if (!Object.prototype.hasOwnProperty.call(seen,k)){ seen[k] = 1; o.push(k); } }); return o; }
  if (sel.mat==null){ var m = uniq('mat'); if (m.length>1) return { step:'mat', options:m }; }
  if (sel.size==null){ var z = uniq('size'); if (z.length>1) return { step:'size', options:z }; }
  return { step:'price', variants:vs };
}
function proPriceInfoText_(item){
  return '📦 ' + item.name + ((item.info||[]).length ? '\n' + item.info.map(function(x){ return '• '+x.k+': '+x.v; }).join('\n') : '');
}
function proPricePriceText_(item, vs, sel){
  var crumb = [item.name, sel && sel.mat ? sel.mat : '', sel && sel.size ? sel.size : ''].filter(Boolean).join(' › ');
  var out = vs.map(function(v){
    var d = [v.mat ? 'Chất liệu '+v.mat : '', v.size ? 'Size/Kiểu '+v.size : ''].filter(Boolean).join(' · ');
    return (d ? '▸ '+d+'\n' : '') + (v.prices||[]).map(function(p){ return '💰 '+p.label+': '+proPriceMoney_(p.value); }).join('\n');
  });
  return '✅ ' + crumb + '\n' + out.join('\n\n');
}
function proPriceNotFoundText_(){ return 'Chưa tìm thấy sản phẩm khớp rõ trong bảng giá.\nBấm vào sản phẩm bạn muốn xem (thông tin + giá), hoặc gõ rõ hơn TÊN sản phẩm:'; }
var PRO_AI_SUGGEST = {
  customer: ['Tóm tắt khách này', 'Nên làm gì tiếp với khách này?', 'Gợi ý tin nhắn chăm sóc'],
  sales: ['Tóm tắt doanh số kỳ này', 'Ai cần hỗ trợ nhất và vì sao?', 'Điểm đáng chú ý nhất là gì?'],
  price: []
};


// ── Trả lời THÔ theo quy tắc (không gọi AI, không cần key) ──
// PRO_AI_ENGINE: 'rule' = tự tóm tắt từ số liệu (mặc định, số luôn đúng); 'ai' = gọi GAS action=ai + crmAsk (cần key AI trong Settings).
var PRO_AI_ENGINE = 'rule';
function proNorm_(t){ return String(t==null?'':t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'d').toLowerCase(); }
function proIntent_(mode, q){
  var n = proNorm_(q);
  if (mode==='customer'){
    if (/tin nhan|nhan tin|soan|noi gi|zalo|tin mau/.test(n)) return 'message';
    if (/lam gi|tiep theo|\bviec\b|\bnen\b|uu tien|cham soc|hanh dong/.test(n)) return 'next';
    if (/tom tat|tong quan|thong tin|tinh hinh|khach nay/.test(n)) return 'summary';
    return '';
  }
  if (/ho tro|ai can|\byeu\b|\bkem\b|thap|keo|chua dat/.test(n)) return 'support';
  if (/dang chu y|noi bat|bat thuong|chu y|nhan xet|diem /.test(n+' ')) return 'notable';
  if (/tom tat|tong quan|ky nay|tinh hinh|doanh so|doanh thu/.test(n)) return 'summary';
  return '';
}
var PRO_RULE_HELP = 'Chế độ trả lời thô (theo quy tắc, không dùng AI) chưa hiểu câu này. Hãy bấm một gợi ý bên dưới.';
function proRuleCustomer_(intent, c, D, days, rev, now){
  now = now || new Date();
  var name = c.name || 'Khách', today = proYmdOf_(now);
  var pend = proNextActions_(D.mine, c.phone, today, D.types, 100), over = pend.filter(function(x){ return x.state==='over'; }), td = pend.filter(function(x){ return x.state==='today'; });
  var status = (D.care && D.care.status) || c.careStatus || '';
  var hasDays = days!==null && days!==undefined;
  var lastNote = (D.notes||[]).filter(function(n){ return n && n.text; });
  lastNote = lastNote.length ? lastNote[0] : null;
  if (intent==='summary'){
    var L = [name+(c.tier?' (hạng '+c.tier+')':'')+' · tình trạng CS: '+(status||'chưa gán')+'.'];
    L.push((D.nOrd||0)>0 ? 'Đã mua '+D.nOrd+' đơn, tổng '+proMoney_(rev)+(hasDays?'; đơn gần nhất cách '+days+' ngày.':'.') : 'Chưa có đơn nào.');
    L.push(pend.length ? 'Lịch chưa xong: '+pend.length+(over.length?' ('+over.length+' quá hạn)':'')+'; gần nhất '+proDmy_(pend[0].date).slice(0,5)+' — '+pend[0].label+'.' : 'Chưa có lịch hẹn nào đang chờ.');
    if (lastNote) L.push('Ghi chú gần nhất: '+String(lastNote.text).replace(/\s+/g,' ').slice(0,140));
    return L.join('\n');
  }
  if (intent==='next'){
    var B = [];
    if (over.length) B.push('Xử lý lịch QUÁ HẠN trước: '+over[0].label+' ngày '+proDmy_(over[0].date).slice(0,5)+(over.length>1?' (+'+(over.length-1)+' lịch quá hạn khác)':'')+'.');
    if (td.length) B.push('Có lịch HÔM NAY: '+td[0].label+(td[0].note?' — '+String(td[0].note).slice(0,60):'')+'.');
    if ((D.nOrd||0)===0) B.push('Chưa có đơn nào → ưu tiên tư vấn và chốt đơn đầu tiên.');
    else if (hasDays && days>180) B.push('Đã '+days+' ngày chưa mua lại → nhắn/gọi hỏi nhu cầu, cân nhắc ưu đãi mua lại.');
    else if (hasDays && days>90) B.push('Đã '+days+' ngày kể từ đơn cuối, sắp nguội → hỏi thăm sớm.');
    if (!pend.length && (D.nOrd||0)>0) B.push('Chưa có lịch hẹn nào → đặt lịch nhắc mua lại/chăm sóc.');
    if (!status) B.push('Chưa gán tình trạng CS → cập nhật sau khi liên hệ.');
    return B.length ? B.slice(0,3).map(function(x){ return '• '+x; }).join('\n') : '• Chưa thấy việc gấp: không có lịch quá hạn, khách mua gần đây. Có thể hỏi thăm nhẹ sau vài ngày.';
  }
  if (intent==='message'){
    var msg = (D.nOrd||0)===0 ? name+' ơi, em nhắn lại để hỗ trợ mình thêm về sản phẩm mình đang quan tâm ạ. Mình còn băn khoăn điểm nào để em giải đáp nhé?'
      : (hasDays && days>=30) ? name+' ơi, em hỏi thăm mình dùng sản phẩm đã '+days+' ngày rồi, mình thấy thế nào ạ? Nếu mình cần dùng tiếp, em hỗ trợ ưu đãi mua lại cho mình nhé.'
      : name+' ơi, mình dùng sản phẩm được mấy hôm rồi, mình thấy hiệu quả thế nào ạ? Có gì cần em hỗ trợ cứ nhắn em nhé.';
    return 'Tin nhắn mẫu:\n"'+msg+'"\n(Mẫu theo số liệu — hãy chỉnh theo cuộc trò chuyện thực tế trước khi gửi.)';
  }
  return PRO_RULE_HELP;
}
function proRuleSales_(intent, s, d){
  var c = s.company||{}, money = proMoney_, pc = function(v){ return v===null||v===undefined ? '—' : v+'%'; };
  var people = (s.people||[]).slice().sort(function(a,b){ return (b.revenue||0)-(a.revenue||0); });
  if (intent==='summary'){
    var top = people.slice(0,3).map(function(p,i){ return (i+1)+'. '+p.name+' ('+money(p.revenue)+')'; }).join(' · ');
    return [(s.label||'')+' · '+d.from+' → '+d.to+':', 'Doanh thu '+money(c.revenue)+' · '+(c.orders||0)+' đơn · TB/đơn '+money(c.aov)+'.',
      '%KPI '+pc(c.pct)+' · tỷ lệ chốt '+pc(c.tyLeChot)+' · đơn thất bại '+(c.failed||0)+'.',
      'Xếp loại: tốt '+(c.tot||0)+' · trung bình '+(c.trungbinh||0)+' · cần cải thiện '+(c.kem||0)+' · chưa đủ dữ liệu '+(c.chuadu||0)+'.'].concat(top?['Top: '+top]:[]).join('\n');
  }
  if (intent==='support'){
    var low = people.filter(function(p){ return p.rating==='kem' || (p.pct!==null && p.pct!==undefined && p.pct<70); })
      .sort(function(a,b){ var x = a.pct===null||a.pct===undefined?999:a.pct, y = b.pct===null||b.pct===undefined?999:b.pct; return x-y; }).slice(0,5);
    if (!low.length) return 'Không ai đang dưới ngưỡng (xếp "cần cải thiện" hoặc %KPI dưới 70%) trong phạm vi này.'+((c.chuadu||0)?'\nCó '+c.chuadu+' người chưa đủ dữ liệu để đánh giá.':'');
    return 'Cần hỗ trợ trước (xếp "cần cải thiện" hoặc %KPI dưới 70%):\n'+low.map(function(p){ return '• '+p.name+': '+money(p.revenue)+' · %KPI '+pc(p.pct)+' · chốt '+pc(p.tyLeChot)+' · thất bại '+(p.failedOrders||0); }).join('\n')+((c.chuadu||0)?'\n(+'+c.chuadu+' người chưa đủ dữ liệu)':'');
  }
  if (intent==='notable'){
    var B = [], k = c.pct;
    if (k!==null && k!==undefined) B.push(k>=100 ? 'Cả phạm vi đã ĐẠT KPI ('+k+'%).' : k>=70 ? 'KPI đang '+k+'% — gần đạt, còn thiếu '+(Math.round((100-k)*10)/10)+' điểm %.' : 'KPI mới '+k+'% — thấp, cần đẩy mạnh.');
    if (people.length){ B.push('Dẫn đầu doanh thu: '+people[0].name+' ('+money(people[0].revenue)+').');
      var total = people.reduce(function(a,p){ return a+(p.revenue||0); },0);
      if (people.length>2 && total>0 && people[0].revenue/total>0.4) B.push('Doanh thu tập trung: '+people[0].name+' chiếm '+Math.round(people[0].revenue/total*100)+'% — phụ thuộc nhiều vào 1 người.');
      var f = people.slice().sort(function(a,b){ return (b.failedOrders||0)-(a.failedOrders||0); })[0];
      if (f && (f.failedOrders||0)>0) B.push('Nhiều đơn thất bại nhất: '+f.name+' ('+f.failedOrders+' đơn).'); }
    if (c.tyLeChot!==null && c.tyLeChot!==undefined) B.push('Tỷ lệ chốt chung '+c.tyLeChot+'%.');
    return B.length ? B.slice(0,4).map(function(x){ return '• '+x; }).join('\n') : 'Chưa đủ số liệu để nêu điểm đáng chú ý.';
  }
  return PRO_RULE_HELP;
}
function proRuleAnswer_(mode, question, X){
  var intent = proIntent_(mode, question);
  if (!intent) return PRO_RULE_HELP;
  return mode==='customer' ? proRuleCustomer_(intent, X.c, X.D, X.days, X.rev, X.now) : proRuleSales_(intent, X.s, X.d);
}
function proAiNote_(){ return PRO_AI_ENGINE==='rule' ? 'Trả lời THÔ theo quy tắc từ số liệu hệ thống (không dùng AI, không cần key, không gửi dữ liệu đi đâu). Bấm gợi ý bên dưới.' : 'AI chỉ thấy số liệu bạn được phép xem, đã ẩn SĐT. Chỉ là gợi ý — hãy đối chiếu trước khi dùng.'; }

// ── Giao diện (chỉ khi html.ui-pro) ──
var _proDock = { tabs:[], mode:'', log:[], busy:false, items:{} };
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
// ── KÉO THẢ icon 🤖 tới góc bất kỳ (Duyên yêu cầu 2026-10-27: icon cố định che mất kết quả đang xem). Vị trí nhớ trên máy (localStorage). ──
// Giữ icon trong khung nhìn (chừa lề), kể cả khi xoay/đổi cỡ màn hình hoặc vị trí lưu sai/NaN.
function proDockClamp_(x, y, w, h, vw, vh, m){
  m = m==null ? 4 : m; x = Number(x); y = Number(y);
  if (!isFinite(x)) x = vw - w - 16; if (!isFinite(y)) y = vh - h - 88;
  return { x: Math.round(Math.max(m, Math.min(x, vw - w - m))), y: Math.round(Math.max(m, Math.min(y, vh - h - m))) };
}
function proDockPlace_(dock, x, y){
  var r = dock.getBoundingClientRect(), vw = window.innerWidth || document.documentElement.clientWidth, vh = window.innerHeight || document.documentElement.clientHeight;
  var c = proDockClamp_(x, y, r.width || 48, r.height || 48, vw, vh);
  dock.style.setProperty('left', c.x+'px', 'important'); dock.style.setProperty('top', c.y+'px', 'important');
  dock.style.setProperty('right', 'auto', 'important'); dock.style.setProperty('bottom', 'auto', 'important'); dock.style.setProperty('transform', 'none', 'important');
  return c;
}
function proDockDragInit_(dock){
  var st = null, moved = false, KEY = 'pro_dock_pos';
  try { var sv = JSON.parse(localStorage.getItem(KEY)||'null'); if (sv && isFinite(sv.x) && isFinite(sv.y)) proDockPlace_(dock, sv.x, sv.y); } catch(e){}
  window.addEventListener('resize', function(){ if (dock.style.left){ var r = dock.getBoundingClientRect(); proDockPlace_(dock, r.left, r.top); } });
  dock.addEventListener('pointerdown', function(e){
    if (e.button!=null && e.button!==0) return;
    var r = dock.getBoundingClientRect(); st = { px:e.clientX, py:e.clientY, ox:r.left, oy:r.top, id:e.pointerId }; moved = false;
  });
  dock.addEventListener('pointermove', function(e){
    if (!st || e.pointerId!==st.id) return;
    var dx = e.clientX-st.px, dy = e.clientY-st.py;
    if (!moved && Math.abs(dx)+Math.abs(dy) < 6) return;   // dưới 6px coi là bấm, không phải kéo
    if (!moved){ moved = true; try { dock.setPointerCapture(e.pointerId); } catch(x){} dock.classList.add('dragging'); }
    e.preventDefault(); proDockPlace_(dock, st.ox+dx, st.oy+dy);
  });
  function end(e){
    if (!st || (e && e.pointerId!==st.id)) return;
    if (moved){ var r = dock.getBoundingClientRect(); try { localStorage.setItem(KEY, JSON.stringify({ x:Math.round(r.left), y:Math.round(r.top) })); } catch(x){} dock.classList.remove('dragging'); dock._proMovedAt = Date.now(); }
    st = null; moved = false;
  }
  dock.addEventListener('pointerup', end); dock.addEventListener('pointercancel', end);
  dock.addEventListener('dblclick', function(){ try { localStorage.removeItem(KEY); } catch(e){} ['left','top','right','bottom','transform'].forEach(function(k){ dock.style.removeProperty(k); }); });   // bấm đúp = về chỗ mặc định
}
// Dock phải + panel trợ lý
function proDockEnsure_(){
  if (!proDockOn_() || document.getElementById('pro-dock')) return;
  var dock = document.createElement('div'); dock.id = 'pro-dock';
  dock.innerHTML = '<button type="button" id="pro-dock-ai" title="Trợ lý AI — giữ và kéo để di chuyển, bấm đúp để về chỗ cũ" aria-label="Trợ lý AI">🤖</button>';
  document.body.appendChild(dock);
  try { proDockDragInit_(dock); } catch(e){ console.warn('[ui-pro] drag', e); }
  dock.querySelector('#pro-dock-ai').onclick = function(){ if (dock._proMovedAt && Date.now()-dock._proMovedAt < 350) return; proAiToggle_(); };   // vừa kéo xong thì không mở panel
  var p = document.createElement('div'); p.id = 'pro-ai';
  p.innerHTML = '<div class="pro-ai-h"><b>🤖 Trợ lý AI</b><span class="pro-sp"></span><button type="button" data-ai="close" aria-label="Đóng">×</button></div>'
    + '<div class="pro-ai-modes"><button type="button" data-mode="customer">👤 Khách đang mở</button><button type="button" data-mode="sales">📊 Doanh số</button><button type="button" data-mode="price">💰 Giá sản phẩm</button></div>'
    + '<div class="pro-ai-note">'+proEsc_(proAiNote_())+'</div>'
    + '<div class="pro-ai-log" id="pro-ai-log"></div><div class="pro-ai-sug" id="pro-ai-sug"></div>'
    + '<div class="pro-ai-in"><textarea id="pro-ai-q" rows="2" maxlength="600" placeholder="Hỏi về khách hoặc doanh số…"></textarea><button type="button" id="pro-ai-send" class="btn primary">Gửi</button></div>';
  document.body.appendChild(p);
  p.onclick = function(e){ var t = e.target; if (!t.closest) return;
    if (t.closest('[data-ai="close"]')) { proAiToggle_(false); return; }
    var m = t.closest('[data-mode]'); if (m){ proAiMode_(m.getAttribute('data-mode')); return; }
    var pc = t.closest('[data-pc]'); if (pc){ var pa = pc.getAttribute('data-pc').split(':'); proPriceChip_(+pa[0], +pa[1]); return; }
    var s = t.closest('[data-sug]'); if (s){ document.getElementById('pro-ai-q').value = s.getAttribute('data-sug'); proAiSend_(); return; }
    if (t.closest('#pro-ai-send')) proAiSend_(); };
  document.getElementById('pro-ai-q').onkeydown = function(e){ if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); proAiSend_(); } };
  document.addEventListener('keydown', function(e){ if (e.key==='Escape') proAiToggle_(false); });
}
function proAiToggle_(force){
  var p = document.getElementById('pro-ai'); if (!p) return;
  var open = typeof force==='boolean' ? force : !p.classList.contains('open');
  p.classList.toggle('open', open);
  document.documentElement.classList.toggle('pro-ai-open', open);   // để khối Chat nội bộ nhỏ (#tc-mini) nhường chỗ, không đè lên ô nhập của AI (css/07-teamchat.css)
  if (open){ var dpOpen = document.getElementById('dp-overlay') && document.getElementById('dp-overlay').classList.contains('open'); proAiMode_(_proDock.mode || (dpOpen ? 'customer' : 'sales')); }
}
function proAiMode_(m){
  if (m !== _proDock.mode){ _proDock.mode = m; _proDock.log = []; }
  var p = document.getElementById('pro-ai'); if (!p) return;
  p.querySelectorAll('[data-mode]').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-mode')===m); });
  var qIn = document.getElementById('pro-ai-q'); if (qIn) qIn.placeholder = m==='price' ? 'Hỏi giá sản phẩm… (vd: giá + tên sản phẩm)' : 'Hỏi về khách hoặc doanh số…';
  document.getElementById('pro-ai-sug').innerHTML = PRO_AI_SUGGEST[m].map(function(x){ return '<button type="button" class="pro-chip" data-sug="'+proEsc_(x)+'">'+proEsc_(x)+'</button>'; }).join('');
  proAiLogRender_();
}
function proAiLogRender_(){
  var el = document.getElementById('pro-ai-log'); if (!el) return;
  var hint = _proDock.mode==='price' ? 'Gõ tên sản phẩm để tra giá trong bảng giá (có thể kèm chất liệu, size, SAPHIA/RUBY). Giá lấy trực tiếp từ DANH_MUC, không do AI tự nghĩ.' : _proDock.mode==='customer' ? 'Hỏi về khách đang mở trong hồ sơ ('+proEsc_((function(){ try { var c = allCustomers.find(function(x){ return x.phone===currentPhone; }); return c ? c.name : 'chưa mở khách nào'; } catch(e){ return 'chưa mở khách nào'; } })())+').' : 'Hỏi về doanh số theo phạm vi bạn được xem (dữ liệu màn 🏠 Tổng quan).';
  el.innerHTML = (_proDock.log.length ? '' : '<div class="pro-ai-hint">'+hint+'</div>') + _proDock.log.map(function(m, mi){
    var chips = (m.chips && m.chips.length) ? '<div class="pro-ai-chips">'+m.chips.map(function(c, ci){ return '<button type="button" class="pro-pc'+(c.kind==='reset'?' alt':'')+'" data-pc="'+mi+':'+ci+'">'+proEsc_(c.label)+'</button>'; }).join('')+'</div>' : '';
    return '<div class="pro-ai-m '+m.role+'">'+proAnswerHtml_(m.text)+chips+(m.provider?'<div class="pro-ai-by">AI: '+proEsc_(m.provider)+'</div>':'')+'</div>'; }).join('');
  el.scrollTop = el.scrollHeight;
}
function proAiContext_(){
  if (_proDock.mode==='customer'){
    var c = (typeof allCustomers!=='undefined' && typeof currentPhone!=='undefined') ? allCustomers.find(function(x){ return x.phone===currentPhone; }) : null;
    if (!c) return { error:'Chưa mở khách nào — mở hồ sơ một khách rồi hỏi lại.' };
    var D = proProfileData_(c), days = proDaysSinceLastOrder_(c.orders, new Date()), rev = _custRev_(c), now = new Date();
    return { text: proCustomerContext_(c, D, days, rev, now), raw: { c:c, D:D, days:days, rev:rev, now:now } };
  }
  var d = (typeof _ov!=='undefined' && _ov) ? _ov.data : null;
  if (!d || typeof _ovScope!=='function') return { error:'Chưa có số liệu doanh số — mở màn 🏠 Tổng quan để tải trước, rồi hỏi lại.' };
  var sc = _ovScope(d);
  return { text: proSalesContext_(sc, d), raw: { s:sc, d:d } };
}
// Hiện 1 bước: chưa đủ lựa chọn → nút chọn; đủ → giá. Thêm nút "↩ Chọn lại" ở bước giá.
function proPriceShow_(item, sel){
  var nx = proPriceNext_(item, sel), first = !sel || (sel.mat==null && sel.size==null), key = item.name;
  _proDock.items[key] = item;
  if (nx.step==='price'){
    var txt = (first ? proPriceInfoText_(item) + '\n\n' : '') + proPricePriceText_(item, nx.variants, sel);
    _proDock.log.push({ role:'bot', text:txt, chips: first ? [] : [{ kind:'reset', label:'↩ Chọn lại', item:key }], provider:'Bảng giá DANH_MUC (tra trực tiếp, không dùng AI)' });
    return;
  }
  var base = first ? proPriceInfoText_(item) + '\n\n' : item.name + (sel.mat ? ' › '+sel.mat : '') + '\n';
  _proDock.log.push({ role:'bot', text: base + 'Chọn ' + PRO_PRICE_FIELD[nx.step].toLowerCase() + ':',
    chips: nx.options.map(function(o){ return { kind:'opt', field:nx.step, val:o, label:o || PRO_PRICE_EMPTY[nx.step], item:key, sel:{ mat:sel.mat==null?null:sel.mat, size:sel.size==null?null:sel.size } }; }) });
}
async function proPriceChip_(mi, ci){
  if (_proDock.busy) return;
  var m = _proDock.log[mi], c = m && m.chips && m.chips[ci]; if (!c) return;
  if (c.kind==='name'){
    _proDock.log.push({ role:'user', text:c.label }); _proDock.busy = true;
    _proDock.log.push({ role:'bot', text:'⏳ Đang lấy thông tin sản phẩm…' }); proAiLogRender_();
    var r = await proPriceItemRequest_(typeof gsUrl!=='undefined' ? gsUrl : '', c.label, fetch);
    _proDock.log.pop();
    if (!r.ok) _proDock.log.push({ role:'bot', text:'⚠ '+r.error });
    else if (!r.found) _proDock.log.push({ role:'bot', text:'Không có dòng chi tiết nào cho "'+c.label+'" trong bảng giá. Thử gõ lại tên sản phẩm.' });
    else proPriceShow_(r, { mat:null, size:null });
    _proDock.busy = false; proAiLogRender_(); return;
  }
  var item = _proDock.items[c.item]; if (!item) return;
  if (c.kind==='reset'){ _proDock.log.push({ role:'user', text:'↩ Chọn lại' }); proPriceShow_(item, { mat:null, size:null }); proAiLogRender_(); return; }
  if (c.kind==='opt'){
    var sel = { mat:c.sel.mat, size:c.sel.size }; sel[c.field] = c.val;
    _proDock.log.push({ role:'user', text:c.label }); proPriceShow_(item, sel); proAiLogRender_();
  }
}
async function proAiSend_(){
  if (_proDock.busy) return;
  var q = document.getElementById('pro-ai-q'), question = (q.value||'').trim(); if (!question) return;
  // Hỏi GIÁ: ở chế độ 💰, hoặc câu có từ "giá" mà các chế độ khác "chưa hiểu" → tra thẳng bảng giá (không cần mở khách/Tổng quan)
  if (_proDock.mode==='price' || (proPriceIntent_(question) && !proIntent_(_proDock.mode, question))){
    _proDock.log.push({ role:'user', text:question }); q.value = ''; _proDock.busy = true;
    _proDock.log.push({ role:'bot', text:'⏳ Đang tra bảng giá…' }); proAiLogRender_();
    var pr = await proPriceRequest_(typeof gsUrl!=='undefined' ? gsUrl : '', proScrub_(question), fetch);
    _proDock.log.pop();
    var pm = { role:'bot', text:proPriceFormat_(pr), provider:'Bảng giá DANH_MUC (tra trực tiếp, không dùng AI)' };
    if (pr.ok && !pr.found && (pr.suggestions||[]).length){ pm.text = proPriceNotFoundText_(); pm.chips = pr.suggestions.slice(0,8).map(function(n){ return { kind:'name', label:n }; }); }   // gợi ý thành nút bấm → xem thông tin + giá
    _proDock.log.push(pm);
    _proDock.busy = false; proAiLogRender_(); return;
  }
  var ctx = proAiContext_();
  if (ctx.error){ _proDock.log.push({ role:'bot', text:ctx.error }); proAiLogRender_(); return; }
  if (PRO_AI_ENGINE==='rule'){
    _proDock.log.push({ role:'user', text:question }); q.value = '';
    _proDock.log.push({ role:'bot', text:proRuleAnswer_(_proDock.mode, question, ctx.raw), provider:'Quy tắc (không dùng AI)' }); proAiLogRender_(); return;
  }
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
if (typeof module!=='undefined') module.exports = { proIntent_, proRuleCustomer_, proRuleSales_, proRuleAnswer_, proNorm_, proTabsAdd_, proTabsRemove_, proScrub_, proClip_, proCustomerContext_, proSalesContext_, proAskPrompt_, proAskRequest_, proAnswerHtml_, proPriceIntent_, proPriceRequest_, proPriceFormat_, proDockClamp_, proPriceItemRequest_, proPriceMoney_, proPriceNext_, proPriceInfoText_, proPricePriceText_ };

/* GIAO DIỆN PRO — P5: Social > Chat kiểu Pancake. Cột PHẢI "Thông tin khách" hiện cạnh hội thoại (như cột Thông tin của Pancake),
   lấy đúng khách trong CRM theo SĐT của hội thoại: thanh giai đoạn CS, 3 ô số, việc tiếp theo, thông tin chăm sóc, dòng thời gian.
   Dùng lại hàm của hồ sơ 360° (js/33): proProfileData_, proStageHtml_, proKpiHtml_, proNextHtml_, proTimelineHtml_. Chỉ ĐỌC, không ghi dữ liệu. */

// ── Hàm thuần ──
// Chuẩn hoá SĐT về dạng 0xxxxxxxxx (bỏ ký tự lạ, +84/84 → 0). Rỗng nếu không có chữ số.
function proPhoneNorm_(p){ var d = String(p==null?'':p).replace(/\D/g,''); if (!d) return ''; if (d.indexOf('84')===0 && d.length>=11) d = '0'+d.slice(2); else if (d.charAt(0)!=='0' && d.length===9) d = '0'+d; return d; }
function proInitials_(name){ var w = String(name||'').trim().split(/\s+/).filter(Boolean); if (!w.length) return '?'; return ((w.length>1 ? w[w.length-2].charAt(0) : '') + w[w.length-1].charAt(0)).toUpperCase(); }
function proInfoRow_(k, v){ return '<div class="sc-ir"><span>'+proEsc_(k)+'</span><b>'+(v ? proEsc_(v) : '<i>—</i>')+'</b></div>'; }
// conv: {name,phone}; c: khách CRM hoặc null; P: {D,days,rev,tree,now} (chỉ cần khi có c)
function proPkBlock_(conv){   // "Thẻ Pancake" + "Người xử lý" như cột Thông tin của Pancake
  if (!conv) return '';
  var tags = (typeof _pkcTagsHtml==='function') ? _pkcTagsHtml(conv.tags) : '';
  var warn = (!tags && conv.tagN>0) ? '<span class="pkc-warn" title="Có '+conv.tagN+' thẻ nhưng chưa lấy được tên thẻ (GAS chưa deploy bản mới / thiếu PANCAKE_PAGE_TOKENS)">⚠ '+conv.tagN+' thẻ (chưa lấy được tên thẻ)</span>' : '';
  var ass = (conv.assignees && conv.assignees.length) ? proEsc_(conv.assignees.join(', ')) : '';
  if (!tags && !warn && !ass) return '';
  return '<div class="sc-pk">'+((tags||warn)?'<div class="sc-pk-r"><span class="k">Thẻ Pancake</span><span class="v">'+(tags||warn)+'</span></div>':'')
    +(ass?'<div class="sc-pk-r"><span class="k">Người xử lý</span><span class="v">'+ass+'</span></div>':'')+'</div>';
}
function proChatInfoHtml_(conv, c, P){
  var head = function(name, phone, chips){ return '<div class="sc-info-h"><div class="sc-av">'+proEsc_(proInitials_(name))+'</div><div class="sc-info-t"><b>'+proEsc_(name||'Khách')+'</b>'
    +(phone?'<span class="sc-info-ph">'+proEsc_(phone)+'</span>':'')+(chips||'')+'</div></div>'; };
  if (!conv || (!conv.phone && !c)) return head(conv&&conv.name, '', '')+proPkBlock_(conv)+'<div class="pkc-note">Hội thoại này chưa gắn SĐT nên chưa có hồ sơ khách. Dùng "🔗 Gắn hội thoại" trong hồ sơ khách để gắn.</div>';
  if (!c) return head(conv.name, conv.phone, '')+proPkBlock_(conv)+'<div class="pkc-note">Chưa có khách nào trong CRM với SĐT này.</div>';
  var D = P.D, care = D.care||{}, status = care.status||c.careStatus||'', now = P.now||new Date();
  var custom = care.custom||c.custom||{};
  var chips = (c.tier?'<span class="pro-chip">'+proEsc_(c.tier)+'</span>':'')+(status?'<span class="pro-chip ok">'+proEsc_(status)+'</span>':'<span class="pro-chip warn">Chưa CS</span>');
  var pend = proNextActions_(D.mine, c.phone, now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0'), D.types, 3);
  var tl = proTimeline_(D.notes, D.mine, D.orders, 30);
  return head(c.name||conv.name, c.phone, chips)
    + proPkBlock_(conv)
    + '<button type="button" class="btn sm sc-open" data-sc-open="'+proEsc_(c.phone)+'">👤 Mở hồ sơ đầy đủ</button>'
    + proStageHtml_(proStageModel_(P.tree||[], status))
    + proKpiHtml_(P.days, D.nOrd, P.rev)
    + proNextHtml_(pend)
    + '<div class="pro-card-h" style="margin:10px 0 4px">Thông tin chăm sóc</div><div class="sc-irs">'
    + proInfoRow_('Tình trạng CS', status) + proInfoRow_('Kết bạn Zalo', care.zalo) + proInfoRow_('Trạng thái KH', care.khStatus)
    + proInfoRow_('CS phụ trách', care.cs) + proInfoRow_('Sinh nhật', care.birthday) + proInfoRow_('Nhãn', custom.tag) + '</div>'
    + proTimelineHtml_(tl, D.notes.length + D.mine.length + D.orders.length);
}

// ── Gắn vào Social > Chat ──
function proChatFindCustomer_(phone){
  var n = proPhoneNorm_(phone); if (!n || typeof allCustomers==='undefined') return null;
  return allCustomers.find(function(x){ return proPhoneNorm_(x.phone)===n; }) || null;
}
var proScTab_ = 'info';   // tab đang chọn ở cột phải: 'info' | 'discuss' (giữ nguyên khi đổi hội thoại)
function proChatInfoRender_(conv){
  var el = document.getElementById('sc-info'); if (!el) return;
  if (!conv){ if (typeof khdStop_==='function') khdStop_('sc'); el.innerHTML = '<div class="pkc-note">Chọn một hội thoại để xem thông tin khách.</div>'; return; }
  var c = proChatFindCustomer_(conv.phone), P = null, phone = proPhoneNorm_(conv.phone);
  if (c){ var D = proProfileData_(c); P = { D:D, days:proDaysSinceLastOrder_(c.orders,new Date()), rev:_custRev_(c), tree:(typeof CARE_STATUS_TREE!=='undefined'?CARE_STATUS_TREE:[]), now:new Date() }; }
  var noteBox = c ? '<div class="sc-note"><textarea id="sc-note-new" rows="2" maxlength="1500" placeholder="Nhập ghi chú (Enter để lưu, @ để tag)…"></textarea></div>' : '';
  var discuss = phone ? (typeof khdBoxHtml_==='function' ? khdBoxHtml_('sc','khd-input-sc') : '') : '<div class="pkc-note">Hội thoại chưa gắn SĐT nên chưa có thảo luận. Gắn SĐT cho hội thoại trước.</div>';
  el.innerHTML = '<div class="sc-tabs"><button type="button" data-sct="info">Thông tin</button><button type="button" data-sct="discuss">🗨 Thảo luận</button></div>'
    + '<div id="sc-pane-info">'+noteBox+proChatInfoHtml_(conv, c, P)+'</div><div id="sc-pane-discuss">'+discuss+'</div>';
  var show = function(tab){
    proScTab_ = tab;
    el.querySelectorAll('[data-sct]').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-sct')===tab); });
    document.getElementById('sc-pane-info').style.display = tab==='info' ? '' : 'none';
    document.getElementById('sc-pane-discuss').style.display = tab==='discuss' ? '' : 'none';
    if (tab==='discuss' && phone && typeof khdMount_==='function') khdMount_('sc', phone); else if (typeof khdStop_==='function') khdStop_('sc');
  };
  el.querySelectorAll('[data-sct]').forEach(function(b){ b.onclick = function(){ show(b.getAttribute('data-sct')); }; });
  var btn = el.querySelector('[data-sc-open]');
  if (btn) btn.onclick = function(){ if (typeof openDp==='function'){ document.getElementById('dp-overlay').classList.add('open'); openDp(btn.getAttribute('data-sc-open')); } };
  var nb = document.getElementById('sc-note-new');
  if (nb) nb.onkeydown = function(e){
    if (e.key!=='Enter' || e.shiftKey || e.defaultPrevented) return;
    var sb = document.getElementById('nt-sug'); if (sb && sb.style.display==='block') return;   // đang chọn gợi ý @
    e.preventDefault(); var txt = nb.value.trim(); if (!txt) return;
    if (typeof proNoteAdd_==='function' && proNoteAdd_(c.phone, txt)){ nb.value = ''; if (typeof toast==='function') toast('✓ Đã lưu ghi chú'); proChatInfoRender_(conv); }
  };
  show(proScTab_);
}
if (typeof module!=='undefined') module.exports = { proPhoneNorm_, proInitials_, proChatInfoHtml_ };

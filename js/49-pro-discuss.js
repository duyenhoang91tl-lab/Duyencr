/* GIAO DIỆN PRO — Thảo luận khách (nội bộ) + ô ghi chú nhanh (P5b).
   - Ô "🗨 Thảo luận": nhân viên nhắn cho nhau về 1 khách, gõ @tên để tag (gợi ý @ dùng js/39). Hiện ở (1) tab "🗨 Thảo luận" cạnh "💬 Chat Pancake" trong
     hồ sơ khách và (2) cột phải Social > Chat (js/48). Backend: GAS khDiscuss / khDiscussSend / khDiscussDelete (gas/30_KhDiscuss.gs, v13.43+).
   - Ghi chú nhanh: proNoteAdd_ lưu ghi chú KHÔNG phụ thuộc DOM panel hồ sơ (cùng đường lưu với saveCare: careData → _touchCare → saveLS → queueCareSync). */

// ── Hàm thuần ──
function khdFmtTime_(iso){ var d = new Date(iso); if (isNaN(d)) return ''; var p = function(n){ return String(n).padStart(2,'0'); }; return p(d.getHours())+':'+p(d.getMinutes())+' '+p(d.getDate())+'/'+p(d.getMonth()+1); }
function khdRegEsc_(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
// Văn bản đã escape + tô @tên (chỉ các tên server xác nhận là mention)
function khdTextHtml_(text, mentions){
  var h = proEsc_(text);
  var names = (mentions||[]).filter(Boolean).map(function(n){ return khdRegEsc_(proEsc_(n)); }).sort(function(a,b){ return b.length-a.length; });
  // MỘT lượt thay duy nhất với alternation (tên dài trước) → tên lồng nhau ("Lan" / "Lan Anh") không bị bọc 2 lần
  if (names.length) h = h.replace(new RegExp('@(?:'+names.join('|')+')','gi'), function(m){ return '<span class="khd-at">'+m+'</span>'; });
  return h.replace(/\n/g,'<br>');
}
function khdMsgHtml_(m, me, isAdmin){
  var mine = !!me && String(m.authorUser).toLowerCase()===String(me).toLowerCase();
  return '<div class="khd-m '+(mine?'out':'in')+'"><div class="khd-b">'+(mine?'':'<b class="khd-au">'+proEsc_(m.author||m.authorUser)+'</b>')
    +'<div class="khd-tx">'+khdTextHtml_(m.text, m.mentions)+'</div><div class="khd-tm">'+proEsc_(khdFmtTime_(m.ts))
    +((mine||isAdmin)?' <a href="#" data-khd-del="'+proEsc_(m.id)+'" title="Xoá tin này">xoá</a>':'')+'</div></div></div>';
}
// Gộp tin: bỏ trùng id, cũ → mới, tối đa 300
function khdMergeMsgs_(cur, inc){
  var by = {}; (cur||[]).concat(inc||[]).forEach(function(m){ if (m && m.id) by[m.id] = m; });
  return Object.keys(by).map(function(k){ return by[k]; }).sort(function(a,b){ return a.ts<b.ts?-1:a.ts>b.ts?1:0; }).slice(-300);
}

// ── Gọi GAS ──
function khdTok_(){ try { return localStorage.getItem('ome_sess_token') || ''; } catch(e){ return ''; } }
async function khdApi_(method, action, body){
  var u = (typeof gsUrl!=='undefined') ? gsUrl : '', t = khdTok_();
  if (!u || !t) return { ok:false, code:'NOLOGIN', error:'Thảo luận cần đăng nhập bằng tài khoản thật.' };
  try {
    var r;
    if (method==='GET'){ var q = 'action='+action+'&token='+encodeURIComponent(t); for (var k in body) q += '&'+k+'='+encodeURIComponent(body[k]);
      r = await fetch(u+(u.indexOf('?')>=0?'&':'?')+q, { redirect:'follow' }); }
    else r = await fetch(u, { method:'POST', redirect:'follow', body: JSON.stringify(Object.assign({ action:action, token:t }, body)) });
    return await r.json();
  } catch(e){ return { ok:false, code:'NET', error:'Mất kết nối máy chủ.' }; }
}

// ── Hộp thảo luận (gắn vào bất kỳ chỗ nào có <div id="khd-KEY">) ──
var _khd = {};
function khdBoxHtml_(key, inputId){
  return '<div class="khd" id="khd-'+key+'"><div class="khd-log"></div><div class="khd-in"><textarea id="'+inputId+'" rows="2" maxlength="1500" placeholder="Nhắn đồng nghiệp về khách này… (gõ @ để tag, Enter để gửi)"></textarea><button type="button" class="btn primary" data-khd-send>Gửi</button></div></div>';
}
function khdMount_(key, phone){
  var host = document.getElementById('khd-'+key); if (!host) return;
  if (_khd[key] && _khd[key].timer) clearInterval(_khd[key].timer);
  var S = _khd[key] = { phone:phone, after:'', msgs:[], me:'', timer:null, n:0, busy:false, err:'', locked:false };
  host.onclick = function(e){ var t = e.target; if (!t.closest) return;
    if (t.closest('[data-khd-send]')) { khdSend_(key); return; }
    var d = t.closest('[data-khd-del]'); if (d){ e.preventDefault(); khdDel_(key, d.getAttribute('data-khd-del')); } };
  var ta = host.querySelector('textarea'); if (ta) ta.onkeydown = function(e){ if (e.key==='Enter' && !e.shiftKey && !e.defaultPrevented){ var sb = document.getElementById('nt-sug'); if (sb && sb.style.display==='block') return; e.preventDefault(); khdSend_(key); } };
  if (!khdTok_()){ S.err = 'Thảo luận cần đăng nhập bằng tài khoản thật (tài khoản demo không dùng được).'; khdRender_(key, true); if (ta) ta.disabled = true; return; }
  khdPoll_(key, true); S.timer = setInterval(function(){ khdPoll_(key, false); }, 6000);
}
function khdStop_(key){ var S = _khd[key]; if (S && S.timer) clearInterval(S.timer); delete _khd[key]; }
async function khdPoll_(key, first){
  var S = _khd[key], host = document.getElementById('khd-'+key);
  if (!S || !host || !document.body.contains(host)){ khdStop_(key); return; }
  if (!first && document.hidden) return;
  S.n++; var full = first || S.n % 5 === 0;     // 5 lần poll nhẹ thì tải lại đủ 1 lần để thấy tin bị xoá
  var r = await khdApi_('GET', 'khDiscuss', { phone:S.phone, after: full ? '' : S.after });
  if (_khd[key] !== S) return;
  if (!r.ok){
    S.err = r.error || 'Lỗi tải thảo luận';
    if (r.code==='FORBIDDEN'){ S.locked = true; S.msgs = []; }          // không có quyền xem khách này: khoá hộp, ngừng hỏi server
    if (r.code==='AUTH'||r.code==='NOLOGIN'||r.code==='FORBIDDEN'){ if (S.timer) clearInterval(S.timer); S.timer = null; }   // ngừng hỏi server, GIỮ trạng thái để còn hiện lý do
    khdRender_(key, first); return; }
  S.err = ''; S.me = r.me || S.me;
  var prev = S.msgs.map(function(m){ return m.id; }).join();
  S.msgs = full ? r.messages.slice() : khdMergeMsgs_(S.msgs, r.messages);
  if (S.msgs.length) S.after = S.msgs[S.msgs.length-1].ts;
  if (first || prev !== S.msgs.map(function(m){ return m.id; }).join()) khdRender_(key, first);
}
function khdRender_(key, stick){
  var S = _khd[key], host = document.getElementById('khd-'+key); if (!S || !host) return;
  var log = host.querySelector('.khd-log'), near = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  var isAdmin = (typeof currentUser!=='undefined' && currentUser && currentUser.role==='admin');
  var ta = host.querySelector('textarea'), sb = host.querySelector('[data-khd-send]');
  if (S.locked){ log.innerHTML = '<div class="khd-lock">🔒 '+proEsc_(S.err)+'</div>'; if (ta) ta.disabled = true; if (sb) sb.disabled = true; return; }
  log.innerHTML = (S.err ? '<div class="khd-err">'+proEsc_(S.err)+'</div>' : '')
    + (S.msgs.length ? S.msgs.map(function(m){ return khdMsgHtml_(m, S.me, isAdmin); }).join('') : (S.err ? '' : '<div class="khd-hint">Chưa có trao đổi nào về khách này. Gõ @ để tag đồng nghiệp — họ sẽ nhận thông báo.</div>'));
  if (stick || near) log.scrollTop = log.scrollHeight;
}
async function khdSend_(key){
  var S = _khd[key], host = document.getElementById('khd-'+key); if (!S || !host || S.busy) return;
  var ta = host.querySelector('textarea'), text = (ta.value||'').trim(); if (!text) return;
  S.busy = true; var r = await khdApi_('POST', 'khDiscussSend', { phone:S.phone, text:text }); S.busy = false;
  if (_khd[key] !== S) return;
  if (!r.ok){ if (r.code==='FORBIDDEN'){ S.locked = true; S.err = r.error; khdRender_(key, false); } if (typeof toast==='function') toast('⚠ '+(r.error||'Không gửi được')); return; }
  if (r.skipped && r.skipped.length && typeof toast==='function') toast('⚠ Chưa thông báo cho '+r.skipped.join(', ')+' vì họ không có quyền xem thảo luận khách này (chỉ người đang nhận trên Pancake / được phân quyền).');
  ta.value = ''; S.msgs = khdMergeMsgs_(S.msgs, [r.message]); S.after = S.msgs[S.msgs.length-1].ts; S.err = ''; khdRender_(key, true); ta.focus();
}
async function khdDel_(key, id){
  var S = _khd[key]; if (!S || !id) return; if (typeof confirm==='function' && !confirm('Xoá tin nhắn này?')) return;
  var r = await khdApi_('POST', 'khDiscussDelete', { id:id }); if (_khd[key] !== S) return;
  if (!r.ok){ if (typeof toast==='function') toast('⚠ '+(r.error||'Không xoá được')); return; }
  S.msgs = S.msgs.filter(function(m){ return m.id!==id; }); khdRender_(key, false);
}
// Tab "🗨 Thảo luận" trong hồ sơ khách (js/03 gọi)
function renderKhdTab(c){
  setTimeout(function(){ khdMount_('dp', c.phone); }, 0);
  return '<div class="khd-wrap"><div class="khd-title">🗨 Thảo luận nội bộ <span>chỉ người đang nhận khách này trên Pancake và người được phân quyền xem được · khác với "💬 Chat Pancake" (nhắn khách)</span></div>'+khdBoxHtml_('dp','khd-input')+'</div>';
}

// ── Ghi chú nhanh (P5b): lưu không cần panel hồ sơ đang mở ──
function proNoteAdd_(phone, text){
  text = String(text||'').trim(); if (!text) return false;
  var c = allCustomers.find(function(x){ return x.phone===phone; }); if (!c) return false;
  var existing = careData[phone] || {};
  var arr = _parseNotes(existing.note != null ? existing.note : (c.careNote||''));
  var userName = (typeof currentUser!=='undefined' && currentUser && currentUser.name) ? currentUser.name : 'Admin';
  arr.unshift({ text:text, user:userName, time:_fmtNoteTime(new Date()) });
  var newNote = _notesToStr(arr);
  careData[phone] = Object.assign({}, existing, { note:newNote });
  _touchCare(phone); saveLS('ome_care', careData);
  c.careNote = newNote;
  if (typeof gsUrl!=='undefined' && gsUrl) queueCareSync(phone);
  if (typeof ntNoteMention==='function') ntNoteMention(phone, text);   // @tag trong ghi chú → thông báo (js/39)
  return true;
}
if (typeof module!=='undefined') module.exports = { khdFmtTime_, khdTextHtml_, khdMsgHtml_, khdMergeMsgs_, proNoteAdd_ };

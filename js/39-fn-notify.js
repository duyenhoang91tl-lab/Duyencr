// ═══════════════════════════════════════════════════════
//  THÔNG BÁO @TAG (2026-10-11) — backend: gas_v13.js (Notifications, action notifications/notifRead/notifMention).
//  - Menu "🔔 Thông báo" (js/29-sidenav.js, ACTS.notif) + chấm số chưa đọc trên nút ☰ (hỏi lại server mỗi 60 giây).
//  - Bấm 1 thông báo: đánh dấu đã đọc + mở đúng màn hình (ghi chú -> panel khách; công việc/bình luận -> chi tiết công việc, bình luận mở tab Thảo luận).
//  - Gõ "@" trong ô ghi chú khách (#cs-note-new), bình luận (#task-cm-input), tên/mô tả công việc (#task-f-title, #task-f-desc) -> gợi ý tên tài khoản.
//    Bình luận/công việc: server tự đọc @tên khi lưu. Ghi chú khách đi qua saveSingle (dùng chung với extension) nên client gọi riêng notifMention sau khi lưu.
// ═══════════════════════════════════════════════════════
var _ntItems = [], _ntUnread = 0, _ntTimer = null, _ntLoading = false;

function _ntNorm(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/gi,'d').toLowerCase(); }
function _ntOn(){
  try {
    if (typeof gsUrl === 'undefined' || !gsUrl) return false;
    if (localStorage.getItem('ome_demo_token')) return false;          // tài khoản test: backend chặn action này
    return !!localStorage.getItem('ome_sess_token');
  } catch(e){ return false; }
}
function _ntSetUnread(n){
  _ntUnread = n;
  var b = document.getElementById('sn-toggle'); if (b) { if (n > 0) b.setAttribute('data-nt', n > 99 ? '99+' : String(n)); else b.removeAttribute('data-nt'); }
  var a = document.querySelector('#data-view .tabs .sn-act[data-act="notif"]'); if (a) { var l = _ntLabel(); if (a.textContent !== l) a.textContent = l; }
}
function _ntLabel(){ return '🔔 Thông báo' + (_ntUnread > 0 ? ' (' + _ntUnread + ')' : ''); }
async function ntPoll(){
  if (_ntLoading || !_ntOn() || document.hidden) return;
  _ntLoading = true;
  try {
    var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=notifications', { redirect:'follow' });
    var j = await r.json();
    if (j && j.ok) { _ntItems = j.items || []; _ntSetUnread(j.unread || 0); var ov = document.getElementById('nt-overlay'); if (ov && ov.classList.contains('open')) _ntRender(); }
  } catch(e){}
  finally { _ntLoading = false; }
}
function _ntStart(){
  if (_ntTimer) return;
  _ntTimer = setInterval(ntPoll, 60000);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) ntPoll(); });
  setTimeout(ntPoll, 2500);
}
function _ntAgo(iso){
  var t = new Date(iso).getTime(); if (!t) return '';
  var m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'vừa xong'; if (m < 60) return m + ' phút trước';
  var h = Math.floor(m / 60); if (h < 24) return h + ' giờ trước';
  var d = Math.floor(h / 24); if (d < 30) return d + ' ngày trước';
  return new Date(t).toLocaleDateString('vi-VN');
}
// Sự kiện quy trình công việc: kind = task_assign | task_turn | task_request | task_decision | task_done (js/44-fn-taskflow.js, GAS _notifyTaskEvent_)
function _ntIsTaskEvt(it){ var k = String((it && it.kind) || ''); return k.indexOf('task_') === 0 || k === 'chatviolation'; }   // chatviolation = cảnh báo giám sát chat (GAS _cvNotify_): text là câu hoàn chỉnh
function _ntTaskIcon(it){ return ({ task_assign:'📌', task_turn:'➡️', task_request:'✋', task_decision:'⚖️', task_done:'🏁', chatviolation:'⚠️' })[it.kind] || '🔔'; }
function _ntWhere(it){
  if (it.kind === 'note') return 'trong ghi chú khách ' + (it.refId || '');
  if (it.kind === 'khthread') return 'trong thảo luận về khách ' + (it.refId || '');
  if (it.kind === 'comment') return 'trong bình luận công việc';
  return 'trong công việc';
}
function _ntEnsureModal(){
  var ov = document.getElementById('nt-overlay'); if (ov) return ov;
  ov = document.createElement('div'); ov.id = 'nt-overlay'; ov.className = 'nt-overlay';
  ov.innerHTML = '<div class="nt-box"><div class="nt-head"><b>🔔 Thông báo</b><span class="nt-sp"></span>' +
    '<button type="button" class="btn secondary sm" id="nt-readall">Đánh dấu đã đọc hết</button>' +
    '<button type="button" class="btn secondary sm" id="nt-close">✕</button></div><div class="nt-list" id="nt-list"></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if (e.target === ov) ntClose(); });
  document.getElementById('nt-close').addEventListener('click', ntClose);
  document.getElementById('nt-readall').addEventListener('click', ntReadAll);
  document.getElementById('nt-list').addEventListener('click', function(e){
    var el = e.target.closest('.nt-it'); if (el) ntOpenItem(el.getAttribute('data-id'));
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') ntClose(); });
  return ov;
}
function ntClose(){ var ov = document.getElementById('nt-overlay'); if (ov) ov.classList.remove('open'); }
function _ntRender(){
  var box = document.getElementById('nt-list'); if (!box) return;
  if (!_ntItems.length) { box.innerHTML = '<div class="nt-empty">Chưa có thông báo nào. Khi ai đó gõ @tên của bạn trong ghi chú, bình luận hay công việc, thông báo sẽ hiện ở đây.</div>'; return; }
  box.innerHTML = _ntItems.map(function(it){
    return '<div class="nt-it' + (it.read ? '' : ' unread') + '" data-id="' + esc(it.id) + '">' +
      (_ntIsTaskEvt(it)
        ? '<div class="nt-t">' + _ntTaskIcon(it) + ' <b>' + esc(it.from || 'Hệ thống') + '</b> ' + esc(it.text || '') + '</div>'     // sự kiện quy trình công việc (GAS _notifyTaskEvent_): text là câu đầy đủ
        : '<div class="nt-t"><b>' + esc(it.from || 'Ai đó') + '</b> đã nhắc bạn ' + esc(_ntWhere(it)) + '</div><div class="nt-s">' + esc(it.text || '') + '</div>') +
      '<div class="nt-d">' + esc(_ntAgo(it.createdAt)) + '</div></div>';
  }).join('');
}
function openNotifModal(){
  var ov = _ntEnsureModal(); _ntRender(); ov.classList.add('open'); ntPoll();
}
async function _ntMark(ids, all){
  try {
    _ntItems.forEach(function(it){ if (all || ids.indexOf(it.id) >= 0) it.read = true; });
    _ntSetUnread(_ntItems.filter(function(x){ return !x.read; }).length);
    await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'notifRead', ids: ids || [], all: !!all }) });
  } catch(e){}
}
async function ntReadAll(){ await _ntMark([], true); _ntRender(); }
function ntOpenItem(id){
  var it = _ntItems.find(function(x){ return x.id === id; }); if (!it) return;
  if (!it.read) _ntMark([id], false);
  ntClose();
  try {
    if (it.kind === 'chatviolation' && it.refType === 'chatviolation' && it.refId) {
      var _ci = String(it.refId2 || '').split('|');
      _ntOpenChat_(it.refId, _ci[0] || '', _ci.slice(1).join('|') || '');   // mở thẳng đoạn chat (Social > Chat) của hội thoại bị cảnh báo
    } else if (it.refType === 'customer') {
      if (typeof openDp !== 'function') { toast('Chưa mở được khách'); return; }
      if (typeof customerMap !== 'undefined' && !customerMap[it.refId]) toast('Không thấy khách ' + it.refId + ' trong danh sách đang tải');
      openDp(it.refId);
      if (it.kind === 'khthread') { var dt = document.querySelector('#dp .dp-tab[data-tab="discuss"]'); if (dt && typeof switchDpTab === 'function') switchDpTab('discuss', dt); }   // mở thẳng tab Thảo luận
    } else if (it.refType === 'task') {
      _ntOpenTask(it.refId, it.kind === 'comment');
    } else if (it.refType === 'chatviolation') {
      toast('Cảnh báo chat cũ chưa gắn được hội thoại — xem chi tiết ở sheet ChatViolations');
    }
  } catch(e){ toast('Lỗi mở thông báo: ' + e.message); }
}
// Mở Social > Chat đúng hội thoại bị cảnh báo từ cấm. Hội thoại chưa nằm trong danh sách đang tải (cũ/ngoài bộ lọc) thì tạo dòng tạm để vẫn mở được tin nhắn.
function _ntOpenChat_(convId, phone, name){
  var tab = document.querySelector('#data-view .tabs .tab[data-bar-id="tab-chat"]');
  if (tab) tab.click(); else if (typeof switchTab === 'function') { try { switchTab('chat', document.querySelector('.tab')); } catch(e){} }
  var tries = 0;
  (function wait(){
    if (typeof scPick === 'function' && typeof _sc !== 'undefined' && document.getElementById('sc-convs')) {
      if (!_sc.convs.some(function(c){ return c.id === convId; })) _sc.convs.unshift({ id: convId, name: name || 'Khách Pancake', phone: phone || '', type: 'INBOX' });
      try { _scRenderList(); scPick(convId); } catch(e){ toast('Lỗi mở chat: ' + e.message); }
      return;
    }
    if (++tries > 30) { toast('Không mở được tab Chat — bạn có thể chưa được cấp quyền xem Chat (Social)'); return; }
    setTimeout(wait, 200);
  })();
}
function _ntOpenTask(taskId, discuss){
  var tab = document.querySelector('#data-view .tabs .tab[data-bar-id="tab-task"]');
  if (tab) tab.click(); else if (typeof switchTab === 'function') { try { switchTab('task', document.querySelector('.tab')); } catch(e){} }
  var tries = 0;
  (function wait(){
    var t = (typeof allTasks !== 'undefined') ? allTasks.find(function(x){ return x.id === taskId; }) : null;
    if (t) { openTaskDetailModal(taskId); if (discuss && typeof switchTaskDetailTab === 'function') switchTaskDetailTab('discuss'); return; }
    if (++tries > 30) { toast('Công việc này không còn trong danh sách của bạn (đã xóa hoặc không được giao)'); return; }
    setTimeout(wait, 300);
  })();
}
// Sau khi lưu ghi chú khách (addNoteEntry) -> báo người được tag. Không chờ, lỗi bị nuốt.
function ntNoteMention(phone, text){
  try {
    if (!_ntOn() || String(text || '').indexOf('@') < 0) return;
    fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'notifMention', kind:'note', phone: phone, text: text }) }).catch(function(){});
  } catch(e){}
}

// ── Gợi ý @tên ──
var _NT_FIELDS = { 'khd-input':1, 'khd-input-sc':1, 'sc-note-new':1, 'cs-note-new':1, 'new-snote':1, 'task-cm-input':1, 'task-f-title':1, 'task-f-desc':1 };
var _ntSug = { el:null, list:[], idx:0, start:-1 };
function _ntNames(){
  var out = [], seen = {};
  (typeof accounts !== 'undefined' ? accounts : []).forEach(function(a){
    if (!a || a.active === false) return;
    var n = String(a.name || a.username || '').trim(); if (!n || seen[n.toLowerCase()]) return;
    seen[n.toLowerCase()] = 1; out.push(n);
  });
  return out.sort(function(a,b){ return a.localeCompare(b,'vi'); });
}
function _ntSugBox(){
  var b = document.getElementById('nt-sug');
  if (!b) { b = document.createElement('div'); b.id = 'nt-sug'; b.className = 'nt-sug'; document.body.appendChild(b);
    b.addEventListener('mousedown', function(e){ var it = e.target.closest('.nt-sg'); if (it) { e.preventDefault(); _ntPick(parseInt(it.getAttribute('data-i'), 10)); } }); }
  return b;
}
function _ntHide(){ var b = document.getElementById('nt-sug'); if (b) b.style.display = 'none'; _ntSug.el = null; }
function _ntUpdateSug(el){
  var pos = el.selectionStart, before = el.value.slice(0, pos);
  var m = /(?:^|\s)@([^\s@]*(?: [^\s@]*)?)$/.exec(before);     // tối đa 2 từ sau @ (tên có dấu cách)
  if (!m) { _ntHide(); return; }
  var q = _ntNorm(m[1]), start = pos - m[1].length - 1;
  var list = _ntNames().filter(function(n){ return !q || _ntNorm(n).indexOf(q) >= 0; }).slice(0, 6);
  if (!list.length) { _ntHide(); return; }
  _ntSug = { el: el, list: list, idx: 0, start: start };
  var b = _ntSugBox(), r = el.getBoundingClientRect();
  b.innerHTML = list.map(function(n,i){ return '<div class="nt-sg' + (i ? '' : ' on') + '" data-i="' + i + '">@' + esc(n) + '</div>'; }).join('');
  b.style.left = Math.max(4, r.left) + 'px'; b.style.top = (r.bottom + 2) + 'px'; b.style.minWidth = Math.min(r.width, 260) + 'px'; b.style.display = 'block';
  if (r.bottom + b.offsetHeight + 8 > window.innerHeight) b.style.top = Math.max(4, r.top - b.offsetHeight - 2) + 'px';   // ô nhập sát đáy màn hình → mở gợi ý lên phía trên
}
function _ntPick(i){
  var el = _ntSug.el, n = _ntSug.list[i]; if (!el || !n) return;
  var pos = el.selectionStart, ins = '@' + n + (/^\s/.test(el.value.slice(pos)) ? '' : ' ');
  el.value = el.value.slice(0, _ntSug.start) + ins + el.value.slice(pos);
  var c = _ntSug.start + ins.length; el.focus(); el.setSelectionRange(c, c);
  _ntHide();
}
document.addEventListener('input', function(e){ var t = e.target; if (t && t.id && _NT_FIELDS[t.id]) _ntUpdateSug(t); });
document.addEventListener('keydown', function(e){
  var b = document.getElementById('nt-sug');
  if (!b || b.style.display === 'none' || !_ntSug.el || e.target !== _ntSug.el) return;
  var k = e.key;
  if (k === 'ArrowDown' || k === 'ArrowUp') {
    e.preventDefault(); e.stopImmediatePropagation();
    _ntSug.idx = (_ntSug.idx + (k === 'ArrowDown' ? 1 : _ntSug.list.length - 1)) % _ntSug.list.length;
    Array.prototype.forEach.call(b.children, function(c, i){ c.classList.toggle('on', i === _ntSug.idx); });
  } else if (k === 'Enter' || k === 'Tab') {
    e.preventDefault(); e.stopImmediatePropagation(); _ntPick(_ntSug.idx);      // chặn Enter "thêm ghi chú" khi đang chọn tên
  } else if (k === 'Escape') { e.stopImmediatePropagation(); _ntHide(); }
}, true);
document.addEventListener('click', function(e){ if (!e.target.closest || !e.target.closest('#nt-sug')) { if (_ntSug.el && e.target !== _ntSug.el) _ntHide(); } });

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _ntStart); else _ntStart();

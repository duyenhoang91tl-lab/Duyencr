// ═══════════════════════════════════════════════════════
//  SOCIAL > CHAT — hộp thư Pancake chung (menu "💬 Social" → "Chat"). Trái = danh sách hội thoại mới nhất (tìm theo tên/SĐT),
//  phải = tin nhắn + ô trả lời. Dùng lại backend của chat trong hồ sơ khách (js/41): pkChatInbox (danh sách), pkChatConv (tin nhắn),
//  pkChatSend (gửi). Bấm "Mở hồ sơ" để nhảy sang khách có cùng SĐT. Poll nhẹ 8s khi đang mở tab.
// ═══════════════════════════════════════════════════════
var _sc = { convs: [], msgs: {}, active: '', after: {}, q: '', timer: null, loading: false, err: '', sending: false, okAt: '' };
function _scOpen() { var t = document.getElementById('tab-chat'); return !!t && t.style.display !== 'none' && _activeV9Tab === 'chat'; }
function _scStop() { if (_sc.timer) { clearInterval(_sc.timer); _sc.timer = null; } }
function renderSocialChatTab() {
  var w = document.getElementById('chat-wrap'); if (!w) return;
  if (!w.firstChild) {
    w.innerHTML = '<div class="sc-list"><div class="sc-find"><input id="sc-q" type="search" placeholder="🔍 Tìm hội thoại: tên hoặc SĐT…" oninput="_scQSoon()"></div><div id="sc-convs" class="sc-convs"></div></div>'
      + '<div class="sc-main" id="sc-main"><div class="sc-head" id="sc-head"></div><div class="pkc-who" id="sc-who"></div><div class="pkc-msgs sc-msgs" id="sc-msgs"><div class="pkc-note">Chọn một hội thoại bên trái.</div></div>'
      + '<div class="pkc-status" id="sc-status"></div>'
      + '<div class="pkt-bar" id="sc-tags" style="display:none"></div>'
      + '<div class="pkc-compose" id="sc-compose" style="display:none"><button class="btn sm" type="button" title="Gợi ý tin nhắn theo sản phẩm" onclick="tplChatToggle(\'sc-compose\',\'sc-input\')">💡</button><textarea id="sc-input" rows="2" placeholder="Nhập tin trả lời… (Ctrl+Enter để gửi)" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key===\'Enter\'){event.preventDefault();scSend();}"></textarea><button class="save-btn pkc-send" id="sc-send" onclick="scSend()">Gửi</button></div></div>';
    w.insertAdjacentHTML('beforeend', '<div class="sc-info" id="sc-info"><div class="pkc-note">Chọn một hội thoại để xem thông tin khách.</div></div>');   // cột Thông tin khách kiểu Pancake (js/48)
  }
  _scStop(); scLoadList();
  _sc.timer = setInterval(function () { if (!_scOpen()) { _scStop(); return; } if (!document.hidden) { scLoadList(); if (_sc.active) scLoadMsgs(false); } }, 20000);
  if (_sc.active) scDockSync(); else if (window._scDocked) _scUndock();   // vào lại tab: hiện đúng hồ sơ của hội thoại đang chọn, chưa chọn thì không để hồ sơ cũ treo ở đó
}
var _scQT;
function _scQSoon() { clearTimeout(_scQT); _scQT = setTimeout(function () { _sc.q = ((document.getElementById('sc-q') || {}).value || '').trim(); scLoadList(); }, 350); }
// Lỗi tải danh sách hiện NGAY TRÊN danh sách (màn hẹp/điện thoại ẩn khung chat bên phải nên dòng trạng thái ở đó không ai thấy -> danh sách trống không rõ lý do).
function _scErrHint(msg) {
  var m = String(msg || '');
  if (/urlfetch|qua nhieu|too many|quota|han muc/i.test(m)) return 'Hôm nay máy chủ đã hết lượt gọi dịch vụ ngoài (UrlFetch) nên chưa đọc được hộp thư. Hạn mức tự làm mới khoảng 14h (giờ VN) — báo quản trị nếu cần xử lý ngay.';
  if (/AUTH|dang nhap|đăng nhập/i.test(m)) return 'Phiên đăng nhập có thể đã hết hạn — đăng xuất rồi đăng nhập lại.';
  if (/ket noi|kết nối|502|Failed to fetch/i.test(m)) return 'Kiểm tra mạng rồi bấm Thử lại.';
  return '';
}
function _scListErr() {
  var list = document.querySelector('.sc-list'); if (!list) return;
  var box = document.getElementById('sc-lerr');
  if (!_sc.err) { if (box) box.remove(); return; }
  if (!box) {
    box = document.createElement('div'); box.id = 'sc-lerr'; box.className = 'sc-lerr';
    var f = list.querySelector('.sc-find'); if (f && f.insertAdjacentElement) f.insertAdjacentElement('afterend', box); else list.insertBefore(box, list.firstChild);
  }
  var hint = _scErrHint(_sc.err);
  box.innerHTML = '<div><b>⚠ ' + _pkcEsc(_sc.err) + '</b></div>' + (hint ? '<div class="sc-lerr-h">' + _pkcEsc(hint) + '</div>' : '')
    + '<button class="btn sm" type="button" onclick="scLoadList()">↻ Thử lại</button>';
}
function _scStatus() {
  _scListErr();
  var el = document.getElementById('sc-status'); if (!el) return;
  el.className = 'pkc-status' + (_sc.err ? ' err' : ''); el.textContent = _sc.err || (_sc.okAt ? 'Cập nhật lúc ' + _sc.okAt + _pkcVerText(_sc.gv) : '');
}
function _scAgo(iso) {
  var d = new Date(iso); if (isNaN(d)) return '';
  var m = Math.round((Date.now() - d) / 60000);
  if (m < 1) return 'vừa xong'; if (m < 60) return m + ' phút'; if (m < 1440) return Math.floor(m / 60) + ' giờ';
  return _pkcDay(iso).slice(0, 5);
}
async function scLoadList() {
  if (_sc.loading) return; _sc.loading = true;
  try {
    var j = await (await fetch(_pkcUrl('action=pkChatInbox' + (_sc.q ? '&q=' + encodeURIComponent(_sc.q) : '')), { redirect: 'follow' })).json();
    if (!j || j.error) { _sc.err = _pkcAuthFail(j) ? 'Phiên đăng nhập đã hết hạn — đăng nhập lại để xem tin nhắn.' : ((j && j.error) || 'Không tải được hộp thư.'); _scStatus(); return; }
    _pkcAuthShown = false; _sc.err = ''; _sc.okAt = _pkcHm(new Date().toISOString()); _sc.gv = j.gv || ''; _sc.convs = j.conversations || []; _pkTagApplyOv(_sc.convs);
    _scRenderList(); _scStatus();
  } catch (e) { _sc.err = 'Không kết nối được máy chủ.'; _scStatus(); }
  finally { _sc.loading = false; }
}
function _scRenderList() {
  var el = document.getElementById('sc-convs'); if (!el) return;
  el.innerHTML = _sc.convs.length ? _sc.convs.map(function (c) {
    return '<div class="sc-conv' + (c.id === _sc.active ? ' on' : '') + (c.seen === false ? ' unseen' : '') + '" data-id="' + _pkcEsc(c.id) + '" onclick="scPick(this.getAttribute(\'data-id\'))">'
      + '<div class="sc-av">' + _pkcEsc(typeof proInitials_ === 'function' ? proInitials_(c.name) : '?') + '</div><div class="sc-conv-body">'
      + '<div class="sc-conv-n"><b>' + _pkcEsc(c.name || 'Khách Pancake') + '</b><span>' + _pkcEsc(_scAgo(c.lastAt)) + '</span></div>'
      + (c.phone ? '<div class="sc-conv-p">' + _pkcEsc(c.phone) + '</div>' : '')
      + (c.assignees && c.assignees.length ? '<div class="sc-conv-s">\ud83d\udc64 ' + _pkcEsc(c.assignees.join(', ')) + '</div>' : '')   // ten sale phu trach (pk_staff); chua co ten -> khong hien, KHONG lo uuid
      + '<div class="sc-conv-t">' + _pkcEsc(c.lastText || '') + '</div>'
      + (c.tags && c.tags.length ? '<div class="sc-conv-g">' + _pkcTagsHtml(c.tags, 3) + '</div>' : '')
      + (c.seen === false ? '<i class="sc-dot"></i>' : '') + '</div>';
  }).join('') : '<div class="pkc-note">Không có hội thoại nào.</div>';
  var hm = document.getElementById('sc-head-m');
  if (hm) hm.innerHTML = _pkcMetaRow(_sc.convs.filter(function (x) { return x.id === _sc.active; })[0]);
  pkTagBarRender('sc-tags');
}
function scPick(id) {
  _sc.active = id; _scRenderList();
  var c = _sc.convs.filter(function (x) { return x.id === id; })[0] || {};
  var h = document.getElementById('sc-head');
  if (h) h.innerHTML = '<button class="btn sm sc-back" onclick="scBack()">←</button><b>' + _pkcEsc(c.name || 'Khách Pancake') + '</b>' + (c.phone ? ' <span class="pkc-ph">' + _pkcEsc(c.phone) + '</span> <button class="btn sm" onclick="scOpenProfile()">👤 Mở hồ sơ</button>' : ' <span class="pkc-ph">chưa gắn SĐT</span>') + (typeof _ovIsAdmin === 'function' && _ovIsAdmin() ? ' <button class="btn sm" onclick="scDiag()" title="Chẩn đoán thẻ / tên nhân viên (chỉ admin)">🔍 Chẩn đoán</button>' : '') + '<div class="sc-head-m" id="sc-head-m">' + _pkcMetaRow(c) + '</div>';
  var cp = document.getElementById('sc-compose'); if (cp) cp.style.display = (c.type === 'COMMENT') ? 'none' : '';
  var wh0 = document.getElementById('sc-who'); if (wh0) wh0.innerHTML = '';
  var box = document.getElementById('sc-main'); if (box) box.classList.add('has-conv');
  if (typeof proChatInfoRender_ === 'function') { try { proChatInfoRender_(c); } catch (e) { console.warn('[ui-pro] chat info', e); } }
  scLoadMsgs(true);
  scDockSync();   // hồ sơ khách (cùng SĐT) hiện bên phải như Pancake
}
// 🔍 CHAN DOAN (admin): lay du lieu THAT cua hoi thoai dang mo (the luu trong Supabase, ket qua API tags/users cua Pancake, khoa raw.from, last_sent_by) de biet vi sao chua hien the / ten nhan vien.
// Khong chua token, noi dung tin bi bo. Bam "Sao chép" roi dan lai cho nguoi ho tro.
function _scDiagBox(txt) {
  var el = document.getElementById('sc-diag');
  if (!el) {
    el = document.createElement('div'); el.id = 'sc-diag';
    el.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(20,20,10,.5);display:flex;align-items:center;justify-content:center;padding:14px';
    el.innerHTML = '<div style="background:var(--surface);border-radius:12px;width:min(720px,100%);max-height:92vh;display:flex;flex-direction:column;padding:14px 16px;gap:8px;box-shadow:var(--shadow-md)">'
      + '<div style="display:flex;align-items:center;gap:8px"><b style="flex:1">🔍 Chẩn đoán hội thoại Pancake</b><button class="btn sm" id="sc-diag-copy">Sao chép</button><button class="btn sm" id="sc-diag-x">Đóng</button></div>'
      + '<textarea id="sc-diag-t" readonly style="flex:1;min-height:320px;font:12px/1.4 monospace;width:100%;box-sizing:border-box"></textarea></div>';
    document.body.appendChild(el);
    el.addEventListener('mousedown', function (e) { if (e.target === el) el.style.display = 'none'; });
    document.getElementById('sc-diag-x').onclick = function () { el.style.display = 'none'; };
    document.getElementById('sc-diag-copy').onclick = function () {
      var t = document.getElementById('sc-diag-t'); t.select();
      try { if (navigator.clipboard) navigator.clipboard.writeText(t.value); else document.execCommand('copy'); if (typeof toast === 'function') toast('Đã sao chép'); } catch (e) {}
    };
  }
  el.style.display = 'flex'; document.getElementById('sc-diag-t').value = txt;
}
async function scDiag() {
  var id = _sc.active; if (!id) return;
  _scDiagBox('⏳ Đang lấy dữ liệu chẩn đoán…');
  try {
    var j = await (await fetch(_pkcUrl('action=pkChatDiag&conv=' + encodeURIComponent(id)), { redirect: 'follow' })).json();
    _scDiagBox(JSON.stringify(Object.assign({ ui: PKC_UI_VER, webGv: _sc.gv || '(GAS cũ)' }, j), null, 2));
  } catch (e) { _scDiagBox('Lỗi: ' + (e && e.message || e)); }
}
function scBack() { var box = document.getElementById('sc-main'); if (box) box.classList.remove('has-conv'); }
// ── Hồ sơ khách GẮN cạnh khung chat (giống cột "Thông tin" của Pancake): dùng lại ĐÚNG ngăn #dp của Danh sách KH (cùng tab Chăm sóc / Lịch hẹn / Lịch sử đơn / Tổng quan,
// cùng lưu tự động) bằng cách chuyển #dp vào #sc-dock thay vì viết hồ sơ thứ hai. Màn hình hẹp (<1000px) hoặc khách chưa có trong CRM -> không gắn.
function _scDockFits() { return window.innerWidth >= 1000; }
function _scUndock() {
  var dock = document.getElementById('sc-dock'), dp = document.getElementById('dp'), ov = document.getElementById('dp-overlay');
  window._scDocked = false;
  if (dock) dock.classList.remove('on');
  var tc = document.getElementById('tab-chat'); if (tc) tc.classList.remove('sc-docked');   // hiện lại cột tóm tắt #sc-info
  if (dp && ov && dp.parentNode !== ov) ov.appendChild(dp);
  if (ov) ov.classList.remove('open');
}
function scDockSync() {
  var c = _sc.convs.filter(function (x) { return x.id === _sc.active; })[0];
  var phone = c && c.phone;
  var cust = !phone ? null : (typeof proChatFindCustomer_ === 'function' ? proChatFindCustomer_(phone)
    : (typeof allCustomers !== 'undefined' ? (allCustomers.find(function (x) { return x.phone === phone; }) || null) : null));
  var known = !!cust;
  if (cust) phone = cust.phone;   // dung SĐT đúng định dạng trong CRM (openDp tìm theo SĐT chính xác)
  if (!known || !_scDockFits()) { if (window._scDocked) { if (typeof _dpAutoFlush_ === 'function') _dpAutoFlush_(true); _scUndock(); } return false; }
  if (window._scDocked && currentPhone === phone) return true;   // đã đang hiện đúng khách này (tránh vẽ lại, giữ ô đang nhập dở)
  var dock = document.getElementById('sc-dock'), dp = document.getElementById('dp');
  if (!dock || !dp) return false;
  window._scDockOpening = true;
  try {
    if (dp.parentNode !== dock) dock.appendChild(dp);
    dock.classList.add('on'); window._scDocked = true;
    var tc = document.getElementById('tab-chat'); if (tc) tc.classList.add('sc-docked');   // ẩn cột tóm tắt #sc-info (hồ sơ đầy đủ đã hiện)
    openDp(phone);
  } finally { window._scDockOpening = false; }
  return true;
}
function scOpenProfile() {
  var c = _sc.convs.filter(function (x) { return x.id === _sc.active; })[0]; if (!c || !c.phone) return;
  if (scDockSync()) return;   // gắn cạnh chat (mở lại nếu vừa bấm ✕)
  // Không gắn được (màn hình hẹp): mở hồ sơ dạng ngăn trượt nếu có khách; khách chưa có trong CRM thì nhảy sang Danh sách KH tìm theo SĐT
  var cu = (typeof proChatFindCustomer_ === 'function') ? proChatFindCustomer_(c.phone) : null;   // chuẩn hoá SĐT (js/48)
  if (cu && typeof openDp === 'function') { document.getElementById('dp-overlay').classList.add('open'); openDp(cu.phone); return; }   // có khách: mở thẳng panel hồ sơ
  var tl = document.querySelector('#data-view .tabs [onclick*="switchTab(\'list\'"]'); if (tl) tl.click();
  var si = document.getElementById('search-input'); if (si) { si.value = c.phone; si.dispatchEvent(new Event('input', { bubbles: true })); }
}
async function scLoadMsgs(full) {
  var id = _sc.active; if (!id) return;
  try {
    var after = (!full && _sc.after[id]) ? '&after=' + encodeURIComponent(_sc.after[id]) : '';
    var j = await (await fetch(_pkcUrl('action=pkChatConv&conv=' + encodeURIComponent(id) + after), { redirect: 'follow' })).json();
    if (id !== _sc.active) return;
    if (!j || j.error) { _sc.err = _pkcAuthFail(j) ? 'Phiên đăng nhập đã hết hạn — đăng nhập lại để xem tin nhắn.' : ((j && j.error) || 'Không tải được tin nhắn.'); _scStatus(); return; }
    _sc.err = ''; if (full) { _sc.msgs[id] = {}; _sc.after[id] = ''; }
    (j.messages || []).forEach(function (m) { (_sc.msgs[id] = _sc.msgs[id] || {})[m.id] = m; if (m.at && (!_sc.after[id] || m.at > _sc.after[id])) _sc.after[id] = m.at; });
    _scRenderMsgs(full);
  } catch (e) { _sc.err = 'Không kết nối được máy chủ.'; _scStatus(); }
}
function _scRenderMsgs(forceBottom) {
  var box = document.getElementById('sc-msgs'); if (!box) return;
  var near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  var list = Object.keys(_sc.msgs[_sc.active] || {}).map(function (k) { return _sc.msgs[_sc.active][k]; });
  var real = list.filter(function (m) { return !m.tmp; });
  list = list.filter(function (m) { return !m.tmp || !real.some(function (r) { return r.dir === 'out' && r.text.trim() === m.text.trim() && new Date(r.at) >= new Date(m.at) - 30000; }); });
  list.sort(function (a, b) { return String(a.at) < String(b.at) ? -1 : String(a.at) > String(b.at) ? 1 : 0; });
  var conv = _sc.convs.filter(function (x) { return x.id === _sc.active; })[0] || {};
  var html = '', lastDay = '';
  list.forEach(function (m) {
    var d = _pkcDay(m.at); if (d && d !== lastDay) { lastDay = d; html += '<div class="pkc-day">' + d + '</div>'; }
    html += '<div class="pkc-m ' + (m.dir === 'out' ? 'out' : 'in') + '"><div class="pkc-b">' + _pkcEsc(m.text).replace(/\n/g, '<br>') + _pkcAttHtml(m.att) + '</div>' + _pkcMetaHtml(m, conv) + '</div>';
  });
  box.innerHTML = html || '<div class="pkc-note">Hội thoại chưa có tin nhắn nào được lưu.</div>';
  var wh = document.getElementById('sc-who'); if (wh) wh.innerHTML = _pkcWhoHtml(_sc.msgs[_sc.active]);
  if (forceBottom || near) box.scrollTop = box.scrollHeight;
  _scStatus();
}
async function scSend() {
  if (_sc.sending || !_sc.active) return;
  var ta = document.getElementById('sc-input'), btn = document.getElementById('sc-send'); if (!ta) return;
  var text = (ta.value || '').trim(); if (!text) return;
  _sc.sending = true; if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi…'; }
  var conv = _sc.active, tmpId = 'tmp_' + Date.now();
  (_sc.msgs[conv] = _sc.msgs[conv] || {})[tmpId] = { id: tmpId, c: conv, dir: 'out', text: text, at: new Date().toISOString(), att: [], tmp: true };
  ta.value = ''; _scRenderMsgs(true);
  try {
    var j = await (await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'pkChatSend', convId: conv, text: text }) })).json();
    if (!j || !j.ok) throw new Error((j && j.error) || 'Gửi thất bại.');
    _sc.err = ''; setTimeout(function () { scLoadMsgs(false); }, 1500); setTimeout(function () { scLoadMsgs(false); }, 4000);
  } catch (e) {
    delete _sc.msgs[conv][tmpId]; if (!ta.value) ta.value = text;
    _sc.err = 'Gửi lỗi: ' + (e && e.message || e); _scRenderMsgs(false);
    if (typeof toast === 'function') toast('✕ Gửi tin lỗi');
  } finally { _sc.sending = false; if (btn) { btn.disabled = false; btn.textContent = 'Gửi'; } }
}

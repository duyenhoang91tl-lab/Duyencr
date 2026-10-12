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
      + '<div class="sc-main" id="sc-main"><div class="sc-head" id="sc-head"></div><div class="pkc-msgs sc-msgs" id="sc-msgs"><div class="pkc-note">Chọn một hội thoại bên trái.</div></div>'
      + '<div class="pkc-status" id="sc-status"></div>'
      + '<div class="pkc-compose" id="sc-compose" style="display:none"><button class="btn sm" type="button" title="Gợi ý tin nhắn theo sản phẩm" onclick="tplChatToggle(\'sc-compose\',\'sc-input\')">💡</button><textarea id="sc-input" rows="2" placeholder="Nhập tin trả lời… (Ctrl+Enter để gửi)" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key===\'Enter\'){event.preventDefault();scSend();}"></textarea><button class="save-btn pkc-send" id="sc-send" onclick="scSend()">Gửi</button></div></div>';
  }
  _scStop(); scLoadList();
  _sc.timer = setInterval(function () { if (!_scOpen()) { _scStop(); return; } if (!document.hidden) { scLoadList(); if (_sc.active) scLoadMsgs(false); } }, 8000);
}
var _scQT;
function _scQSoon() { clearTimeout(_scQT); _scQT = setTimeout(function () { _sc.q = ((document.getElementById('sc-q') || {}).value || '').trim(); scLoadList(); }, 350); }
function _scStatus() {
  var el = document.getElementById('sc-status'); if (!el) return;
  el.className = 'pkc-status' + (_sc.err ? ' err' : ''); el.textContent = _sc.err || (_sc.okAt ? 'Cập nhật lúc ' + _sc.okAt : '');
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
    if (!j || j.error) { _sc.err = (j && j.error) || 'Không tải được hộp thư.'; _scStatus(); return; }
    _sc.err = ''; _sc.okAt = _pkcHm(new Date().toISOString()); _sc.convs = j.conversations || [];
    _scRenderList(); _scStatus();
  } catch (e) { _sc.err = 'Không kết nối được máy chủ.'; _scStatus(); }
  finally { _sc.loading = false; }
}
function _scRenderList() {
  var el = document.getElementById('sc-convs'); if (!el) return;
  el.innerHTML = _sc.convs.length ? _sc.convs.map(function (c) {
    return '<div class="sc-conv' + (c.id === _sc.active ? ' on' : '') + (c.seen === false ? ' unseen' : '') + '" data-id="' + _pkcEsc(c.id) + '" onclick="scPick(this.getAttribute(\'data-id\'))">'
      + '<div class="sc-conv-n"><b>' + _pkcEsc(c.name || 'Khách Pancake') + '</b><span>' + _pkcEsc(_scAgo(c.lastAt)) + '</span></div>'
      + (c.phone ? '<div class="sc-conv-p">' + _pkcEsc(c.phone) + '</div>' : '')
      + '<div class="sc-conv-t">' + _pkcEsc(c.lastText || '') + '</div></div>';
  }).join('') : '<div class="pkc-note">Không có hội thoại nào.</div>';
}
function scPick(id) {
  _sc.active = id; _scRenderList();
  var c = _sc.convs.filter(function (x) { return x.id === id; })[0] || {};
  var h = document.getElementById('sc-head');
  if (h) h.innerHTML = '<button class="btn sm sc-back" onclick="scBack()">←</button><b>' + _pkcEsc(c.name || 'Khách Pancake') + '</b>' + (c.phone ? ' <span class="pkc-ph">' + _pkcEsc(c.phone) + '</span> <button class="btn sm" onclick="scOpenProfile()">👤 Mở hồ sơ</button>' : ' <span class="pkc-ph">chưa gắn SĐT</span>');
  var cp = document.getElementById('sc-compose'); if (cp) cp.style.display = (c.type === 'COMMENT') ? 'none' : '';
  var box = document.getElementById('sc-main'); if (box) box.classList.add('has-conv');
  scLoadMsgs(true);
}
function scBack() { var box = document.getElementById('sc-main'); if (box) box.classList.remove('has-conv'); }
function scOpenProfile() {
  var c = _sc.convs.filter(function (x) { return x.id === _sc.active; })[0]; if (!c || !c.phone) return;
  var tl = document.querySelector('#data-view .tabs [onclick*="switchTab(\'list\'"]'); if (tl) tl.click();
  var si = document.getElementById('search-input'); if (si) { si.value = c.phone; si.dispatchEvent(new Event('input', { bubbles: true })); }
}
async function scLoadMsgs(full) {
  var id = _sc.active; if (!id) return;
  try {
    var after = (!full && _sc.after[id]) ? '&after=' + encodeURIComponent(_sc.after[id]) : '';
    var j = await (await fetch(_pkcUrl('action=pkChatConv&conv=' + encodeURIComponent(id) + after), { redirect: 'follow' })).json();
    if (id !== _sc.active) return;
    if (!j || j.error) { _sc.err = (j && j.error) || 'Không tải được tin nhắn.'; _scStatus(); return; }
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
  var html = '', lastDay = '';
  list.forEach(function (m) {
    var d = _pkcDay(m.at); if (d && d !== lastDay) { lastDay = d; html += '<div class="pkc-day">' + d + '</div>'; }
    html += '<div class="pkc-m ' + (m.dir === 'out' ? 'out' : 'in') + '"><div class="pkc-b">' + _pkcEsc(m.text).replace(/\n/g, '<br>') + _pkcAttHtml(m.att) + '</div><div class="pkc-t">' + _pkcHm(m.at) + (m.tmp ? ' ✓' : '') + '</div></div>';
  });
  box.innerHTML = html || '<div class="pkc-note">Hội thoại chưa có tin nhắn nào được lưu.</div>';
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

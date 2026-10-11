// ═══════════════════════════════════════════════════════
//  CHAT PANCAKE TRONG HỒ SƠ KHÁCH (hộp thư Pancake bước 4b/5b) — tab "💬 Chat" của panel chi tiết khách.
//  Đọc tin từ Supabase qua GAS (action pkChat, tự kèm token phiên nhờ fetch wrapper ở js/06), poll nhẹ 6s khi tab đang mở,
//  gửi trả lời (pkChatSend), tìm + gắn hội thoại Pancake với khách theo SĐT (pkChatFind / pkChatLink).
//  Backend: gas_v13.js mục "CHAT PANCAKE TRONG CRM" (gas/25_PancakeChat.gs). Tài khoản test không thấy tab này (css) và server chặn.
// ═══════════════════════════════════════════════════════
var _pkc = { phone: '', convs: [], msgs: {}, active: '', after: '', timer: null, loading: false, firstLoad: true, err: '', sending: false, tick: 0, okAt: '' };
function _pkcEsc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function _pkcUrl(qs) { return gsUrl + (gsUrl.indexOf('?') > -1 ? '&' : '?') + qs; }
function _pkcHm(iso) { var d = new Date(iso); if (isNaN(d)) return ''; return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
function _pkcDay(iso) { var d = new Date(iso); if (isNaN(d)) return ''; return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }
function _pkcStop() { if (_pkc.timer) { clearInterval(_pkc.timer); _pkc.timer = null; } }

function renderPkChatTab(c) {
  _pkcStop();
  _pkc = { phone: c.phone, convs: [], msgs: {}, active: '', after: '', timer: null, loading: false, firstLoad: true, err: '', sending: false, tick: 0, okAt: '' };
  setTimeout(function () { if (_pkc.phone === c.phone && document.getElementById('pkc-root')) { pkcLoad(true); _pkc.timer = setInterval(_pkcTick, 6000); } }, 0);
  return '<div id="pkc-root" class="pkc" data-phone="' + _pkcEsc(c.phone) + '">'
    + '<div class="pkc-convs" id="pkc-convs"></div>'
    + '<div class="pkc-msgs" id="pkc-msgs"><div class="pkc-note">Đang tải tin nhắn…</div></div>'
    + '<div class="pkc-status" id="pkc-status"></div>'
    + '<div class="pkc-compose" id="pkc-compose">'
    +   '<textarea id="pkc-input" rows="2" placeholder="Nhập tin trả lời… (Ctrl+Enter để gửi)" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key===\'Enter\'){event.preventDefault();pkcSend();}"></textarea>'
    +   '<button class="save-btn pkc-send" id="pkc-send" onclick="pkcSend()">Gửi</button>'
    + '</div>'
    + '<details class="pkc-link" id="pkc-link"><summary>🔗 Gắn hội thoại Pancake khác với khách này</summary>'
    +   '<div class="pkc-find"><input id="pkc-q" placeholder="Tên trên Pancake hoặc SĐT…" onkeydown="if(event.key===\'Enter\')pkcFind()"><button class="btn sm" onclick="pkcFind()">Tìm</button></div>'
    +   '<div id="pkc-found"></div></details>'
    + '</div>';
}
function _pkcTick() {
  var root = document.getElementById('pkc-root'), ov = document.getElementById('dp-overlay');
  if (!root || root.getAttribute('data-phone') !== _pkc.phone || !ov || !ov.classList.contains('open')) { _pkcStop(); return; }
  if (document.hidden) return;
  _pkc.tick++; pkcLoad(_pkc.tick % 10 === 0);   // 10 lần poll nhẹ thì tải đầy đủ 1 lần (phòng tin đến trễ có giờ cũ hơn mốc)
}
async function pkcLoad(full) {
  var P = _pkc; if (!P.phone || P.loading) return; P.loading = true; var ph = P.phone;
  try {
    var r = await fetch(_pkcUrl('action=pkChat&phone=' + encodeURIComponent(ph) + ((!full && P.after) ? '&after=' + encodeURIComponent(P.after) : '')), { redirect: 'follow' });
    var j = await r.json();
    if (_pkc.phone !== ph) return;   // đã chuyển sang khách khác
    if (!j || j.error) { P.err = (j && j.error) || 'Không tải được chat.'; _pkcStatus(); return; }
    P.err = ''; P.okAt = _pkcHm(new Date().toISOString());
    P.convs = j.conversations || [];
    if (full) P.msgs = {};
    (j.messages || []).forEach(function (m) { (P.msgs[m.c] = P.msgs[m.c] || {})[m.id] = m; if (m.at && (!P.after || m.at > P.after)) P.after = m.at; });
    if (!P.active || !P.convs.some(function (c) { return c.id === P.active; })) P.active = P.convs.length ? P.convs[0].id : '';
    _pkcRender(P.firstLoad); P.firstLoad = false;
  } catch (e) { P.err = 'Không kết nối được máy chủ.'; _pkcStatus(); }
  finally { P.loading = false; }
}
function _pkcStatus() {
  var el = document.getElementById('pkc-status'); if (!el) return;
  el.className = 'pkc-status' + (_pkc.err ? ' err' : '');
  el.textContent = _pkc.err || (_pkc.okAt ? 'Cập nhật lúc ' + _pkc.okAt : '');
}
function _pkcAttHtml(att) {
  return (att || []).map(function (a) {
    var u = _pkcEsc(a.url), isImg = /image|photo|sticker/i.test(a.type || '') || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(a.url);
    return isImg ? '<a href="' + u + '" target="_blank" rel="noopener"><img class="pkc-img" loading="lazy" src="' + u + '" alt=""></a>' : '<a class="pkc-file" href="' + u + '" target="_blank" rel="noopener">📎 ' + _pkcEsc(a.name || 'Tệp đính kèm') + '</a>';
  }).join('');
}
function _pkcRender(forceBottom) {
  var P = _pkc, cv = document.getElementById('pkc-convs'), box = document.getElementById('pkc-msgs'); if (!box) return;
  if (cv) cv.innerHTML = P.convs.length > 1 ? P.convs.map(function (c) {
    return '<span class="pkc-chip' + (c.id === P.active ? ' on' : '') + '" onclick="pkcPick(this.getAttribute(\'data-id\'))" data-id="' + _pkcEsc(c.id) + '">' + _pkcEsc(c.name || 'Khách Pancake') + (c.lastAt ? ' · ' + _pkcDay(c.lastAt).slice(0, 5) : '') + '</span>';
  }).join('') : '';
  var near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  var comp = document.getElementById('pkc-compose'), lk = document.getElementById('pkc-link');
  if (!P.active) {
    box.innerHTML = '<div class="pkc-note">Chưa có hội thoại Pancake nào gắn với SĐT này.<br>Nếu khách đã nhắn Pancake, bấm "Gắn hội thoại" bên dưới, tìm theo tên trên Pancake rồi gắn.</div>';
    if (comp) comp.style.display = 'none'; if (lk) lk.open = true; _pkcStatus(); return;
  }
  var conv = P.convs.filter(function (c) { return c.id === P.active; })[0] || {};
  if (comp) comp.style.display = (conv.type === 'COMMENT') ? 'none' : '';
  var list = Object.keys(P.msgs[P.active] || {}).map(function (k) { return P.msgs[P.active][k]; });
  var real = list.filter(function (m) { return !m.tmp; });
  list = list.filter(function (m) {   // bỏ tin tạm khi đã có tin thật cùng nội dung (tin vọng lại từ webhook)
    if (!m.tmp) return true;
    return !real.some(function (r) { return r.dir === 'out' && r.text.trim() === m.text.trim() && new Date(r.at) >= new Date(m.at) - 30000; });
  });
  list.sort(function (a, b) { return String(a.at) < String(b.at) ? -1 : String(a.at) > String(b.at) ? 1 : 0; });
  var html = '', lastDay = '';
  list.forEach(function (m) {
    var d = _pkcDay(m.at); if (d && d !== lastDay) { lastDay = d; html += '<div class="pkc-day">' + d + '</div>'; }
    html += '<div class="pkc-m ' + (m.dir === 'out' ? 'out' : 'in') + '"><div class="pkc-b">' + _pkcEsc(m.text).replace(/\n/g, '<br>') + _pkcAttHtml(m.att) + '</div><div class="pkc-t">' + _pkcHm(m.at) + (m.tmp ? ' ✓' : '') + '</div></div>';
  });
  box.innerHTML = html || '<div class="pkc-note">Hội thoại chưa có tin nhắn nào được lưu (tin cũ trước khi cài webhook chưa kéo về).</div>';
  if (forceBottom || near) box.scrollTop = box.scrollHeight;
  _pkcStatus();
}
function pkcPick(id) { _pkc.active = id; _pkcRender(true); }
async function pkcSend() {
  var P = _pkc; if (P.sending || !P.active) return;
  var ta = document.getElementById('pkc-input'), btn = document.getElementById('pkc-send'); if (!ta) return;
  var text = (ta.value || '').trim(); if (!text) return;
  P.sending = true; if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi…'; }
  var conv = P.active, tmpId = 'tmp_' + Date.now();
  (P.msgs[conv] = P.msgs[conv] || {})[tmpId] = { id: tmpId, c: conv, dir: 'out', text: text, at: new Date().toISOString(), att: [], tmp: true };
  ta.value = ''; _pkcRender(true);
  try {
    var r = await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'pkChatSend', convId: conv, text: text }) });
    var j = await r.json();
    if (!j || !j.ok) throw new Error((j && j.error) || 'Gửi thất bại.');
    P.err = ''; setTimeout(function () { pkcLoad(false); }, 1500); setTimeout(function () { pkcLoad(false); }, 4000);
  } catch (e) {
    delete P.msgs[conv][tmpId]; if (!ta.value) ta.value = text;   // trả lại nội dung để khỏi gõ lại
    P.err = 'Gửi lỗi: ' + (e && e.message || e); _pkcRender(false);
    if (typeof toast === 'function') toast('✕ Gửi tin lỗi');
  } finally { P.sending = false; if (btn) { btn.disabled = false; btn.textContent = 'Gửi'; } }
}
async function pkcFind() {
  var q = ((document.getElementById('pkc-q') || {}).value || '').trim(), out = document.getElementById('pkc-found'); if (!out) return;
  if (q.length < 2) { out.innerHTML = '<div class="pkc-note">Nhập ít nhất 2 ký tự.</div>'; return; }
  out.innerHTML = '<div class="pkc-note">Đang tìm…</div>';
  try {
    var j = await (await fetch(_pkcUrl('action=pkChatFind&q=' + encodeURIComponent(q)), { redirect: 'follow' })).json();
    if (!j || j.error) { out.innerHTML = '<div class="pkc-note err">' + _pkcEsc((j && j.error) || 'Tìm lỗi.') + '</div>'; return; }
    var cs = j.conversations || [];
    out.innerHTML = cs.length ? cs.map(function (c) {
      return '<div class="pkc-hit"><div class="pkc-hit-i"><b>' + _pkcEsc(c.name || '(không tên)') + '</b>' + (c.phone ? ' <span class="pkc-ph">đang gắn ' + _pkcEsc(c.phone) + '</span>' : '')
        + '<div class="pkc-hit-t">' + _pkcEsc(c.lastText || '') + '</div></div><button class="btn sm" data-id="' + _pkcEsc(c.id) + '" data-ph="' + _pkcEsc(c.phone || '') + '" onclick="pkcLink(this.getAttribute(\'data-id\'),this.getAttribute(\'data-ph\'))">Gắn</button></div>';
    }).join('') : '<div class="pkc-note">Không tìm thấy hội thoại nào.</div>';
  } catch (e) { out.innerHTML = '<div class="pkc-note err">Không kết nối được máy chủ.</div>'; }
}
async function pkcLink(convId, curPhone) {
  var P = _pkc; if (!P.phone) return;
  if (curPhone && curPhone !== P.phone && !confirm('Hội thoại này đang gắn với SĐT ' + curPhone + '. Chuyển sang khách này (' + P.phone + ')?')) return;
  try {
    var j = await (await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'pkChatLink', convId: convId, phone: P.phone }) })).json();
    if (!j || !j.ok) { if (typeof toast === 'function') toast('✕ ' + ((j && j.error) || 'Gắn lỗi')); return; }
    if (typeof toast === 'function') toast('✓ Đã gắn hội thoại với khách này');
    var out = document.getElementById('pkc-found'); if (out) out.innerHTML = '';
    P.active = convId; P.firstLoad = true; pkcLoad(true);
  } catch (e) { if (typeof toast === 'function') toast('✕ Không kết nối được máy chủ'); }
}

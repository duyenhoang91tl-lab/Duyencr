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

// NGUOI GUI + GIO + THE nhu Pancake (2026-10-12). Dung chung cho tab Chat trong ho so khach (file nay) va man Chat chung (js/42).
// Duoi moi tin: TEN NGUOI GUI · GIO (re chuot xem du ngay gio giay). Tin cua nhan vien: ten nhan vien (CRM hoac Pancake), khong co thi ten page; tin khach: ten khach.
function _pkcFull(iso) { var d = new Date(iso); if (isNaN(d)) return ''; return _pkcDay(iso) + ' ' + _pkcHm(iso) + ':' + ('0' + d.getSeconds()).slice(-2); }
function _pkcMeName() { try { return (currentUser && (currentUser.name || currentUser.username)) || 'Bạn'; } catch (e) { return 'Bạn'; } }
function _pkcMetaHtml(m, conv) {
  var who = m.tmp ? _pkcMeName() : (m.dir === 'out' ? (m.staff || m.from || '') : (m.from || (conv && conv.name) || ''));
  return '<div class="pkc-t" title="' + _pkcEsc(_pkcFull(m.at)) + '">' + (who ? '<b>' + _pkcEsc(who) + '</b> · ' : '') + _pkcHm(m.at)
    + (m.crm || m.tmp ? ' <span class="pkc-crm" title="Gửi từ CRM">CRM</span>' : '') + (m.tmp ? ' ✓' : '') + '</div>';
}
function _pkcTagsHtml(tags, max) {
  tags = tags || []; if (!tags.length) return ''; max = max || tags.length;
  var h = tags.slice(0, max).map(function (t) { var c = /^#[0-9a-fA-F]{3,8}$/.test(t.c || '') ? t.c : ''; return '<span class="pkc-tag"' + (c ? ' style="background:' + c + '"' : '') + '>' + _pkcEsc(t.t) + '</span>'; }).join('');
  if (tags.length > max) h += '<span class="pkc-tag more" title="' + _pkcEsc(tags.slice(max).map(function (t) { return t.t; }).join(', ')) + '">+' + (tags.length - max) + '</span>';
  return h;
}
function _pkcMetaRow(conv) {   // the + nguoi xu ly cua hoi thoai
  if (!conv) return ''; var h = _pkcTagsHtml(conv.tags);
  if (conv.assignees && conv.assignees.length) h += '<span class="pkc-ass" title="Người xử lý trên Pancake">👤 ' + _pkcEsc(conv.assignees.join(', ')) + '</span>';
  return h;
}
// ═══ GAN / GO THE + NGUOI DA CHAT (2026-10-13) — nhu Pancake; dung chung cho Social > Chat (js/42) va tab Chat trong ho so khach ═══
// Thanh the nam ngay tren o soan tin: the dang gan (bam de go) + nut "Gan the" mo bang chon the cua page (ten + mau lay tu Pancake qua GAS pkChatTags),
// bam 1 the de gan/go (GAS pkChatTag -> API Pancake). Hien ngay (lac quan), loi thi tra lai the cu va bao. Du lieu the cua hoi thoai di tiep qua webhook
// (Pancake -> CRM); sau khi gan tu CRM, GAS ghi luon the moi vao Supabase. _pkTagOv giu ket qua vua gan 20 giay de poll 6-8 giay khong lam the nhay lai cu.
var _pkTagCat = {};     // pageId -> { at, tags:[{id,t,c}], err, loading }
var _pkTagUI = {};      // barId -> { open, q, sig }
var _pkTagBusy = {};    // 'convId|tagId' -> true (chong bam doi)
var _pkTagOv = {};      // convId -> { tags, until }
var _pkTagCfg = {
  'sc-tags': { conv: function () { return (typeof _sc !== 'undefined' ? _sc.convs : []).filter(function (x) { return x.id === _sc.active; })[0]; }, after: function () { if (typeof _scRenderList === 'function') _scRenderList(); } },
  'pkc-tags': { conv: function () { return _pkc.convs.filter(function (x) { return x.id === _pkc.active; })[0]; }, after: function () { var mt = document.getElementById('pkc-meta'), c = _pkTagCfg['pkc-tags'].conv(); if (mt) mt.innerHTML = _pkcMetaRow(c); } }
};
function _pkcColor(c) { return /^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : ''; }
function _pkcFoldS(s) { return (typeof _foldVi === 'function') ? _foldVi(String(s || '')) : String(s || '').toLowerCase(); }
function _pkTagApplyOv(convs) {   // goi sau moi lan tai danh sach hoi thoai tu server
  var now = Date.now();
  (convs || []).forEach(function (c) { var o = _pkTagOv[c.id]; if (!o) return; if (o.until < now) { delete _pkTagOv[c.id]; return; } c.tags = o.tags.slice(); });
}
async function pkTagsLoad(pageId, refresh) {
  if (!pageId) return;
  var cur = _pkTagCat[pageId]; if (cur && cur.loading) return;
  if (cur) cur.loading = true; else _pkTagCat[pageId] = { at: 0, tags: [], err: '', loading: true };
  var keep = (cur && cur.tags) || [];
  try {
    var j = await (await fetch(_pkcUrl('action=pkChatTags&pageId=' + encodeURIComponent(pageId) + (refresh ? '&refresh=1' : '')), { redirect: 'follow' })).json();
    _pkTagCat[pageId] = (!j || j.error) ? { at: Date.now(), tags: keep, err: (j && j.error) || 'Không tải được danh sách thẻ.' } : { at: Date.now(), tags: j.tags || [], err: '' };
  } catch (e) { _pkTagCat[pageId] = { at: Date.now(), tags: keep, err: 'Không kết nối được máy chủ.' }; }
  Object.keys(_pkTagUI).forEach(function (b) { _pkTagUI[b].sig = ''; pkTagBarRender(b); });
}
function _pkTagListHtml(barId, conv, cat, ui) {
  var have = {}; (conv.tags || []).forEach(function (t) { have[String(t.id)] = 1; });
  var qf = _pkcFoldS(ui.q).trim();
  var items = (cat.tags || []).filter(function (t) { return !qf || _pkcFoldS(t.t).indexOf(qf) >= 0; });
  if (!items.length) return '<div class="pkc-note">' + (cat.tags && cat.tags.length ? 'Không có thẻ phù hợp.' : 'Page này chưa có thẻ nào.') + '</div>';
  return items.map(function (t) {
    var on = !!have[String(t.id)], c = _pkcColor(t.c) || '#6b7280';
    return '<span class="pkc-tag pkt-chip' + (on ? ' pkt-on' : '') + '" data-tid="' + _pkcEsc(t.id) + '" style="' + (on ? 'background:' + c + ';border-color:' + c : 'border-color:' + c + ';color:' + c) + '" title="' + (on ? 'Bấm để gỡ thẻ' : 'Bấm để gắn thẻ') + '" onclick="pkTagToggle(\'' + barId + '\',this.getAttribute(\'data-tid\'))">' + (on ? '✓ ' : '') + _pkcEsc(t.t) + '</span>';
  }).join('');
}
function pkTagBarRender(barId) {
  var el = document.getElementById(barId), cfg = _pkTagCfg[barId]; if (!el || !cfg) return;
  var conv = cfg.conv();
  if (!conv) { el.style.display = 'none'; el.innerHTML = ''; return; }
  var ui = _pkTagUI[barId] = _pkTagUI[barId] || { open: false, q: '', sig: '' };
  var cat = _pkTagCat[conv.pageId];
  if (!cat && conv.pageId) pkTagsLoad(conv.pageId, false);
  var sig = [conv.id, (conv.tags || []).map(function (t) { return t.id; }).join(','), cat ? cat.at + ':' + (cat.tags || []).length + ':' + cat.err : 'x', ui.open].join('|');
  if (ui.sig === sig && el.innerHTML) return;   // khong ve lai khi khong doi (giu nguyen o tim the dang go)
  ui.sig = sig;
  var chips = (conv.tags || []).map(function (t) {
    var c = _pkcColor(t.c);
    return '<span class="pkc-tag pkt-cur"' + (c ? ' style="background:' + c + '"' : '') + ' data-tid="' + _pkcEsc(t.id) + '" title="Bấm để gỡ thẻ" onclick="pkTagToggle(\'' + barId + '\',this.getAttribute(\'data-tid\'))">' + _pkcEsc(t.t) + ' ✕</span>';
  }).join('');
  var h = '<div class="pkt-row"><span class="pkt-lbl" title="Thẻ của hội thoại — đồng bộ với Pancake">🏷</span>' + (chips || '<span class="pkt-none">Chưa có thẻ</span>')
    + '<button type="button" class="btn sm" onclick="pkTagOpen(\'' + barId + '\')">' + (ui.open ? '▲ Đóng' : '＋ Gắn thẻ') + '</button></div>';
  if (ui.open) {
    h += '<div class="pkt-pal"><div class="pkt-tools"><input class="pkt-q" placeholder="Tìm thẻ…" value="' + _pkcEsc(ui.q) + '" oninput="pkTagSearch(\'' + barId + '\',this.value)">'
      + '<button type="button" class="btn sm" title="Tải lại danh sách thẻ từ Pancake" onclick="pkTagsReload(\'' + barId + '\')">🔄</button></div>'
      + '<div class="pkt-list" id="' + barId + '-list">' + (!cat || cat.loading ? '<div class="pkc-note">Đang tải thẻ…</div>' : (cat.err && !(cat.tags || []).length ? '<div class="pkc-note err">' + _pkcEsc(cat.err) + '</div>' : _pkTagListHtml(barId, conv, cat, ui))) + '</div></div>';
  }
  el.style.display = ''; el.innerHTML = h;
}
function pkTagOpen(barId) {
  var ui = _pkTagUI[barId] = _pkTagUI[barId] || { open: false, q: '', sig: '' }, conv = _pkTagCfg[barId].conv();
  ui.open = !ui.open; ui.sig = '';
  var cat = conv && _pkTagCat[conv.pageId];
  if (ui.open && conv && (!cat || cat.err || Date.now() - cat.at > 600000)) pkTagsLoad(conv.pageId, false);   // mo bang: danh sach cu qua 10 phut / lan truoc loi -> tai lai
  pkTagBarRender(barId);
}
function pkTagsReload(barId) { var conv = _pkTagCfg[barId].conv(); if (conv) pkTagsLoad(conv.pageId, true); }   // the moi tao tren Pancake
function pkTagSearch(barId, v) {
  var ui = _pkTagUI[barId]; if (!ui) return; ui.q = v || '';
  var conv = _pkTagCfg[barId].conv(), cat = conv && _pkTagCat[conv.pageId], list = document.getElementById(barId + '-list');
  if (list && conv && cat) list.innerHTML = _pkTagListHtml(barId, conv, cat, ui);   // chi ve lai danh sach, giu nguyen o dang go
}
async function pkTagToggle(barId, tagId) {
  var cfg = _pkTagCfg[barId], conv = cfg && cfg.conv(); if (!conv || tagId === null || tagId === undefined) return;
  tagId = String(tagId); var key = conv.id + '|' + tagId; if (_pkTagBusy[key]) return; _pkTagBusy[key] = true;
  var cat = _pkTagCat[conv.pageId], def = ((cat && cat.tags) || []).filter(function (t) { return String(t.id) === tagId; })[0];
  var before = (conv.tags || []).slice(), had = before.some(function (t) { return String(t.id) === tagId; }), op = had ? 'remove' : 'add';
  var convId = conv.id;
  conv.tags = had ? before.filter(function (t) { return String(t.id) !== tagId; }) : before.concat(def ? [{ id: tagId, t: def.t, c: def.c }] : []);
  _pkTagOv[convId] = { tags: conv.tags.slice(), until: Date.now() + 20000 };
  cfg.after(); pkTagBarRender(barId);
  try {
    var j = await (await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'pkChatTag', convId: convId, tagId: tagId, op: op }) })).json();
    if (!j || !j.ok) throw new Error((j && j.error) || 'Gắn thẻ thất bại.');
    conv.tags = j.tags || []; _pkTagOv[convId] = { tags: conv.tags.slice(), until: Date.now() + 20000 };
  } catch (e) {
    conv.tags = before; delete _pkTagOv[convId];
    if (typeof toast === 'function') toast('✕ ' + (e && e.message || 'Gắn thẻ lỗi'));
  } finally {
    delete _pkTagBusy[key];
    if (_pkTagUI[barId]) _pkTagUI[barId].sig = '';
    cfg.after(); pkTagBarRender(barId);
  }
}
// "Da chat": nhan vien da tra loi trong hoi thoai (tu cac tin dang tai: ten nhan vien CRM / nhan vien Pancake), kem so tin. Tin chi co ten page khong tinh la nguoi.
function _pkcWhoHtml(msgs) {
  var cnt = {}, order = [];
  Object.keys(msgs || {}).forEach(function (k) {
    var m = msgs[k]; if (!m || m.dir !== 'out') return;
    var n = m.tmp ? _pkcMeName() : (m.staff || ''); if (!n) return;
    if (!(n in cnt)) { cnt[n] = 0; order.push(n); } cnt[n]++;
  });
  if (!order.length) return '';
  order.sort(function (a, b) { return cnt[b] - cnt[a]; });
  return '<span class="pkc-who-l" title="Nhân viên đã trả lời trong các tin đang hiển thị">✍️ Đã chat:</span> ' + order.map(function (n) { return '<span class="pkc-who-n" title="' + cnt[n] + ' tin">' + _pkcEsc(n) + ' <i>' + cnt[n] + '</i></span>'; }).join('');
}
function renderPkChatTab(c) {
  _pkcStop();
  _pkc = { phone: c.phone, convs: [], msgs: {}, active: '', after: '', timer: null, loading: false, firstLoad: true, err: '', sending: false, tick: 0, okAt: '' };
  setTimeout(function () { if (_pkc.phone === c.phone && document.getElementById('pkc-root')) { pkcLoad(true); _pkc.timer = setInterval(_pkcTick, 15000); } }, 0);
  return '<div id="pkc-root" class="pkc" data-phone="' + _pkcEsc(c.phone) + '">'
    + '<div class="pkc-convs" id="pkc-convs"></div>'
     + '<div class="pkc-meta" id="pkc-meta"></div>'
     + '<div class="pkc-who" id="pkc-who"></div>'
    + '<div class="pkc-msgs" id="pkc-msgs"><div class="pkc-note">Đang tải tin nhắn…</div></div>'
    + '<div class="pkc-status" id="pkc-status"></div>'
    + '<div class="pkt-bar" id="pkc-tags" style="display:none"></div>'
    + '<div class="pkc-compose" id="pkc-compose">'
    +   '<button class="btn sm" type="button" title="Gợi ý tin nhắn theo sản phẩm" onclick="tplChatToggle(\'pkc-compose\',\'pkc-input\')">💡</button>'
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
    P.convs = j.conversations || []; _pkTagApplyOv(P.convs);
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
  var comp = document.getElementById('pkc-compose'), lk = document.getElementById('pkc-link'), mt = document.getElementById('pkc-meta');
  if (mt) mt.innerHTML = _pkcMetaRow(P.convs.filter(function (c) { return c.id === P.active; })[0]);
  pkTagBarRender('pkc-tags'); var wh = document.getElementById('pkc-who'); if (wh) wh.innerHTML = _pkcWhoHtml(P.msgs[P.active]);
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
    html += '<div class="pkc-m ' + (m.dir === 'out' ? 'out' : 'in') + '"><div class="pkc-b">' + _pkcEsc(m.text).replace(/\n/g, '<br>') + _pkcAttHtml(m.att) + '</div>' + _pkcMetaHtml(m, conv) + '</div>';
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

// ═══════════════════════════════════════════════════════
//  SOCIAL > CHAT — hộp thư Pancake chung (menu "💬 Social" → "Chat"). Trái = danh sách hội thoại mới nhất (tìm theo tên/SĐT),
//  phải = tin nhắn + ô trả lời. Dùng lại backend của chat trong hồ sơ khách (js/41): pkChatInbox (danh sách), pkChatConv (tin nhắn),
//  pkChatSend (gửi). Bấm "Mở hồ sơ" để nhảy sang khách có cùng SĐT. Poll nhẹ 8s khi đang mở tab.
// ═══════════════════════════════════════════════════════
var _sc = { convs: [], msgs: {}, active: '', after: {}, q: '', timer: null, loading: false, err: '', sending: false, okAt: '', fold: '',
  f: { type: '', un: '', ph: '', page: '', nguon: '', nv: '' }, fopen: false, folopen: false, opts: null, optsLoading: false, again: false };   // f = bộ lọc gửi lên máy chủ; fopen/folopen = panel Bộ lọc / Thư mục (MẶC ĐỊNH ẨN)
function _scOpen() { var t = document.getElementById('tab-chat'); return !!t && t.style.display !== 'none' && _activeV9Tab === 'chat'; }
function _scStop() { if (_sc.timer) { clearInterval(_sc.timer); _sc.timer = null; } }
function renderSocialChatTab() {
  var w = document.getElementById('chat-wrap'); if (!w) return;
  if (!w.firstChild) {
    w.innerHTML = '<div class="sc-list"><div class="sc-find"><input id="sc-q" type="search" placeholder="🔍 Tìm hội thoại: tên hoặc SĐT…" oninput="_scQSoon()"></div>'
      + '<div class="sc-ftools" id="sc-ftools"><button type="button" class="btn sm" id="sc-fbtn" onclick="scToggleFilters()">🔎 Bộ lọc<span id="sc-fn"></span> ▾</button><button type="button" class="btn sm" id="sc-folbtn" onclick="scToggleFolders()">🏷 Thư mục<span id="sc-foln"></span> ▾</button><a class="sc-fx" id="sc-fx" href="javascript:void(0)" onclick="scClearFilters()" style="display:none">✕ Xoá lọc</a></div>'
      + '<div class="sc-fpanel" id="sc-fpanel" style="display:none"></div><div id="sc-convs" class="sc-convs"></div></div>'
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
// Tham số bộ lọc gửi máy chủ (lọc ở SERVER nên không bị giới hạn 60 hội thoại đang tải): type · un · ph · page · nguon · nv — xem pkChatInbox_ (GAS).
function _scFilterQuery_() {
  return ['type', 'un', 'ph', 'page', 'nguon', 'nv'].map(function (k) { return _sc.f[k] ? '&' + k + '=' + encodeURIComponent(_sc.f[k]) : ''; }).join('');
}
function _scFilterCount_() { return ['type', 'un', 'ph', 'page', 'nguon', 'nv'].filter(function (k) { return !!_sc.f[k]; }).length; }
async function scLoadList() {
  if (_sc.loading) { _sc.again = true; return; }   // đổi bộ lọc/tìm kiếm khi đang tải dở -> tải lại ngay sau đó (không bỏ rơi lần đổi)
  _sc.loading = true;
  try {
    var j = await (await fetch(_pkcUrl('action=pkChatInbox' + (_sc.q ? '&q=' + encodeURIComponent(_sc.q) : '') + _scFilterQuery_()), { redirect: 'follow' })).json();
    if (!j || j.error) { _sc.err = _pkcAuthFail(j) ? 'Phiên đăng nhập đã hết hạn — đăng nhập lại để xem tin nhắn.' : ((j && j.error) || 'Không tải được hộp thư.'); _scStatus(); return; }
    _pkcAuthShown = false; _sc.err = ''; _sc.okAt = _pkcHm(new Date().toISOString()); _sc.gv = j.gv || ''; _sc.convs = j.conversations || []; _pkTagApplyOv(_sc.convs); _pkSeenApplyOv(_sc.convs);
    _scRenderList(); _scStatus();
  } catch (e) { _sc.err = 'Không kết nối được máy chủ.'; _scStatus(); }
  finally { _sc.loading = false; if (_sc.again) { _sc.again = false; scLoadList(); } }
}
// ═══ BỘ LỌC + THƯ MỤC (18/10/2026) — cả hai MẶC ĐỊNH ẨN, bấm nút mới hiện ═══
var _SC_TYPE_ = [['', 'Tất cả'], ['INBOX', 'Tin nhắn'], ['COMMENT', 'Bình luận']];
var _SC_UN_ = [['', 'Tất cả'], ['new', 'Chưa trả lời — mới nhất trước'], ['wait', 'Chưa trả lời — chờ lâu nhất (30 ngày)'], ['read', 'Đã đọc nhưng chưa trả lời']];   // 3 mục menu "Lọc chưa trả lời" của Pancake
var _SC_PH_ = [['', 'Tất cả'], ['1', 'Có SĐT'], ['0', 'Chưa có SĐT']];
function _scFilterBadge_() {
  var n = _scFilterCount_(), b = document.getElementById('sc-fn'); if (b) b.textContent = n ? ' (' + n + ')' : '';
  var fb = document.getElementById('sc-fbtn'); if (fb) fb.className = 'btn sm' + (n ? ' on' : '');
  var fo = document.getElementById('sc-foln'); if (fo) fo.textContent = _sc.fold ? ' (1)' : '';
  var ob = document.getElementById('sc-folbtn'); if (ob) ob.className = 'btn sm' + (_sc.fold ? ' on' : '');
  var x = document.getElementById('sc-fx'); if (x) x.style.display = (n || _sc.fold) ? '' : 'none';
}
function _scRenderFPanel_() {
  var el = document.getElementById('sc-fpanel'); if (!el) return;
  el.style.display = _sc.fopen ? '' : 'none'; if (!_sc.fopen) { el.innerHTML = ''; return; }
  var o = _sc.opts || { pages: [], nguon: [], staff: [] };
  var withCur = function (list, k) { if (_sc.f[k] && !list.some(function (x) { return x[0] === _sc.f[k]; })) list = list.concat([[_sc.f[k], _sc.f[k]]]); return list; };
  var sel = function (k, label, list) {
    list = withCur(list, k);
    return '<label class="sc-fl"><span>' + label + '</span><select onchange="scSetF(\'' + k + '\',this.value)">' + list.map(function (x) {
      return '<option value="' + _pkcEsc(x[0]) + '"' + (_sc.f[k] === x[0] ? ' selected' : '') + '>' + _pkcEsc(x[1]) + '</option>'; }).join('') + '</select></label>';
  };
  el.innerHTML = sel('type', 'Loại', _SC_TYPE_) + sel('un', 'Chưa trả lời', _SC_UN_) + sel('ph', 'Số điện thoại', _SC_PH_)
    + sel('page', 'Page', [['', 'Tất cả Page']].concat((o.pages || []).map(function (p) { return [p.id, p.name + (p.kenh ? ' · ' + p.kenh : '')]; })))
    + sel('nguon', 'Nguồn (kênh bán)', [['', 'Tất cả nguồn']].concat((o.nguon || []).map(function (n) { return [n, n]; })))
    + sel('nv', 'Nhân viên', [['', 'Tất cả nhân viên']].concat((o.staff || []).map(function (s) { return [s.id, s.name]; })))
    + (_sc.opts ? '' : '<div class="sc-fnote">Đang tải danh sách Page / Nguồn / Nhân viên…</div>')
    + ((_sc.opts && _sc.opts.err) ? '<div class="sc-fnote">⚠ ' + _pkcEsc(_sc.opts.err) + '</div>' : '');
}
async function scLoadOpts() {
  if (_sc.opts || _sc.optsLoading) return; _sc.optsLoading = true;
  try {
    var j = await (await fetch(_pkcUrl('action=pkChatFilterOpts'), { redirect: 'follow' })).json();
    _sc.opts = (j && j.ok) ? { pages: j.pages || [], nguon: j.nguon || [], staff: j.staff || [] } : { pages: [], nguon: [], staff: [], err: (j && j.error) || 'Không tải được danh sách lọc.' };
  } catch (e) { _sc.opts = { pages: [], nguon: [], staff: [], err: 'Không kết nối được máy chủ.' }; }
  finally { _sc.optsLoading = false; _scRenderFPanel_(); }
}
function scToggleFilters() { _sc.fopen = !_sc.fopen; _scRenderFPanel_(); if (_sc.fopen) scLoadOpts(); }
function scToggleFolders() { _sc.folopen = !_sc.folopen; _scRenderFolders(); }
function scSetF(k, v) { if (!(k in _sc.f)) return; _sc.f[k] = String(v || ''); _scFilterBadge_(); scLoadList(); }
function scClearFilters() {
  Object.keys(_sc.f).forEach(function (k) { _sc.f[k] = ''; }); _sc.fold = '';
  _scRenderFPanel_(); _scFilterBadge_(); scLoadList();
}
// THƯ MỤC chat (2026-10-12): lọc nhanh danh sách đang tải theo Chưa đọc / Chưa trả lời / từng THẺ Pancake (theo tên thẻ, gộp giữa các page).
// Đếm theo các hội thoại ĐANG TẢI (mới nhất), không phải toàn bộ lịch sử — gõ ô tìm kiếm để tìm sâu hơn.
function _scTagKey(t) { return 'tag:' + String(t && t.t || '').toLowerCase(); }
function _scInFolder(c) {
  var k = _sc.fold; if (!k) return true;
  if (k === '@unseen') return c.seen === false;
  if (k === '@unreplied') return !c.replied;
  return (c.tags || []).some(function (t) { return _scTagKey(t) === k; });
}
function scFolder(k) { _sc.fold = (_sc.fold === k) ? '' : k; _scRenderList(); }
function _scRenderFolders() {
  var list = document.querySelector('#tab-chat .sc-list'); if (!list) return;
  var box = document.getElementById('sc-folders');
  if (!box) { box = document.createElement('div'); box.id = 'sc-folders'; box.className = 'sc-folders'; var f = document.getElementById('sc-fpanel') || list.querySelector('.sc-find'); if (f && f.insertAdjacentElement) f.insertAdjacentElement('afterend', box); else list.insertBefore(box, list.firstChild); }
  box.style.display = _sc.folopen ? '' : 'none';   // MẶC ĐỊNH ẨN — bấm "🏷 Thư mục" mới hiện
  var un = 0, nr = 0, tg = {};
  _sc.convs.forEach(function (c) {
    if (c.seen === false) un++; if (!c.replied) nr++;
    var seen = {}; (c.tags || []).forEach(function (t) { var k = _scTagKey(t); if (!t.t || seen[k]) return; seen[k] = 1; var x = tg[k] || (tg[k] = { k: k, t: t.t, c: t.c, n: 0 }); x.n++; });
  });
  var tags = Object.keys(tg).map(function (k) { return tg[k]; }).sort(function (a, b) { return b.n - a.n; });
  var chip = function (key, label, n, color) {
    return '<button type="button" class="sc-fchip' + (_sc.fold === key ? ' on' : '') + '" data-k="' + _pkcEsc(key) + '" onclick="scFolder(this.getAttribute(\'data-k\'))">'
      + (color && /^#[0-9a-fA-F]{3,8}$/.test(color) ? '<i class="sc-fdot" style="background:' + color + '"></i>' : '') + _pkcEsc(label) + ' <b>' + n + '</b></button>';
  };
  box.innerHTML = chip('', 'Tất cả', _sc.convs.length) + chip('@unseen', '🔵 Chưa đọc', un) + chip('@unreplied', '↩ Chưa trả lời', nr) + tags.map(function (t) { return chip(t.k, t.t, t.n, t.c); }).join('');
  box.title = 'Đếm theo các hội thoại đang tải (mới nhất)';
  _scFilterBadge_();
}
// Link mở ĐÚNG hội thoại trên Pancake. Mẫu mặc định CHƯA xác nhận với link thật — nếu sai, đặt window.PK_CONV_URL_TPL (hoặc báo để sửa mặc định).
function _scPancakeUrl(c) {
  if (!c || !c.pageId) return '';
  var tpl = String(window.PK_CONV_URL_TPL || 'https://pancake.vn/{page_id}?c_id={conv_id}');
  var id = String(c.id || ''), pg = String(c.pageId);
  if (id.indexOf(pg + '_') === 0) id = id.slice(pg.length + 1);
  return tpl.replace('{page_id}', encodeURIComponent(pg)).replace('{conv_id}', encodeURIComponent(id));
}
function _scRenderList() {
  var el = document.getElementById('sc-convs'); if (!el) return;
  _scRenderFolders();
  var view = _sc.convs.filter(_scInFolder);
  el.innerHTML = view.length ? view.map(function (c) {
    return '<div class="sc-conv' + (c.id === _sc.active ? ' on' : '') + (c.seen === false ? ' unseen' : '') + '" data-id="' + _pkcEsc(c.id) + '" onclick="scPick(this.getAttribute(\'data-id\'))">'
      + '<div class="sc-av">' + _pkcEsc(typeof proInitials_ === 'function' ? proInitials_(c.name) : '?') + '</div><div class="sc-conv-body">'
      + '<div class="sc-conv-n"><b>' + _pkcEsc(c.name || 'Khách Pancake') + '</b><span>' + _pkcEsc(_scAgo(c.lastAt)) + '</span></div>'
      + (c.phone ? '<div class="sc-conv-p">' + _pkcEsc(c.phone) + '</div>' : '')
      + (c.assignees && c.assignees.length ? '<div class="sc-conv-s">\ud83d\udc64 ' + _pkcEsc(c.assignees.join(', ')) + '</div>' : '')   // ten sale phu trach (pk_staff); chua co ten -> khong hien, KHONG lo uuid
      + '<div class="sc-conv-t">' + _pkcEsc(c.lastText || '') + '</div>'
      + (c.tags && c.tags.length ? '<div class="sc-conv-g">' + _pkcTagsHtml(c.tags, 3) + '</div>' : '')
      + (c.seen === false ? '<i class="sc-dot"></i>' : '') + '</div>' + (typeof _pkSeenBtnHtml === 'function' ? _pkSeenBtnHtml(c, 'sc-seenbtn') : '') + '</div>';   // dong 1: dong .sc-conv-body, dong 2: dong .sc-conv. Thieu cai thu 2 thi moi dong bi long vao dong truoc
  }).join('') : '<div class="pkc-note">Không có hội thoại nào' + (_scFilterCount_() ? ' khớp bộ lọc' : '') + (_sc.fold ? ' trong thư mục này' : '') + '.</div>';
  var hm = document.getElementById('sc-head-m');
  if (hm) hm.innerHTML = _pkcMetaRow(_sc.convs.filter(function (x) { return x.id === _sc.active; })[0]);
  pkTagBarRender('sc-tags'); if (typeof pkSeenRender === 'function') pkSeenRender('sc');
}
function scPick(id) {
  _sc.active = id; _scRenderList();
  var c = _sc.convs.filter(function (x) { return x.id === id; })[0] || {};
  var h = document.getElementById('sc-head');
  if (h) h.innerHTML = '<button class="btn sm sc-back" onclick="scBack()">←</button><b>' + _pkcEsc(c.name || 'Khách Pancake') + '</b>' + (c.phone ? ' <span class="pkc-ph">' + _pkcEsc(c.phone) + '</span> <button class="btn sm" onclick="scOpenProfile()">👤 Mở hồ sơ</button>' : ' <span class="pkc-ph">chưa gắn SĐT</span>') + (typeof _ovIsAdmin === 'function' && _ovIsAdmin() ? ' <button class="btn sm" onclick="scDiag()" title="Chẩn đoán thẻ / tên nhân viên (chỉ admin)">🔍 Chẩn đoán</button>' : '') + (_scPancakeUrl(c) ? ' <a class="btn sm" href="' + _pkcEsc(_scPancakeUrl(c)) + '" target="_blank" rel="noopener" title="Mở đúng hội thoại này trên Pancake">↗ Pancake</a>' : '') + '<div class="sc-head-m" id="sc-head-m">' + _pkcMetaRow(c) + '</div>';
  if (typeof pkSeenRender === 'function') pkSeenRender('sc');   // nut Danh dau chua doc/da doc o dau khung chat
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
    html += '<div class="pkc-m ' + (m.dir === 'out' ? 'out' : 'in') + '" data-mid="' + _pkcEsc(String(m.id || '')) + '"><div class="pkc-b">' + _pkcEsc(m.text).replace(/\n/g, '<br>') + _pkcAttHtml(m.att) + '</div>' + _pkcMetaHtml(m, conv) + '</div>';
  });
  box.innerHTML = html || '<div class="pkc-note">Hội thoại chưa có tin nhắn nào được lưu.</div>';
  var wh = document.getElementById('sc-who'); if (wh) wh.innerHTML = _pkcWhoHtml(_sc.msgs[_sc.active]);
  if (forceBottom || near) box.scrollTop = box.scrollHeight;
  // Mở từ thông báo từ cấm (js/39 _ntOpenChat_): cuộn tới + nháy sáng đúng tin có từ cấm; tin cũ hơn đoạn đang tải thì báo rõ.
  if (_sc.focus && _sc.focus.conv === _sc.active && list.length) {
    var _fe = null; [].forEach.call(box.querySelectorAll('.pkc-m[data-mid]'), function (x) { if (x.getAttribute('data-mid') === _sc.focus.mid) _fe = x; });
    if (_fe) { _fe.scrollIntoView({ block: 'center' }); _fe.classList.add('pkc-hl'); setTimeout(function () { _fe.classList.remove('pkc-hl'); }, 6000); }
    else if (typeof toast === 'function') toast('Tin có từ cấm nằm xa hơn đoạn chat đang hiển thị (chỉ tải 150 tin gần nhất) — xem sheet ChatViolations để thấy nội dung tin.');
    _sc.focus = null;
  }
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

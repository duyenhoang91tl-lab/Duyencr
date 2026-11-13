// ═══════════════════════════════════════════════════════
//  THƯ VIỆN ẢNH / GHI ÂM / MẪU TIN (menu Social > Thư viện) — backend: gas mlib* (gas/29_MediaLib.gs).
//  Tải lên từ máy (ảnh tự thu nhỏ ≤1600px), ghi âm ngay trong trình duyệt (MediaRecorder), thêm từ Google Drive bằng link,
//  soạn mẫu tin. Dùng chung cho chat: MLIB.pick('image'|'audio'|'template', function(item){...}) mở hộp chọn (chat Pancake / chat nội bộ).
//  Mọi chuỗi người dùng qua esc(); gọi GAS kèm token phiên (localStorage ome_sess_token).
// ═══════════════════════════════════════════════════════
var MLIB = (function () {
  var S = { type: 'image', items: [], q: '', loaded: false, loading: false, me: '', admin: false, rec: null, edit: null, err: '' };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tok() { try { return localStorage.getItem('ome_sess_token') || ''; } catch (e) { return ''; } }
  function say(m) { if (typeof toast === 'function') toast(m); }
  function gs() { return (typeof gsUrl !== 'undefined' && gsUrl) ? gsUrl : ''; }
  async function get(qs) { var u = gs(); var r = await fetch(u + (u.indexOf('?') > -1 ? '&' : '?') + qs + '&token=' + encodeURIComponent(tok()), { redirect: 'follow' }); return r.json(); }
  async function post(o) { o.token = tok(); var r = await fetch(gs(), { method: 'POST', redirect: 'follow', body: JSON.stringify(o) }); return r.json(); }
  function thumb(it) { return it.fileId ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(it.fileId) + '&sz=w400' : ''; }
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function canEdit(it) { return S.admin || it.by === S.me; }

  async function load(force) {
    if (S.loading || (S.loaded && !force)) return; S.loading = true;
    try {
      var j = await get('action=mlibList');
      if (!j || j.ok === false) { S.err = (j && j.error) || 'Không tải được thư viện.'; }
      else { S.err = ''; S.items = j.items || []; S.me = j.me || ''; S.admin = !!j.admin; S.loaded = true; }
    } catch (e) { S.err = 'Không kết nối được máy chủ.'; }
    S.loading = false;
  }
  function visible(type) {
    var q = S.q.toLowerCase();
    return S.items.filter(function (i) { return i.type === type && (!q || (i.name + ' ' + i.tags + ' ' + i.text).toLowerCase().indexOf(q) > -1); });
  }
  function cardHtml(it, pick) {
    var h = '<div class="ml-card' + (pick ? ' pick' : '') + '" data-id="' + esc(it.id) + '"' + (pick ? ' onclick="MLIB._pickId(this.getAttribute(\'data-id\'))"' : '') + '>';
    if (it.type === 'image') h += '<img class="ml-th" loading="lazy" src="' + esc(thumb(it)) + '" alt="">';
    else if (it.type === 'audio') h += '<audio controls preload="none" src="' + esc(it.url) + '" onclick="event.stopPropagation()"></audio>';
    else h += '<div class="ml-tpl">' + esc(it.text) + '</div>';
    h += '<div class="ml-n">' + esc(it.name) + '</div><div class="ml-m">' + esc(it.tags) + (it.size ? ' · ' + kb(it.size) : '') + ' · ' + esc(it.by) + '</div>';
    if (!pick) {
      h += '<div class="ml-act">';
      if (it.type === 'template') h += '<button class="btn sm" onclick="MLIB.copy(\'' + esc(it.id) + '\')">📋 Chép</button>';
      else h += '<button class="btn sm" onclick="MLIB.copy(\'' + esc(it.id) + '\')">🔗 Chép link</button>';
      if (canEdit(it)) {
        if (it.type === 'template') h += '<button class="btn sm" onclick="MLIB.editTpl(\'' + esc(it.id) + '\')">✎ Sửa</button>';
        h += '<button class="btn sm" onclick="MLIB.del(\'' + esc(it.id) + '\')">🗑</button>';
      }
      h += '</div>';
    }
    return h + '</div>';
  }
  // 2026-11-13: tải lên / ghi âm dùng được cả trong hộp chọn của chat (trước chỉ ở menu Social > Thư viện) -> vẽ lại đúng nơi đang mở.
  function refresh() { if ($('ml-pick')) pickRender(); else render(); }
  function curType() { return $('ml-pick') ? S.pickType : S.type; }
  function byId(id) { return S.items.filter(function (i) { return i.id === id; })[0]; }

  function tplFormHtml() {
    var e = S.edit;
    return '<div class="ml-form"><input id="mt-name" placeholder="Tên mẫu (vd: Chào khách mới)" value="' + esc(e.name) + '"><textarea id="mt-text" rows="5" placeholder="Nội dung tin nhắn…">' + esc(e.text) + '</textarea>'
      + '<input id="mt-tags" placeholder="Thẻ (tuỳ chọn, cách nhau bằng dấu phẩy)" value="' + esc(e.tags) + '"><div class="ml-act"><button class="btn primary" onclick="MLIB.saveTpl()">Lưu</button><button class="btn" onclick="MLIB.cancelTpl()">Huỷ</button></div></div>';
  }
  function render() {
    var w = $('mlib-wrap'); if (!w) return;
    var T = S.type, list = visible(T);
    var h = '<div class="ml-bar"><div class="ml-seg">'
      + [['image', '🖼️ Ảnh'], ['audio', '🎙️ Ghi âm'], ['template', '💬 Mẫu tin']].map(function (t) { return '<button class="' + (T === t[0] ? 'on' : '') + '" onclick="MLIB.tab(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join('')
      + '</div><input class="ml-q" type="search" placeholder="🔍 Tìm theo tên / thẻ…" value="' + esc(S.q) + '" oninput="MLIB.search(this.value)">';
    if (T === 'template') h += '<button class="btn primary" onclick="MLIB.editTpl(\'\')">+ Mẫu tin mới</button>';
    else {
      h += '<button class="btn primary" onclick="document.getElementById(\'ml-file\').click()">⬆ Tải lên</button>'
        + '<button class="btn" onclick="MLIB.fromDrive()">📁 Từ Google Drive</button>';
      if (T === 'audio') h += S.rec ? '<button class="btn ml-rec" onclick="MLIB.recStop()">⏹ Dừng & lưu (đang ghi…)</button>' : '<button class="btn" onclick="MLIB.recStart()">🔴 Ghi âm</button>';
      h += '<input id="ml-file" type="file" multiple style="display:none" accept="' + (T === 'image' ? 'image/*' : 'audio/*') + '" onchange="MLIB.upload(this.files);this.value=\'\'">';
    }
    h += '<button class="btn sm" onclick="MLIB.reload()">↻</button></div>';
    if (S.err) h += '<div class="ml-empty" style="color:#b91c1c">' + esc(S.err) + '</div>';
    if (T === 'template' && S.edit) h += tplFormHtml();
    h += '<div id="ml-out">' + gridHtml(list, false) + '</div>';
    w.innerHTML = h;
  }
  function gridHtml(list, pick) {
    var T = pick ? S.pickType : S.type;
    return list.length ? '<div class="ml-grid">' + list.map(function (i) { return cardHtml(i, pick); }).join('') + '</div>' : (!pick && S.loading ? '<div class="ml-empty">Đang tải…</div>' : '<div class="ml-empty">' + (pick ? (S.pickType === 'template' ? 'Chưa có mẫu tin nào — thêm ở menu Social → Thư viện.' : 'Thư viện chưa có mục nào — bấm ⬆ Tải lên để thêm ' + (S.pickType === 'image' ? 'ảnh' : 'ghi âm') + '.') : 'Chưa có mục nào. ' + (T === 'template' ? 'Bấm "+ Mẫu tin mới".' : 'Bấm "Tải lên" hoặc "Từ Google Drive".')) + '</div>');
  }

  // ── Ảnh: thu nhỏ trước khi gửi (nhẹ, nhanh, khỏi vượt giới hạn 6MB) ──
  function fileToB64(file) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(',')[1] || ''); }; r.onerror = no; r.readAsDataURL(file); }); }
  function shrinkImage(file) {
    return new Promise(function (ok) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 600 * 1024) { fileToB64(file).then(function (b) { ok({ b64: b, mime: file.type, name: file.name }); }); return; }
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok({ b64: c.toDataURL('image/jpeg', 0.86).split(',')[1], mime: 'image/jpeg', name: file.name.replace(/\.\w+$/, '') + '.jpg' });
      };
      img.onerror = function () { URL.revokeObjectURL(url); fileToB64(file).then(function (b) { ok({ b64: b, mime: file.type, name: file.name }); }); };
      img.src = url;
    });
  }
  async function upload(files) {
    var T = curType();
    for (var i = 0; i < files.length; i++) {
      var f = files[i]; say('⏳ Đang tải lên ' + f.name + '…');
      try {
        var p = T === 'image' ? await shrinkImage(f) : { b64: await fileToB64(f), mime: f.type || 'audio/mpeg', name: f.name };
        var j = await post({ action: 'mlibUpload', type: T, name: p.name, mimeType: p.mime, base64: p.b64 });
        if (!j || !j.ok) { say('✕ ' + ((j && j.error) || 'Tải lên lỗi')); continue; }
        S.items.unshift(j.item); say('✓ Đã thêm ' + p.name); refresh();
      } catch (e) { say('✕ Tải lên lỗi: ' + (e && e.message || e)); }
    }
  }
  // Tải 1 ảnh (vd ảnh dán Ctrl+V) lên thư viện rồi trả mục vừa tạo (null nếu lỗi) — dùng cho dán ảnh vào khung chat.
  async function uploadImageFile(f) {
    say('⏳ Đang tải ảnh lên…');
    try {
      var p = await shrinkImage(f);
      var j = await post({ action: 'mlibUpload', type: 'image', name: p.name, mimeType: p.mime, base64: p.b64 });
      if (!j || !j.ok) { say('✕ ' + ((j && j.error) || 'Tải lên lỗi')); return null; }
      S.items.unshift(j.item); say('✓ Đã thêm ảnh vào thư viện'); return j.item;
    } catch (e) { say('✕ Tải lên lỗi: ' + (e && e.message || e)); return null; }
  }
  async function fromDrive() {
    var link = prompt('Dán link (hoặc ID) tệp Google Drive.\nTệp phải được chia sẻ cho tài khoản chạy GAS hoặc "Bất kỳ ai có link":'); if (!link) return;
    say('⏳ Đang lấy từ Drive…');
    try { var j = await post({ action: 'mlibAddDrive', type: curType(), link: link }); if (!j || !j.ok) { say('✕ ' + ((j && j.error) || 'Lỗi')); return; } S.items.unshift(j.item); say('✓ Đã thêm từ Drive'); refresh(); }
    catch (e) { say('✕ Không kết nối được máy chủ'); }
  }
  // ── Ghi âm ──
  async function recStart() {
    if (!navigator.mediaDevices || !window.MediaRecorder) { say('Trình duyệt này không hỗ trợ ghi âm'); return; }
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true }), chunks = [], mr = new MediaRecorder(stream);
      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = async function () {
        stream.getTracks().forEach(function (t) { t.stop(); }); S.rec = null; refresh();
        var blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        var name = prompt('Đặt tên cho bản ghi âm:', 'Ghi âm ' + new Date().toLocaleString('vi-VN')); if (!name) return;
        say('⏳ Đang lưu ghi âm…');
        try { var j = await post({ action: 'mlibUpload', type: 'audio', name: name, mimeType: blob.type, base64: await fileToB64(blob) }); if (!j || !j.ok) { say('✕ ' + ((j && j.error) || 'Lỗi')); return; } S.items.unshift(j.item); say('✓ Đã lưu ghi âm'); refresh(); }
        catch (e) { say('✕ Lưu ghi âm lỗi'); }
      };
      mr.start(); S.rec = mr; refresh();
    } catch (e) { say('Không bật được micro: cần cho phép quyền micro.'); }
  }
  function recStop() { if (S.rec && S.rec.state !== 'inactive') S.rec.stop(); }
  // ── Mẫu tin ──
  function editTpl(id) { var it = id ? byId(id) : null; S.edit = { id: id, name: it ? it.name : '', text: it ? it.text : '', tags: it ? it.tags : '' }; refresh(); }
  function cancelTpl() { S.edit = null; refresh(); }
  async function saveTpl() {
    var e = S.edit; if (!e) return;
    var j = await post({ action: 'mlibSaveTpl', id: e.id, name: ($('mt-name') || {}).value, text: ($('mt-text') || {}).value, tags: ($('mt-tags') || {}).value });
    if (!j || !j.ok) { say('✕ ' + ((j && j.error) || 'Lưu lỗi')); return; }
    S.items = S.items.filter(function (i) { return i.id !== j.item.id; }); S.items.unshift(j.item); S.edit = null; say('✓ Đã lưu mẫu tin'); refresh();
  }
  async function del(id) {
    if (!confirm('Xoá mục này khỏi thư viện?')) return;
    var j = await post({ action: 'mlibDelete', id: id }); if (!j || !j.ok) { say('✕ ' + ((j && j.error) || 'Xoá lỗi')); return; }
    S.items = S.items.filter(function (i) { return i.id !== id; }); render();
  }
  function copy(id) {
    var it = byId(id); if (!it) return; var t = it.type === 'template' ? it.text : it.url;
    try { navigator.clipboard.writeText(t).then(function () { say('✓ Đã chép'); }); } catch (e) { say(t); }
  }
  // ── Hộp chọn dùng trong chat ──
  var _cb = null;
  async function pick(type, cb) {
    _cb = cb; await load(false);
    var old = $('ml-pick'); if (old) old.remove();
    var d = document.createElement('div'); d.id = 'ml-pick';
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    document.body.appendChild(d); S.pickType = type; pickRender();
  }
  function pickRender() {
    var d = $('ml-pick'); if (!d) return; var type = S.pickType, list = visible(type);
    d.innerHTML = '<div class="ml-box"><div class="ml-bar"><div class="ml-seg">' + [['image', '🖼️ Ảnh'], ['audio', '🎙️ Ghi âm'], ['template', '💬 Mẫu tin']].map(function (t) { return '<button class="' + (type === t[0] ? 'on' : '') + '" onclick="MLIB.pickTab(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join('') + '</div><input class="ml-q" placeholder="🔍 Tìm…" value="' + esc(S.q) + '" oninput="MLIB.search(this.value)">'
      + (type === 'template' ? '' : '<button class="btn primary sm" onclick="document.getElementById(\'ml-pfile\').click()">⬆ Tải lên</button><input id="ml-pfile" type="file" multiple style="display:none" accept="' + (type === 'image' ? 'image/*' : 'audio/*') + '" onchange="MLIB.upload(this.files);this.value=\'\'">')
      + (type === 'template' ? '<button class="btn primary sm" onclick="MLIB.editTpl(\'\')">+ Mẫu tin mới</button>' : '<button class="btn sm" onclick="MLIB.fromDrive()">📁 Từ Google Drive</button>')
      + (type === 'audio' ? (S.rec ? '<button class="btn sm ml-rec" onclick="MLIB.recStop()">⏹ Dừng & lưu</button>' : '<button class="btn sm" onclick="MLIB.recStart()">🔴 Ghi âm</button>') : '')
      + '<button class="btn sm" onclick="document.getElementById(\'ml-pick\').remove()">✕ Đóng</button></div>'
      + (type === 'template' && S.edit ? tplFormHtml() : '')
      + '<div id="ml-pick-out">' + gridHtml(list, true) + '</div></div>';
  }
  function _pickId(id) { var it = byId(id), d = $('ml-pick'); if (d) d.remove(); if (it && _cb) _cb(it); }

  return {
    tab: function (t) { S.type = t; S.edit = null; render(); }, reload: async function () { await load(true); render(); },
    search: function (v) {
      S.q = v;
      if ($('ml-pick')) { var po = $('ml-pick-out'); if (po) po.innerHTML = gridHtml(visible(S.pickType), true); }
      else { var o = $('ml-out'); if (o) o.innerHTML = gridHtml(visible(S.type), false); }
    },
    upload: upload, uploadImageFile: uploadImageFile, fromDrive: fromDrive, recStart: recStart, recStop: recStop, editTpl: editTpl, cancelTpl: cancelTpl, saveTpl: saveTpl, del: del, copy: copy,
    pickTab: function (t) { S.pickType = t; pickRender(); },
    pick: pick, _pickId: _pickId, _render: render, _load: load
  };
})();
async function renderMediaLibTab() { MLIB._render(); await MLIB._load(false); MLIB._render(); }

// Nút 📎 trong khung soạn tin của chat: chọn ảnh/ghi âm/mẫu tin từ thư viện rồi chèn vào ô soạn (chưa gửi — người dùng bấm Gửi).
// Ảnh/ghi âm chèn dạng LINK (Pancake API đang gửi văn bản); mẫu tin chèn nội dung.
function mlibInsertToChat_(inputId, it, asMarker) {
  var ta = document.getElementById(inputId); if (!ta || !it) return;
  var add = it.type === 'template' ? it.text : asMarker ? '[[ml:' + it.type + '|' + it.url + '|' + String(it.name || '').replace(/[\]|\n]/g, ' ').slice(0, 80) + ']]' : (it.name ? it.name + ': ' : '') + it.url;
  ta.value = ta.value ? ta.value.replace(/\s+$/, '') + '\n' + add : add; ta.focus();
}
function mlibChatPick(inputId, type, asMarker) {
  MLIB.pick(type || 'template', function (it) { mlibInsertToChat_(inputId, it, asMarker); });
}
// Dán ảnh (Ctrl+V, vd ảnh chụp màn hình) vào khung soạn tin của chat: tự tải lên Thư viện rồi chèn y như chọn từ 📎 (chưa gửi — bấm Gửi).
// Chat nội bộ (tc-input) chèn dạng dấu hiệu [[ml:image|URL|tên]] để vẽ ảnh; Pancake/Social chèn link. Dán chữ bình thường KHÔNG bị ảnh hưởng.
var MLIB_PASTE_INPUTS_ = { 'tc-input': true, 'pkc-input': false, 'sc-input': false };
function mlibOnPaste_(e) {
  var t = e.target; if (!t || !t.id || !Object.prototype.hasOwnProperty.call(MLIB_PASTE_INPUTS_, t.id)) return;
  var items = (e.clipboardData && e.clipboardData.items) || [], file = null;
  for (var i = 0; i < items.length; i++) if (items[i].kind === 'file' && /^image\//.test(items[i].type || '')) { file = items[i].getAsFile(); break; }
  if (!file) return;
  e.preventDefault();
  var id = t.id;
  MLIB.uploadImageFile(file).then(function (it) { if (it) mlibInsertToChat_(id, it, MLIB_PASTE_INPUTS_[id]); });
}
if (typeof document !== 'undefined' && !window.__mlibPasteBound) { window.__mlibPasteBound = true; document.addEventListener('paste', mlibOnPaste_, true); }

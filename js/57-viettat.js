// ═══════════════════════════════════════════════════════
//  VIẾT TẮT trên CRM (2026-10-25, Duyên yêu cầu tích hợp app "Viết Tắt" vào Pancake AI + CRM)
//  (1) QUẢN LÝ: tab ZALO AI → "⌨️ Viết tắt" — thêm/sửa/xoá. Dữ liệu = sheet "VietTat" (gas_v13.js khối VIET TAT), CÙNG nguồn với extension Pancake AI
//      (extension-pancake/pancake-viettat.js). Mục CHUNG (cả team) chỉ admin sửa; mục RIÊNG mỗi người tự quản (server quyết định, không tin trình duyệt).
//  (2) GÕ TẮT trong CRM: ô nhiều dòng (<textarea>: ghi chú, tin nhắn...) — gõ viết tắt/từ khoá → Tab chèn nội dung (↑↓ đổi, Alt+1…8, Esc đóng).
//      Chỉ textarea (không đụng ô tên/SĐT/ô tìm); ô muốn tắt: thêm thuộc tính data-vt="off". Logic khớp/biến PHẢI giống pancake-viettat.js.
//  (3) THƯ MỤC CON + ẢNH (2026-10-25): nhóm = đường dẫn "Túi tiền/Cổ" (tối đa 3 cấp, hiện dạng cây); mỗi mục gắn được ẢNH CÓ SẴN trên Drive (dán link file/thư mục →
//      server action vietTatResolveImages trả danh sách; CHỈ lưu ID tham chiếu, không tải lên lại). Ảnh phải chia sẻ cho tài khoản chạy GAS.
//  Biến: {tên} {tên khách} (chữ cuối) · {tên đầy đủ} · {ngày} {ngày mai} {giờ} {thứ}. Tên khách = khách đang mở ở ngăn hồ sơ (nếu có) hoặc gõ kèm sau viết tắt (ch Huyền).
// ═══════════════════════════════════════════════════════
var _vt = { list: [], canTeam: false, me: '', at: 0, loading: null, err: '' };
var _VT_STALE_MS = 5 * 60 * 1000;
var _vtDraftImgs = [];   // ảnh của mục đang mở trong form: [{id,name}]
function _vtThumb(id) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w120'; }

function _vtFold(s) { return String(s || '').toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function _vtEsc(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function _vtGiven(n) { return String(n).trim().split(/\s+/).pop(); }
function _vtUsesName(s) { return s.options.some(function (o) { return o.indexOf('{tên') >= 0; }); }
function _vtResolve(t, name) {
  var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); }, f = function (x) { return p(x.getDate()) + '/' + p(x.getMonth() + 1) + '/' + x.getFullYear(); };
  t = t.split('{ngày mai}').join(f(new Date(Date.now() + 864e5))).split('{ngày}').join(f(d))
    .split('{giờ}').join(p(d.getHours()) + ':' + p(d.getMinutes())).split('{thứ}').join(d.toLocaleDateString('vi-VN', { weekday: 'long' }));
  if (name) t = t.split('{tên đầy đủ}').join(name.trim()).split('{tên khách}').join(_vtGiven(name)).split('{tên}').join(_vtGiven(name));
  return t;
}
function _vtMatch(w) {
  var lw = w.toLowerCase(), fw = _vtFold(w);
  return _vt.list.filter(function (s) {
    return String(s.abbr).toLowerCase() === lw ||
      (w.length >= 2 && String(s.keyword || '').split(',').some(function (k) { k = _vtFold(k.trim()); return k && k.indexOf(fw) === 0; }));
  });
}
function _vtAnalyze(before) {
  if (!before || /\s$/.test(before)) return null;
  var toks = []; before.replace(/\S+/g, function (m, i) { toks.push([m, i]); return m; });
  for (var k = 1; k <= 2; k++) {            // kiểu "viết tắt + tên": ch Thanh Huyền
    if (toks.length <= k) break;
    var a = toks[toks.length - 1 - k];
    var h = _vt.list.filter(function (s) { return String(s.abbr).toLowerCase() === a[0].toLowerCase() && _vtUsesName(s); });
    if (h.length) return { hits: h, span: before.slice(a[1]), typed: toks.slice(-k).map(function (t) { return t[0]; }).join(' ') };
  }
  var w = toks[toks.length - 1][0], hh = _vtMatch(w);
  return hh.length ? { hits: hh, span: w, typed: null } : null;
}
function _vtCustomerName() {
  try { if (typeof currentPhone !== 'undefined' && currentPhone && typeof allCustomers !== 'undefined') { var c = allCustomers.find(function (x) { return x.phone === currentPhone; }); if (c && c.name && c.name !== c.phone) return c.name; } } catch (e) {}
  return null;
}

// ---------- nạp dữ liệu ----------
function loadVietTat(force) {
  if (typeof gsUrl === 'undefined' || !gsUrl) return Promise.resolve();
  if (_vt.loading) return _vt.loading;
  if (!force && _vt.at && Date.now() - _vt.at < _VT_STALE_MS) return Promise.resolve();
  var sep = gsUrl.indexOf('?') >= 0 ? '&' : '?';
  _vt.loading = fetch(gsUrl + sep + 'action=vietTat', { redirect: 'follow' }).then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.error) throw new Error(d.error);
    _vt.list = (d && Array.isArray(d.snippets)) ? d.snippets : []; _vt.canTeam = !!(d && d.canTeam); _vt.me = (d && d.me) || ''; _vt.at = Date.now(); _vt.err = '';
  }).catch(function (e) { _vt.err = String((e && e.message) || e); }).then(function () { _vt.loading = null; vtRender(); });
  return _vt.loading;
}

// ---------- quản lý (tab Zalo AI) ----------
function _vtCanEdit(s) { return s.scope === 'team' ? _vt.canTeam : true; }
function vtRender() {
  var el = document.getElementById('vt-list'); if (!el) return;
  var q = _vtFold((document.getElementById('vt-search') || {}).value || '');
  var sf = (document.getElementById('vt-scope-filter') || {}).value || '';
  var hint = document.getElementById('vt-hint');
  if (hint) hint.textContent = _vt.canTeam ? 'Bạn là admin: mục "👥 Chung" cả team dùng được; mục "🙋 Của tôi" chỉ mình bạn thấy.' : 'Mục "👥 Chung" do admin quản lý (cả team dùng). Bạn tạo được mục "🙋 Của tôi" — chỉ mình bạn thấy và dùng.';
  if (_vt.err && !_vt.list.length) { el.innerHTML = '<div style="font-size:12px;color:#dc2626">Lỗi tải viết tắt: ' + _vtEsc(_vt.err) + ' <button class="btn sm" onclick="loadVietTat(true)">Thử lại</button></div>'; return; }
  var rows = _vt.list.filter(function (s) {
    if (sf && s.scope !== sf) return false;
    if (!q) return true;
    return _vtFold([s.abbr, s.keyword, s.nhom, s.options.join(' ')].join(' ')).indexOf(q) >= 0;
  });
  if (!rows.length) { el.innerHTML = '<div style="font-size:12px;color:var(--muted)">' + (_vt.list.length ? 'Không có mục nào khớp bộ lọc.' : 'Chưa có viết tắt nào — bấm "+ Thêm viết tắt". Ví dụ: viết tắt <b>ch</b> → "Dạ em chào chị {tên} ạ".') + '</div>'; return; }
  var groups = {}; rows.forEach(function (s) { (groups[s.nhom || ''] = groups[s.nhom || ''] || []).push(s); });
  var names = Object.keys(groups).sort(function (a, b) { return a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'vi'); });
  var shown = {}, html = '';
  names.forEach(function (g) {
    var parts = g ? g.split('/') : [], depth = Math.max(parts.length - 1, 0);
    if (!g) html += '<div style="font-size:11.5px;font-weight:700;color:var(--muted);margin:6px 0 2px">🗂 Chưa phân nhóm</div>';
    for (var k = 1; k <= parts.length; k++) {   // thư mục cha chưa có mục riêng vẫn hiện tiêu đề để thấy cây
      var pre = parts.slice(0, k).join('/'); if (shown[pre]) continue; shown[pre] = 1;
      html += '<div title="' + _vtEsc(pre) + '" style="font-size:11.5px;font-weight:700;color:var(--muted);margin:6px 0 2px;padding-left:' + ((k - 1) * 16) + 'px">' + (k > 1 ? '└ ' : '') + '🗂 ' + _vtEsc(parts[k - 1]) + '</div>';
    }
    html += (groups[g] || []).sort(function (a, b) { return String(a.abbr).localeCompare(String(b.abbr), 'vi'); }).map(function (s) {
      var can = _vtCanEdit(s);
      var kw = String(s.keyword || '').split(',').map(function (k) { return k.trim(); }).filter(Boolean).map(function (k) { return '<span class="zi-chip">' + _vtEsc(k) + '</span>'; }).join(' ');
      var imgs = (s.images || []).length ? '<div class="vt-imgs" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;align-items:center"><span style="font-size:11px;color:var(--muted)">🖼 ' + s.images.length + ' ảnh</span>' +
        s.images.map(function (im) { return '<img src="' + _vtEsc(_vtThumb(im.id)) + '" alt="' + _vtEsc(im.name) + '" title="' + _vtEsc(im.name) + '" loading="lazy" referrerpolicy="no-referrer" style="width:38px;height:38px;object-fit:cover;border-radius:5px;border:1px solid var(--border)" onerror="this.style.display=\'none\'">'; }).join('') + '</div>' : '';
      return '<div style="margin-left:' + (depth * 16) + 'px;border:1px solid var(--border);border-radius:9px;padding:8px 10px;background:var(--surface);display:flex;gap:10px;align-items:flex-start;margin-bottom:4px">' +
        '<div style="min-width:70px"><code style="font-size:13px;font-weight:700">' + _vtEsc(s.abbr) + '</code><div style="font-size:10.5px;color:var(--muted)">' + (s.scope === 'team' ? '👥 Chung' : '🙋 Của tôi') + '</div></div>' +
        '<div style="flex:1;min-width:0"><div style="margin-bottom:3px">' + kw + '</div>' +
        s.options.map(function (o, i) { return '<div style="font-size:12px;white-space:pre-wrap;word-break:break-word;' + (i ? 'border-top:1px dashed var(--border);margin-top:3px;padding-top:3px' : '') + '">' + _vtEsc(o) + '</div>'; }).join('') + imgs + '</div>' +
        (can ? '<div style="display:flex;gap:4px;flex-shrink:0"><button class="btn sm" data-vt-id="' + _vtEsc(s.id) + '" onclick="vtOpenForm(this.dataset.vtId)" title="Sửa">✏️</button><button class="btn sm" data-vt-id="' + _vtEsc(s.id) + '" onclick="vtDelete(this.dataset.vtId)" title="Xoá">🗑</button></div>' : '') +
        '</div>';
    }).join('');
  });
  el.innerHTML = html;
  var dl = document.getElementById('vt-nhom-list');
  if (dl) { var seen = {}; _vt.list.forEach(function (s) { var p = s.nhom ? s.nhom.split('/') : []; for (var k = 1; k <= p.length; k++) seen[p.slice(0, k).join('/')] = 1; }); dl.innerHTML = Object.keys(seen).map(function (n) { return '<option value="' + _vtEsc(n) + '">'; }).join(''); }
}
function _vtOptRow(v) {
  var d = document.createElement('div'); d.className = 'vt-opt'; d.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:flex-start';
  var t = document.createElement('textarea'); t.className = 'zai-textarea'; t.rows = 2; t.style.cssText = 'flex:1;min-width:0'; t.placeholder = 'Nội dung chèn vào chat (có thể nhiều dòng; dùng {tên}, {ngày}...)'; t.value = v || ''; t.setAttribute('data-vt', 'off');
  var b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm'; b.textContent = '✕'; b.title = 'Bỏ lựa chọn này';
  b.onclick = function () { var wrap = document.getElementById('vt-f-opts'); if (wrap.children.length > 1) d.remove(); else t.value = ''; };
  d.appendChild(t); d.appendChild(b); return d;
}
function vtAddOpt(v) { var w = document.getElementById('vt-f-opts'); if (w && w.children.length < 10) { var r = _vtOptRow(v); w.appendChild(r); r.querySelector('textarea').focus(); } }
function vtOpenForm(id) {
  var s = id ? _vt.list.find(function (x) { return x.id === id; }) : null;
  document.getElementById('vt-f-id').value = s ? s.id : '';
  document.getElementById('vt-f-abbr').value = s ? s.abbr : '';
  document.getElementById('vt-f-keyword').value = s ? (s.keyword || '') : '';
  document.getElementById('vt-f-nhom').value = s ? (s.nhom || '') : '';
  var sc = document.getElementById('vt-f-scope');
  sc.querySelector('option[value="team"]').disabled = !_vt.canTeam;
  sc.value = s ? s.scope : 'me'; sc.disabled = !!s;   // không đổi chung <-> riêng khi sửa (server cũng chặn)
  _vtDraftImgs = s && s.images ? s.images.map(function (x) { return { id: x.id, name: x.name }; }) : [];
  var il = document.getElementById('vt-f-imglinks'); if (il) il.value = '';
  var im = document.getElementById('vt-f-imgmsg'); if (im) im.textContent = '';
  vtRenderDraftImgs();
  var w = document.getElementById('vt-f-opts'); w.innerHTML = '';
  (s && s.options.length ? s.options : ['']).forEach(function (o) { w.appendChild(_vtOptRow(o)); });
  document.getElementById('vt-form-wrap').style.display = 'block';
  document.getElementById('vt-f-abbr').focus();
}
function vtRenderDraftImgs() {
  var el = document.getElementById('vt-f-imgs'); if (!el) return;
  el.innerHTML = _vtDraftImgs.map(function (im, i) {
    return '<div style="position:relative;width:64px" title="' + _vtEsc(im.name) + '"><img src="' + _vtEsc(_vtThumb(im.id)) + '" alt="" referrerpolicy="no-referrer" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid var(--border);background:var(--surface2)" onerror="this.style.opacity=.3">' +
      '<button type="button" class="btn sm" data-i="' + i + '" onclick="vtRemoveImg(+this.dataset.i)" style="position:absolute;top:-6px;right:-6px;padding:0 5px;line-height:16px" title="Bỏ ảnh này">✕</button>' +
      '<div style="font-size:10px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _vtEsc(im.name || '') + '</div></div>';
  }).join('');
  var c = document.getElementById('vt-f-imgcount'); if (c) c.textContent = _vtDraftImgs.length ? ('(' + _vtDraftImgs.length + '/10 ảnh)') : '';
}
function vtRemoveImg(i) { _vtDraftImgs.splice(i, 1); vtRenderDraftImgs(); }
// Dán link FILE ảnh hoặc THƯ MỤC Drive (mỗi dòng 1 link) → server trả danh sách ảnh; chỉ lưu ID tham chiếu, không tải lên lại.
async function vtFetchImgs() {
  var ta = document.getElementById('vt-f-imglinks'), msg = document.getElementById('vt-f-imgmsg'), btn = document.getElementById('vt-f-imgbtn');
  var links = String((ta && ta.value) || '').split(/[\n,]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  if (!links.length) { if (msg) msg.textContent = 'Dán link ảnh hoặc thư mục Google Drive vào ô trên.'; return; }
  if (_vtDraftImgs.length >= 10) { if (msg) msg.textContent = 'Mỗi mục tối đa 10 ảnh.'; return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Đang lấy...'; } if (msg) msg.textContent = '';
  try {
    var sep = gsUrl.indexOf('?') >= 0 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=vietTatResolveImages&links=' + encodeURIComponent(links.join('\n')), { redirect: 'follow' });
    var d = await r.json();
    if (d && d.error) { if (msg) msg.textContent = 'Lỗi: ' + d.error; return; }
    var have = {}, added = 0; _vtDraftImgs.forEach(function (x) { have[x.id] = 1; });
    (d.images || []).forEach(function (im) { if (!have[im.id] && _vtDraftImgs.length < 10) { have[im.id] = 1; _vtDraftImgs.push({ id: im.id, name: im.name }); added++; } });
    vtRenderDraftImgs();
    var errs = (d.errors || []).length ? ' · ' + d.errors.length + ' link lỗi (hãy chia sẻ thư mục/ảnh cho tài khoản chạy GAS hoặc "ai có link"): ' + d.errors.slice(0, 2).join(' | ') : '';
    if (msg) msg.textContent = (added ? 'Đã thêm ' + added + ' ảnh.' : 'Không thêm được ảnh nào.') + errs;
    if (added && ta) ta.value = '';
  } catch (e) { if (msg) msg.textContent = 'Lỗi kết nối, thử lại.'; }
  finally { if (btn) { btn.disabled = false; btn.textContent = '➕ Lấy ảnh từ link'; } }
}
function vtCloseForm() { document.getElementById('vt-form-wrap').style.display = 'none'; }
async function vtSave() {
  var abbr = (document.getElementById('vt-f-abbr').value || '').trim();
  var opts = Array.prototype.map.call(document.querySelectorAll('#vt-f-opts textarea'), function (t) { return t.value.trim(); }).filter(Boolean);
  if (!abbr || /\s/.test(abbr)) { alert('Viết tắt phải là 1 từ, không có khoảng trắng (VD: ch, gb, ship).'); return; }
  if (!opts.length) { alert('Nhập ít nhất 1 nội dung để chèn.'); return; }
  var btn = document.getElementById('vt-f-save-btn'); btn.disabled = true; btn.textContent = 'Đang lưu...';
  try {
    var snippet = { id: document.getElementById('vt-f-id').value || undefined, abbr: abbr, keyword: (document.getElementById('vt-f-keyword').value || '').trim(),
      nhom: (document.getElementById('vt-f-nhom').value || '').trim(), options: opts, scope: document.getElementById('vt-f-scope').value, images: _vtDraftImgs.map(function (x) { return { id: x.id, name: x.name }; }) };
    var r = await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'saveVietTat', snippet: snippet }) });
    var d = await r.json();
    if (d && d.error) { alert('Lỗi: ' + d.error); return; }
  } catch (e) { alert('Lỗi kết nối, thử lại.'); return; }
  finally { btn.disabled = false; btn.textContent = 'Lưu'; }
  vtCloseForm(); if (typeof toast === 'function') toast('✓ Đã lưu viết tắt "' + abbr + '"');
  loadVietTat(true);
}
async function vtDelete(id) {
  var s = _vt.list.find(function (x) { return x.id === id; });
  if (!confirm('Xoá viết tắt "' + (s ? s.abbr : '') + '"?' + (s && s.scope === 'team' ? '\n(Mục CHUNG — cả team sẽ không dùng được nữa.)' : ''))) return;
  try {
    var r = await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'deleteVietTat', id: id }) });
    var d = await r.json();
    if (d && d.error) { alert('Lỗi: ' + d.error); return; }
  } catch (e) { alert('Lỗi kết nối, thử lại.'); return; }
  loadVietTat(true);
}
(function () {
  if (typeof switchTab === 'function') {
    var _prev = switchTab;
    switchTab = function (tab, el) { _prev(tab, el); if (tab === 'zaloai') loadVietTat(true); };
  }
})();

// ---------- gõ tắt trong ô nhiều dòng của CRM ----------
(function () {
  var st = null, host = null, box = null;
  function ui() {
    if (host) return;
    host = document.createElement('div'); host.id = 'vt-host'; host.style.cssText = 'all:initial;position:fixed;z-index:2147483000;left:0;top:0';
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>.b{position:fixed;display:none;width:max-content;max-width:min(420px,92vw);background:#fff;color:#111;border:1px solid #ccc;border-radius:12px;box-shadow:0 4px 20px #0004;font:14px system-ui;overflow:hidden}' +
      '.h{padding:6px 12px;font-size:12px;color:#888;display:flex;justify-content:space-between;gap:12px}' +
      '.o{display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-top:1px solid #eee;white-space:pre-wrap;max-height:3.6em;overflow:hidden}' +
      '.o.a,.o:hover{background:#e8f0fe}.o i{font-style:normal;font-size:11px;color:#1a73e8;background:#e8f0fe;border-radius:6px;padding:1px 6px;flex:none}' +
      '@media(prefers-color-scheme:dark){.b{background:#222;color:#eee;border-color:#444}.o{border-color:#333}.o.a,.o:hover{background:#2b3a55}}</style><div class="b"></div>';
    box = root.querySelector('.b');
    box.addEventListener('mousedown', function (e) { e.preventDefault(); var o = e.target.closest ? e.target.closest('.o') : null; if (o) choose(+o.dataset.i); });
    document.documentElement.appendChild(host);
  }
  function hide() { st = null; if (box) box.style.display = 'none'; }
  function eligible(el) { return el && el.tagName === 'TEXTAREA' && !el.readOnly && !el.disabled && !(el.closest && el.closest('[data-vt="off"]')) && el.getAttribute('data-vt') !== 'off'; }
  function show(s) {
    ui(); st = s;
    s.items = s.hits.reduce(function (a, x) { return a.concat(x.options); }, []).slice(0, 8); s.idx = 0;
    box.innerHTML = '<div class="h"><span>' + (s.uses ? (s.name ? 'Khách: <b>' + _vtEsc(_vtGiven(s.name)) + '</b>' : 'Chưa có tên khách — gõ kèm tên: ch Huyền') : 'Viết tắt') + '</span><span>Tab · ↑↓ · Esc</span></div>' +
      s.items.map(function (o, i) { return '<div class="o' + (i ? '' : ' a') + '" data-i="' + i + '"><i>Alt+' + (i + 1) + '</i><span>' + _vtEsc(_vtResolve(o, s.name)) + '</span></div>'; }).join('');
    box.style.display = 'block';
    var r = s.el.getBoundingClientRect();
    box.style.left = Math.max(8, Math.min(r.left, innerWidth - box.offsetWidth - 8)) + 'px';
    if (r.top > 220) { box.style.top = 'auto'; box.style.bottom = (innerHeight - r.top + 8) + 'px'; } else { box.style.bottom = 'auto'; box.style.top = (r.bottom + 8) + 'px'; }
  }
  function choose(i) {
    var s = st; if (!s) return; var o = s.items[i]; hide(); if (!o) return;
    var el = s.el, end = s.caret, L = s.span.length, v = el.value, text = _vtResolve(o, s.name);
    if (v.slice(end - L, end) !== s.span) { if (typeof toast === 'function') toast('Vị trí gõ đã thay đổi, hãy thử lại'); return; }
    var d = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    el.focus(); if (d && d.set) d.set.call(el, v.slice(0, end - L) + text + v.slice(end)); else el.value = v.slice(0, end - L) + text + v.slice(end);
    var pos = end - L + text.length; el.setSelectionRange(pos, pos);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  document.addEventListener('focusin', function (e) { if (eligible(e.target)) loadVietTat(false); }, true);
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!eligible(el) || !_vt.list.length || el.selectionStart !== el.selectionEnd) { if (st) hide(); return; }
    var before = el.value.slice(0, el.selectionStart), a = _vtAnalyze(before);
    if (!a) { hide(); return; }
    var uses = a.hits.some(_vtUsesName);
    show({ el: el, caret: el.selectionStart, hits: a.hits, span: a.span, uses: uses, name: a.typed || (uses ? _vtCustomerName() : null) });
  }, true);
  document.addEventListener('keydown', function (e) {
    if (!st) return;
    if (e.key === 'Escape') { hide(); return; }
    if (e.key === 'Tab' || (e.altKey && /^[1-8]$/.test(e.key))) { e.preventDefault(); e.stopPropagation(); choose(e.key === 'Tab' ? st.idx : +e.key - 1); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      var n = st.items.length; st.idx = (st.idx + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
      box.querySelectorAll('.o').forEach(function (x, i) { x.classList.toggle('a', i === st.idx); });
    }
  }, true);
  document.addEventListener('mousedown', function (e) { if (host && e.composedPath().indexOf(host) >= 0) return; hide(); }, true);
})();

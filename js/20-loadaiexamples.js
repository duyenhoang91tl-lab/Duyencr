
// ═══════════════════════════════════════════════════════
//  ZALO AI HELPER
// ═══════════════════════════════════════════════════════
(function(){
  // Restore saved API key
  var savedKey = localStorage.getItem('zai_apikey') || '';
  var keyEl = document.getElementById('zai-apikey');
  if (keyEl && savedKey) keyEl.value = savedKey;

  // Hook into switchTab to show/hide zaloai panel
  var _prevSwitch = switchTab;
  switchTab = function(tab, el) {
    _prevSwitch(tab, el);
    var zp = document.getElementById('tab-zaloai');
    if (zp) zp.style.display = (tab === 'zaloai') ? 'flex' : 'none';
    if (tab === 'zaloai') { var _sg = document.getElementById('mt-suggest'); if (_sg && !_sg.getAttribute('data-mounted')) { _sg.setAttribute('data-mounted', '1'); tplSuggestMount(_sg); } loadMsgTemplates(); loadAiExamples(); }
  };
})();

// ═══════════════════════════════════════════════════════
//  THU VIEN MAU TIN NHAN TU VAN KHACH (them 2026-10) — doc/ghi qua action
//  'messageTemplates'/'saveMessageTemplate'/'deleteMessageTemplate' (gas_v13.js). Cung 1 nguon
//  du lieu voi extension Pancake AI, nen KHONG cache rieng trong localStorage — luon fetch lai
//  khi mo tab de thay thay doi tu noi khac (vd extension vua them mau moi).
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
//  MAU AI DA HOC (AIContext / combo_template) — actions 'aiExamples' (GET), 'saveAIExample', 'deleteAIExample' (POST)
// ═══════════════════════════════════════════════════════
var _aiExamples = [];
async function loadAiExamples() {
  var el = document.getElementById('aiex-list');
  if (!el) return;
  el.innerHTML = '<div style="font-size:12px;color:var(--muted)">Đang tải...</div>';
  try {
    var sep = gsUrl.indexOf('?') >= 0 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=aiExamples', { redirect: 'follow' });
    var d = await r.json();
    _aiExamples = (d && d.examples) || [];
  } catch (e) {
    el.innerHTML = '<div style="font-size:12px;color:#dc2626">Lỗi tải mẫu AI đã học, thử lại.</div>';
    return;
  }
  renderAiExamples();
}
function renderAiExamples() {
  var el = document.getElementById('aiex-list');
  if (!el) return;
  if (!_aiExamples.length) { el.innerHTML = '<div style="font-size:12px;color:var(--muted)">Chưa có mẫu nào — CS sửa gợi ý AI trên Pancake/Zalo rồi bấm "Lưu để AI học" sẽ hiện ở đây.</div>'; return; }
  el.innerHTML = _aiExamples.map(function (x, i) {
    var used = i < 5 ? '<span class="zi-chip" title="Đang được đưa vào prompt AI">đang dùng</span> ' : '';
    return '<div style="border:1px solid var(--border);border-radius:9px;padding:10px;background:var(--surface)">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;align-items:flex-start">' +
        '<div style="font-size:11px;color:var(--muted)">' + used + esc(x.context || '') + '</div>' +
        '<div style="display:flex;gap:4px;flex-shrink:0">' +
          '<button class="btn sm" onclick="editAiExample(' + i + ')" title="Sửa">✏️</button>' +
          '<button class="btn sm" onclick="deleteAiExample(' + i + ')" title="Xóa">🗑</button>' +
        '</div>' +
      '</div>' +
      '<div id="aiex-body-' + i + '" style="font-size:12px;white-space:pre-wrap">' + esc(x.content) + '</div>' +
    '</div>';
  }).join('');
}
function editAiExample(i) {
  var x = _aiExamples[i], b = document.getElementById('aiex-body-' + i);
  if (!x || !b) return;
  b.innerHTML = '<textarea id="aiex-ta-' + i + '" class="zai-textarea" rows="5" style="width:100%;margin-bottom:6px">' + esc(x.content) + '</textarea>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn sm" onclick="renderAiExamples()">Hủy</button>' +
    '<button class="btn sm primary" onclick="saveAiExample(' + i + ',this)">Lưu</button></div>';
}
async function saveAiExample(i, btn) {
  var x = _aiExamples[i], ta = document.getElementById('aiex-ta-' + i);
  if (!x || !ta) return;
  var content = (ta.value || '').trim();
  if (!content) { alert('Nội dung mẫu không được trống.'); return; }
  btn.disabled = true; btn.textContent = 'Đang lưu...';
  try {
    var r = await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'saveAIExample', id: x.id, content: content }) });
    var d = await r.json();
    if (!d || !d.ok) throw new Error((d && d.error) || 'Lưu thất bại');
    x.content = content; renderAiExamples();
  } catch (e) { alert('Lỗi lưu mẫu: ' + e.message); btn.disabled = false; btn.textContent = 'Lưu'; }
}
async function deleteAiExample(i) {
  var x = _aiExamples[i];
  if (!x || !confirm('Xóa mẫu AI đã học này? AI sẽ không học theo mẫu này nữa.')) return;
  try {
    var r = await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'deleteAIExample', id: x.id }) });
    var d = await r.json();
    if (!d || !d.ok) throw new Error((d && d.error) || 'Xóa thất bại');
    _aiExamples.splice(i, 1); renderAiExamples();
  } catch (e) { alert('Lỗi xóa mẫu: ' + e.message); }
}

var _msgTemplates = [];
var _msgTplCanApprove = false;   // server quyet dinh (vai tro that trong sheet Users qua token), KHONG tin currentUser phia trinh duyet
var _msgTplPending = 0;
var _msgTplLoadedAt = 0;
var _msgTplGroups = [];   // nhom san pham (DANH_MUC) do server tra ve cung danh sach mau — dung cho dropdown form + bo loc
async function loadMsgTemplates() {
  var listEl = document.getElementById('mt-list');   // co the khong co (khi goi tu khung chat) -> van tai du lieu, chi bo qua phan ve danh sach quan ly
  if (listEl) listEl.innerHTML = '<div style="font-size:12px;color:var(--muted)">Đang tải mẫu...</div>';
  try {
    var sep = gsUrl.indexOf('?') >= 0 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=messageTemplates', { redirect: 'follow' });
    var d = await r.json();
    _msgTemplates = (d && d.templates) || [];
    _msgTplCanApprove = !!(d && d.canApprove);
    _msgTplPending = (d && d.pendingCount) || 0;
    _msgTplGroups = (d && d.groups) || [];
    _msgTplLoadedAt = Date.now();
  } catch (e) {
    if (listEl) listEl.innerHTML = '<div style="font-size:12px;color:#dc2626">Lỗi tải thư viện mẫu, thử lại.</div>';
    return;
  }
  _tplUpdateBadge();
  _tplFillGroupSelects();
  renderMsgTemplateList();
  _tplSuggestRefreshAll();
}

// ── Dung chung cho: o goi y theo san pham (CRM) va khung chat Pancake trong CRM (sap co) ──
function _tplFold(s) { return (typeof _foldVi === 'function') ? _foldVi(s) : String(s || '').toLowerCase(); }
function _tplMine(t) { var me = (typeof currentUser !== 'undefined' && currentUser && (currentUser.name || currentUser.username)) || ''; return !!me && String(t.createdBy || '').trim().toLowerCase() === String(me).trim().toLowerCase(); }
function _tplCanEdit(t) { return _msgTplCanApprove || (t.status !== 'approved' && _tplMine(t)); }
// Tim theo san pham / chu de hoi thoai / tag / tieu de / noi dung (bo dau, khong phan biet hoa thuong). Moi tu phai khop it nhat 1 truong;
// diem: san pham 5 (khop nguyen 1 san pham +3), chu de 3, tag 3, tieu de 2, noi dung 1. Khong co tu khoa -> tra het (moi nhat truoc).
function tplSearch(list, query, topic) {
  var words = _tplFold(query).split(/\s+/).filter(Boolean);
  var topicF = _tplFold(topic || '');
  var out = [];
  list.forEach(function (t, idx) {
    if (topicF && _tplFold(t.topic) !== topicF) return;
    var f = { product: _tplFold(t.product), topic: _tplFold(t.topic), tags: _tplFold(t.tags), title: _tplFold(t.title), content: _tplFold(t.content) };
    var prodParts = String(t.product || '').split(/[,;|\n]/).map(function (x) { return _tplFold(x).trim(); }).filter(Boolean);
    var score = 0, okAll = true;
    for (var i = 0; i < words.length && okAll; i++) {
      var w = words[i], hit = 0;
      if (f.product.indexOf(w) >= 0) hit = Math.max(hit, 5);
      if (f.topic.indexOf(w) >= 0) hit = Math.max(hit, 3);
      if (f.tags.indexOf(w) >= 0) hit = Math.max(hit, 3);
      if (f.title.indexOf(w) >= 0) hit = Math.max(hit, 2);
      if (f.content.indexOf(w) >= 0) hit = Math.max(hit, 1);
      if (!hit) okAll = false; else score += hit;
    }
    if (!okAll) return;
    var qf = words.join(' ');
    if (qf && prodParts.indexOf(qf) >= 0) score += 3;
    out.push({ t: t, score: score, idx: idx });
  });
  out.sort(function (a, b) { return (b.score - a.score) || (a.idx - b.idx); });   // idx nho = moi hon (server da sap moi nhat truoc)
  return out.map(function (x) { return x.t; });
}
// Do lai cac o chon nhom (bo loc danh sach + form) tu _msgTplGroups; giu nguyen lua chon dang co neu van con trong danh sach.
function _tplFillGroupSelects() {
  var groups = _msgTplGroups.slice();
  _msgTemplates.forEach(function (t) { if (t.nhom && groups.indexOf(t.nhom) < 0) groups.push(t.nhom); });
  var f = document.getElementById('mt-group-filter');
  if (f) { var cur = f.value; f.innerHTML = '<option value="">Tất cả nhóm</option>' + groups.map(function (g) { return '<option value="' + esc(g) + '">' + esc(g) + '</option>'; }).join('') + '<option value="__none__">Chung (chưa phân nhóm)</option>'; f.value = cur; if (f.value !== cur) f.value = ''; }
  var s = document.getElementById('mt-f-group');
  if (s) { var cs = s.value; s.innerHTML = '<option value="">🗂 Nhóm sản phẩm: tự phân loại</option>' + groups.map(function (g) { return '<option value="' + esc(g) + '">' + esc(g) + '</option>'; }).join(''); s.value = cs; if (s.value !== cs) s.value = ''; }
}
function _tplChips(t) {
  var h = '';
  if (t.nhom) h += '<span class="zi-chip" style="background:#dcfce7;color:#166534" title="' + (t.nhomAuto ? 'Hệ thống tự phân loại theo tên sản phẩm / nội dung' : 'Nhóm sản phẩm do người soạn chọn') + '">🗂 ' + esc(t.nhom) + (t.nhomAuto ? ' · tự phân loại' : '') + '</span>';
  String(t.product || '').split(/[,;|\n]/).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (p) { h += '<span class="zi-chip" style="background:#fef3c7;color:#92400e" title="Sản phẩm">📦 ' + esc(p) + '</span>'; });
  if (t.topic) h += '<span class="zi-chip" style="background:#dbeafe;color:#1e40af" title="Nội dung hội thoại">💬 ' + esc(t.topic) + '</span>';
  String(t.tags || '').split(',').forEach(function (tg) { tg = tg.trim(); if (tg) h += '<span class="zi-chip">#' + esc(tg) + '</span>'; });
  return h;
}
function _tplCopyText(text, btn) {
  var done = function () { if (btn) { var old = btn.getAttribute('data-old') || btn.textContent; btn.setAttribute('data-old', old); btn.textContent = '✅ Đã copy'; setTimeout(function () { btn.textContent = old; }, 1200); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(function () { _tplCopyFallback(text, done); });
  else _tplCopyFallback(text, done);
}
function _tplCopyFallback(text, done) {
  try { var ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done(); }
  catch (e) { alert('Không copy được, vui lòng copy thủ công.'); }
}

// O GOI Y TIN NHAN: nhan vien go ten san pham (hoac noi dung hoi thoai) -> danh sach mau DA DUYET lien quan, bam Copy de dan vao chat.
// Dung lai o khung chat Pancake trong CRM: tplSuggestMount(hostEl, { onPick: function(t){ chenVaoOTraLoi(t.content); } }) — khong phu thuoc giao dien khac.
var _tplSuggestHosts = [];
function tplSuggestMount(host, opts) {
  if (!host) return;
  opts = opts || {};
  var st = { host: host, q: '', topic: '', onPick: opts.onPick || null, pickLabel: opts.pickLabel || '📋 Copy' };
  host.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">' +
      '<input class="zai-input tpl-sg-q" placeholder="🔎 Gõ tên sản phẩm hoặc nội dung hội thoại (VD: nhẫn vàng, khách hỏi giá)..." style="flex:1;min-width:220px" autocomplete="off">' +
    '</div>' +
    '<div class="tpl-sg-topics zi-row" style="margin-bottom:8px"></div>' +
    '<div class="tpl-sg-res" style="display:flex;flex-direction:column;gap:8px"></div>';
  host.querySelector('.tpl-sg-q').addEventListener('input', function (e) { st.q = e.target.value; _tplSuggestRender(st); });
  _tplSuggestHosts.push(st);
  _tplSuggestRender(st);
  return st;
}
function _tplSuggestRefreshAll() { _tplSuggestHosts = _tplSuggestHosts.filter(function (st) { return document.body.contains(st.host); }); _tplSuggestHosts.forEach(_tplSuggestRender); }
function _tplSuggestRender(st) {
  var approved = _msgTemplates.filter(function (t) { return t.status === 'approved'; });
  var topicsEl = st.host.querySelector('.tpl-sg-topics'), resEl = st.host.querySelector('.tpl-sg-res');
  var topics = []; approved.forEach(function (t) { if (t.topic && topics.indexOf(t.topic) < 0) topics.push(t.topic); });
  topicsEl.innerHTML = topics.slice(0, 12).map(function (tp, i) {
    var on = st.topic && _tplFold(st.topic) === _tplFold(tp);
    return '<button class="btn sm" data-ti="' + i + '" style="' + (on ? 'background:#1e40af;color:#fff' : '') + '">💬 ' + esc(tp) + '</button>';
  }).join('');
  topicsEl.querySelectorAll('button').forEach(function (b) {
    b.onclick = function () { var tp = topics[+b.getAttribute('data-ti')]; st.topic = (st.topic && _tplFold(st.topic) === _tplFold(tp)) ? '' : tp; _tplSuggestRender(st); };
  });
  var items = tplSearch(approved, st.q, st.topic);
  if (!approved.length) { resEl.innerHTML = '<div style="font-size:12px;color:var(--muted)">Chưa có mẫu nào được duyệt — admin/quản lý thêm mẫu hoặc duyệt mẫu nhân viên đề xuất ở mục "Quản lý mẫu" bên dưới.</div>'; return; }
  if (!items.length) { resEl.innerHTML = '<div style="font-size:12px;color:var(--muted)">Không có mẫu nào khớp' + (st.q ? ' "' + esc(st.q) + '"' : '') + '. Thử gõ tên sản phẩm ngắn hơn, hoặc đề xuất mẫu mới bằng nút "+ Thêm mẫu".</div>'; return; }
  var shown = items.slice(0, 20);
  resEl.innerHTML = shown.map(function (t, i) {
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:10px 12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">' +
        '<div style="font-weight:700;font-size:13px">' + esc(t.title) + '</div>' +
        '<button class="btn sm primary" data-ci="' + i + '" style="flex-shrink:0">' + esc(st.pickLabel) + '</button>' +
      '</div>' +
      '<div style="font-size:12px;white-space:pre-wrap;margin-bottom:6px">' + esc(t.content) + '</div>' +
      '<div class="zi-row">' + _tplChips(t) + '</div></div>';
  }).join('') + (items.length > shown.length ? '<div style="font-size:11px;color:var(--muted)">Còn ' + (items.length - shown.length) + ' mẫu nữa — gõ thêm từ khoá để thu hẹp.</div>' : '');
  resEl.querySelectorAll('button[data-ci]').forEach(function (b) {
    b.onclick = function () { var t = shown[+b.getAttribute('data-ci')]; if (st.onPick) st.onPick(t, b); else _tplCopyText(t.content, b); };
  });
}

// ── GOI Y TIN NHAN TRONG KHUNG CHAT (Social > Chat va chat trong ho so khach): nut 💡 canh o soan tin; bam -> hien o goi y ngay tren o soan,
// chon mau -> CHEN vao o tra loi (khong tu gui, nhan vien doc lai roi bam Gui). Nhan vien go ten san pham de loc.
function _tplInsertIntoTextarea(ta, text) {
  var cur = String(ta.value || '');
  ta.value = cur.trim() ? cur.replace(/\s+$/, '') + '\n\n' + text : text;
  return ta.value;
}
function tplChatToggle(composeId, textareaId) {
  var comp = document.getElementById(composeId), ta = document.getElementById(textareaId);
  if (!comp || !ta) return;
  var pid = 'tpl-chat-panel-' + composeId, panel = document.getElementById(pid);
  if (panel) { panel.style.display = panel.style.display === 'none' ? '' : 'none'; if (panel.style.display !== 'none') { var q0 = panel.querySelector('.tpl-sg-q'); if (q0) q0.focus(); } return; }
  panel = document.createElement('div');
  panel.id = pid; panel.className = 'tpl-chat-panel';
  comp.parentNode.insertBefore(panel, comp);
  tplSuggestMount(panel, { pickLabel: '↳ Chèn', onPick: function (t) {
    _tplInsertIntoTextarea(ta, t.content);
    ta.focus();
    try { ta.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    if (typeof toast === 'function') toast('✓ Đã chèn mẫu — đọc lại rồi bấm Gửi');
  } });
  var q = panel.querySelector('.tpl-sg-q'); if (q) q.focus();
  if (!_msgTplLoadedAt || Date.now() - _msgTplLoadedAt > 60000) loadMsgTemplates();   // du lieu cu qua 60s -> tai lai (mau moi duoc duyet)
}

function _tplUpdateBadge() {
  var el = document.getElementById('mt-pending-badge');
  if (!el) return;
  if (_msgTplCanApprove && _msgTplPending > 0) { el.style.display = ''; el.textContent = '⏳ ' + _msgTplPending + ' mẫu chờ duyệt'; }
  else el.style.display = 'none';
  var hint = document.getElementById('mt-form-hint');
  if (hint) hint.textContent = _msgTplCanApprove ? 'Bạn là admin/quản lý: mẫu lưu xong dùng được ngay.' : 'Mẫu bạn thêm sẽ ở trạng thái "Chờ duyệt" — chỉ dùng được sau khi quản lý duyệt.';
}
function mtShowPending() { var sel = document.getElementById('mt-status-filter'); if (sel) { sel.value = 'pending'; renderMsgTemplateList(); } }

var _MT_STATUS = {
  approved: '<span class="zi-chip" style="background:#dcfce7;color:#166534">✅ Đã duyệt</span>',
  pending: '<span class="zi-chip" style="background:#fef3c7;color:#92400e">⏳ Chờ duyệt</span>',
  rejected: '<span class="zi-chip" style="background:#fee2e2;color:#991b1b">❌ Bị từ chối</span>'
};
function renderMsgTemplateList() {
  var listEl = document.getElementById('mt-list');
  if (!listEl || !document.getElementById('mt-search')) return;
  var q = (document.getElementById('mt-search').value || '').trim();
  var stF = (document.getElementById('mt-status-filter') || {}).value || '';
  var base = _msgTemplates.filter(function (t) {
    var gF = (document.getElementById('mt-group-filter') || {}).value || '';
    if (gF === '__none__' ? !!t.nhom : (gF && t.nhom !== gF)) return false;
    if (stF === 'mine') return _tplMine(t);
    return !stF || t.status === stF;
  });
  var items = q ? tplSearch(base, q, '') : base;
  if (!items.length) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--muted)">' + (_msgTemplates.length ? 'Không có mẫu phù hợp bộ lọc.' : 'Chưa có mẫu nào — bấm "+ Thêm mẫu" để tạo mẫu đầu tiên.') + '</div>';
    return;
  }
  listEl.innerHTML = items.map(function (t) {
    var lines = _tplLines(t.content);
    var acts = '<button class="btn sm" onclick="copyMsgTemplate(\'' + t.id + '\')" title="Copy nguyên cả mẫu (cả đoạn dài)">📋 Copy cả câu</button>';
    if (lines.length > 1) acts += '<button class="btn sm" onclick="mtToggleLines(\'' + t.id + '\')" title="Tách mỗi dòng thành 1 tin nhắn riêng">📑 Từng đoạn (' + lines.length + ')</button>';
    if (_msgTplCanApprove && t.status !== 'approved') acts += '<button class="btn sm primary" onclick="approveMsgTemplateUI(\'' + t.id + '\',\'approve\')" title="Duyệt mẫu">✅ Duyệt</button>';
    if (_msgTplCanApprove && t.status === 'pending') acts += '<button class="btn sm" onclick="approveMsgTemplateUI(\'' + t.id + '\',\'reject\')" title="Từ chối">❌ Từ chối</button>';
    if (_tplCanEdit(t)) acts += '<button class="btn sm" onclick="openMsgTemplateForm(\'' + t.id + '\')" title="Sửa">✏️</button><button class="btn sm" onclick="deleteMsgTemplateUI(\'' + t.id + '\')" title="Xóa">🗑</button>';
    var meta = '<div style="font-size:11px;color:var(--muted);margin-top:4px">Người tạo: ' + esc(t.createdBy || '—') +
      (t.status === 'approved' && t.approvedBy ? ' · Duyệt bởi: ' + esc(t.approvedBy) : '') + '</div>' +
      (t.status === 'rejected' && t.rejectReason ? '<div style="font-size:11px;color:#991b1b;margin-top:2px">Lý do từ chối: ' + esc(t.rejectReason) + ' — sửa lại rồi lưu để gửi duyệt lại.</div>' : '');
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:10px 12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">' +
        '<div style="font-weight:700;font-size:13px">' + esc(t.title) + ' ' + (_MT_STATUS[t.status] || '') + '</div>' +
        '<div style="display:flex;gap:4px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">' + acts + '</div>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text);white-space:pre-wrap;margin-bottom:6px">' + esc(t.content) + '</div>' +
      (lines.length > 1 ? '<div class="mt-lines" data-lbox="' + esc(t.id) + '" style="display:none;margin:0 0 8px;border-top:1px dashed var(--border);padding-top:4px">' + lines.map(function (ln, k) {
        return '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid var(--border)"><span style="flex:1;min-width:0;font-size:12px;white-space:pre-wrap;word-break:break-word">' + esc(ln) + '</span>' +
          '<button class="btn sm" style="flex:none" onclick="copyMsgLine(this,\'' + esc(t.id) + '\',' + k + ')" title="Copy đoạn này (1 tin nhắn)">📋 Copy đoạn</button></div>';
      }).join('') + '</div>' : '') +
      '<div class="zi-row">' + _tplChips(t) + '</div>' + meta +
    '</div>';
  }).join('');
}

function openMsgTemplateForm(id) {
  var wrap = document.getElementById('mt-form-wrap');
  var t = id ? _msgTemplates.find(function (x) { return x.id === id; }) : null;
  document.getElementById('mt-f-id').value = t ? t.id : '';
  document.getElementById('mt-f-title').value = t ? t.title : '';
  document.getElementById('mt-f-product').value = t ? (t.product || '') : '';
  _tplFillGroupSelects();
  document.getElementById('mt-f-group').value = (t && t.nhom && !t.nhomAuto) ? t.nhom : '';   // nhom tu phan loai KHONG dien san: de trong = tiep tuc tu phan loai
  document.getElementById('mt-f-topic').value = t ? (t.topic || '') : '';
  document.getElementById('mt-f-tags').value = t ? t.tags : '';
  document.getElementById('mt-f-content').value = t ? t.content : '';
  _tplUpdateBadge();
  wrap.style.display = 'block';
  document.getElementById('mt-f-title').focus();
}

function closeMsgTemplateForm() {
  document.getElementById('mt-form-wrap').style.display = 'none';
}

async function saveMsgTemplateUI() {
  var title = (document.getElementById('mt-f-title').value || '').trim();
  var content = (document.getElementById('mt-f-content').value || '').trim();
  var tags = (document.getElementById('mt-f-tags').value || '').trim();
  var product = (document.getElementById('mt-f-product').value || '').trim();
  var topic = (document.getElementById('mt-f-topic').value || '').trim();
  var nhom = (document.getElementById('mt-f-group').value || '').trim();   // '' = de he thong tu phan loai
  var id = (document.getElementById('mt-f-id').value || '').trim();
  if (!title || !content) { alert('Vui lòng nhập tiêu đề và nội dung mẫu.'); return; }
  var btn = document.getElementById('mt-f-save-btn');
  btn.disabled = true; btn.textContent = 'Đang lưu...';
  var d = null;
  try {
    var body = { action: 'saveMessageTemplate', template: {
      id: id || undefined, title: title, content: content, tags: tags, product: product, topic: topic, nhom: nhom,
      createdBy: (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || ''
    } };
    var r = await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify(body) });
    d = await r.json();
    if (d && d.error) { alert('Lỗi: ' + d.error); return; }
  } catch (e) { alert('Lỗi kết nối, thử lại.'); return; }
  finally { btn.disabled = false; btn.textContent = 'Lưu mẫu'; }
  closeMsgTemplateForm();
  if (d && d.status === 'pending') toast('✓ Đã gửi mẫu — chờ quản lý duyệt mới dùng được');
  else toast('✓ Đã lưu mẫu');
  loadMsgTemplates();
}

async function approveMsgTemplateUI(id, decision) {
  var reason = '';
  if (decision === 'reject') {
    reason = prompt('Lý do từ chối (nhân viên sẽ thấy để sửa lại):', '');
    if (reason === null) return;
  }
  try {
    var r = await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'approveMessageTemplate', id: id, decision: decision, reason: reason }) });
    var d = await r.json();
    if (d && d.error) { alert('Lỗi: ' + d.error); return; }
  } catch (e) { alert('Lỗi kết nối, thử lại.'); return; }
  toast(decision === 'approve' ? '✓ Đã duyệt — nhân viên dùng được ngay' : '✓ Đã từ chối mẫu');
  loadMsgTemplates();
}

async function deleteMsgTemplateUI(id) {
  if (!confirm('Xóa mẫu tin nhắn này?')) return;
  try {
    var r = await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'deleteMessageTemplate', id: id, createdBy: (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '' }) });
    var d = await r.json();
    if (d && d.error) { alert('Lỗi: ' + d.error); return; }
  } catch (e) { alert('Lỗi kết nối, thử lại.'); return; }
  loadMsgTemplates();
}

// Tach mau thanh tung DOAN: moi dong (xuong dong) = 1 tin nhan rieng. Bo dong trong, cat khoang trang 2 dau (giong Pancake AI: tplLines_).
function _tplLines(content) { return String(content || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
function mtToggleLines(id) {
  var boxes = document.querySelectorAll('#mt-list .mt-lines');
  for (var i = 0; i < boxes.length; i++) if (boxes[i].getAttribute('data-lbox') === id) boxes[i].style.display = boxes[i].style.display === 'none' ? '' : 'none';
}
function copyMsgLine(btn, id, k) {
  var t = _msgTemplates.find(function (x) { return x.id === id; });
  var ln = t ? _tplLines(t.content)[k] : '';
  if (ln) _tplCopyText(ln, btn);
}
function copyMsgTemplate(id) {
  var t = _msgTemplates.find(function (x) { return x.id === id; });
  if (!t) return;
  var btn = null;
  document.querySelectorAll('#mt-list button').forEach(function (b) { if (b.getAttribute('onclick') === "copyMsgTemplate('" + id + "')") btn = b; });
  _tplCopyText(t.content, btn);
}

function zaiTone(btn) {
  document.querySelectorAll('.zai-tone').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
}

function zaiToggleKey() {
  var el = document.getElementById('zai-apikey');
  if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

function zaiPhoneInput(val) {
  // auto-extract digits only
  var digits = val.replace(/\D/g,'');
  if (digits !== val) document.getElementById('zai-phone').value = digits;
}

function zaiLookup() {
  var raw = (document.getElementById('zai-phone').value || '').trim();
  if (!raw) { zaiShowError('Vui lòng nhập số điện thoại.'); return; }
  zaiHideError();

  // Normalize phone - use app's normPhone if available
  var phone = typeof normPhone === 'function' ? normPhone(raw) : raw.replace(/\D/g,'');

  var infoEl = document.getElementById('zai-info');
  infoEl.style.display = 'none';

  // Look up in loaded data
  var cust = (typeof customerMap !== 'undefined') ? customerMap[phone] : null;
  var care = (typeof careData !== 'undefined') ? careData[phone] : null;

  if (!cust && !care) {
    infoEl.style.display = 'block';
    infoEl.innerHTML = '<span style="color:var(--muted)">Không tìm thấy khách <strong>' + raw + '</strong> trong dữ liệu đã tải. Hãy Sync GS hoặc tải Excel trước.</span>';
    return;
  }

  var orders = cust ? (cust.orders || []) : [];
  var name = cust ? cust.name : (care && care.phone ? care.phone : raw);
  var totalOrders = orders.length;
  var totalRev = orders.reduce(function(s, o){ return s + (parseFloat(o.revenue) || 0); }, 0);
  var products = cust ? Array.from(cust.brands || []).join(', ') : '';
  var careStatus = care ? (care.status || '') : '';
  var careNote = care ? (care.note || '') : '';
  var csName = care ? (care.cs || '') : (cust ? (orders[0] && orders[0].cs || '') : '');

  var lastOrders = orders.slice().sort(function(a,b){ return (b.date||0)-(a.date||0); }).slice(0,3);
  var lastStr = lastOrders.map(function(o){
    var d = o.date ? (o.date instanceof Date ? o.date.toLocaleDateString('vi-VN') : o.date) : '?';
    return d + ' — ' + (o.product || o.productDetail || '?') + ' (' + (o.revenue ? Number(o.revenue).toLocaleString('vi-VN') + 'đ' : '?') + ')';
  }).join('<br>');

  infoEl.style.display = 'block';
  infoEl.innerHTML =
    '<div class="zi-name">' + name + ' &nbsp;<span style="font-size:11px;font-weight:400;color:var(--muted)">' + raw + '</span></div>' +
    '<div class="zi-row" style="margin-bottom:6px">' +
      (totalOrders ? '<span class="zi-chip">📦 ' + totalOrders + ' đơn</span>' : '') +
      (totalRev ? '<span class="zi-chip">💰 ' + Math.round(totalRev/1000) + 'K</span>' : '') +
      (products ? '<span class="zi-chip">🏷 ' + products + '</span>' : '') +
      (careStatus ? '<span class="zi-chip">📋 ' + careStatus + '</span>' : '') +
      (csName ? '<span class="zi-chip">👤 CS: ' + csName + '</span>' : '') +
    '</div>' +
    (careNote ? '<div style="font-size:11px;color:var(--muted);margin-bottom:4px">📝 Ghi chú: ' + careNote + '</div>' : '') +
    (lastStr ? '<div style="font-size:11px;color:var(--muted)"><strong>Đơn gần nhất:</strong><br>' + lastStr + '</div>' : '');

  // Store context for AI
  window._zaiContext = { name, phone, totalOrders, totalRev, products, careStatus, careNote, lastOrders };
}

async function zaiGenerate() {
  var apiKey = (document.getElementById('zai-apikey').value || '').trim();
  if (!apiKey) { zaiShowError('Vui lòng nhập Gemini API Key. Lấy miễn phí tại aistudio.google.com'); return; }

  var msg = (document.getElementById('zai-msg').value || '').trim();
  if (!msg) { zaiShowError('Vui lòng dán tin nhắn của khách vào ô bên trên.'); return; }

  var tone = (document.querySelector('.zai-tone.active') || {}).dataset && document.querySelector('.zai-tone.active').dataset.tone || 'Chuyên nghiệp';
  var ctx = (document.getElementById('zai-ctx').value || '').trim();
  var btn = document.getElementById('zai-gen-btn');
  var sugEl = document.getElementById('zai-suggestions');
  var listEl = document.getElementById('zai-sug-list');

  zaiHideError();
  btn.disabled = true;
  btn.textContent = 'Đang tạo...';
  sugEl.style.display = 'block';
  listEl.innerHTML = '<div class="zai-loading"><div class="zai-spinner"></div>AI đang soạn gợi ý...</div>';

  // Build context from customer data
  var custCtxLines = [];
  var c = window._zaiContext;
  if (c) {
    custCtxLines.push('Tên khách: ' + c.name);
    custCtxLines.push('Số đơn đã mua: ' + c.totalOrders);
    if (c.products) custCtxLines.push('Sản phẩm đã mua: ' + c.products);
    if (c.careStatus) custCtxLines.push('Tình trạng chăm sóc: ' + c.careStatus);
    if (c.careNote) custCtxLines.push('Ghi chú CS: ' + c.careNote);
    if (c.lastOrders && c.lastOrders.length) {
      custCtxLines.push('Đơn gần nhất: ' + c.lastOrders.slice(0,2).map(function(o){
        return (o.product || '') + (o.revenue ? ' (' + Number(o.revenue).toLocaleString('vi-VN') + 'đ)' : '');
      }).join(', '));
    }
  }
  if (ctx) custCtxLines.push('Ngữ cảnh bổ sung: ' + ctx);

  var prompt = 'Bạn là nhân viên chăm sóc khách hàng chuyên nghiệp của shop bán lẻ Việt Nam.\n' +
    (custCtxLines.length ? 'Thông tin khách hàng:\n' + custCtxLines.join('\n') + '\n\n' : '') +
    'Tin nhắn khách gửi: "' + msg + '"\n\n' +
    'Hãy viết 3 phiên bản phản hồi cho khách, giọng văn ' + tone.toLowerCase() + ', bằng tiếng Việt tự nhiên. ' +
    'Mỗi phiên bản trên 1 dòng riêng, bắt đầu bằng "1.", "2.", "3.". Không giải thích thêm.';

  try {
    var res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 800 }
        })
      }
    );
    if (!res.ok) {
      var err = await res.json().catch(function(){ return {}; });
      throw new Error((err.error && err.error.message) || 'HTTP ' + res.status);
    }
    var data = await res.json();
    var text = data.candidates && data.candidates[0] && data.candidates[0].content &&
               data.candidates[0].content.parts && data.candidates[0].content.parts[0].text || '';

    // Parse suggestions
    var sugs = text.split(/\n(?=\d+\.)/).map(function(s){ return s.replace(/^\d+\.\s*/, '').trim(); }).filter(Boolean);
    if (!sugs.length) sugs = [text.trim()];

    listEl.innerHTML = sugs.map(function(s, i){
      return '<div class="zai-sug" onclick="zaiCopySug(this)">' +
        '<button class="zai-sug-copy" onclick="event.stopPropagation();zaiCopySug(this.parentNode)">Copy</button>' +
        s.replace(/\n/g, '<br>') +
        '</div>';
    }).join('');

  } catch(e) {
    zaiShowError('Lỗi Gemini API: ' + e.message + '. Kiểm tra API key hoặc kết nối mạng.');
    sugEl.style.display = 'none';
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Tạo gợi ý AI';
  }
}

function zaiCopySug(el) {
  var text = el.innerText.replace(/^Copy\n?/, '').trim();
  navigator.clipboard.writeText(text).then(function(){
    var orig = el.style.borderColor;
    el.style.borderColor = 'var(--green)';
    setTimeout(function(){ el.style.borderColor = orig; }, 800);
    if (typeof toast === 'function') toast('✓ Đã copy — dán vào Zalo!');
  });
}

function zaiShowError(msg) {
  var el = document.getElementById('zai-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function zaiHideError() {
  var el = document.getElementById('zai-error');
  if (el) el.style.display = 'none';
}

// ── URL param: ?phone=xxx auto-search ──
(function() {
  var params = new URLSearchParams(window.location.search);
  var phoneParam = params.get('phone');
  if (!phoneParam) return;
  function tryOpenPhone() {
    var inp = document.getElementById('search-input');
    if (!inp) { setTimeout(tryOpenPhone, 300); return; }
    inp.value = phoneParam;
    if (typeof debouncedApplyFilters === 'function') debouncedApplyFilters();
    else if (typeof applyFilters === 'function') applyFilters();
    // Try to open detail after short delay (data may still be loading)
    setTimeout(function() {
      var rows = document.querySelectorAll('[data-phone="' + phoneParam + '"]');
      if (rows.length) { rows[0].click(); return; }
      // Fallback: if allCustomers loaded, call openDetail directly
      if (typeof allCustomers !== 'undefined') {
        var c = allCustomers.find(function(x){ return x.phone === phoneParam; });
        if (c && typeof openDetail === 'function') openDetail(phoneParam, 'hist');
      }
    }, 1500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(tryOpenPhone, 500); });
  } else {
    setTimeout(tryOpenPhone, 500);
  }
})();


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
    if (tab === 'zaloai') { loadMsgTemplates(); loadAiExamples(); }
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
async function loadMsgTemplates() {
  var listEl = document.getElementById('mt-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="font-size:12px;color:var(--muted)">Đang tải mẫu...</div>';
  try {
    var sep = gsUrl.indexOf('?') >= 0 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=messageTemplates', { redirect: 'follow' });
    var d = await r.json();
    _msgTemplates = (d && d.templates) || [];
  } catch (e) {
    listEl.innerHTML = '<div style="font-size:12px;color:#dc2626">Lỗi tải thư viện mẫu, thử lại.</div>';
    return;
  }
  renderMsgTemplateList();
}

function renderMsgTemplateList() {
  var listEl = document.getElementById('mt-list');
  if (!listEl) return;
  var q = (document.getElementById('mt-search').value || '').trim().toLowerCase();
  var items = _msgTemplates.filter(function (t) {
    if (!q) return true;
    return (t.title || '').toLowerCase().indexOf(q) >= 0 ||
      (t.content || '').toLowerCase().indexOf(q) >= 0 ||
      (t.tags || '').toLowerCase().indexOf(q) >= 0;
  });
  if (!items.length) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--muted)">' + (_msgTemplates.length ? 'Không tìm thấy mẫu phù hợp.' : 'Chưa có mẫu nào — bấm "+ Thêm mẫu" để tạo mẫu đầu tiên.') + '</div>';
    return;
  }
  listEl.innerHTML = items.map(function (t) {
    var tagsHtml = (t.tags || '').split(',').map(function (tg) { tg = tg.trim(); return tg ? '<span class="zi-chip">#' + esc(tg) + '</span>' : ''; }).join('');
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:10px 12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">' +
        '<div style="font-weight:700;font-size:13px">' + esc(t.title) + '</div>' +
        '<div style="display:flex;gap:4px;flex-shrink:0">' +
          '<button class="btn sm" onclick="copyMsgTemplate(\'' + t.id + '\')" title="Copy nội dung">📋 Copy</button>' +
          '<button class="btn sm" onclick="openMsgTemplateForm(\'' + t.id + '\')" title="Sửa">✏️</button>' +
          '<button class="btn sm" onclick="deleteMsgTemplateUI(\'' + t.id + '\')" title="Xóa">🗑</button>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text);white-space:pre-wrap;margin-bottom:6px">' + esc(t.content) + '</div>' +
      (tagsHtml ? '<div class="zi-row">' + tagsHtml + '</div>' : '') +
    '</div>';
  }).join('');
}

function openMsgTemplateForm(id) {
  var wrap = document.getElementById('mt-form-wrap');
  var t = id ? _msgTemplates.find(function (x) { return x.id === id; }) : null;
  document.getElementById('mt-f-id').value = t ? t.id : '';
  document.getElementById('mt-f-title').value = t ? t.title : '';
  document.getElementById('mt-f-tags').value = t ? t.tags : '';
  document.getElementById('mt-f-content').value = t ? t.content : '';
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
  var id = (document.getElementById('mt-f-id').value || '').trim();
  if (!title || !content) { alert('Vui lòng nhập tiêu đề và nội dung mẫu.'); return; }
  var btn = document.getElementById('mt-f-save-btn');
  btn.disabled = true; btn.textContent = 'Đang lưu...';
  try {
    var body = { action: 'saveMessageTemplate', template: {
      id: id || undefined, title: title, content: content, tags: tags,
      createdBy: (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || ''
    } };
    var r = await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify(body) });
    var d = await r.json();
    if (d && d.error) { alert('Lỗi: ' + d.error); return; }
  } catch (e) { alert('Lỗi kết nối, thử lại.'); return; }
  finally { btn.disabled = false; btn.textContent = 'Lưu mẫu'; }
  closeMsgTemplateForm();
  loadMsgTemplates();
}

async function deleteMsgTemplateUI(id) {
  if (!confirm('Xóa mẫu tin nhắn này?')) return;
  try {
    var r = await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'deleteMessageTemplate', id: id }) });
    var d = await r.json();
    if (d && d.error) { alert('Lỗi: ' + d.error); return; }
  } catch (e) { alert('Lỗi kết nối, thử lại.'); return; }
  loadMsgTemplates();
}

function copyMsgTemplate(id) {
  var t = _msgTemplates.find(function (x) { return x.id === id; });
  if (!t) return;
  navigator.clipboard.writeText(t.content).then(function () {
    var btns = document.querySelectorAll('#mt-list button');
    // phan hoi nhanh bang cach doi tam text nut vua bam (tim theo id trong onclick)
    btns.forEach(function (b) {
      if (b.getAttribute('onclick') === "copyMsgTemplate('" + id + "')") {
        var old = b.textContent; b.textContent = '✅ Đã copy';
        setTimeout(function () { b.textContent = old; }, 1200);
      }
    });
  }).catch(function () { alert('Không copy được, vui lòng copy thủ công.'); });
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

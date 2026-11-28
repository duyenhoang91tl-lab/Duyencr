// ════════════════════════════════════════════════════════════════════
//  ĐƠN CÁC KÊNH — bước B2/8: tab "📦 Đơn các kênh" = bảng đơn theo giai đoạn kiểu Base "ĐƠN CÁC KÊNH 2025-2026".
//  Bên TRÁI: danh sách kênh (có số đơn). Bên PHẢI: các cột giai đoạn (Tiếp nhận đơn → … → Hoàn thành | Thất bại), thẻ đơn kéo-thả (hoặc chọn "Chuyển ▾" trên điện thoại).
//  Backend: GAS khối 36_CrmStage (gas_v13.js): GET kenhBoard, POST kenhMove. Đơn nằm sheet RIÊNG "Đơn Kênh" (không đụng Đơn CRM/kho/điểm). Server quyết quyền xem/chuyển.
//  FILE NÀY CÒN LÀ NỀN DÙNG CHUNG cho B3–B6 (nạp trước chúng): _knTok, _knEsc, _knVnd, _knGet, _knPost, _knModal/_knModalClose, _knAgo, _knDmyHm, _knStageColor.
//  Điểm nối sang các bước sau (có hàm thì gọi, chưa có thì báo "sẽ có ở bước…"): _knOpenCreate() (B3), _knOpenDetail(id) (B4). Sau khi B3/B4 đổi dữ liệu gọi _knLoad() để bảng tải lại.
//  Nạp SAU js/40 (registerExtraTab). Gỡ = xoá dòng <script> trong index.html + id 'kenhboard' trong js/29. Test: tools/test-kenh-board-ui.js
// ════════════════════════════════════════════════════════════════════
var _KN_STAGE_COLOR = { 'Tiếp nhận đơn':'#2563eb', 'Tạo đơn POS':'#0d9488', 'Phân loại đơn':'#7c3aed', 'Phòng sản xuất':'#ea580c', 'Kho thành phẩm':'#ca8a04', 'Đóng hàng':'#0284c7', 'Hoàn thành':'#16a34a', 'Thất bại':'#dc2626' };
var _kn = { from:'', to:'', q:'', kenh:'', data:null, loading:false, err:'', seq:0, msg:'', busy:false, dragId:'' };
function _knTok(){ try { return localStorage.getItem('ome_sess_token') || ''; } catch(e){ return ''; } }
function _knEsc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
function _knPad(n){ return (n < 10 ? '0' : '') + n; }
function _knYmd(d){ return d.getFullYear() + '-' + _knPad(d.getMonth() + 1) + '-' + _knPad(d.getDate()); }
function _knToday(){ return _knYmd(new Date()); }
function _knAddDays(ymd, n){ var m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return ymd; return _knYmd(new Date(+m[1], +m[2] - 1, +m[3] + n)); }
function _knVnd(n){ n = Math.round(Number(n) || 0); return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
function _knDmyHm(ts){ var n = Number(ts); if (!n) return ''; var d = new Date(n); if (isNaN(d.getTime())) return ''; return _knPad(d.getDate()) + '/' + _knPad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + _knPad(d.getHours()) + ':' + _knPad(d.getMinutes()); }
function _knFold(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim(); }
function _knStageColor(s){ return _KN_STAGE_COLOR[s] || '#64748b'; }
// "đã ở giai đoạn này bao lâu": < 1 giờ → phút; < 48 giờ → giờ; còn lại → ngày.
function _knAgo(ms, now){ var d = (now || Date.now()) - Number(ms || 0); if (!(Number(ms) > 0) || d < 0) return ''; var m = Math.floor(d / 60000); if (m < 60) return Math.max(1, m) + ' phút'; var h = Math.floor(m / 60); if (h < 48) return h + ' giờ'; return Math.floor(h / 24) + ' ngày'; }
function _knUrl(action, params){
  if (typeof gsUrl === 'undefined' || !gsUrl) throw new Error('Chưa cấu hình địa chỉ GAS.');
  var u = gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=' + encodeURIComponent(action) + '&token=' + encodeURIComponent(_knTok());
  Object.keys(params || {}).forEach(function(k){ var v = params[k]; if (v !== undefined && v !== null && v !== '') u += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v); });
  return u;
}
async function _knGet(action, params){ var r = await fetch(_knUrl(action, params), { redirect:'follow' }); return await r.json(); }
async function _knPost(action, body){
  if (typeof gsUrl === 'undefined' || !gsUrl) throw new Error('Chưa cấu hình địa chỉ GAS.');
  var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify(Object.assign({ action: action, token: _knTok() }, body || {})) });
  return await r.json();
}
function _knToast(m){ try { if (typeof toast === 'function') toast(m); } catch(e){} }
// Hộp thoại dùng chung (B3–B6 dùng lại): 1 lớp phủ #kn-modal; _knModal(html, {wide}) mở/ thay nội dung, _knModalClose() đóng.
function _knModal(html, opt){
  var o = document.getElementById('kn-modal');
  if (!o){ o = document.createElement('div'); o.id = 'kn-modal'; o.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(15,23,42,.45);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px'; o.onclick = function(e){ if (e.target === o) _knModalClose(); }; document.body.appendChild(o); }
  o.innerHTML = '<div style="background:var(--surface,#fff);color:var(--text);border-radius:12px;width:100%;max-width:' + ((opt && opt.wide) || 560) + 'px;box-shadow:0 10px 40px rgba(0,0,0,.3);position:relative">' + html + '</div>';
  return o;
}
function _knModalClose(){ var o = document.getElementById('kn-modal'); if (o && o.parentNode) o.parentNode.removeChild(o); }

function _knCards(){ return (_kn.data && _kn.data.orders) || []; }
function _knStageCounts(){ var c = {}; (_kn.data ? _kn.data.stages : []).forEach(function(s){ c[s] = 0; }); _knCards().forEach(function(o){ c[o.stage] = (c[o.stage] || 0) + 1; }); return c; }
function _knSideHtml(){
  var d = _kn.data, ch = (d && d.channels) || [], total = 0; ch.forEach(function(c){ total += c.count; });
  var item = function(name, label, count){
    var on = (_kn.kenh === name);
    return '<div class="kn-ch" onclick="_knPickKenh(' + _knEsc(JSON.stringify(name)) + ')" style="cursor:pointer;display:flex;justify-content:space-between;gap:6px;padding:7px 10px;border-radius:8px;font-size:13px;' + (on ? 'background:var(--accent,#2563eb);color:#fff;font-weight:700' : 'color:var(--text)') + '"><span style="word-break:break-word">' + _knEsc(label) + '</span><span style="opacity:.8">' + count + '</span></div>';
  };
  return '<div style="font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--muted);margin:2px 10px 6px">CÁC KÊNH</div>' + item('', '📦 Tất cả kênh', total) +
    (ch.map(function(c){ return item(c.name, c.name, c.count); }).join('') || '<div style="padding:8px 10px;font-size:12px;color:var(--muted)">Chưa có kênh nào — tạo đơn đầu tiên để kênh xuất hiện.</div>');
}
function _knCardHtml(o, stages){
  var mine = '<select onclick="event.stopPropagation()" onchange="_knMoveFromSelect(this,\'' + _knEsc(o.id) + '\')" style="font-size:11px;max-width:100%;margin-top:4px"><option value="">Chuyển ▾</option>' +
    stages.filter(function(s){ return s !== o.stage; }).map(function(s){ return '<option value="' + _knEsc(s) + '">→ ' + _knEsc(s) + '</option>'; }).join('') + '</select>';
  var ago = _knAgo(o.stageAt);
  return '<div class="kn-card" draggable="true" ondragstart="_knDragStart(event,\'' + _knEsc(o.id) + '\')" onclick="_knOpen(\'' + _knEsc(o.id) + '\')" style="cursor:pointer;background:var(--surface,#fff);border:1px solid var(--border);border-left:4px solid ' + _knStageColor(o.stage) + ';border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:12px;line-height:1.45">' +
    '<div style="font-weight:700;font-size:13px">' + _knEsc(o.phone) + (o.custName ? ' <span style="font-weight:500;color:var(--muted)">· ' + _knEsc(o.custName) + '</span>' : '') + '</div>' +
    '<div style="color:var(--muted)">Bộ đếm: <b style="color:var(--text)">' + _knEsc(o.maBoDem) + '</b> · #' + _knEsc(o.id) + '</div>' +
    '<div style="word-break:break-word;margin:2px 0">' + _knEsc(o.product) + '</div>' +
    '<div>👤 ' + _knEsc(o.saleName) + ' · 🛒 ' + _knEsc(o.kenh) + '</div>' +
    '<div><b>' + _knVnd(o.total) + '</b> · ' + _knEsc(o.phanLoai) + (Number(o.deposit) ? ' · CK ' + _knVnd(o.deposit) : '') + '</div>' +
    '<div style="display:flex;gap:8px;color:var(--muted);flex-wrap:wrap;margin-top:2px">' + (ago ? '<span>⏱ ' + _knEsc(ago) + '</span>' : '') +
      (o.taskTotal ? '<span style="' + (o.taskOpen ? 'color:#b45309;font-weight:700' : '') + '">☑ ' + (o.taskTotal - o.taskOpen) + '/' + o.taskTotal + (o.taskOpen ? ' việc chưa xong' : '') + '</span>' : '') +
      (o.commentCount ? '<span>💬 ' + o.commentCount + '</span>' : '') + '</div>' + mine + '</div>';
}
function _knColsHtml(){
  var d = _kn.data; if (!d) return '';
  var cnt = _knStageCounts(), cards = _knCards();
  return d.stages.map(function(s){
    var items = cards.filter(function(o){ return o.stage === s; });
    return '<div class="kn-col" ondragover="event.preventDefault()" ondrop="_knDrop(event,\'' + _knEsc(s) + '\')" style="flex:0 0 255px;max-width:255px;background:var(--surface2,#f3f4f6);border-radius:10px;padding:8px;min-height:120px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:700;font-size:13px;border-bottom:3px solid ' + _knStageColor(s) + ';padding-bottom:5px"><span>' + _knEsc(s) + '</span><span style="font-weight:600;color:var(--muted)">' + (cnt[s] || 0) + '</span></div>' +
      (items.map(function(o){ return _knCardHtml(o, d.stages); }).join('') || '<div style="color:var(--muted);font-size:12px;padding:6px">Chưa có đơn</div>') + '</div>';
  }).join('');
}
function _knRender(){
  var w = document.getElementById('xt-wrap-kenhboard'); if (!w) return;
  var btn = function(label, k){ return '<button class="btn sm" onclick="_knSetRange(\'' + k + '\')">' + label + '</button>'; };
  w.innerHTML = '<div style="padding:14px 18px"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:4px"><div style="font-size:18px;font-weight:700">📦 ĐƠN CÁC KÊNH</div>' +
    '<button class="btn" onclick="_knOpenCreateSafe()" style="font-weight:700">＋ Tạo nhiệm vụ</button></div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Kéo thẻ sang cột khác (hoặc chọn "Chuyển ▾") để đổi giai đoạn. Bấm thẻ để xem chi tiết.' + (_kn.data ? ' Quyền xem: ' + _knEsc(_kn.data.scope === 'all' ? 'tất cả đơn' : _kn.data.scope === 'dept' ? 'đơn phòng bạn quản lý' : _kn.data.scope === 'team' ? 'đơn team bạn làm trưởng' : 'đơn của bạn / đơn bạn được giao việc, theo dõi') + '.' : '') + '</div>' +
    '<div class="ml-bar" style="margin-bottom:8px"><span style="font-size:12px;color:var(--muted)">Ngày tạo từ</span><input type="date" class="ml-q" style="max-width:150px;flex:none" value="' + _knEsc(_kn.from) + '" onchange="_knSetDate(\'from\',this.value)">' +
    '<span style="font-size:12px;color:var(--muted)">đến</span><input type="date" class="ml-q" style="max-width:150px;flex:none" value="' + _knEsc(_kn.to) + '" onchange="_knSetDate(\'to\',this.value)">' +
    btn('Hôm nay', 'today') + btn('7 ngày', '7d') + btn('Tháng này', 'month') + btn('Tất cả', 'all') + '<button class="btn sm" onclick="_knLoad()">↻ Làm mới</button></div>' +
    '<div class="ml-bar" style="margin-bottom:8px"><input id="kn-q" class="ml-q" placeholder="🔍 Tìm SĐT, tên khách, mã bộ đếm, sản phẩm, sale…" value="' + _knEsc(_kn.q) + '" onkeydown="if(event.key===\'Enter\')_knLoad()" onchange="_kn.q=this.value;_knLoad()"></div>' +
    (_kn.msg ? '<div style="padding:8px 10px;border-radius:8px;background:var(--surface2,#f3f4f6);font-size:12px;margin-bottom:8px">' + _knEsc(_kn.msg) + '</div>' : '') +
    (_kn.err ? '<div style="padding:10px;background:#fef2f2;color:#b91c1c;border-radius:8px;margin-bottom:10px">' + _knEsc(_kn.err) + '</div>' : '') +
    (_kn.loading && !_kn.data ? '<div style="padding:20px;color:var(--muted)">⏳ Đang tải…</div>' :
      '<div style="display:flex;gap:12px;align-items:flex-start"><div style="flex:0 0 210px;max-width:210px;background:var(--surface2,#f3f4f6);border-radius:10px;padding:8px 6px;position:sticky;top:0">' + _knSideHtml() + '</div>' +
      '<div style="display:flex;gap:10px;overflow-x:auto;align-items:flex-start;padding-bottom:10px;flex:1;min-width:0">' + _knColsHtml() + '</div></div>') +
    (_kn.data && _kn.data.truncated ? '<div style="font-size:11px;color:var(--muted);margin-top:6px">Chỉ hiện ' + _knCards().length + ' đơn mới nhất — hãy lọc theo ngày/kênh để xem hết.</div>' : '') + '</div>';
}
function _knSetDate(k, v){ _kn[k] = String(v || ''); _knLoad(); }
function _knSetRange(k){
  var t = _knToday();
  if (k === 'today'){ _kn.from = t; _kn.to = t; } else if (k === '7d'){ _kn.from = _knAddDays(t, -6); _kn.to = t; } else if (k === 'month'){ _kn.from = t.slice(0, 8) + '01'; _kn.to = t; } else { _kn.from = ''; _kn.to = ''; }
  _knLoad();
}
function _knPickKenh(name){ _kn.kenh = String(name || ''); _knLoad(); }
async function _knLoad(){
  var my = ++_kn.seq; _kn.loading = true; _kn.err = ''; _knRender();
  try {
    var d = await _knGet('kenhBoard', { from:_kn.from, to:_kn.to, kenh:_kn.kenh, q:_kn.q });
    if (my !== _kn.seq) return;   // đã có lần tải mới hơn → bỏ kết quả cũ
    if (d && d.ok) _kn.data = d; else _kn.err = (d && (d.error || d.message)) || 'GAS chưa có action kenhBoard (workflow deploy-gas chưa chạy xong?).';
  } catch(e){ if (my !== _kn.seq) return; _kn.err = 'Lỗi kết nối: ' + (e && e.message || e); }
  _kn.loading = false; _knRender();
}
function _knOpen(id){ if (typeof _knOpenDetail === 'function') _knOpenDetail(id); else _knToast('Trang chi tiết đơn sẽ có ở bước B4.'); }
function _knOpenCreateSafe(){ if (typeof _knOpenCreate === 'function') _knOpenCreate(); else _knToast('Form tạo nhiệm vụ sẽ có ở bước B3.'); }
// ── chuyển giai đoạn ──
function _knDragStart(ev, id){ _kn.dragId = String(id); try { ev.dataTransfer.setData('text/plain', String(id)); ev.dataTransfer.effectAllowed = 'move'; } catch(e){} }
function _knDrop(ev, stage){ if (ev && ev.preventDefault) ev.preventDefault(); var id = _kn.dragId; try { id = id || ev.dataTransfer.getData('text/plain'); } catch(e){} _kn.dragId = ''; if (id) _knMove(id, stage); }
function _knMoveFromSelect(sel, id){ var to = sel.value; sel.value = ''; if (to) _knMove(id, to); }
function _knMove(id, stage){
  var o = _knCards().filter(function(x){ return x.id === String(id); })[0]; if (!o || o.stage === stage || _kn.busy) return;
  if (stage === 'Thất bại'){ _knAskFail(o); return; }
  _knDoMove(o.id, stage, '');
}
function _knAskFail(o){
  _knModal('<div style="padding:16px 18px"><div style="font-weight:700;font-size:15px;margin-bottom:6px">Chuyển đơn ' + _knEsc(o.phone) + ' sang "Thất bại"</div><div style="font-size:12px;color:var(--muted);margin-bottom:8px">Bắt buộc ghi lý do để tra cứu về sau.</div>' +
    '<textarea id="kn-fail" rows="3" style="width:100%;box-sizing:border-box" placeholder="Lý do thất bại…"></textarea><div id="kn-fail-err" style="color:#b91c1c;font-size:12px;min-height:16px"></div>' +
    '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px"><button class="btn" onclick="_knModalClose()">Bỏ qua</button><button class="btn" style="background:#dc2626;color:#fff" onclick="_knConfirmFail(\'' + _knEsc(o.id) + '\')">Chuyển sang Thất bại</button></div></div>');
  var t = document.getElementById('kn-fail'); if (t && t.focus) t.focus();
}
function _knConfirmFail(id){
  var t = document.getElementById('kn-fail'), note = String(t && t.value || '').trim();
  if (!note){ var e = document.getElementById('kn-fail-err'); if (e) e.textContent = '⚠ Phải ghi lý do thất bại.'; return; }
  _knModalClose(); _knDoMove(id, 'Thất bại', note);
}
async function _knDoMove(id, stage, note){
  _kn.busy = true; _kn.msg = '';
  try {
    var d = await _knPost('kenhMove', { id:id, stage:stage, note:note });
    if (d && d.ok && d.order){
      var l = _knCards(); for (var k = 0; k < l.length; k++) if (l[k].id === String(id)){ l[k].stage = d.order.stage; l[k].stageAt = d.order.stageAt; break; }
      if (_kn.data) _kn.data.stageCount = _knStageCounts();
      _kn.msg = d.unchanged ? 'Đơn đã ở giai đoạn "' + stage + '" rồi.' : '✓ Đã chuyển sang "' + stage + '".';
    } else _kn.msg = '❌ ' + ((d && (d.error || d.message)) || 'Không chuyển được giai đoạn (GAS chưa deploy kenhMove?).');
  } catch(e){ _kn.msg = '❌ Lỗi kết nối: ' + (e && e.message || e); }
  _kn.busy = false; _knRender();
}
registerExtraTab('kenhboard', '📦 Đơn các kênh', function(){ if (!_kn.from && !_kn.to) { _kn.from = _knAddDays(_knToday(), -29); _kn.to = _knToday(); } if (_kn.data) _knRender(); _knLoad(); });

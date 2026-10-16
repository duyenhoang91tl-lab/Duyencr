// ════════════════════════════════════════════════════════════════════
//  B5 — BẢNG KANBAN ĐƠN THEO GIAI ĐOẠN BASE (docs/ROADMAP-CRM-MAU.md; Duyên chốt Q1 = giai đoạn đơn Base).
//  Dữ liệu: GAS action=stageBoard (gas/23_TodayTasks.gs: ttStageBoard_). CHỈ ĐỌC — giai đoạn do Base quyết định nên không kéo thả.
//  Cột = Tiếp nhận đơn → Tạo đơn POS → Phân loại đơn → Phòng sản xuất → Kho thành phẩm → Đóng hàng (7 ngày gần nhất) (+ cột lạ nếu có).
//  Thẻ đỏ = đơn kẹt quá ngưỡng giờ (trang ⚙ Cấu hình). CS chỉ thấy đơn của sale mình (currentUser.names), admin thấy hết.
// ════════════════════════════════════════════════════════════════════
var _sb = { stages:[], hours:24, at:0, q:'', onlyStuck:false, loading:false, err:'' };
async function _sbLoad(){
  if (typeof gsUrl === 'undefined' || !gsUrl) return;
  _sb.loading = true; _sbRender();
  var names = currentUser.role === 'admin' ? '' : ((currentUser.names && currentUser.names.length ? currentUser.names : [currentUser.name]).join('|'));
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=stageBoard&names=' + encodeURIComponent(names), { redirect:'follow' });
    var d = await r.json();
    if (d && d.stages){ _sb.stages = d.stages; _sb.hours = d.hours || 24; _sb.at = Date.now(); _sb.err = ''; }
    else _sb.err = (d && d.error) || 'GAS chưa có action stageBoard — cần deploy lại GAS (gas/23_TodayTasks.gs).';
  } catch(e){ _sb.err = 'Không tải được: ' + (e && e.message || e); }
  _sb.loading = false; _sbRender();
}
function _sbMatch(it){
  if (_sb.onlyStuck && !it.stuck) return false;
  var q = (_sb.q || '').toLowerCase(); if (!q) return true;
  return (it.id + ' ' + (it.maBoDem || '') + ' ' + it.sale + ' ' + it.giaoCho + ' ' + it.sanPham).toLowerCase().indexOf(q) !== -1;
}
// Ma hien thi cua don = MA BO DEM (cot U DT TONG, vd 196T10/2026 / BH196T10/2026); don chua co ma bo dem thi lui ve '#id' cua Base.
function _sbCode(it){ return it.maBoDem ? String(it.maBoDem) : ('#' + it.id); }
// Chip ma don: bam la SAO CHEP (stopPropagation de khong mo modal chi tiet). Ma nam trong data-code (da escape), khong dua vao chuoi JS.
function _sbCodeChip(it, big){
  return '<span class="sb-code" data-code="' + esc(_sbCode(it)) + '" title="Bấm để sao chép mã" onclick="event.stopPropagation();_sbCopy(this)" style="cursor:copy;font-weight:700;color:var(--text);background:var(--surface2,#f3f4f6);border:1px solid var(--border);border-radius:6px;padding:' + (big ? '2px 8px' : '0 6px') + ';display:inline-block">' + esc(_sbCode(it)) + ' 📋</span>';
}
function _sbCopy(el){
  var code = el && el.getAttribute('data-code'); if (!code) return;
  var failMsg = 'Không sao chép được — bôi đen mã rồi Ctrl+C';
  var done = function(){
    if (typeof toast === 'function') toast('✓ Đã sao chép ' + code);
    var old = el.getAttribute('data-html'); if (old === null) { old = el.innerHTML; el.setAttribute('data-html', old); }
    el.textContent = '✓ Đã chép'; setTimeout(function(){ el.innerHTML = old; }, 1100);
  };
  var fallback = function(){
    try { var t = document.createElement('textarea'); t.value = code; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); var ok = document.execCommand('copy'); t.remove(); if (ok) done(); else if (typeof toast === 'function') toast(failMsg); }
    catch(e){ if (typeof toast === 'function') toast(failMsg); }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, fallback); else fallback();
}
function _sbCard(it, si, ii){
  var h = it.hours, hTxt = h === null ? 'chưa theo dõi giờ' : (h >= 48 ? Math.floor(h / 24) + ' ngày ' + (h % 24) + ' giờ' : h + ' giờ');
  return '<div onclick="_sbOpen(' + si + ',' + ii + ')" style="cursor:pointer;background:var(--surface);border:1px solid ' + (it.stuck ? '#fca5a5' : 'var(--border)') + ';border-left:4px solid ' + (it.stuck ? '#dc2626' : 'var(--border)') + ';border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:12px;line-height:1.45">' +
    '<div style="font-weight:700;word-break:break-word">' + esc(it.sanPham || ('Đơn ' + _sbCode(it))) + '</div>' +
    '<div style="color:var(--muted)">' + _sbCodeChip(it, false) + (it.value ? ' · <b style="color:var(--text)">' + (it.value).toLocaleString('vi-VN') + ' đ</b>' : '') + '</div>' +
    (it.sale ? '<div>👤 ' + esc(it.sale) + '</div>' : '') + (it.giaoCho ? '<div>🛠 ' + esc(it.giaoCho) + '</div>' : '') +
    '<div style="margin-top:3px;color:' + (it.stuck ? '#b91c1c' : 'var(--muted)') + '">⏱ ' + esc(hTxt) + (it.stuck ? ' — quá ' + _sb.hours + ' giờ' : '') + '</div></div>';
}
function _sbRender(){
  var w = document.getElementById('xt-wrap-stageboard'); if (!w) return;
  var tot = 0, stuck = 0; _sb.stages.forEach(function(s){ tot += s.count; stuck += s.stuck; });
  var cols = _sb.stages.map(function(s, si){
    var items = s.items.map(function(it, ii){ return { it: it, ii: ii }; }).filter(function(x){ return _sbMatch(x.it); });
    return '<div style="flex:0 0 250px;max-width:250px;background:var(--surface2,#f3f4f6);border-radius:10px;padding:8px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:700;font-size:13px"><span>' + esc(s.name) + '</span><span style="font-weight:400;font-size:12px;color:' + (s.stuck ? '#b91c1c' : 'var(--muted)') + '">' + s.count + (s.stuck ? ' · ' + s.stuck + ' kẹt' : '') + '</span></div>' +
      (items.map(function(x){ return _sbCard(x.it, si, x.ii); }).join('') || '<div style="color:var(--muted);font-size:12px;padding:6px">Không có đơn</div>') +
      (s.count > s.items.length ? '<div style="font-size:11px;color:var(--muted);text-align:center">… còn ' + (s.count - s.items.length) + ' đơn nữa</div>' : '') + '</div>';
  }).join('');
  w.innerHTML = '<div style="font-size:18px;font-weight:700;margin-bottom:4px">📋 Bảng đơn theo giai đoạn</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Giai đoạn lấy từ Base (chỉ xem). Thẻ đỏ = kẹt quá ' + _sb.hours + ' giờ. ' + (_sb.at ? 'Cập nhật ' + new Date(_sb.at).toLocaleTimeString('vi-VN') + ' · ' : '') + tot + ' đơn' + (stuck ? ', <b style="color:#b91c1c">' + stuck + ' kẹt</b>' : '') + '</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center"><input type="text" placeholder="🔍 Tìm mã đơn, sale, sản phẩm…" value="' + esc(_sb.q) + '" oninput="_sb.q=this.value;_sbRender();var i=document.querySelector(\'#xt-wrap-stageboard input[type=text]\');i.focus();i.setSelectionRange(99,99)" style="flex:1;min-width:180px;padding:6px 10px;border:1px solid var(--border);border-radius:6px">' +
    '<label style="font-size:12px;cursor:pointer"><input type="checkbox" ' + (_sb.onlyStuck ? 'checked' : '') + ' onchange="_sb.onlyStuck=this.checked;_sbRender()"> Chỉ đơn kẹt</label><button class="btn sm" onclick="_sbLoad()">↻ Làm mới</button></div>' +
    (_sb.err ? '<div style="padding:10px;background:#fef2f2;color:#b91c1c;border-radius:8px;margin-bottom:10px">' + esc(_sb.err) + '</div>' : '') +
    (_sb.loading && !_sb.stages.length ? '<div style="padding:20px;color:var(--muted)">⏳ Đang tải…</div>' : '<div style="display:flex;gap:10px;overflow-x:auto;align-items:flex-start;padding-bottom:10px">' + cols + '</div>');
}
function _sbOpen(si, ii){
  var s = _sb.stages[si], it = s && s.items[ii]; if (!it) return;
  var row = function(l, v){ return v ? '<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px dashed var(--border)"><div style="width:110px;flex-shrink:0;color:var(--muted)">' + l + '</div><div style="flex:1;word-break:break-word">' + v + '</div></div>' : ''; };
  var m = document.createElement('div'); m.id = 'sb-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:14px';
  m.onclick = function(e){ if (e.target === m) m.remove(); };
  m.innerHTML = '<div style="background:var(--surface,#fff);color:var(--text,#111);border-radius:12px;max-width:480px;width:100%;max-height:84vh;overflow:auto;padding:14px 16px;font-size:13px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:15px">📦 Đơn ' + _sbCodeChip(it, true) + '</b><button class="btn sm" onclick="document.getElementById(\'sb-modal\').remove()">✕</button></div>' +
    row('Giai đoạn', esc(s.name)) + (it.maBoDem ? row('Mã đơn Base', '#' + esc(it.id)) : '') + row('Sản phẩm', esc(it.sanPham)) + row('Giá trị đơn', it.value ? it.value.toLocaleString('vi-VN') + ' đ' : '') + row('Sale', esc(it.sale)) + row('Đang xử lý', esc(it.giaoCho)) + row('Ngày tạo', esc(it.ngayTao)) +
    row('Ở giai đoạn này', it.hours === null ? 'chưa theo dõi giờ' : it.hours + ' giờ' + (it.stuck ? ' <b style="color:#b91c1c">(quá ' + _sb.hours + ' giờ — vào Base kiểm tra)</b>' : '')) + '</div>';
  document.body.appendChild(m);
}
registerExtraTab('stageboard', '📋 Bảng đơn theo giai đoạn', function(){ _sbLoad(); });

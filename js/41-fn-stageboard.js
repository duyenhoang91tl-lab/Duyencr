// ════════════════════════════════════════════════════════════════════
//  B5 — BẢNG KANBAN ĐƠN THEO GIAI ĐOẠN BASE (docs/ROADMAP-CRM-MAU.md; Duyên chốt Q1 = giai đoạn đơn Base).
//  Dữ liệu: GAS action=stageBoard (gas/23_TodayTasks.gs: ttStageBoard_). CHỈ ĐỌC — giai đoạn do Base quyết định nên không kéo thả.
//  Cột = Tiếp nhận đơn → Tạo đơn POS → Phân loại đơn → Phòng sản xuất → Kho thành phẩm → Đóng hàng (7 ngày gần nhất) (+ cột lạ nếu có).
//  Thẻ đỏ = đơn kẹt quá ngưỡng giờ (trang ⚙ Cấu hình). CS chỉ thấy đơn của sale mình (currentUser.names), admin thấy hết.
//  23/10/2026 (Duyên yêu cầu): BỘ LỌC Ngày tạo đơn / Phòng ban / Team / Sale / Nguồn (kênh bán) — lọc ở SERVER (GAS ttStageBoard_ nhận dateFrom,
//  dateTo, depts, teams, sales, kenh cách nhau '|') nên số đếm từng cột đúng; có lọc ngày thì bỏ giới hạn mặc định (60 ngày / Đóng hàng 7 ngày).
//  Thẻ có SĐT khách: bấm chip 👤 mở hồ sơ khách (openDp, ngăn bên phải) mà không rời bảng; modal đơn cũng có nút "Mở hồ sơ khách".
// ════════════════════════════════════════════════════════════════════
var _sb = { stages:[], hours:24, at:0, q:'', onlyStuck:false, loading:false, err:'', seq:0, timer:0, open:'', filterActive:false,
  f:{ from:'', to:'', depts:[], teams:[], sales:[], kenh:[] }, opt:{ depts:[], teams:[], sales:[], kenh:[] } };
var _SB_MS = [['depts','🏢 Phòng ban','phòng'],['teams','👥 Team','team'],['sales','👤 Sale','sale'],['kenh','🛒 Nguồn','nguồn']];
function _sbQuery(){
  var f = _sb.f, enc = encodeURIComponent, q = '';
  if (f.from) q += '&dateFrom=' + enc(f.from);
  if (f.to) q += '&dateTo=' + enc(f.to);
  ['depts','teams','sales','kenh'].forEach(function(k){ if (f[k].length) q += '&' + k + '=' + enc(f[k].join('|')); });
  return q;
}
function _sbHasFilter(){ var f = _sb.f; return !!(f.from || f.to || f.depts.length || f.teams.length || f.sales.length || f.kenh.length); }
async function _sbLoad(){
  if (typeof gsUrl === 'undefined' || !gsUrl) return;
  var seq = ++_sb.seq;   // bỏ kết quả trả về chậm của lần tải cũ khi người dùng đổi bộ lọc liên tiếp
  _sb.loading = true; _sbRender();
  var names = currentUser.role === 'admin' ? '' : ((currentUser.names && currentUser.names.length ? currentUser.names : [currentUser.name]).join('|'));
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=stageBoard&names=' + encodeURIComponent(names) + _sbQuery(), { redirect:'follow' });
    var d = await r.json();
    if (seq !== _sb.seq) return;
    if (d && d.stages){ _sb.stages = d.stages; _sb.hours = d.hours || 24; _sb.at = Date.now(); _sb.err = ''; _sb.filterActive = !!d.filterActive; if (d.options) _sb.opt = d.options; }
    else _sb.err = (d && d.error) || 'GAS chưa có action stageBoard — cần deploy lại GAS (gas/23_TodayTasks.gs).';
  } catch(e){ if (seq !== _sb.seq) return; _sb.err = 'Không tải được: ' + (e && e.message || e); }
  _sb.loading = false; _sbRender();
}
function _sbReloadSoon(){ clearTimeout(_sb.timer); _sb.timer = setTimeout(_sbLoad, 350); }   // gộp nhiều lần tick/chọn ngày thành 1 lần tải
function _sbSetDate(k, v){ _sb.f[k] = v || ''; _sbRender(); _sbReloadSoon(); }
function _sbDatePreset(kind){
  var ymd = function(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var now = new Date(), from = '', to = '';
  if (kind === 'today') { from = to = ymd(now); }
  else if (kind === '7d') { var d7 = new Date(now); d7.setDate(d7.getDate() - 6); from = ymd(d7); to = ymd(now); }
  else if (kind === 'month') { from = ymd(new Date(now.getFullYear(), now.getMonth(), 1)); to = ymd(now); }
  _sb.f.from = from; _sb.f.to = to; _sbRender(); _sbReloadSoon();
}
function _sbClearFilters(){ _sb.f = { from:'', to:'', depts:[], teams:[], sales:[], kenh:[] }; _sb.open = ''; _sbRender(); _sbReloadSoon(); }
// Ô chọn nhiều (gõ tìm + tick). Panel vẫn mở khi vẽ lại (_sb.open); gõ tìm chỉ ẩn/hiện dòng, không vẽ lại nên không mất con trỏ.
function _sbMsOptions(key){
  var o = _sb.opt[key] || [];
  return o.map(function(x){ return typeof x === 'string' ? { v: x, l: x } : { v: x.key, l: x.label }; });
}
function _sbMs(key, label, noun){
  var sel = _sb.f[key], open = _sb.open === key, opts = _sbMsOptions(key);
  sel.forEach(function(v){ if (!opts.some(function(o){ return o.v === v; })) opts.push({ v: v, l: v }); });   // giá trị đang chọn luôn hiện dù danh sách đổi
  var btn = '<button type="button" class="btn sm" onclick="_sbMsToggle(\'' + key + '\')" style="' + (sel.length ? 'border-color:var(--accent,#2563eb);' : '') + '">' + label + (sel.length ? ' <b>(' + sel.length + ')</b>' : '') + ' ▾</button>';
  var panel = '';
  if (open) {
    panel = '<div class="sb-ms-panel" style="position:absolute;z-index:50;top:100%;left:0;margin-top:4px;min-width:220px;max-width:300px;background:var(--surface,#fff);color:var(--text,#111);border:1px solid var(--border);border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:8px">' +
      '<input type="search" placeholder="🔍 Gõ tìm ' + esc(noun) + '…" oninput="_sbMsFilter(this)" style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;margin-bottom:6px;box-sizing:border-box">' +
      '<div style="max-height:240px;overflow:auto">' + (opts.map(function(o){
        return '<label class="sb-ms-row" data-t="' + esc(String(o.l).toLowerCase()) + '" style="display:flex;gap:6px;align-items:center;padding:3px 2px;font-size:12px;cursor:pointer"><input type="checkbox" data-v="' + esc(o.v) + '" ' + (sel.indexOf(o.v) !== -1 ? 'checked' : '') + ' onchange="_sbMsPick(\'' + key + '\',this)"> <span>' + esc(o.l) + '</span></label>';
      }).join('') || '<div style="color:var(--muted);font-size:12px;padding:4px">Chưa có dữ liệu</div>') + '</div>' +
      (sel.length ? '<div style="margin-top:6px;text-align:right"><a href="#" onclick="event.preventDefault();_sbMsClear(\'' + key + '\')" style="font-size:12px">Bỏ chọn tất cả</a></div>' : '') + '</div>';
  }
  return '<span class="sb-ms" style="position:relative;display:inline-block">' + btn + panel + '</span>';
}
function _sbMsToggle(key){ _sb.open = _sb.open === key ? '' : key; _sbRender(); }
function _sbMsFilter(inp){
  var t = String(inp.value || '').toLowerCase();
  var rows = inp.parentNode.querySelectorAll('.sb-ms-row');
  for (var i = 0; i < rows.length; i++) rows[i].style.display = (!t || rows[i].getAttribute('data-t').indexOf(t) !== -1) ? 'flex' : 'none';
}
function _sbMsPick(key, cb){
  var v = cb.getAttribute('data-v'), a = _sb.f[key], i = a.indexOf(v);
  if (cb.checked && i === -1) a.push(v); else if (!cb.checked && i !== -1) a.splice(i, 1);
  _sbRender(); _sbReloadSoon();
}
function _sbMsClear(key){ _sb.f[key] = []; _sbRender(); _sbReloadSoon(); }
if (typeof document !== 'undefined' && !window._sbDocBound) {
  window._sbDocBound = true;
  document.addEventListener('click', function(e){
    if (!_sb.open) return;
    var t = e.target; if (t && t.closest && t.closest('.sb-ms')) return;
    _sb.open = ''; _sbRender();
  });
}
// Mở hồ sơ khách (ngăn bên phải) từ SĐT trên thẻ — dùng lại _bdOpenCustomer_ (nạp thêm khách ngoài danh sách đang tải bằng _pullSearchCustomer_).
async function _sbOpenCustomer(phone){
  if (typeof _bdOpenCustomer_ === 'function') return _bdOpenCustomer_(phone);
  var ph = (typeof normPhone === 'function' ? normPhone(phone) : '') || String(phone || '').replace(/\D/g, '');
  if (!ph || typeof customerMap === 'undefined' || typeof openDp !== 'function') return;
  if (!customerMap[ph]) { ph = (typeof _pullSearchCustomer_ === 'function') ? await _pullSearchCustomer_(ph) : null; if (!ph) return; }
  try { openDp(ph); } catch(e){}
}
function _sbCustName(phone){
  try { var c = (typeof customerMap !== 'undefined') && customerMap[phone]; return c && c.name ? String(c.name) : ''; } catch(e){ return ''; }
}
// Chip khách trên thẻ: bấm = mở hồ sơ khách (stopPropagation để không mở modal đơn). SĐT nằm trong data-phone (đã escape).
function _sbCustChip(it){
  if (!it.phone) return '';
  var nm = _sbCustName(it.phone);
  return '<div><span class="sb-cust" data-phone="' + esc(it.phone) + '" title="Bấm để xem thông tin khách" onclick="event.stopPropagation();_sbOpenCustomer(this.getAttribute(\'data-phone\'))" style="cursor:pointer;display:inline-block;margin-top:2px;color:var(--accent,#2563eb);font-weight:600;border:1px solid var(--border);border-radius:6px;padding:0 6px;background:var(--surface2,#f3f4f6)">📞 ' + (nm ? esc(nm) + ' · ' : '') + esc(it.phone) + ' ›</span></div>';
}
function _sbMatch(it){
  if (_sb.onlyStuck && !it.stuck) return false;
  var q = (_sb.q || '').toLowerCase(); if (!q) return true;
  return (it.id + ' ' + (it.maBoDem || '') + ' ' + it.sale + ' ' + it.giaoCho + ' ' + it.sanPham + ' ' + (it.phone || '') + ' ' + (it.kenh || '')).toLowerCase().indexOf(q) !== -1;
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
    _sbCustChip(it) +
    (it.sale ? '<div>👤 ' + esc(it.sale) + '</div>' : '') + (it.giaoCho ? '<div>🛠 ' + esc(it.giaoCho) + '</div>' : '') + (it.kenh ? '<div style="color:var(--muted)">🛒 ' + esc(it.kenh) + '</div>' : '') +
    '<div style="margin-top:3px;color:' + (it.stuck ? '#b91c1c' : 'var(--muted)') + '">⏱ ' + esc(hTxt) + (it.stuck ? ' — quá ' + _sb.hours + ' giờ' : '') + '</div></div>';
}
function _sbFilterBar(){
  var f = _sb.f, inp = 'padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px';
  var presets = [['today','Hôm nay'],['7d','7 ngày'],['month','Tháng này']].map(function(p){ return '<button type="button" class="btn sm" onclick="_sbDatePreset(\'' + p[0] + '\')">' + p[1] + '</button>'; }).join('');
  var sum = [];
  if (f.from || f.to) sum.push('Ngày tạo: ' + esc(f.from || '…') + ' → ' + esc(f.to || '…'));
  _SB_MS.forEach(function(m){ if (f[m[0]].length) sum.push(m[1].replace(/^\S+\s/, '') + ': ' + f[m[0]].map(function(v){ var o = _sbMsOptions(m[0]).filter(function(x){ return x.v === v; })[0]; return esc(o ? o.l : v); }).join(', ')); });
  return '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center">' +
    '<span style="font-size:12px;color:var(--muted)">📅 Ngày tạo đơn</span>' +
    '<input type="date" value="' + esc(f.from) + '" onchange="_sbSetDate(\'from\',this.value)" style="' + inp + '"><span style="font-size:12px">→</span>' +
    '<input type="date" value="' + esc(f.to) + '" onchange="_sbSetDate(\'to\',this.value)" style="' + inp + '">' + presets +
    _SB_MS.map(function(m){ return _sbMs(m[0], m[1], m[2]); }).join('') +
    (_sbHasFilter() ? '<button type="button" class="btn sm" onclick="_sbClearFilters()">✕ Xoá lọc</button>' : '') +
    (_sb.loading ? '<span style="font-size:12px;color:var(--muted)">⏳ Đang lọc…</span>' : '') + '</div>' +
    (sum.length ? '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Đang lọc — ' + sum.join(' · ') + (f.from || f.to ? ' <i>(có chọn ngày: bỏ giới hạn mặc định 60 ngày / Đóng hàng 7 ngày)</i>' : '') + '</div>' : '');
}
// Vẽ lại nhưng GIỮ vị trí cuộn + chữ đang gõ tìm của ô chọn nhiều đang mở (tick liên tục trong danh sách dài không bị nhảy về đầu).
function _sbRender(){
  var w = document.getElementById('xt-wrap-stageboard'), st = 0, sv = '', foc = false;
  var lst = w && w.querySelector('.sb-ms-panel > div'), inp0 = w && w.querySelector('.sb-ms-panel > input');
  if (lst) st = lst.scrollTop;
  if (inp0) { sv = inp0.value; foc = document.activeElement === inp0; }
  _sbRender0();
  if (!w || !_sb.open) return;
  var lst2 = w.querySelector('.sb-ms-panel > div'), inp2 = w.querySelector('.sb-ms-panel > input');
  if (inp2 && sv) { inp2.value = sv; _sbMsFilter(inp2); }
  if (inp2 && foc) { inp2.focus(); try { inp2.setSelectionRange(sv.length, sv.length); } catch (e) {} }
  if (lst2) lst2.scrollTop = st;
}
function _sbRender0(){
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
    '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center"><input type="text" placeholder="🔍 Tìm mã đơn, SĐT, sale, sản phẩm…" value="' + esc(_sb.q) + '" oninput="_sb.q=this.value;_sbRender();var i=document.querySelector(\'#xt-wrap-stageboard input[type=text]\');i.focus();i.setSelectionRange(99,99)" style="flex:1;min-width:180px;padding:6px 10px;border:1px solid var(--border);border-radius:6px">' +
    '<label style="font-size:12px;cursor:pointer"><input type="checkbox" ' + (_sb.onlyStuck ? 'checked' : '') + ' onchange="_sb.onlyStuck=this.checked;_sbRender()"> Chỉ đơn kẹt</label><button class="btn sm" onclick="_sbLoad()">↻ Làm mới</button></div>' +
    _sbFilterBar() +
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
    row('Giai đoạn', esc(s.name)) + (it.maBoDem ? row('Mã đơn Base', '#' + esc(it.id)) : '') + row('Sản phẩm', esc(it.sanPham)) + row('Giá trị đơn', it.value ? it.value.toLocaleString('vi-VN') + ' đ' : '') + row('Khách hàng', it.phone ? '<span class="sb-cust" data-phone="' + esc(it.phone) + '" onclick="_sbOpenCustomer(this.getAttribute(\'data-phone\'));document.getElementById(\'sb-modal\').remove()" style="cursor:pointer;color:var(--accent,#2563eb);font-weight:600">📞 ' + (_sbCustName(it.phone) ? esc(_sbCustName(it.phone)) + ' · ' : '') + esc(it.phone) + ' — Mở hồ sơ khách ›</span>' : '') + row('Sale', esc(it.sale)) + row('Nguồn / kênh bán', esc(it.kenh)) + row('Đang xử lý', esc(it.giaoCho)) + row('Ngày tạo', esc(it.ngayTao)) +
    row('Ở giai đoạn này', it.hours === null ? 'chưa theo dõi giờ' : it.hours + ' giờ' + (it.stuck ? ' <b style="color:#b91c1c">(quá ' + _sb.hours + ' giờ — vào Base kiểm tra)</b>' : '')) + '</div>';
  document.body.appendChild(m);
}
registerExtraTab('stageboard', '📋 Bảng đơn theo giai đoạn', function(){ _sbLoad(); });

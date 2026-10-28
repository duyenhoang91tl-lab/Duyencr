// ════════════════════════════════════════════════════════════════════
//  B4 — MÀN "CHĂM SÓC & TÁI MUA" gộp 1 chỗ (docs/ROADMAP-CRM-MAU.md). Tính ở client từ hmCompute (js/36), không gọi thêm API.
//  Loại: Hẹn gọi (hôm nay + quá hạn) · Đơn Base kẹt giai đoạn · Đến hạn tái mua · Thiếu hoạt động. Có tìm kiếm, lọc loại, Xuất CSV.
//  Khách tích "Không nhận quảng bá" bị BỎ khỏi Tái mua + Thiếu hoạt động (liên hệ chủ động); Hẹn gọi do CS tự hẹn thì vẫn hiện.
//  Cũng chứa bộ tạo tab dùng chung (registerExtraTab) cho các màn mới (js/41 Bảng Kanban).
// ════════════════════════════════════════════════════════════════════
var _EXTRA_TABS = {};
function _xtEnsureTab(id){
  var t = _EXTRA_TABS[id]; if (!t || !currentUser) return;
  var bar = document.querySelector('#data-view .tabs'); if (!bar || document.querySelector('[data-bar-id="' + id + '"]')) return;
  var d = document.createElement('div'); d.className = 'tab'; d.id = 'v9tab-' + id; d.setAttribute('data-bar-id', id); d.setAttribute('data-bar-home', '.tabs');
  d.setAttribute('onclick', "switchTab('" + id + "',this)"); d.innerHTML = t.label; bar.appendChild(d);
}
function _xtPanel(id){
  var dv = document.getElementById('data-view'); if (!dv) return null;
  var p = document.getElementById('tab-' + id);
  if (!p){ p = document.createElement('div'); p.id = 'tab-' + id; p.className = 'main'; p.style.cssText = 'display:none;flex:1;overflow:auto;flex-direction:column'; p.innerHTML = '<div class="dash-wrap" id="xt-wrap-' + id + '"></div>'; dv.appendChild(p); }
  return p;
}
function registerExtraTab(id, label, renderFn){ _EXTRA_TABS[id] = { label: label, render: renderFn }; _xtEnsureTab(id); _xtPanel(id); }
(function(){
  var prev = switchTab;
  switchTab = function(tab, el){
    prev(tab, el);
    Object.keys(_EXTRA_TABS).forEach(function(id){ var p = _xtPanel(id); if (p) p.style.display = (tab === id) ? 'flex' : 'none'; });
    if (_EXTRA_TABS[tab]) { try { _EXTRA_TABS[tab].render(); } catch(e){ console.warn('[tab ' + tab + ']', e); } }
  };
  setInterval(function(){ Object.keys(_EXTRA_TABS).forEach(_xtEnsureTab); }, 4000);
})();

var _c2 = { type:'all', q:'', limit:100, rows:[] };
var _C2_LABEL = { call:'📞 Hẹn gọi', order:'📦 Đơn kẹt', rebuy:'🔄 Tái mua', idle:'📉 Thiếu hoạt động' };
function _c2Rows(){
  var r = hmCompute(), rows = [];
  var cs = function(p){ var c = (typeof customerMap !== 'undefined' && customerMap) ? customerMap[p] : null, k = (typeof careData !== 'undefined' && careData) ? careData[p] : null; return String((k && k.cs) || (c && c.cs) || ''); };
  var noPromo = function(p){ var k = (typeof careData !== 'undefined' && careData) ? careData[p] : null; return !!(k && k.custom && k.custom.noPromo); };
  r.overdue.concat(r.today).forEach(function(x){ rows.push(x.order ? { type:'order', phone:x.phone, name:x.name, oid:x.oid, detail:x.sub, cs:x.cs, follow:x.follow, sort:0 } : { type:'call', phone:x.phone, name:x.name, detail:x.sub, cs:cs(x.phone), sort:0 }); });
  r.rebuy.forEach(function(x){ if (!noPromo(x.phone)) rows.push({ type:'rebuy', phone:x.phone, name:x.name, detail:x.sub, cs:cs(x.phone), sort:1 }); });
  r.idle.forEach(function(x){ if (!noPromo(x.phone)) rows.push({ type:'idle', phone:x.phone, name:x.name, detail:x.sub, cs:cs(x.phone), sort:2 }); });
  return rows;
}
function _c2Filtered(){
  var q = (_c2.q || '').toLowerCase();
  return _c2.rows.filter(function(x){ return (_c2.type === 'all' || x.type === _c2.type) && (!q || (x.name + ' ' + x.phone + ' ' + x.detail + ' ' + x.cs + ' ' + (x.oid || '')).toLowerCase().indexOf(q) !== -1); });
}
function _c2Render(){
  var w = document.getElementById('xt-wrap-care2'); if (!w) return;
  var cnt = { all: _c2.rows.length }; Object.keys(_C2_LABEL).forEach(function(k){ cnt[k] = _c2.rows.filter(function(x){ return x.type === k; }).length; });
  var list = _c2Filtered(), seg = function(k, t){ return '<button class="btn sm' + (_c2.type === k ? ' primary' : '') + '" onclick="_c2.type=\'' + k + '\';_c2.limit=100;_c2Render()">' + t + ' (' + (cnt[k] || 0) + ')</button>'; };
  w.innerHTML = '<div style="font-size:18px;font-weight:700;margin-bottom:4px">🔔 Chăm sóc & tái mua</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Khách đến lịch chăm lại hoặc tái mua theo cấu hình. Khách tích “🚫 Không nhận quảng bá” không nằm trong Tái mua / Thiếu hoạt động.</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' + seg('all', 'Tất cả') + Object.keys(_C2_LABEL).map(function(k){ return seg(k, _C2_LABEL[k]); }).join('') + '</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap"><input type="text" placeholder="🔍 Tìm tên, SĐT, phụ trách…" value="' + esc(_c2.q) + '" oninput="_c2.q=this.value;_c2.limit=100;_c2Render();var i=this.parentNode.querySelector(\'input\');i.focus();i.setSelectionRange(99,99)" style="flex:1;min-width:180px;padding:6px 10px;border:1px solid var(--border);border-radius:6px">' +
    '<button class="btn sm" onclick="_c2Refresh()">↻ Làm mới</button><button class="btn sm" onclick="_c2Csv()">⬇ Xuất CSV</button></div>' +
    '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>Loại</th><th>Khách</th><th>Chi tiết</th><th>Phụ trách</th></tr></thead><tbody>' +
    list.slice(0, _c2.limit).map(function(x){
      if (x.type === 'order') return _c2OrderRow(x);
      return '<tr' + (x.phone ? ' data-phone="' + esc(x.phone) + '" onclick="openDp(this.dataset.phone)" style="cursor:pointer"' : '') + '><td>' + _C2_LABEL[x.type] + '</td><td><b>' + esc(x.name) + '</b>' + (x.phone ? '<div style="font-size:11px;color:var(--muted)">' + esc(x.phone) + '</div>' : '') + '</td><td>' + esc(x.detail) + '</td><td>' + esc(x.cs) + '</td></tr>'; }).join('') +
    (list.length ? '' : '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:16px">Không có mục nào 🎉</td></tr>') + '</tbody></table></div>' +
    (list.length > _c2.limit ? '<div style="text-align:center;margin-top:8px"><button class="btn sm" onclick="_c2.limit+=100;_c2Render()">Hiện thêm (' + (list.length - _c2.limit) + ' còn lại)</button></div>' : '');
}
function _c2Refresh(){ _c2.rows = _c2Rows(); _c2Render(); }
function _c2Csv(){
  var list = _c2Filtered(), q = function(v){ return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
  var csv = '\ufeff' + ['Loại', 'Khách', 'SĐT', 'Chi tiết', 'Phụ trách'].map(q).join(',') + '\r\n' + list.map(function(x){ return [_C2_LABEL[x.type].replace(/^\S+\s/, ''), x.name, x.phone, x.detail, x.cs].map(q).join(','); }).join('\r\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
  a.download = 'cham-soc-tai-mua-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove();
}
registerExtraTab('care2', '🔔 Chăm sóc & tái mua', function(){ _c2Refresh(); });

// ════════════════════════════════════════════════════════════════════
//  ĐƠN KẸT — bấm vào dòng mở hộp chi tiết: KHÁCH (tên, SĐT, mở hồ sơ) + ĐƠN (mã, giai đoạn, kẹt bao lâu, sản phẩm, giá trị, người xử lý, CS phụ trách)
//  + THEO DÕI: CS PHỤ TRÁCH (tên trong cột "Sale bán" của đơn) hoặc admin tích 👁 Đã xem / 🛠 Đang xử lý / ✅ Đã xử lý xong + ghi chú; ai cũng thấy ai đang lo.
//  Dữ liệu từ GAS todayTasks (đã kèm SĐT/sản phẩm/giá trị + follow). Lưu theo dõi: GAS action=stuckFollowSet (server tự kiểm tra quyền theo phiên đăng nhập).
//  Yêu cầu Duyên 2026-10-14: "bấm phải ra thông tin khách hàng và đơn hàng nào để CS còn biết và xử lý; đơn thuộc CS nào phụ trách thì CS đó tích vào xem và follow được".
// ════════════════════════════════════════════════════════════════════
var _stuck = { oid: '', busy: false, msg: '' };
var _ST_LABEL = { xem: ['👁', 'Đã xem'], xuly: ['🛠', 'Đang xử lý'], xong: ['✅', 'Đã xử lý xong'] };
function _stMoney(v){ return (typeof fmt === 'function' ? fmt(Math.round(v)) : String(Math.round(v))) + 'đ'; }
// So ten CS GIONG HET server (_normTxt_ trong GAS): chi viet thuong + gon khoang trang, KHONG bo dau — de nut tich chi hien khi server cung chap nhan.
function _stFold(s){ return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
function _stTime(ms){ if (!ms) return ''; var d = new Date(ms), p = function(n){ return (n < 10 ? '0' : '') + n; }; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
function stuckFollowBadge_(f, block){
  var L = f && _ST_LABEL[f.status];
  if (!L) return block ? '<div style="font-size:11px;color:var(--red)">⏳ Chưa ai tích theo dõi</div>' : ' · <span style="color:var(--red)">⏳ chưa theo dõi</span>';
  var t = L[0] + ' ' + L[1] + ' · ' + esc(f.by);
  return block ? '<div style="font-size:11px;color:#15803d">' + t + '</div>' : ' · <span style="color:#15803d">' + t + '</span>';
}
function stuckRow_(o){
  var c = (typeof customerMap !== 'undefined' && customerMap && o.phone) ? customerMap[o.phone] : null;
  var sub = ((c && c.name) ? c.name + ' · ' : '') + o.stage + ' · kẹt ' + o.hours + ' giờ' + (o.sanPham ? ' · ' + o.sanPham : '') + (o.value ? ' · ' + _stMoney(o.value) : '');
  return { phone: o.phone || '', order: true, oid: String(o.id), name: 'Đơn ' + (o.maBoDem || o.id), sub: sub, cs: o.sale || '', follow: o.follow || null };
}
function _c2OrderRow(x){
  var c = (typeof customerMap !== 'undefined' && customerMap && x.phone) ? customerMap[x.phone] : null;
  var cust = (c && c.name) ? c.name : (x.phone ? 'Khách ' + x.phone : 'Chưa có SĐT khách');
  return '<tr data-oid="' + esc(x.oid) + '" onclick="stuckOpen(this.dataset.oid)" style="cursor:pointer" title="Bấm để xem khách + đơn và theo dõi"><td>' + _C2_LABEL.order + '</td><td><b>' + esc(cust) + '</b><div style="font-size:11px;color:var(--muted)">' +
    (x.phone ? esc(x.phone) + ' · ' : '') + esc(x.name) + '</div></td><td>' + esc(x.detail) + '</td><td>' + esc(x.cs || '—') + stuckFollowBadge_(x.follow, true) + '</td></tr>';
}
function _stuckFind(oid){
  var tasks = (typeof _ttState !== 'undefined' && _ttState && _ttState.tasks) || [];
  for (var i = 0; i < tasks.length; i++){ var its = tasks[i].items || []; for (var j = 0; j < its.length; j++) if (String(its[j].id) === String(oid)) return its[j]; }
  return null;
}
function _stuckCanAct(it){
  if (typeof currentUser === 'undefined' || !currentUser) return false;
  if (currentUser.role === 'admin') return true;
  var names = (currentUser.names && currentUser.names.length) ? currentUser.names : [currentUser.name];
  var toks = String(it.sale || '').split(',').map(_stFold).filter(Boolean);
  return names.some(function(n){ var k = _stFold(n); return !!k && toks.indexOf(k) !== -1; });
}
function stuckClose(){ var ov = document.getElementById('stuck-ov'); if (ov) ov.style.display = 'none'; }
function stuckCopy(txt){ try { navigator.clipboard.writeText(String(txt)); toast('Đã copy ' + txt); } catch (e) { toast('Không copy được'); } }
function stuckOpen(oid){
  var it = _stuckFind(oid);
  if (!it){ toast('Đơn này không còn trong danh sách kẹt (đã sang giai đoạn khác) — bấm Làm mới.'); return; }
  var ov = document.getElementById('stuck-ov');
  if (!ov){ ov = document.createElement('div'); ov.id = 'stuck-ov'; ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9600;display:none;align-items:center;justify-content:center;padding:12px'; ov.addEventListener('click', function(e){ if (e.target === ov) stuckClose(); }); document.body.appendChild(ov); }
  _stuck.oid = String(oid); _stuck.msg = ''; ov.style.display = 'flex'; _stuckRender();
}
function _stuckRender(){
  var ov = document.getElementById('stuck-ov'); if (!ov) return;
  var it = _stuckFind(_stuck.oid); if (!it){ stuckClose(); return; }
  var c = (typeof customerMap !== 'undefined' && customerMap && it.phone) ? customerMap[it.phone] : null, k = (typeof careData !== 'undefined' && careData && it.phone) ? careData[it.phone] : null;
  var row = function(l, v){ return v ? '<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);font-size:13px"><div style="width:118px;color:var(--muted);flex:none">' + l + '</div><div style="flex:1;word-break:break-word">' + v + '</div></div>' : ''; };
  var sec = function(t){ return '<div style="font-weight:700;margin:12px 0 4px">' + t + '</div>'; };
  var hasProfile = !!(c && typeof openDp === 'function');
  var cust = row('Tên khách', (c && c.name) ? '<b>' + esc(c.name) + '</b>' : '<i style="color:var(--muted)">Chưa có trong danh sách khách</i>') +
    row('SĐT', it.phone ? '<b>' + esc(it.phone) + '</b> <button class="btn sm" onclick="stuckCopy(\'' + esc(it.phone) + '\')">📋 Copy</button>' : '<i style="color:var(--red)">Đơn chưa có SĐT khách — kiểm tra cột SĐT trong DT TỔNG</i>') +
    row('CS chăm khách', esc((k && k.cs) || (c && c.cs) || ''));
  var order = row('Mã đơn Base', '<b>' + esc(it.id) + '</b>') + row('Mã bộ đếm', esc(it.maBoDem || '')) + row('Giai đoạn', esc(it.stage)) +
    row('Kẹt', '<b style="color:var(--red)">' + esc(it.hours) + ' giờ</b> ở giai đoạn này') + row('Sản phẩm', esc(it.sanPham || '')) + row('Giá trị đơn', it.value ? '<b>' + _stMoney(it.value) + '</b>' : '') +
    row('Kênh bán', esc(it.kenhBan || '')) + row('Trạng thái đơn', esc(it.trangThai || '')) + row('Ngày tạo', esc(it.ngayTao || '')) + row('Người đang xử lý', esc(it.giaoCho || '')) + row('CS phụ trách (Sale bán)', '<b>' + esc(it.sale || '—') + '</b>');
  var f = it.follow, can = _stuckCanAct(it), hist = (f && f.history) || [];
  var follow = '<div style="padding:6px 0">' + stuckFollowBadge_(f, true).replace('font-size:11px', 'font-size:13px') + (f && f.note ? '<div style="font-size:12px;color:var(--muted)">“' + esc(f.note) + '” · ' + _stTime(f.at) + '</div>' : (f ? '<div style="font-size:12px;color:var(--muted)">' + _stTime(f.at) + '</div>' : '')) + '</div>';
  if (hist.length > 1) follow += '<div style="font-size:11.5px;color:var(--muted);line-height:1.5;margin-bottom:6px">' + hist.slice().reverse().map(function(h){ var L = _ST_LABEL[h.s]; return _stTime(h.at) + ' · ' + esc(h.by) + ' · ' + (L ? L[0] + ' ' + L[1] : 'Bỏ theo dõi') + (h.note ? ' — ' + esc(h.note) : ''); }).join('<br>') + '</div>';
  if (can) follow += '<input id="stuck-note" type="text" maxlength="300" placeholder="Ghi chú (vd: đã gọi khách, chờ kho...)" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--border);border-radius:6px;margin-bottom:6px">' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' + ['xem', 'xuly', 'xong'].map(function(st){ return '<button class="btn sm' + (f && f.status === st ? ' primary' : '') + '" ' + (_stuck.busy ? 'disabled ' : '') + 'onclick="stuckSave(\'' + st + '\')">' + _ST_LABEL[st][0] + ' ' + _ST_LABEL[st][1] + '</button>'; }).join('') +
    (f ? '<button class="btn sm" ' + (_stuck.busy ? 'disabled ' : '') + 'onclick="stuckSave(\'bo\')">↩ Bỏ theo dõi</button>' : '') + '</div>';
  else follow += '<div style="font-size:12px;color:var(--muted)">Chỉ CS phụ trách đơn này (' + esc(it.sale || '—') + ') hoặc quản trị mới tích được.</div>';
  ov.innerHTML = '<div style="background:var(--surface,#fff);border-radius:12px;max-width:560px;width:100%;max-height:92vh;overflow:auto;padding:16px 18px;box-shadow:0 12px 40px rgba(0,0,0,.3)">' +
    '<div style="display:flex;align-items:center;gap:8px"><div style="font-size:16px;font-weight:700;flex:1">📦 Đơn kẹt ' + esc(it.maBoDem || it.id) + '</div><button class="btn sm" onclick="stuckClose()">✕</button></div>' +
    sec('👤 Khách hàng') + cust + (hasProfile ? '<div style="margin-top:6px"><button class="btn sm primary" onclick="stuckClose();openDp(\'' + esc(it.phone) + '\')">👤 Mở hồ sơ khách</button></div>' : '') +
    sec('📦 Đơn hàng') + order + sec('👁 Theo dõi xử lý') + follow +
    (_stuck.msg ? '<div style="margin-top:8px;color:var(--red);font-size:12.5px">' + esc(_stuck.msg) + '</div>' : '') + '</div>';
}
async function stuckSave(status){
  var it = _stuckFind(_stuck.oid); if (!it || _stuck.busy) return;
  var note = (document.getElementById('stuck-note') || {}).value || '';
  _stuck.busy = true; _stuck.msg = ''; _stuckRender();
  try {
    var r = await fetch(gsUrl, { method: 'POST', body: JSON.stringify({ action: 'stuckFollowSet', id: it.id, status: status, note: note, by: (currentUser && currentUser.name) || '' }), headers: { 'Content-Type': 'text/plain' } });
    var d = await r.json();
    if (!d || d.ok === false || d.error) throw new Error((d && (d.error || d.message)) || 'Lỗi không rõ');
    it.follow = d.follow || null;
    toast(status === 'bo' ? 'Đã bỏ theo dõi' : 'Đã ghi: ' + _ST_LABEL[status][1]);
    if (typeof _c2Refresh === 'function' && document.getElementById('xt-wrap-care2')) _c2Refresh();
    if (typeof renderReminderPanel === 'function') renderReminderPanel();
    if (typeof hmRenderChips === 'function') hmRenderChips();
  } catch (e) { _stuck.msg = 'Không lưu được: ' + (e && e.message || e); }
  _stuck.busy = false; _stuckRender();
}


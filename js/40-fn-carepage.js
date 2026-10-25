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
  r.overdue.concat(r.today).forEach(function(x){ rows.push({ type: x.phone ? 'call' : 'order', phone:x.phone, name:x.name, detail:x.sub, cs:cs(x.phone), sort:0 }); });
  r.rebuy.forEach(function(x){ if (!noPromo(x.phone)) rows.push({ type:'rebuy', phone:x.phone, name:x.name, detail:x.sub, cs:cs(x.phone), sort:1 }); });
  r.idle.forEach(function(x){ if (!noPromo(x.phone)) rows.push({ type:'idle', phone:x.phone, name:x.name, detail:x.sub, cs:cs(x.phone), sort:2 }); });
  return rows;
}
function _c2Filtered(){
  var q = (_c2.q || '').toLowerCase();
  return _c2.rows.filter(function(x){ return (_c2.type === 'all' || x.type === _c2.type) && (!q || (x.name + ' ' + x.phone + ' ' + x.detail + ' ' + x.cs).toLowerCase().indexOf(q) !== -1); });
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
      return '<tr' + (x.phone ? ' data-phone="' + esc(x.phone) + '" onclick="_openCustomerByPhone_(this.dataset.phone)" style="cursor:pointer"' : '') + '><td>' + _C2_LABEL[x.type] + '</td><td><b>' + esc(x.name) + '</b>' + (x.phone ? '<div style="font-size:11px;color:var(--muted)">' + esc(x.phone) + '</div>' : '') + '</td><td>' + esc(x.detail) + '</td><td>' + esc(x.cs) + '</td></tr>'; }).join('') +
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

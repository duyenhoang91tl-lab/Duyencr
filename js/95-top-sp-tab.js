// ════════════════════════════════════════════════════════════════════
//  TOP SẢN PHẨM BÁN (21/11/2026, bước 2/3) — tab "🏆 Top sản phẩm bán" (menu 📊 Báo cáo). Backend: GAS topProducts / saveTopSpExclude (gas_v13.js, test tools/test-top-products.js).
//  Duyên yêu cầu: xem top sản phẩm bán TRONG NGÀY (hoặc khoảng ngày), lọc riêng theo TEAM, và cài được SP nào KHÔNG đưa vào thống kê.
//  Xếp hạng theo SỐ LƯỢNG bán (kèm số đơn) — dữ liệu đơn chỉ có tổng tiền cả đơn nên KHÔNG chia doanh thu theo từng SP.
//  Đơn bán chung nhiều team: tính đủ cho từng team được chọn. Đơn Huỷ/Đã hoàn/Đang hoàn tự bị bỏ (như Báo cáo B).
//  Loại trừ: lưu chung ở server (Settings topSpExclude) nên mọi máy cùng thấy; CHỈ admin/leader/manager được thêm/bỏ (server cũng kiểm).
//  Nạp SAU js/40 (registerExtraTab). Gỡ = xoá dòng <script> trong index.html + id 'topsp' trong js/29.
// ════════════════════════════════════════════════════════════════════
var _ts = { from:'', to:'', teams:[], data:null, loading:false, err:'', msg:'', showEx:false, exQ:'', seq:0 };
function _tsTok(){ try { return localStorage.getItem('ome_sess_token') || ''; } catch(e){ return ''; } }
function _tsYmd(d){ var p = function(n){ return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function _tsToday(){ return _tsYmd(new Date()); }
function _tsAddDays(ymd, n){ var m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return ymd; var d = new Date(+m[1], +m[2] - 1, +m[3] + n); return _tsYmd(d); }
function _tsCanEdit(){ var r = (typeof currentUser !== 'undefined' && currentUser) ? String(currentUser.role || '') : ''; return r === 'admin' || r === 'leader' || r === 'manager'; }
function _tsFmt(n){ return (typeof fmt === 'function') ? fmt(n) : String(n); }
function _tsEsc(s){ return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }
function _tsFold(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim(); }
function _tsUrl(){
  var qs = 'action=topProducts&dateFrom=' + encodeURIComponent(_ts.from) + '&dateTo=' + encodeURIComponent(_ts.to) +
    '&team=' + encodeURIComponent(_ts.teams.join(',')) + '&limit=200&token=' + encodeURIComponent(_tsTok());
  return gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + qs;
}
async function _tsLoad(){
  if (typeof gsUrl === 'undefined' || !gsUrl){ _ts.err = 'Chưa kết nối Google Sheets.'; _tsRender(); return; }
  var my = ++_ts.seq; _ts.loading = true; _ts.err = ''; _tsRender();
  try {
    var r = await fetch(_tsUrl(), { redirect:'follow' }), d = await r.json();
    if (my !== _ts.seq) return;   // đã bấm lọc mới hơn → bỏ kết quả cũ
    if (!d || d.ok === false || d.error) _ts.err = (d && (d.error || d.message)) || 'Không tải được báo cáo.';
    else _ts.data = d;
  } catch(e){ if (my === _ts.seq) _ts.err = 'Lỗi kết nối: ' + (e && e.message || e); }
  if (my === _ts.seq){ _ts.loading = false; _tsRender(); }
}
function _tsSetRange(kind){
  var t = _tsToday();
  if (kind === 'today'){ _ts.from = t; _ts.to = t; }
  else if (kind === 'yday'){ var y = _tsAddDays(t, -1); _ts.from = y; _ts.to = y; }
  else if (kind === '7d'){ _ts.from = _tsAddDays(t, -6); _ts.to = t; }
  else if (kind === 'month'){ _ts.from = t.slice(0, 8) + '01'; _ts.to = t; }
  _tsLoad();
}
function _tsSetDate(which, v){ if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return; _ts[which] = v; if (_ts.from > _ts.to){ if (which === 'from') _ts.to = v; else _ts.from = v; } _tsLoad(); }
function _tsToggleTeam(name){
  if (name === '') _ts.teams = [];
  else { var i = _ts.teams.indexOf(name); if (i < 0) _ts.teams.push(name); else _ts.teams.splice(i, 1); }
  _tsLoad();
}
async function _tsSaveExclude(list){
  _ts.msg = ''; _tsRender();
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body:JSON.stringify({ action:'saveTopSpExclude', token:_tsTok(), list:list }) }), d = await r.json();
    if (!d || d.ok === false || d.error){ _ts.msg = '⚠ ' + ((d && (d.error || d.message)) || 'Không lưu được danh sách loại trừ.'); _tsRender(); return; }
    _ts.msg = '✓ Đã lưu danh sách loại trừ (' + (d.count != null ? d.count : list.length) + ' mục).';
  } catch(e){ _ts.msg = '⚠ Lỗi kết nối: ' + (e && e.message || e); _tsRender(); return; }
  _tsLoad();
}
function _tsExList(){ return ((_ts.data && _ts.data.exclude) || []).slice(); }
function _tsExcludeRow(i){
  var row = ((_ts.data && _ts.data.rows) || [])[i]; if (!row || !_tsCanEdit()) return;
  if (!confirm('Loại "' + row.name + '" khỏi thống kê Top sản phẩm?\n(Áp dụng cho mọi người; bỏ loại lại bất cứ lúc nào ở khung "Sản phẩm đã loại trừ".)')) return;
  var l = _tsExList(); if (!l.some(function(x){ return x.key === row.key; })) l.push({ key:row.key, name:row.name });
  _tsSaveExclude(l);
}
function _tsUnexclude(i){
  if (!_tsCanEdit()) return;
  var l = _tsExList(); l.splice(i, 1); _tsSaveExclude(l);
}
function _tsAddExcludeByName(){
  if (!_tsCanEdit()) return;
  var name = String(_ts.exQ || '').trim(); if (!name) return;
  var l = _tsExList(), f = _tsFold(name);
  if (l.some(function(x){ return _tsFold(x.name) === f; })){ _ts.msg = 'Tên này đã có trong danh sách loại trừ.'; _tsRender(); return; }
  l.push({ key:'x:' + f, name:name }); _ts.exQ = ''; _tsSaveExclude(l);   // server khớp cả theo TÊN bỏ dấu/hoa thường nên khoá 'x:' vẫn chặn đúng
}
function _tsRender(){
  var w = document.getElementById('xt-wrap-topsp'); if (!w) return;
  var d = _ts.data, canEdit = _tsCanEdit(), rows = (d && d.rows) || [], max = rows.length ? Math.max.apply(null, rows.map(function(r){ return r.soLuong; })) || 1 : 1;
  var teams = (d && d.teams) || [];
  var btn = function(label, k){ return '<button class="btn sm" onclick="_tsSetRange(\'' + k + '\')">' + label + '</button>'; };
  var chip = function(label, on, arg){ return '<button class="btn sm" style="' + (on ? 'background:#0ea5e9;color:#fff;border-color:#0ea5e9' : '') + '" onclick="_tsToggleTeam(' + arg + ')">' + _tsEsc(label) + '</button>'; };
  var h = '<div style="padding:14px 18px"><div style="font-size:18px;font-weight:700;margin-bottom:4px">🏆 Top sản phẩm bán</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Xếp hạng theo <b>số lượng bán</b> (nguồn đơn Pos, bỏ đơn Huỷ/Hoàn). Đơn bán chung nhiều team tính đủ cho từng team được chọn.</div>' +
    '<div class="ml-bar"><span style="font-size:12px;color:var(--muted)">Từ</span><input type="date" class="ml-q" style="max-width:150px;flex:none" value="' + _ts.from + '" onchange="_tsSetDate(\'from\',this.value)">' +
    '<span style="font-size:12px;color:var(--muted)">đến</span><input type="date" class="ml-q" style="max-width:150px;flex:none" value="' + _ts.to + '" onchange="_tsSetDate(\'to\',this.value)">' +
    btn('Hôm nay', 'today') + btn('Hôm qua', 'yday') + btn('7 ngày', '7d') + btn('Tháng này', 'month') + '<button class="btn sm" onclick="_tsLoad()">↻ Làm mới</button></div>' +
    '<div class="ml-bar"><span style="font-size:12px;color:var(--muted)">Team:</span>' + chip('Tất cả', !_ts.teams.length, "''") +
    teams.map(function(t){ return chip(t, _ts.teams.indexOf(t) > -1, JSON.stringify(t).replace(/"/g, '&quot;')); }).join('') + '</div>';
  if (_ts.loading) h += '<div class="ml-empty">Đang tải…</div>';
  if (_ts.err) h += '<div class="ml-empty" style="color:#b91c1c">' + _tsEsc(_ts.err) + '</div>';
  if (_ts.msg) h += '<div style="font-size:12.5px;margin:6px 0;color:' + (_ts.msg.charAt(0) === '⚠' ? '#b91c1c' : '#15803d') + '">' + _tsEsc(_ts.msg) + '</div>';
  if (d && !_ts.err){
    h += '<div class="ml-m" style="margin-bottom:8px">' + _tsEsc(d.dateFrom) + (d.dateTo !== d.dateFrom ? ' → ' + _tsEsc(d.dateTo) : '') + ' · ' + _tsFmt(d.totalProducts) + ' sản phẩm · ' + _tsFmt(d.totalQty) + ' cái · ' + _tsFmt(d.totalOrders) + ' đơn' +
      (d.excludedQty ? ' · đã loại trừ ' + _tsFmt(d.excludedQty) + ' cái' : '') + (rows.length < d.totalProducts ? ' · hiện ' + rows.length + ' đầu' : '') + '</div>';
    h += '<table class="dash-table"><thead><tr><th style="width:40px">#</th><th>Sản phẩm</th><th>Mã</th><th class="r" style="width:110px">SL bán</th><th class="r" style="width:80px">Số đơn</th>' + (canEdit ? '<th style="width:70px"></th>' : '') + '</tr></thead><tbody>';
    rows.forEach(function(r, i){
      h += '<tr><td>' + (i + 1) + '</td><td><div>' + _tsEsc(r.name) + '</div><div style="height:5px;border-radius:3px;background:#0ea5e9;opacity:.55;width:' + Math.max(2, Math.round(r.soLuong / max * 100)) + '%"></div></td>' +
        '<td style="font-size:12px;color:var(--muted)">' + _tsEsc(r.code) + '</td><td class="r"><b>' + _tsFmt(r.soLuong) + '</b></td><td class="r">' + _tsFmt(r.orders) + '</td>' +
        (canEdit ? '<td><button class="btn sm" title="Không đưa sản phẩm này vào thống kê" onclick="_tsExcludeRow(' + i + ')">🚫 Loại</button></td>' : '') + '</tr>';
    });
    if (!rows.length) h += '<tr><td colspan="' + (canEdit ? 6 : 5) + '" class="sr-empty">Không có sản phẩm nào trong khoảng ngày / team này.</td></tr>';
    h += '</tbody></table>';
    var ex = d.exclude || [];
    h += '<div style="margin-top:14px"><button class="btn sm" onclick="_ts.showEx=!_ts.showEx;_tsRender()">' + (_ts.showEx ? '▼' : '▶') + ' Sản phẩm đã loại trừ (' + ex.length + ')</button></div>';
    if (_ts.showEx){
      h += '<div style="margin-top:8px;padding:10px;border:1px solid var(--border);border-radius:8px">';
      if (!ex.length) h += '<div class="ml-m">Chưa loại trừ sản phẩm nào.</div>';
      ex.forEach(function(x, i){ h += '<div style="display:flex;align-items:center;gap:8px;padding:3px 0"><span style="flex:1">' + _tsEsc(x.name || x.key) + ' <span class="ml-m">' + _tsEsc(x.key) + '</span></span>' + (canEdit ? '<button class="btn sm" onclick="_tsUnexclude(' + i + ')">↩ Bỏ loại</button>' : '') + '</div>'; });
      if (canEdit) h += '<div class="ml-bar" style="margin:10px 0 0"><input class="ml-q" id="ts-exq" type="text" placeholder="Gõ tên sản phẩm muốn loại (vd: Quà tặng, Phí ship)…" value="' + _tsEsc(_ts.exQ) + '" oninput="_ts.exQ=this.value" onkeydown="if(event.key===\'Enter\')_tsAddExcludeByName()"><button class="btn sm" onclick="_tsAddExcludeByName()">➕ Thêm</button></div>';
      else h += '<div class="ml-m" style="margin-top:8px">Chỉ admin / leader / quản lý được sửa danh sách này.</div>';
      h += '</div>';
    }
  }
  w.innerHTML = h + '</div>';
}
registerExtraTab('topsp', '🏆 Top sản phẩm bán', function(){ if (!_ts.from){ _ts.from = _tsToday(); _ts.to = _ts.from; } if (_ts.data) _tsRender(); _tsLoad(); });

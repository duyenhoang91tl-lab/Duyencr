// ════════════════════════════════════════════════════════════════════
//  ĐƠN CRM — bước 3/4: tab "🧾 Đơn CRM" liệt kê + xem chi tiết các đơn CRM tự lên (sheet riêng "Đơn CRM").
//  Backend: GAS crmOrders (gas/35_CrmOrder.gs). Phạm vi xem do SERVER quyết theo cấp bậc (trả `scope`): all (admin/CEO) | dept (trưởng phòng) | team (trưởng team) | own (còn lại).
//  Xem + ĐỔI TRẠNG THÁI/HUỶ (GAS crmOrderStatus, 4a). Tạo đơn = js/99-d-crm-order.js (bước 2/4); in/trừ kho/dùng điểm = 4b–4d (chưa làm).
//  Đường đi trạng thái ở client CHỈ để hiện nút đúng; server (CRM_ORDER_FLOW_) mới là chỗ quyết định + kiểm quyền (admin hoặc người tạo).
//  Mọi số tiền lấy từ server (đã tự tính lại), client KHÔNG tính lại tiền.
//  Nạp SAU js/40 (registerExtraTab). Gỡ = xoá dòng <script> trong index.html + id 'crmorders' trong js/29.
// ════════════════════════════════════════════════════════════════════
var _CRO_FLOW = { 'Mới':['Đã xác nhận','Hủy'], 'Đã xác nhận':['Đang giao','Hủy'], 'Đang giao':['Đã giao','Hoàn','Hủy'], 'Đã giao':['Hoàn'], 'Hủy':[], 'Hoàn':[] };
var _CRO_SCOPE = { all:'tất cả đơn', dept:'đơn của phòng bạn quản lý', team:'đơn của team bạn làm trưởng', own:'đơn của chính bạn' };
var _cro = { from:'', to:'', q:'', data:null, loading:false, err:'', sel:'', seq:0, pend:null, busy:false, msg:'' };
function _croTok(){ try { return localStorage.getItem('ome_sess_token') || ''; } catch(e){ return ''; } }
function _croPad(n){ return (n < 10 ? '0' : '') + n; }
function _croYmd(d){ return d.getFullYear() + '-' + _croPad(d.getMonth() + 1) + '-' + _croPad(d.getDate()); }
function _croToday(){ return _croYmd(new Date()); }
function _croAddDays(ymd, n){ var m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return ymd; return _croYmd(new Date(+m[1], +m[2] - 1, +m[3] + n)); }
function _croEsc(s){ return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }
function _croVnd(n){ n = Math.round(Number(n) || 0); return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
function _croFold(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim(); }
// createdAt = mili-giây (server) → "dd/mm/yyyy hh:mm" giờ máy người xem.
function _croDmyHm(ts){ var n = Number(ts); if (!n) return ''; var d = new Date(n); if (isNaN(d.getTime())) return ''; return _croPad(d.getDate()) + '/' + _croPad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + _croPad(d.getHours()) + ':' + _croPad(d.getMinutes()); }
// Lọc phía client theo ô tìm: mã đơn, tên/SĐT khách, người nhận, sale, thẻ, người tạo, tên sản phẩm/mã SP.
function _croFiltered(orders, q){
  var f = _croFold(q); if (!f) return (orders || []).slice();
  return (orders || []).filter(function(o){
    var hay = [o.orderId, o.custName, o.phone, o.recvName, o.recvPhone, o.saleName, o.tags, o.createdBy, o.status].concat((o.items || []).map(function(i){ return (i.name || '') + ' ' + (i.code || ''); })).join(' ');
    return _croFold(hay).indexOf(f) > -1;
  });
}
function _croTotals(orders){
  var t = { n: 0, total: 0, paid: 0, due: 0 };
  (orders || []).forEach(function(o){ t.n++; t.total += Number(o.total) || 0; t.paid += Number(o.paid) || 0; t.due += Number(o.due) || 0; });
  return t;
}
function _croKv(label, val){ if (val == null || String(val).trim() === '') return ''; return '<div style="display:flex;gap:6px;font-size:12px;padding:1px 0"><span style="color:var(--muted);min-width:92px">' + _croEsc(label) + '</span><span style="flex:1;word-break:break-word">' + _croEsc(val) + '</span></div>'; }
function _croBlock(title, inner){ if (!inner) return ''; return '<div style="flex:1 1 240px;min-width:220px"><div style="font-size:12px;font-weight:700;margin-bottom:3px">' + _croEsc(title) + '</div>' + inner + '</div>'; }
function _croItemsHtml(items){
  if (!items || !items.length) return '<div style="font-size:12px;color:var(--muted)">Đơn không có dòng sản phẩm.</div>';
  var th = 'padding:4px 6px;text-align:right;font-size:11px;color:var(--muted);font-weight:600', td = 'padding:4px 6px;text-align:right;font-size:12px;border-top:1px solid var(--border)';
  var h = '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="' + th + ';text-align:left">Sản phẩm</th><th style="' + th + '">SL</th><th style="' + th + '">Đơn giá</th><th style="' + th + '">Giảm</th><th style="' + th + '">Thành tiền</th></tr></thead><tbody>';
  items.forEach(function(i){
    var dis = Number(i.discount) || 0, dTxt = dis ? '-' + _croVnd(dis).replace('-', '') + (i.discType === 'pct' && Number(i.discValue) ? ' (' + Number(i.discValue) + '%)' : '') : '';
    h += '<tr><td style="' + td + ';text-align:left">' + (i.code ? '<b>' + _croEsc(i.code) + '</b> · ' : '') + _croEsc(i.name || '') + (i.note ? '<div style="font-size:11px;color:var(--muted)">' + _croEsc(i.note) + '</div>' : '') + (Number(i.tax) ? '<div style="font-size:11px;color:var(--muted)">Thuế ' + (Number(i.taxPct) || 0) + '%: +' + _croVnd(i.tax).replace('-', '') + '</div>' : '') + '</td>' +
      '<td style="' + td + '">' + (Number(i.qty) || 0) + '</td><td style="' + td + '">' + _croVnd(i.price) + '</td><td style="' + td + '">' + _croEsc(dTxt) + '</td><td style="' + td + ';font-weight:600">' + _croVnd(i.amount) + '</td></tr>';
  });
  return h + '</tbody></table></div>';
}
function _croMoneyHtml(o){
  var row = function(l, v, strong, color){ return '<div style="display:flex;justify-content:space-between;gap:10px;font-size:' + (strong ? 13 : 12) + 'px;' + (strong ? 'font-weight:700;border-top:1px solid var(--border);margin-top:3px;padding-top:3px;' : '') + (color ? 'color:' + color + ';' : '') + '"><span>' + _croEsc(l) + '</span><span>' + v + '</span></div>'; };
  var h = row('Tạm tính (' + (Number(o.qty) || 0) + ' sản phẩm)', _croVnd(o.gross));
  if (Number(o.itemDiscount)) h += row('Giảm giá dòng', '-' + _croVnd(o.itemDiscount));
  if (Number(o.orderDiscount)) h += row('Giảm giá đơn', '-' + _croVnd(o.orderDiscount));
  if (Number(o.tax)) h += row('Thuế', _croVnd(o.tax));
  h += row('Phí vận chuyển', _croVnd(o.shipFee));
  if (Number(o.surcharge)) h += row('Phụ thu', _croVnd(o.surcharge));
  h += row('Tiền cần thu', _croVnd(o.total), true);
  h += row('Đã chuyển khoản', _croVnd(o.paid));
  h += row('Còn thiếu', _croVnd(o.due), true, Number(o.due) > 0 ? '#c0392b' : '');
  return '<div style="max-width:340px;margin-left:auto">' + h + '</div>';
}
function _croStatusHtml(o){
  var cur = String(o.status || 'Mới'), next = _CRO_FLOW[cur] || [], pend = _cro.pend && _cro.pend.id === o.orderId ? _cro.pend : null;
  var h = '<div style="margin-bottom:10px;padding:8px 10px;border:1px solid var(--border);border-radius:8px"><div style="font-size:12px"><b>Trạng thái: ' + _croEsc(cur) + '</b>' +
    (o.statusBy ? ' <span style="color:var(--muted)">· ' + _croEsc(o.statusBy) + (_croDmyHm(o.statusAt) ? ' · ' + _croEsc(_croDmyHm(o.statusAt)) : '') + '</span>' : '') + '</div>' +
    (o.statusNote ? '<div style="font-size:12px;margin-top:2px">Lý do: ' + _croEsc(o.statusNote) + '</div>' : '');
  if (!next.length) h += '<div style="font-size:11px;color:var(--muted);margin-top:4px">Trạng thái cuối — không đổi tiếp được (bán tiếp thì lên đơn mới).</div>';
  else if (pend) h += '<div style="margin-top:6px"><div style="font-size:12px;margin-bottom:4px">Lý do ' + (pend.to === 'Hủy' ? 'huỷ' : 'hoàn') + ' đơn (bắt buộc):</div><div style="display:flex;gap:6px;flex-wrap:wrap"><input id="cro-reason" class="ml-q" maxlength="300" placeholder="Nhập lý do…" style="flex:1 1 220px"' + (_cro.busy ? ' disabled' : '') + '>' +
    '<button class="btn sm" style="background:#c0392b;color:#fff;border-color:#c0392b" onclick="_croSubmitReason()"' + (_cro.busy ? ' disabled' : '') + '>Xác nhận ' + _croEsc(pend.to) + '</button><button class="btn sm" onclick="_croCancelPend()"' + (_cro.busy ? ' disabled' : '') + '>Bỏ</button></div></div>';
  else h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' + next.map(function(to){ var bad = to === 'Hủy' || to === 'Hoàn';
    return '<button class="btn sm" data-id="' + _croEsc(o.orderId) + '" data-to="' + _croEsc(to) + '" onclick="_croAskStatus(this.dataset.id,this.dataset.to)" style="' + (bad ? 'color:#c0392b;border-color:#c0392b' : '') + '"' + (_cro.busy ? ' disabled' : '') + '>' + (bad ? '' : '→ ') + _croEsc(to) + '</button>'; }).join('') + '</div>';
  if (_cro.msg && _cro.sel === o.orderId) h += '<div style="font-size:12px;font-weight:600;margin-top:6px">' + _croEsc(_cro.msg) + '</div>';
  return h + '</div>';
}
function _croDetailHtml(o){
  var addr = [o.address, o.ward, o.district, o.province].filter(function(x){ return x && String(x).trim(); }).join(', ');
  var h = '<div style="padding:8px 12px 12px;border-top:1px solid var(--border);background:var(--bg2,transparent)">' + _croStatusHtml(o) + _croItemsHtml(o.items) + '<div style="margin-top:8px">' + _croMoneyHtml(o) + '</div>' +
    '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px">' +
    _croBlock('Khách hàng', _croKv('Tên', o.custName) + _croKv('SĐT', o.phone) + _croKv('Giới tính', o.gender) + _croKv('Email', o.email) + _croKv('Sinh nhật', o.birthday)) +
    _croBlock('Nhận hàng', _croKv('Người nhận', o.recvName) + _croKv('SĐT nhận', o.recvPhone) + _croKv('Địa chỉ', addr) + _croKv('Ngày dự kiến', o.expectedDate) + _croKv('ĐVVC', o.carrier) + _croKv('Mã vận đơn', o.shipCode)) +
    _croBlock('Xử lý đơn', _croKv('Nguồn', o.source) + _croKv('Kho', o.warehouse) + _croKv('Sale', o.saleName) + _croKv('NV đóng hàng', o.packerName) + _croKv('NV CS', o.careName) + _croKv('Marketer', o.marketer) + _croKv('Thẻ', o.tags) + _croKv('Người tạo', o.createdBy) + _croKv('Mã tham chiếu', o.refKey)) +
    '</div>' +
    (o.note ? '<div style="margin-top:8px;font-size:12px"><b>Ghi chú nội bộ:</b> ' + _croEsc(o.note) + '</div>' : '') +
    (o.printNote ? '<div style="margin-top:4px;font-size:12px"><b>Ghi chú để in:</b> ' + _croEsc(o.printNote) + '</div>' : '') + '</div>';
  return h;
}
function _croCardHtml(o, open){
  var due = Number(o.due) || 0;
  return '<div style="border:1px solid var(--border);border-radius:10px;margin-bottom:8px;overflow:hidden">' +
    '<div data-id="' + _croEsc(o.orderId) + '" onclick="_croSel(this.dataset.id)" style="cursor:pointer;padding:8px 12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
    '<b style="font-size:13px">' + _croEsc(o.orderId) + '</b>' +
    '<span style="font-size:11px;padding:1px 8px;border-radius:10px;border:1px solid var(--border)">' + _croEsc(o.status || 'Mới') + '</span>' +
    '<span style="font-size:12px;color:var(--muted)">' + _croEsc(_croDmyHm(o.createdAt)) + '</span>' +
    '<span style="font-size:12px">' + _croEsc(o.custName || '(chưa có tên)') + ' · ' + _croEsc(o.phone) + '</span>' +
    (o.saleName ? '<span style="font-size:12px;color:var(--muted)">Sale: ' + _croEsc(o.saleName) + '</span>' : '') +
    '<span style="margin-left:auto;text-align:right;font-size:12px"><b style="font-size:13px">' + _croVnd(o.total) + '</b>' +
    (due > 0 ? ' <span style="color:#c0392b">· thiếu ' + _croVnd(due) + '</span>' : ' <span style="color:var(--muted)">· đã đủ</span>') + '</span>' +
    '<span style="font-size:11px;color:var(--muted)">' + (open ? '▲' : '▼') + '</span></div>' + (open ? _croDetailHtml(o) : '') + '</div>';
}
function _croSumHtml(list){
  var t = _croTotals(list), cell = function(l, v, c){ return '<div style="padding:6px 12px;border:1px solid var(--border);border-radius:8px"><div style="font-size:11px;color:var(--muted)">' + l + '</div><div style="font-size:15px;font-weight:700;' + (c ? 'color:' + c : '') + '">' + v + '</div></div>'; };
  return '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">' + cell('Số đơn', t.n) + cell('Tổng cần thu', _croVnd(t.total)) + cell('Đã chuyển khoản', _croVnd(t.paid)) + cell('Còn thiếu', _croVnd(t.due), t.due > 0 ? '#c0392b' : '') + '</div>';
}
function _croListHtml(){
  var all = (_cro.data && _cro.data.orders) || [], list = _croFiltered(all, _cro.q);
  if (_cro.loading && !_cro.data) return '<div class="ml-empty">Đang tải…</div>';
  if (_cro.err) return '<div class="ml-empty" style="color:#b91c1c">' + _croEsc(_cro.err) + ' <button class="btn sm" onclick="_croLoad()">Thử lại</button></div>';
  if (!_cro.data) return '';
  var h = _croSumHtml(list);
  if (_cro.data.total > all.length) h += '<div style="font-size:12px;color:#b45309;margin-bottom:6px">⚠ Có ' + _cro.data.total + ' đơn trong khoảng này, chỉ hiện ' + all.length + ' đơn mới nhất — thu hẹp khoảng ngày để xem đủ.</div>';
  if (!list.length) return h + '<div class="ml-empty">' + (all.length ? 'Không có đơn nào khớp ô tìm.' : 'Chưa có đơn CRM nào trong khoảng ngày này.') + '</div>';
  list.forEach(function(o){ h += _croCardHtml(o, _cro.sel === o.orderId); });
  return h;
}
function _croScopeHtml(){ var sc = _cro.data && _cro.data.scope; return sc ? 'Bạn đang xem: <b>' + _croEsc(_CRO_SCOPE[sc] || sc) + '</b>.' : ''; }
function _croRenderList(){ var l = document.getElementById('cro-list'); if (l) l.innerHTML = _croListHtml(); }
function _croRender(){
  var w = document.getElementById('xt-wrap-crmorders'); if (!w) return;
  var btn = function(label, k){ return '<button class="btn sm" onclick="_croSetRange(\'' + k + '\')">' + label + '</button>'; };
  w.innerHTML = '<div style="padding:14px 18px"><div style="font-size:18px;font-weight:700;margin-bottom:4px">🧾 Đơn CRM</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Các đơn CRM tự lên (sheet riêng "Đơn CRM", đang TEST — chưa vào DT Tổng/báo cáo). Bấm một đơn để xem chi tiết.</div>' +
    '<div id="cro-scope" style="font-size:12px;margin-bottom:8px">' + _croScopeHtml() + '</div>' +
    '<div class="ml-bar"><span style="font-size:12px;color:var(--muted)">Từ</span><input type="date" class="ml-q" style="max-width:150px;flex:none" value="' + _croEsc(_cro.from) + '" onchange="_croSetDate(\'from\',this.value)">' +
    '<span style="font-size:12px;color:var(--muted)">đến</span><input type="date" class="ml-q" style="max-width:150px;flex:none" value="' + _croEsc(_cro.to) + '" onchange="_croSetDate(\'to\',this.value)">' +
    btn('Hôm nay', 'today') + btn('7 ngày', '7d') + btn('Tháng này', 'month') + btn('Tất cả', 'all') + '<button class="btn sm" onclick="_croLoad()">↻ Làm mới</button></div>' +
    '<div class="ml-bar"><input id="cro-q" class="ml-q" placeholder="Tìm mã đơn, tên/SĐT khách, sale, sản phẩm…" value="' + _croEsc(_cro.q) + '" oninput="_croSetQ(this.value)"></div>' +
    '<div id="cro-list">' + _croListHtml() + '</div></div>';
}
function _croSel(id){ _cro.sel = (_cro.sel === id) ? '' : id; _cro.pend = null; _cro.msg = ''; _croRenderList(); }
function _croCancelPend(){ _cro.pend = null; _croRenderList(); }
async function _croAskStatus(id, to){
  if (_cro.busy) return; _cro.msg = '';
  if (to === 'Hủy' || to === 'Hoàn'){ _cro.pend = { id: id, to: to }; _croRenderList(); var i = document.getElementById('cro-reason'); if (i && i.focus) i.focus(); return; }
  var okc = (typeof uiConfirm === 'function') ? await uiConfirm('Chuyển đơn ' + id + ' sang "' + to + '"?') : (typeof confirm === 'function' ? confirm('Chuyển đơn ' + id + ' sang "' + to + '"?') : true);
  if (okc) _croSetStatus(id, to, '');
}
function _croSubmitReason(){
  var p = _cro.pend; if (!p || _cro.busy) return; var i = document.getElementById('cro-reason'), note = String(i && i.value || '').trim();
  if (!note){ _cro.msg = '⚠ Phải ghi lý do ' + (p.to === 'Hủy' ? 'huỷ' : 'hoàn') + ' đơn.'; _croRenderList(); return; }
  _croSetStatus(p.id, p.to, note);
}
async function _croSetStatus(id, to, note){
  _cro.busy = true; _cro.msg = ''; _croRenderList();
  try {
    if (typeof gsUrl === 'undefined' || !gsUrl) throw new Error('Chưa cấu hình địa chỉ GAS.');
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'crmOrderStatus', token:_croTok(), orderId:id, status:to, note:note }) }), d = await r.json();
    if (d && d.ok && d.order){
      var l = (_cro.data && _cro.data.orders) || [];
      for (var k = 0; k < l.length; k++) if (l[k].orderId === id){ var keep = l[k]; l[k] = Object.assign({}, keep, d.order, { items: (d.order.items && d.order.items.length) ? d.order.items : keep.items }); break; }
      _cro.pend = null; _cro.msg = d.unchanged ? 'Đơn đã ở trạng thái "' + to + '" rồi.' : '✓ Đã chuyển sang "' + to + '".';
    } else _cro.msg = '❌ ' + ((d && (d.error || d.message)) || 'Không đổi được trạng thái (GAS chưa deploy crmOrderStatus?).');
  } catch(e){ _cro.msg = '❌ Lỗi kết nối: ' + (e && e.message || e); }
  _cro.busy = false; _croRenderList();
}
function _croSetQ(v){ _cro.q = String(v || ''); _croRenderList(); }
function _croSetDate(k, v){ _cro[k] = String(v || ''); _croLoad(); }
function _croSetRange(k){
  var t = _croToday();
  if (k === 'today'){ _cro.from = t; _cro.to = t; }
  else if (k === '7d'){ _cro.from = _croAddDays(t, -6); _cro.to = t; }
  else if (k === 'month'){ _cro.from = t.slice(0, 8) + '01'; _cro.to = t; }
  else { _cro.from = ''; _cro.to = ''; }
  _croLoad();
}
async function _croLoad(){
  var my = ++_cro.seq; _cro.loading = true; _cro.err = '';
  _croRender();
  try {
    if (typeof gsUrl === 'undefined' || !gsUrl) throw new Error('Chưa cấu hình địa chỉ GAS.');
    var url = gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=crmOrders&limit=500&token=' + encodeURIComponent(_croTok()) +
      (_cro.from ? '&from=' + encodeURIComponent(_cro.from) : '') + (_cro.to ? '&to=' + encodeURIComponent(_cro.to) : '');
    var r = await fetch(url, { redirect:'follow' }), d = await r.json();
    if (my !== _cro.seq) return;   // đã có lần tải mới hơn → bỏ kết quả cũ
    if (d && d.ok){ _cro.data = { total: Number(d.total) || (d.orders || []).length, orders: d.orders || [], scope: String(d.scope || '') }; if (_cro.sel && !_cro.data.orders.some(function(o){ return o.orderId === _cro.sel; })) _cro.sel = ''; }
    else { _cro.err = (d && (d.error || d.message)) || 'GAS chưa có action crmOrders — cần deploy lại GAS.'; }
  } catch(e){ if (my !== _cro.seq) return; _cro.err = 'Lỗi kết nối: ' + (e && e.message || e); }
  _cro.loading = false; _croRender();
}
registerExtraTab('crmorders', '🧾 Đơn CRM', function(){ if (!_cro.from && !_cro.to) _cro.from = _croToday().slice(0, 8) + '01', _cro.to = _croToday(); if (_cro.data) _croRender(); _croLoad(); });

// ════════════════════════════════════════════════════════════════════
//  HỒ SƠ KHÁCH → "+ Thêm đơn hàng" / "🛒 Tạo đơn" MỞ ĐÚNG MÀN ➕ TẠO ĐƠN (js/99-d), có sẵn SĐT + tên khách.
//  NGUYÊN NHÂN GỐC (Duyên 28/11): nút "+ Thêm đơn hàng" ở tab Lịch sử đơn của hồ sơ vẫn mở form cũ chỉ có Sản phẩm / Doanh thu gõ tay,
//  KHÔNG chọn sản phẩm từ bảng giá, không địa chỉ/ship/khuyến mãi/điểm/thẻ POS — khác hẳn đơn tạo ở màn Tạo đơn nên số liệu sai.
//  Form cũ (addManualOrder) GIỮ NGUYÊN trong DOM làm dự phòng (nếu file này/js/99-d không nạp, nút tự rơi về form cũ).
//  Nạp SAU js/99-d-crm-order.js. Gỡ = xoá file + thẻ <script> + 2 chỗ gọi (js/03, js/33) tự rơi về form cũ.
// ════════════════════════════════════════════════════════════════════
function _coOpenFromProfile(phone){
  var ph = String(phone == null ? '' : phone).replace(/\D/g, '');
  if (typeof _coNew !== 'function' || typeof switchTab !== 'function') return false;   // thiếu js/99-d → để nơi gọi dùng form cũ
  try { if (typeof closeDp === 'function') closeDp(); } catch(e){}
  var bar = document.querySelector('#data-view .tabs .tab[data-bar-id="taodon"]');
  try { if (bar) bar.click(); else switchTab('taodon', document.querySelector('.tab')); } catch(e){ console.warn('[taodon]', e); return false; }
  try {
    _coNew();                                  // đơn trống (giữ sale/CS/nguồn đã chọn lần trước)
    _co.phone = ph;
    try { var lead = (typeof careLeads !== 'undefined' && careLeads) ? careLeads[ph] : null; if (lead && lead.cs && !_co.source) _co.source = 'Chăm sóc'; } catch(e2){}
    _coRender();
    _coFillCustomer();                         // điền tên/người nhận theo SĐT (có sẵn trên máy, thiếu thì hỏi GAS)
    if (typeof _coLoyLoad === 'function') _coLoyLoad();   // điểm tích luỹ của khách
  } catch(e){ console.warn('[taodon prefill]', e); }
  return true;
}

// ════════════════════════════════════════════════════════════════════
//  TAB 🎫 TICKET (mục 11b, web) — gộp vào file này (không thêm script: trần scriptTags ở tools/test-budget.js).
//  Backend: GAS ticketList / ticketSave / ticketDone (sheet "Ticket"). Hạn xử lý + trễ do SERVER tính (sla.state); quyền xem/đóng do SERVER quyết.
//  Người được giao = cấu hình Settings ticketConfig.owners (chưa điền → người tạo). Gỡ = xoá khối này + id 'ticket' trong js/29.
// ════════════════════════════════════════════════════════════════════
var _tkt = { data: null, status: 'open', loading: false, err: '', seq: 0, busy: false };
function _tktEsc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _tktTok(){ try { return localStorage.getItem('ome_sess_token') || ''; } catch(e){ return ''; } }
function _tktDmyHm(ms){ var n = Number(ms); if (!n) return ''; var d = new Date(n), p = function(x){ return String(x).padStart(2, '0'); }; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
function _tktLeft(min){ min = Math.max(0, Math.round(min)); var h = Math.floor(min / 60), m = min % 60; return h >= 24 ? Math.floor(h / 24) + ' ngày ' + (h % 24) + ' giờ' : (h ? h + ' giờ ' : '') + m + ' phút'; }
function _tktSlaHtml(t){
  var s = t.sla || {}, chip = function(txt, bg, fg){ return '<span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600;background:' + bg + ';color:' + fg + '">' + txt + '</span>'; };
  if (s.state === 'overdue') return chip('⚠ Trễ ' + _tktLeft(s.overdueMinutes), '#fee2e2', '#b91c1c') + ((t.escalateTo || []).length ? ' <span style="font-size:11px;color:#b91c1c">báo: ' + _tktEsc(t.escalateTo.join(', ')) + '</span>' : '');
  if (s.state === 'open') return chip('Còn ' + _tktLeft(s.remainingMinutes), '#dcfce7', '#166534');
  if (s.state === 'done_ontime') return chip('✓ Xong đúng hạn', '#dcfce7', '#166534');
  if (s.state === 'done_late') return chip('✓ Xong trễ ' + _tktLeft(s.overdueMinutes), '#ffedd5', '#9a3412');
  return '';
}
function _tktListHtml(){
  if (_tkt.loading && !_tkt.data) return '<div style="color:var(--muted);padding:14px">Đang tải…</div>';
  if (_tkt.err) return '<div style="color:#dc2626;padding:14px">' + _tktEsc(_tkt.err) + '</div>';
  var rows = (_tkt.data && _tkt.data.rows) || [];
  if (_tkt.status !== 'all') rows = rows.filter(function(t){ return t.status === _tkt.status; });
  if (!rows.length) return '<div style="color:var(--muted);padding:14px">Không có ticket.</div>';
  return rows.map(function(t){
    var who = 'tạo bởi ' + _tktEsc(t.createdBy) + ' · giao ' + _tktEsc(t.assignee || '—') + ' · hạn ' + _tktEsc(_tktDmyHm(t.dueAt));
    return '<div style="border:1px solid ' + (t.sla && t.sla.state === 'overdue' ? '#fca5a5' : 'var(--border)') + ';border-radius:8px;padding:8px 10px;margin-bottom:6px">' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>' + _tktEsc(t.typeLabel) + '</b> · ' + _tktEsc(t.title) + ' ' + _tktSlaHtml(t) +
      (t.status === 'open' ? ' <button class="btn sm" style="margin-left:auto" data-id="' + _tktEsc(t.id) + '" onclick="_tktDone(this.dataset.id)">Đóng</button>' : '') + '</div>' +
      '<div style="font-size:12px;color:var(--muted);margin-top:2px">' + (t.phone ? _tktEsc(t.custName ? t.custName + ' · ' : '') + _tktEsc(t.phone) + ' · ' : '') + who + '</div>' +
      (t.note ? '<div style="font-size:12px;margin-top:2px">' + _tktEsc(t.note) + '</div>' : '') +
      (t.status === 'done' ? '<div style="font-size:12px;color:var(--muted);margin-top:2px">Đóng bởi ' + _tktEsc(t.doneBy) + ' lúc ' + _tktEsc(_tktDmyHm(t.doneAt)) + (t.doneNote ? ' — ' + _tktEsc(t.doneNote) : '') + '</div>' : '') + '</div>';
  }).join('');
}
function _tktRender(){
  var w = document.getElementById('xt-wrap-ticket'); if (!w) return;
  var d = _tkt.data, types = (d && d.types) || { khieu_nai: 'Khiếu nại', ho_tro: 'Hỗ trợ', doi_tra: 'Đổi trả', danh_bong: 'Đánh bóng', bao_hanh: 'Bảo hành', kiem_dinh: 'Kiểm định' };
  var tb = function(label, k){ return '<button class="btn sm' + (_tkt.status === k ? ' primary' : '') + '" onclick="_tktSetStatus(\'' + k + '\')">' + label + '</button>'; };
  var inp = 'padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--card,#fff);color:inherit;box-sizing:border-box';
  w.innerHTML = '<div style="padding:14px 18px"><div style="font-size:18px;font-weight:700;margin-bottom:4px">🎫 Ticket' + (d && d.overdue ? ' <span style="font-size:12px;color:#b91c1c">· ' + d.overdue + ' trễ hạn</span>' : '') + '</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' + tb('Đang mở', 'open') + tb('Đã đóng', 'done') + tb('Tất cả', 'all') + '<button class="btn sm" onclick="_tktLoad()">↻ Làm mới</button></div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px;padding:8px;background:var(--surface2);border-radius:8px">' +
    '<select id="tk-type" style="' + inp + '">' + Object.keys(types).map(function(k){ return '<option value="' + _tktEsc(k) + '">' + _tktEsc(types[k]) + '</option>'; }).join('') + '</select>' +
    '<input id="tk-title" placeholder="Tiêu đề *" style="' + inp + ';flex:1 1 200px"><input id="tk-phone" placeholder="SĐT khách" style="' + inp + ';width:130px"><input id="tk-note" placeholder="Ghi chú" style="' + inp + ';flex:1 1 180px">' +
    (d && d.canManage ? '<input id="tk-assignee" placeholder="Giao cho (tuỳ chọn)" style="' + inp + ';width:150px">' : '') +
    '<button class="btn primary" onclick="_tktCreate()">＋ Tạo ticket</button></div>' +
    '<div id="tk-list">' + _tktListHtml() + '</div></div>';
}
function _tktSetStatus(k){ _tkt.status = k; _tktRender(); }
async function _tktLoad(){
  var my = ++_tkt.seq; _tkt.loading = true; _tkt.err = ''; _tktRender();
  try {
    if (typeof gsUrl === 'undefined' || !gsUrl) throw new Error('Chưa cấu hình địa chỉ GAS.');
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=ticketList&token=' + encodeURIComponent(_tktTok()), { redirect:'follow' }), d = await r.json();
    if (my !== _tkt.seq) return;
    if (d && d.ok) _tkt.data = d; else _tkt.err = (d && (d.error || d.message)) || 'GAS chưa có action ticketList — cần deploy lại GAS.';
  } catch(e){ if (my !== _tkt.seq) return; _tkt.err = 'Lỗi kết nối: ' + (e && e.message || e); }
  _tkt.loading = false; _tktRender();
}
async function _tktPost(body){
  if (_tkt.busy) return false; _tkt.busy = true; body.token = _tktTok();
  try { var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify(body) }), j = await r.json(); if (!j || !j.ok){ toast('❌ ' + ((j && j.error) || 'Không lưu được')); return false; } return true; }
  catch(e){ toast('❌ Lỗi: ' + e.message); return false; } finally { _tkt.busy = false; }
}
async function _tktCreate(){
  var g = function(id){ var e = document.getElementById(id); return e ? e.value : ''; };
  if (!String(g('tk-title')).trim()){ toast('Nhập tiêu đề ticket'); return; }
  if (await _tktPost({ action:'ticketSave', type: g('tk-type'), title: g('tk-title'), phone: g('tk-phone'), note: g('tk-note'), assignee: g('tk-assignee') })){ toast('✓ Đã tạo ticket'); await _tktLoad(); }
}
async function _tktDone(id){
  var note = prompt('Ghi chú xử lý (tuỳ chọn):', ''); if (note === null) return;
  if (await _tktPost({ action:'ticketDone', id: id, note: note })){ toast('✓ Đã đóng ticket'); await _tktLoad(); }
}
if (typeof registerExtraTab === 'function') registerExtraTab('ticket', '🎫 Ticket', function(){ if (_tkt.data) _tktRender(); _tktLoad(); });

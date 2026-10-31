// ═══════════════════════════════════════════════════════════════
//  THƯỞNG PHẠT ĐỘI SALE ONLINE + VĂN PHÒNG (phòng kinh doanh) — mục cuối Báo cáo B (Duyên yêu cầu 2026-10-29)
//  TÁCH RIÊNG các chương trình thưởng của công ty (Báo cáo E/F/G…): không cộng chung, không đổi số của các báo cáo đó.
//  Số liệu từ máy chủ: action teamBonusReport (gas_v13.js, gas/33_TeamBonus.gs). Thưởng tính trên ĐƠN GỐC BASE (ngày tạo), không tính trên Pos.
//  Số đơn (thưởng ngày + đơn Base của tỷ lệ chốt tuần/tháng) tính theo NGƯỜI TẠO ĐƠN (Duyên 2026-10-31); doanh thu ở báo cáo vẫn chia như cũ.
//  Thưởng ngày: nhiều đơn nhất ngày, tối thiểu 6 đơn, không tính đổi trả/bảo hành/thay dây. Thưởng tuần/tháng: tỷ lệ chốt cao nhất,
//  tương tác ≥ trung bình đội. Phạt 5 loại nhập tay (chỉ Admin ghi/xoá). Panel tự tải theo tháng chọn, không phụ thuộc bộ lọc của Báo cáo B.
//  Test: node tools/test-team-bonus-ui.js
// ═══════════════════════════════════════════════════════════════
var _tbState = { month: '', data: null, loading: false, err: '', open: true, tab: 'total', form: { date: '', sale: '', type: '1', amount: '', note: '' }, saving: false, sg: { date: '', data: null, loading: false, err: '', sale: {} } };

function _tbMoney_(n){ n = Number(n) || 0; return (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('vi-VN') + '₫'; }
function _tbEsc_(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function _tbDmy_(ymd){ var q = String(ymd || '').split('-'); return q.length === 3 ? q[2] + '/' + q[1] : String(ymd || ''); }
function _tbDow_(ymd){ var q = String(ymd || '').split('-'); if (q.length !== 3) return ''; var d = new Date(Date.UTC(+q[0], +q[1] - 1, +q[2])).getUTCDay(); return ['CN','T2','T3','T4','T5','T6','T7'][d]; }
function _tbToday_(){ var d = new Date(Date.now() + 7 * 3600 * 1000); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
function _tbTok_(){ try { return localStorage.getItem('ome_sess_token') || ''; } catch(e){ return ''; } }
function _tbPenLabel_(cfg, type){ var l = ''; ((cfg && cfg.penalties) || []).forEach(function(p){ if (p.type === Number(type)) l = p.label; }); return l || ('Loại ' + type); }
function _tbPenShort_(type){ return { 1:'Tin trôi >30p', 2:'Không báo cáo đúng giờ', 3:'Đã đọc không phản hồi', 4:'Đơn gộp không chia doanh thu', 5:'Khai thác mong cầu thiếu hình/ghi âm' }[Number(type)] || ('Loại ' + type); }

// ── HTML từng phần (hàm thuần, test được) ──
function _tbTotalsHtml_(d){
  var rows = d.totals || [];
  if (!rows.length) return '<div style="color:var(--muted);padding:12px">Chưa có nhân viên Online/Văn phòng — vào Báo cáo E → "Phân loại Sale" để xếp nhóm.</div>';
  var h = '<div style="overflow-x:auto"><table class="sr-table" style="width:100%"><thead><tr><th>Sale</th><th style="text-align:right">Thưởng ngày</th><th style="text-align:right">Thưởng tuần</th><th style="text-align:right">Thưởng tháng</th><th style="text-align:right">Tổng thưởng</th><th style="text-align:right">Phạt</th><th style="text-align:right">Thực nhận</th></tr></thead><tbody>';
  var sT = { r: 0, p: 0, n: 0 };
  rows.forEach(function(t){
    sT.r += t.reward; sT.p += t.penalty; sT.n += t.net;
    h += '<tr><td>' + _tbEsc_(t.name) + '</td><td style="text-align:right">' + (t.dayWins ? t.dayWins + ' ngày' : '–') + '</td><td style="text-align:right">' + (t.weekWins ? t.weekWins + ' tuần' : '–') + '</td><td style="text-align:right">' + (t.monthWins ? '✓' : '–') + '</td>' +
      '<td style="text-align:right;color:#16a34a">' + _tbMoney_(t.reward) + '</td><td style="text-align:right;color:' + (t.penalty ? '#dc2626' : 'var(--muted)') + '">' + (t.penalty ? '−' + _tbMoney_(t.penalty) + ' (' + t.penaltyCount + ' lần)' : '–') + '</td><td style="text-align:right"><b style="color:' + (t.net < 0 ? '#dc2626' : '#16a34a') + '">' + _tbMoney_(t.net) + '</b></td></tr>';
  });
  h += '<tr style="font-weight:700;background:var(--surface2)"><td>Tổng</td><td></td><td></td><td></td><td style="text-align:right">' + _tbMoney_(sT.r) + '</td><td style="text-align:right">' + (sT.p ? '−' + _tbMoney_(sT.p) : '–') + '</td><td style="text-align:right">' + _tbMoney_(sT.n) + '</td></tr>';
  return h + '</tbody></table></div><div style="font-size:11px;color:var(--muted);margin-top:6px">Chỉ cộng thưởng ngày/tuần/tháng ĐÃ KẾT THÚC. Mục "tạm tính" ở các tab bên cạnh chưa tính tiền.</div>';
}
function _tbDailyHtml_(d){
  var cfg = d.cfg || {}, rows = (d.daily || []).slice().reverse();
  var h = '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">Sale (người tạo đơn) có nhiều đơn Base nhất trong ngày — đếm theo <b>người tạo đơn</b>, không chia theo Sale bán —, tối thiểu <b>' + (cfg.dailyMinOrders || 6) + ' đơn</b> (không tính đổi trả, bảo hành, thay dây, đơn huỷ/hoàn) — thưởng <b>' + _tbMoney_(cfg.dailyReward) + '</b>/ngày. Bằng nhau thì cùng nhận.</div>' +
    '<div style="overflow-x:auto"><table class="sr-table" style="width:100%"><thead><tr><th>Ngày</th><th>Sale đạt thưởng</th><th style="text-align:right">Số đơn cao nhất</th><th>Top trong ngày</th><th style="text-align:right">Đơn bị loại*</th></tr></thead><tbody>';
  rows.forEach(function(r){
    var st = r.partial ? '<span style="color:#d97706">⏳ tạm tính</span> ' : '';
    var win = r.qualified ? r.winners.map(function(w){ return '<b>' + _tbEsc_(w.name) + '</b>'; }).join(', ') : '<span style="color:var(--muted)">' + (r.top ? 'chưa đủ ' + (cfg.dailyMinOrders || 6) + ' đơn' : 'không có đơn') + '</span>';
    var top = (r.list || []).slice(0, 4).map(function(x){ return _tbEsc_(x.name) + ' ' + x.orders; }).join(' · ');
    h += '<tr><td>' + _tbDow_(r.date) + ' ' + _tbDmy_(r.date) + '</td><td>' + st + win + '</td><td style="text-align:right">' + (r.top || '–') + '</td><td style="font-size:12px;color:var(--muted)">' + top + '</td><td style="text-align:right;color:var(--muted)">' + (r.excluded || 0) + '</td></tr>';
  });
  return h + '</tbody></table></div><div style="font-size:11px;color:var(--muted);margin-top:6px">* Đơn đổi trả / bảo hành / thay dây / huỷ / hoàn trong ngày (không tính vào số đơn thưởng).</div>';
}
function _tbCloseTableHtml_(p, reward){
  var h = '<div style="overflow-x:auto"><table class="sr-table" style="width:100%"><thead><tr><th>#</th><th>Sale</th><th style="text-align:right">Tương tác</th><th style="text-align:right">Đơn Base</th><th style="text-align:right">Tỷ lệ chốt</th><th>Điều kiện</th></tr></thead><tbody>';
  var win = {}; (p.winners || []).forEach(function(w){ win[w.name] = 1; });
  (p.rows || []).forEach(function(r, i){
    h += '<tr' + (win[r.name] ? ' style="background:rgba(22,163,74,.10)"' : '') + '><td>' + (i + 1) + '</td><td>' + (win[r.name] ? '🏆 ' : '') + _tbEsc_(r.name) + '</td><td style="text-align:right">' + (r.held || 0).toLocaleString('vi-VN') + '</td><td style="text-align:right">' + r.closed + '</td><td style="text-align:right"><b>' + r.closeRate + '%</b></td>' +
      '<td style="font-size:12px;color:' + (r.eligible ? '#16a34a' : '#dc2626') + '">' + (r.eligible ? '✓ đủ tương tác' : '✗ tương tác < TB ' + (p.avgHeld || 0)) + '</td></tr>';
  });
  if (!(p.rows || []).length) h += '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:12px">' + (p.noData ? 'Chưa có dữ liệu tương tác Pancake trong kỳ này.' : 'Chưa có số liệu.') + '</td></tr>';
  return h + '</tbody></table></div>';
}
function _tbPeriodsHtml_(d){
  var cfg = d.cfg || {}, h = '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">Tỷ lệ chốt = đơn gốc Base ÷ tương tác Pancake (cùng cách tính Báo cáo A/B). Chỉ xét sale có tương tác kỳ đó ≥ tương tác trung bình của đội. Thưởng tuần <b>' + _tbMoney_(cfg.weeklyReward) + '</b>, thưởng tháng <b>' + _tbMoney_(cfg.monthlyReward) + '</b>.</div>';
  var m = d.monthly;
  if (m) {
    h += '<div class="dash-section-title" style="margin-top:10px">Thưởng THÁNG ' + _tbEsc_(d.month) + (m.partial ? ' <span style="color:#d97706;font-size:12px">⏳ tạm tính đến ' + _tbDmy_(m.effTo) + '</span>' : '') + '</div>';
    h += '<div style="margin:4px 0 8px">' + ((m.winners || []).length ? 'Người dẫn đầu: <b>' + m.winners.map(function(w){ return _tbEsc_(w.name) + ' (' + w.closeRate + '%)'; }).join(', ') + '</b>' + (m.partial ? '' : ' → ' + _tbMoney_(cfg.monthlyReward)) : '<span style="color:var(--muted)">Chưa có người đủ điều kiện.</span>') + '</div>' + _tbCloseTableHtml_(m);
  }
  (d.weekly || []).slice().reverse().forEach(function(w){
    h += '<div class="dash-section-title" style="margin-top:14px">Thưởng TUẦN ' + _tbEsc_(w.label) + (w.partial ? ' <span style="color:#d97706;font-size:12px">⏳ tạm tính đến ' + _tbDmy_(w.effTo) + '</span>' : '') + '</div>';
    h += '<div style="margin:4px 0 8px">' + ((w.winners || []).length ? 'Người dẫn đầu: <b>' + w.winners.map(function(x){ return _tbEsc_(x.name) + ' (' + x.closeRate + '%)'; }).join(', ') + '</b>' + (w.partial ? '' : ' → ' + _tbMoney_(cfg.weeklyReward)) : '<span style="color:var(--muted)">Chưa có người đủ điều kiện.</span>') + '</div>' + _tbCloseTableHtml_(w);
  });
  return h;
}
function _tbPenaltiesHtml_(d){
  var cfg = d.cfg || {}, h = '';
  if (d.canEdit) {
    var f = _tbState.form, teamOpts = (d.team || []).map(function(m){ return '<option value="' + _tbEsc_(m.name) + '"' + (f.sale === m.name ? ' selected' : '') + '>' + _tbEsc_(m.name) + '</option>'; }).join('');
    var typeOpts = (cfg.penalties || []).map(function(p){ return '<option value="' + p.type + '"' + (String(f.type) === String(p.type) ? ' selected' : '') + '>' + p.type + '. ' + _tbEsc_(_tbPenShort_(p.type)) + ' (' + _tbMoney_(p.amount) + ')</option>'; }).join('');
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;padding:10px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px">' +
      '<label style="font-size:12px">Ngày<br><input type="date" id="tb-f-date" value="' + _tbEsc_(f.date || _tbToday_()) + '" onchange="_tbState.form.date=this.value"></label>' +
      '<label style="font-size:12px">Sale<br><select id="tb-f-sale" onchange="_tbState.form.sale=this.value"><option value="">— chọn —</option>' + teamOpts + '</select></label>' +
      '<label style="font-size:12px">Lỗi vi phạm<br><select id="tb-f-type" onchange="_tbFormType(this.value)">' + typeOpts + '</select></label>' +
      '<label style="font-size:12px">Số tiền<br><input type="number" id="tb-f-amount" min="0" step="1000" style="width:100px" placeholder="mặc định" value="' + _tbEsc_(f.amount) + '" oninput="_tbState.form.amount=this.value"></label>' +
      '<label style="font-size:12px;flex:1;min-width:160px">Ghi chú<br><input type="text" id="tb-f-note" style="width:100%" maxlength="300" placeholder="vd: khách 09xx, tin trôi 45 phút" value="' + _tbEsc_(f.note) + '" oninput="_tbState.form.note=this.value"></label>' +
      '<button class="btn sm" onclick="_tbSavePenalty()"' + (_tbState.saving ? ' disabled' : '') + '>' + (_tbState.saving ? 'Đang lưu…' : '➕ Ghi phạt') + '</button></div>';
  }
  if (d.canEdit) h += _tbSuggestHtml_(d);
  var pen = d.penalties || [];
  h += '<div style="overflow-x:auto"><table class="sr-table" style="width:100%"><thead><tr><th>Ngày</th><th>Sale</th><th>Lỗi</th><th style="text-align:right">Số tiền</th><th>Ghi chú</th><th>Người ghi</th>' + (d.canEdit ? '<th></th>' : '') + '</tr></thead><tbody>';
  pen.forEach(function(e){
    h += '<tr><td>' + _tbDmy_(e.date) + '</td><td>' + _tbEsc_(e.sale) + '</td><td title="' + _tbEsc_(_tbPenLabel_(cfg, e.type)) + '">' + e.type + '. ' + _tbEsc_(_tbPenShort_(e.type)) + '</td><td style="text-align:right;color:#dc2626">−' + _tbMoney_(e.amount) + '</td><td style="font-size:12px">' + _tbEsc_(e.note) + '</td><td style="font-size:12px;color:var(--muted)">' + _tbEsc_(e.by) + '</td>' +
      (d.canEdit ? '<td><button class="btn sm secondary" onclick="_tbDeletePenalty(\'' + _tbEsc_(e.id) + '\')" title="Xoá dòng này">🗑</button></td>' : '') + '</tr>';
  });
  if (!pen.length) h += '<tr><td colspan="' + (d.canEdit ? 7 : 6) + '" style="text-align:center;color:var(--muted);padding:12px">Chưa có ghi nhận phạt trong tháng ' + _tbEsc_(d.month) + '.</td></tr>';
  h += '</tbody></table></div>';
  h += '<details style="margin-top:10px;font-size:12px"><summary style="cursor:pointer;color:var(--muted)">Quy định phạt</summary><ol style="margin:6px 0 0 18px;padding:0">' + (cfg.penalties || []).map(function(p){ return '<li>' + _tbEsc_(p.label) + ' — <b>' + _tbMoney_(p.amount) + '</b></li>'; }).join('') + '</ol></details>';
  return h;
}
function _tbPanelBodyHtml_(){
  var d = _tbState.data, t = _tbState.tab;
  if (_tbState.loading && !d) return '<div style="padding:16px;color:var(--muted)">Đang tải thưởng phạt…</div>';
  if (_tbState.err && !d) return '<div style="color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;font-size:13px">⚠️ ' + _tbEsc_(_tbState.err) + ' <button class="btn sm" onclick="_tbLoad(true)">🔄 Thử lại</button></div>';
  if (!d) return '';
  var tabs = [['total', '💰 Tổng hợp'], ['day', '📅 Thưởng ngày'], ['period', '🏆 Tuần / tháng'], ['pen', '⚠️ Phạt (' + (d.penalties || []).length + ')']];
  var h = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + tabs.map(function(x){ return '<button class="btn sm' + (t === x[0] ? '' : ' secondary') + '" onclick="_tbTab(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div>';
  if (_tbState.err) h += '<div style="color:#b91c1c;font-size:12px;margin-bottom:6px">⚠️ ' + _tbEsc_(_tbState.err) + '</div>';
  h += t === 'day' ? _tbDailyHtml_(d) : t === 'period' ? _tbPeriodsHtml_(d) : t === 'pen' ? _tbPenaltiesHtml_(d) : _tbTotalsHtml_(d);
  return h;
}
// Khung panel (gắn vào cuối Báo cáo B). Lần đầu hiện ra thì tự tải.
function _tbPanelHtml_(){
  if (!_tbState.month) _tbState.month = _tbToday_().substring(0, 7);
  if (!_tbState.data && !_tbState.loading && !_tbState.err && _tbState.open) setTimeout(function(){ _tbLoad(false); }, 0);
  var h = '<div id="tb-panel" style="margin-top:22px;border:1.5px solid #d97706;border-radius:12px;padding:12px 14px">' +
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div class="dash-section-title" style="margin:0;flex:1;min-width:220px;cursor:pointer" onclick="_tbToggle()">' + (_tbState.open ? '▾' : '▸') + ' 🏅 Thưởng phạt đội Sale Online + Văn phòng <span style="font-size:11px;font-weight:400;color:var(--muted)">(riêng, không cộng vào các chương trình thưởng công ty)</span></div>';
  if (_tbState.open) h += '<input type="month" value="' + _tbEsc_(_tbState.month) + '" onchange="_tbSetMonth(this.value)" title="Chọn tháng"><button class="btn sm secondary" onclick="_tbLoad(true)" title="Tải lại">🔄</button>' + (typeof _tbExportXlsx === 'function' ? '<button class="btn sm" onclick="_tbExportXlsx()">📥 Xuất Excel</button>' : '');
  h += '</div>';
  if (_tbState.open) h += '<div id="tb-body" style="margin-top:10px">' + _tbPanelBodyHtml_() + '</div>';
  return h + '</div>';
}
function _tbRepaint_(){ var el = document.getElementById('tb-body'); if (el) el.innerHTML = _tbPanelBodyHtml_(); }
function _tbToggle(){ _tbState.open = !_tbState.open; var p = document.getElementById('tb-panel'); if (p) p.outerHTML = _tbPanelHtml_(); }
function _tbTab(t){ _tbState.tab = t; _tbRepaint_(); }
function _tbSetMonth(v){ if (!/^\d{4}-\d{2}$/.test(v || '')) return; _tbState.month = v; _tbState.data = null; _tbState.err = ''; _tbLoad(false); }
function _tbFormType(v){ _tbState.form.type = v; _tbState.form.amount = ''; var a = document.getElementById('tb-f-amount'); if (a) a.value = ''; }
async function _tbLoad(force){
  if (!gsUrl) { _tbState.err = 'Chưa kết nối Google Apps Script (gsUrl trống).'; _tbRepaint_(); return; }
  _tbState.loading = true; _tbState.err = ''; if (!_tbState.data) _tbRepaint_();
  try {
    var sep = gsUrl.indexOf('?') >= 0 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=teamBonusReport&month=' + encodeURIComponent(_tbState.month) + '&token=' + encodeURIComponent(_tbTok_()) + (force ? '&nocache=1' : ''), { redirect: 'follow' });
    var txt = await r.text(), j = null;
    try { j = JSON.parse(txt); } catch (eP) { throw new Error('Máy chủ trả dữ liệu không đọc được (có thể đang quá tải hoặc chưa deploy GAS bản mới) — thử lại sau ít phút.'); }
    if (!j || j.ok === false || j.error) throw new Error((j && j.error) || 'Lỗi không rõ');
    _tbState.data = j;
  } catch (e) { _tbState.err = (e && e.message) || String(e); }
  _tbState.loading = false; _tbRepaint_();
}
async function _tbPost_(body){
  body.token = _tbTok_();
  var r = await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify(body) });
  var txt = await r.text(), j = null; try { j = JSON.parse(txt); } catch (e) { throw new Error('Máy chủ trả dữ liệu không đọc được.'); }
  if (!j || j.ok === false || j.error) throw new Error((j && j.error) || 'Lỗi không rõ');
  return j;
}
async function _tbSavePenalty(){
  var f = _tbState.form, d = _tbState.data;
  var date = f.date || _tbToday_();
  if (!f.sale) { alert('Chọn sale bị phạt.'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { alert('Ngày không hợp lệ.'); return; }
  _tbState.saving = true; _tbRepaint_();
  try {
    await _tbPost_({ action: 'teamPenaltySave', date: date, sale: f.sale, type: Number(f.type), amount: f.amount === '' ? '' : Number(f.amount), note: f.note });
    _tbState.form = { date: date, sale: f.sale, type: f.type, amount: '', note: '' };
    if (date.substring(0, 7) !== _tbState.month) _tbState.month = date.substring(0, 7);
    _tbState.saving = false; await _tbLoad(true);
  } catch (e) { _tbState.saving = false; _tbState.err = 'Không ghi được: ' + e.message; _tbRepaint_(); }
}
// ── Gợi ý phạt tự động từ tin nhắn Pancake (chỉ gợi ý, Admin bấm "Ghi phạt" mới tính) ──
function _tbSuggestHtml_(d){
  var g = _tbState.sg, date = g.date || _tbToday_();
  var h = '<div style="border:1px dashed #d97706;border-radius:10px;padding:10px;margin-bottom:10px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b style="font-size:13px">🤖 Gợi ý phạt từ tin nhắn Pancake</b>' +
    '<input type="date" id="tb-sg-date" value="' + _tbEsc_(date) + '" onchange="_tbState.sg.date=this.value;_tbState.sg.data=null">' +
    '<button class="btn sm" onclick="_tbSuggestLoad()"' + (g.loading ? ' disabled' : '') + '>' + (g.loading ? 'Đang quét…' : '🔍 Quét ngày này') + '</button>' +
    '<span style="font-size:11px;color:var(--muted)">Chỉ là gợi ý (tính cả ngày đêm). Không phát hiện được tin "nhảy từ Sale khác"; đơn gộp 72h đối chiếu theo SĐT trên đơn Base — kiểm tra trước khi ghi.</span></div>';
  if (g.err) h += '<div style="color:#b91c1c;font-size:12px;margin-top:6px">⚠️ ' + _tbEsc_(g.err) + '</div>';
  var sd = g.data;
  if (sd) {
    var items = sd.items || [], teamOpts = function(sel){ return (d.team || []).map(function(m){ return '<option value="' + _tbEsc_(m.name) + '"' + (sel === m.name ? ' selected' : '') + '>' + _tbEsc_(m.name) + '</option>'; }).join(''); };
    if (sd.truncated) h += '<div style="font-size:12px;color:#b45309;margin-top:6px">⚠️ Ngày này nhiều tin, mới quét một phần — kết quả có thể thiếu.</div>';
    h += '<div style="font-size:12px;color:var(--muted);margin:6px 0">' + items.length + ' gợi ý' + (sd.hidden ? ' (đã ẩn ' + sd.hidden + ' dòng đã ghi/bỏ qua)' : '') + ' · đã quét ' + (sd.scanned || 0) + ' tin</div>';
    if (items.length) {
      h += '<div style="overflow-x:auto;max-height:340px;overflow-y:auto"><table class="sr-table" style="width:100%"><thead><tr><th>Lỗi</th><th>Khách</th><th>Khách nhắn / Chi tiết đơn</th><th>Chờ</th><th>Sale</th><th></th></tr></thead><tbody>';
      items.forEach(function(x, i){
        var hm = function(iso){ var t = new Date(Date.parse(iso) + 7 * 3600 * 1000); return String(t.getUTCHours()).padStart(2, '0') + ':' + String(t.getUTCMinutes()).padStart(2, '0'); };
        var cur = g.sale[x.key] != null ? g.sale[x.key] : x.sale;
        h += '<tr><td>' + x.type + '. ' + _tbEsc_(_tbPenShort_(x.type)) + '</td><td style="font-size:12px">' + _tbEsc_(x.customer) + (x.phone ? '<br><span style="color:var(--muted)">' + _tbEsc_(x.phone) + '</span>' : '') + '</td>' +
          (x.orderId ? '<td colspan="2" style="font-size:12px">Đơn <b>' + _tbEsc_(x.orderId) + '</b> (' + _tbEsc_(x.ngayTao) + ', Sale bán: ' + _tbEsc_(x.orderSales) + ') <span style="color:#dc2626">thiếu ' + _tbEsc_((x.missing || []).join(', ')) + '</span> so với đơn trước: ' + _tbEsc_((x.refs || []).map(function(q){ return q.id + ' ' + q.ngayTao + ' (' + q.sales + ')'; }).join('; ')) + '</td>' : '<td>' + hm(x.inAt) + (x.open ? ' <span style="color:#dc2626;font-size:11px">(chưa trả lời)</span>' : ' → ' + hm(x.outAt)) + '</td><td style="text-align:right">' + x.gapMin + 'p</td>') +
          '<td><select onchange="_tbState.sg.sale[_tbState.sg.data.items[' + i + '].key]=this.value"><option value="">— chọn —</option>' + teamOpts(cur) + '</select>' + (x.saleRaw && !x.sale ? '<div style="font-size:11px;color:var(--muted)">' + _tbEsc_(x.saleRaw) + '</div>' : '') + '</td>' +
          '<td style="white-space:nowrap"><button class="btn sm" onclick="_tbSuggestAccept(' + i + ')">Ghi phạt</button> <button class="btn sm secondary" onclick="_tbSuggestIgnore(' + i + ')">Bỏ qua</button></td></tr>';
      });
      h += '</tbody></table></div>';
    }
  }
  return h + '</div>';
}
async function _tbSuggestLoad(){
  var g = _tbState.sg, date = g.date || _tbToday_(); g.date = date; g.loading = true; g.err = ''; _tbRepaint_();
  try {
    var sep = gsUrl.indexOf('?') >= 0 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=teamPenaltySuggest&date=' + encodeURIComponent(date) + '&token=' + encodeURIComponent(_tbTok_()), { redirect: 'follow' });
    var j = JSON.parse(await r.text());
    if (!j || j.ok === false) throw new Error((j && j.error) || 'Lỗi không rõ');
    g.data = j;
  } catch (e) { g.err = (e && e.message) || String(e); }
  g.loading = false; _tbRepaint_();
}
async function _tbSuggestAccept(i){
  var g = _tbState.sg, x = g.data && g.data.items[i]; if (!x) return;
  var sale = g.sale[x.key] != null ? g.sale[x.key] : x.sale;
  if (!sale) { alert('Chọn sale bị phạt cho dòng này.'); return; }
  var note = x.orderId ? ('Đơn gộp ' + x.orderId + ' thiếu chia cho ' + (x.missing || []).join(', ') + ' (đơn trước ' + (x.refs || []).map(function(q){ return q.id; }).join(', ') + ') [pk:' + x.key + ']') : ((x.customer || x.phone || 'Khách') + (x.phone ? ' ' + x.phone : '') + ': chờ ' + x.gapMin + ' phút' + (x.open ? ' chưa trả lời' : '') + ' [pk:' + x.key + ']');
  try {
    await _tbPost_({ action: 'teamPenaltySave', date: g.date || _tbToday_(), sale: sale, type: x.type, amount: '', note: note.slice(0, 300) });
    g.data.items.splice(i, 1); g.data.hidden = (g.data.hidden || 0) + 1;
    if ((g.date || _tbToday_()).substring(0, 7) === _tbState.month) await _tbLoad(true); else _tbRepaint_();
  } catch (e) { g.err = 'Không ghi được: ' + e.message; _tbRepaint_(); }
}
async function _tbSuggestIgnore(i){
  var g = _tbState.sg, x = g.data && g.data.items[i]; if (!x) return;
  try { await _tbPost_({ action: 'teamPenaltyIgnore', key: x.key }); g.data.items.splice(i, 1); g.data.hidden = (g.data.hidden || 0) + 1; _tbRepaint_(); }
  catch (e) { g.err = 'Không bỏ qua được: ' + e.message; _tbRepaint_(); }
}
async function _tbDeletePenalty(id){
  if (!confirm('Xoá dòng phạt này?')) return;
  try { await _tbPost_({ action: 'teamPenaltyDelete', id: id }); await _tbLoad(true); }
  catch (e) { _tbState.err = 'Không xoá được: ' + e.message; _tbRepaint_(); }
}

// ── Xuất Excel (dữ liệu tháng đang xem) — 5 sheet: Tổng hợp, Thưởng ngày, Tuần-tháng, Nhật ký phạt, Quy định. Dùng XLSX (SheetJS) như các báo cáo khác. ──
function _tbExportRows_(d){
  var cfg = d.cfg || {}, sum = [['Sale', 'Thưởng ngày (đ)', 'Số ngày thắng', 'Thưởng tuần (đ)', 'Số tuần thắng', 'Thưởng tháng (đ)', 'Tổng thưởng (đ)', 'Phạt (đ)', 'Số lần phạt', 'Thực nhận (đ)']];
  var byName = {}; (d.rewards || []).forEach(function(r){ var o = byName[r.name] || (byName[r.name] = { day: 0, week: 0, month: 0 }); o[r.kind] += r.amount; });
  (d.totals || []).forEach(function(t){ var o = byName[t.name] || { day: 0, week: 0, month: 0 }; sum.push([t.name, o.day, t.dayWins, o.week, t.weekWins, o.month, t.reward, t.penalty, t.penaltyCount, t.net]); });
  var day = [['Ngày', 'Trạng thái', 'Sale đạt thưởng', 'Số đơn cao nhất', 'Top trong ngày', 'Đơn bị loại (đổi trả/BH/huỷ…)', 'Thưởng (đ)']];
  (d.daily || []).forEach(function(r){ day.push([r.date, r.partial ? 'Tạm tính' : (r.qualified ? 'Đạt' : 'Chưa đủ ' + (cfg.dailyMinOrders || 6) + ' đơn'), r.qualified ? r.winners.map(function(w){ return w.name; }).join(', ') : '', r.top || 0, (r.list || []).slice(0, 5).map(function(x){ return x.name + ' ' + x.orders; }).join(' · '), r.excluded || 0, (r.qualified && !r.partial) ? r.winners.length * (cfg.dailyReward || 0) : 0]); });
  var per = [['Loại kỳ', 'Kỳ', 'Trạng thái', 'Sale', 'Tương tác', 'Đơn Base', 'Tỷ lệ chốt (%)', 'TB tương tác đội', 'Đủ điều kiện', 'Top (x)', 'Thưởng (đ)']];
  function addP(kind, label, p, amt){ var win = {}; (p.winners || []).forEach(function(w){ win[w.name] = 1; }); (p.rows || []).forEach(function(r){ per.push([kind, label, p.partial ? 'Tạm tính' : 'Đã kết thúc', r.name, r.held, r.closed, r.closeRate, p.avgHeld, r.eligible ? 'Đủ' : 'Không đủ', win[r.name] ? 'x' : '', (win[r.name] && !p.partial) ? amt : 0]); }); }
  (d.weekly || []).forEach(function(w){ addP('Tuần', w.label, w, cfg.weeklyReward || 0); });
  if (d.monthly) addP('Tháng', d.month, d.monthly, cfg.monthlyReward || 0);
  var pen = [['Ngày', 'Sale', 'Mã lỗi', 'Nội dung', 'Số tiền (đ)', 'Ghi chú', 'Người ghi']];
  (d.penalties || []).forEach(function(e){ pen.push([e.date, e.sale, e.type, _tbPenLabel_(cfg, e.type), e.amount, e.note, e.by]); });
  var rule = [['Mục', 'Nội dung', 'Số tiền (đ)'], ['Thưởng ngày', 'Nhiều đơn Base nhất trong ngày (đếm theo NGƯỜI TẠO ĐƠN), tối thiểu ' + (cfg.dailyMinOrders || 6) + ' đơn (không tính đổi trả/bảo hành/thay dây)', cfg.dailyReward], ['Thưởng tuần', 'Tỷ lệ chốt cao nhất tuần (tương tác ≥ TB đội)', cfg.weeklyReward], ['Thưởng tháng', 'Tỷ lệ chốt cao nhất tháng (tương tác ≥ TB đội)', cfg.monthlyReward]];
  (cfg.penalties || []).forEach(function(p){ rule.push(['Phạt ' + p.type, p.label, p.amount]); });
  return { sum: sum, day: day, per: per, pen: pen, rule: rule };
}
function _tbExportXlsx(){
  var d = _tbState.data;
  if (!d) { alert('Chưa có dữ liệu — đợi tải xong rồi bấm lại.'); return; }
  if (typeof XLSX === 'undefined') { alert('Thư viện xuất Excel chưa tải xong — thử lại sau vài giây.'); return; }
  var x = _tbExportRows_(d), wb = XLSX.utils.book_new();
  [['Tong hop', x.sum], ['Thuong ngay', x.day], ['Thuong tuan-thang', x.per], ['Nhat ky phat', x.pen], ['Quy dinh', x.rule]].forEach(function(s){ XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s[1]), s[0]); });
  XLSX.writeFile(wb, 'ThuongPhat_DoiSale_' + d.month + '.xlsx');
}

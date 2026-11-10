// ═══ BÁO CÁO K — CHỐT THÁNG (Duyên yêu cầu 2026-11-10) ═══
// Chỉ sale thuộc phòng kinh doanh (đội Online + Văn phòng) và phòng ban Sale; chỉ 2 số: Doanh thu và Doanh thu sau hoàn/hủy.
// Nguồn: GAS posMonthK (gas_v13.js posKReport_). Trừ hoàn/hủy = số lúc CHỐT tháng trước − số tính lại hiện tại; chưa chốt tháng trước thì không trừ.
// Nút "Chốt tháng" dùng lại _srPosMonthClose_ (js/11) — chỉ Admin. Báo cáo B giờ tính bình thường, không còn khối chốt.
function _srKMonth_(){
  if (!_srState.kMonth) { var n = new Date(); _srState.kMonth = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0'); }
  return _srState.kMonth;
}
function _srKSetMonth_(v){ if (!/^\d{4}-\d{2}$/.test(String(v || ''))) return; _srState.kMonth = v; _srLoad(); }
function _srKShift_(d){ var p = _srKMonth_().split('-'), t = new Date(+p[0], +p[1] - 1 + d, 1); _srKSetMonth_(t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0')); }
async function _srKLoad_(){
  _srState.dataK = await _srFetch('posMonthK', { month: _srKMonth_() });
}
function _srKCsv_(){
  var d = _srState.dataK; if (!d || !d.ok) return;
  var q = function(s){ return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
  var lines = [['Sale', 'Nhóm', 'Doanh thu', 'Trừ hoàn/hủy ' + d.prevMonth, 'Doanh thu sau hoàn/hủy'].map(q).join(',')];
  (d.rows || []).forEach(function(r){ lines.push([q(r.name), q(r.group), r.revenue, r.deduction, r.net].join(',')); });
  lines.push([q('TỔNG'), q(''), d.total.revenue, d.total.deduction, d.total.net].join(','));
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = 'BaoCao_K_ChotThang_' + d.month + '.csv'; document.body.appendChild(a); a.click(); a.remove();
}
function _srKBodyHtml_(d){
  if (_srState.loading) return '<div style="color:var(--muted);text-align:center;padding:40px">Đang tải...</div>';
  if (!d || !d.ok) return '<div style="color:#dc2626;padding:12px">Không tải được: ' + esc((d && d.error) || _srState.lastFetchError || 'lỗi không rõ') + '</div>';
  var cell = 'padding:8px 10px;border-bottom:1px solid var(--border)', num = cell + ';text-align:right;white-space:nowrap';
  var h = '';
  if (!d.applied) h += '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px 10px;margin-bottom:10px;font-size:12px">⚠ ' + esc(d.reason || '') + '</div>';
  else h += '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Đã trừ phần hoàn/hủy phát sinh của tháng <b>' + esc(d.prevMonth) + '</b> sau mốc chốt ' + esc(d.closedAt) + '.</div>';
  h += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">' +
    '<div style="flex:1;min-width:150px;border:1px solid var(--border);border-radius:8px;padding:10px 12px"><div style="font-size:11px;color:var(--muted)">Doanh thu</div><div style="font-size:20px;font-weight:700">' + _srMoney(d.total.revenue) + '</div></div>' +
    '<div style="flex:1;min-width:150px;border:1px solid var(--border);border-radius:8px;padding:10px 12px"><div style="font-size:11px;color:var(--muted)">Doanh thu sau hoàn/hủy</div><div style="font-size:20px;font-weight:700">' + _srMoney(d.total.net) + '</div></div></div>';
  h += '<div style="overflow-x:auto"><table class="dash-table" style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;' + cell + '">Sale</th><th style="text-align:left;' + cell + '">Nhóm</th>' +
    '<th style="' + num + '">Doanh thu</th><th style="' + num + '">Trừ hoàn/hủy ' + esc(d.prevMonth) + '</th><th style="' + num + '">Sau hoàn/hủy</th></tr></thead><tbody>';
  (d.rows || []).forEach(function(r){
    h += '<tr><td style="' + cell + '">' + esc(r.name) + '</td><td style="' + cell + ';color:var(--muted)">' + esc(r.group) + '</td><td style="' + num + '">' + _srMoney(r.revenue) + '</td>' +
      '<td style="' + num + ';color:' + (r.deduction ? '#dc2626' : 'var(--muted)') + '">' + (r.deduction ? ((r.deduction > 0 ? '−' : '+') + _srMoney(Math.abs(r.deduction))) : '—') + '</td>' +
      '<td style="' + num + ';font-weight:600">' + _srMoney(r.net) + '</td></tr>';
  });
  if (!(d.rows || []).length) h += '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:16px">Chưa có sale nào thuộc phòng kinh doanh / phòng Sale có doanh thu trong tháng này.</td></tr>';
  else h += '<tr style="font-weight:700"><td style="' + cell + '" colspan="2">TỔNG (' + d.rows.length + ' sale)</td><td style="' + num + '">' + _srMoney(d.total.revenue) + '</td><td style="' + num + '">' + (d.total.deduction ? '−' + _srMoney(d.total.deduction) : '—') + '</td><td style="' + num + '">' + _srMoney(d.total.net) + '</td></tr>';
  return h + '</tbody></table></div>';
}
function _srKCloseHtml_(d){
  if (!_srIsAdmin()) return '';
  var prev = (d && d.prevMonth) || '', cm = (d && d.closedMonths) || [];
  var closeDef = (d && d.canClose) ? _srKMonth_() : prev;
  return '<div class="dash-section-title" style="margin-top:22px">🔒 Chốt tháng</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Làm vào <b>ngày cuối tháng</b> (hoặc mùng 1) sau khi cập nhật đủ dữ liệu: bấm <b>Chốt</b> để lưu mốc doanh thu. Đơn của tháng đã chốt bị hoàn/hủy về sau sẽ tự trừ vào tháng kế tiếp.' +
    (cm.length ? ' Đã chốt: <b>' + cm.map(esc).join(', ') + '</b>.' : ' Chưa chốt tháng nào.') + '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span style="font-size:12px">Chốt tháng:</span>' +
    '<input type="month" id="sr-posm-close" value="' + esc(closeDef) + '" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">' +
    '<button class="btn sm" onclick="_srPosMonthClose_()">🔒 Chốt tháng này làm mốc</button></div>';
}
function renderSalesReportTabK_(wrap, subTabs){
  var m = _srKMonth_(), inp = 'padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)';
  var date = '<button class="btn sm" onclick="_srKShift_(-1)" title="Tháng trước">◀</button>' +
    '<input type="month" value="' + esc(m) + '" onchange="_srKSetMonth_(this.value)" style="' + inp + '">' +
    '<button class="btn sm" onclick="_srKShift_(1)" title="Tháng sau">▶</button>' +
    '<button class="btn sm secondary" onclick="_srKCsv_()" title="Tải bảng này (CSV)">⬇ CSV</button>';
  var d = _srState.dataK;
  wrap.innerHTML = _srBarHtml_(date) +
    '<div style="font-size:12px;color:var(--muted);margin:6px 0 10px">Báo cáo chốt tháng — chỉ sale phòng kinh doanh (Online, Văn phòng) và phòng Sale · chỉ doanh thu và doanh thu sau hoàn/hủy.</div>' +
    _srKBodyHtml_(d) + (_srState.loading ? '' : _srKCloseHtml_(d));
}
if (typeof module !== 'undefined') module.exports = { _srKBodyHtml_: _srKBodyHtml_ };

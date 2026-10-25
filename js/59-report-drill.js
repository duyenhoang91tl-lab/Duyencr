// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  BẤM Ô BÁO CÁO → XEM ĐƠN CHI TIẾT (2026-10-25, Duyên yêu cầu: "các ô báo cáo bấm vào cũng xem được thông tin dữ liệu chi tiết")
//  Phạm vi bước 1: Báo cáo A (Base) + B (Pos). Bấm: ô số liệu đầu trang (Số lượng đơn / Tổng doanh thu) và từng dòng của các bảng
//  Theo Sale / Team / Kênh (A) · Nguồn (B) / MKT / Sản phẩm (B) → cửa sổ nổi liệt kê ĐƠN của ô đó + tổng + Xuất Excel.
//  Số liệu: GAS trả mỗi đơn kèm phần nó đóng góp cho từng dòng (bs = theo Sale, bt = theo Team; tính ngay tại vòng tổng hợp) nên tổng ở cửa sổ
//  KHỚP bảng. Kênh/Nguồn/MKT(B)/Sản phẩm suy trực tiếp từ trường của đơn; MKT(A) theo trọng số kênh d.mktKenh.
//  Gắn vào bảng: js/11 gọi _srDrillAttr_(kind, key) (định nghĩa ở js/11 để test cũ chỉ nạp js/11 vẫn chạy) ở thẻ <tr>/ô KPI; 1 trình nghe click ở document mở cửa sổ. SĐT trong bảng bấm mở hồ sơ khách
//  (cửa sổ nằm DƯỚI ngăn hồ sơ khách z-index 300). Test: node tools/test-report-drill.js.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var _srDrill = { kind: '', key: '', rows: [], limit: 300, meta: null };

function _srDrillSumPairs_(pairs, key){
  var s = null; (pairs || []).forEach(function(p){ if (p && p[0] === key) s = (s || 0) + (Number(p[1]) || 0); }); return s;
}
function _srDrillSplit_(v, sep){ return String(v == null ? '' : v).split(sep).map(function(x){ return x.trim(); }).filter(Boolean); }

// Tính danh sách đơn của 1 ô. Trả { ok, rows:[{o, share, extra}], msg, tableRow, label }.
function _srDrillCompute_(kind, key){
  var isB = kind.charAt(0) === 'b', d = isB ? _srState.dataB : _srState.dataA;
  if (!d || !d.orders) return { ok: false, msg: 'Chưa có dữ liệu — bấm "Lọc" để tải báo cáo rồi bấm lại.' };
  var orders = d.orders, out = [], need = '', tableRow = null, label = '';
  var what = kind.slice(1);
  var shareAll = function(o){ return isB ? (Number(o.giaTriSauGiam) || 0) : (o.rs != null ? Number(o.rs) : (Number(o.giaTriDon) || 0)); };
  var arr = function(name){ return (d[name] || []).filter(function(r){ return r.name === key; })[0] || null; };
  if (what === 'All') { label = isB ? 'Tất cả đơn Pos' : 'Tất cả đơn Base'; orders.forEach(function(o){ out.push({ o: o, share: shareAll(o) }); }); }
  else if (what === 'Sale' || what === 'Team') {
    var f = what === 'Sale' ? 'bs' : 'bt'; label = (what === 'Sale' ? 'Sale ' : 'Team ') + key; tableRow = arr(what === 'Sale' ? 'bySale' : 'byTeamSale');
    orders.forEach(function(o){
      if (o[f] === undefined) { need = 'bs'; return; }
      var s = _srDrillSumPairs_(o[f], key); if (s !== null) out.push({ o: o, share: s });
    });
  }
  else if (what === 'Kenh') { label = 'Kênh ' + key; tableRow = arr('byKenh'); orders.forEach(function(o){ if ((o.kenhBan || '(chưa có kênh)') === key) out.push({ o: o, share: shareAll(o) }); }); }
  else if (what === 'Nguon') { label = 'Nguồn ' + key; tableRow = arr('byNguon'); orders.forEach(function(o){ if ((o.nguonDon || '(chưa có nguồn)') === key) out.push({ o: o, share: shareAll(o) }); }); }
  else if (what === 'Mkt' && isB) { label = 'Marketer ' + key; tableRow = arr('byMkt'); orders.forEach(function(o){ if ((o.marketer || '(chưa gán MKT)') === key) out.push({ o: o, share: shareAll(o) }); }); }
  else if (what === 'Mkt') {
    label = 'Nhóm MKT ' + key; tableRow = arr('byMkt');
    var w = {}; ((d.mktKenh || {})[key] || []).forEach(function(p){ w[p[0]] = p[1]; });
    if (!d.mktKenh) need = 'mkt';
    orders.forEach(function(o){ var k = o.kenhBan || '(chưa có kênh)'; if (w[k] !== undefined) out.push({ o: o, share: shareAll(o) * w[k], w: w[k] }); });
  }
  else if (what === 'Prod') {
    label = 'Sản phẩm ' + key;
    orders.forEach(function(o){
      var codes = _srDrillSplit_(o.maSanPham, ';'), names = _srDrillSplit_(o.sanPham, ','), qtys = _srDrillSplit_(o.soLuong, ',');
      for (var i = 0; i < codes.length; i++) if (codes[i] === key) { out.push({ o: o, share: shareAll(o), extra: Number(String(qtys[i] || '0').replace(',', '.')) || 0, pname: names[i] || '' }); break; }
    });
    var pr = (d.products || []).filter(function(p){ return p.code === key; })[0]; tableRow = pr ? { name: pr.name, soLuong: pr.soLuong } : null;
  }
  else return { ok: false, msg: 'Ô này chưa hỗ trợ xem chi tiết.' };
  if (need && !out.length) return { ok: false, msg: 'Dữ liệu báo cáo này chưa kèm thông tin chi tiết (máy chủ cũ hoặc báo cáo lấy từ bộ nhớ đệm). Bấm "Lọc" để tải lại rồi bấm lại.' };
  var tsx = function(x){ var m = String(x || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : 0; };
  out.sort(function(a, b){ return tsx(isB ? b.o.ngayTaoDon : b.o.ngayTao) - tsx(isB ? a.o.ngayTaoDon : a.o.ngayTao); });
  return { ok: true, isB: isB, rows: out, tableRow: tableRow, label: label, what: what };
}

function _srDrillCols_(r){
  if (r.isB) {
    var c = ['Ngày tạo', 'Khách hàng', 'SĐT', 'Nguồn đơn', 'Thẻ sale', 'Sản phẩm', 'Trạng thái', 'Giá trị sau giảm', 'COD', 'Ghi chú Pos'];
    if (r.what === 'Prod') c.push('SL sản phẩm này');
    c.push(r.what === 'All' ? 'Giá trị tính' : 'Tính vào ô này');
    return c;
  }
  return ['Ngày tạo', 'Mã đơn', 'SĐT / Khách', 'Kênh', 'Sale bán', 'Sản phẩm', 'Phân loại', 'Giai đoạn · Trạng thái', 'Giá trị đơn', r.what === 'All' ? 'Giá trị tính' : 'Tính vào ô này'];
}
function _srDrillCells_(r, x){
  var o = x.o, ph = String(o.soDienThoai || ''), cm = (typeof customerMap !== 'undefined' && customerMap) ? customerMap[(typeof normPhone === 'function' ? normPhone(ph) : '') || ph] : null;
  var name = r.isB ? (o.khachHang || '') : (cm && cm.name ? cm.name : '');
  if (r.isB) {
    var cells = [o.ngayTaoDon || '', name, ph, o.nguonDon || '', o.theSale || '', o.sanPham || '', o.trangThai || '', Number(o.giaTriSauGiam) || 0, Number(o.cod) || 0, o.ghiChu || ''];
    if (r.what === 'Prod') cells.push(x.extra || 0);
    cells.push(Math.round(x.share)); return cells;
  }
  return [o.ngayTao || '', o.id == null ? '' : String(o.id), (ph ? ph : '') + (name ? ' · ' + name : ''), o.kenhBan || '', o.saleBan || '', o.sanPham || '', o.phanLoai || '',
    [o.giaiDoan, o.trangThai].filter(Boolean).join(' · '), Number(o.giaTriDon) || 0, Math.round(x.share)];
}
function _srDrillRowHtml_(r, x){
  var cells = _srDrillCells_(r, x), phIdx = 2, moneyIdx = r.isB ? [7, 8, cells.length - 1] : [8, 9];
  var td = cells.map(function(v, i){
    if (moneyIdx.indexOf(i) !== -1) return '<td style="text-align:right;white-space:nowrap">' + (i === cells.length - 1 ? '<b>' + _srMoney(v) + '</b>' : _srMoney(v)) + '</td>';
    if (r.isB && r.what === 'Prod' && i === cells.length - 2) return '<td style="text-align:right">' + fmt(v) + '</td>';
    if (i === phIdx) {
      var ph = String(x.o.soDienThoai || '');
      var inner = esc(v);
      return '<td style="white-space:nowrap">' + (ph && typeof _custLinkHtml_ === 'function' ? _custLinkHtml_(ph, inner) : inner) + '</td>';
    }
    if (r.isB && i === 1) return '<td>' + (x.o.soDienThoai && typeof _custLinkHtml_ === 'function' ? _custLinkHtml_(x.o.soDienThoai, esc(v)) : esc(v)) + '</td>';
    return '<td style="' + (i === 5 ? 'max-width:260px;' : '') + '">' + esc(String(v).length > 120 ? String(v).slice(0, 120) + '…' : v) + '</td>';
  }).join('');
  return '<tr>' + td + '</tr>';
}
function _srDrillBodyHtml_(){
  var D = _srDrill, r = D.meta; if (!r) return '';
  if (!r.ok) return '<div style="padding:24px;text-align:center;color:var(--muted)">' + esc(r.msg) + '</div>';
  var total = r.rows.reduce(function(s, x){ return s + x.share; }, 0), cnt = r.what === 'Mkt' && !r.isB ? r.rows.reduce(function(s, x){ return s + (x.w || 1); }, 0) : r.rows.length;
  var tr = r.tableRow, chk = '';
  if (tr && tr.giaTri != null) {
    var diff = Math.abs(Math.round(total) - Math.round(tr.giaTri)), tol = Math.max(5, r.rows.length);
    chk = diff <= tol ? ' <span style="color:var(--green)">✓ khớp bảng</span>' : ' <span style="color:var(--red)">⚠ bảng ghi ' + _srMoney(tr.giaTri) + ' (lệch ' + _srMoney(diff) + ')</span>';
  } else if (tr && tr.soLuong != null) chk = ' · bảng ghi SL ' + fmt(tr.soLuong);
  var head = '<div style="font-size:12.5px;margin-bottom:8px"><b>' + fmt(Math.round(cnt * 100) / 100) + '</b> đơn · tính vào ô: <b>' + _srMoney(total) + '</b>' + chk + '</div>';
  var cols = _srDrillCols_(r);
  var shown = r.rows.slice(0, D.limit);
  var html = head + '<div style="overflow:auto;max-height:62vh;border:1px solid var(--border);border-radius:8px"><table class="dash-table" style="margin:0;min-width:760px"><thead><tr>' +
    cols.map(function(c, i){ return '<th style="position:sticky;top:0;background:var(--surface2,#f3f4f6);' + (/^(Giá|COD|Tính|SL)/.test(c) ? 'text-align:right;' : '') + '">' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    (shown.length ? shown.map(function(x){ return _srDrillRowHtml_(r, x); }).join('') : '<tr><td colspan="' + cols.length + '" style="text-align:center;padding:16px;color:var(--muted)">Không có đơn nào</td></tr>') +
    '</tbody></table></div>';
  if (r.rows.length > shown.length) html += '<div style="text-align:center;margin-top:8px"><button class="btn sm" onclick="_srDrill.limit+=300;_srDrillRerender_()">Hiện thêm (' + (r.rows.length - shown.length) + ' đơn còn lại)</button></div>';
  return html;
}
function _srDrillRerender_(){ var b = document.getElementById('srd-body'); if (b) b.innerHTML = _srDrillBodyHtml_(); }
function _srDrillClose_(){ var m = document.getElementById('srd-modal'); if (m) m.remove(); document.removeEventListener('keydown', _srDrillKey_, true); }
function _srDrillKey_(e){ if (e.key === 'Escape') _srDrillClose_(); }

function _srDrillOpen_(kind, key){
  var r = _srDrillCompute_(kind, key);
  _srDrill = { kind: kind, key: key, rows: r.rows || [], limit: 300, meta: r };
  _srDrillClose_();
  var m = document.createElement('div');
  m.id = 'srd-modal';
  // z-index 290 < ngăn hồ sơ khách (.dp-overlay 300): bấm SĐT trong bảng thì hồ sơ hiện lên TRÊN cửa sổ này, đóng hồ sơ là quay lại bảng.
  m.style.cssText = 'position:fixed;inset:0;z-index:290;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:14px';
  m.onclick = function(e){ if (e.target === m) _srDrillClose_(); };
  var title = (kind.charAt(0) === 'b' ? 'Báo cáo B (Pos)' : 'Báo cáo A (Base)') + ' · ' + (r.label || 'Chi tiết');
  m.innerHTML = '<div style="background:var(--surface,#fff);color:var(--text,#111);border-radius:12px;max-width:1180px;width:100%;max-height:92vh;overflow:hidden;padding:14px 16px;box-shadow:0 10px 40px rgba(0,0,0,.3);display:flex;flex-direction:column">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap"><b style="font-size:15px">📋 ' + esc(title) + '</b><span>' +
    (r.ok && r.rows.length ? '<button class="btn sm" onclick="_srDrillXlsx_()">📥 Xuất Excel</button> ' : '') + '<button class="btn sm" onclick="_srDrillClose_()">✕ Đóng</button></span></div>' +
    '<div id="srd-body" style="overflow:auto">' + _srDrillBodyHtml_() + '</div></div>';
  document.body.appendChild(m);
  document.addEventListener('keydown', _srDrillKey_, true);
}
function _srDrillXlsx_(){
  var r = _srDrill.meta; if (!r || !r.ok) return;
  if (typeof XLSX === 'undefined') { if (typeof toast === 'function') toast('Thư viện Excel chưa tải xong — đợi vài giây rồi bấm lại.'); return; }
  var rows = [_srDrillCols_(r)].concat(r.rows.map(function(x){ return _srDrillCells_(r, x); }));
  var wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Chi tiết đơn');
  var nm = String(r.label || 'chi-tiet').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60);
  XLSX.writeFile(wb, 'ChiTiet_' + (r.isB ? 'B_' : 'A_') + nm + '.xlsx');
}

document.addEventListener('click', function(e){
  var t = e.target && e.target.closest && e.target.closest('[data-drill]');
  if (!t) return;
  if (e.target.closest('a,button,input,select,textarea,.cust-link,[data-cust-phone],[data-alk-phone],[data-alk-order]')) return;   // bấm nút/link/SĐT trong ô thì để chúng tự xử lý
  var sel = ''; try { sel = String(window.getSelection ? window.getSelection() : ''); } catch (e1) {}
  if (sel && !/^\s*$/.test(sel)) return;   // đang bôi đen chữ để copy
  _srDrillOpen_(t.getAttribute('data-drill'), t.getAttribute('data-drill-key') || '');
});
if (typeof module !== 'undefined') module.exports = { _srDrillCompute_: _srDrillCompute_ };

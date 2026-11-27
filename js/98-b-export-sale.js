// ═══════════════════════════════════════════════════════════════════════════════════════
//  XUẤT DOANH THU BÁO CÁO B — CẢ TEAM / TỪNG SALE (yêu cầu Duyên 26/11/2026, bước 1/2: hàm dựng file, KHÔNG có giao diện)
//  Mục đích: gửi cho từng bạn sale (hoặc cả team) tự đối chiếu doanh thu. Dùng lại ĐÚNG số liệu của "📊 Xuất Excel" Báo cáo B:
//  `_srBuildExportB_` (js/13) → `allocRows` = mỗi đơn × mỗi sale 1 dòng (giá trị chia chính xác, cộng lại đúng bảng "Theo Sale" trên web).
//  File này CHỈ lọc/gói lại các dòng đó theo sale được chọn, nên số trên file luôn khớp màn hình.
//  Giao diện (hộp chọn + nút ở menu Tác vụ Báo cáo B): js/99-b-export-sale-ui.js (bước 2/2).
//  Hàm thuần (không đụng DOM) → test bằng Node: tools/test-b-export-sale.js
// ═══════════════════════════════════════════════════════════════════════════════════════
var _SRBX_COL_ = { sale: 6, val: 8, cod: 9 };   // cột trong allocRows: G = Sale, I = Giá trị chia, J = COD chia (xem _srBuildExportB_ js/13)
function _srBxR2_(n){ return Math.round((Number(n) || 0) * 100) / 100; }
function _srBxFold_(s){ return (typeof _foldVi === 'function') ? _foldVi(String(s == null ? '' : s)) : String(s == null ? '' : s).toLowerCase().trim(); }
// Tên sheet Excel hợp lệ (≤31 ký tự, bỏ []:*?/\), không trùng nhau trong 1 file
function _srBxSheetName_(name, used){
  var s = String(name || 'Sheet').replace(/[\[\]\:\*\?\/\\]/g, '-').trim().slice(0, 31) || 'Sheet', base = s, n = 2;
  while (used[s.toLowerCase()]){ var suf = ' (' + n++ + ')'; s = base.slice(0, 31 - suf.length) + suf; }
  used[s.toLowerCase()] = 1; return s;
}
// Tên file tải về an toàn
function _srBxFileName_(parts, ext){
  var s = parts.filter(Boolean).join('_').replace(/[\\\/:*?"<>|\[\]]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);
  return (s || 'DoanhThuB') + (ext || '.xlsx');
}
// Danh sách sale có trong dữ liệu B: bảng "Theo Sale" của web + sale chỉ có trong dòng chia (vd "(chưa gán sale)")
function _srBxSaleList_(dB, xb){
  var out = [], seen = {};
  (dB.bySale || []).forEach(function(x){ if (x && x.name != null && !seen[x.name]){ seen[x.name] = 1; out.push({ name: x.name, orders: x.orders, giaTri: x.giaTri, cod: x.cod, inWeb: true }); } });
  var extra = {};
  ((xb && xb.allocRows) || []).slice(1).forEach(function(r){
    var k = r[_SRBX_COL_.sale]; if (k == null || seen[k]) return;
    var e = extra[k] || (extra[k] = { name: k, orders: 0, giaTri: 0, cod: 0, inWeb: false });
    e.orders++; e.giaTri += Number(r[_SRBX_COL_.val]) || 0; e.cod += Number(r[_SRBX_COL_.cod]) || 0;
  });
  Object.keys(extra).sort().forEach(function(k){ out.push(extra[k]); });
  return out;
}
// Các dòng chia của những sale được chọn (giữ nguyên thứ tự gốc)
function _srBxAllocOf_(xb, names){
  var set = {}; (names || []).forEach(function(n){ set[n] = 1; });
  return (xb.allocRows || []).slice(1).filter(function(r){ return set[r[_SRBX_COL_.sale]] === 1; });
}
// Sheet chi tiết: dòng đầu = tiêu đề, cuối = dòng TỔNG (công thức SUM → sửa dữ liệu tự tính lại)
function _srBxDetailSheetRows_(xb, rows){
  var out = [xb.allocRows[0]].concat(rows), n = rows.length, V = 'I', C = 'J';
  out.push([]);
  var sv = 0, sc = 0; rows.forEach(function(r){ sv += Number(r[_SRBX_COL_.val]) || 0; sc += Number(r[_SRBX_COL_.cod]) || 0; });
  var t = ['TỔNG (' + n + ' dòng)', '', '', '', '', '', '', '',
    n ? { t: 'n', v: _srBxR2_(sv), f: 'SUM(' + V + '2:' + V + (n + 1) + ')' } : 0,
    n ? { t: 'n', v: _srBxR2_(sc), f: 'SUM(' + C + '2:' + C + (n + 1) + ')' } : 0];
  out.push(t);
  return out;
}
var _SRBX_DETAIL_WIDTHS_ = [12, 10, 28, 22, 14, 26, 22, 10, 18, 16, 20, 30];
// Bảng tóm tắt các sale được chọn + dòng TỔNG (SUM) — dùng cho file cả team / nhiều sale
function _srBxSummaryRows_(list, info, titleLine){
  var rows = [[titleLine], ['Xuất lúc', info.at || ''], ['Khoảng ngày (theo ngày tạo đơn)', (info.dateFrom || '...') + ' → ' + (info.dateTo || '...')],
    ['Bộ lọc', (info.filters && info.filters.length) ? info.filters.join(' | ') : '(không lọc thêm)'], [],
    ['Sale', 'Số đơn', 'Giá trị sau giảm giá (đã chia theo sale)', 'COD']];
  var to = 0, tv = 0, tc = 0;
  list.forEach(function(x){ rows.push([x.name + (x.inWeb ? '' : ' (không hiện ở bảng web)'), x.orders, _srBxR2_(x.giaTri), _srBxR2_(x.cod)]); to += Number(x.orders) || 0; tv += Number(x.giaTri) || 0; tc += Number(x.cod) || 0; });
  var first = 7, last = 6 + list.length;
  rows.push(list.length ? ['TỔNG', { t: 'n', v: to, f: 'SUM(B' + first + ':B' + last + ')' }, { t: 'n', v: _srBxR2_(tv), f: 'SUM(C' + first + ':C' + last + ')' }, { t: 'n', v: _srBxR2_(tc), f: 'SUM(D' + first + ':D' + last + ')' }] : ['TỔNG', 0, 0, 0]);
  rows.push([], ['Cách đọc: "Số đơn / Giá trị" lấy đúng bảng "Theo Sale" của Báo cáo B (tiền chia đều cho số sale trên đơn). Sheet chi tiết liệt kê từng đơn × sale để đối chiếu; cột "Dòng trong sheet Pos" + "Ghi chú đơn" để dò lại đơn gốc.']);
  return rows;
}
// KẾ HOẠCH XUẤT: trả về mảng file [{ file, sheets:[{name, rows, widths}] }]
//   opts.mode  : 'team'  = 1 file: Tổng hợp theo sale + 1 sheet Chi tiết chung của các sale được chọn (cả team)
//                'sheets'= 1 file: Tổng hợp + mỗi sale 1 sheet chi tiết
//                'files' = mỗi sale 1 file riêng (Tổng quan + Chi tiết) — để gửi từng bạn
//   opts.names : tên sale được chọn (rỗng = tất cả sale có trong dữ liệu)
//   opts.label : nhãn đặt tên (vd tên team) — chỉ dùng cho tên file / tiêu đề
//   opts.info  : { dateFrom, dateTo, filters[], at }
// Trả thêm plan.missing = true nếu máy chủ chưa trả phần chia chính xác theo sale (xem _srBuildExportB_).
function _srBxPlan_(dB, opts){
  opts = opts || {};
  var info = opts.info || {};
  var xb = _srBuildExportB_(dB, Object.assign({}, info, { allocSheet: 'Chia theo Sale' }));
  var all = _srBxSaleList_(dB, xb), names = (opts.names && opts.names.length) ? opts.names : all.map(function(x){ return x.name; });
  var byName = {}; all.forEach(function(x){ byName[x.name] = x; });
  var chosen = names.filter(function(n){ return byName[n]; }).map(function(n){ return byName[n]; });
  var range = [info.dateFrom, info.dateTo].filter(Boolean).join('_den_').replace(/\//g, '-');
  var files = [], mode = opts.mode || 'team', label = opts.label || '';
  if (mode === 'files'){
    chosen.forEach(function(x){
      var sum = _srBxSummaryRows_([x], info, 'DOANH THU BÁO CÁO B (Pos) — ' + x.name);
      var rows = _srBxAllocOf_(xb, [x.name]);
      var webOk = rows.length ? Math.abs(_srBxR2_(rows.reduce(function(s, r){ return s + (Number(r[_SRBX_COL_.val]) || 0); }, 0)) - _srBxR2_(x.giaTri)) < 1 : true;
      sum.push([], [webOk ? '✅ KHỚP: tổng các dòng chi tiết = giá trị trên bảng "Theo Sale" (sai số < 1đ)' : '⚠ LỆCH giữa tổng chi tiết và bảng "Theo Sale" — báo admin kiểm tra']);
      var used = {};
      files.push({ file: _srBxFileName_(['DoanhThuB', x.name, range]), sale: x.name, sheets: [
        { name: _srBxSheetName_('Tổng quan', used), rows: sum, widths: [48, 14, 30, 18] },
        { name: _srBxSheetName_('Chi tiết đơn', used), rows: _srBxDetailSheetRows_(xb, rows), widths: _SRBX_DETAIL_WIDTHS_ }] });
    });
  } else {
    var used2 = {}, sheets = [{ name: _srBxSheetName_('Tổng hợp', used2), rows: _srBxSummaryRows_(chosen, info, 'DOANH THU BÁO CÁO B (Pos)' + (label ? ' — ' + label : ' — cả team')), widths: [48, 14, 30, 18] }];
    if (mode === 'sheets'){
      chosen.forEach(function(x){ sheets.push({ name: _srBxSheetName_(x.name, used2), rows: _srBxDetailSheetRows_(xb, _srBxAllocOf_(xb, [x.name])), widths: _SRBX_DETAIL_WIDTHS_ }); });
    } else {
      sheets.push({ name: _srBxSheetName_('Chi tiết chia theo Sale', used2), rows: _srBxDetailSheetRows_(xb, _srBxAllocOf_(xb, chosen.map(function(x){ return x.name; }))), widths: _SRBX_DETAIL_WIDTHS_ });
    }
    files.push({ file: _srBxFileName_(['DoanhThuB', label || (mode === 'sheets' ? 'TungSale' : 'CaTeam'), range]), sale: '', sheets: sheets });
  }
  return { files: files, count: chosen.length, missing: !!xb.missing, saleList: all };
}

// ═══════════════════════════════════════════════════════════════════════════
//  "EXCEL ĐỐI SOÁT" GỘP — 1 file gồm Báo cáo B + E + G + L + N (Duyên yêu cầu 2026-11-02)
//
//  Duyên: "các mục báo cáo đều xuất excel đối soát được; bấm Excel đối soát ở báo cáo B tải 1 file duy nhất gồm luôn B, E, G, L, N".
//  THIẾT KẾ: cả 5 báo cáo dùng CÙNG khoảng ngày + bộ lọc của Báo cáo B đang xem.
//    • B, N: dùng dữ liệu `dataB` (N = chế độ xem "đơn thuần" của B).
//    • E, G: tính ở trình duyệt từ cùng đơn Pos của B (đúng cách _srLoad map field cho E/G): hoa hồng + chương trình thưởng.
//    • L: dữ liệu riêng của GAS `storeCaseReport` (khách qua cửa hàng) cùng khoảng ngày — nút (bước 3) tải rồi truyền vào đây.
//  Mỗi báo cáo dùng LẠI hàm dựng sheet của nút xuất lẻ (không chép số liệu thứ hai):
//    B → _srBuildExportBSheets_ (js/13) · G → _srGBuildExport_ (js/12) · N → _srPureBuildSheets_ (js/11) · L → _srLBuildRows_/_srLBuildAcctSheets_ (js/11)
//    E → _reconBuildE_: hoa hồng có công thức tính lại + chênh lệch, thưởng có SUMIF về chi tiết, và "Thu nhập từng Sale" (js/63 _computeSaleIncome_/_incomeExportRows_, giống nút xuất Thu nhập của E).
//  Sheet đầu "Mục lục": cách đọc, danh sách sheet, ĐỐI CHIẾU CHÉO số tổng giữa các báo cáo, cảnh báo.
//  Một báo cáo dựng lỗi KHÔNG làm hỏng cả file: sheet "<mã> LỖI" ghi lý do + cảnh báo ở Mục lục.
// ═══════════════════════════════════════════════════════════════════════════
function _reconR4_(n){ return Math.round((Number(n) || 0) * 10000) / 10000; }
function _reconR2_(n){ return Math.round((Number(n) || 0) * 100) / 100; }
function _reconNum_(c){ return (c && typeof c === 'object') ? c.v : c; }

// Đơn Pos của Báo cáo B → dạng E/G dùng (cùng cách map như _srLoad cho E và G: saleBan = tên sale hợp lệ, giaTriDon = giá sau giảm, ngayTao = ngày tạo đơn).
function _reconMapOrders_(dB){
  return ((dB && dB.orders) || []).map(function(o){
    return Object.assign({}, o, { saleBan: (o.saleBanValid !== undefined ? o.saleBanValid : o.theSale), giaTriDon: o.giaTriSauGiam, ngayTao: o.ngayTaoDon });
  });
}

// Cột chữ Excel theo chỉ số 0-based (0→A, 25→Z, 26→AA)
function _reconCol_(i){ var s = ''; i = i + 1; while (i > 0){ var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

// ── E: Hoa hồng nhân viên + Chương trình thưởng ────────────────────────────────────────────────────────────────────────
// Trả { items:[{name, rows, mode}], revenue (tổng doanh thu 3 nhóm), commission (tổng hoa hồng), bonusTotal }
function _reconBuildE_(orders, storeData){
  var r4 = _reconR4_, c = _computeCommissionData_(orders), items = [];
  var lbl = (typeof _commThrLabel_ === 'function') ? _commThrLabel_() : String(c.threshold);
  var rev = c.totalRevenueAbove15 + c.totalRevenueBelow15 + c.totalRevenueChannel;
  var NAME = 'E Hoa hồng', rows = [
    ['Báo cáo E — Hoa hồng nhân viên (tính từ đơn Pos của Báo cáo B; doanh thu mỗi người = phần chia của người đó trong từng đơn)'], [],
    ['Ngưỡng phân loại đơn', c.threshold], ['Số đơn ≥ ' + lbl, c.totalOrdersAbove15], ['Số đơn < ' + lbl, c.totalOrdersBelow15], ['Số đơn kênh % riêng', c.totalOrdersChannel],
    ['Doanh thu đơn ≥ ' + lbl, r4(c.totalRevenueAbove15)], ['Doanh thu đơn < ' + lbl, r4(c.totalRevenueBelow15)], ['Doanh thu kênh % riêng', r4(c.totalRevenueChannel)],
    ['Tổng doanh thu (3 nhóm)', r4(rev)], ['Tổng hoa hồng', r4(c.totalCommission)], []];
  rows.push(['Sale', 'Số đơn ≥ ' + lbl, 'Số đơn < ' + lbl, 'DT đơn ≥ ' + lbl, 'DT đơn < ' + lbl, '% đơn ≥ ' + lbl, '% đơn < ' + lbl, 'DT kênh % riêng', 'HH kênh % riêng',
    'Hoa hồng (hệ thống)', 'Hoa hồng tính lại (công thức)', 'Chênh lệch', 'Nguồn % ≥ ' + lbl, 'Nguồn % < ' + lbl]);
  var first = rows.length + 1;
  c.bySale.forEach(function(s){
    var r = rows.length + 1, D = r4(s.revenueAbove15), E = r4(s.revenueBelow15), I = r4(s.channelCommission), J = r4(s.commission);
    var calc = D * s.rateAbove15 / 100 + E * s.rateBelow15 / 100 + I;
    rows.push([s.name, s.ordersAbove15, s.ordersBelow15, D, E, s.rateAbove15, s.rateBelow15, r4(s.channelRevenue), I, J,
      { t: 'n', v: calc, f: 'D' + r + '*F' + r + '/100+E' + r + '*G' + r + '/100+I' + r }, { t: 'n', v: Math.round((J - calc) * 100) / 100, f: 'ROUND(J' + r + '-K' + r + ',2)' },
      s.sourceAbove15 || '', s.sourceBelow15 || '']);
  });
  var last = rows.length, totRow = rows.length + 1;
  if (c.bySale.length){
    var sum = function(ci){ var t = 0; for (var i = first - 1; i < last; i++) t += Number(_reconNum_(rows[i][ci])) || 0; return t; };
    var sf = function(col, ci){ return { t: 'n', v: r4(sum(ci)), f: 'SUM(' + col + first + ':' + col + last + ')' }; };
    rows.push(['TỔNG', sf('B', 1), sf('C', 2), sf('D', 3), sf('E', 4), '', '', sf('H', 7), sf('I', 8), sf('J', 9), sf('K', 10), { t: 'n', v: Math.round((sum(9) - sum(10)) * 100) / 100, f: 'ROUND(J' + totRow + '-K' + totRow + ',2)' }]);
  } else rows.push(['(không có dữ liệu trong khoảng lọc)']);
  rows.push([], ['Ghi chú: "(chưa gán sale)" không liệt kê (không có người để trả hoa hồng) nhưng doanh thu đơn đó vẫn nằm trong "Tổng doanh thu (3 nhóm)" ở trên. Cột "Hoa hồng tính lại" = DT≥ × %≥ + DT< × %< + HH kênh % riêng — chênh lệch phải = 0.']);
  items.push({ name: NAME, rows: rows, mode: 'num' });

  // Kênh % riêng: sale × kênh
  var ch = [['Báo cáo E — Hoa hồng kênh % riêng (luật vàng kênh Nguồn / % admin cài theo kênh)'], [], ['Sale', 'Kênh', 'Doanh thu', '%', 'Hoa hồng (công thức)']], cf = ch.length + 1;
  c.bySale.forEach(function(s){
    Object.keys(s.channelBreakdown || {}).forEach(function(k){
      var cb = s.channelBreakdown[k], r = ch.length + 1, v = r4(cb.revenue);
      ch.push([s.name, k, v, cb.rate, { t: 'n', v: v * cb.rate / 100, f: 'C' + r + '*D' + r + '/100' }]);
    });
  });
  if (ch.length >= cf){
    var cl = ch.length, ct = ch.length + 1, tv = 0, th = 0;
    for (var i = cf - 1; i < cl; i++){ tv += Number(ch[i][2]) || 0; th += Number(_reconNum_(ch[i][4])) || 0; }
    ch.push(['TỔNG', '', { t: 'n', v: r4(tv), f: 'SUM(C' + cf + ':C' + cl + ')' }, '', { t: 'n', v: th, f: 'SUM(E' + cf + ':E' + cl + ')' }]);
    ch.push(['Đối chiếu với "' + NAME + '" (cột HH kênh % riêng, dòng TỔNG)', '', '', '', { t: 'n', v: Math.round((th - (Number(_reconNum_(rows[totRow - 1][8])) || 0)) * 100) / 100, f: "ROUND(E" + ct + "-'" + NAME + "'!I" + totRow + ",2)" }]);
    items.push({ name: 'E Hoa hồng kênh riêng', rows: ch, mode: 'num' });
  }

  // Chương trình thưởng
  var bonus = _computeBonusData_(orders), bn = 'E Thưởng chi tiết', hasProg = (typeof BONUS_PROGRAMS !== 'undefined') && BONUS_PROGRAMS.length;
  var sumRows = [['Báo cáo E — Chương trình thưởng (cộng thêm ngoài hoa hồng %, theo các chương trình admin đã cài)'], [],
    ['Sale', 'Loại sale', 'Số lượt thưởng', 'Tổng thưởng (hệ thống)', 'Cộng lại từ "' + bn + '"', 'Chênh lệch']], sf0 = sumRows.length + 1;
  var detRows = [['Báo cáo E — Chi tiết từng lượt thưởng'], [], ['Sale', 'Ngày', 'Phạm vi', 'Chương trình', 'Chi tiết', 'Thưởng']], df0 = detRows.length + 1;
  (bonus.bySale || []).forEach(function(s){
    var r = sumRows.length + 1, tot = _reconR2_(s.total);
    sumRows.push([s.name, (typeof _srGSaleTypeLabel_ === 'function') ? _srGSaleTypeLabel_(s.name) : '', s.items.length, tot,
      { t: 'n', v: tot, f: "SUMIF('" + bn + "'!$A:$A,A" + r + ",'" + bn + "'!$F:$F)" }, { t: 'n', v: 0, f: 'ROUND(D' + r + '-E' + r + ',2)' }]);
    s.items.forEach(function(it){ detRows.push([s.name, it.date, it.scope, it.program, (typeof _srGDecode_ === 'function') ? _srGDecode_(it.detail) : String(it.detail || ''), _reconR2_(it.amount)]); });
  });
  var sl = sumRows.length, dl = detRows.length, bonusTotal = 0;
  if (sl >= sf0){
    // giá trị đã tính sẵn của cột "Cộng lại" = tổng đúng các dòng chi tiết của sale đó (để file mở ra không cần tính lại mới thấy số)
    var perSale = {}; for (var j = df0 - 1; j < dl; j++) perSale[detRows[j][0]] = (perSale[detRows[j][0]] || 0) + (Number(detRows[j][5]) || 0);
    for (var k = sf0 - 1; k < sl; k++){
      var rr = k + 1, got = _reconR2_(perSale[sumRows[k][0]] || 0);
      sumRows[k][4].v = got; sumRows[k][5].v = Math.round((Number(sumRows[k][3]) - got) * 100) / 100;
      bonusTotal += Number(sumRows[k][3]) || 0;
    }
    var tl = sl + 1;
    sumRows.push(['TỔNG', '', { t: 'n', v: sumRows.slice(sf0 - 1, sl).reduce(function(a, r){ return a + r[2]; }, 0), f: 'SUM(C' + sf0 + ':C' + sl + ')' }, { t: 'n', v: _reconR2_(bonusTotal), f: 'SUM(D' + sf0 + ':D' + sl + ')' },
      { t: 'n', v: _reconR2_(Object.keys(perSale).reduce(function(a, kk){ return a + perSale[kk]; }, 0)), f: 'SUM(E' + sf0 + ':E' + sl + ')' }, { t: 'n', v: 0, f: 'ROUND(D' + tl + '-E' + tl + ',2)' }]);
    sumRows[tl - 1][5].v = Math.round((sumRows[tl - 1][3].v - sumRows[tl - 1][4].v) * 100) / 100;
    detRows.push(['TỔNG', '', '', '', '', { t: 'n', v: _reconR2_(detRows.slice(df0 - 1, dl).reduce(function(a, r){ return a + (Number(r[5]) || 0); }, 0)), f: 'SUM(F' + df0 + ':F' + dl + ')' }]);
  } else {
    var msg = hasProg ? '(không có thưởng nào phát sinh trong khoảng lọc)' : '(chưa có chương trình thưởng nào — vào Báo cáo E → "🏆 Chương trình thưởng" để thêm)';
    sumRows.push([msg]); detRows.push([msg]);
  }
  sumRows.push([], ['Ghi chú: "SL ước tính" của chương trình theo sản phẩm là ước lượng từ ô mô tả sản phẩm — nên đối chiếu lại trước khi chi.']);
  items.push({ name: 'E Thưởng', rows: sumRows, mode: 'num' }, { name: bn, rows: detRows, mode: 'num' });
  // "Thu nhập từng Sale" (js/63, phiên khác làm — mục Tổng hợp của Báo cáo E): hoa hồng theo mức đơn + kênh % riêng + đơn chia cửa hàng (L) + thưởng thử việc/chính thức.
  // Dùng đúng _computeSaleIncome_/_incomeExportRows_ như nút "Xuất Excel Thu nhập" của E; phần cửa hàng lấy từ dữ liệu L đã tải cùng khoảng ngày.
  var income = null;
  if (typeof _computeSaleIncome_ === 'function' && typeof _incomeExportRows_ === 'function'){
    var sd = (storeData && storeData.ok !== false && !storeData.error && storeData.rows) ? storeData : null;
    income = _computeSaleIncome_(orders, sd);
    var ix = _incomeExportRows_(income);
    items.push({ name: 'E Thu nhập tổng hợp', rows: ix.sum, mode: 'num' }, { name: 'E Thu nhập chi tiết', rows: ix.det, mode: 'num' });
    income.hasStore = !!sd;
  }
  return { items: items, revenue: rev, commission: c.totalCommission, bonusTotal: bonusTotal, income: income, nSales: c.bySale.length };
}

// ── G: Thưởng Sale (Thử việc / Chính thức) — dùng đúng _srGBuildExport_ như nút "Excel đầy đủ (gửi kế toán)" của G ──────────
function _reconBuildG_(orders, info){
  info = info || {};
  var x = _srGBuildExport_({ orders: orders }), g = x.groups;
  var head = [['BÁO CÁO THƯỞNG SALE — ĐỐI CHIẾU THEO POS'], ['Kỳ báo cáo', (info.dateFrom || 'từ đầu') + ' → ' + (info.dateTo || 'đến nay')],
    ['Bộ lọc (Báo cáo B đang xem)', (info.filters && info.filters.length) ? info.filters.join(' | ') : 'Tất cả'], ['Ngày xuất', info.ymd || ''], ['Người xuất', info.user || ''],
    ['Số đơn Pos dùng để tính', orders.length], ['Tổng thưởng', g.total], []];
  var ord = x.orders.slice(), n = orders.length;
  var sumCol = function(k){ return orders.reduce(function(a, o){ var v = (typeof _srGNum_ === 'function') ? _srGNum_(o[k]) : Number(o[k]); return a + (typeof v === 'number' && isFinite(v) ? v : 0); }, 0); };
  ord.push(['TỔNG (' + n + ' đơn)', '', '', '', '', sumCol('giaTriDon'), sumCol('cod'), '', '']);
  return { items: [{ name: 'G Tổng hợp', rows: head.concat(x.summary, [[]], x.programs), mode: 'g' }, { name: 'G Chi tiết thưởng', rows: x.detail, mode: 'g' }, { name: 'G Đơn Pos đối chiếu', rows: ord, mode: 'g' }],
    total: g.total, orderCount: n };
}

// ── N: Tính đơn thuần — dùng đúng _srPureBuildSheets_ như nút "Xuất Excel đối chiếu Base / quầy" ─────────────────────────────
function _reconBuildN_(dB){
  var x = _srPureBuildSheets_(dB);
  var tot = function(c){ return c.rows.reduce(function(a, r){ return a + (Number(r.giaTri) || 0); }, 0) + (Number(c.unassigned && c.unassigned.giaTri) || 0); };
  return { items: [{ name: 'N Tổng hợp theo Sale', rows: x.sum }, { name: 'N Đơn đã điều chỉnh', rows: x.det }, { name: 'N Cần kiểm tra tay', rows: x.chk }, { name: 'N Chi tiết thuần từng đơn', rows: x.detail }],
    pureTotal: tot(x.pure), adjTotal: tot(x.adj) };
}

// ── L: Khách qua cửa hàng + đối chiếu kế toán — dùng đúng _srLBuildRows_/_srLBuildAcctSheets_ như các nút xuất của L ──────────────
function _reconBuildL_(dL){
  if (!dL) return { items: [{ name: 'L (không có dữ liệu)', rows: [['Báo cáo L: không tải được dữ liệu khách qua cửa hàng (xem cảnh báo ở sheet "Mục lục"). Bấm "Excel đối soát" lại sau khi kiểm tra mạng / trang tính cửa hàng.']] }], ok: false };
  if (dL.ok === false || dL.error) return { items: [{ name: 'L (lỗi tải)', rows: [['Báo cáo L: máy chủ báo lỗi — ' + (dL.error || 'không rõ lý do')]] }], ok: false, error: dL.error || 'lỗi' };
  var items = [];
  if (dL.totals) items.push({ name: 'L Tổng hợp theo Sale', rows: _srLBuildRows_(dL, 'summary') });
  if (dL.rows) items.push({ name: 'L Chi tiết đơn', rows: _srLBuildRows_(dL, 'detail') });
  if (dL.acctCheck){
    var xa = _srLBuildAcctSheets_(dL);
    items.push({ name: 'L KT chưa ghi', rows: xa.chua.length > 1 ? xa.chua : [xa.head, ['(không có đơn nào)']] });
    if (xa.thieu.length > 1) items.push({ name: 'L Thiếu mã bộ đếm', rows: xa.thieu });
    if (xa.lech.length > 1) items.push({ name: 'L KT ghi lệch tiền', rows: xa.lech });
  }
  if (!items.length) items.push({ name: 'L (trống)', rows: [['Báo cáo L: không có dòng nào trong khoảng ngày này.']] });
  return { items: items, ok: true, daTinh: dL.totals ? Number(dL.totals.daTinh) || 0 : null, soDon: dL.totals ? dL.totals.soDon : null };
}

// ── Ghép 5 báo cáo + sheet "Mục lục" (cách đọc, danh sách sheet, đối chiếu chéo, cảnh báo) ───────────────────────────────────
// dB = dữ liệu Báo cáo B (bắt buộc), dL = dữ liệu Báo cáo L (có thể null nếu không tải được).
// info: { dateFrom, dateTo, filters:[...], at, ymd, user, admin }
function _reconCollect_(dB, dL, info){
  info = info || {};
  if (!dB || !dB.orders) throw new Error('Chưa có dữ liệu Báo cáo B — bấm "Lọc" ở Báo cáo B trước.');
  var warnings = [], groups = { B: [], E: [], G: [], L: [], N: [] }, meta = {};
  try { if (typeof _srRegisterIdentity_ === 'function') _srRegisterIdentity_(dB); } catch (e0) {}
  var orders = _reconMapOrders_(dB);
  var run = function(code, label, fn){
    try { fn(); } catch (e){ var m = (e && e.message) ? e.message : String(e); warnings.push(label + ': không dựng được — ' + m); groups[code] = [{ name: code + ' LỖI', rows: [[label + ' — không dựng được: ' + m]] }]; }
  };
  run('B', 'Báo cáo B', function(){
    var bs = _srBuildExportBSheets_(dB, info, 'B ', info.admin);
    groups.B = bs.sheets; meta.xb = bs.xb;
    if (bs.xb.missing) warnings.push('Báo cáo B: máy chủ chưa trả phần chia chính xác theo sale (bsx/bcx) — bấm "Lọc" lại hoặc chờ deploy xong rồi xuất lại.');
  });
  run('E', 'Báo cáo E', function(){ var e = _reconBuildE_(orders, dL); groups.E = e.items; meta.e = e; });
  run('G', 'Báo cáo G', function(){ var g = _reconBuildG_(orders, info); groups.G = g.items; meta.g = g; });
  run('L', 'Báo cáo L', function(){
    var l = _reconBuildL_(dL); groups.L = l.items; meta.l = l;
    if (!l.ok) warnings.push('Báo cáo L: ' + (l.error ? 'máy chủ báo lỗi — ' + l.error : 'không tải được dữ liệu') + ' → file này KHÔNG có số liệu L.');
  });
  run('N', 'Báo cáo N', function(){ var n = _reconBuildN_(dB); groups.N = n.items; meta.n = n; });

  // số tổng của B (trước trừ hoàn/hủy — cùng số E/G/N cộng từ chi tiết đơn)
  var adj = (dB.posAdjust && dB.posAdjust.applied) ? dB.posAdjust : null;
  var bTotal = (adj && dB.totalGiaTriGoc != null) ? dB.totalGiaTriGoc : dB.totalGiaTri;
  var all = [].concat(groups.B, groups.E, groups.G, groups.L, groups.N);
  var idx = _reconIndexRows_(info, groups, meta, { bTotal: _reconR2_(bTotal), bOrders: dB.totalOrders, adj: adj, orders: orders.length }, warnings);
  return { items: [{ name: 'Mục lục', rows: idx.rows, mode: 'num' }].concat(all), warnings: warnings, checks: idx.checks, meta: meta };
}

function _reconIndexRows_(info, groups, meta, B, warnings){
  var tol = 1, okTxt = '✅ KHỚP', badTxt = '⚠ LỆCH';
  var rows = [['EXCEL ĐỐI SOÁT — GỘP BÁO CÁO B · E · G · L · N'], ['Xuất lúc', info.at || ''], ['Người xuất', info.user || ''],
    ['Khoảng ngày (theo ngày tạo đơn)', (info.dateFrom || '...') + ' → ' + (info.dateTo || '...')],
    ['Bộ lọc (Báo cáo B đang xem)', (info.filters && info.filters.length) ? info.filters.join(' | ') : '(không lọc thêm)'], [],
    ['CÁCH ĐỌC FILE'],
    ['• Cả 5 báo cáo dùng CÙNG khoảng ngày + bộ lọc của Báo cáo B lúc bấm nút. B, N, E, G tính từ cùng danh sách đơn Pos; L (khách qua cửa hàng) tải riêng từ trang tính cửa hàng cùng khoảng ngày.'],
    ['• Tên sheet có tiền tố theo báo cáo: "B …", "E …", "G …", "L …", "N …". Mỗi sheet giống file xuất lẻ của chính báo cáo đó (E chưa từng có file xuất lẻ).'],
    ['• Số của E (hoa hồng) và G (thưởng) tính theo CẤU HÌNH HIỆN TẠI (ngưỡng, % hoa hồng, chương trình thưởng) — đổi cấu hình thì số đổi theo. Cột có công thức (SUMIF / SUM / ROUND) tự tính lại khi sửa dữ liệu.'],
    ['• Các số trong sheet "Đối chiếu chéo" bên dưới là để soát nhanh B ↔ E ↔ G ↔ N: kỳ vọng chênh ≈ 0 (sai số < ' + tol + 'đ) trừ dòng ghi "tham khảo".'], []];
  rows.push(['DANH SÁCH SHEET'], ['Sheet', 'Báo cáo', 'Số dòng trong sheet']);
  var label = { B: 'B — Pos (doanh số theo Sale)', E: 'E — Hoa hồng & chương trình thưởng', G: 'G — Thưởng Sale Thử việc/Chính thức', L: 'L — Khách qua cửa hàng + đối chiếu kế toán', N: 'N — Tính đơn thuần' };
  ['B', 'E', 'G', 'L', 'N'].forEach(function(k){ (groups[k] || []).forEach(function(s){ rows.push([s.name, label[k], (s.rows || []).length]); }); });
  rows.push([], ['ĐỐI CHIẾU CHÉO GIỮA CÁC BÁO CÁO'], ['Chỉ số', 'Báo cáo', 'Giá trị', 'Chênh so với B (công thức)', 'Kết luận', 'Giải thích']);
  var checks = [], rOrd = rows.length + 1;
  rows.push(['Số đơn Pos trong khoảng lọc', 'B', B.bOrders, '', '', 'Số đơn máy chủ trả về cho Báo cáo B.']);
  var rVal = rows.length + 1;
  rows.push(['Tổng giá trị đơn' + (B.adj ? ' (TRƯỚC trừ hoàn/hủy tháng ' + B.adj.prevMonth + ')' : ''), 'B', B.bTotal, '', '', B.adj ? 'Số web hiển thị đã trừ hoàn/hủy theo mốc chốt; E/G/N cộng từ chi tiết đơn nên so với số TRƯỚC trừ (xem sheet "B Đối chiếu tổng" để nối với số sau trừ).' : 'Tổng giá trị sau giảm giá của các đơn Pos.']);
  var diffRow = function(name, code, val, why, strict){
    var r = rows.length + 1, d = _reconR2_(val - B.bTotal), ok = Math.abs(d) < tol;
    rows.push([name, code, _reconR2_(val), { t: 'n', v: d, f: 'ROUND(C' + r + '-C' + rVal + ',2)' }, strict ? (ok ? okTxt : badTxt) : 'ℹ tham khảo', why]);
    checks.push({ name: name, code: code, value: _reconR2_(val), diff: d, ok: strict ? ok : null });
  };
  if (meta.e) diffRow('Tổng doanh thu 3 nhóm (≥ngưỡng / <ngưỡng / kênh % riêng)', 'E', meta.e.revenue, 'E cộng giá trị TỪNG đơn Pos của B → phải bằng tổng giá trị của B.', true);
  if (meta.g){
    var rG = rows.length + 1, dg = meta.g.orderCount - B.orders;
    rows.push(['Số đơn Pos dùng để tính thưởng', 'G', meta.g.orderCount, { t: 'n', v: dg, f: 'C' + rG + '-C' + rOrd }, dg === 0 ? okTxt : badTxt, 'G chấm thưởng trên đúng các đơn Pos của B → số đơn phải bằng B.']);
    checks.push({ name: 'Số đơn dùng tính thưởng', code: 'G', value: meta.g.orderCount, diff: dg, ok: dg === 0 });
  }
  if (meta.n){
    diffRow('Tổng giá trị sau điều chỉnh (N tính lại: ghép Base / kế toán / quầy 30-70)', 'N', meta.n.adjTotal, 'N tính lại đúng cách chia của bảng "Theo Sale" của B (gồm "(chưa gán sale)") → phải bằng tổng giá trị của B. Lệch thường do đang lọc Sale/Team.', true);
    diffRow('Tổng giá trị đơn thuần (theo cột Thẻ, giá Pos gốc, chia đều)', 'N', meta.n.pureTotal, 'Khác B là BÌNH THƯỜNG: đơn thuần chưa ghép Base, chưa chia theo file kế toán, chưa trừ phần quầy 30/70.', false);
  }
  if (meta.l && meta.l.ok && meta.l.daTinh != null){
    rows.push(['Doanh thu chia thêm cho Sale (khách qua cửa hàng chưa có thẻ trên Pos)', 'L', _reconR2_(meta.l.daTinh), '', 'ℹ tham khảo', 'Phần doanh thu L cộng THÊM cho Sale, nằm ngoài tổng giá trị Pos của B nên không so với B.']);
    checks.push({ name: 'Doanh thu chia thêm', code: 'L', value: _reconR2_(meta.l.daTinh), diff: null, ok: null });
  }
  if (meta.e) rows.push(['Tổng hoa hồng', 'E', _reconR2_(meta.e.commission), '', 'ℹ tham khảo', 'Tiền hoa hồng % (không phải doanh thu).']);
  if (meta.e) rows.push(['Tổng thưởng (chương trình thưởng ở E)', 'E', _reconR2_(meta.e.bonusTotal), '', 'ℹ tham khảo', 'Chưa lọc người đủ điều kiện nhận thưởng.']);
  // "Thu nhập từng Sale" làm tròn từng khoản từng Sale (đ) nên cho phép sai số = 1đ + 1đ/Sale
  if (meta.e && meta.e.income){
    var inc = meta.e.income, t = inc.totals, tolI = 1 + (meta.e.nSales || 0);
    var hh = t.tier + t.channelComm, th = t.trial + t.official, dH = _reconR2_(hh - meta.e.commission), dT = _reconR2_(th - meta.e.bonusTotal);
    var rH = rows.length + 1;
    rows.push(['Hoa hồng (mức đơn + kênh % riêng) trong "E Thu nhập"', 'E', _reconR2_(hh), { t: 'n', v: dH, f: 'C' + rH + '-C' + (rH - 2) }, Math.abs(dH) <= tolI ? okTxt : badTxt, 'Phải = "Tổng hoa hồng" của E (sai số làm tròn từng Sale ≤ ' + tolI + 'đ).']);
    checks.push({ name: 'Hoa hồng ở Thu nhập', code: 'E', value: _reconR2_(hh), diff: dH, ok: Math.abs(dH) <= tolI });
    var rT = rows.length + 1;
    rows.push(['Thưởng (thử việc + chính thức) trong "E Thu nhập"', 'E', _reconR2_(th), { t: 'n', v: dT, f: 'C' + rT + '-C' + (rT - 2) }, Math.abs(dT) <= tolI ? okTxt : badTxt, 'Phải = "Tổng thưởng" của E (sai số làm tròn ≤ ' + tolI + 'đ).']);
    checks.push({ name: 'Thưởng ở Thu nhập', code: 'E', value: _reconR2_(th), diff: dT, ok: Math.abs(dT) <= tolI });
    rows.push(['Hoa hồng đơn chia với cửa hàng (L) trong "E Thu nhập"', 'E', _reconR2_(t.store), '', 'ℹ tham khảo', inc.hasStore ? 'Cộng thêm từ khách qua cửa hàng (Báo cáo L), nằm ngoài hoa hồng đơn Pos.' : 'Chưa có dữ liệu L nên = 0 (xem cảnh báo về L).']);
    rows.push(['TỔNG THU NHẬP các Sale (hoa hồng + cửa hàng + thưởng)', 'E', _reconR2_(t.total), '', 'ℹ tham khảo', 'Số "TỔNG NHẬN" ở sheet "E Thu nhập tổng hợp".']);
  }
  if (meta.g) rows.push(['Tổng thưởng (chỉ người đủ điều kiện nhận — Online/Văn phòng/Thử việc)', 'G', _reconR2_(meta.g.total), '', 'ℹ tham khảo', 'G chỉ tính cho đội Sale Online + Văn phòng và Sale Thử việc; có thể nhỏ hơn tổng thưởng ở E.']);
  if (warnings && warnings.length){ rows.push([], ['CẢNH BÁO']); warnings.forEach(function(w){ rows.push(['⚠ ' + w]); }); }
  return { rows: rows, checks: checks };
}

// ── Dựng sheet thật từ danh sách {name, rows, mode, widths} ───────────────────────────────────────────────────────────────
function _reconSafeSheetName_(name, used){
  var s = String(name || 'Sheet').replace(/[\[\]\:\*\?\/\\]/g, '-').slice(0, 31) || 'Sheet', base = s, n = 2;
  while (used[s.toLowerCase()]){ var suf = ' (' + n++ + ')'; s = base.slice(0, 31 - suf.length) + suf; }
  used[s.toLowerCase()] = 1; return s;
}
function _reconWs_(it){
  var rows = (it.rows && it.rows.length) ? it.rows : [['(trống)']];
  if (it.mode === 'g' && typeof _srGSheet_ === 'function') return _srGSheet_(rows);
  var ws = XLSX.utils.aoa_to_sheet(rows);
  if (it.widths) ws['!cols'] = it.widths.map(function(w){ return { wch: w }; });
  else {
    var w = [];
    rows.forEach(function(r){
      if (!r || r.length < 2) return;   // dòng tiêu đề / ghi chú 1 ô: không tính vào độ rộng cột
      r.forEach(function(c, i){ var l = String(_reconNum_(c) == null ? '' : _reconNum_(c)).length; if (!w[i] || l > w[i]) w[i] = l; });
    });
    ws['!cols'] = w.map(function(x){ return { wch: Math.max(8, Math.min(50, (x || 0) + 2)) }; });
  }
  if (it.mode === 'num') Object.keys(ws).forEach(function(k){ if (k[0] !== '!' && ws[k].t === 'n') ws[k].z = (Math.abs(ws[k].v % 1) < 1e-9) ? '#,##0' : '#,##0.00'; });
  return ws;
}
function _reconBuildWorkbook_(plan){
  var wb = XLSX.utils.book_new(), used = {};
  plan.items.forEach(function(it){ XLSX.utils.book_append_sheet(wb, _reconWs_(it), _reconSafeSheetName_(it.name, used)); });
  return wb;
}

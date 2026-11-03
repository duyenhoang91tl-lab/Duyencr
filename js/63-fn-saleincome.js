// ── THU NHẬP TỪNG SALE (Báo cáo E, mục "Tổng hợp") — Duyên yêu cầu 2026-11-03 ──
// Gộp cho MỖI Sale: hoa hồng theo mức đơn (≥/<ngưỡng) + hoa hồng kênh/nguồn/Facebook (% riêng) + hoa hồng từ đơn chia với
// CỬA HÀNG (Báo cáo L) + thưởng thử việc + thưởng chính thức (chương trình thưởng). KHÔNG tính thưởng/phạt đội (js/60-team-bonus).
// Hàm THUẦN (không đụng DOM) để test bằng Node: tools/test-sale-income.js. Dùng lại đúng _computeCommissionData_ / _computeBonusData_
// (không viết lại cách tính). Đơn chia cửa hàng: doanh thu chia (credits, đã trừ đơn Trùng) × % theo mức đơn GỐC của người đó.
function _incomeIsTrialProgram_(name) {
  var p = (typeof BONUS_PROGRAMS !== 'undefined' ? BONUS_PROGRAMS : []).filter(function (x) { return x && x.name === name; })[0];
  return !!(p && p.probationDay && p.probationDay.enabled);
}
function _computeSaleIncome_(orders, storeData) {
  var by = {};
  function ens(name) {
    return by[name] || (by[name] = { name: name, channel: _saleChannelOf_(name), tier: 0, channelComm: 0, store: 0, trial: 0, official: 0, total: 0, lines: [] });
  }
  function add(r, kind, line) {
    line.kind = kind; r.lines.push(line);
    r[kind] += line.amount;
  }
  var c = _computeCommissionData_(orders || []);
  c.bySale.forEach(function (s) {
    var r = ens(s.name), srcs = s.sourceBreakdown || {};
    Object.keys(srcs).forEach(function (k) {
      var b = srcs[k];
      if (b.nAbove) add(r, 'tier', { group: 'Hoa hồng theo mức đơn', source: k, bucket: '≥' + _commThrLabel_(), orders: b.nAbove, revenue: b.revAbove, rate: s.rateAbove15, amount: b.revAbove * s.rateAbove15 / 100, ref: s.sourceAbove15 });
      if (b.nBelow) add(r, 'tier', { group: 'Hoa hồng theo mức đơn', source: k, bucket: '<' + _commThrLabel_(), orders: b.nBelow, revenue: b.revBelow, rate: s.rateBelow15, amount: b.revBelow * s.rateBelow15 / 100, ref: s.sourceBelow15 });
    });
    Object.keys(s.channelBreakdown || {}).forEach(function (k) {
      var cb = s.channelBreakdown[k];
      add(r, 'channelComm', { group: 'Hoa hồng kênh/nguồn % riêng', source: k, bucket: '', orders: 0, revenue: cb.revenue, rate: cb.rate, amount: cb.revenue * cb.rate / 100, ref: 'Cài ở Cài đặt % theo kênh' });
    });
  });
  // Hoa hồng từ đơn chia với cửa hàng (Báo cáo L): chỉ dòng khách ĐÃ đến, đơn không phải hoàn, phần chia không bị đánh dấu Trùng
  ((storeData && storeData.rows) || []).forEach(function (row) {
    if (row.koDen) return;
    (row.orders || []).forEach(function (o) {
      if (o.excluded) return;
      (o.credits || []).forEach(function (cr) {
        if (cr.dup || !(Number(cr.amount) > 0)) return;
        var rate = _resolveCommissionRate_(cr.sale), above = Number(o.giaTri) >= COMMISSION_THRESHOLD, pct = above ? rate.above15 : rate.below15;
        add(ens(cr.sale), 'store', { group: 'Hoa hồng đơn chia với cửa hàng', source: 'Khách qua cửa hàng', bucket: (above ? '≥' : '<') + _commThrLabel_(), orders: 1, revenue: Number(cr.amount) || 0, rate: pct,
          amount: (Number(cr.amount) || 0) * pct / 100, date: o.ymd || o.ngay || '', ref: [row.tenKh, row.phone, o.nguonDon, 'Pos dòng ' + o.posRow].filter(Boolean).join(' · ') });
      });
    });
  });
  // Thưởng từ chương trình (thử việc / chính thức tách theo chương trình có bật "ngày thứ mấy kể từ ngày bắt đầu")
  var bn = _computeBonusData_(orders || []);
  (bn.bySale || []).forEach(function (s) {
    var r = ens(s.name);
    (s.items || []).forEach(function (it) {
      var trial = _incomeIsTrialProgram_(it.program);
      add(r, trial ? 'trial' : 'official', { group: trial ? 'Thưởng thử việc' : 'Thưởng chính thức', source: it.program, bucket: it.scope || '', orders: 0, revenue: 0, rate: 0, amount: Number(it.amount) || 0,
        date: it.date || '', ref: String(it.detail || '').replace(/<[^>]*>/g, '') + (it.maDonPos ? ' · ' + String(it.maDonPos).split('\n')[0] : '') });
    });
  });
  var rows = Object.keys(by).filter(function (n) { return n !== '(chưa gán sale)'; }).map(function (n) {
    var r = by[n];
    ['tier', 'channelComm', 'store', 'trial', 'official'].forEach(function (k) { r[k] = Math.round(r[k]); });
    r.total = r.tier + r.channelComm + r.store + r.trial + r.official;
    r.lines.forEach(function (l) { l.amount = Math.round(l.amount); l.revenue = Math.round(l.revenue); });
    return r;
  }).sort(function (a, b) { return b.total - a.total; });
  var tot = { tier: 0, channelComm: 0, store: 0, trial: 0, official: 0, total: 0 };
  rows.forEach(function (r) { Object.keys(tot).forEach(function (k) { tot[k] += r[k]; }); });
  return { rows: rows, totals: tot };
}

// ── Giao diện mục "Thu nhập từng Sale" của Báo cáo E ──
var _INCOME_GROUPS_ = [['tier', 'Hoa hồng theo mức đơn (theo nguồn đơn)'], ['channelComm', 'Hoa hồng kênh/nguồn % riêng (Facebook, Nguồn…)'], ['store', 'Hoa hồng đơn chia với cửa hàng'], ['trial', 'Thưởng thử việc'], ['official', 'Thưởng chính thức']];
function _srIncomeLinesHtml_(r) {
  var h = '<table class="dash-table" style="margin:0"><thead><tr><th>Nguồn / chương trình</th><th>Mức / phạm vi</th><th style="text-align:right">Số đơn</th><th style="text-align:right">Doanh thu tính</th><th style="text-align:right">%</th><th style="text-align:right">Tiền</th><th>Ngày · ghi chú</th></tr></thead><tbody>';
  _INCOME_GROUPS_.forEach(function (g) {
    var ls = r.lines.filter(function (l) { return l.kind === g[0]; });
    if (!ls.length) return;
    ls.sort(function (a, b) { return (a.date || '').localeCompare(b.date || '') || b.amount - a.amount; });
    h += '<tr style="background:var(--surface);font-weight:700"><td colspan="5">' + esc(g[1]) + '</td><td style="text-align:right">' + _srMoney(r[g[0]]) + '</td><td></td></tr>';
    ls.forEach(function (l) {
      h += '<tr><td>' + esc(l.source) + '</td><td>' + esc(l.bucket) + '</td><td style="text-align:right">' + (l.orders ? fmt(l.orders) : '') + '</td><td style="text-align:right">' + (l.revenue ? _srMoney(l.revenue) : '') + '</td><td style="text-align:right">' + (l.rate ? l.rate + '%' : '') + '</td><td style="text-align:right">' + _srMoney(l.amount) +
        '</td><td style="font-size:11px;color:var(--muted)">' + esc([l.date, l.ref].filter(Boolean).join(' · ')) + '</td></tr>';
    });
  });
  return h + '</tbody></table>';
}
function _srIncomeSectionHtml_(d) {
  var inc = _computeSaleIncome_(d.orders || [], _srState.dataEStore), q = String(_srState.eSaleSearch || '').toLowerCase();
  var rows = inc.rows.filter(function (r) { return !q || r.name.toLowerCase().indexOf(q) !== -1; }), T = inc.totals;
  var h = '<div class="dash-section-title" style="margin-top:6px">Thu nhập từng Sale — hoa hồng + thưởng <span style="font-weight:400;color:var(--muted);font-size:11px">(không gồm thưởng/phạt đội ở Quản lý Team)</span></div>';
  if (!_srState.dataEStore) h += '<div style="background:#fff7ed;border:1px solid #fdba74;color:#9a3412;border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px">⚠ Chưa tải được dữ liệu đơn chia với cửa hàng' + (_srState.dataEStoreErr ? ' (' + esc(_srState.dataEStoreErr) + ')' : '') + ' — cột "Đơn chia cửa hàng" đang là 0.</div>';
  h += '<div style="margin-bottom:6px"><button class="btn sm" onclick="_srIncomeExportXlsx()">⬇ Xuất Excel (tổng hợp + chi tiết từng nguồn)</button></div>';
  h += '<table class="dash-table"><thead><tr><th>Sale</th><th style="text-align:right">Hoa hồng mức đơn</th><th style="text-align:right">Kênh/nguồn %</th><th style="text-align:right">Đơn chia cửa hàng</th><th style="text-align:right">Thưởng thử việc</th><th style="text-align:right">Thưởng chính thức</th><th style="text-align:right"><b>Tổng nhận</b></th><th></th></tr></thead><tbody>';
  rows.forEach(function (r, i) {
    var rid = 'in_' + i, open = _srState.incomeOpen === rid, chn = r.channel === 'online' ? 'Online' : (r.channel === 'probation' ? 'Thử việc' : (r.channel === 'offline' ? 'Offline' : ''));
    h += '<tr><td>' + esc(r.name) + (chn ? ' <span style="font-size:10px;color:var(--muted)">(' + chn + ')</span>' : '') + '</td>' +
      [r.tier, r.channelComm, r.store, r.trial, r.official].map(function (v) { return '<td style="text-align:right">' + (v ? _srMoney(v) : '—') + '</td>'; }).join('') +
      '<td style="text-align:right"><b>' + _srMoney(r.total) + '</b></td><td><button class="btn sm" onclick="_srState.incomeOpen=' + (open ? "''" : "'" + rid + "'") + ';renderSalesReportTab()">' + (open ? 'Ẩn' : 'Chi tiết') + '</button></td></tr>';
    if (open) h += '<tr><td colspan="8" style="background:var(--surface2);padding:8px 14px">' + _srIncomeLinesHtml_(r) + '</td></tr>';
  });
  if (!rows.length) h += '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:14px">Không có dữ liệu</td></tr>';
  else h += _srTotalRowHtml_(['Tổng', _srMoney(T.tier), _srMoney(T.channelComm), _srMoney(T.store), _srMoney(T.trial), _srMoney(T.official), '<b>' + _srMoney(T.total) + '</b>', '']);
  return h + '</tbody></table><div class="guide-text" style="font-size:11px;color:var(--muted);margin:6px 0 16px">Đơn chia cửa hàng = doanh thu chia ở Báo cáo L (bỏ đơn Trùng/chưa đến/hoàn) × % theo mức đơn của người đó. Bấm "Chi tiết" để xem nhận từ nguồn nào.</div>';
}

// ── Xuất Excel: sheet "Tong hop" (mỗi Sale 1 dòng) + "Chi tiet" (từng nguồn/chương trình/đơn chia cửa hàng) — để kế toán/Sale đối chiếu ──
function _incomeExportRows_(inc) {
  var sum = [['Sale', 'Kênh', 'Hoa hồng theo mức đơn', 'Hoa hồng kênh/nguồn % riêng', 'Hoa hồng đơn chia cửa hàng', 'Thưởng thử việc', 'Thưởng chính thức', 'TỔNG NHẬN']];
  var det = [['Sale', 'Nhóm', 'Nguồn / chương trình', 'Mức / phạm vi', 'Số đơn', 'Doanh thu tính (đ)', '% hoa hồng', 'Tiền (đ)', 'Ngày', 'Ghi chú']];
  inc.rows.forEach(function (r) {
    var chn = r.channel === 'online' ? 'Online' : (r.channel === 'probation' ? 'Thử việc' : (r.channel === 'offline' ? 'Offline' : ''));
    sum.push([r.name, chn, r.tier, r.channelComm, r.store, r.trial, r.official, r.total]);
    _INCOME_GROUPS_.forEach(function (g) {
      r.lines.filter(function (l) { return l.kind === g[0]; }).sort(function (a, b) { return (a.date || '').localeCompare(b.date || '') || b.amount - a.amount; }).forEach(function (l) {
        det.push([r.name, g[1], l.source, l.bucket, l.orders || '', l.revenue || '', l.rate || '', l.amount, l.date || '', l.ref || '']);
      });
    });
  });
  var t = inc.totals; sum.push(['TỔNG', '', t.tier, t.channelComm, t.store, t.trial, t.official, t.total]);
  return { sum: sum, det: det };
}
function _srIncomeExportXlsx() {
  var d = _srState.dataE;
  if (!d) { alert('Chưa có dữ liệu — đợi tải xong rồi bấm lại.'); return; }
  if (typeof XLSX === 'undefined') { alert('Thư viện xuất Excel chưa tải xong — thử lại sau vài giây.'); return; }
  var x = _incomeExportRows_(_computeSaleIncome_(d.orders || [], _srState.dataEStore)), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(x.sum), 'Tong hop');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(x.det), 'Chi tiet');
  XLSX.writeFile(wb, 'ThuNhapSale_' + (_srState.eDateFrom || '') + '_' + (_srState.eDateTo || '') + '.xlsx');
}

// ── BÁO CÁO B "Theo Sale": gộp PHẦN SALE 30% ĐƠN QUẦY (Báo cáo L) vào doanh thu từng sale — Duyên chọn hướng 2 (2026-11-03) ──
// NGUYÊN NHÂN GỐC: Báo cáo B chỉ cộng đơn Pos nên thiếu phần Sale 30% của đơn quầy mà KT cộng vào → biểu đồ tròn lệch KT (T10: 58.215.300đ trên 18 sale).
// Cùng quy tắc với "Thu nhập từng Sale" (Báo cáo E): bỏ dòng khách KHÔNG đến, đơn excluded (hoàn), phần chia bị đánh dấu Trùng / ≤0.
// Hàm THUẦN để test bằng Node: tools/test-store-share-b.js.
function _srStoreForBOk_() {
  var st = (typeof _srState !== 'undefined' && _srState) || {};
  return ['bNguon', 'bMarketer', 'bSanPham', 'bCareStatus', 'bKhStatus', 'bZaloStatus', 'bNickZalo'].every(function (k) {
    var v = st[k]; return Array.isArray(v) ? !v.length : !v;
  });   // đang lọc nguồn/marketer/sản phẩm/CS… thì KHÔNG cộng đơn quầy (đơn quầy không có các trường này)
}
function _srMergeStoreIntoBySale_(bySale, storeData) {
  var out = (bySale || []).map(function (r) { return Object.assign({}, r); }), idx = {}, total = 0, count = 0;
  out.forEach(function (r, i) { idx[String(r.name || '').toLowerCase()] = i; });
  ((storeData && storeData.rows) || []).forEach(function (row) {
    if (row.koDen) return;
    (row.orders || []).forEach(function (o) {
      if (o.excluded) return;
      (o.credits || []).forEach(function (cr) {
        var amt = Number(cr.amount) || 0;
        if (cr.dup || !(amt > 0) || !cr.sale) return;
        var k = String(cr.sale).toLowerCase(), i = idx[k];
        if (i === undefined) { out.push({ name: cr.sale, orders: 0, giaTri: 0, cod: 0 }); i = idx[k] = out.length - 1; }
        out[i].giaTri = (out[i].giaTri || 0) + amt; out[i].orders = (out[i].orders || 0) + 1;
        out[i].storeAmt = (out[i].storeAmt || 0) + amt; out[i].storeOrders = (out[i].storeOrders || 0) + 1;
        total += amt; count++;
      });
    });
  });
  out.sort(function (a, b) { return (b.giaTri || 0) - (a.giaTri || 0); });
  return { rows: out, storeTotal: total, storeOrders: count };
}

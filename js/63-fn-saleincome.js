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

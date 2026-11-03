// ── THI ĐUA THÁNG (Báo cáo E, mục "Thi đua — thưởng/phạt từng Sale") — Duyên yêu cầu 2026-11-03 ──
// Hàm THUẦN (không đụng DOM) để test bằng Node: tools/test-thidua.js. Cách tính (Duyên chốt cho T10, áp lại cho T11):
//  • Tổng KPI Sale = kpiTotal. Kênh FB chính ("Fb Phạm Thu Hiền") có KPI riêng kpiFb; phần còn lại = kpiTotal − kpiFb (T10: 8 tỷ; T11: 7 tỷ = Marketing 6,9 tỷ + CSKH-Duyên 100tr).
//  • Doanh thu = ĐƠN GỐC, chia đều theo số sale trên thẻ (dùng _orderRevenueShares_ của js/12). Kênh FB = đơn có Nguồn đơn khớp fbSources; "còn lại" = mọi đơn khác.
//  • Tỷ lệ phạt theo % hoàn thành của từng phần: ≥100% không phạt (thưởng 0,05% KPI — chỉ hiển thị, chưa chia); >90% 0,005%; >80% 0,015%; >70% 0,02%; còn lại 0,025%. Tiền phạt = tỷ lệ × KPI của phần đó.
//  • Phạt kênh FB: chia đều đầu người cho các sale "FB chính" (fbMain) + Duyên. Phạt phần còn lại: chia đều cho các sale KHÔNG đạt 100% cam kết cá nhân + Duyên (Duyên không có doanh thu nên không xét tỷ lệ, chỉ chia phạt).
//  • Sale xét "đạt cam kết" theo TỔNG doanh thu của mình (gồm cả kênh FB) so với cam kết.
var THIDUA_TIERS_ = { rates: [0.00005, 0.00015, 0.0002, 0.00025], thr: [0.9, 0.8, 0.7], bonusRate: 0.0005 };
var THIDUA_FB_SRC_ = ['fb phạm thu hiền', 'facebook phạm thu hiền'];
var THIDUA_CONFIGS = {
  '2026-10': { label: 'Tháng 10/2026', kpiTotal: 9400000000, kpiFb: 1400000000, duyenHeads: 1, commitments: [
    { name: 'Trịnh Phương Anh', user: 'anhtrinh1995', team: 'Văn phòng', commit: 600e6 }, { name: 'Đinh Thị Thu Thủy', user: 'thuydinh95', team: 'Văn phòng', commit: 800e6 },
    { name: 'Ninh Thị Ngà', user: 'ninhnga99', team: 'Văn phòng', commit: 1000e6, fbMain: true }, { name: 'Nguyễn Thị Hải Yến', user: 'yenNTH2004', team: 'Văn phòng', commit: 500e6 },
    { name: 'Nguyễn Phương Anh', user: 'anhNP1999', team: 'Văn phòng', commit: 400e6 }, { name: 'Nguyễn Huyền Trang', user: 'trangNH2005', team: 'Văn phòng', commit: 500e6 },
    { name: 'Lê Thị Kiều Ninh', user: 'ninhLTK1984', team: 'Văn phòng', commit: 400e6 }, { name: 'Phan Thị Ngọc Hà', user: 'haPTN', team: 'Văn phòng', commit: 200e6 },
    { name: 'Nguyễn Phương Thanh', user: 'thanhNP', team: 'Văn phòng', commit: 200e6 }, { name: 'Nguyễn Bích Ngọc', user: 'ngocNB2003saleoff', team: 'Văn phòng', commit: 100e6 },
    { name: 'Nguyễn Thị Phương Thảo', user: 'phuongthao2000', team: 'Văn phòng', commit: 700e6 },
    { name: 'Nguyễn Thị Bích', user: 'biichnguyen1993', team: 'Online', commit: 700e6, fbMain: true }, { name: 'Nguyễn Thị Tuyết Mai', user: 'mainguyen97', team: 'Online', commit: 400e6 },
    { name: 'Mai Thị Thu Huyền', user: 'huyenmaii1990', team: 'Online', commit: 1000e6, fbMain: true }, { name: 'Nguyễn Thị Thùy Dung', user: 'dungnguyen1995', team: 'Online', commit: 400e6, fbMain: true },
    { name: 'Tạ Thị Thúy Hà', user: 'thuyha88', team: 'Online', commit: 700e6 }, { name: 'Minh Quách', user: 'minhquach1995', team: 'Online', commit: 300e6 },
    { name: 'Phạm Thị Hoàng Tươi', user: 'tuoipham1993', team: 'Online', commit: 500e6 }] },
  '2026-11': { label: 'Tháng 11/2026', kpiTotal: 8500000000, kpiFb: 1500000000, duyenHeads: 1, commitments: [
    { name: 'Trịnh Phương Anh', user: 'anhtrinh1995', team: 'Văn phòng', commit: 650e6 }, { name: 'Đinh Thị Thu Thủy', user: 'thuydinh95', team: 'Văn phòng', commit: 900e6 },
    { name: 'Ninh Thị Ngà', user: 'ninhnga99', team: 'Văn phòng', commit: 1050e6, fbMain: true }, { name: 'Nguyễn Thị Hải Yến', user: 'yenNTH2004', team: 'Văn phòng', commit: 500e6 },
    { name: 'Nguyễn Phương Anh', user: 'anhNP1999', team: 'Văn phòng', commit: 500e6 }, { name: 'Nguyễn Bích Ngọc', user: 'ngocNB2003saleoff', team: 'Văn phòng', commit: 500e6 },
    { name: 'Nguyễn Thị Phương Thảo', user: 'phuongthao2000', team: 'Văn phòng', commit: 600e6 },
    { name: 'Nguyễn Thị Bích', user: 'biichnguyen1993', team: 'Online', commit: 700e6, fbMain: true }, { name: 'Nguyễn Thị Tuyết Mai', user: 'mainguyen97', team: 'Online', commit: 500e6 },
    { name: 'Mai Thị Thu Huyền', user: 'huyenmaii1990', team: 'Online', commit: 1050e6, fbMain: true }, { name: 'Nguyễn Thị Thùy Dung', user: 'dungnguyen1995', team: 'Online', commit: 500e6, fbMain: true },
    { name: 'Tạ Thị Thúy Hà', user: 'thuyha88', team: 'Online', commit: 600e6 }, { name: 'Minh Quách', user: 'minhquach1995', team: 'Online', commit: 850e6 },
    { name: 'Phạm Thị Hoàng Tươi', user: 'tuoipham1993', team: 'Online', commit: 500e6 }, { name: 'Lê Thị Kiều Ninh', user: 'ninhLTK1984', team: 'Online', commit: 500e6 }] }
};
function _tdFold_(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
function _tdRate_(pct) {
  var T = THIDUA_TIERS_;
  if (pct >= 1) return 0;
  return pct > T.thr[0] ? T.rates[0] : pct > T.thr[1] ? T.rates[1] : pct > T.thr[2] ? T.rates[2] : T.rates[3];
}
function _tdPart_(kpi, rev) { var pct = kpi > 0 ? rev / kpi : 0, rate = _tdRate_(pct); return { kpi: kpi, rev: Math.round(rev), pct: pct, rate: rate, penalty: Math.round(kpi * rate), bonus: pct >= 1 ? Math.round(kpi * THIDUA_TIERS_.bonusRate) : 0 }; }
// orders: mảng đơn Pos như Báo cáo E; ym: 'YYYY-MM'. Trả null nếu tháng chưa có cấu hình.
function _computeThiDua_(orders, ym) {
  var cfg = THIDUA_CONFIGS[ym]; if (!cfg) return null;
  var hasGoc = (orders || []).some(function (o) { return !!o.baseNgayTao; }), byUser = {}, revFb = 0, revRest = 0;
  (orders || []).forEach(function (o) {
    if (o.baoHanh) return;
    var ymd = o.baseNgayTao || _ddmmyyyyToYmd_(o.ngayTao); if (String(ymd || '').slice(0, 7) !== ym) return;
    if (hasGoc && !o.donGoc) return;   // đơn không phải đơn gốc: không cộng doanh thu (cùng quy ước thưởng ngày)
    var isFb = THIDUA_FB_SRC_.indexOf(_tdFold_(o.nguonDon)) >= 0;
    _orderRevenueShares_(o).forEach(function (x) {
      var k = _tdFold_(x.name); if (!k) return;
      var u = byUser[k] || (byUser[k] = { total: 0, fb: 0 }); u.total += x.share; if (isFb) { u.fb += x.share; revFb += x.share; } else revRest += x.share;
    });
  });
  var fb = _tdPart_(cfg.kpiFb, revFb), rest = _tdPart_(cfg.kpiTotal - cfg.kpiFb, revRest), heads = cfg.duyenHeads || 0;
  var rows = cfg.commitments.map(function (c) {
    var u = byUser[_tdFold_(c.user)] || { total: 0, fb: 0 }, pct = c.commit > 0 ? u.total / c.commit : 0;
    return { name: c.name, user: c.user, team: c.team, fbMain: !!c.fbMain, commit: c.commit, rev: Math.round(u.total), revFb: Math.round(u.fb), pct: pct, ok: pct >= 1, gap: Math.max(0, Math.round(c.commit - u.total)), penFb: 0, penRest: 0, total: 0 };
  });
  var nFb = rows.filter(function (r) { return r.fbMain; }).length + heads, nRest = rows.filter(function (r) { return !r.ok; }).length + heads;
  var perFb = nFb ? fb.penalty / nFb : 0, perRest = nRest ? rest.penalty / nRest : 0;
  rows.forEach(function (r) { r.penFb = r.fbMain ? Math.round(perFb) : 0; r.penRest = r.ok ? 0 : Math.round(perRest); r.total = r.penFb + r.penRest; });
  var duyen = { penFb: Math.round(perFb * heads), penRest: Math.round(perRest * heads) }; duyen.total = duyen.penFb + duyen.penRest;
  var tot = { penFb: duyen.penFb, penRest: duyen.penRest, total: duyen.total }; rows.forEach(function (r) { tot.penFb += r.penFb; tot.penRest += r.penRest; tot.total += r.total; });
  return { month: ym, label: cfg.label, cfg: cfg, fb: fb, rest: rest, nFb: nFb, nRest: nRest, perFb: Math.round(perFb), perRest: Math.round(perRest), rows: rows, duyen: duyen, totals: tot };
}
function _tdPartHtml_(title, p, n, per, note) {
  var col = p.pct >= 1 ? 'var(--green)' : 'var(--red)';
  return '<div style="flex:1;min-width:260px;border:1px solid var(--border);border-radius:8px;padding:10px 12px"><div style="font-weight:700;margin-bottom:4px">' + esc(title) + '</div>' +
    'KPI ' + _srMoney(p.kpi) + ' · Doanh thu ' + _srMoney(p.rev) + ' · <b style="color:' + col + '">' + (Math.round(p.pct * 1000) / 10) + '%</b><br>' +
    (p.pct >= 1 ? 'Đạt KPI → không phạt (thưởng 0,05% KPI = ' + _srMoney(p.bonus) + ')' : 'Mức phạt ' + (p.rate * 100).toFixed(3).replace(/0+$/, '') + '% × KPI = <b>' + _srMoney(p.penalty) + '</b>' + (n ? ' · chia ' + n + ' người = ' + _srMoney(per) + '/người' : '')) +
    (note ? '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + note + '</div>' : '') + '</div>';
}
function _srThiDuaSectionHtml_(d) {
  var ym = String(_srState.eDateTo || _srState.eDateFrom || '').slice(0, 7), td = _computeThiDua_((d && d.orders) || [], ym);
  if (!td) return '';
  var h = '<div class="dash-section-title" style="margin-top:6px">Thi đua ' + esc(td.label) + ' — thưởng/phạt từng Sale <span style="font-weight:400;color:var(--muted);font-size:11px">(khác "Thưởng phạt đội" ở dưới; cần chọn đủ cả tháng ở bộ lọc ngày)</span></div>';
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">' + _tdPartHtml_('Kênh Facebook chính (Fb Phạm Thu Hiền)', td.fb, td.nFb, td.perFb, 'Chia đều: sale FB chính + Duyên') +
    _tdPartHtml_('Phần còn lại (bỏ kênh FB chính)', td.rest, td.nRest, td.perRest, 'Chia đều: sale chưa đạt cam kết + Duyên (Duyên không có doanh thu, chỉ chia phạt)') + '</div>';
  h += '<table class="dash-table"><thead><tr><th>Sale</th><th style="text-align:right">Cam kết</th><th style="text-align:right">Doanh thu</th><th style="text-align:right">% đạt</th><th style="text-align:right">Còn thiếu</th><th>Kết quả</th><th style="text-align:right">Phạt kênh FB</th><th style="text-align:right">Phạt phần còn lại</th><th style="text-align:right">Tổng phạt</th></tr></thead><tbody>';
  td.rows.forEach(function (r) {
    h += '<tr><td>' + esc(r.name) + (r.fbMain ? ' <span style="font-size:10px;color:var(--muted)">(FB chính)</span>' : '') + '</td><td style="text-align:right">' + _srMoney(r.commit) + '</td><td style="text-align:right">' + _srMoney(r.rev) + '</td><td style="text-align:right">' + (Math.round(r.pct * 1000) / 10) + '%</td><td style="text-align:right">' + (r.gap ? _srMoney(r.gap) : '—') + '</td><td style="color:' + (r.ok ? 'var(--green)' : 'var(--red)') + '">' + (r.ok ? 'Đạt — không phạt' : 'Chưa đạt') + '</td><td style="text-align:right">' + (r.penFb ? _srMoney(r.penFb) : '—') + '</td><td style="text-align:right">' + (r.penRest ? _srMoney(r.penRest) : '—') + '</td><td style="text-align:right"><b>' + (r.total ? _srMoney(r.total) : '—') + '</b></td></tr>';
  });
  h += '<tr><td>Duyên</td><td colspan="5" style="color:var(--muted)">Không có doanh thu — chỉ chia phạt</td><td style="text-align:right">' + _srMoney(td.duyen.penFb) + '</td><td style="text-align:right">' + _srMoney(td.duyen.penRest) + '</td><td style="text-align:right"><b>' + _srMoney(td.duyen.total) + '</b></td></tr>';
  h += '<tr style="font-weight:700"><td>Tổng</td><td colspan="5"></td><td style="text-align:right">' + _srMoney(td.totals.penFb) + '</td><td style="text-align:right">' + _srMoney(td.totals.penRest) + '</td><td style="text-align:right">' + _srMoney(td.totals.total) + '</td></tr></tbody></table>';
  return h + '<div class="guide-text" style="font-size:11px;color:var(--muted);margin:6px 0 16px">Số liệu tạm tính theo đơn đã có trong khoảng ngày đang lọc; sale đạt từ 100% cam kết không bị phạt. Doanh thu chia đều theo số sale trên thẻ, bỏ đơn bảo hành.</div>';
}

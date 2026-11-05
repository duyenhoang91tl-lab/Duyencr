// ── THI ĐUA THÁNG (Báo cáo E, mục "Thi đua — thưởng/phạt từng Sale") — Duyên yêu cầu 2026-11-03 ──
// Hàm THUẦN (không đụng DOM) để test bằng Node: tools/test-thidua.js. Cách tính (Duyên chốt T10, cập nhật T11 ngày 2026-11-04):
//  • KPI Sale = kpiTotal, chia KÊNH: (1) FB chính "Fb Phạm Thu Hiền" kpiFb; (2) CSKH-Duyên kpi riêng (T11: 100tr, nếu có); (3) phần còn lại "Duyên + MKT" = kpiTotal − kpiFb − kpiCskh (T10: 8 tỷ; T11: 6,9 tỷ).
//  • Doanh thu = ĐƠN GỐC, chia đều theo số sale trên thẻ (_orderRevenueShares_ của js/12). FB = nguồn khớp THIDUA_FB_SRC_; CSKH = nguồn chứa từ khoá cskh.sources / thẻ chỉ gồm cskh.users; còn lại = phần "Duyên + MKT".
//  • Marketing: mỗi Marketer (Huy, Hưng) là 1 KÊNH RIÊNG với KPI riêng, doanh thu = đơn có cột Marketer khớp tên; phạt/thưởng của chính người đó, không chia cho Sale.
//  • Tỷ lệ phạt theo % hoàn thành: ≥100% không phạt (thưởng 0,05% KPI — chỉ hiển thị); >90% 0,005%; >80% 0,015%; >70% 0,02%; còn lại 0,025%. Tiền phạt = tỷ lệ × KPI của kênh đó (KHÔNG theo số in sẵn trong file thi đua).
//  • Ai ĐẠT 100% KPI/cam kết của mình thì KHÔNG bị phạt, dưới 100% thì chia đều tiền phạt cùng Duyên: phạt FB = sale FB chính (fbMain) chưa đạt + Mến (không có KPI, luôn chia) + Duyên; phạt "Duyên + MKT" = sale chưa đạt + Duyên. Phạt CSKH-Duyên (Duyên chốt 2026-11-04) = chia đều ĐẦU NGƯỜI cả đội sale + Duyên, không xét đạt, không gồm Mến. Duyên không có doanh thu, chỉ chia phạt.
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
    { name: 'Phạm Thị Hoàng Tươi', user: 'tuoipham1993', team: 'Online', commit: 500e6 },
    { name: 'Bùi Mến', user: 'menbui2002', team: 'Online', fbMain: true, fbOnly: true }] },
  '2026-11': { label: 'Tháng 11/2026', kpiTotal: 8500000000, kpiFb: 1500000000, duyenHeads: 1,
    cskh: { label: 'Kênh CSKH - Duyên', kpi: 100000000, sources: [], users: ['menbui2002'] },   // doanh thu kênh CSKH-Duyên = phần ĐƠN NGOÀI FB của menbui2002 (CSKH); phạt chia Duyên + sale chưa đạt (không gồm Mến) — giả định, Duyên chưa nói rõ cách xác định doanh thu
    marketing: [{ name: 'Ngô Việt Huy', kpi: 6000000000, match: ['ngô việt huy'] }, { name: 'Nguyễn Văn Hưng', kpi: 900000000, match: ['nguyễn văn hưng'] }],
    commitments: [
    { name: 'Trịnh Phương Anh', user: 'anhtrinh1995', team: 'Văn phòng', commit: 650e6 }, { name: 'Đinh Thị Thu Thủy', user: 'thuydinh95', team: 'Văn phòng', commit: 900e6 },
    { name: 'Ninh Thị Ngà', user: 'ninhnga99', team: 'Văn phòng', commit: 1050e6, fbMain: true }, { name: 'Nguyễn Thị Hải Yến', user: 'yenNTH2004', team: 'Văn phòng', commit: 500e6 },
    { name: 'Nguyễn Phương Anh', user: 'anhNP1999', team: 'Văn phòng', commit: 500e6 }, { name: 'Nguyễn Bích Ngọc', user: 'ngocNB2003saleoff', team: 'Văn phòng', commit: 500e6 },
    { name: 'Nguyễn Thị Phương Thảo', user: 'phuongthao2000', team: 'Văn phòng', commit: 600e6 },
    { name: 'Nguyễn Thị Bích', user: 'biichnguyen1993', team: 'Online', commit: 700e6, fbMain: true }, { name: 'Nguyễn Thị Tuyết Mai', user: 'mainguyen97', team: 'Online', commit: 500e6 },
    { name: 'Mai Thị Thu Huyền', user: 'huyenmaii1990', team: 'Online', commit: 1050e6, fbMain: true }, { name: 'Nguyễn Thị Thùy Dung', user: 'dungnguyen1995', team: 'Online', commit: 500e6, fbMain: true },
    { name: 'Tạ Thị Thúy Hà', user: 'thuyha88', team: 'Online', commit: 600e6 }, { name: 'Minh Quách', user: 'minhquach1995', team: 'Online', commit: 850e6 },
    { name: 'Phạm Thị Hoàng Tươi', user: 'tuoipham1993', team: 'Online', commit: 500e6 }, { name: 'Lê Thị Kiều Ninh', user: 'ninhLTK1984', team: 'Online', commit: 500e6 },
    { name: 'Bùi Mến', user: 'menbui2002', team: 'CSKH', fbMain: true, fbOnly: true }] }
};
function _tdFold_(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
function _tdRate_(pct) {
  var T = THIDUA_TIERS_;
  if (pct >= 1) return 0;
  return pct > T.thr[0] ? T.rates[0] : pct > T.thr[1] ? T.rates[1] : pct > T.thr[2] ? T.rates[2] : T.rates[3];
}
function _tdPart_(kpi, rev) { var pct = kpi > 0 ? rev / kpi : 0, rate = _tdRate_(pct); return { kpi: kpi, rev: Math.round(rev), pct: pct, rate: rate, penalty: Math.round(kpi * rate), bonus: pct >= 1 ? Math.round(kpi * THIDUA_TIERS_.bonusRate) : 0 }; }
// orders: mảng đơn Pos như Báo cáo E; ym: 'YYYY-MM'. Trả null nếu tháng chưa có cấu hình.
function _tdHasAny_(txt, arr) { txt = _tdFold_(txt); return (arr || []).some(function (k) { return k && txt.indexOf(_tdFold_(k)) >= 0; }); }
function _computeThiDua_(orders, ym) {
  var cfg = THIDUA_CONFIGS[ym]; if (!cfg) return null;
  var cs = cfg.cskh && cfg.cskh.kpi > 0 ? cfg.cskh : null, csOk = !!(cs && ((cs.sources || []).length || (cs.users || []).length));
  var hasGoc = (orders || []).some(function (o) { return !!o.baseNgayTao; }), byUser = {}, revFb = 0, revCs = 0, revRest = 0, fbOnlySet = {}, mk = (cfg.marketing || []).map(function (m) { return { cfg: m, rev: 0, n: 0 }; });
  cfg.commitments.forEach(function (c) { if (c.fbOnly) fbOnlySet[_tdFold_(c.user)] = true; });   // fbOnly (VD Mến): chỉ tính đơn kênh FB chính, đơn ngoài FB bị loại khỏi doanh thu
  (orders || []).forEach(function (o) {
    if (o.baoHanh) return;
    var ymd = o.baseNgayTao || _ddmmyyyyToYmd_(o.ngayTao); if (String(ymd || '').slice(0, 7) !== ym) return;
    if (hasGoc && !o.donGoc) return;   // đơn không phải đơn gốc: không cộng doanh thu (cùng quy ước thưởng ngày)
    var shares = _orderRevenueShares_(o), isFb = THIDUA_FB_SRC_.indexOf(_tdFold_(o.nguonDon)) >= 0, srcCs = !isFb && csOk && _tdHasAny_(o.nguonDon, cs.sources);
    shares.forEach(function (x) {
      var k = _tdFold_(x.name); if (!k) return;
      var skipUser = fbOnlySet[k] && !isFb;   // fbOnly (Mến): đơn ngoài FB không tính vào doanh thu cá nhân / phần Duyên+MKT; riêng đơn nguồn CSKH vẫn thuộc kênh CSKH-Duyên
      if (!skipUser) { var u = byUser[k] || (byUser[k] = { total: 0, fb: 0 }); u.total += x.share; if (isFb) u.fb += x.share; }
      var isCs = !isFb && csOk && (srcCs || (cs.users || []).some(function (uu) { return _tdFold_(uu) === k; }));   // đơn nguồn CSKH, hoặc PHẦN CỦA người thuộc kênh CSKH (Mến) trên đơn ngoài FB
      if (isFb) revFb += x.share; else if (isCs) revCs += x.share; else if (!skipUser) revRest += x.share;
    });
    mk.forEach(function (m) { if ((m.cfg.match || []).some(function (n) { return _tdFold_(o.marketer) === _tdFold_(n); })) { m.rev += Number(o.giaTriDon) || 0; m.n++; } });
  });
  var fb = _tdPart_(cfg.kpiFb, revFb), rest = _tdPart_(cfg.kpiTotal - cfg.kpiFb - (cs ? cs.kpi : 0), revRest), heads = cfg.duyenHeads || 0;
  var csPart = cs ? _tdPart_(cs.kpi, revCs) : null; if (csPart) { csPart.label = cs.label; csPart.pending = !csOk; if (!csOk) { csPart.penalty = 0; csPart.bonus = 0; } }
  var rows = cfg.commitments.map(function (c) {
    var u = byUser[_tdFold_(c.user)] || { total: 0, fb: 0 }, pct = c.commit > 0 ? u.total / c.commit : 0, ok = c.fbOnly ? true : pct >= 1;
    return { name: c.name, user: c.user, team: c.team, fbMain: !!c.fbMain, fbOnly: !!c.fbOnly, commit: c.commit || 0, rev: Math.round(u.total), revFb: Math.round(u.fb), pct: pct, ok: ok, gap: c.fbOnly ? 0 : Math.max(0, Math.round(c.commit - u.total)), penFb: 0, penRest: 0, total: 0 };
  });
  var nFb = rows.filter(function (r) { return r.fbMain && (r.fbOnly || !r.ok); }).length + heads, nRest = rows.filter(function (r) { return !r.ok; }).length + heads, nCs = rows.filter(function (r) { return !r.fbOnly; }).length + heads;   // FB: sale FB chính CHƯA đạt 100% cam kết + Mến (không có KPI) + Duyên; CSKH: cả đội sale (đầu người) + Duyên
  var perFb = nFb ? fb.penalty / nFb : 0, perRest = nRest ? rest.penalty / nRest : 0, perCs = csPart && nCs ? csPart.penalty / nCs : 0;   // phạt CSKH-Duyên chia ĐỀU ĐẦU NGƯỜI cả đội sale + Duyên (không xét đạt/chưa đạt, không gồm Mến)
  rows.forEach(function (r) { r.penFb = r.fbMain && (r.fbOnly || !r.ok) ? Math.round(perFb) : 0; r.penRest = r.ok ? 0 : Math.round(perRest); r.penCskh = r.fbOnly ? 0 : Math.round(perCs); r.total = r.penFb + r.penRest + r.penCskh; });
  var duyen = { penFb: Math.round(perFb * heads), penRest: Math.round(perRest * heads), penCskh: Math.round(perCs * heads) }; duyen.total = duyen.penFb + duyen.penRest + duyen.penCskh;
  var tot = { penFb: duyen.penFb, penRest: duyen.penRest, penCskh: duyen.penCskh, total: duyen.total }; rows.forEach(function (r) { tot.penFb += r.penFb; tot.penRest += r.penRest; tot.penCskh += r.penCskh; tot.total += r.total; });
  var marketing = mk.map(function (m) { var p = _tdPart_(m.cfg.kpi, m.rev); p.name = m.cfg.name; p.orders = m.n; return p; });
  return { month: ym, label: cfg.label, cfg: cfg, fb: fb, cskh: csPart, rest: rest, marketing: marketing, nFb: nFb, nRest: nRest, nCs: nCs, perCs: Math.round(perCs), perFb: Math.round(perFb), perRest: Math.round(perRest), rows: rows, duyen: duyen, totals: tot };
}
function _tdPartHtml_(title, p, n, per, note) {
  var col = p.pct >= 1 ? 'var(--green)' : 'var(--red)';
  var body = p.pending ? '<span style="color:#9a3412">Chưa xác định cách tính doanh thu kênh này (cần cấu hình nguồn/người của kênh) — chưa tính phạt.</span>' :
    'KPI ' + _srMoney(p.kpi) + ' · Doanh thu ' + _srMoney(p.rev) + ' · <b style="color:' + col + '">' + (Math.round(p.pct * 1000) / 10) + '%</b><br>' +
    (p.pct >= 1 ? 'Đạt KPI → không phạt (thưởng 0,05% KPI = ' + _srMoney(p.bonus) + ')' : 'Mức phạt ' + (p.rate * 100).toFixed(3).replace(/0+$/, '') + '% × KPI = <b>' + _srMoney(p.penalty) + '</b>' + (n ? ' · chia ' + n + ' người = ' + _srMoney(per) + '/người' : ''));
  return '<div style="flex:1;min-width:260px;border:1px solid var(--border);border-radius:8px;padding:10px 12px"><div style="font-weight:700;margin-bottom:4px">' + esc(title) + '</div>' + body +
    (note ? '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + note + '</div>' : '') + '</div>';
}
function _srThiDuaSectionHtml_(d) {
  var ym = String(_srState.eDateTo || _srState.eDateFrom || '').slice(0, 7), td = _computeThiDua_((d && d.orders) || [], ym);
  if (!td) return '';
  var h = '<div class="dash-section-title" style="margin-top:6px">Thi đua ' + esc(td.label) + ' — thưởng/phạt từng Sale <span style="font-weight:400;color:var(--muted);font-size:11px">(khác "Thưởng phạt đội" ở dưới; cần chọn đủ cả tháng ở bộ lọc ngày)</span></div>';
  h += '<div style="margin-bottom:6px"><button class="btn sm" onclick="_srThiDuaExportXlsx()">⬇ Xuất Excel thi đua</button></div>';
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">' + _tdPartHtml_('Kênh Facebook chính (Fb Phạm Thu Hiền)', td.fb, td.nFb, td.perFb, 'Chia đều: ' + td.rows.filter(function (r) { return r.fbMain; }).length + ' người FB chính' + ' (chỉ người chưa đạt 100% cam kết + Mến) + Duyên') +
    _tdPartHtml_('Duyên + MKT (bỏ kênh FB chính' + (td.cskh ? ' và CSKH-Duyên' : '') + ')', td.rest, td.nRest, td.perRest, 'Chia đều: sale chưa đạt cam kết + Duyên (Duyên không có doanh thu, chỉ chia phạt)') +
    (td.cskh ? _tdPartHtml_(td.cskh.label || 'Kênh CSKH - Duyên', td.cskh, td.nCs, td.perCs, 'Doanh thu = đơn ngoài FB của Mến. Chia đều ĐẦU NGƯỜI: cả đội sale + Duyên (không gồm Mến), không xét đạt cam kết') : '') + '</div>';
  if (td.marketing.length) h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">' + td.marketing.map(function (m) { return _tdPartHtml_('Marketing — ' + m.name + ' (kênh riêng)', m, 1, m.penalty, m.orders ? m.orders + ' đơn có Marketer khớp tên. TỰ CHỊU phạt theo tỷ lệ đạt kênh của mình (không chia cho ai, không cộng vào bảng Sale)' : '⚠ Chưa có đơn nào có Marketer khớp tên "' + esc(m.name) + '" — kiểm tra cột Marketer'); }).join('') + '</div>';
  h += '<table class="dash-table"><thead><tr><th>Sale</th><th style="text-align:right">Cam kết</th><th style="text-align:right">Doanh thu</th><th style="text-align:right">% đạt</th><th style="text-align:right">Còn thiếu</th><th>Kết quả</th><th style="text-align:right">Phạt kênh FB</th><th style="text-align:right">Phạt Duyên + MKT</th><th style="text-align:right">Phạt CSKH</th><th style="text-align:right">Tổng phạt</th></tr></thead><tbody>';
  td.rows.forEach(function (r) {
    h += '<tr><td>' + esc(r.name) + (r.fbMain ? ' <span style="font-size:10px;color:var(--muted)">(FB chính)</span>' : '') + '</td><td style="text-align:right">' + (r.fbOnly ? '—' : _srMoney(r.commit)) + '</td><td style="text-align:right">' + _srMoney(r.rev) + '</td><td style="text-align:right">' + (r.fbOnly ? '—' : (Math.round(r.pct * 1000) / 10) + '%') + '</td><td style="text-align:right">' + (r.gap ? _srMoney(r.gap) : '—') + '</td><td style="color:' + (r.ok ? 'var(--green)' : 'var(--red)') + '">' + (r.fbOnly ? 'Chỉ chia phạt kênh FB' : (r.ok ? 'Đạt — không phạt' : 'Chưa đạt')) + '</td><td style="text-align:right">' + (r.penFb ? _srMoney(r.penFb) : '—') + '</td><td style="text-align:right">' + (r.penRest ? _srMoney(r.penRest) : '—') + '</td><td style="text-align:right">' + (r.penCskh ? _srMoney(r.penCskh) : '—') + '</td><td style="text-align:right"><b>' + (r.total ? _srMoney(r.total) : '—') + '</b></td></tr>';
  });
  h += '<tr><td>Duyên</td><td colspan="5" style="color:var(--muted)">Không có doanh thu — chỉ chia phạt</td><td style="text-align:right">' + _srMoney(td.duyen.penFb) + '</td><td style="text-align:right">' + _srMoney(td.duyen.penRest) + '</td><td style="text-align:right">' + (td.duyen.penCskh ? _srMoney(td.duyen.penCskh) : '—') + '</td><td style="text-align:right"><b>' + _srMoney(td.duyen.total) + '</b></td></tr>';
  h += '<tr style="font-weight:700"><td>Tổng (Sale + Duyên)</td><td colspan="5"></td><td style="text-align:right">' + _srMoney(td.totals.penFb) + '</td><td style="text-align:right">' + _srMoney(td.totals.penRest) + '</td><td style="text-align:right">' + _srMoney(td.totals.penCskh) + '</td><td style="text-align:right">' + _srMoney(td.totals.total) + '</td></tr></tbody></table>';
  return h + '<div class="guide-text" style="font-size:11px;color:var(--muted);margin:6px 0 16px">Số liệu tạm tính theo đơn đã có trong khoảng ngày đang lọc; sale đạt từ 100% cam kết không bị phạt. Doanh thu chia đều theo số sale trên thẻ, bỏ đơn bảo hành. Phạt Marketing (Huy/Hưng) tính riêng ở trên, không cộng vào bảng Sale.</div>';
}
// ── Xuất Excel thi đua: sheet "Tong hop kenh" + "Tung sale" ──
function _tdExportRows_(td) {
  var pct = function (p) { return Math.round(p.pct * 1000) / 10 + '%'; }, rate = function (p) { return p.pct >= 1 ? 0 : p.rate; };
  var kenh = [['Kênh', 'KPI (đ)', 'Doanh thu (đ)', '% hoàn thành', 'Tỷ lệ phạt', 'Tiền phạt (đ)', 'Thưởng nếu đạt (đ)', 'Số người chia phạt', 'Mỗi người (đ)', 'Ghi chú']];
  kenh.push(['FB chính (Fb Phạm Thu Hiền)', td.fb.kpi, td.fb.rev, pct(td.fb), rate(td.fb), td.fb.penalty, td.fb.bonus, td.nFb, td.perFb, 'Sale FB chính chưa đạt 100% cam kết + Mến + Duyên']);
  kenh.push(['Duyên + MKT (phần còn lại)', td.rest.kpi, td.rest.rev, pct(td.rest), rate(td.rest), td.rest.penalty, td.rest.bonus, td.nRest, td.perRest, 'Sale chưa đạt cam kết + Duyên']);
  if (td.cskh) kenh.push([td.cskh.label || 'CSKH - Duyên', td.cskh.kpi, td.cskh.rev, td.cskh.pending ? 'chưa xác định' : pct(td.cskh), td.cskh.pending ? '' : rate(td.cskh), td.cskh.penalty, td.cskh.bonus, td.nCs, td.perCs, td.cskh.pending ? 'Chưa cấu hình cách tính doanh thu kênh' : 'Chia đều đầu người cả đội sale + Duyên (không gồm Mến)']);
  td.marketing.forEach(function (m) { kenh.push(['Marketing — ' + m.name, m.kpi, m.rev, pct(m), rate(m), m.penalty, m.bonus, 1, m.penalty, m.orders + ' đơn khớp Marketer. Tự chịu phạt theo tỷ lệ đạt kênh']); });
  var sale = [['Sale', 'Tài khoản', 'Đội', 'Cam kết (đ)', 'Doanh thu (đ)', '% đạt', 'Còn thiếu (đ)', 'Kết quả', 'Phạt kênh FB (đ)', 'Phạt Duyên + MKT (đ)', 'Phạt CSKH (đ)', 'Tổng phạt (đ)']];
  td.rows.forEach(function (r) { sale.push([r.name, r.user, r.team, r.fbOnly ? '' : r.commit, r.rev, r.fbOnly ? '' : Math.round(r.pct * 1000) / 10 + '%', r.gap, r.fbOnly ? 'Chỉ chia phạt FB' : (r.ok ? 'Đạt' : 'Chưa đạt'), r.penFb, r.penRest, r.penCskh, r.total]); });
  sale.push(['Duyên', '', 'Quản lý', '', '', '', '', 'Chỉ chia phạt', td.duyen.penFb, td.duyen.penRest, td.duyen.penCskh, td.duyen.total]);
  sale.push(['TỔNG', '', '', '', '', '', '', '', td.totals.penFb, td.totals.penRest, td.totals.penCskh, td.totals.total]);
  return { kenh: kenh, sale: sale };
}
function _srThiDuaExportXlsx() {
  var d = _srState.dataE, ym = String(_srState.eDateTo || _srState.eDateFrom || '').slice(0, 7);
  if (!d) { alert('Chưa có dữ liệu — đợi tải xong rồi bấm lại.'); return; }
  if (typeof XLSX === 'undefined') { alert('Thư viện xuất Excel chưa tải xong — thử lại sau vài giây.'); return; }
  var td = _computeThiDua_(d.orders || [], ym); if (!td) { alert('Tháng ' + ym + ' chưa có cấu hình thi đua.'); return; }
  var x = _tdExportRows_(td), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(x.kenh), 'Tong hop kenh');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(x.sale), 'Tung sale');
  XLSX.writeFile(wb, 'ThiDua_' + ym + '.xlsx');
}

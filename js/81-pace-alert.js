/* 81-pace-alert.js — R4c (Duyên chốt 16/11/2026): CẢNH BÁO SALE CHẠY CHẬM SO VỚI TIẾN ĐỘ MỤC TIÊU THÁNG + TỶ LỆ CHỐT THẤP HƠN TRUNG BÌNH TEAM.
   Thay cho luật cũ "tụt ≥20% so kỳ trước" (js/36 proAlertItems_, vẫn giữ để test cũ chạy nhưng KHÔNG còn được gọi).
   Hàm THUẦN (không đụng DOM/mạng): paceAlertItems_(people, range, opts) → mảng mục khuyến nghị cùng dạng proRecoItems_ ({n,tone,text,go,act}).

   LUẬT (Duyên chốt):
   • Mục tiêu doanh số THÁNG: 500 triệu (chính thức), 100 triệu (thử việc = sale có SALE_CHANNELS[tên]==='probation', truyền qua opts.isProbation).
   • Tiến độ cần có = mục tiêu × Σ(1/số ngày của tháng đó) trên từng ngày đã qua của kỳ đang xem (cắt ở HÔM NAY). VD tháng 30 ngày, 10 ngày đầu → 10/30 → 500tr cần 166,7tr; chạy 150tr = 90% → cảnh báo.
   • 4 MỨC theo % tiến độ đạt được: 1 = 85–<100 · 2 = 65–<85 · 3 = 50–<65 · 4 = <50. (≥100 → không cảnh báo.)
   • Tỷ lệ chốt (Duyên chốt 16/11): cảnh báo trong CẢ 2 trường hợp ĐỘC LẬP — (1) thấp hơn tỷ lệ chốt trung bình team (bình quân gia quyền theo số khách tương tác), (2) dưới PACE_CLOSE_FLOOR_PCT (1%). Cả so sánh lẫn hiển thị đều làm tròn 2 chữ số (VD 1,02%). Sale vào cả (1) và (2) chỉ nêu ở dòng (2).
   • (Duyên chốt 16/11, ý 5) Tiến độ chia theo NGÀY LÀM THỰC TẾ / tổng ngày tháng: mỗi sale chỉ tính các ngày TỪ ngày bắt đầu nhận tin (opts.startDateOf(tên) → 'YYYY-MM-DD'; không có = tính từ đầu kỳ). VD vào mùng 3, đào tạo 5 ngày, nhận tin từ mùng 9 → chỉ tính từ 9 đến hết tháng (mục tiêu cả tháng × số ngày đó / số ngày tháng). Ngày bắt đầu SAU hôm nay/sau kỳ → chưa báo. Ngày kém hợp lệ → bỏ qua.
   ĐIỀU TÔI TỰ THÊM (hằng ở dưới, đổi được): chưa đủ PACE_MIN_DAYS ngày thì chưa báo tiến độ (ngày 1–2 số nhỏ, báo oan); chỉ xét sale có hoạt động (có đơn/doanh thu/tin nhắn) để không báo tài khoản không bán; tỷ lệ chốt chỉ xét sale ≥ PACE_MIN_TT khách tương tác.
   Test: node tools/test-pace-alert.js. Gắn vào Tổng quan: js/36 proHomeRender_ (nạp SAU js/36 cũng được vì chỉ gọi lúc vẽ). */
(function () {
  'use strict';
  var PACE_TARGET_OFFICIAL = 500000000;    // đ/tháng — chính thức
  var PACE_TARGET_PROBATION = 100000000;   // đ/tháng — thử việc
  var PACE_MIN_DAYS = 3;                   // số ngày tối thiểu đã qua mới báo tiến độ
  var PACE_CLOSE_FLOOR_PCT = 1;            // tỷ lệ chốt DƯỚI 1% → cảnh báo (độc lập với so TB team)
  var PACE_MIN_TT = 30;                    // sale cần ≥ 30 khách tương tác mới xét tỷ lệ chốt
  var PACE_LEVELS = [                      // từ nặng → nhẹ: dưới `lt` (%) thì thuộc mức này
    { lv: 4, lt: 50, icon: '⛔', label: 'dưới 50% tiến độ', tone: 'bad' },
    { lv: 3, lt: 65, icon: '🔴', label: '50% – dưới 65% tiến độ', tone: 'bad' },
    { lv: 2, lt: 85, icon: '🟠', label: '65% – dưới 85% tiến độ', tone: '' },
    { lv: 1, lt: 100, icon: '🟡', label: '85% – dưới 100% tiến độ', tone: '' }
  ];

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dayMs(ymd) { return Date.parse(String(ymd == null ? '' : ymd).slice(0, 10) + 'T00:00:00Z'); }
  function dim(ms) { var d = new Date(ms); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); }
  function vn(n, dec) { var f = Math.pow(10, dec == null ? 1 : dec), r = Math.round(n * f) / f; return String(r).replace('.', ','); }
  function tr(n) { return vn(n / 1e6, 1) + 'tr'; }
  function r2_(n) { return Math.round(Number(n) * 100) / 100; }                          // làm tròn 2 chữ số thập phân
  function fx2_(n) { return r2_(n).toFixed(2).replace('.', ','); }                       // luôn 2 chữ số: 1,10 / 1,02

  // Tỷ lệ tháng đã qua của kỳ [from, min(to, today)]: Σ 1/(số ngày của tháng chứa ngày đó). Trả {frac, days} hoặc null (ngày sai / kỳ chưa bắt đầu).
  function paceFraction_(from, to, today) {
    var f = dayMs(from), t = dayMs(to);
    if (isNaN(f) || isNaN(t) || f > t) return null;
    if (today) { var td = dayMs(today); if (!isNaN(td) && t > td) t = td; }
    if (t < f) return null;
    var frac = 0, days = 0;
    for (var ms = f; ms <= t; ms += 86400000) { frac += 1 / dim(ms); days++; if (days > 800) return null; }
    return { frac: frac, days: days };
  }
  // % tiến độ làm tròn 1 chữ số (làm tròn TRƯỚC khi xếp mức để số hiển thị luôn khớp mức: 84,96 hiện 85,0 thì thuộc mức 1, không phải mức 2). expected<=0 → null.
  function pacePct_(revenue, target, frac) {
    var exp = target * frac; if (!(exp > 0)) return null;
    return Math.round((Number(revenue) || 0) / exp * 1000) / 10;
  }
  // Mức cảnh báo 0..4 từ % tiến độ (null → 0).
  function paceLevel_(pct) {
    if (pct === null || pct === undefined || isNaN(Number(pct))) return 0;
    for (var i = 0; i < PACE_LEVELS.length; i++) if (Number(pct) < PACE_LEVELS[i].lt) return PACE_LEVELS[i].lv;
    return 0;
  }
  function active_(p) { return (Number(p.revenue) || 0) > 0 || (Number(p.orders) || 0) > 0 || (Number(p.tongTT) || 0) > 0; }
  // Tỷ lệ chốt TB team gia quyền theo số khách tương tác (chỉ sale có tongTT>0 và tyLeChot là số). Không có ai → null.
  function paceTeamClose_(people) {
    var s = 0, w = 0;
    (people || []).forEach(function (p) {
      if (!p) return; var tt = Number(p.tongTT) || 0, r = p.tyLeChot;
      if (tt > 0 && r !== null && r !== undefined && r !== '' && !isNaN(Number(r))) { s += Number(r) * tt; w += tt; }
    });
    return w > 0 ? s / w : null;
  }
  function names_(arr, fmt) { return arr.slice(0, 3).map(fmt).join(', ') + (arr.length > 3 ? ' …' : ''); }

  function validYmd_(v) { var m = String(v == null ? '' : v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m && !isNaN(dayMs(m[0])) ? m[0] : ''; }
  function dm_(ymd) { return ymd ? (Number(ymd.slice(8, 10)) + '/' + Number(ymd.slice(5, 7))) : ''; }

  // people: [{name, revenue, orders, tongTT, tyLeChot}] · range: {from,to} (YYYY-MM-DD) · opts: {today, isProbation(name)→bool}
  function paceAlertItems_(people, range, opts) {
    opts = opts || {}; var out = [], list = (people || []).filter(function (p) { return p && p.name && active_(p); });
    if (!list.length) return out;
    if (range) {
      var byLv = { 1: [], 2: [], 3: [], 4: [] }, any = false;
      list.forEach(function (p) {
        var prob = false; try { prob = !!(opts.isProbation && opts.isProbation(p.name)); } catch (e) { prob = false; }
        var st = ''; try { st = validYmd_(opts.startDateOf && opts.startDateOf(p.name)); } catch (e) { st = ''; }
        var effFrom = (st && st > validYmd_(range.from)) ? st : range.from;                    // chỉ tính từ ngày nhận tin (nếu muộn hơn đầu kỳ)
        var fr = paceFraction_(effFrom, range.to, opts.today);                                  // null = chưa bắt đầu / kỳ sai
        if (!fr || fr.days < PACE_MIN_DAYS) return;                                             // chưa đủ ngày LÀM THỰC TẾ của sale này
        var target = prob ? PACE_TARGET_PROBATION : PACE_TARGET_OFFICIAL, pct = pacePct_(p.revenue, target, fr.frac), lv = paceLevel_(pct);
        if (lv) { any = true; byLv[lv].push({ name: p.name, pct: pct, rev: Number(p.revenue) || 0, exp: target * fr.frac, since: (st && st > validYmd_(range.from)) ? dm_(st) : '' }); }
      });
      if (any) PACE_LEVELS.forEach(function (L) {
        var a = byLv[L.lv]; if (!a.length) return;
        a.sort(function (x, y) { return x.pct - y.pct; });
        out.push({ n: a.length, tone: L.tone, go: '', act: '',
          text: '<b>' + L.icon + ' Doanh số chạy chậm — ' + L.label + '</b>: ' + names_(a, function (x) { return esc(x.name) + ' ' + vn(x.pct, 1) + '% (' + tr(x.rev) + '/' + tr(x.exp) + (x.since ? ', từ ' + x.since : '') + ')'; }) });
      });
    }
    var avg = paceTeamClose_(list);
    if (avg !== null) {
      var avg2 = r2_(avg), floor = [], below = [];
      list.forEach(function (p) {
        var tt = Number(p.tongTT) || 0, r = p.tyLeChot; if (tt < PACE_MIN_TT || r === null || r === undefined || r === '' || isNaN(Number(r))) return;
        var v = r2_(r), d = Math.round((v - avg2) * 100) / 100;
        if (v < PACE_CLOSE_FLOOR_PCT) floor.push({ name: p.name, r: v, d: d });             // (2) dưới 1%
        else if (v < avg2) below.push({ name: p.name, r: v, d: d });                         // (1) thấp hơn TB team (không lặp lại người đã ở dòng dưới 1%)
      });
      var byRate = function (x, y) { return x.r - y.r; };
      if (floor.length) {
        floor.sort(byRate);
        out.push({ n: floor.length, tone: 'bad', go: '', act: '',
          text: '<b>Tỷ lệ chốt dưới ' + PACE_CLOSE_FLOOR_PCT + '%</b> (TB team ' + fx2_(avg2) + '%): ' + names_(floor, function (x) { return esc(x.name) + ' ' + fx2_(x.r) + '%'; }) });
      }
      if (below.length) {
        below.sort(byRate);
        out.push({ n: below.length, tone: 'bad', go: '', act: '',
          text: '<b>Tỷ lệ chốt thấp hơn trung bình team (' + fx2_(avg2) + '%)</b>: ' + names_(below, function (x) { return esc(x.name) + ' ' + fx2_(x.r) + '% (−' + fx2_(Math.abs(x.d)) + ' điểm)'; }) });
      }
    }
    return out;
  }

  var api = { paceAlertItems_: paceAlertItems_, paceFraction_: paceFraction_, pacePct_: pacePct_, paceLevel_: paceLevel_, paceTeamClose_: paceTeamClose_,
    PACE_TARGET_OFFICIAL: PACE_TARGET_OFFICIAL, PACE_TARGET_PROBATION: PACE_TARGET_PROBATION, PACE_MIN_DAYS: PACE_MIN_DAYS, PACE_CLOSE_FLOOR_PCT: PACE_CLOSE_FLOOR_PCT, PACE_MIN_TT: PACE_MIN_TT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else for (var k in api) window[k] = api[k];
})();

// ════════════════════════════════════════════════════════════════════
//  R8a (LOGIC THUẦN) — CHẤM ĐIỂM KHÁCH NÓNG / ẤM / NGUỘI. Nạp SAU js/76. Chưa có giao diện (R8b/R8c gắn vào).
//  NGUYÊN NHÂN GỐC: CS không biết gọi khách nào trước; danh sách chỉ lọc theo trạng thái/ngày, không có xếp ưu tiên.
//  Duyên chốt 2026-11-15: "nguội" = KHÔNG chăm sóc quá 60 ngày (LS_COLD_DAYS).
//  Luật (không hộp đen — mỗi khách trả kèm `reasons` để hiện lý do):
//   • Điểm = gần đây có chăm (≤7 ngày +3 · ≤30 +2 · ≤60 +1) + mua gần đây theo Pos (≤30 ngày +3 · ≤90 +2 · ≤180 +1)
//            + có lịch hẹn hôm nay/sắp tới (≤7 ngày) +2 + hạng VIP/Thân thiết +1 + đã mua ≥2 đơn +1.
//   • Mức: điểm ≥6 = NÓNG · 3–5 = ẤM · <3 = NGUỘI.
//   • ÉP NGUỘI: quá 60 ngày không chăm (hoặc chưa chăm lần nào mà lần mua cuối cũng quá 60 ngày) VÀ không có lịch sắp tới.
//   • "Sắp mất" (risk) = nguội + đã từng mua (≥1 đơn) + hạng từ Tiềm năng trở lên → xếp theo doanh thu để cứu trước.
//  Hàm thuần: lsDaysBetween_, lsUpcoming_, lsScore_, lsRank_, lsAtRisk_ (test: node tools/test-lead-score.js)
// ════════════════════════════════════════════════════════════════════
var LS_COLD_DAYS = 60, LS_HOT_MIN = 6, LS_WARM_MIN = 3, LS_SOON_DAYS = 7;
var LS_LEVEL_LABEL = { hot: 'Nóng', warm: 'Ấm', cold: 'Nguội' };
var LS_TIER_RANK = { 'Chưa bán lại được': 0, 'Tiềm năng': 1, 'Thân thiết': 2, 'VIP': 3 };

// Số ngày lịch giữa 2 mốc thời gian (ms), làm tròn theo NGÀY LỊCH (bỏ giờ) để không lệch múi giờ. null nếu thiếu mốc.
function lsDaysBetween_(fromTs, toTs){
  if (!fromTs || !toTs || isNaN(fromTs) || isNaN(toTs)) return null;
  var a = new Date(fromTs), b = new Date(toTs);
  var da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()), db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / 86400000);
}
// Lịch CHƯA xong của 1 khách: { over: số lịch quá hạn, soon: số lịch hôm nay..+LS_SOON_DAYS ngày }. schedules = [{phone,date:'YYYY-MM-DD',done}]
function lsUpcoming_(schedules, phone, todayYmd){
  var res = { over: 0, soon: 0 }; if (!phone || !todayYmd) return res;
  var t = Date.parse(todayYmd + 'T00:00:00'), lim = t + LS_SOON_DAYS * 86400000;
  (schedules || []).forEach(function(s){
    if (!s || s.done || s.phone !== phone || !s.date) return;
    var d = String(s.date).slice(0, 10); if (d < todayYmd) { res.over++; return; }
    var ts = Date.parse(d + 'T00:00:00'); if (!isNaN(ts) && ts <= lim) res.soon++;
  });
  return res;
}
// c: { phone, _lastActionDate(ms|null), lastPosDate(ms|null), totalOrders, tier }. Trả { score, level, label, days, reasons[], over, soon, risk }
function lsScore_(c, schedules, nowTs){
  c = c || {}; var now = nowTs || Date.now();
  var today = new Date(now), ymd = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  var dCare = lsDaysBetween_(c._lastActionDate, now), dBuy = lsDaysBetween_(c.lastPosDate, now);
  var up = lsUpcoming_(schedules, c.phone, ymd), score = 0, reasons = [];
  if (dCare === null) reasons.push('chưa từng được chăm sóc');
  else if (dCare <= 7) { score += 3; reasons.push('mới chăm ' + dCare + ' ngày trước'); }
  else if (dCare <= 30) { score += 2; reasons.push('chăm cách đây ' + dCare + ' ngày'); }
  else if (dCare <= LS_COLD_DAYS) { score += 1; reasons.push('chăm cách đây ' + dCare + ' ngày'); }
  else reasons.push('đã ' + dCare + ' ngày chưa chăm');
  if (dBuy !== null) {
    if (dBuy <= 30) { score += 3; reasons.push('mới mua ' + dBuy + ' ngày trước'); }
    else if (dBuy <= 90) { score += 2; reasons.push('mua cách đây ' + dBuy + ' ngày'); }
    else if (dBuy <= 180) { score += 1; reasons.push('mua cách đây ' + dBuy + ' ngày'); }
    else reasons.push('lần mua cuối cách đây ' + dBuy + ' ngày');
  }
  if (up.soon) { score += 2; reasons.push(up.soon + ' lịch hẹn sắp tới'); }
  if (up.over) reasons.push(up.over + ' lịch QUÁ HẠN');
  var tr = LS_TIER_RANK[c.tier] || 0; if (tr >= 2) { score += 1; reasons.push('hạng ' + c.tier); }
  if ((c.totalOrders || 0) >= 2) { score += 1; reasons.push('đã mua ' + c.totalOrders + ' đơn'); }
  // Mốc "lần tiếp xúc cuối": chăm gần nhất; chưa chăm lần nào thì lấy lần mua cuối (khách mới mua mà chưa ai gọi KHÔNG phải nguội).
  var since = dCare !== null ? dCare : dBuy;
  var forceCold = since !== null && since > LS_COLD_DAYS && !up.soon;
  // Khách chưa chăm lần nào và cũng chưa mua (không có mốc nào) → không đủ dữ liệu để gọi là nóng.
  var level = forceCold ? 'cold' : (score >= LS_HOT_MIN ? 'hot' : (score >= LS_WARM_MIN ? 'warm' : 'cold'));
  var risk = level === 'cold' && (c.totalOrders || 0) >= 1 && tr >= 1;
  return { score: score, level: level, label: LS_LEVEL_LABEL[level], days: since, reasons: reasons, over: up.over, soon: up.soon, risk: risk };
}
// Xếp ưu tiên gọi: nóng trước (điểm cao trước) → ấm → nguội; cùng điểm: doanh thu cao trước. Trả [{c, s}] (tối đa limit).
function lsRank_(customers, schedules, nowTs, limit, filter){
  var out = [];
  (customers || []).forEach(function(c){ if (filter && !filter(c)) return; out.push({ c: c, s: lsScore_(c, schedules, nowTs) }); });
  var ord = { hot: 0, warm: 1, cold: 2 };
  out.sort(function(a, b){ return (ord[a.s.level] - ord[b.s.level]) || (b.s.score - a.s.score) || ((b.c.totalRevenue || 0) - (a.c.totalRevenue || 0)); });
  return limit ? out.slice(0, limit) : out;
}
// Khách "sắp mất": nguội + từng mua + hạng ≥ Tiềm năng → cứu theo doanh thu cao trước. Trả { n, items:[{c,s}] (≤limit) }
function lsAtRisk_(customers, schedules, nowTs, limit, filter){
  var all = [];
  (customers || []).forEach(function(c){ if (filter && !filter(c)) return; var s = lsScore_(c, schedules, nowTs); if (s.risk) all.push({ c: c, s: s }); });
  all.sort(function(a, b){ return ((b.c.totalRevenue || 0) - (a.c.totalRevenue || 0)) || ((b.s.days || 0) - (a.s.days || 0)); });
  return { n: all.length, items: limit ? all.slice(0, limit) : all };
}

if (typeof module !== 'undefined' && module.exports){ module.exports = { lsDaysBetween_: lsDaysBetween_, lsUpcoming_: lsUpcoming_, lsScore_: lsScore_, lsRank_: lsRank_, lsAtRisk_: lsAtRisk_, LS_COLD_DAYS: LS_COLD_DAYS }; }

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
function lsRank_(customers, schedules, nowTs, limit, filter, byPhone){
  var out = [];
  (customers || []).forEach(function(c){ if (filter && !filter(c)) return; out.push({ c: c, s: lsScore_(c, byPhone ? (byPhone[c.phone] || []) : schedules, nowTs) }); });
  var ord = { hot: 0, warm: 1, cold: 2 };
  out.sort(function(a, b){ return (ord[a.s.level] - ord[b.s.level]) || (b.s.score - a.s.score) || ((b.c.totalRevenue || 0) - (a.c.totalRevenue || 0)); });
  return limit ? out.slice(0, limit) : out;
}
// Khách "sắp mất": nguội + từng mua + hạng ≥ Tiềm năng → cứu theo doanh thu cao trước. Trả { n, items:[{c,s}] (≤limit) }
// byPhone (tuỳ chọn) = { sđt: [lịch chưa xong] } để KHÔNG phải lọc cả mảng lịch cho từng khách khi quét hàng trăm nghìn khách.
function lsAtRisk_(customers, schedules, nowTs, limit, filter, byPhone){
  var all = [];
  (customers || []).forEach(function(c){ if (filter && !filter(c)) return; var s = lsScore_(c, byPhone ? (byPhone[c.phone] || []) : schedules, nowTs); if (s.risk) all.push({ c: c, s: s }); });
  all.sort(function(a, b){ return ((b.c.totalRevenue || 0) - (a.c.totalRevenue || 0)) || ((b.s.days || 0) - (a.s.days || 0)); });
  return { n: all.length, items: limit ? all.slice(0, limit) : all };
}

// R8c: gợi ý "việc tiếp theo" cho 1 khách từ kết quả lsScore_ (s) + dữ liệu khách (c). Luật theo THỨ TỰ ƯU TIÊN, luôn trả kèm lý do `why` (không hộp đen).
// go: 'note' (Ghi chú) | 'sched' (Đặt lịch) | 'order' (Tạo đơn) — khớp data-pro-qa của thanh hành động nhanh (js/33).
function lsNextStep_(s, c){
  s = s || {}; c = c || {}; var n = c.totalOrders || 0, d = s.days;
  if (s.over > 0) return { text: 'Xử lý ' + s.over + ' lịch hẹn đã quá hạn', why: 'lịch hẹn quá hạn là dấu hiệu khách đang bị bỏ sót', go: 'sched', act: 'Mở lịch' };
  if (s.risk) return { text: 'Liên hệ lại ngay để giữ khách', why: 'đã ' + (d == null ? '>' + LS_COLD_DAYS : d) + ' ngày chưa chăm, từng mua ' + n + ' đơn' + (c.tier ? ' (hạng ' + c.tier + ')' : ''), go: 'note', act: 'Ghi chú' };
  if (s.days == null && n === 0) return { text: 'Gọi làm quen — khách chưa được chăm sóc lần nào', why: 'chưa có lần tiếp xúc và chưa có đơn nào', go: 'note', act: 'Ghi chú' };
  if (s.level === 'cold') return { text: 'Nhắn gợi mở hoặc đặt lịch gọi lại', why: (d == null ? 'chưa có mốc chăm sóc' : 'đã ' + d + ' ngày chưa chăm') + ' → khách đang nguội', go: 'sched', act: 'Đặt lịch' };
  if (s.soon > 0) return { text: 'Chuẩn bị cho ' + s.soon + ' lịch hẹn sắp tới', why: 'đã có lịch trong ' + LS_SOON_DAYS + ' ngày tới', go: 'sched', act: 'Mở lịch' };
  if (s.level === 'hot') return { text: 'Khách đang nóng — đề xuất chốt đơn hoặc đặt lịch chăm tiếp', why: 'điểm ' + s.score + ' (mới chăm/mua gần đây)', go: 'order', act: 'Tạo đơn' };
  return { text: 'Đặt lịch chăm tiếp trong ' + LS_SOON_DAYS + ' ngày để giữ nhịp', why: 'khách ấm nhưng chưa có lịch hẹn sắp tới', go: 'sched', act: 'Đặt lịch' };
}

// R8d: gom lịch CHƯA xong theo SĐT (1 lần) để quét hàng trăm nghìn khách không phải lọc lại mảng lịch cho từng khách.
function lsSchedByPhone_(schedules){
  var by = {}; (schedules || []).forEach(function(s){ if (s && !s.done && s.phone) (by[s.phone] = by[s.phone] || []).push(s); });
  return by;
}
// R8d: tổng hợp 1 lượt quét cho trợ lý hỏi đáp: số khách theo mức, số khách có lịch quá hạn, top sắp mất (doanh thu cao trước), top nóng (điểm cao trước).
function lsSummary_(customers, byPhone, nowTs, topN){
  var n = topN || 10, out = { total: 0, hot: 0, warm: 0, cold: 0, risk: 0, over: 0, riskTop: [], hotTop: [] }, risk = [], hot = [];
  (customers || []).forEach(function(c){
    var s = lsScore_(c, byPhone ? (byPhone[c.phone] || []) : null, nowTs);
    out.total++; out[s.level]++; if (s.over > 0) out.over++;
    if (s.risk){ out.risk++; risk.push({ c: c, s: s }); }
    if (s.level === 'hot') hot.push({ c: c, s: s });
  });
  risk.sort(function(a, b){ return ((b.c.totalRevenue || 0) - (a.c.totalRevenue || 0)) || ((b.s.days || 0) - (a.s.days || 0)); });
  hot.sort(function(a, b){ return (b.s.score - a.s.score) || ((b.c.totalRevenue || 0) - (a.c.totalRevenue || 0)); });
  out.riskTop = risk.slice(0, n); out.hotTop = hot.slice(0, n);
  return out;
}

// ════════════════════════════════════════════════════════════════════
//  R8b (GIAO DIỆN) — LỌC DANH SÁCH THEO MỨC + THANH BÁO "ĐANG LỌC". Cần trình duyệt (các hàm dưới đều tự thoát nếu thiếu DOM/dữ liệu).
//  _lsListFilter: '' (tắt) | 'risk' (sắp mất) | 'cold' | 'warm' | 'hot'. applyFilters (js/02) gọi lsFilterPass_(c); _filterSignature (js/08) có _lsListFilter
//  để cache lọc không trả danh sách cũ. Tính điểm cả allCustomers MỘT lần rồi cache theo (số khách, _dataVersion, ngày, số lịch, mức).
// ════════════════════════════════════════════════════════════════════
var _lsListFilter = '';
var _lsSetCache = { key: '', set: null };
var LS_FILTER_LABEL = { risk: 'khách SẮP MẤT (nguội >' + LS_COLD_DAYS + ' ngày chưa chăm, đã từng mua)', cold: 'khách NGUỘI (>' + LS_COLD_DAYS + ' ngày chưa chăm)', warm: 'khách ẤM', hot: 'khách NÓNG' };
function lsTodayKey_(nowTs){ var d = new Date(nowTs || Date.now()); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function lsFilterSet_(mode){
  if (!mode || typeof allCustomers === 'undefined' || !allCustomers) return null;
  var sch = (typeof schedules !== 'undefined' && schedules) ? schedules : [];
  var key = [allCustomers.length, (typeof _dataVersion !== 'undefined' ? _dataVersion : 0), lsTodayKey_(), sch.length, mode].join('#');
  if (_lsSetCache.key === key && _lsSetCache.set) return _lsSetCache.set;
  var now = Date.now(), set = new Set();
  // 1 lần quét: gom lịch theo SĐT để không lọc lại toàn bộ lịch cho từng khách (136k × lịch).
  var by = {}; sch.forEach(function(s){ if (s && !s.done && s.phone) (by[s.phone] = by[s.phone] || []).push(s); });
  allCustomers.forEach(function(c){
    var r = lsScore_(c, by[c.phone] || [], now);
    if (mode === 'risk' ? r.risk : r.level === mode) set.add(c.phone);
  });
  _lsSetCache = { key: key, set: set };
  return set;
}
function lsFilterPass_(c){ if (!_lsListFilter) return true; var s = lsFilterSet_(_lsListFilter); return !s || s.has(c.phone); }
function lsBarSync_(count){
  var host = (typeof document !== 'undefined') ? document.getElementById('tab-list') : null; if (!host) return;
  var bar = document.getElementById('ls-filter-bar');
  if (!_lsListFilter){ if (bar) bar.remove(); return; }
  if (!bar){ bar = document.createElement('div'); bar.id = 'ls-filter-bar'; bar.className = 'ls-filter-bar'; host.insertBefore(bar, host.firstChild); }
  bar.innerHTML = '<span>🧊 Đang lọc: ' + (LS_FILTER_LABEL[_lsListFilter] || '') + (count != null ? ' · <b>' + count + '</b> khách' : '') + '</span><button type="button" class="btn sm" data-ls-clear="1">✕ Bỏ lọc</button>';
  bar.querySelector('[data-ls-clear]').onclick = lsClearListFilter_;
}
function lsOpenList_(mode){
  _lsListFilter = mode || '';
  var el = (typeof document !== 'undefined') ? document.querySelector('[data-bar-id="tab-kh"]') : null;
  if (el && typeof switchTab === 'function') switchTab('list', el);
  if (typeof applyFilters === 'function') applyFilters();
  lsBarSync_(typeof _filterCache === 'object' && _filterCache && _filterCache.list ? _filterCache.list.length : null);
}
function lsClearListFilter_(){ _lsListFilter = ''; if (typeof applyFilters === 'function') applyFilters(); lsBarSync_(); }

if (typeof module !== 'undefined' && module.exports){ module.exports = { lsDaysBetween_: lsDaysBetween_, lsUpcoming_: lsUpcoming_, lsScore_: lsScore_, lsRank_: lsRank_, lsAtRisk_: lsAtRisk_, lsNextStep_: lsNextStep_, lsSchedByPhone_: lsSchedByPhone_, lsSummary_: lsSummary_, LS_COLD_DAYS: LS_COLD_DAYS, lsFilterSet_: lsFilterSet_, lsFilterPass_: lsFilterPass_, lsOpenList_: lsOpenList_, lsClearListFilter_: lsClearListFilter_ }; }

// ════════════════════════════════════════════════════════════════════════════════════════
//  ĐIỂM TÍCH LUỸ + LỊCH SỬ ĐỔI HẠNG (mục 9, docs/CRM-11-HANG-MUC-TRANG-THAI.md) — bước 2: HÀM THUẦN, chưa nối sheet/UI.
//  Quy tắc chốt (Duyên 2026-11-27): điểm tích 1% giá trị đơn; 1 điểm = 1.000đ; dùng điểm TRỪ THẲNG vào đơn;
//  điểm tính THEO NĂM (tích năm nào hết hạn 31/12 năm đó); đơn hoàn → trừ lại đúng số điểm của đơn đó;
//  hạng giữ TRỌN ĐỜI (chỉ lên, không xuống). GIẢ ĐỊNH chưa được xác nhận (đổi ở Settings 'loyaltyConfig'): điểm tích trên số tiền
//  KHÁCH THỰC TRẢ (sau khi trừ điểm); làm tròn xuống điểm nguyên.
// ════════════════════════════════════════════════════════════════════════════════════════
var LOYALTY_SECTION_ = 1;
var LOYALTY_DEFAULT_ = { rate: 0.01, pointValue: 1000 };
// raw = {rate, pointValue} hoặc chuỗi JSON; giá trị sai/thiếu → dùng mặc định từng trường (không bao giờ ném lỗi).
function _loyaltyCfgNormalize_(raw) {
  var o = raw; if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  o = o || {};
  var rate = Number(o.rate), pv = Number(o.pointValue);
  return { rate: (isFinite(rate) && rate > 0 && rate <= 1) ? rate : LOYALTY_DEFAULT_.rate,
           pointValue: (isFinite(pv) && pv >= 1) ? pv : LOYALTY_DEFAULT_.pointValue };
}
// Điểm tích của 1 đơn = floor(số tiền khách trả × tỷ lệ ÷ giá trị 1 điểm). Đơn hủy/hoàn/số âm → 0.
function _loyaltyEarnPoints_(amountPaid, cfg) {
  cfg = _loyaltyCfgNormalize_(cfg); var a = Number(amountPaid);
  if (!isFinite(a) || a <= 0) return 0;
  return Math.floor(Math.round(a * cfg.rate * 1000000) / 1000000 / cfg.pointValue);
}
function _loyaltyYearOf_(ymd) { var m = /^(\d{4})-\d{2}-\d{2}/.exec(String(ymd || '')); return m ? Number(m[1]) : 0; }
// Số dư điểm còn dùng được tại ngày asOfYmd. Mỗi năm 1 "quỹ" riêng; quỹ năm trước đã hết hạn (không cộng dồn sang).
// events: {type:'earn'|'refund'|'redeem', orderId, date:'YYYY-MM-DD', points}. refund trừ vào quỹ của NĂM ĐƠN GỐC (tra theo orderId).
function _loyaltyBalance_(events, asOfYmd) {
  var asYear = _loyaltyYearOf_(asOfYmd), pools = {}, earnYear = {};
  function pool(y) { return pools[y] || (pools[y] = { earned: 0, refunded: 0, redeemed: 0 }); }
  var list = (events || []).filter(function (e) { return e && String(e.date || '').slice(0, 10) <= String(asOfYmd).slice(0, 10); });
  list.forEach(function (e) { if (e.type === 'earn' && e.orderId != null) earnYear[e.orderId] = _loyaltyYearOf_(e.date); });
  list.forEach(function (e) {
    var p = Math.max(0, Math.floor(Number(e.points) || 0)), y = _loyaltyYearOf_(e.date); if (!y) return;
    if (e.type === 'earn') pool(y).earned += p;
    else if (e.type === 'refund') pool(earnYear[e.orderId] || y).refunded += p;
    else if (e.type === 'redeem') pool(y).redeemed += p;
  });
  var cur = pool(asYear), net = cur.earned - cur.refunded - cur.redeemed, expired = 0;
  Object.keys(pools).forEach(function (y) { if (Number(y) < asYear) expired += Math.max(0, pools[y].earned - pools[y].refunded - pools[y].redeemed); });
  return { year: asYear, earned: cur.earned, refunded: cur.refunded, redeemed: cur.redeemed,
           balance: Math.max(0, net), deficit: Math.max(0, -net), expiresOn: asYear + '-12-31', expired: expired };
}
// Dùng điểm cho 1 đơn: tối đa = min(số điểm khách muốn dùng, số dư, giá trị đơn ÷ giá trị 1 điểm). Trả điểm dùng, tiền giảm, tiền phải trả.
function _loyaltyRedeem_(orderValue, balance, wantPoints, cfg) {
  cfg = _loyaltyCfgNormalize_(cfg);
  var v = Math.max(0, Number(orderValue) || 0), cap = Math.floor(v / cfg.pointValue);
  var pts = Math.max(0, Math.min(Math.floor(Number(wantPoints) || 0), Math.floor(Number(balance) || 0), cap));
  return { points: pts, discount: pts * cfg.pointValue, payable: v - pts * cfg.pointValue };
}
function _loyaltyTierIndex_(rev, tierCfg) {
  var i = tierCfg.length - 1; while (i > 0 && !(Number(rev) >= tierCfg[i].min)) i--; return i;
}
// Lịch sử đổi hạng từ danh sách đơn (hạng theo doanh thu cộng dồn các đơn HỢP LỆ; đơn refunded/hủy không tính). Hạng giữ trọn đời: chỉ ghi khi LÊN hạng.
// orders: [{orderId, date:'YYYY-MM-DD', value, refunded}]; tierCfg: dạng _TIER_DEFAULT_ (mặc định nếu bỏ trống).
function _loyaltyTierHistory_(orders, tierCfg) {
  var cfg = (tierCfg && tierCfg.length) ? tierCfg : _TIER_DEFAULT_;
  var list = (orders || []).map(function (o, i) { return { o: o, i: i }; }).filter(function (x) { return x.o && !x.o.refunded && Number(x.o.value) > 0; });
  list.sort(function (a, b) { return String(a.o.date).localeCompare(String(b.o.date)) || (a.i - b.i); });
  var cum = 0, best = 0, hist = [];
  list.forEach(function (x) {
    cum += Number(x.o.value); var idx = _loyaltyTierIndex_(cum, cfg);
    if (idx > best) { hist.push({ date: x.o.date, orderId: x.o.orderId, from: cfg[best].key, to: cfg[idx].key, cumulative: cum }); best = idx; }
  });
  return { tier: cfg[best].key, cumulative: cum, history: hist };
}

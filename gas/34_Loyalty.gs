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

// ── Bước 2b: SỔ ĐIỂM (sheet LoyaltyPoints) + LỊCH SỬ HẠNG (sheet LoyaltyTier) + action loyaltyGet / loyaltyRedeem ──
// Sổ điểm TỰ ĐỒNG BỘ từ đơn POS của SĐT mỗi lần xem/dùng điểm (idempotent theo cột key → gọi bao nhiêu lần cũng không nhân đôi):
//   đơn hợp lệ → dòng earn; đơn hủy/hoàn mà đã từng earn → dòng refund (trừ đúng điểm đơn gốc); dùng điểm → dòng redeem.
// POS không có mã đơn ổn định → orderId = SĐT|ngày|giá trị|số thứ tự trong nhóm cùng ngày+giá trị (không đổi khi dòng bị dịch do archive).
var SH_LOYALTY_ = 'LoyaltyPoints';
var LOYALTY_HEADERS_ = ['key', 'phone', 'type', 'orderId', 'date', 'points', 'amount', 'note', 'by', 'at'];
var SH_LOYALTY_TIER_ = 'LoyaltyTier';
var LOYALTY_TIER_HEADERS_ = ['key', 'phone', 'date', 'orderId', 'from', 'to', 'cumulative', 'at'];
var LOYALTY_GET_ACTIONS_ = { loyaltyGet: 1 };
var LOYALTY_POST_ACTIONS_ = { loyaltyRedeem: 1 };
function _loyaltyCfg_() { var c = null; try { c = getSetting_('loyaltyConfig'); } catch (e) {} return _loyaltyCfgNormalize_(c); }
function _loyaltyYmdCell_(v) { if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : _vnYmd_(v); return String(v || '').slice(0, 10); }
function _loyaltyOrdersOfPhone_(phone, rows) {
  var ph = normPhone_(String(phone || '')), seen = {}, out = [];
  (rows || []).forEach(function (o) {
    if (normPhone_(String(o.soDienThoai || '')) !== ph) return;
    var v = Number(o.giaTriSauGiam) || 0, d = parseVNDate_(o.ngayTaoDon), ymd = d ? _vnYmd_(d) : '';
    if (!ymd || v <= 0) return;
    var base = ph + '|' + ymd + '|' + v, n = (seen[base] = (seen[base] || 0) + 1);
    out.push({ orderId: base + '|' + n, date: ymd, value: v, refunded: _donHasExcludedStatus_(o.trangThai) });
  });
  return out;
}
function _loyaltyRead_(name, headers, phone) {
  var sh = getSheet_(name, headers), last = sh.getLastRow(), out = [];
  if (last < 2) return out;
  var pi = headers.indexOf('phone');
  sh.getRange(2, 1, last - 1, headers.length).getValues().forEach(function (r) {
    if (normPhone_(String(r[pi] || '')) !== phone) return;
    var o = {}; headers.forEach(function (h, i) { o[h] = r[i]; }); out.push(o);
  });
  return out;
}
function _loyaltyAppend_(name, headers, rows) {
  if (!rows.length) return;
  var sh = getSheet_(name, headers), rng = sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length);
  if (rng.setNumberFormat) rng.setNumberFormat('@');   // SĐT/ngày giữ nguyên dạng chữ (khỏi mất số 0 đầu, khỏi thành Date)
  rng.setValues(rows);
}
// Đồng bộ sổ điểm + lịch sử hạng của 1 SĐT từ đơn POS. Trả số dòng mới thêm.
function loyaltySync_(phone, posRows) {
  var ph = normPhone_(String(phone || '')); if (!ph) return { error: 'Thieu so dien thoai.' };
  var cfg = _loyaltyCfg_(), orders = _loyaltyOrdersOfPhone_(ph, posRows || readDonChiTiet_());
  var have = {}, earnPts = {}, now = new Date(), today = _vnYmd_(now), add = [], nE = 0, nR = 0;
  _loyaltyRead_(SH_LOYALTY_, LOYALTY_HEADERS_, ph).forEach(function (r) { have[r.key] = 1; if (r.type === 'earn') earnPts[r.orderId] = Number(r.points) || 0; });
  orders.forEach(function (o) {
    var ek = 'earn|' + o.orderId, rk = 'refund|' + o.orderId;
    if (!o.refunded && !have[ek]) {
      var p = _loyaltyEarnPoints_(o.value, cfg);
      if (p > 0) { add.push([ek, ph, 'earn', o.orderId, o.date, p, o.value, '', 'auto', now]); have[ek] = 1; earnPts[o.orderId] = p; nE++; }
    }
    if (o.refunded && have[ek] && !have[rk]) { add.push([rk, ph, 'refund', o.orderId, today, earnPts[o.orderId] || 0, o.value, 'don hoan/huy', 'auto', now]); have[rk] = 1; nR++; }
  });
  _loyaltyAppend_(SH_LOYALTY_, LOYALTY_HEADERS_, add);
  var th = _loyaltyTierHistory_(orders, _tierCfg_()), haveT = {}, addT = [];
  _loyaltyRead_(SH_LOYALTY_TIER_, LOYALTY_TIER_HEADERS_, ph).forEach(function (r) { haveT[r.key] = 1; });
  th.history.forEach(function (h) { var k = ph + '|' + h.to; if (!haveT[k]) { addT.push([k, ph, h.date, h.orderId, h.from, h.to, h.cumulative, now]); haveT[k] = 1; } });
  _loyaltyAppend_(SH_LOYALTY_TIER_, LOYALTY_TIER_HEADERS_, addT);
  return { earn: nE, refund: nR, tier: addT.length };
}
function loyaltyState_(phone) {
  var ph = normPhone_(String(phone || '')), cfg = _loyaltyCfg_(), tcfg = _tierCfg_(), today = _vnYmd_(new Date());
  var ledger = _loyaltyRead_(SH_LOYALTY_, LOYALTY_HEADERS_, ph).map(function (r) {
    return { key: String(r.key), type: String(r.type), orderId: String(r.orderId), date: _loyaltyYmdCell_(r.date), points: Number(r.points) || 0, amount: Number(r.amount) || 0, note: String(r.note || ''), by: String(r.by || '') };
  });
  var tierRows = _loyaltyRead_(SH_LOYALTY_TIER_, LOYALTY_TIER_HEADERS_, ph).map(function (r) { return { date: _loyaltyYmdCell_(r.date), orderId: String(r.orderId), from: String(r.from), to: String(r.to), cumulative: Number(r.cumulative) || 0 }; });
  tierRows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  var curKey = tierRows.length ? tierRows[tierRows.length - 1].to : tcfg[0].key, lab = {}; tcfg.forEach(function (t) { lab[t.key] = t.label; });
  tierRows.forEach(function (h) { h.fromLabel = lab[h.from] || h.from; h.toLabel = lab[h.to] || h.to; });
  return { ok: true, phone: ph, tier: curKey, tierLabel: lab[curKey] || curKey, tierHistory: tierRows,
    points: _loyaltyBalance_(ledger, today), config: cfg,
    ledger: ledger.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).slice(0, 50) };
}
function loyaltyDoGet_(action, p) {
  try {
    var a = _khoAuth_(p); if (a.err) return a.err;
    return _khoWithLock_(function () { var s = loyaltySync_(p && p.phone); if (s.error) return jsonOut_({ ok: false, error: s.error }); var out = loyaltyState_(p.phone); out.synced = s; return jsonOut_(out); });
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi diem tich luy: ' + (err && err.message || err) }); }
}
// Dùng điểm cho 1 đơn: d = {token, phone, orderValue, points, refKey?}. refKey (tuỳ chọn) chống bấm 2 lần: cùng refKey → không trừ lần 2.
function loyaltyDoPost_(action, d) {
  try {
    var a = _khoAuth_(d); if (a.err) return a.err;
    return _khoWithLock_(function () {
      var ph = normPhone_(String(d && d.phone || '')); if (!ph) return jsonOut_({ ok: false, error: 'Thieu so dien thoai.' });
      var s = loyaltySync_(ph); if (s.error) return jsonOut_({ ok: false, error: s.error });
      var key = d.refKey ? 'redeem|' + ph + '|' + String(d.refKey).slice(0, 60) : 'redeem|' + ph + '|' + new Date().getTime() + '|' + Math.floor(Math.random() * 1e6);
      var st = loyaltyState_(ph);
      if (st.ledger.filter(function (r) { return r.key === key; }).length) return jsonOut_({ ok: false, error: 'Don nay da tru diem roi.', code: 'DUPLICATE', points: st.points });
      var r = _loyaltyRedeem_(d.orderValue, st.points.balance, d.points, st.config);
      if (r.points <= 0) return jsonOut_({ ok: false, error: 'Khong co diem de dung (het diem hoac don 0d).', points: st.points });
      var now = new Date(), who = String(a.user.username || a.user.name || '');
      _loyaltyAppend_(SH_LOYALTY_, LOYALTY_HEADERS_, [[key, ph, 'redeem', String(d.orderRef || ''), _vnYmd_(now), r.points, Number(d.orderValue) || 0, String(d.note || '').slice(0, 200), who, now]]);
      return jsonOut_({ ok: true, redeemed: r, points: loyaltyState_(ph).points });
    });
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi dung diem: ' + (err && err.message || err) }); }
}


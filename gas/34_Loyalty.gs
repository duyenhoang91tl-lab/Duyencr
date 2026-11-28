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
// events: {type:'earn'|'refund'|'redeem'|'undo', key, orderId, date:'YYYY-MM-DD', points}. undo: orderId = key của dòng redeem bị hoàn tác. refund trừ vào quỹ của NĂM ĐƠN GỐC (tra theo orderId).
function _loyaltyBalance_(events, asOfYmd) {
  var asYear = _loyaltyYearOf_(asOfYmd), pools = {}, earnYear = {}, redeemYear = {};
  function pool(y) { return pools[y] || (pools[y] = { earned: 0, refunded: 0, redeemed: 0 }); }
  var list = (events || []).filter(function (e) { return e && String(e.date || '').slice(0, 10) <= String(asOfYmd).slice(0, 10); });
  list.forEach(function (e) {
    if (e.type === 'earn' && e.orderId != null) earnYear[e.orderId] = _loyaltyYearOf_(e.date);
    if (e.type === 'redeem' && e.key != null) redeemYear[e.key] = _loyaltyYearOf_(e.date);   // để 'undo' trả điểm về đúng quỹ năm của lần dùng gốc
  });
  list.forEach(function (e) {
    var p = Math.max(0, Math.floor(Number(e.points) || 0)), y = _loyaltyYearOf_(e.date); if (!y) return;
    if (e.type === 'earn') pool(y).earned += p;
    else if (e.type === 'refund') pool(earnYear[e.orderId] || y).refunded += p;
    else if (e.type === 'redeem') pool(y).redeemed += p;
    else if (e.type === 'undo') pool(redeemYear[e.orderId] || y).redeemed -= p;   // hoàn tác dùng điểm (orderId = key dòng redeem gốc)
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
var LOYALTY_POST_ACTIONS_ = { loyaltyRedeem: 1, loyaltyUndo: 1, loyaltyBenefitQuote: 1 };
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
  var undoneKeys = {}; ledger.forEach(function (r) { if (r.type === 'undo') undoneKeys[r.orderId] = true; });
  ledger.forEach(function (r) { if (r.type === 'redeem' && undoneKeys[r.key]) r.undone = true; });
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
    if (action === 'loyaltyBenefitQuote') return loyaltyBenefitQuote_(d);
    if (action === 'loyaltyUndo') return _khoWithLock_(function () { return _loyaltyUndo_(d, a); });
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

// Hoàn tác 1 lần dùng điểm (CHỈ ADMIN). KHÔNG xoá dòng cũ: thêm dòng 'undo' (key 'undo|<key redeem>', orderId = key redeem gốc) để còn dấu vết,
// và ghi AuditLog. Điểm quay về quỹ NĂM CỦA LẦN DÙNG GỐC (nếu năm đó đã qua thì điểm đó đã hết hạn — đúng luật 31/12).
function _loyaltyAudit_(who, action, phone, oldV, newV) {
  try { var sh = getSheet_(SH_AUDIT, AUDIT_HEADERS); sh.getRange(sh.getLastRow() + 1, 1, 1, AUDIT_HEADERS.length).setValues([[new Date().toISOString(), who, action, phone, _auditClip_(oldV), _auditClip_(newV)]]); } catch (e) {}
}
// Lõi hoàn tác (KHÔNG kiểm quyền — nơi gọi tự kiểm): trả object {ok,...} / {ok:false,error,code}. Dùng cho nút admin (_loyaltyUndo_) và khi Hủy/Hoàn đơn CRM (bước 4b).
function _loyaltyUndoApply_(d, who) {
  var ph = normPhone_(String(d && d.phone || '')), key = String(d && d.key || '').trim();
  if (!ph || !key) return { ok: false, error: 'Thieu so dien thoai hoac ma lan dung diem.' };
  var rows = _loyaltyRead_(SH_LOYALTY_, LOYALTY_HEADERS_, ph), uk = 'undo|' + key;
  var orig = rows.filter(function (r) { return String(r.key) === key && r.type === 'redeem'; })[0];
  if (!orig) return { ok: false, error: 'Khong tim thay lan dung diem nay.', code: 'NOTFOUND' };
  if (rows.some(function (r) { return String(r.key) === uk; })) return { ok: false, error: 'Lan dung diem nay da duoc hoan tac roi.', code: 'DUPLICATE' };
  var now = new Date(), pts = Number(orig.points) || 0;
  _loyaltyAppend_(SH_LOYALTY_, LOYALTY_HEADERS_, [[uk, ph, 'undo', key, _vnYmd_(now), pts, Number(orig.amount) || 0, String(d.note || 'hoan tac dung diem').slice(0, 200), who, now]]);
  _loyaltyAudit_(who, 'loyalty:undo', ph, 'dung ' + pts + ' diem (don ' + (Number(orig.amount) || 0) + 'd) ngay ' + _loyaltyYmdCell_(orig.date), 'hoan tac');
  return { ok: true, undone: { key: key, points: pts }, points: loyaltyState_(ph).points };
}
function _loyaltyUndo_(d, a) {
  if (a.user.role !== 'admin') return jsonOut_({ ok: false, error: 'Chi admin moi duoc hoan tac dung diem.', code: 'FORBIDDEN' });
  return jsonOut_(_loyaltyUndoApply_(d, String(a.user.username || a.user.name || '')));
}

// ── Điểm TÍCH của ĐƠN CRM (Duyên 28/11: "tạo đơn trên CRM tích được điểm; đơn hoàn/hủy thì trừ điểm, không tính âm") ──
// Đơn CRM tích như đơn POS: floor(tiền khách phải trả SAU khi trừ điểm × rate ÷ pointValue) (cùng `_loyaltyEarnPoints_`, mặc định 1%), ghi sổ 'earn' NGÀY TẠO ĐƠN
// → dùng được từ đơn sau và HẾT HẠN 31/12 NĂM TẠO ĐƠN (luật quỹ theo năm của `_loyaltyBalance_`). Khoá cố định earn|crm|<mã đơn> / refund|crm|<mã đơn> → gọi lại bao nhiêu lần vẫn 1 dòng.
// Hủy/Hoàn → ghi 'refund' đúng số điểm đơn đó đã tích, nhưng KHÔNG ÂM: nếu cùng năm khách đã tiêu bớt thì chỉ trừ tới phần còn lại (không để "nợ điểm" tự trừ vào điểm tích về sau).
// Đơn tích từ năm trước: quỹ đó đã hết hạn nên ghi nhận đủ số điểm, không ảnh hưởng số dư năm nay.
// GIẢ ĐỊNH chờ Duyên xác nhận: tích ngay khi tạo đơn (như đơn POS), không chờ "Đã giao"; tính trên Cần thu gồm ship/phụ thu (cùng cách tính tiền dùng điểm).
function _loyaltyCrmEarn_(o, who, atMs) {
  var ph = normPhone_(String(o && o.phone || '')); if (!ph) return { points: 0 };
  var oid = 'crm|' + o.orderId, key = 'earn|' + oid, rows = _loyaltyRead_(SH_LOYALTY_, LOYALTY_HEADERS_, ph);
  var when = atMs && isFinite(Number(atMs)) ? new Date(Number(atMs)) : new Date(), ymd = _vnYmd_(when), exp = _loyaltyYearOf_(ymd) + '-12-31';
  for (var i = 0; i < rows.length; i++) if (String(rows[i].key) === key) return { points: Number(rows[i].points) || 0, duplicate: true, expiresOn: exp };
  var p = _loyaltyEarnPoints_(o.total, _loyaltyCfg_()); if (p <= 0) return { points: 0 };
  _loyaltyAppend_(SH_LOYALTY_, LOYALTY_HEADERS_, [[key, ph, 'earn', oid, ymd, p, Number(o.total) || 0, 'Don CRM ' + o.orderId, String(who || ''), new Date()]]);
  return { points: p, expiresOn: exp };
}
function _loyaltyCrmRevoke_(o, to, who) {
  var ph = normPhone_(String(o && o.phone || '')); if (!ph) return { points: 0, earned: 0, skipped: true };
  var oid = 'crm|' + o.orderId, ek = 'earn|' + oid, rk = 'refund|' + oid, now = new Date(), today = _vnYmd_(now), rows = _loyaltyRead_(SH_LOYALTY_, LOYALTY_HEADERS_, ph), earn = null, done = false;
  rows.forEach(function (r) { if (String(r.key) === ek) earn = r; if (String(r.key) === rk) done = true; });
  if (!earn || done) return { points: 0, earned: earn ? (Number(earn.points) || 0) : 0, skipped: true };   // đơn chưa từng tích / đã trừ rồi → không trừ lần 2
  var ep = Math.max(0, Math.floor(Number(earn.points) || 0)), take = ep;
  if (_loyaltyYearOf_(_loyaltyYmdCell_(earn.date)) === _loyaltyYearOf_(today)) {   // cùng năm → số dư không bao giờ âm
    var led = rows.map(function (r) { return { type: String(r.type), key: String(r.key), orderId: String(r.orderId), date: _loyaltyYmdCell_(r.date), points: Number(r.points) || 0 }; });
    take = Math.min(ep, _loyaltyBalance_(led, today).balance);
  }
  _loyaltyAppend_(SH_LOYALTY_, LOYALTY_HEADERS_, [[rk, ph, 'refund', oid, today, take, Number(earn.amount) || 0, (to === 'Hủy' ? 'Huy' : 'Hoan') + ' don CRM ' + o.orderId + (take < ep ? ' (khach da dung bot, chi tru ' + take + '/' + ep + ' diem)' : ''), String(who || ''), now]]);
  return { points: take, earned: ep, capped: take < ep };
}

// ── Bước 9b: QUYỀN LỢI THEO THẺ (docx mục 9, Duyên chốt 27/11) — HÀM THUẦN, chưa nối đơn/UI ──
// Thẻ VIP = khách mua từ LẦN THỨ 2 (đã có ≥ 1 đơn hợp lệ trước đó): giảm 5%. Thẻ SUPER VIP = lịch sử mua ≥ 50tr (đúng ngưỡng hạng Super VVip): giảm 10%.
// Cả hai: miễn ship đơn từ 1tr, dưới 1tr không miễn ship. Hạng Ưu tiên/Vip theo doanh thu KHÔNG có quyền lợi riêng.
// Mã "KHÔNG GIẢM" → 0%; mã "TỐI ĐA 5%" → min(mức thẻ, 5%) — dù có thẻ hay chương trình. So khớp theo TÊN sản phẩm (bỏ dấu, chữ thường; "charm" = "cham").
// GIẢ ĐỊNH chưa Duyên xác nhận: miễn ship xét trên TỔNG TIỀN HÀNG TRƯỚC giảm; giảm làm tròn từng dòng về đồng. Mọi số/danh sách cấu hình được ở Settings 'loyaltyBenefits'.
var LOYALTY_BENEFIT_DEFAULT_ = {
  vipPct: 5, superPct: 10, superMin: 50000000, freeShipMin: 1000000, capPct: 5,
  noDiscount: [
    { all: ['cham', '24k'] }, { all: ['cham', 'bi vang', '10k'] }, { all: ['cham', '10k'], none: ['da', 'ngoc', 'khoi loc'] }, { all: ['vang', '18k'] }, { all: ['kim tien'] },
    { all: ['day vang', '10k'] }, { all: ['nhan', 'thiet ke', '2 hang da'] }, { all: ['nhan ket noi'] }, { all: ['lac duc vang'] }, { all: ['nhan nam'] },
    { all: ['day vang', 'deo co', 'nhu y nguyen'] }, { all: ['day vang', 'deo co', 'loc nhu y'] }, { all: ['day vang', 'deo co', 'tourmaline'] }
  ],
  // (docx có 2 danh sách chồng nhau: "charm 10k không gắn đá" = KHÔNG GIẢM, "charm vàng khởi lộc 10k" = TỐI ĐA 5% → mã cụ thể thắng, xem 'khoi loc' ở luật noDiscount)
  cap5: [
    { all: ['cam thach', 'type a'] }, { all: ['lac tay vang', 'nhu y nguyen'] }, { all: ['loc phuc tinh'] }, { all: ['dong dieu', 'da thong'] },
    { all: ['ty huu', 'nam', 'boc vang'] }, { all: ['cham vang', 'khoi loc', '10k'] }
  ]
};
function _loyNorm_(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/charm/g, 'cham').replace(/\s+/g, ' ').trim();
}
function _loyRuleList_(arr, dflt) {
  if (!Array.isArray(arr)) return dflt;
  var out = arr.filter(function (r) { return r && Array.isArray(r.all) && r.all.length; }).map(function (r) {
    return { all: r.all.map(_loyNorm_).filter(Boolean), none: Array.isArray(r.none) ? r.none.map(_loyNorm_).filter(Boolean) : [] };
  }).filter(function (r) { return r.all.length; });
  return out.length ? out : dflt;
}
function _loyaltyBenefitCfgNormalize_(raw) {
  var o = raw; if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  o = (o && typeof o === 'object') ? o : {}; var d = LOYALTY_BENEFIT_DEFAULT_;
  function num(v, dv, lo, hi) { v = Number(v); return (isFinite(v) && v >= lo && v <= hi) ? v : dv; }
  return { vipPct: num(o.vipPct, d.vipPct, 0, 100), superPct: num(o.superPct, d.superPct, 0, 100), capPct: num(o.capPct, d.capPct, 0, 100),
           superMin: num(o.superMin, d.superMin, 1, 1e13), freeShipMin: num(o.freeShipMin, d.freeShipMin, 0, 1e13),
           noDiscount: _loyRuleList_(o.noDiscount, _loyRuleList_(d.noDiscount, [])), cap5: _loyRuleList_(o.cap5, _loyRuleList_(d.cap5, [])) };
}
// Điều kiện LOẠI TRỪ (none) so khớp theo TỪ NGUYÊN VẸN và sau khi bỏ cụm phủ định "không gắn/đính/có đá/ngọc" — nếu không, "không gắn đá" bị tính là CÓ đá
// và chữ "dây" (day) bị tính là chứa "đá" (da). Điều kiện bắt buộc (all) vẫn so khớp theo cụm.
function _loyRuleHit_(name, rules) {
  var bare = name.replace(/khong (gan|dinh|co) (da|ngoc)( ?\/ ?(da|ngoc))?/g, ' ');
  function word(k) { return new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])').test(bare); }
  return rules.some(function (r) {
    return r.all.every(function (k) { return name.indexOf(k) >= 0; }) && !(r.none || []).some(word);
  });
}
// Cấp thẻ của khách khi lên đơn: priorValidOrders = số đơn hợp lệ ĐÃ CÓ trước đơn này; cumulative = doanh thu cộng dồn (đơn hợp lệ).
function _loyaltyBenefitLevel_(priorValidOrders, cumulative, cfg) {
  cfg = _loyaltyBenefitCfgNormalize_(cfg);
  if (Number(cumulative) >= cfg.superMin) return 'super';
  return Number(priorValidOrders) >= 1 ? 'vip' : 'none';
}
// items: [{name, qty, price}]. Trả từng dòng (pct áp dụng + lý do), tổng giảm, tiền hàng sau giảm, có miễn ship không.
function _loyaltyBenefitApply_(items, level, cfg) {
  cfg = _loyaltyBenefitCfgNormalize_(cfg);
  var base = level === 'super' ? cfg.superPct : level === 'vip' ? cfg.vipPct : 0, lines = [], subtotal = 0, discount = 0;
  (items || []).forEach(function (it) {
    var qty = Math.max(0, Number(it && it.qty) || 0), price = Math.max(0, Number(it && it.price) || 0), total = Math.round(qty * price), nm = _loyNorm_(it && it.name), pct = base, why = base ? 'full' : 'none';
    if (base && _loyRuleHit_(nm, cfg.noDiscount)) { pct = 0; why = 'excluded'; }
    else if (base && _loyRuleHit_(nm, cfg.cap5) && base > cfg.capPct) { pct = cfg.capPct; why = 'cap'; }
    var d = Math.round(total * pct / 100); subtotal += total; discount += d;
    lines.push({ name: String((it && it.name) || ''), lineTotal: total, pct: pct, discount: d, rule: why });
  });
  return { level: level, lines: lines, subtotal: subtotal, discount: discount, afterDiscount: subtotal - discount,
           freeShip: level !== 'none' && subtotal >= cfg.freeShipMin && subtotal > 0 };
}

// ── Bước 9c-1: BÁO GIÁ QUYỀN LỢI THẺ cho màn Tạo đơn (POST loyaltyBenefitQuote) — CHỈ ĐỌC, không ghi gì ──
// Màn Tạo đơn gọi action này theo SĐT + danh sách sản phẩm, rồi TỰ ĐIỀN giảm % từng dòng + ô Miễn ship. crmOrderSave KHÔNG đổi (vẫn tin số sale nhập như trước).
// Lịch sử xét thẻ = đơn POS hợp lệ (không Hủy/Hoàn) + đơn CRM đã xác nhận / đang giao / đã giao của chính SĐT đó (đơn CRM 'Mới' chưa tính vì có thể bị hủy).
var LOYALTY_CRM_VALID_STATUS_ = ['Đã xác nhận', 'Đang giao', 'Đã giao'];
function _loyaltyBenefitCfg_() { var c = null; try { c = getSetting_('loyaltyBenefits'); } catch (e) {} return _loyaltyBenefitCfgNormalize_(c); }
function _loyaltyHistoryOf_(phone, posRows, crmRows) {
  var ph = normPhone_(String(phone || '')), cnt = 0, cum = 0;
  _loyaltyOrdersOfPhone_(ph, posRows).forEach(function (o) { if (!o.refunded) { cnt++; cum += o.value; } });
  (crmRows || []).forEach(function (o) {
    if (normPhone_(String(o.phone || '')) !== ph || LOYALTY_CRM_VALID_STATUS_.indexOf(String(o.status)) < 0) return;
    var t = Number(o.total) || 0; if (t > 0) { cnt++; cum += t; }
  });
  return { orders: cnt, cumulative: cum };
}
var LOYALTY_LEVEL_LABEL_ = { none: 'Chưa có thẻ', vip: 'Thẻ VIP (mua lại)', super: 'Thẻ Super VIP' };
function loyaltyBenefitQuote_(d) {
  try {
    var ph = normPhone_(String(d && d.phone || '')); if (!ph) return jsonOut_({ ok: false, error: 'Thieu so dien thoai.' });
    var items = (d && d.items) || []; if (!items.length || items.length > 200) return jsonOut_({ ok: false, error: 'Danh sach san pham khong hop le.' });
    var cfg = _loyaltyBenefitCfg_(), h = _loyaltyHistoryOf_(ph, readDonChiTiet_(), _crmReadAll_()), level = _loyaltyBenefitLevel_(h.orders, h.cumulative, cfg);
    var r = _loyaltyBenefitApply_(items, level, cfg);
    return jsonOut_({ ok: true, level: level, label: LOYALTY_LEVEL_LABEL_[level], history: h, lines: r.lines, subtotal: r.subtotal, discount: r.discount, afterDiscount: r.afterDiscount, freeShip: r.freeShip, freeShipMin: cfg.freeShipMin });
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi bao gia quyen loi the: ' + (err && err.message || err) }); }
}


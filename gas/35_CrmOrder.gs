// ═══════════════════════════════════════════════════════════════
//  ĐƠN CRM (bước 1, backend): CRM tự LÊN ĐƠN theo màn "Tạo đơn" của Pancake POS (clip 27/11/2026) và ghi vào sheet RIÊNG "Đơn CRM"
//  trong file CRM. KHÔNG ghi DT Tổng / OrderData / Pos (saveOrders vẫn TẮT có chủ ý — Duyên đang TEST tính năng này nên tách sheet riêng).
//  NGUYÊN TẮC: server tự TÍNH LẠI mọi số tiền từ dòng sản phẩm (không tin tổng client gửi) → sửa/đổi giao diện không làm lệch tiền.
//  Công thức (khớp clip: 990.000 − KM 10% 99.000 + ship 40.000 = tiền cần thu 931.000; chuyển khoản 300.000 → còn thiếu 631.000):
//    tiền cần thu = Σ(SL×giá) − Σ giảm giá dòng − giảm giá đơn + phí vận chuyển (0 nếu miễn phí giao hàng) + phụ thu;  còn thiếu = max(0, cần thu − chuyển khoản)
//  Thuế % của dòng chỉ LƯU (chưa cộng vào tiền — clip toàn 0%, chờ Duyên xác nhận cách tính).
//  Action: POST crmOrderSave {token, refKey?, order} (refKey chống bấm Lưu 2 lần → trả lại đơn cũ, duplicate:true); GET crmOrders {token, phone?, from?, to?, limit?}.
//  Quyền: mọi tài khoản đăng nhập được lên đơn; admin xem mọi đơn, tài khoản khác chỉ thấy đơn chính mình tạo.
// ═══════════════════════════════════════════════════════════════
var CRMORDER_SECTION_ = 1;
var SH_CRM_ORDER_ = 'Đơn CRM';
var CRM_ORDER_HEADERS_ = ['orderId', 'refKey', 'createdAt', 'createdBy', 'status', 'source', 'warehouse', 'saleName', 'packerName', 'careName', 'marketer', 'tags',
  'custName', 'phone', 'gender', 'email', 'birthday', 'recvName', 'recvPhone', 'province', 'district', 'ward', 'address', 'expectedDate',
  'carrier', 'shipCode', 'items', 'itemCount', 'qty', 'gross', 'itemDiscount', 'orderDiscount', 'shipFee', 'surcharge', 'total', 'paid', 'due', 'note', 'printNote'];
var CRM_ORDER_GET_ACTIONS_ = { crmOrders: 1 };
var CRM_ORDER_POST_ACTIONS_ = { crmOrderSave: 1 };
var CRM_ORDER_MAX_ITEMS_ = 60;
function _crmNum_(v) { var n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
function _crmStr_(v, max) { return String(v == null ? '' : v).replace(/^\s+|\s+$/g, '').slice(0, max || 200); }
// Giảm giá của 1 dòng/đơn: type 'pct' (0-100%) hoặc 'amt' (đồng); luôn trong [0, base].
function _crmDiscount_(base, type, value) {
  var v = Math.max(0, _crmNum_(value)); base = Math.max(0, base);
  var d = String(type || '') === 'pct' ? Math.round(base * Math.min(v, 100) / 100) : Math.round(v);
  return Math.min(d, base);
}
// Chuẩn hoá + kiểm tra + TÍNH TIỀN. Trả { error } hoặc { order: {...đã chuẩn hoá + số tiền} }. Hàm thuần (không đụng sheet).
function _crmOrderNormalize_(raw) {
  raw = raw || {};
  var phone = normPhone_(String(raw.phone || ''));
  if (!phone) return { error: 'Thieu so dien thoai khach.' };
  var src = raw.items; if (!src || !src.length) return { error: 'Don chua co san pham.' };
  if (src.length > CRM_ORDER_MAX_ITEMS_) return { error: 'Don co qua nhieu dong san pham (toi da ' + CRM_ORDER_MAX_ITEMS_ + ').' };
  var items = [], gross = 0, itemDiscount = 0, qty = 0;
  for (var i = 0; i < src.length; i++) {
    var it = src[i] || {}, q = Math.floor(_crmNum_(it.qty)), price = Math.round(_crmNum_(it.price));
    var name = _crmStr_(it.name, 200), code = _crmStr_(it.code, 60);
    if (!name && !code) return { error: 'Dong san pham ' + (i + 1) + ' thieu ten/ma.' };
    if (!(q >= 1)) return { error: 'Dong san pham ' + (i + 1) + ': so luong phai >= 1.' };
    if (price < 0) return { error: 'Dong san pham ' + (i + 1) + ': don gia am.' };
    var line = q * price, dType = String(it.discType || '') === 'pct' ? 'pct' : 'amt', dVal = Math.max(0, _crmNum_(it.discValue));
    var dis = _crmDiscount_(line, dType, dVal);
    items.push({ code: code, name: name, qty: q, price: price, discType: dType, discValue: dVal, discount: dis, taxPct: Math.max(0, _crmNum_(it.taxPct)), note: _crmStr_(it.note, 200), amount: line - dis });
    gross += line; itemDiscount += dis; qty += q;
  }
  var afterItems = gross - itemDiscount;
  var orderDiscount = _crmDiscount_(afterItems, raw.discType, raw.discValue);
  var freeShip = raw.freeShip === true || raw.freeShip === 'true' || raw.freeShip === 1;
  var shipFee = freeShip ? 0 : Math.max(0, Math.round(_crmNum_(raw.shipFee)));
  var surcharge = Math.max(0, Math.round(_crmNum_(raw.surcharge)));
  var total = afterItems - orderDiscount + shipFee + surcharge;
  var paid = Math.max(0, Math.round(_crmNum_(raw.paid)));
  var tags = raw.tags; if (Object.prototype.toString.call(tags) === '[object Array]') tags = tags.map(function (t) { return _crmStr_(t, 60); }).filter(String).join(', ');
  return { order: {
    source: _crmStr_(raw.source, 60), warehouse: _crmStr_(raw.warehouse, 60), saleName: _crmStr_(raw.saleName, 80), packerName: _crmStr_(raw.packerName, 80),
    careName: _crmStr_(raw.careName, 80), marketer: _crmStr_(raw.marketer, 80), tags: _crmStr_(tags, 300),
    custName: _crmStr_(raw.custName, 120), phone: phone, gender: _crmStr_(raw.gender, 20), email: _crmStr_(raw.email, 120), birthday: _crmStr_(raw.birthday, 20),
    recvName: _crmStr_(raw.recvName, 120), recvPhone: normPhone_(String(raw.recvPhone || '')) || phone, province: _crmStr_(raw.province, 80), district: _crmStr_(raw.district, 80),
    ward: _crmStr_(raw.ward, 80), address: _crmStr_(raw.address, 300), expectedDate: _crmStr_(raw.expectedDate, 20), carrier: _crmStr_(raw.carrier, 60), shipCode: _crmStr_(raw.shipCode, 60),
    items: items, itemCount: items.length, qty: qty, gross: gross, itemDiscount: itemDiscount, orderDiscount: orderDiscount, shipFee: shipFee, surcharge: surcharge,
    total: total, paid: paid, due: Math.max(0, total - paid), note: _crmStr_(raw.note, 1000), printNote: _crmStr_(raw.printNote, 1000) } };
}
// Mã đơn: CRM + yyMMdd + '-' + số thứ tự trong ngày (4 chữ số). existingIds: mã đã có (để không trùng).
function _crmNextOrderId_(ymd, existingIds) {
  var pre = 'CRM' + String(ymd || '').replace(/-/g, '').slice(2), n = 0, re = new RegExp('^' + pre + '-(\\d+)$');
  (existingIds || []).forEach(function (id) { var m = re.exec(String(id)); if (m) n = Math.max(n, parseInt(m[1], 10) || 0); });
  n++; return pre + '-' + ('0000' + n).slice(-4);
}
function _crmOrderRowToObj_(r) {
  var o = {}; CRM_ORDER_HEADERS_.forEach(function (h, i) { o[h] = r[i]; });
  var items = []; try { items = JSON.parse(String(o.items || '[]')); } catch (e) {}
  o.items = items; ['itemCount', 'qty', 'gross', 'itemDiscount', 'orderDiscount', 'shipFee', 'surcharge', 'total', 'paid', 'due'].forEach(function (k) { o[k] = Number(o[k]) || 0; });
  o.phone = normPhone_(String(o.phone || '')); o.createdAt = Object.prototype.toString.call(o.createdAt) === '[object Date]' ? o.createdAt.getTime() : o.createdAt;
  return o;
}
function _crmReadAll_() {
  var sh = getSheet_(SH_CRM_ORDER_, CRM_ORDER_HEADERS_), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, CRM_ORDER_HEADERS_.length).getValues().map(_crmOrderRowToObj_);
}
function crmOrderDoPost_(action, d) {
  try {
    var a = _khoAuth_(d); if (a.err) return a.err;
    var n = _crmOrderNormalize_(d && d.order); if (n.error) return jsonOut_({ ok: false, error: n.error });
    return _khoWithLock_(function () {
      var all = _crmReadAll_(), refKey = _crmStr_(d.refKey, 80);
      if (refKey) for (var i = 0; i < all.length; i++) if (String(all[i].refKey) === refKey) return jsonOut_({ ok: true, duplicate: true, order: all[i] });
      var now = new Date(), who = String(a.user.username || a.user.name || ''), o = n.order;
      o.orderId = _crmNextOrderId_(_vnYmd_(now), all.map(function (x) { return String(x.orderId); }));
      o.refKey = refKey; o.createdAt = now.getTime(); o.createdBy = who; o.status = 'Mới';
      var row = CRM_ORDER_HEADERS_.map(function (h) { return h === 'items' ? JSON.stringify(o.items) : (o[h] == null ? '' : o[h]); });
      var sh = getSheet_(SH_CRM_ORDER_, CRM_ORDER_HEADERS_), rng = sh.getRange(sh.getLastRow() + 1, 1, 1, row.length);
      if (rng.setNumberFormat) rng.setNumberFormat('@');   // SĐT/ngày giữ dạng chữ (khỏi mất số 0 đầu)
      rng.setValues([row]);
      return jsonOut_({ ok: true, duplicate: false, order: o });
    });
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi luu don CRM: ' + (err && err.message || err) }); }
}
function crmOrderDoGet_(action, p) {
  try {
    var a = _khoAuth_(p); if (a.err) return a.err;
    var isAdmin = a.user.role === 'admin', who = String(a.user.username || a.user.name || ''), ph = p && p.phone ? normPhone_(String(p.phone)) : '';
    var from = _crmStr_(p && p.from, 10), to = _crmStr_(p && p.to, 10), limit = Math.max(1, Math.min(500, parseInt(p && p.limit, 10) || 100));
    var rows = _crmReadAll_().filter(function (o) {
      if (!isAdmin && String(o.createdBy) !== who) return false;
      if (ph && o.phone !== ph) return false;
      var ymd = o.createdAt ? _vnYmd_(new Date(Number(o.createdAt))) : '';
      if (from && ymd < from) return false; if (to && ymd > to) return false;
      return true;
    });
    rows.sort(function (x, y) { return (Number(y.createdAt) || 0) - (Number(x.createdAt) || 0); });
    return jsonOut_({ ok: true, total: rows.length, orders: rows.slice(0, limit) });
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi doc don CRM: ' + (err && err.message || err) }); }
}

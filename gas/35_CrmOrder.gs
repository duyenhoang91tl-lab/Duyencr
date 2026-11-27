// ═══════════════════════════════════════════════════════════════
//  ĐƠN CRM (bước 1, backend): CRM tự LÊN ĐƠN theo màn "Tạo đơn" của Pancake POS (clip 27/11/2026) và ghi vào sheet RIÊNG "Đơn CRM"
//  trong file CRM. KHÔNG ghi DT Tổng / OrderData / Pos (saveOrders vẫn TẮT có chủ ý — Duyên đang TEST tính năng này nên tách sheet riêng).
//  NGUYÊN TẮC: server tự TÍNH LẠI mọi số tiền từ dòng sản phẩm (không tin tổng client gửi) → sửa/đổi giao diện không làm lệch tiền.
//  Công thức (khớp clip: 990.000 − KM 10% 99.000 + ship 40.000 = tiền cần thu 931.000; chuyển khoản 300.000 → còn thiếu 631.000):
//    tiền cần thu = Σ(SL×giá) − Σ giảm giá dòng + Σ thuế dòng − giảm giá đơn + phí vận chuyển (0 nếu miễn phí giao hàng) + phụ thu;  còn thiếu = max(0, cần thu − chuyển khoản)
//  Thuế % của dòng do người lên đơn TỰ ĐIỀN (Duyên chốt 27/11): thuế dòng = làm tròn(thành tiền sau giảm giá dòng × thuế%), CỘNG vào tiền cần thu (mặc định 0%).
//  Action: POST crmOrderSave {token, refKey?, order} (refKey chống bấm Lưu 2 lần → trả lại đơn cũ, duplicate:true); GET crmOrders {token, phone?, from?, to?, limit?}.
//  Quyền lên đơn: mọi tài khoản đăng nhập. QUYỀN XEM (Duyên chốt 27/11) theo cấp bậc _roleBase_: admin + viewer(CEO) = tất cả | manager (Trưởng phòng/Quản lý) =
//  đơn của mình + người thuộc các phòng được giao (cột team của tài khoản = key phòng, tên Sale gắn phòng ở saleDepts) | leader (Trưởng team) = mình + team mình làm trưởng
//  | còn lại (cs, vai trò lạ) = chỉ đơn của mình. Đơn thuộc về người TẠO (createdBy) hoặc Sale ghi trên đơn (saleName, mặc định = người tạo).
// ═══════════════════════════════════════════════════════════════
var CRMORDER_SECTION_ = 1;
var SH_CRM_ORDER_ = 'Đơn CRM';
var CRM_ORDER_HEADERS_ = ['orderId', 'refKey', 'createdAt', 'createdBy', 'status', 'source', 'warehouse', 'saleName', 'packerName', 'careName', 'marketer', 'tags',
  'custName', 'phone', 'gender', 'email', 'birthday', 'recvName', 'recvPhone', 'province', 'district', 'ward', 'address', 'expectedDate',
  'carrier', 'shipCode', 'items', 'itemCount', 'qty', 'gross', 'itemDiscount', 'orderDiscount', 'shipFee', 'surcharge', 'total', 'paid', 'due', 'note', 'printNote', 'tax',   // 'tax' ở CUỐI (bước 1b)
  'statusAt', 'statusBy', 'statusNote'];   // 3 cột cuối thêm ở bước 4a (đổi trạng thái/huỷ); getSheet_ tự bổ sung tiêu đề cho sheet cũ
var CRM_ORDER_GET_ACTIONS_ = { crmOrders: 1 };
var CRM_ORDER_POST_ACTIONS_ = { crmOrderSave: 1, crmOrderStatus: 1 };
// Đổi trạng thái / huỷ đơn (bước 4a). Chỉ cho đi theo đường hợp lệ; 'Hủy' và 'Hoàn' là trạng thái CUỐI (không mở lại — muốn bán tiếp thì lên đơn mới).
// Hủy = đơn chưa giao thành công; Hoàn = hàng đã/đang giao nhưng khách trả lại. Hủy/Hoàn BẮT BUỘC có lý do (để tra cứu về sau).
var CRM_ORDER_FLOW_ = { 'Mới': ['Đã xác nhận', 'Hủy'], 'Đã xác nhận': ['Đang giao', 'Hủy'], 'Đang giao': ['Đã giao', 'Hoàn', 'Hủy'], 'Đã giao': ['Hoàn'], 'Hủy': [], 'Hoàn': [] };
function _crmStatusCheck_(from, to, note) {
  from = String(from || 'Mới'); to = String(to || '');
  if (!CRM_ORDER_FLOW_.hasOwnProperty(to)) return 'Trang thai khong hop le.';
  if (!CRM_ORDER_FLOW_.hasOwnProperty(from)) return 'Don dang o trang thai la (' + from + '), khong doi duoc.';
  if (CRM_ORDER_FLOW_[from].indexOf(to) < 0) return 'Khong the chuyen tu ' + from + ' sang ' + to + '.';
  if ((to === 'Hủy' || to === 'Hoàn') && !_crmStr_(note, 300)) return 'Huy/hoan don phai ghi ly do.';
  return '';
}
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
  var items = [], gross = 0, itemDiscount = 0, qty = 0, taxTotal = 0;
  for (var i = 0; i < src.length; i++) {
    var it = src[i] || {}, q = Math.floor(_crmNum_(it.qty)), price = Math.round(_crmNum_(it.price));
    var name = _crmStr_(it.name, 200), code = _crmStr_(it.code, 60);
    if (!name && !code) return { error: 'Dong san pham ' + (i + 1) + ' thieu ten/ma.' };
    if (!(q >= 1)) return { error: 'Dong san pham ' + (i + 1) + ': so luong phai >= 1.' };
    if (price < 0) return { error: 'Dong san pham ' + (i + 1) + ': don gia am.' };
    var line = q * price, dType = String(it.discType || '') === 'pct' ? 'pct' : 'amt', dVal = Math.max(0, _crmNum_(it.discValue));
    var dis = _crmDiscount_(line, dType, dVal);
    var taxPct = Math.min(100, Math.max(0, _crmNum_(it.taxPct))), tax = Math.round((line - dis) * taxPct / 100);
    items.push({ code: code, name: name, qty: q, price: price, discType: dType, discValue: dVal, discount: dis, taxPct: taxPct, tax: tax, note: _crmStr_(it.note, 200), amount: line - dis });
    gross += line; itemDiscount += dis; qty += q; taxTotal += tax;
  }
  var afterItems = gross - itemDiscount;
  var orderDiscount = _crmDiscount_(afterItems, raw.discType, raw.discValue);
  var freeShip = raw.freeShip === true || raw.freeShip === 'true' || raw.freeShip === 1;
  var shipFee = freeShip ? 0 : Math.max(0, Math.round(_crmNum_(raw.shipFee)));
  var surcharge = Math.max(0, Math.round(_crmNum_(raw.surcharge)));
  var total = afterItems + taxTotal - orderDiscount + shipFee + surcharge;
  var paid = Math.max(0, Math.round(_crmNum_(raw.paid)));
  var tags = raw.tags; if (Object.prototype.toString.call(tags) === '[object Array]') tags = tags.map(function (t) { return _crmStr_(t, 60); }).filter(String).join(', ');
  return { order: {
    source: _crmStr_(raw.source, 60), warehouse: _crmStr_(raw.warehouse, 60), saleName: _crmStr_(raw.saleName, 80), packerName: _crmStr_(raw.packerName, 80),
    careName: _crmStr_(raw.careName, 80), marketer: _crmStr_(raw.marketer, 80), tags: _crmStr_(tags, 300),
    custName: _crmStr_(raw.custName, 120), phone: phone, gender: _crmStr_(raw.gender, 20), email: _crmStr_(raw.email, 120), birthday: _crmStr_(raw.birthday, 20),
    recvName: _crmStr_(raw.recvName, 120), recvPhone: normPhone_(String(raw.recvPhone || '')) || phone, province: _crmStr_(raw.province, 80), district: _crmStr_(raw.district, 80),
    ward: _crmStr_(raw.ward, 80), address: _crmStr_(raw.address, 300), expectedDate: _crmStr_(raw.expectedDate, 20), carrier: _crmStr_(raw.carrier, 60), shipCode: _crmStr_(raw.shipCode, 60),
    items: items, itemCount: items.length, qty: qty, gross: gross, itemDiscount: itemDiscount, orderDiscount: orderDiscount, shipFee: shipFee, surcharge: surcharge,
    tax: taxTotal, total: total, paid: paid, due: Math.max(0, total - paid), note: _crmStr_(raw.note, 1000), printNote: _crmStr_(raw.printNote, 1000) } };
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
  o.items = items; ['itemCount', 'qty', 'gross', 'itemDiscount', 'orderDiscount', 'shipFee', 'surcharge', 'total', 'paid', 'due', 'tax'].forEach(function (k) { o[k] = Number(o[k]) || 0; });
  o.phone = normPhone_(String(o.phone || '')); o.createdAt = Object.prototype.toString.call(o.createdAt) === '[object Date]' ? o.createdAt.getTime() : o.createdAt;
  return o;
}
function _crmReadAll_() {
  var sh = getSheet_(SH_CRM_ORDER_, CRM_ORDER_HEADERS_), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, CRM_ORDER_HEADERS_.length).getValues().map(_crmOrderRowToObj_);
}
// Phạm vi XEM đơn của 1 tài khoản → { level: 'all'|'dept'|'team'|'own', keys: {tên chuẩn hoá→1}, usernames: {username thường→1} }.
function _crmScopeFor_(user) {
  var base = _roleBase_(user.role), own = {};
  [user.name, user.username].concat(user.names || []).forEach(function (n) { n = String(n || '').trim(); if (n) own[n] = 1; });
  if (base === 'admin' || base === 'viewer') return { level: 'all' };
  var allowed = {}, level = 'own';
  Object.keys(own).forEach(function (n) { allowed[n] = 1; });
  if (base === 'leader') {
    level = 'team';
    try {
      readTeams_(getCrmSS_().getSheetByName(SH_TEAM)).forEach(function (t) {
        if (own[String(t.leader || '').trim()] || (user.team && String(t.name || '') === String(user.team))) {
          if (t.leader) allowed[String(t.leader).trim()] = 1;
          (t.members || []).forEach(function (m) { m = String(m || '').trim(); if (m) allowed[m] = 1; });
        }
      });
    } catch (eT) {}
  } else if (base === 'manager') {
    level = 'dept';
    var dk = {}; String(user.team || '').split(',').forEach(function (k) { k = String(k).trim(); if (k) dk[k] = 1; });
    try { var sd = readSaleDepts_().raw; Object.keys(sd).forEach(function (n) { if (dk[sd[n]]) allowed[n] = 1; }); } catch (eD) {}
  }
  var keys = _scopeSameNameKeys_(allowed), usernames = {};
  try {
    readUsers_(getCrmSS_().getSheetByName(SH_USER)).forEach(function (u) {   // tài khoản của người thuộc phạm vi → đơn họ TẠO cũng thấy được
      var nm = [u.name, u.username].concat(u.names || []);
      for (var i = 0; i < nm.length; i++) { var n = String(nm[i] || '').trim(); if (n && (keys[_normTxt_(n)] || keys[_scopeNameKey_(n)])) { usernames[String(u.username || '').trim().toLowerCase()] = 1; break; } }
    });
  } catch (eU) {}
  usernames[String(user.username || '').trim().toLowerCase()] = 1;
  return { level: level, keys: keys, usernames: usernames };
}
function _crmCanSee_(sc, o) {
  if (sc.level === 'all') return true;
  if (sc.usernames[String(o.createdBy || '').trim().toLowerCase()]) return true;
  var names = String(o.saleName || '').split(',');
  for (var i = 0; i < names.length; i++) { var n = names[i].trim(); if (n && (sc.keys[_normTxt_(n)] || sc.keys[_scopeNameKey_(n)])) return true; }
  return false;
}
function crmOrderDoPost_(action, d) {
  if (action === 'crmOrderStatus') return crmOrderStatusDoPost_(d);
  try {
    var a = _khoAuth_(d); if (a.err) return a.err;
    var n = _crmOrderNormalize_(d && d.order); if (n.error) return jsonOut_({ ok: false, error: n.error });
    return _khoWithLock_(function () {
      var all = _crmReadAll_(), refKey = _crmStr_(d.refKey, 80);
      if (refKey) for (var i = 0; i < all.length; i++) if (String(all[i].refKey) === refKey) return jsonOut_({ ok: true, duplicate: true, order: all[i] });
      var now = new Date(), who = String(a.user.username || a.user.name || ''), o = n.order;
      o.orderId = _crmNextOrderId_(_vnYmd_(now), all.map(function (x) { return String(x.orderId); }));
      o.refKey = refKey; o.createdAt = now.getTime(); o.createdBy = who; o.status = 'Mới';
      if (!o.saleName) o.saleName = String(a.user.name || who);   // Sale mặc định = người tạo (để Trưởng team/phòng lọc đúng theo tên Sale)
      var row = CRM_ORDER_HEADERS_.map(function (h) { return h === 'items' ? JSON.stringify(o.items) : (o[h] == null ? '' : o[h]); });
      var sh = getSheet_(SH_CRM_ORDER_, CRM_ORDER_HEADERS_), rng = sh.getRange(sh.getLastRow() + 1, 1, 1, row.length);
      if (rng.setNumberFormat) rng.setNumberFormat('@');   // SĐT/ngày giữ dạng chữ (khỏi mất số 0 đầu)
      rng.setValues([row]);
      return jsonOut_({ ok: true, duplicate: false, order: o });
    });
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi luu don CRM: ' + (err && err.message || err) }); }
}
// POST crmOrderStatus {token, orderId, status, note?}: admin đổi mọi đơn; tài khoản khác chỉ đơn mình tạo. Ghi statusAt/statusBy/statusNote (lý do huỷ ở statusNote).
function crmOrderStatusDoPost_(d) {
  try {
    var a = _khoAuth_(d); if (a.err) return a.err;
    var id = _crmStr_(d && d.orderId, 40), to = _crmStr_(d && d.status, 30), note = _crmStr_(d && d.note, 300);
    if (!id) return jsonOut_({ ok: false, error: 'Thieu ma don.' });
    return _khoWithLock_(function () {
      var all = _crmReadAll_(), idx = -1;
      for (var i = 0; i < all.length; i++) if (String(all[i].orderId) === id) { idx = i; break; }
      if (idx < 0) return jsonOut_({ ok: false, error: 'Khong tim thay don ' + id + '.' });
      var o = all[idx], who = String(a.user.username || a.user.name || '');
      if (_roleBase_(a.user.role) !== 'admin' && String(o.createdBy).toLowerCase() !== who.toLowerCase()) return jsonOut_({ ok: false, error: 'Ban chi doi duoc trang thai don do minh tao.' });   // CEO/viewer chi xem; Truong team/phong xem duoc nhung CHUA duoc doi don cua team (cho Duyen chot)
      if (String(o.status) === to) return jsonOut_({ ok: true, unchanged: true, order: o });   // bấm 2 lần cùng trạng thái: không lỗi, không ghi
      var err = _crmStatusCheck_(o.status, to, note); if (err) return jsonOut_({ ok: false, error: err });
      var now = Date.now(), sh = getSheet_(SH_CRM_ORDER_, CRM_ORDER_HEADERS_);
      var col = function (h) { return CRM_ORDER_HEADERS_.indexOf(h) + 1; };
      var set = function (h, v) { var r = sh.getRange(idx + 2, col(h), 1, 1); if (r.setNumberFormat) r.setNumberFormat('@'); r.setValues([[v]]); };
      set('status', to); set('statusAt', now); set('statusBy', who); set('statusNote', note);
      o.status = to; o.statusAt = now; o.statusBy = who; o.statusNote = note;
      return jsonOut_({ ok: true, unchanged: false, order: o });
    });
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi doi trang thai don CRM: ' + (err && err.message || err) }); }
}
function crmOrderDoGet_(action, p) {
  try {
    var a = _khoAuth_(p); if (a.err) return a.err;
    var sc = _crmScopeFor_(a.user), ph = p && p.phone ? normPhone_(String(p.phone)) : '';
    var from = _crmStr_(p && p.from, 10), to = _crmStr_(p && p.to, 10), limit = Math.max(1, Math.min(500, parseInt(p && p.limit, 10) || 100));
    var rows = _crmReadAll_().filter(function (o) {
      if (!_crmCanSee_(sc, o)) return false;
      if (ph && o.phone !== ph) return false;
      var ymd = o.createdAt ? _vnYmd_(new Date(Number(o.createdAt))) : '';
      if (from && ymd < from) return false; if (to && ymd > to) return false;
      return true;
    });
    rows.sort(function (x, y) { return (Number(y.createdAt) || 0) - (Number(x.createdAt) || 0); });
    return jsonOut_({ ok: true, scope: sc.level, total: rows.length, orders: rows.slice(0, limit) });
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi doc don CRM: ' + (err && err.message || err) }); }
}

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
  'statusAt', 'statusBy', 'statusNote',
  'pointsUsed', 'pointsDiscount'];   // 2 cột cuối thêm ở bước 4b (điểm tích luỹ đã dùng + số tiền giảm tương ứng)   // 3 cột cuối thêm ở bước 4a (đổi trạng thái/huỷ); getSheet_ tự bổ sung tiêu đề cho sheet cũ
var CRM_ORDER_GET_ACTIONS_ = { crmOrders: 1 };
var CRM_ORDER_POST_ACTIONS_ = { crmOrderSave: 1, crmOrderStatus: 1, crmOrderStockRetry: 1 };
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
// Khoá sổ điểm của lần dùng điểm cho 1 đơn CRM (cố định theo mã đơn → Hủy/Hoàn tìm đúng dòng để hoàn tác).
function _crmRedeemKey_(phone, orderId) { return 'redeem|' + phone + '|crm|' + orderId; }
function _crmNextOrderId_(ymd, existingIds) {
  var pre = 'CRM' + String(ymd || '').replace(/-/g, '').slice(2), n = 0, re = new RegExp('^' + pre + '-(\\d+)$');
  (existingIds || []).forEach(function (id) { var m = re.exec(String(id)); if (m) n = Math.max(n, parseInt(m[1], 10) || 0); });
  n++; return pre + '-' + ('0000' + n).slice(-4);
}
function _crmOrderRowToObj_(r) {
  var o = {}; CRM_ORDER_HEADERS_.forEach(function (h, i) { o[h] = r[i]; });
  var items = []; try { items = JSON.parse(String(o.items || '[]')); } catch (e) {}
  o.items = items; ['itemCount', 'qty', 'gross', 'itemDiscount', 'orderDiscount', 'shipFee', 'surcharge', 'total', 'paid', 'due', 'tax', 'pointsUsed', 'pointsDiscount'].forEach(function (k) { o[k] = Number(o[k]) || 0; });
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
  if (action === 'crmOrderStockRetry') return crmOrderStockRetryDoPost_(d);
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
      // Dùng điểm tích luỹ (bước 4b): 1 điểm = pointValue đồng, TRỪ THẲNG vào đơn. Muốn dùng nhiều hơn mức cho phép → TỪ CHỐI (không âm thầm cắt, vì người lên đơn đã thấy tổng tiền).
      var want = Math.floor(_crmNum_(d.pointsUse)), redeemKey = '';
      o.pointsUsed = 0; o.pointsDiscount = 0;
      if (want > 0) {
        var sync = loyaltySync_(o.phone); if (sync.error) return jsonOut_({ ok: false, error: sync.error });
        var st = loyaltyState_(o.phone), rd = _loyaltyRedeem_(o.total, st.points.balance, want, st.config);
        if (rd.points < want) return jsonOut_({ ok: false, code: 'POINTS', error: 'Khong du diem: muon dung ' + want + ' diem, toi da dung duoc ' + rd.points + ' diem (so du ' + st.points.balance + ', don ' + o.total + 'd).', maxPoints: rd.points, points: st.points });
        o.pointsUsed = rd.points; o.pointsDiscount = rd.discount; o.total = o.total - rd.discount; o.due = Math.max(0, o.total - o.paid);
        redeemKey = _crmRedeemKey_(o.phone, o.orderId);
        _loyaltyAppend_(SH_LOYALTY_, LOYALTY_HEADERS_, [[redeemKey, o.phone, 'redeem', o.orderId, _vnYmd_(now), rd.points, rd.discount + o.total, 'Don CRM ' + o.orderId, who, now]]);
      }
      var row = CRM_ORDER_HEADERS_.map(function (h) { return h === 'items' ? JSON.stringify(o.items) : (o[h] == null ? '' : o[h]); });
      try {
        var sh = getSheet_(SH_CRM_ORDER_, CRM_ORDER_HEADERS_), rng = sh.getRange(sh.getLastRow() + 1, 1, 1, row.length);
        if (rng.setNumberFormat) rng.setNumberFormat('@');   // SĐT/ngày giữ dạng chữ (khỏi mất số 0 đầu)
        rng.setValues([row]);
      } catch (eW) {   // ghi đơn lỗi sau khi đã trừ điểm → hoàn lại điểm ngay, không để khách mất điểm mà không có đơn
        if (redeemKey) { try { _loyaltyUndoApply_({ phone: o.phone, key: redeemKey, note: 'ghi don loi, hoan diem' }, who); } catch (eU) {} }
        throw eW;
      }
      return jsonOut_({ ok: true, duplicate: false, order: o });
    });
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi luu don CRM: ' + (err && err.message || err) }); }
}
// ── BƯỚC 4c: TRỪ / CỘNG TRẢ KHO THEO TRẠNG THÁI ĐƠN CRM ───────────────────────────────────────────────────────
// Dùng lại hạ tầng kho của đơn POS (gas/24_TonKho.gs): sheet TonKho/TonKhoLog, KhoCombo, KhoCauHinh, sổ cái TonKhoTruDon (khoá đơn CRM = 'CRM|<mã đơn>' để KHÔNG trùng khoá đơn POS).
// Quy tắc (cùng luật docs/KHO-TRU-TON.md): đơn → "Đã xác nhận" thì TRỪ kho; → "Hủy"/"Hoàn" thì CỘNG TRẢ đúng số đã trừ. Chỉ chạy khi KhoCauHinh.mode = 'on' (mặc định TẮT → không đụng kho).
// Mã SP lấy từ cột `code` của từng dòng đơn; dòng thiếu mã / combo chưa khai báo / mã nằm nhiều kho chưa đặt ưu tiên → GIỮ cả đơn (ghi sổ 'cho_duyet', KHÔNG trừ, KHÔNG chặn đổi trạng thái).
// Mã không thuộc kho nào (dịch vụ, quà…) → bỏ qua. Không để tồn âm: trừ tối đa bằng tồn, phần thiếu báo trong `shortage`. Mỗi đơn trừ đúng 1 lần (sổ cái). Cộng trả luôn chạy dù mode đã tắt (hàng đã trừ thì phải trả).
var CRM_STOCK_PREFIX_ = 'CRM|';
function _crmStockKey_(orderId) { return CRM_STOCK_PREFIX_ + String(orderId); }
// Hàm thuần: items đơn → { plan:[{khoId,code,qty}], hold:[lý do], unknown:[mã không thuộc kho] }.
function _crmStockPlan_(items, combosMap, byCode, known, priority, khoName) {
  var hold = [], plan = [], unknown = [];
  (items || []).forEach(function (it, i) {
    var code = _tonkhoCode_(it && it.code), q = _khoNum_(it && it.qty), label = 'Dong ' + (i + 1) + (it && it.name ? ' (' + String(it.name).slice(0, 40) + ')' : '');
    if (!code) { hold.push(label + ' chua co ma SP'); return; }
    if (isNaN(q) || q <= 0) { hold.push(label + ': SL khong hop le'); return; }
    if (q > TKD_MAX_QTY_) { hold.push(label + ': SL bat thuong ' + q); return; }
    var cb = combosMap[code.toUpperCase()], lines;
    if (cb) lines = cb.components.map(function (c) { return { code: c.code, qty: Math.round(c.qty * q * 1000) / 1000 }; });
    else if (_tkdLooksCombo_(code, it && it.name) && !known[code.toUpperCase()]) { hold.push('Combo chua khai bao: ' + code); return; }
    else lines = [{ code: code, qty: q }];
    lines.forEach(function (ln) {
      var pick = _tkdPickKho_(ln.code.toUpperCase(), byCode, priority);
      if (pick.none) unknown.push(ln.code);
      else if (pick.multi) hold.push('Ma ' + ln.code + ' co o nhieu kho (' + pick.multi.map(function (id) { return khoName[id] || id; }).join(', ') + ') — dat thu tu uu tien');
      else plan.push({ khoId: pick.khoId, code: ln.code, qty: ln.qty });
    });
  });
  return { plan: plan, hold: hold, unknown: unknown };
}
function _crmStockLedgerWrite_(led, e) {
  if (e.row) led.sh.getRange(e.row, 1, 1, TKD_HEADERS.length).setValues([_tkdLedgerRow_(e)]);
  else led.sh.getRange(led.sh.getLastRow() + 1, 1, 1, TKD_HEADERS.length).setValues([_tkdLedgerRow_(e)]);
}
// Trừ kho cho 1 đơn (gọi TRONG _khoWithLock_). Trả { status:'off'|'already'|'held'|'no_stock'|'deducted', ... }.
function _crmStockApply_(o, who) {
  // KHÔNG tạo sheet khi kho chưa từng bật: chỉ đọc cấu hình nếu sheet KhoCauHinh đã tồn tại (getSheet_ sẽ tự tạo).
  if (!getCrmSS_().getSheetByName(SH_KHOCFG) || _tkdCfg_().mode !== 'on') return { status: 'off' };
  var cfg = _tkdCfg_(), key = _crmStockKey_(o.orderId), led = _tkdLedger_(), e = led.map[key];
  if (e && e.status === 'da_tru') return { status: 'already', lines: (e.applied || []).length };
  var khoName = {}, activeId = {};
  readKho_().filter(function (k) { return k.active; }).forEach(function (k) { khoName[k.id] = k.name; activeId[k.id] = true; });
  var combosMap = {}; readKhoCombo_().forEach(function (c) { if (c.active) combosMap[c.code.toUpperCase()] = c; });
  var L = _tonkhoLoad_(), byCode = {}, known = {};
  L.items.forEach(function (it) { if (!activeId[it.khoId]) return; var cu = _tonkhoCode_(it.maHang).toUpperCase(); known[cu] = true; (byCode[cu] = byCode[cu] || []).push(it.khoId); });
  var p = _crmStockPlan_(o.items, combosMap, byCode, known, cfg.priority, khoName);
  var ngay = _vnYmd_(new Date(Number(o.createdAt) || Date.now()));
  var le = { key: key, ngay: ngay, sdt: String(o.phone || ''), trangThai: 'Đã xác nhận', applied: [], problems: '', note: 'Don CRM ' + o.orderId, row: e ? e.row : 0 };
  if (p.hold.length) {
    le.status = 'cho_duyet'; le.problems = p.hold.join(' | ');
    if (!e || e.status !== 'cho_duyet' || e.problems !== le.problems) _crmStockLedgerWrite_(led, le);
    return { status: 'held', reasons: p.hold };
  }
  if (!p.plan.length) return { status: 'no_stock', unknown: p.unknown };
  var now = _khoNowIso_(), logs = [], dirty = {}, shortLines = [], applied = [];
  p.plan.forEach(function (pl) {
    var it = L.items[L.idx[_tonkhoKey_(pl.khoId, pl.code)]], take = Math.min(it.ton, pl.qty), miss = Math.round((pl.qty - take) * 1000) / 1000, before = it.ton;
    it.ton = Math.round((it.ton - take) * 1000) / 1000; it.ver += 1; it.updatedAt = now; it.updatedBy = who || TKD_SYSTEM_USER_; dirty[it.row] = it;
    applied.push({ khoId: it.khoId, maHang: it.maHang, qty: take });
    if (miss > 0) shortLines.push(it.maHang + ' thieu ' + miss);
    if (take > 0) logs.push({ khoId: it.khoId, maHang: it.maHang, tenHang: it.tenHang, user: who || TKD_SYSTEM_USER_, loai: 'tru_don', before: before, after: it.ton, delta: -take, lyDo: 'Don CRM ' + o.orderId + (miss > 0 ? ' (thieu ' + miss + ')' : ''), ref: key });
  });
  Object.keys(dirty).forEach(function (rw) { L.sh.getRange(Number(rw), 1, 1, TONKHO_HEADERS.length).setValues([_tonkhoItemToRow_(dirty[rw])]); });
  le.status = 'da_tru'; le.applied = applied; le.shortage = shortLines.join('; ');
  _crmStockLedgerWrite_(led, le); _tonkhoLog_(logs);
  return { status: 'deducted', lines: applied.length, shortage: shortLines, unknown: p.unknown };
}
// Cộng trả kho khi Hủy/Hoàn (gọi TRONG _khoWithLock_). Chỉ khi sổ cái ghi 'da_tru'; trả { status:'none'|'returned', lines }.
function _crmStockReverse_(o, toStatus, who) {
  if (!getCrmSS_().getSheetByName(SH_TKD)) return { status: 'none' };   // chưa từng trừ kho đơn nào → không có gì để trả (và không tạo sheet)
  var key = _crmStockKey_(o.orderId), led = _tkdLedger_(), e = led.map[key];
  if (!e || e.status !== 'da_tru') return { status: 'none' };
  var L = _tonkhoLoad_(), now = _khoNowIso_(), logs = [], dirty = {};
  e.applied.forEach(function (a) {
    var pos = L.idx[_tonkhoKey_(a.khoId, a.maHang)]; if (pos === undefined) return;
    var it = L.items[pos], before = it.ton; it.ton = Math.round((it.ton + a.qty) * 1000) / 1000; it.ver += 1; it.updatedAt = now; it.updatedBy = who || TKD_SYSTEM_USER_; dirty[it.row] = it;
    logs.push({ khoId: it.khoId, maHang: it.maHang, tenHang: it.tenHang, user: who || TKD_SYSTEM_USER_, loai: 'hoan_don', before: before, after: it.ton, delta: a.qty, lyDo: 'Don CRM ' + o.orderId + ' ' + toStatus, ref: key });
  });
  Object.keys(dirty).forEach(function (rw) { L.sh.getRange(Number(rw), 1, 1, TONKHO_HEADERS.length).setValues([_tonkhoItemToRow_(dirty[rw])]); });
  e.status = 'da_hoan'; e.trangThai = toStatus; e.note = 'Hoan do don CRM ' + toStatus;
  _crmStockLedgerWrite_(led, e); _tonkhoLog_(logs);
  return { status: 'returned', lines: e.applied.length };
}
// POST crmOrderStockRetry {token, orderId}: ADMIN chạy lại trừ kho cho đơn đang ở Đã xác nhận/Đang giao/Đã giao mà trước đó bị GIỮ (thiếu mã, combo chưa khai báo…) hoặc lúc đó kho đang tắt.
function crmOrderStockRetryDoPost_(d) {
  try {
    var a = _khoAuth_(d); if (a.err) return a.err;
    if (_roleBase_(a.user.role) !== 'admin') return jsonOut_({ ok: false, error: 'Chi admin duoc chay lai tru kho.' });
    var id = _crmStr_(d && d.orderId, 40); if (!id) return jsonOut_({ ok: false, error: 'Thieu ma don.' });
    return _khoWithLock_(function () {
      var all = _crmReadAll_(), o = null;
      for (var i = 0; i < all.length; i++) if (String(all[i].orderId) === id) { o = all[i]; break; }
      if (!o) return jsonOut_({ ok: false, error: 'Khong tim thay don ' + id + '.' });
      if (['Đã xác nhận', 'Đang giao', 'Đã giao'].indexOf(String(o.status)) < 0) return jsonOut_({ ok: false, error: 'Chi chay lai khi don dang o Da xac nhan / Dang giao / Da giao (hien: ' + o.status + ').' });
      return jsonOut_({ ok: true, stock: _crmStockApply_(o, String(a.user.username || a.user.name || '')) });
    });
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi chay lai tru kho: ' + (err && err.message || err) }); }
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
      // Hủy/Hoàn đơn có dùng điểm → hoàn lại điểm TRƯỚC khi đổi trạng thái (lỗi thật thì dừng, trạng thái giữ nguyên; đã hoàn tác tay rồi/không thấy dòng = bỏ qua).
      var refunded = 0;
      if ((to === 'Hủy' || to === 'Hoàn') && Number(o.pointsUsed) > 0) {
        var ur = _loyaltyUndoApply_({ phone: o.phone, key: _crmRedeemKey_(o.phone, o.orderId), note: (to === 'Hủy' ? 'Huy' : 'Hoan') + ' don CRM ' + o.orderId }, who);
        if (ur.ok) refunded = ur.undone.points; else if (ur.code !== 'DUPLICATE' && ur.code !== 'NOTFOUND') return jsonOut_({ ok: false, error: 'Khong hoan duoc diem, don giu nguyen trang thai: ' + ur.error });
      }
      // Bước 4c: Đã xác nhận → trừ kho; Hủy/Hoàn → cộng trả kho đã trừ. Lỗi thật (sheet kho hỏng) thì DỪNG, trạng thái giữ nguyên; kho tắt/đơn bị giữ KHÔNG chặn đổi trạng thái (xem `stock` trong kết quả).
      var stock = null;
      try {
        if (to === 'Đã xác nhận') stock = _crmStockApply_(o, who);
        else if (to === 'Hủy' || to === 'Hoàn') stock = _crmStockReverse_(o, to, who);
      } catch (eSt) { return jsonOut_({ ok: false, error: 'Loi kho, don giu nguyen trang thai: ' + (eSt && eSt.message || eSt) }); }
      var now = Date.now(), sh = getSheet_(SH_CRM_ORDER_, CRM_ORDER_HEADERS_);
      var col = function (h) { return CRM_ORDER_HEADERS_.indexOf(h) + 1; };
      var set = function (h, v) { var r = sh.getRange(idx + 2, col(h), 1, 1); if (r.setNumberFormat) r.setNumberFormat('@'); r.setValues([[v]]); };
      set('status', to); set('statusAt', now); set('statusBy', who); set('statusNote', note);
      o.status = to; o.statusAt = now; o.statusBy = who; o.statusNote = note;
      return jsonOut_({ ok: true, unchanged: false, pointsRefunded: refunded, stock: stock, order: o });
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

// ═══════════════════════════════════════════════════════════════
//  ĐỀ XUẤT SỬA MỤC VIẾT TẮT / MẪU TIN → ADMIN DUYỆT CHO CẢ TEAM (Duyên yêu cầu 2026-11-17)
//  Bản sửa NỘI BỘ (cá nhân hoá) vẫn ở riêng từng máy (app Android). Muốn cả team dùng: bấm "Gửi đề xuất" → ghi 1 dòng vào sheet VietTatDeXuat
//  + THÔNG BÁO cho MỌI admin đang hoạt động (cùng cách mẫu tin chờ duyệt: kind 'vtpropose' trong chuông CRM; extension Pancake AI / app đọc `vietTatProposals`).
//  Admin duyệt → áp vào đích: mục 'tpl_<id>' (CRM · Mẫu tin) = cập nhật nội dung + viết tắt của MẪU TIN; mục VietTat chung = cập nhật abbr/keyword/options;
//  không có đích = TẠO MỤC CHUNG MỚI. Từ chối kèm lý do; người đề xuất xem trạng thái qua `vietTatProposals` (app hiện "Đề xuất của tôi").
//  Chỉ gửi được CHỮ (hình/ghi âm của mục chung giữ nguyên). Người gửi chưa đăng nhập (app) xác định bằng TÊN (by=) — vô hại vì phải qua admin duyệt; tối đa 20 đề xuất chờ/người.
// ═══════════════════════════════════════════════════════════════
var SH_VT_PROP = 'VietTatDeXuat';
var VT_PROP_HEADERS = ['id', 'targetId', 'kind', 'nhom', 'abbr', 'keyword', 'options', 'proposer', 'via', 'baseUpdatedAt', 'createdAt', 'status', 'decidedBy', 'decidedAt', 'note'];
var VT_PROP_MAX_PENDING = 20, VT_PROP_STATUS_ = { pending: 1, approved: 1, rejected: 1 };
function _vpTarget_(raw) {   // 'crm_tpl_12' / 'tpl_12' -> {kind:'tpl', id:'12'}; 'crm_vt_ab' / 'vt_ab' -> {kind:'vt', id:'vt_ab'}; '' -> {kind:'new'}
  var s = String(raw == null ? '' : raw).trim().replace(/^crm_/, '');
  if (!s) return { kind: 'new', id: '' };
  if (/^tpl_/.test(s)) return { kind: 'tpl', id: s.slice(4) };
  return { kind: 'vt', id: s };
}
function _vpRead_() {
  var sh = getCrmSS_().getSheetByName(SH_VT_PROP), out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, VT_PROP_HEADERS.length).getValues();
  for (var i = 0; i < v.length; i++) {
    var r = v[i]; if (!r[0]) continue;
    var opts = []; try { opts = JSON.parse(String(r[6] || '[]')) || []; } catch (e) { opts = []; }
    var st = String(r[11] || 'pending').toLowerCase(); if (!VT_PROP_STATUS_[st]) st = 'pending';
    out.push({ row: i + 2, id: String(r[0]), targetId: String(r[1] || ''), kind: String(r[2] || 'new'), nhom: String(r[3] || ''), abbr: String(r[4] || ''), keyword: String(r[5] || ''), options: opts,
               proposer: String(r[7] || ''), via: String(r[8] || ''), baseUpdatedAt: String(r[9] || ''), createdAt: r[10] instanceof Date ? r[10].toISOString() : String(r[10] || ''), status: st,
               decidedBy: String(r[12] || ''), decidedAt: r[13] instanceof Date ? r[13].toISOString() : String(r[13] || ''), note: String(r[14] || '') });
  }
  return out;
}
// Nội dung HIỆN TẠI của đích (để admin so sánh + phát hiện mục chung đã đổi sau khi đề xuất). null = không còn / không hợp lệ.
function _vpTargetCur_(kind, id) {
  try {
    if (kind === 'tpl') {
      var v = getSheet_(SH_MSG_TPL, MSG_TPL_HEADERS).getDataRange().getValues();
      for (var i = 1; i < v.length; i++) if (String(v[i][0]) === String(id)) {
        var o = _tplRowToObj_(v[i]);
        return { row: i + 1, status: o.status, abbr: String(v[i][15] || ''), keyword: '', options: [o.content], updatedAt: String(o.updatedAt || '') };
      }
    } else if (kind === 'vt') {
      var w = getSheet_(SH_VIETTAT, VIETTAT_HEADERS).getDataRange().getValues();
      for (var j = 1; j < w.length; j++) if (String(w[j][0]) === String(id)) {
        var op = []; try { op = JSON.parse(String(w[j][4] || '[]')) || []; } catch (e) { op = []; }
        return { row: j + 1, owner: String(w[j][5] || ''), abbr: String(w[j][2] || ''), keyword: String(w[j][3] || ''), options: op, updatedAt: String(w[j][7] instanceof Date ? w[j][7].toISOString() : (w[j][7] || '')) };
      }
    }
  } catch (e) {}
  return null;
}
function _vpApprovers_(excludeName) {   // username của mọi admin đang hoạt động (trừ người đề xuất) — cùng quy tắc _tplNotifyPending_
  var users = []; try { users = readUsers_(getCrmSS_().getSheetByName(SH_USER)) || []; } catch (e) {}
  var me = String(excludeName || '').trim().toLowerCase(), to = [];
  users.forEach(function (u) {
    if (!u || u.active === false || MSG_TPL_APPROVER_ROLES_.indexOf(String(u.role || '')) < 0) return;
    if (me && [u.name, u.username].some(function (x) { return String(x || '').trim().toLowerCase() === me; })) return;
    to.push(String(u.username));
  });
  return to;
}
function _vpIsAdminName_(name) {
  var n = String(name || '').trim(); if (!n) return false;
  try {
    return (readUsers_(getCrmSS_().getSheetByName(SH_USER)) || []).some(function (u) {
      return u && u.active !== false && MSG_TPL_APPROVER_ROLES_.indexOf(String(u.role || '')) >= 0 && (_vtSame_(u.name, n) || _vtSame_(u.username, n));
    });
  } catch (e) { return false; }
}
function _vpNotifClear_(id) {
  try {
    var sh = getCrmSS_().getSheetByName(SH_NOTIF); if (!sh || sh.getLastRow() < 2) return 0;
    var v = sh.getDataRange().getValues(), now = new Date().toISOString(), n = 0;
    for (var i = 1; i < v.length; i++) if (String(v[i][3]) === 'vtpropose' && String(v[i][5]) === String(id) && !v[i][9]) { sh.getRange(i + 1, 10).setValue(now); n++; }
    return n;
  } catch (e) { return 0; }
}
function _vpNotifyAdmins_(p) {
  try {
    var to = _vpApprovers_(p.proposer); if (!to.length) return 0;
    var sh = getSheet_(SH_NOTIF, NOTIF_HEADERS), now = new Date().toISOString(), rows = [];
    var what = p.kind === 'new' ? 'đề xuất mục viết tắt MỚI' : 'đề xuất sửa mục viết tắt';
    var txt = ('📝 ' + (p.proposer || 'Nhân viên') + ' ' + what + ' "' + p.abbr + '" — chờ bạn duyệt cho cả team').slice(0, 160);
    to.forEach(function (u, k) { rows.push(['nt_' + Date.now() + '_vp' + k + '_' + Math.floor(Math.random() * 1000), u, p.proposer || 'Nhân viên', 'vtpropose', 'vtpropose', p.id, '', txt, now, '']); });
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, NOTIF_HEADERS.length).setValues(rows);
    return rows.length;
  } catch (e) { return 0; }   // thông báo hỏng không được làm hỏng việc gửi đề xuất
}
function vietTatPropose_(d, caller) {
  d = d || {}; caller = caller || { name: '' };
  var who = String(caller.name || '').trim().slice(0, 60);
  if (!who) return jsonOut_({ error: 'Thiếu tên người đề xuất (đăng nhập CRM hoặc nhập Tên CS trong app).', code: 'AUTH' });
  var abbr = String(d.abbr || '').trim();
  if (!abbr || /\s/.test(abbr) || abbr.length > 30) return jsonOut_({ error: 'Viết tắt phải là 1 từ (không có khoảng trắng, tối đa 30 ký tự).' });
  var stripped = 0;
  var options = (Array.isArray(d.options) ? d.options : []).map(function (x) { return String(x == null ? '' : x).trim(); })
    .filter(function (x) { if (/^\[\[(img|aud):/i.test(x)) { stripped++; return false; } return !!x; })   // hình/ghi âm trên máy không gửi được: bỏ, mục chung giữ hình/ghi âm của nó
    .map(function (x) { return x.slice(0, 4000); }).slice(0, 10);
  if (!options.length) return jsonOut_({ error: 'Thiếu nội dung chữ để đề xuất.' });
  var tg = _vpTarget_(d.targetId), cur = null;
  if (tg.kind !== 'new') {
    cur = _vpTargetCur_(tg.kind, tg.id);
    if (!cur) return jsonOut_({ error: 'Không tìm thấy mục chung để sửa (có thể đã bị xoá trên CRM). Hãy bấm ☁ CRM để cập nhật rồi thử lại.' });
    if (tg.kind === 'vt' && cur.owner) return jsonOut_({ error: 'Chỉ đề xuất được cho mục CHUNG của team (mục riêng của người khác thì không).' });
    if (tg.kind === 'tpl' && cur.status !== 'approved') return jsonOut_({ error: 'Mẫu tin này chưa được duyệt nên chưa đề xuất sửa được.' });
    if (tg.kind === 'tpl' && options.length > 1) return jsonOut_({ error: 'Mục "CRM · Mẫu tin" chỉ có 1 nội dung — hãy gộp lại thành 1 đoạn, hoặc lưu thành mục riêng của bạn.' });
  }
  var all = _vpRead_(), mineCnt = 0, dup = null;
  all.forEach(function (p) {
    if (p.status !== 'pending' || !_vtSame_(p.proposer, who)) return;
    mineCnt++;
    if (tg.kind !== 'new' ? (p.targetId === (tg.kind === 'tpl' ? 'tpl_' + tg.id : tg.id)) : (p.kind === 'new' && p.abbr.toLowerCase() === abbr.toLowerCase())) dup = p;
  });
  if (!dup && mineCnt >= VT_PROP_MAX_PENDING) return jsonOut_({ error: 'Bạn đang có ' + mineCnt + ' đề xuất chờ duyệt (tối đa ' + VT_PROP_MAX_PENDING + '). Chờ admin duyệt bớt rồi gửi tiếp.' });
  var nhom = tg.kind === 'new' ? _vtNhom_(d.nhom) : '', keyword = String(d.keyword || '').trim().slice(0, 200), now = new Date().toISOString();
  var base = String(d.baseUpdatedAt || (cur && cur.updatedAt) || '');
  var sh = getSheet_(SH_VT_PROP, VT_PROP_HEADERS), id;
  var targetStored = tg.kind === 'new' ? '' : (tg.kind === 'tpl' ? 'tpl_' + tg.id : tg.id);
  var rowVals = function (pid) { return [pid, targetStored, tg.kind, nhom, abbr, keyword, JSON.stringify(options), who, String(caller.via || ''), base, now, 'pending', '', '', '']; };
  if (dup) {   // gửi lại cho cùng mục: cập nhật đề xuất cũ (không nhân đôi), báo lại admin
    id = dup.id; sh.getRange(dup.row, 1, 1, VT_PROP_HEADERS.length).setValues([rowVals(id)]); _vpNotifClear_(id);
  } else {
    id = 'vp_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    sh.getRange(sh.getLastRow() + 1, 1, 1, VT_PROP_HEADERS.length).setValues([rowVals(id)]);
  }
  var notified = _vpNotifyAdmins_({ id: id, kind: tg.kind, abbr: abbr, proposer: who });
  return jsonOut_({ ok: true, id: id, status: 'pending', updatedExisting: !!dup, notified: notified, strippedMedia: stripped });
}
function _vpOwn_(who) {
  return _vpRead_().filter(function (p) { return _vtSame_(p.proposer, who); }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
}
// Tóm tắt cho app/extension: đề xuất CỦA MÌNH (trạng thái) + số đề xuất chờ duyệt nếu người gọi là admin.
function _vpSummaryFor_(caller) {
  var who = String((caller && caller.name) || '').trim(), out = { own: [], adminPending: null };
  if (who) out.own = _vpOwn_(who).slice(0, 30).map(function (p) { return { id: p.id, targetId: p.targetId, abbr: p.abbr, status: p.status, note: p.note, createdAt: p.createdAt, decidedAt: p.decidedAt }; });
  if ((caller && caller.priv) || _vpIsAdminName_(who)) out.adminPending = _vpRead_().filter(function (p) { return p.status === 'pending'; }).length;
  return out;
}
function vietTatProposalsList_(caller) {
  caller = caller || { name: '', priv: false };
  var all = _vpRead_();
  if (caller.priv) {
    var pend = all.filter(function (p) { return p.status === 'pending'; }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    var done = all.filter(function (p) { return p.status !== 'pending'; }).sort(function (a, b) { return String(b.decidedAt || b.createdAt).localeCompare(String(a.decidedAt || a.createdAt)); }).slice(0, 30);
    var items = pend.concat(done).map(function (p) {
      var tg = p.kind === 'new' ? null : _vpTargetCur_(p.kind, p.kind === 'tpl' ? String(p.targetId).replace(/^tpl_/, '') : p.targetId);
      return { id: p.id, targetId: p.targetId, kind: p.kind, nhom: p.nhom, abbr: p.abbr, keyword: p.keyword, options: p.options, proposer: p.proposer, via: p.via, createdAt: p.createdAt, status: p.status, decidedBy: p.decidedBy, decidedAt: p.decidedAt, note: p.note,
               target: tg ? { abbr: tg.abbr, keyword: tg.keyword, options: tg.options, updatedAt: tg.updatedAt } : null, targetMissing: p.kind !== 'new' && !tg,
               conflict: !!(tg && p.baseUpdatedAt && tg.updatedAt && String(tg.updatedAt) > String(p.baseUpdatedAt)) };
    });
    return { ok: true, admin: true, pending: pend.length, items: items };
  }
  var who = String(caller.name || '').trim();
  if (!who) return { error: 'Cần đăng nhập CRM hoặc nhập tên CS.', code: 'AUTH' };
  var own = _vpOwn_(who).slice(0, 50).map(function (p) { return { id: p.id, targetId: p.targetId, kind: p.kind, abbr: p.abbr, keyword: p.keyword, options: p.options, createdAt: p.createdAt, status: p.status, decidedBy: p.decidedBy, decidedAt: p.decidedAt, note: p.note }; });
  return { ok: true, admin: false, pending: own.filter(function (p) { return p.status === 'pending'; }).length, items: own };
}
function vietTatDecide_(d, caller) {
  if (!caller || !caller.priv) return jsonOut_({ error: 'Chỉ admin mới duyệt được đề xuất viết tắt.', code: 'FORBIDDEN' });
  d = d || {};
  var decision = String(d.decision || '').toLowerCase();
  if (decision !== 'approve' && decision !== 'reject') return jsonOut_({ error: 'decision phải là approve hoặc reject' });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return jsonOut_({ error: 'Hệ thống đang bận, thử lại sau vài giây.' });
  try {
    var p = _vpRead_().filter(function (x) { return x.id === String(d.id || ''); })[0];
    if (!p) return jsonOut_({ error: 'Không tìm thấy đề xuất.' });
    if (p.status !== 'pending') return jsonOut_({ error: 'Đề xuất này đã được xử lý (' + p.status + ').' });
    var sh = getSheet_(SH_VT_PROP, VT_PROP_HEADERS), now = new Date(), applied = '';
    if (decision === 'approve') {
      var r = _vpApply_(p, caller);
      if (r.error) return jsonOut_({ error: r.error });
      applied = r.applied;
    }
    var st = decision === 'approve' ? 'approved' : 'rejected';
    sh.getRange(p.row, 12, 1, 4).setValues([[st, caller.name, now.toISOString(), decision === 'reject' ? String(d.note || '').trim().slice(0, 300) : '']]);
    _vpNotifClear_(p.id);   // đã xử lý (ở CRM hoặc Pancake AI) → thông báo của MỌI admin chuyển "đã đọc"
    return jsonOut_({ ok: true, id: p.id, status: st, applied: applied });
  } finally { try { lock.releaseLock(); } catch (e9) {} }
}
// Áp đề xuất đã duyệt vào đích. Trả {applied} hoặc {error}.
function _vpApply_(p, decider) {
  var now = new Date();
  if (p.kind === 'tpl') {
    var tid = String(p.targetId).replace(/^tpl_/, ''), cur = _vpTargetCur_('tpl', tid);
    if (!cur) return { error: 'Mẫu tin gốc không còn — không thể áp đề xuất.' };
    var sh = getSheet_(SH_MSG_TPL, MSG_TPL_HEADERS);
    sh.getRange(cur.row, 3).setValue(String(p.options[0] || ''));            // content
    sh.getRange(cur.row, 7).setValue(now);                                   // updatedAt
    if (p.abbr) sh.getRange(cur.row, 16).setValue(p.abbr);                   // abbr
    return { applied: 'tpl' };
  }
  if (p.kind === 'vt') {
    var cv = _vpTargetCur_('vt', p.targetId);
    if (!cv) return { error: 'Mục chung gốc không còn — không thể áp đề xuất.' };
    var sv = getSheet_(SH_VIETTAT, VIETTAT_HEADERS);
    sv.getRange(cv.row, 3, 1, 3).setValues([[p.abbr, p.keyword, JSON.stringify(p.options)]]);   // abbr, keyword, options
    sv.getRange(cv.row, 8).setValue(now.toISOString());                                          // updatedAt
    return { applied: 'vt' };
  }
  // mục MỚI → tạo mục chung
  var res = saveVietTat_({ abbr: p.abbr, keyword: p.keyword, options: p.options, nhom: p.nhom, scope: 'team' }, { priv: true, name: decider.name, role: 'admin' });
  var obj = null; try { obj = JSON.parse(res.getContent()); } catch (e) {}
  if (!obj || obj.error) return { error: (obj && obj.error) || 'Không tạo được mục chung.' };
  return { applied: 'new' };
}

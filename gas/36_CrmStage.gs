// ═══════════════════════════════════════════════════════════════
//  ĐƠN CÁC KÊNH THEO GIAI ĐOẠN (kiểu Base "ĐƠN CÁC KÊNH 2025-2026") — Duyên yêu cầu 28/11/2026 (clip + ảnh form Base)
//  THỰC THỂ RIÊNG, KHÔNG đụng sheet "Đơn CRM" (Tạo đơn có cấu trúc, kho, điểm tích luỹ) và KHÔNG ghi DT Tổng.
//  Sheet: "Đơn Kênh" (đơn) | "Đơn Kênh GĐ" (nhật ký vào/ra từng giai đoạn → tính thời gian mỗi giai đoạn) | "Đơn Kênh Việc" (công việc con trong đơn,
//  vd giao Kế toán check tiền) | "Đơn Kênh BL" (bình luận + dòng hệ thống "đã tạo đơn", "chuyển giai đoạn…").
//  Giai đoạn (đúng Base): Tiếp nhận đơn → Tạo đơn POS → Phân loại đơn → Phòng sản xuất → Kho thành phẩm → Đóng hàng → Hoàn thành | Thất bại (Thất bại BẮT BUỘC lý do).
//  Quyền XEM = _crmCanSee_ (admin/CEO tất cả, trưởng phòng/team theo phạm vi, còn lại đơn của mình/Sale ghi trên đơn) + người được THEO DÕI + người được GIAO công việc trong đơn.
//  Quyền SỬA/CHUYỂN GIAI ĐOẠN = admin, người tạo, Sale ghi trên đơn, hoặc người đang được giao 1 công việc CHƯA XONG trong đơn. Từ giai đoạn cuối (Hoàn thành/Thất bại) chỉ admin mở lại.
//  Action: GET kenhBoard {token, from?, to?, kenh?, q?} | GET kenhOrder {token, id}
//          POST kenhSave {token, refKey?, order} | kenhUpdate {token, id, patch} | kenhMove {token, id, stage, note?} | kenhComment {token, id, text}
//                kenhTaskSave {token, id, task:{title, assignee?, dept?, dueAt?, note?}} | kenhTaskDone {token, taskId, done, note?} | kenhFollow {token, id, followers:[username]}
//  Mã bộ đếm = "<số thứ tự trong tháng>T<mm>/<yyyy>" (vd 1036T11/2026); mã nhiệm vụ = số tăng dần (vd 100001).
// ═══════════════════════════════════════════════════════════════
var CRMSTAGE_SECTION_ = 1;
var SH_KENH_ORDER_ = 'Đơn Kênh', SH_KENH_LOG_ = 'Đơn Kênh GĐ', SH_KENH_TASK_ = 'Đơn Kênh Việc', SH_KENH_CMT_ = 'Đơn Kênh BL';
var KENH_ORDER_HEADERS_ = ['id', 'maBoDem', 'createdAt', 'createdBy', 'kenh', 'saleName', 'phone', 'custName', 'product', 'phanLoai', 'deposit', 'total', 'diffExchange',
  'stage', 'stageAt', 'stageBy', 'description', 'followers', 'transferImages', 'attachments', 'failReason', 'updatedAt', 'refKey'];
var KENH_LOG_HEADERS_ = ['orderId', 'stage', 'enterAt', 'leaveAt', 'by'];
var KENH_TASK_HEADERS_ = ['id', 'orderId', 'title', 'assignee', 'assigneeName', 'dept', 'dueAt', 'note', 'status', 'createdAt', 'createdBy', 'doneAt', 'doneBy', 'doneNote'];
var KENH_CMT_HEADERS_ = ['id', 'orderId', 'at', 'by', 'byName', 'kind', 'text', 'attach'];
var KENH_STAGES_ = ['Tiếp nhận đơn', 'Tạo đơn POS', 'Phân loại đơn', 'Phòng sản xuất', 'Kho thành phẩm', 'Đóng hàng', 'Hoàn thành', 'Thất bại'];
var KENH_FINAL_ = { 'Hoàn thành': 1, 'Thất bại': 1 };
var KENH_PHAN_LOAI_ = ['Thanh toán toàn bộ', 'Cọc trước', 'Thu COD'];
var KENH_GET_ACTIONS_ = { kenhBoard: 1, kenhOrder: 1 };
var KENH_POST_ACTIONS_ = { kenhSave: 1, kenhUpdate: 1, kenhMove: 1, kenhComment: 1, kenhTaskSave: 1, kenhTaskDone: 1, kenhFollow: 1 };
var KENH_BOARD_LIMIT_ = 800, KENH_CMT_LIMIT_ = 300, KENH_MAX_TASKS_ = 30;
function _kenhIsAdmin_(u) { return _roleBase_(u.role) === 'admin'; }
function _kenhMe_(u) { return String(u.username || u.name || '').trim(); }
function _kenhList_(v) { return String(v == null ? '' : v).split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(String); }
function _kenhJsonArr_(v) { try { var a = JSON.parse(String(v || '[]')); return Object.prototype.toString.call(a) === '[object Array]' ? a : []; } catch (e) { return []; } }
// Đọc cả sheet thành mảng object (kèm _row để ghi lại đúng dòng). Ô số lưu dạng chữ (setNumberFormat '@') → ép số khi đọc.
function _kenhRead_(name, headers, numCols) {
  var sh = getSheet_(name, headers), last = sh.getLastRow(), rows = [];
  if (last >= 2) {
    var vals = sh.getRange(2, 1, last - 1, headers.length).getValues();
    for (var i = 0; i < vals.length; i++) {
      var o = { _row: i + 2 };
      for (var k = 0; k < headers.length; k++) o[headers[k]] = vals[i][k];
      (numCols || []).forEach(function (c) { o[c] = Number(o[c]) || 0; });
      o.id = o.id !== undefined ? String(o.id) : o.id; o.orderId = o.orderId !== undefined ? String(o.orderId) : o.orderId;
      rows.push(o);
    }
  }
  return { sh: sh, rows: rows };
}
function _kenhRowOf_(headers, o) { return headers.map(function (h) { return o[h] == null ? '' : o[h]; }); }
function _kenhAppend_(sh, headers, o) {
  var row = _kenhRowOf_(headers, o), rng = sh.getRange(sh.getLastRow() + 1, 1, 1, row.length);
  if (rng.setNumberFormat) rng.setNumberFormat('@');
  rng.setValues([row]);
}
function _kenhWrite_(sh, headers, o) { var row = _kenhRowOf_(headers, o), rng = sh.getRange(o._row, 1, 1, row.length); if (rng.setNumberFormat) rng.setNumberFormat('@'); rng.setValues([row]); }
function _kenhOrderObj_(o) {
  var r = {}; KENH_ORDER_HEADERS_.forEach(function (h) { r[h] = o[h]; });
  r.id = String(o.id); r.followers = _kenhList_(o.followers); r.transferImages = _kenhJsonArr_(o.transferImages); r.attachments = _kenhJsonArr_(o.attachments);
  r.phone = normPhone_(String(o.phone || '')) || String(o.phone || '');
  return r;
}
function _kenhNextId_(rows, col, start) { var n = start || 0; rows.forEach(function (r) { var v = parseInt(r[col], 10); if (v > n) n = v; }); return String(n + 1); }
// Mã bộ đếm: số thứ tự của đơn trong THÁNG (theo giờ VN) + 'T' + tháng + '/' + năm.
function _kenhMaBoDem_(rows, now) {
  var ymd = _vnYmd_(now), ym = ymd.slice(0, 7), n = 0;
  rows.forEach(function (o) { if (o.createdAt && _vnYmd_(new Date(Number(o.createdAt))).slice(0, 7) === ym) n++; });
  return (n + 1) + 'T' + ymd.slice(5, 7) + '/' + ymd.slice(0, 4);
}
// Chuẩn hoá + kiểm tra form lên đơn (hàm thuần). Trả { error } hoặc { v }.
function _kenhNormalize_(raw, partial) {
  raw = raw || {}; var v = {};
  if (!partial || raw.phone !== undefined) { v.phone = normPhone_(String(raw.phone || '')); if (!v.phone) return { error: 'Thieu so dien thoai khach (ten nhiem vu = SDT).' }; }
  if (!partial || raw.kenh !== undefined) { v.kenh = _crmStr_(raw.kenh, 80); if (!v.kenh) return { error: 'Chua chon Kenh ban.' }; }
  if (!partial || raw.saleName !== undefined) { v.saleName = _kenhList_(raw.saleName).join(', ').slice(0, 200); if (!v.saleName) return { error: 'Chua chon Sale ban.' }; }
  if (!partial || raw.product !== undefined) { v.product = _crmStr_(raw.product, 3000); if (!v.product) return { error: 'Chua nhap San pham order.' }; }
  if (!partial || raw.phanLoai !== undefined) { v.phanLoai = _crmStr_(raw.phanLoai, 40); if (KENH_PHAN_LOAI_.indexOf(v.phanLoai) < 0) return { error: 'Phan loai khong hop le (Thanh toan toan bo / Coc truoc / Thu COD).' }; }
  if (!partial || raw.total !== undefined) { v.total = Math.round(_crmNum_(raw.total)); if (v.total < 0) return { error: 'Tong gia tri don khong duoc am.' }; }
  if (!partial || raw.deposit !== undefined) { v.deposit = Math.round(_crmNum_(raw.deposit)); if (v.deposit < 0) return { error: 'Gia tri coc khong duoc am.' }; }
  if (raw.diffExchange !== undefined || !partial) v.diffExchange = Math.round(_crmNum_(raw.diffExchange));   // chênh đơn đổi: dương = đơn tăng, âm = đơn giảm
  if (raw.custName !== undefined || !partial) v.custName = _crmStr_(raw.custName, 120);
  if (raw.description !== undefined || !partial) v.description = _crmStr_(raw.description, 3000);
  if (raw.followers !== undefined || !partial) v.followers = _kenhList_(Object.prototype.toString.call(raw.followers) === '[object Array]' ? raw.followers.join(',') : raw.followers).join(', ').slice(0, 600);
  ['transferImages', 'attachments'].forEach(function (k) {
    if (raw[k] === undefined && partial) return;
    var a = Object.prototype.toString.call(raw[k]) === '[object Array]' ? raw[k] : [];
    v[k] = JSON.stringify(a.slice(0, 20).map(function (x) { return typeof x === 'string' ? _crmStr_(x, 500) : { name: _crmStr_(x && x.name, 200), url: _crmStr_(x && x.url, 500) }; }));
  });
  if (v.total !== undefined && v.deposit !== undefined && v.deposit > v.total && v.phanLoai !== 'Thanh toán toàn bộ') return { error: 'Gia tri coc khong duoc lon hon tong gia tri don.' };
  return { v: v };
}
// Quyền thao tác trên 1 đơn → { see, edit, tasks }. tasks = các việc của đơn (đã đọc sẵn) để biết người được giao.
function _kenhAccess_(user, sc, o, tasks) {
  var me = _kenhMe_(user).toLowerCase(), isAdmin = _kenhIsAdmin_(user), assigned = false, openAssigned = false;
  (tasks || []).forEach(function (t) {
    if (String(t.orderId) === String(o.id) && String(t.assignee || '').toLowerCase() === me && me) { assigned = true; if (String(t.status) !== 'done') openAssigned = true; }
  });
  var follow = _kenhList_(o.followers).some(function (f) { return f.toLowerCase() === me; });
  var own = String(o.createdBy || '').toLowerCase() === me || _kenhList_(o.saleName).some(function (n) { return n.toLowerCase() === me || n.toLowerCase() === String(user.name || '').toLowerCase(); });
  return { see: isAdmin || _crmCanSee_(sc, o) || follow || assigned, edit: isAdmin || own || openAssigned };
}
function _kenhSysComment_(sh, orderId, who, text, now, idN) {
  _kenhAppend_(sh, KENH_CMT_HEADERS_, { id: idN, orderId: orderId, at: now, by: who.username, byName: who.name, kind: 'sys', text: text, attach: '[]' });
}
function _kenhWho_(user) { return { username: _kenhMe_(user), name: String(user.name || user.username || '') }; }
function _kenhLoadAll_() {
  return { orders: _kenhRead_(SH_KENH_ORDER_, KENH_ORDER_HEADERS_, ['createdAt', 'deposit', 'total', 'diffExchange', 'stageAt', 'updatedAt']),
    tasks: _kenhRead_(SH_KENH_TASK_, KENH_TASK_HEADERS_, ['createdAt', 'doneAt', 'dueAt']), log: _kenhRead_(SH_KENH_LOG_, KENH_LOG_HEADERS_, ['enterAt', 'leaveAt']),
    cmts: _kenhRead_(SH_KENH_CMT_, KENH_CMT_HEADERS_, ['at']) };
}
function _kenhChannels_(orders) {
  var set = {}, out = [];
  _kenhList_(getSetting_('kenhBanList')).forEach(function (k) { if (!set[k]) { set[k] = 1; out.push(k); } });
  orders.forEach(function (o) { var k = String(o.kenh || '').trim(); if (k && !set[k]) { set[k] = 1; out.push(k); } });
  return out;
}
function kenhDoGet_(action, p) {
  try {
    var a = _khoAuth_(p); if (a.err) return a.err;
    var sc = _crmScopeFor_(a.user), all = _kenhLoadAll_();
    if (action === 'kenhOrder') {
      var id = String(p && p.id || ''), o = all.orders.rows.filter(function (x) { return x.id === id; })[0];
      if (!o) return jsonOut_({ ok: false, error: 'Khong tim thay don.' });
      var acc = _kenhAccess_(a.user, sc, o, all.tasks.rows); if (!acc.see) return jsonOut_({ ok: false, error: 'Khong co quyen xem don nay.', code: 'FORBIDDEN' });
      var cm = all.cmts.rows.filter(function (c) { return c.orderId === id; }); cm.sort(function (x, y) { return x.at - y.at; });
      return jsonOut_({ ok: true, order: _kenhOrderObj_(o), canEdit: acc.edit, isAdmin: _kenhIsAdmin_(a.user), me: _kenhWho_(a.user), stages: KENH_STAGES_,
        log: all.log.rows.filter(function (l) { return l.orderId === id; }).map(function (l) { return { stage: l.stage, enterAt: l.enterAt, leaveAt: l.leaveAt, by: l.by }; }),
        tasks: all.tasks.rows.filter(function (t) { return t.orderId === id; }).map(_kenhTaskObj_),
        comments: cm.slice(-KENH_CMT_LIMIT_).map(_kenhCmtObj_) });
    }
    // kenhBoard
    var from = _crmStr_(p && p.from, 10), to = _crmStr_(p && p.to, 10), kenh = _crmStr_(p && p.kenh, 80), q = _normTxt_(String(p && p.q || ''));
    var open = {}, cmtN = {};
    all.tasks.rows.forEach(function (t) { if (String(t.status) !== 'done') open[t.orderId] = (open[t.orderId] || 0) + 1; });
    all.cmts.rows.forEach(function (c) { if (c.kind !== 'sys') cmtN[c.orderId] = (cmtN[c.orderId] || 0) + 1; });
    var taskN = {}; all.tasks.rows.forEach(function (t) { taskN[t.orderId] = (taskN[t.orderId] || 0) + 1; });
    var visible = all.orders.rows.filter(function (o) { return _kenhAccess_(a.user, sc, o, all.tasks.rows).see; });
    var channels = _kenhChannels_(visible), counts = {};
    visible.forEach(function (o) { counts[o.kenh] = (counts[o.kenh] || 0) + 1; });
    var rows = visible.filter(function (o) {
      var ymd = o.createdAt ? _vnYmd_(new Date(Number(o.createdAt))) : '';
      if (from && ymd < from) return false; if (to && ymd > to) return false;
      if (kenh && o.kenh !== kenh) return false;
      if (q && _normTxt_([o.phone, o.custName, o.product, o.saleName, o.maBoDem, o.id].join(' ')).indexOf(q) < 0) return false;
      return true;
    });
    rows.sort(function (x, y) { return (Number(y.stageAt) || 0) - (Number(x.stageAt) || 0); });
    var stageCount = {}; KENH_STAGES_.forEach(function (s) { stageCount[s] = 0; });
    rows.forEach(function (o) { stageCount[o.stage] = (stageCount[o.stage] || 0) + 1; });
    var cards = rows.slice(0, KENH_BOARD_LIMIT_).map(function (o) {
      return { id: o.id, maBoDem: o.maBoDem, phone: normPhone_(String(o.phone || '')) || o.phone, custName: o.custName, kenh: o.kenh, saleName: o.saleName, product: String(o.product || '').slice(0, 200),
        phanLoai: o.phanLoai, total: o.total, deposit: o.deposit, stage: o.stage, stageAt: o.stageAt, createdAt: o.createdAt, createdBy: o.createdBy,
        taskOpen: open[o.id] || 0, taskTotal: taskN[o.id] || 0, commentCount: cmtN[o.id] || 0 };
    });
    return jsonOut_({ ok: true, scope: sc.level, stages: KENH_STAGES_, phanLoai: KENH_PHAN_LOAI_, channels: channels.map(function (k) { return { name: k, count: counts[k] || 0 }; }),
      stageCount: stageCount, total: rows.length, truncated: rows.length > KENH_BOARD_LIMIT_, orders: cards });
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi doc don kenh: ' + (err && err.message || err) }); }
}
function _kenhTaskObj_(t) { var r = {}; KENH_TASK_HEADERS_.forEach(function (h) { r[h] = t[h]; }); r.id = String(t.id); r.orderId = String(t.orderId); return r; }
function _kenhCmtObj_(c) { return { id: String(c.id), at: c.at, by: c.by, byName: c.byName, kind: c.kind, text: c.text, attach: _kenhJsonArr_(c.attach) }; }
function kenhDoPost_(action, d) {
  try {
    var a = _khoAuth_(d); if (a.err) return a.err;
    return _khoWithLock_(function () {
      var user = a.user, who = _kenhWho_(user), now = new Date(), nowMs = now.getTime(), sc = _crmScopeFor_(user), all = _kenhLoadAll_();
      var findOrder = function (id) { return all.orders.rows.filter(function (x) { return x.id === String(id || ''); })[0]; };
      var nextCmt = function () { return _kenhNextId_(all.cmts.rows, 'id', 0); };
      var sys = function (orderId, text) { var id = nextCmt(); _kenhSysComment_(all.cmts.sh, orderId, who, text, nowMs, id); all.cmts.rows.push({ id: id }); };
      if (action === 'kenhSave') {
        var refKey = _crmStr_(d.refKey, 80);
        if (refKey) { var dup = all.orders.rows.filter(function (x) { return String(x.refKey) === refKey; })[0]; if (dup) return jsonOut_({ ok: true, duplicate: true, order: _kenhOrderObj_(dup) }); }
        var n = _kenhNormalize_(d.order, false); if (n.error) return jsonOut_({ ok: false, error: n.error });
        var o = n.v; o.id = _kenhNextId_(all.orders.rows, 'id', 100000); o.maBoDem = _kenhMaBoDem_(all.orders.rows, now); o.createdAt = nowMs; o.createdBy = who.username;
        o.stage = KENH_STAGES_[0]; o.stageAt = nowMs; o.stageBy = who.username; o.failReason = ''; o.updatedAt = nowMs; o.refKey = refKey;
        _kenhAppend_(all.orders.sh, KENH_ORDER_HEADERS_, o);
        _kenhAppend_(all.log.sh, KENH_LOG_HEADERS_, { orderId: o.id, stage: o.stage, enterAt: nowMs, leaveAt: '', by: who.username });
        sys(o.id, 'đã tạo đơn ' + o.maBoDem);
        return jsonOut_({ ok: true, duplicate: false, order: _kenhOrderObj_(o) });
      }
      var o2 = findOrder(d.id || (d.taskId ? (all.tasks.rows.filter(function (t) { return t.id === String(d.taskId); })[0] || {}).orderId : ''));
      if (!o2) return jsonOut_({ ok: false, error: 'Khong tim thay don.' });
      var acc = _kenhAccess_(user, sc, o2, all.tasks.rows); if (!acc.see) return jsonOut_({ ok: false, error: 'Khong co quyen voi don nay.', code: 'FORBIDDEN' });
      if (action === 'kenhComment') {
        var text = _crmStr_(d.text, 3000), att = Object.prototype.toString.call(d.attach) === '[object Array]' ? d.attach.slice(0, 10) : [];
        if (!text && !att.length) return jsonOut_({ ok: false, error: 'Binh luan trong.' });
        var cid = nextCmt(), c = { id: cid, orderId: o2.id, at: nowMs, by: who.username, byName: who.name, kind: 'user', text: text, attach: JSON.stringify(att.map(function (x) { return { name: _crmStr_(x && x.name, 200), url: _crmStr_(x && x.url, 500) }; })) };
        _kenhAppend_(all.cmts.sh, KENH_CMT_HEADERS_, c);
        return jsonOut_({ ok: true, comment: _kenhCmtObj_(c) });
      }
      if (action === 'kenhFollow') {
        if (!acc.edit) return jsonOut_({ ok: false, error: 'Khong co quyen sua don nay.', code: 'FORBIDDEN' });
        o2.followers = _kenhList_(Object.prototype.toString.call(d.followers) === '[object Array]' ? d.followers.join(',') : d.followers).join(', ').slice(0, 600); o2.updatedAt = nowMs;
        _kenhWrite_(all.orders.sh, KENH_ORDER_HEADERS_, o2); return jsonOut_({ ok: true, order: _kenhOrderObj_(o2) });
      }
      if (action === 'kenhUpdate') {
        if (!acc.edit) return jsonOut_({ ok: false, error: 'Khong co quyen sua don nay.', code: 'FORBIDDEN' });
        var patch = d.patch || {}, allow = {}; ['phone', 'kenh', 'saleName', 'product', 'phanLoai', 'deposit', 'total', 'diffExchange', 'custName', 'description', 'transferImages', 'attachments'].forEach(function (k) { if (patch[k] !== undefined) allow[k] = patch[k]; });
        var merged = _kenhOrderObj_(o2); Object.keys(allow).forEach(function (k) { merged[k] = allow[k]; });
        var nn = _kenhNormalize_({ phone: merged.phone, kenh: merged.kenh, saleName: merged.saleName, product: merged.product, phanLoai: merged.phanLoai, deposit: merged.deposit, total: merged.total }, false);
        if (nn.error) return jsonOut_({ ok: false, error: nn.error });
        var pn = _kenhNormalize_(allow, true); if (pn.error) return jsonOut_({ ok: false, error: pn.error });
        Object.keys(pn.v).forEach(function (k) { o2[k] = pn.v[k]; }); o2.updatedAt = nowMs;
        _kenhWrite_(all.orders.sh, KENH_ORDER_HEADERS_, o2);
        sys(o2.id, 'đã sửa thông tin đơn (' + Object.keys(pn.v).join(', ') + ')');
        return jsonOut_({ ok: true, order: _kenhOrderObj_(o2) });
      }
      if (action === 'kenhMove') {
        var to = String(d.stage || ''), from2 = String(o2.stage || KENH_STAGES_[0]), note = _crmStr_(d.note, 500);
        if (KENH_STAGES_.indexOf(to) < 0) return jsonOut_({ ok: false, error: 'Giai doan khong hop le.' });
        if (to === from2) return jsonOut_({ ok: true, unchanged: true, order: _kenhOrderObj_(o2) });
        if (!acc.edit) return jsonOut_({ ok: false, error: 'Khong co quyen chuyen giai doan don nay.', code: 'FORBIDDEN' });
        if (KENH_FINAL_[from2] && !_kenhIsAdmin_(user)) return jsonOut_({ ok: false, error: 'Don da ' + from2 + ', chi admin moi mo lai duoc.', code: 'FORBIDDEN' });
        if (to === 'Thất bại' && !note) return jsonOut_({ ok: false, error: 'Chuyen sang That bai phai ghi ly do.' });
        all.log.rows.forEach(function (l) { if (l.orderId === o2.id && !l.leaveAt) { l.leaveAt = nowMs; _kenhWrite_(all.log.sh, KENH_LOG_HEADERS_, l); } });
        _kenhAppend_(all.log.sh, KENH_LOG_HEADERS_, { orderId: o2.id, stage: to, enterAt: nowMs, leaveAt: '', by: who.username });
        o2.stage = to; o2.stageAt = nowMs; o2.stageBy = who.username; o2.updatedAt = nowMs; o2.failReason = to === 'Thất bại' ? note : '';
        _kenhWrite_(all.orders.sh, KENH_ORDER_HEADERS_, o2);
        sys(o2.id, 'chuyển giai đoạn: ' + from2 + ' → ' + to + (note ? ' — ' + note : ''));
        return jsonOut_({ ok: true, order: _kenhOrderObj_(o2) });
      }
      if (action === 'kenhTaskSave') {
        if (!acc.edit) return jsonOut_({ ok: false, error: 'Khong co quyen tao cong viec trong don nay.', code: 'FORBIDDEN' });
        var tk = d.task || {}, title = _crmStr_(tk.title, 200); if (!title) return jsonOut_({ ok: false, error: 'Cong viec chua co ten.' });
        if (all.tasks.rows.filter(function (t) { return t.orderId === o2.id; }).length >= KENH_MAX_TASKS_) return jsonOut_({ ok: false, error: 'Don co qua nhieu cong viec (toi da ' + KENH_MAX_TASKS_ + ').' });
        var asg = _crmStr_(tk.assignee, 80), asgName = '';
        if (asg) {
          var u = null; try { u = readUsers_(getCrmSS_().getSheetByName(SH_USER)).filter(function (x) { return String(x.username || '').toLowerCase() === asg.toLowerCase(); })[0]; } catch (eU) {}
          if (!u) return jsonOut_({ ok: false, error: 'Khong tim thay nguoi duoc giao (' + asg + ').' });
          asg = String(u.username); asgName = String(u.name || u.username);
        }
        var dueAt = tk.dueAt ? Number(tk.dueAt) || 0 : 0;
        var t2 = { id: _kenhNextId_(all.tasks.rows, 'id', 0), orderId: o2.id, title: title, assignee: asg, assigneeName: asgName, dept: _crmStr_(tk.dept, 80), dueAt: dueAt || '', note: _crmStr_(tk.note, 1000), status: 'open', createdAt: nowMs, createdBy: who.username, doneAt: '', doneBy: '', doneNote: '' };
        _kenhAppend_(all.tasks.sh, KENH_TASK_HEADERS_, t2);
        sys(o2.id, 'đã tạo công việc "' + title + '"' + (asgName ? ' giao cho ' + asgName : '') + (t2.dept ? ' (' + t2.dept + ')' : ''));
        return jsonOut_({ ok: true, task: _kenhTaskObj_(t2) });
      }
      if (action === 'kenhTaskDone') {
        var tt = all.tasks.rows.filter(function (t) { return t.id === String(d.taskId || ''); })[0];
        if (!tt) return jsonOut_({ ok: false, error: 'Khong tim thay cong viec.' });
        var meL = who.username.toLowerCase();
        if (!(_kenhIsAdmin_(user) || String(tt.assignee || '').toLowerCase() === meL || String(tt.createdBy || '').toLowerCase() === meL)) return jsonOut_({ ok: false, error: 'Chi nguoi duoc giao, nguoi tao viec hoac admin moi danh dau duoc.', code: 'FORBIDDEN' });
        var done = !(d.done === false || d.done === 'false' || d.done === 0);
        tt.status = done ? 'done' : 'open'; tt.doneAt = done ? nowMs : ''; tt.doneBy = done ? who.username : ''; tt.doneNote = done ? _crmStr_(d.note, 500) : '';
        _kenhWrite_(all.tasks.sh, KENH_TASK_HEADERS_, tt);
        sys(o2.id, (done ? 'đã hoàn thành' : 'mở lại') + ' công việc "' + tt.title + '"' + (done && tt.doneNote ? ' — ' + tt.doneNote : ''));
        return jsonOut_({ ok: true, task: _kenhTaskObj_(tt) });
      }
      return jsonOut_({ ok: false, error: 'Action khong hop le.' });
    });
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi don kenh: ' + (err && err.message || err) }); }
}

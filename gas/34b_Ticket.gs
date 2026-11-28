// ════════════════════════════════════════════════════════════════════════════════════════
//  TICKET: HẠN XỬ LÝ + HẠN TRẢ LỜI TIN (mục 11, docs/CRM-11-HANG-MUC-TRANG-THAI.md) — bước 11a: HÀM THUẦN, chưa có sheet/UI.
//  Quy tắc chốt (Duyên 2026-11-27): hạn ticket = lúc tạo + thời hạn theo loại (khiếu nại/hỗ trợ 24 giờ; đổi trả/đánh bóng 72 giờ;
//  bảo hành/kiểm định 7 ngày), tính GIỜ THỰC. Hạn trả lời tin: tin nhắn trong 08:00–17:00 → 30 phút; từ 17:00 trở đi (ca tối đến 21:00 vẫn trực
//  online) → 2 giờ tính từ lúc khách nhắn (giờ thực: 20:00 → 22:00). Cả tuần T2–CN. Trễ hạn → báo trưởng phòng bộ phận liên quan.
//  Giờ Việt Nam (UTC+7, không đổi giờ mùa hè). Mọi số cấu hình được (Settings 'ticketConfig'); chưa chốt NGƯỜI ĐƯỢC GIAO theo loại → để trống.
// ════════════════════════════════════════════════════════════════════════════════════════
var TICKET_SECTION_ = 1;
var TICKET_VN_OFFSET_MS_ = 7 * 3600000;
var TICKET_TYPES_ = { khieu_nai: 'Khiếu nại', ho_tro: 'Hỗ trợ', doi_tra: 'Đổi trả', danh_bong: 'Đánh bóng', bao_hanh: 'Bảo hành', kiem_dinh: 'Kiểm định' };
var TICKET_DEFAULT_ = {
  dueHours: { khieu_nai: 24, ho_tro: 24, doi_tra: 72, danh_bong: 72, bao_hanh: 168, kiem_dinh: 168 },
  officeStart: '08:00', officeEnd: '17:00', inHoursMinutes: 30, offHoursMinutes: 120,
  officeDays: [0, 1, 2, 3, 4, 5, 6],   // 0 = Chủ nhật … 6 = Thứ bảy (docx: Thứ Hai đến Chủ nhật)
  owners: {}                            // loại → [tên/chức danh được giao + trưởng phòng được báo khi trễ] — CHƯA chốt, Duyên điền
};
function _ticketHm_(v, dflt) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '').trim()); if (!m || +m[1] > 24 || +m[2] > 59) return dflt; return String(m[1]).padStart(2, '0') + ':' + m[2]; }
function _ticketMin_(hm) { var p = hm.split(':'); return (+p[0]) * 60 + (+p[1]); }
// raw = object hoặc chuỗi JSON; trường sai/thiếu → mặc định từng trường (không ném lỗi).
function _ticketCfgNormalize_(raw) {
  var o = raw; if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  o = (o && typeof o === 'object') ? o : {};
  var d = TICKET_DEFAULT_, out = { dueHours: {}, owners: {} };
  Object.keys(d.dueHours).forEach(function (k) { var h = Number((o.dueHours || {})[k]); out.dueHours[k] = (isFinite(h) && h > 0) ? h : d.dueHours[k]; });
  out.officeStart = _ticketHm_(o.officeStart, d.officeStart); out.officeEnd = _ticketHm_(o.officeEnd, d.officeEnd);
  if (_ticketMin_(out.officeEnd) <= _ticketMin_(out.officeStart)) { out.officeStart = d.officeStart; out.officeEnd = d.officeEnd; }
  var im = Number(o.inHoursMinutes), om = Number(o.offHoursMinutes);
  out.inHoursMinutes = (isFinite(im) && im > 0) ? im : d.inHoursMinutes; out.offHoursMinutes = (isFinite(om) && om > 0) ? om : d.offHoursMinutes;
  var days = Array.isArray(o.officeDays) ? o.officeDays.map(Number).filter(function (x) { return x >= 0 && x <= 6 && x === Math.floor(x); }) : [];
  out.officeDays = days.length ? days : d.officeDays.slice();
  Object.keys(o.owners || {}).forEach(function (k) { if (Array.isArray(o.owners[k])) out.owners[k] = o.owners[k].map(String).filter(Boolean); });
  return out;
}
// Hạn xử lý ticket (ms) = lúc tạo + thời hạn của loại (giờ thực). Loại lạ/ngày lỗi → null.
function _ticketDueMs_(createdMs, type, cfg) {
  cfg = _ticketCfgNormalize_(cfg); var t = Number(createdMs), h = cfg.dueHours[String(type || '')];
  return (isFinite(t) && t > 0 && h) ? t + h * 3600000 : null;
}
// Tin nhắn lúc msgMs có nằm trong giờ làm việc (giờ VN, đúng ngày làm việc) không.
function _ticketInOfficeHours_(msgMs, cfg) {
  cfg = _ticketCfgNormalize_(cfg); var d = new Date(Number(msgMs) + TICKET_VN_OFFSET_MS_);
  var mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return cfg.officeDays.indexOf(d.getUTCDay()) >= 0 && mins >= _ticketMin_(cfg.officeStart) && mins < _ticketMin_(cfg.officeEnd);
}
// Hạn trả lời tin (ms): trong giờ → +30 phút; ngoài giờ (từ 17:00, trước 08:00, hoặc ngày không làm việc) → +2 giờ, đều tính từ lúc khách nhắn.
function _ticketReplyDueMs_(msgMs, cfg) {
  cfg = _ticketCfgNormalize_(cfg); var t = Number(msgMs); if (!isFinite(t) || t <= 0) return null;
  return t + (_ticketInOfficeHours_(t, cfg) ? cfg.inHoursMinutes : cfg.offHoursMinutes) * 60000;
}
// Trạng thái so với hạn: doneMs (lúc xử lý xong/đã trả lời) hoặc 0 nếu chưa. Trễ → needEscalate = cần báo trưởng phòng.
function _ticketStatus_(dueMs, nowMs, doneMs) {
  if (!dueMs) return { state: 'unknown', overdueMinutes: 0, remainingMinutes: 0, needEscalate: false };
  var end = Number(doneMs) > 0 ? Number(doneMs) : Number(nowMs), diff = Math.round((end - dueMs) / 60000);
  if (Number(doneMs) > 0) return { state: diff > 0 ? 'done_late' : 'done_ontime', overdueMinutes: Math.max(0, diff), remainingMinutes: 0, needEscalate: false };
  return diff > 0 ? { state: 'overdue', overdueMinutes: diff, remainingMinutes: 0, needEscalate: true } : { state: 'open', overdueMinutes: 0, remainingMinutes: -diff, needEscalate: false };
}
// Người được giao/được báo khi trễ theo loại (cấu hình; chưa chốt → []).
function _ticketOwners_(type, cfg) { return (_ticketCfgNormalize_(cfg).owners[String(type || '')] || []).slice(); }

// ── Bước 11b: SỔ TICKET (sheet Ticket) + action ticketList / ticketSave / ticketDone (token). ──
//  Ai tạo: mọi tài khoản đăng nhập. Người được giao: cấu hình Settings 'ticketConfig'.owners[loại][0] (CHƯA chốt → rỗng thì giao cho CHÍNH người tạo);
//  owners[loại] (toàn bộ danh sách) = người được BÁO khi trễ (`escalateTo`). Ai xem: admin/manager/leader thấy tất cả; người khác chỉ ticket mình tạo hoặc được giao.
//  Ai đóng (ticketDone): quản lý, người tạo hoặc người được giao. Hạn = _ticketDueMs_ (giờ thực theo loại); trạng thái = _ticketStatus_.
var SH_TICKET_ = 'Ticket';
var TICKET_HEADERS_ = ['id', 'type', 'status', 'createdAt', 'createdBy', 'phone', 'custName', 'title', 'note', 'assignee', 'dueAt', 'doneAt', 'doneBy', 'doneNote', 'updatedAt'];
var TICKET_GET_ACTIONS_ = { ticketList: 1 };
var TICKET_POST_ACTIONS_ = { ticketSave: 1, ticketDone: 1 };
function _ticketIsMgr_(user) { var r = String(user && user.role || '').trim().toLowerCase(); return r === 'admin' || r === 'manager' || r === 'leader'; }
function _ticketRowToObj_(r, cfg, nowMs) {
  var o = { id: String(r[0]), type: String(r[1]), status: String(r[2] || 'open'), createdAt: Number(r[3]) || 0, createdBy: String(r[4] || ''), phone: String(r[5] || ''), custName: String(r[6] || ''),
    title: String(r[7] || ''), note: String(r[8] || ''), assignee: String(r[9] || ''), dueAt: Number(r[10]) || 0, doneAt: Number(r[11]) || 0, doneBy: String(r[12] || ''), doneNote: String(r[13] || '') };
  o.typeLabel = TICKET_TYPES_[o.type] || o.type;
  o.sla = _ticketStatus_(o.dueAt, nowMs, o.status === 'done' ? (o.doneAt || nowMs) : 0);
  o.escalateTo = o.sla.needEscalate ? _ticketOwners_(o.type, cfg) : [];
  return o;
}
function _ticketReadAll_(cfg, nowMs) {
  var sh = getSheet_(SH_TICKET_, TICKET_HEADERS_), last = sh.getLastRow();
  return last < 2 ? [] : sh.getRange(2, 1, last - 1, TICKET_HEADERS_.length).getValues().map(function (r) { return _ticketRowToObj_(r, cfg, nowMs); });
}
function _ticketWriteRow_(rowIdx, o) {
  var sh = getSheet_(SH_TICKET_, TICKET_HEADERS_), rng = sh.getRange(rowIdx || sh.getLastRow() + 1, 1, 1, TICKET_HEADERS_.length);
  if (rng.setNumberFormat) rng.setNumberFormat('@');
  rng.setValues([[o.id, o.type, o.status, o.createdAt, o.createdBy, o.phone, o.custName, o.title, o.note, o.assignee, o.dueAt || '', o.doneAt || '', o.doneBy || '', o.doneNote || '', new Date().toISOString()]]);
}
function _ticketVisible_(t, user) {
  if (_ticketIsMgr_(user)) return true;
  var mine = _kpiMyNames_(user).map(_kpiFold_);
  return mine.indexOf(_kpiFold_(t.createdBy)) >= 0 || mine.indexOf(_kpiFold_(t.assignee)) >= 0;
}
function ticketDoGet_(action, p) {
  try {
    var a = _khoAuth_(p); if (a.err) return a.err;
    var cfg = _ticketCfgNormalize_(getSetting_('ticketConfig')), now = Date.now(), want = String((p && p.status) || ''), ph = normPhone_(String((p && p.phone) || ''));
    var rows = _ticketReadAll_(cfg, now).filter(function (t) { return _ticketVisible_(t, a.user) && (!want || t.status === want) && (!ph || normPhone_(t.phone) === ph); });
    rows.sort(function (x, y) { return (x.status === y.status ? 0 : (x.status === 'open' ? -1 : 1)) || x.dueAt - y.dueAt; });
    return jsonOut_({ ok: true, canManage: _ticketIsMgr_(a.user), myNames: _kpiMyNames_(a.user), types: TICKET_TYPES_, overdue: rows.filter(function (t) { return t.sla.state === 'overdue'; }).length, rows: rows.slice(0, 500) });
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi doc ticket: ' + (err && err.message || err) }); }
}
function ticketDoPost_(action, d) {
  try {
    var a = _khoAuth_(d); if (a.err) return a.err;
    return _khoWithLock_(function () {
      var cfg = _ticketCfgNormalize_(getSetting_('ticketConfig')), now = Date.now(), who = _kpiMyNames_(a.user)[0] || '';
      if (action === 'ticketSave') {
        var type = String(d.type || '').trim(), title = String(d.title || '').replace(/\s+/g, ' ').trim().slice(0, 160);
        if (!TICKET_TYPES_[type]) return jsonOut_({ ok: false, error: 'Loai ticket khong hop le', code: 'TYPE' });
        if (!title) return jsonOut_({ ok: false, error: 'Thieu tieu de ticket', code: 'TITLE' });
        var owners = _ticketOwners_(type, cfg), asked = String(d.assignee || '').trim().slice(0, 80);
        var o = { id: 'TK' + Utilities.formatDate(new Date(now), 'GMT+7', 'yyMMddHHmmss') + String(Math.floor(Math.random() * 90 + 10)), type: type, status: 'open', createdAt: now, createdBy: who,
          phone: normPhone_(String(d.phone || '')), custName: String(d.custName || '').trim().slice(0, 80), title: title, note: String(d.note || '').slice(0, 1000),
          assignee: (_ticketIsMgr_(a.user) && asked) ? asked : (owners[0] || who), dueAt: _ticketDueMs_(now, type, cfg) || 0 };
        _ticketWriteRow_(0, o);
        _loyaltyAudit_(who, 'ticket:create', o.id, '', type + '|' + o.assignee);
        return jsonOut_({ ok: true, ticket: _ticketRowToObj_([o.id, o.type, o.status, o.createdAt, o.createdBy, o.phone, o.custName, o.title, o.note, o.assignee, o.dueAt, '', '', ''], cfg, now) });
      }
      var id = String(d.id || '').trim(), sh = getSheet_(SH_TICKET_, TICKET_HEADERS_), last = sh.getLastRow(), vals = last < 2 ? [] : sh.getRange(2, 1, last - 1, TICKET_HEADERS_.length).getValues(), idx = -1;
      for (var i = 0; i < vals.length; i++) if (String(vals[i][0]) === id) { idx = i; break; }
      if (idx < 0) return jsonOut_({ ok: false, error: 'Khong tim thay ticket', code: 'NOTFOUND' });
      var t = _ticketRowToObj_(vals[idx], cfg, now);
      if (t.status === 'done') return jsonOut_({ ok: false, error: 'Ticket da dong', code: 'DONE' });
      var mine = _kpiMyNames_(a.user).map(_kpiFold_);
      if (!_ticketIsMgr_(a.user) && mine.indexOf(_kpiFold_(t.createdBy)) < 0 && mine.indexOf(_kpiFold_(t.assignee)) < 0) return jsonOut_({ ok: false, error: 'Khong co quyen dong ticket nay', code: 'FORBIDDEN' });
      t.status = 'done'; t.doneAt = now; t.doneBy = who; t.doneNote = String(d.note || '').slice(0, 500);
      _ticketWriteRow_(idx + 2, t);
      _loyaltyAudit_(who, 'ticket:done', t.id, 'open', 'done' + (t.dueAt && now > t.dueAt ? ' (tre)' : ''));
      return jsonOut_({ ok: true, ticket: _ticketRowToObj_([t.id, t.type, t.status, t.createdAt, t.createdBy, t.phone, t.custName, t.title, t.note, t.assignee, t.dueAt, t.doneAt, t.doneBy, t.doneNote], cfg, now) });
    });
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi ticket: ' + (err && err.message || err) }); }
}


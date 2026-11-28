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


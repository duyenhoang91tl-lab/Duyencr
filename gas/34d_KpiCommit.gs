// ════════════════════════════════════════════════════════════════════════════════════════
//  KPI TỰ CAM KẾT (mục 8, docs/CRM-11-HANG-MUC-TRANG-THAI.md) — bước 8b-1: HÀM THUẦN, chưa có sheet/UI, chưa nối báo cáo KPI.
//  Duyên chốt (27/11): CS TỰ cam kết. File Word đề xuất thêm bước quản lý duyệt → để CẤU HÌNH (requireApproval, mặc định BẬT): tắt thì cam kết có hiệu lực ngay.
//  Cam kết theo THÁNG, là mục tiêu "Commit" song song KPI theo bậc (cột Commit / %HT Commit trong buildSaleKpiReport_; hiện lấy từ cfg.overrides = commit riêng
//  cố định do admin đặt). Cam kết ĐÃ DUYỆT của tháng đó được ưu tiên hơn commit riêng cố định (commitPriority 'commitment'); đổi 'override' để ngược lại.
//  Mọi thay đổi ghi nhật ký: ai, lúc nào, giá trị cũ → mới. Quản lý = vai trò trong approverRoles (mặc định admin, leader).
// ════════════════════════════════════════════════════════════════════════════════════════
var KPICOMMIT_SECTION_ = 1;
var KPICOMMIT_DEFAULT_ = { requireApproval: true, allowSelfApprove: false, maxAmount: 20000000000, approverRoles: ['admin', 'leader'], commitPriority: 'commitment' };
function _kpiCommitCfgNormalize_(raw) {
  var o = raw; if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  o = (o && typeof o === 'object') ? o : {}; var d = KPICOMMIT_DEFAULT_, mx = Number(o.maxAmount);
  var roles = Array.isArray(o.approverRoles) ? o.approverRoles.map(function (r) { return String(r).trim().toLowerCase(); }).filter(Boolean) : [];
  return { requireApproval: o.requireApproval === false ? false : true, allowSelfApprove: o.allowSelfApprove === true,
           maxAmount: (isFinite(mx) && mx > 0) ? mx : d.maxAmount, approverRoles: roles.length ? roles : d.approverRoles.slice(),
           commitPriority: o.commitPriority === 'override' ? 'override' : 'commitment' };
}
function _kpiFold_(s) { return String(s == null ? '' : s).toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
function _kpiPeriodOf_(ymd) { var m = /^(\d{4})-(\d{2})-\d{2}/.exec(String(ymd || '')); return m ? m[1] + '-' + m[2] : ''; }
function _kpiCommitKey_(period, sale) { return String(period) + '|' + _kpiFold_(sale); }
function _kpiIsApprover_(role, cfg) { return cfg.approverRoles.indexOf(String(role || '').trim().toLowerCase()) >= 0; }
function _kpiNewRec_(period, sale) { return { key: _kpiCommitKey_(period, sale), period: period, sale: String(sale || '').trim(), amount: 0, approvedAmount: null, status: 'none', history: [] }; }
function _kpiLog_(rec, at, by, action, oldAmt, oldSt, note) {
  rec.history = (rec.history || []).concat([{ at: at, by: by, action: action, old: { amount: oldAmt, status: oldSt }, new: { amount: rec.amount, status: rec.status }, note: note || '' }]).slice(-50);
}
// Gửi / sửa cam kết. args: {period:'YYYY-MM', sale, amount, by, role, nowMs, todayYmd}. rec = bản ghi cũ (hoặc null).
//  • Sale chỉ gửi cho CHÍNH MÌNH và chỉ cho tháng hiện tại hoặc tháng sau; quản lý nhập hộ / sửa tháng cũ → có hiệu lực ngay (action 'set').
//  • requireApproval bật: sale gửi → 'pending' (cam kết đã duyệt trước đó VẪN hiệu lực tới khi duyệt bản mới).
function _kpiCommitSubmit_(rec, args, cfg) {
  cfg = _kpiCommitCfgNormalize_(cfg); args = args || {};
  var period = String(args.period || ''), sale = String(args.sale || '').trim(), by = String(args.by || '').trim(), amt = Math.round(Number(args.amount));
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return { error: 'Ky khong hop le (YYYY-MM).' };
  if (!sale || !by) return { error: 'Thieu ten sale hoac nguoi gui.' };
  if (!isFinite(amt) || amt <= 0) return { error: 'Muc tieu cam ket phai la so lon hon 0.' };
  if (amt > cfg.maxAmount) return { error: 'Muc tieu vuot gioi han cho phep (' + cfg.maxAmount + 'd).' };
  var mgr = _kpiIsApprover_(args.role, cfg), self = _kpiFold_(by) === _kpiFold_(sale);
  if (!self && !mgr) return { error: 'Chi duoc cam ket cho chinh minh.', code: 'FORBIDDEN' };
  var cur = _kpiPeriodOf_(args.todayYmd), nextP = (function () { var m = /^(\d{4})-(\d{2})$/.exec(cur); if (!m) return ''; var y = +m[1], mo = +m[2] + 1; if (mo > 12) { mo = 1; y++; } return y + '-' + String(mo).padStart(2, '0'); })();
  if (!mgr && cur && period !== cur && period !== nextP) return { error: 'Chi duoc cam ket cho thang nay hoac thang sau.', code: 'PERIOD' };
  var r = JSON.parse(JSON.stringify(rec || _kpiNewRec_(period, sale))), oldA = r.amount, oldS = r.status, at = Number(args.nowMs) || 0;
  if (oldA === amt && (oldS === 'pending' || oldS === 'approved')) return { error: 'Cam ket khong doi.', code: 'NOCHANGE' };
  r.amount = amt; r.submittedBy = by; r.submittedAt = at;
  if (!cfg.requireApproval || (mgr && !self)) { r.status = 'approved'; r.approvedAmount = amt; r.decidedBy = by; r.decidedAt = at; _kpiLog_(r, at, by, self ? 'submit' : 'set', oldA, oldS); }
  else { r.status = 'pending'; _kpiLog_(r, at, by, 'submit', oldA, oldS); }
  return { ok: true, rec: r };
}
// Duyệt / từ chối bản đang chờ. args: {decision:'approve'|'reject', by, role, nowMs, note}. Không tự duyệt cam kết của chính mình (trừ khi cấu hình cho phép).
function _kpiCommitDecide_(rec, args, cfg) {
  cfg = _kpiCommitCfgNormalize_(cfg); args = args || {};
  if (!rec || rec.status !== 'pending') return { error: 'Khong co cam ket nao dang cho duyet.', code: 'NOTPENDING' };
  if (!_kpiIsApprover_(args.role, cfg)) return { error: 'Chi quan ly moi duoc duyet cam ket.', code: 'FORBIDDEN' };
  var by = String(args.by || '').trim(); if (!by) return { error: 'Thieu nguoi duyet.' };
  if (!cfg.allowSelfApprove && _kpiFold_(by) === _kpiFold_(rec.sale)) return { error: 'Khong tu duyet cam ket cua chinh minh.', code: 'SELF' };
  var d = args.decision; if (d !== 'approve' && d !== 'reject') return { error: 'Quyet dinh khong hop le.' };
  var r = JSON.parse(JSON.stringify(rec)), oldA = r.amount, oldS = r.status, at = Number(args.nowMs) || 0;
  if (d === 'approve') { r.status = 'approved'; r.approvedAmount = r.amount; } else r.status = 'rejected';
  r.decidedBy = by; r.decidedAt = at; _kpiLog_(r, at, by, d, oldA, oldS, args.note);
  return { ok: true, rec: r };
}
// Mục tiêu Commit hiệu lực của 1 sale trong 1 tháng: cam kết ĐÃ DUYỆT của tháng đó và commit riêng cố định (cfg.overrides) — cái nào ưu tiên theo commitPriority.
function _kpiCommitEffective_(rec, overrideValue, cfg) {
  cfg = _kpiCommitCfgNormalize_(cfg);
  var ap = (rec && Number(rec.approvedAmount) > 0) ? Number(rec.approvedAmount) : 0, ov = Number(overrideValue) > 0 ? Number(overrideValue) : 0;
  var pend = (rec && rec.status === 'pending') ? Number(rec.amount) : 0, first = cfg.commitPriority === 'override' ? ['override', ov] : ['commitment', ap], second = cfg.commitPriority === 'override' ? ['commitment', ap] : ['override', ov];
  var pick = first[1] > 0 ? first : (second[1] > 0 ? second : null);
  return { commit: pick ? pick[1] : null, source: pick ? pick[0] : null, pendingAmount: pend > 0 ? pend : 0 };
}


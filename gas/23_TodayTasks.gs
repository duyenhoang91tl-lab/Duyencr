// ═══════════════════════════════════════════════════════════════
//  NHAC VIEC HOM NAY cho CS (yeu cau Duyen 2026-10-11) — buoc 1: DON KET O 1 GIAI DOAN BASE QUA 24 GIO.
//  Quy trinh Base: Tiep nhan don -> Tao don POS -> Phan loai don -> Phong san xuat -> Kho thanh pham -> Dong hang.
//  NGUYEN NHAN GOC can sheet theo doi rieng: "DT TỔNG " chi co giai doan HIEN TAI (cot G), KHONG co gio vao giai doan
//  (man hinh Base co, sheet thi khong) -> cu moi gio ttTrackStages_ chup lai giai doan tung don vao sheet
//  "Theo dõi giai đoạn Base"; giai doan doi thi dat lai gio vao. Don moi o giai doan dau lay ngay tao don; don lan dau
//  thay o giai doan giua thi tinh tu luc thay (co the NON hon thuc te toi da 1 chu ky, den khi chuyen giai doan tiep).
//  Cai dat (sheet Settings): ttStageHours (mac dinh 24), ttSkipStages (mac dinh "Dong hang", cach nhau dau |).
//  Chay trong Apps Script Editor: ttChayNgay (chup ngay 1 lan), ttCaiTrigger (hen gio moi gio).
// ═══════════════════════════════════════════════════════════════
var TT_TRACK_SHEET_ = 'Theo dõi giai đoạn Base';
var TT_TRACK_HEADERS_ = ['id', 'giaiDoan', 'giaiDoanTu', 'lanCuoiThay', 'saleBan', 'ngayTao'];
var TT_DEFAULT_HOURS_ = 24;
var TT_LOOKBACK_DAYS_ = 60;
var TT_REFRESH_MIN_ = 60;
// Theo doi DON KET (yeu cau Duyen 2026-10-14): CS PHU TRACH (sale cua don) hoac admin tich Da xem / Dang xu ly / Da xu ly xong + ghi chu; moi nguoi cung thay ai dang lo.
// Luu o sheet rieng (khong dung Settings vi la du lieu cap don, co lich su). Hieu luc theo GIAI DOAN luc danh dau: don sang giai doan khac roi lai ket -> bat dau lai.
var TT_FOLLOW_SHEET_ = 'Theo dõi đơn kẹt';
var TT_FOLLOW_HEADERS_ = ['id', 'giaiDoan', 'trangThai', 'nguoi', 'luc', 'ghiChu', 'lichSu'];
var TT_FOLLOW_VALID_ = { xem: 1, xuly: 1, xong: 1, bo: 1 };

function _ttFold_(s) { return _stripVN_(String(s == null ? '' : s)).trim(); }

// "dd/MM/yyyy[ HH:mm]" (gio VN) -> ms; 0 neu khong doc duoc.
function _ttParseVn_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? 0 : v.getTime();
  var m = String(v == null ? '' : v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return 0;
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)) - 7 * 3600000;
}

function _ttSkipSet_() {
  var raw = getSetting_('ttSkipStages');
  var list = String(raw == null || raw === '' ? 'Đóng hàng' : raw).split('|');
  var set = {};
  list.forEach(function(x) { var k = _ttFold_(x); if (k) set[k] = true; });
  return set;
}

// orders: ket qua readDTTong_(); prevRows: cac dong sheet theo doi cu; nowMs. Tra ve mang dong moi (khong ghi sheet).
function _ttBuildRows_(orders, prevRows, nowMs, skip) {
  var prev = {};
  prevRows.forEach(function(r) { if (r[0] !== '' && r[0] != null) prev[String(r[0])] = r; });
  var cutoff = nowMs - TT_LOOKBACK_DAYS_ * 86400000, out = [], seen = {};
  orders.forEach(function(o) {
    var id = String(o.id == null ? '' : o.id).trim();
    var stage = String(o.giaiDoan == null ? '' : o.giaiDoan).trim();
    if (!id || !stage || seen[id]) return;
    seen[id] = true;
    var created = _ttParseVn_(o.ngayTao);
    if (created && created < cutoff) return;
    if (_isExcludedOrderStatus_(o.trangThai)) return;   // chi loai trang thai 'Thất bại' (EXCLUDED_ORDER_STATUSES_ — nguon duy nhat); don huy/hoan KHAC 'Thất bại' van duoc theo doi
    if (skip[_ttFold_(stage)]) return;           // da toi giai doan cuoi (Dong hang) -> khong nhac nua
    var p = prev[id], since;
    if (p && _ttFold_(p[1]) === _ttFold_(stage)) { since = _ttParseVn_(p[2]) || (p[2] && p[2].getTime ? p[2].getTime() : 0) || nowMs; }
    else if (!p && created && _ttFold_(stage).indexOf('tiep nhan') === 0) since = created;
    else since = nowMs;
    out.push([id, stage, new Date(since), new Date(nowMs), String(o.saleBan || ''), String(o.ngayTao || '')]);
  });
  return out;
}

function ttTrackStages_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, skipped: 'lock' };
  try {
    var nowMs = Date.now();
    var sh = getSheet_(TT_TRACK_SHEET_, TT_TRACK_HEADERS_);
    var last = sh.getLastRow();
    var old = last >= 2 ? sh.getRange(2, 1, last - 1, TT_TRACK_HEADERS_.length).getValues() : [];
    var rows = _ttBuildRows_(readDTTong_(), old, nowMs, _ttSkipSet_());
    if (last >= 2) sh.getRange(2, 1, last - 1, TT_TRACK_HEADERS_.length).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, TT_TRACK_HEADERS_.length).setValues(rows);
    setSetting_('ttLastTrackedMs', String(nowMs));
    return { ok: true, tracked: rows.length };
  } finally { lock.releaseLock(); }
}

// Cho Apps Script Editor
function ttChayNgay() { var r = ttTrackStages_(); Logger.log(JSON.stringify(r)); return r; }
function ttCaiTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) { if (t.getHandlerFunction() === 'ttTrackStages_') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('ttTrackStages_').timeBased().everyHours(1).create();
  Logger.log('Da hen gio: ttTrackStages_ moi 1 gio');
}

// rows: dong sheet theo doi; namesCsv: ten sale cua CS cach nhau '|' (rong = tat ca, dung cho admin).
function _ttStuckFromRows_(rows, namesCsv, hours, nowMs) {
  var want = {}, hasWant = false;
  String(namesCsv || '').split('|').forEach(function(x) { var k = _normTxt_(x); if (k) { want[k] = true; hasWant = true; } });
  var items = [];
  rows.forEach(function(r) {
    if (r[0] === '' || r[0] == null) return;
    var since = r[2] && r[2].getTime ? r[2].getTime() : _ttParseVn_(r[2]);
    if (!since) return;
    var h = (nowMs - since) / 3600000;
    if (h < hours) return;
    if (hasWant) {
      var toks = String(r[4] || '').split(',').map(_normTxt_);
      if (!toks.some(function(t) { return want[t]; })) return;
    }
    items.push({ id: String(r[0]), stage: String(r[1]), hours: Math.floor(h), sale: String(r[4] || ''), ngayTao: String(r[5] || '') });
  });
  items.sort(function(a, b) { return b.hours - a.hours; });
  return items;
}

function ttTodayTasks_(namesCsv) {
  var hours = parseFloat(getSetting_('ttStageHours')) || TT_DEFAULT_HOURS_;
  var nowMs = Date.now();
  var lastMs = Number(getSetting_('ttLastTrackedMs')) || 0;
  if (nowMs - lastMs > TT_REFRESH_MIN_ * 60000) { try { ttTrackStages_(); } catch (e) { Logger.log('ttTrackStages_: ' + e); } }
  var sh = getSheet_(TT_TRACK_SHEET_, TT_TRACK_HEADERS_);
  var last = sh.getLastRow();
  var rows = last >= 2 ? sh.getRange(2, 1, last - 1, TT_TRACK_HEADERS_.length).getValues() : [];
  var stuck = _ttStuckFromRows_(rows, namesCsv, hours, nowMs);
  var shown = _ttEnrichStuck_(stuck.slice(0, 100));   // them SDT/san pham/gia tri/nguoi xu ly + trang thai theo doi
  return { ok: true, generatedAt: nowMs, trackedAt: Number(getSetting_('ttLastTrackedMs')) || 0, hours: hours,
    tasks: [{ key: 'stuckStage', title: 'Đơn Base kẹt giai đoạn quá ' + hours + ' giờ — vào kiểm tra', count: stuck.length, items: shown }] };
}

function _ttFollowRead_() {
  var out = {};
  try {
    var sh = getSheet_(TT_FOLLOW_SHEET_, TT_FOLLOW_HEADERS_), last = sh.getLastRow();
    if (last < 2) return out;
    sh.getRange(2, 1, last - 1, TT_FOLLOW_HEADERS_.length).getValues().forEach(function(r) {
      var id = String(r[0] == null ? '' : r[0]).trim();
      if (!id) return;
      var h = [];
      try { h = JSON.parse(String(r[6] || '[]')) || []; } catch (e) { h = []; }
      out[id] = { stage: String(r[1] || ''), status: String(r[2] || ''), by: String(r[3] || ''), at: Number(r[4]) || 0, note: String(r[5] || ''), history: Array.isArray(h) ? h : [] };
    });
  } catch (e) { Logger.log('_ttFollowRead_: ' + e); }
  return out;
}
// Thong tin don (SDT, san pham, gia tri, nguoi xu ly, ma bo dem) cho cac id dang ket — doc DT TONG (da cache) 1 lan.
function _ttOrderInfo_(idSet) {
  var out = {};
  readDTTong_(true).forEach(function(o) {
    var id = String(o.id == null ? '' : o.id).trim();
    if (!id || !idSet[id] || out[id]) return;
    out[id] = { phone: String(o.phone || ''), sanPham: String(o.sanPham == null ? '' : o.sanPham).trim().slice(0, 160), value: Number(o.giaTriDon) || 0,
      giaoCho: String(o.giaoCho == null ? '' : o.giaoCho).trim(), maBoDem: String(o.maBoDem == null ? '' : o.maBoDem).trim(), kenhBan: String(o.kenhBan || ''), trangThai: String(o.trangThai == null ? '' : o.trangThai).trim() };
  });
  return out;
}
// Loi lam giau KHONG lam hong danh sach don ket (van tra cac truong goc id/giai doan/gio/sale).
function _ttEnrichStuck_(items) {
  if (!items.length) return items;
  var ids = {};
  items.forEach(function(it) { ids[it.id] = true; });
  var info = {}, fol = {};
  try { info = _ttOrderInfo_(ids); } catch (e) { Logger.log('_ttOrderInfo_: ' + e); }
  fol = _ttFollowRead_();
  items.forEach(function(it) {
    var i = info[it.id];
    if (i) { it.phone = i.phone; it.sanPham = i.sanPham; it.value = i.value; it.giaoCho = i.giaoCho; it.maBoDem = i.maBoDem; it.kenhBan = i.kenhBan; it.trangThai = i.trangThai; }
    var f = fol[it.id];
    it.follow = (f && f.status && _ttFold_(f.stage) === _ttFold_(it.stage)) ? { status: f.status, by: f.by, at: f.at, note: f.note, history: f.history.slice(-8) } : null;
  });
  return items;
}
// POST action=stuckFollowSet { id, status:'xem'|'xuly'|'xong'|'bo', note, by?, token } — chi CS PHU TRACH (ten trong cot "Sale ban" cua don) hoac admin.
// Nguoi thao tac lay tu PHIEN DANG NHAP (token) — khong tin ten client gui khi co token; khong co token (extension cu) moi dung data.by.
function ttFollowSet_(data) {
  data = data || {};
  var id = String(data.id == null ? '' : data.id).trim(), st = String(data.status || '').trim();
  if (!id) return { ok: false, error: 'Thieu ma don.' };
  if (!TT_FOLLOW_VALID_[st]) return { ok: false, error: "Trang thai phai la 'xem' | 'xuly' | 'xong' | 'bo'." };
  var note = String(data.note == null ? '' : data.note).replace(/\s+/g, ' ').trim().slice(0, 300);
  var user = null;
  try { user = data.token ? _sessUser_(data.token) : null; } catch (eU) { user = null; }
  var actor = user ? String(user.name || user.username || '').trim() : String(data.by || '').trim();
  if (!actor) return { ok: false, error: 'Khong xac dinh duoc nguoi thao tac — dang nhap lai.' };
  var tsh = getSheet_(TT_TRACK_SHEET_, TT_TRACK_HEADERS_), tl = tsh.getLastRow(), trow = null;
  if (tl >= 2) {
    var tv = tsh.getRange(2, 1, tl - 1, TT_TRACK_HEADERS_.length).getValues();
    for (var i = 0; i < tv.length; i++) { if (String(tv[i][0] == null ? '' : tv[i][0]).trim() === id) { trow = tv[i]; break; } }
  }
  if (!trow) return { ok: false, error: 'Khong thay don ' + id + ' trong danh sach theo doi giai doan.' };
  var names = user ? ((user.names && user.names.length) ? user.names : [user.name]) : [actor];
  var toks = String(trow[4] || '').split(',').map(_normTxt_).filter(Boolean);
  var mine = names.some(function(n) { var k = _normTxt_(n); return !!k && toks.indexOf(k) !== -1; });
  var isAdmin = !!(user && user.role === 'admin');
  if (!isAdmin && !mine) return { ok: false, code: 'FORBIDDEN', error: 'Chi CS phu trach don nay (hoac quan tri) moi duoc danh dau theo doi.' };
  var lock = LockService.getScriptLock(), got = false;
  try { got = lock.tryLock(8000); } catch (eL) { got = false; }
  if (!got) return { ok: false, error: 'He thong dang ban — thu lai sau it giay.' };
  try {
    var sh = getSheet_(TT_FOLLOW_SHEET_, TT_FOLLOW_HEADERS_), last = sh.getLastRow(), rowNum = 0, hist = [];
    if (last >= 2) {
      var col = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var k = 0; k < col.length; k++) { if (String(col[k][0] == null ? '' : col[k][0]).trim() === id) { rowNum = k + 2; break; } }
    }
    if (rowNum) { try { hist = JSON.parse(String(sh.getRange(rowNum, 7).getValue() || '[]')) || []; } catch (eH) { hist = []; } }
    var now = Date.now(), stage = String(trow[1] || '');
    hist.push({ s: st, by: actor, at: now, note: note, stage: stage });
    hist = hist.slice(-30);
    var vals = [id, stage, st === 'bo' ? '' : st, actor, now, note, JSON.stringify(hist)];
    if (rowNum) sh.getRange(rowNum, 1, 1, vals.length).setValues([vals]); else sh.getRange(last + 1, 1, 1, vals.length).setValues([vals]);
    return { ok: true, follow: st === 'bo' ? null : { status: st, by: actor, at: now, note: note, history: hist.slice(-8) } };
  } finally { try { lock.releaseLock(); } catch (eR) {} }
}

// ── B5 (ROADMAP-CRM-MAU): BANG KANBAN DON THEO GIAI DOAN BASE — chi doc, giai doan do Base quyet dinh (khong keo tha duoc).
//    Moi cot = 1 giai doan (Tiep nhan don → ... → Dong hang); the = don Base gom id, san pham, gia tri, sale, nguoi dang xu ly (giaoCho),
//    gio o giai doan (tu sheet theo doi o tren; null neu chua theo doi). Cot 'Dong hang' (cuoi) chi lay don 7 ngay gan nhat.
var TT_STAGE_ORDER_ = ['Tiếp nhận đơn', 'Tạo đơn POS', 'Phân loại đơn', 'Phòng sản xuất', 'Kho thành phẩm', 'Đóng hàng'];
var TT_BOARD_DONE_DAYS_ = 7;
var TT_BOARD_CAP_ = 80;
function _ttBoardBuild_(orders, trackRows, namesCsv, nowMs, hours, skip) {
  var since = {};
  trackRows.forEach(function(r) {
    if (r[0] === '' || r[0] == null) return;
    var t = r[2] && r[2].getTime ? r[2].getTime() : _ttParseVn_(r[2]);
    if (t) since[String(r[0])] = { stage: _ttFold_(r[1]), t: t };
  });
  var want = {}, hasWant = false;
  String(namesCsv || '').split('|').forEach(function(x) { var k = _normTxt_(x); if (k) { want[k] = true; hasWant = true; } });
  var order = TT_STAGE_ORDER_.map(_ttFold_), cols = {}, seq = [], seen = {};
  var lookback = nowMs - TT_LOOKBACK_DAYS_ * 86400000, doneFrom = nowMs - TT_BOARD_DONE_DAYS_ * 86400000;
  orders.forEach(function(o) {
    var id = String(o.id == null ? '' : o.id).trim(), stage = String(o.giaiDoan == null ? '' : o.giaiDoan).trim();
    if (!id || !stage || seen[id]) return;
    seen[id] = true;
    if (_isExcludedOrderStatus_(o.trangThai)) return;
    var created = _ttParseVn_(o.ngayTao), fold = _ttFold_(stage), isDone = !!skip[fold];
    if (isDone) { var doneAt = _ttParseVn_(o.thoiGianHT) || created; if (!doneAt || doneAt < doneFrom) return; }
    else if (created && created < lookback) return;
    if (hasWant && !String(o.saleBan || '').split(',').some(function(t) { return want[_normTxt_(t)]; })) return;
    var sc = since[id], h = (sc && sc.stage === fold) ? Math.floor((nowMs - sc.t) / 3600000) : null;
    var col = cols[fold];
    if (!col) { col = cols[fold] = { name: stage, items: [] }; seq.push(fold); }
    col.items.push({ id: id, hours: h, stuck: !isDone && h !== null && h >= hours, sale: String(o.saleBan || ''), giaoCho: String(o.giaoCho == null ? '' : o.giaoCho).trim(),
      sanPham: String(o.sanPham == null ? '' : o.sanPham).trim().slice(0, 120), value: Number(o.giaTriDon) || 0, ngayTao: String(o.ngayTao || ''),
      maBoDem: String(o.maBoDem == null ? '' : o.maBoDem).trim(), phone: String(o.phone || '') }); // ma bo dem (cot U DT TONG); rong thi front-end lui ve id Base
  });
  // cot theo thu tu Base, cot la (giai doan khac) xep sau; cot Base chua co don van hien de du quy trinh
  var out = [];
  TT_STAGE_ORDER_.forEach(function(name, i) { var f = order[i]; out.push(cols[f] || { name: name, items: [] }); });
  seq.forEach(function(f) { if (order.indexOf(f) === -1) out.push(cols[f]); });
  return out.map(function(c) {
    c.items.sort(function(a, b) { return (b.stuck - a.stuck) || ((b.hours || -1) - (a.hours || -1)); });
    return { name: c.name, count: c.items.length, stuck: c.items.filter(function(x) { return x.stuck; }).length, items: c.items.slice(0, TT_BOARD_CAP_) };
  });
}
function ttStageBoard_(namesCsv) {
  var hours = parseFloat(getSetting_('ttStageHours')) || TT_DEFAULT_HOURS_, nowMs = Date.now();
  var lastMs = Number(getSetting_('ttLastTrackedMs')) || 0;
  if (nowMs - lastMs > TT_REFRESH_MIN_ * 60000) { try { ttTrackStages_(); } catch (e) { Logger.log('ttTrackStages_: ' + e); } }
  var sh = getSheet_(TT_TRACK_SHEET_, TT_TRACK_HEADERS_), last = sh.getLastRow();
  var rows = last >= 2 ? sh.getRange(2, 1, last - 1, TT_TRACK_HEADERS_.length).getValues() : [];
  // readDTTong_(true) = doc them cot U 'Ma bo dem' (vd 196T10/2026) de the hien MA BO DEM thay vi id so cua Base.
  var stages = _ttBoardBuild_(readDTTong_(true), rows, namesCsv, nowMs, hours, _ttSkipSet_());
  return { ok: true, hours: hours, generatedAt: nowMs, trackedAt: Number(getSetting_('ttLastTrackedMs')) || 0, stages: stages };
}



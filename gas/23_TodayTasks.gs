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
  return { ok: true, generatedAt: nowMs, trackedAt: Number(getSetting_('ttLastTrackedMs')) || 0, hours: hours,
    tasks: [{ key: 'stuckStage', title: 'Đơn Base kẹt giai đoạn quá ' + hours + ' giờ — vào kiểm tra', count: stuck.length, items: stuck.slice(0, 100) }] };
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
      maBoDem: String(o.maBoDem == null ? '' : o.maBoDem).trim() }); // ma bo dem (cot U DT TONG); rong thi front-end lui ve id Base
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



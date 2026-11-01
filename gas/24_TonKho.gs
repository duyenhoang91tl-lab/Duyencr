// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  TON KHO (thay Pos cho ton kho) — 24_TonKho
//  Sheet 'Kho' (admin tao; leaders/staff = JSON mang username), 'TonKho' (khoId, maHang, tenHang, ton, minTon, updatedAt, updatedBy, ver),
//  'TonKhoLog' (moi lan doi so luong deu ghi: ai, luc nao, truoc/sau, ly do).
//  Quyen: admin = tat ca (tao/sua kho, phan quyen); leader cua kho = them/sua/xoa mat hang + nhap Excel + sua so luong; staff cua kho = sua so luong (nhap/xuat/kiem ke).
//  XEM: moi nguoi (GET cong khai nhu cac GET khac cua CRM). GHI: bat buoc token phien (_sessUser_), kiem quyen theo kho, khoa script (LockService) vi nhieu nguoi cung sua.
//  Chong ghi de: moi dong co 'ver' tang moi lan ghi; tonKhoSet gui expectedVer, lech => code CONFLICT kem dong hien tai. tonKhoAdjust (+/- delta) tinh tren so hien tai nen khong mat so khi 2 nguoi cung nhap.
//  KHONG cho ton am (tra loi ro). Tru ton tu dong theo don: CHUA lam (can chot kho nao / combo / hoan don) — xem docs/crm-kb.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SH_KHO = 'Kho';
var KHO_HEADERS = ['id','name','leaders','staff','active','note','createdAt','createdBy'];
var SH_TONKHO = 'TonKho';
var TONKHO_HEADERS = ['khoId','maHang','tenHang','ton','minTon','updatedAt','updatedBy','ver'];
var SH_TONKHO_LOG = 'TonKhoLog';
var TONKHO_LOG_HEADERS = ['id','ts','khoId','maHang','tenHang','user','loai','before','after','delta','lyDo','ref'];
var TONKHO_IMPORT_MAX_ = 20000;

function _khoJsonArr_(v) {
  try { var a = v ? JSON.parse(v) : []; return Array.isArray(a) ? a : []; }
  catch (e) { return String(v || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
}
function _khoUnames_(arr) {
  var seen = {}, out = [];
  (arr || []).forEach(function (u) { var k = String(u == null ? '' : u).trim().toLowerCase(); if (k && !seen[k]) { seen[k] = true; out.push(k); } });
  return out;
}
function _khoFromRow_(r) {
  var act = !(r[4] === false || r[4] === 0 || String(r[4]).toLowerCase() === 'false');
  return { id: String(r[0]), name: String(r[1] || ''), leaders: _khoUnames_(_khoJsonArr_(r[2])), staff: _khoUnames_(_khoJsonArr_(r[3])),
    active: act, note: String(r[5] || ''), createdAt: String(r[6] || ''), createdBy: String(r[7] || '') };
}
function readKho_() {
  var sh = getSheet_(SH_KHO, KHO_HEADERS), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, KHO_HEADERS.length).getValues().filter(function (r) { return r[0]; }).map(_khoFromRow_);
}
function _khoById_(id) {
  var all = readKho_();
  for (var i = 0; i < all.length; i++) if (all[i].id === String(id)) return all[i];
  return null;
}
// Muc quyen cua user tren 1 kho: 'admin' | 'leader' | 'staff' | ''.
function _khoLevel_(user, kho) {
  if (!user) return '';
  if (user.role === 'admin') return 'admin';
  var un = String(user.username || '').trim().toLowerCase();
  if (!un || !kho) return '';
  if (kho.leaders.indexOf(un) !== -1) return 'leader';
  if (kho.staff.indexOf(un) !== -1) return 'staff';
  return '';
}
// need: 'edit' (staff+) | 'manage' (leader+) | 'admin'.
function _khoAllows_(level, need) {
  var rank = { '': 0, staff: 1, leader: 2, admin: 3 }, req = { edit: 1, manage: 2, admin: 3 };
  return (rank[level] || 0) >= (req[need] || 99);
}
function _tonkhoCode_(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
function _tonkhoKey_(khoId, code) { return String(khoId) + '|' + _tonkhoCode_(code).toUpperCase(); }
// So luong: nhan so, '12', '1.000' (dau cham ngan cach nghin), '1,5' / '1.5' (thap phan). NaN neu khong doc duoc.
function _khoNum_(v) {
  if (typeof v === 'number') return isFinite(v) ? Math.round(v * 1000) / 1000 : NaN;
  var t = String(v == null ? '' : v).replace(/\s/g, '');
  if (!t) return NaN;
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) return parseInt(t.replace(/\./g, ''), 10);
  if (/^-?\d+[.,]\d+$/.test(t)) return Math.round(parseFloat(t.replace(',', '.')) * 1000) / 1000;
  return NaN;
}
function _khoNowIso_() { return new Date().toISOString(); }
function _khoNewId_(prefix) { return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function _khoAuth_(data) {
  var su = _sessUser_(data && data.token);
  return su ? { user: su } : { err: jsonOut_({ error: 'Can dang nhap.', code: 'AUTH' }) };
}
function _khoWithLock_(fn) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return jsonOut_({ error: 'He thong ban, thu lai.' }); }
  try { return fn(); } finally { try { lock.releaseLock(); } catch (e2) {} }
}
// Kiem quyen + kho ton tai + dang hoat dong. Tra { user, kho, level } hoac { err }.
function _khoGate_(data, need) {
  var a = _khoAuth_(data); if (a.err) return a;
  var kho = _khoById_(data && data.khoId);
  if (!kho) return { err: jsonOut_({ error: 'Khong tim thay kho.' }) };
  var level = _khoLevel_(a.user, kho);
  if (!_khoAllows_(level, need)) return { err: jsonOut_({ error: need === 'manage' ? 'Chi leader cua kho nay hoac admin moi duoc thuc hien thao tac nay.' : 'Ban khong co quyen sua kho nay.', code: 'FORBIDDEN' }) };
  if (!kho.active) return { err: jsonOut_({ error: 'Kho da ngung hoat dong.' }) };
  return { user: a.user, kho: kho, level: level };
}

function _tonkhoItemFromRow_(r) {
  var mt = (r[4] === '' || r[4] == null) ? null : Number(r[4]);
  return { khoId: String(r[0]), maHang: String(r[1]), tenHang: String(r[2] || ''), ton: Number(r[3]) || 0, minTon: (mt === null || isNaN(mt)) ? null : mt,
    updatedAt: String(r[5] || ''), updatedBy: String(r[6] || ''), ver: parseInt(r[7], 10) || 1 };
}
function _tonkhoItemToRow_(it) { return [it.khoId, it.maHang, it.tenHang || '', it.ton, it.minTon == null ? '' : it.minTon, it.updatedAt || '', it.updatedBy || '', it.ver || 1]; }
function readTonKho_(khoId) {
  var sh = getSheet_(SH_TONKHO, TONKHO_HEADERS), last = sh.getLastRow();
  if (last < 2) return [];
  var out = sh.getRange(2, 1, last - 1, TONKHO_HEADERS.length).getValues().filter(function (r) { return r[0] && r[1] !== ''; }).map(_tonkhoItemFromRow_);
  return khoId ? out.filter(function (x) { return x.khoId === String(khoId); }) : out;
}
// Doc 1 lan: { sh, items (mang item kem .row = so dong tren sheet), idx (key -> vi tri trong items) }
function _tonkhoLoad_() {
  var sh = getSheet_(SH_TONKHO, TONKHO_HEADERS), last = sh.getLastRow(), items = [], idx = {};
  if (last >= 2) {
    var vals = sh.getRange(2, 1, last - 1, TONKHO_HEADERS.length).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (!vals[i][0] || vals[i][1] === '') continue;
      var it = _tonkhoItemFromRow_(vals[i]); it.row = i + 2; idx[_tonkhoKey_(it.khoId, it.maHang)] = items.length; items.push(it);
    }
  }
  return { sh: sh, items: items, idx: idx };
}
function _tonkhoLog_(entries) {
  if (!entries.length) return;
  var sh = getSheet_(SH_TONKHO_LOG, TONKHO_LOG_HEADERS), now = _khoNowIso_();
  var rows = entries.map(function (e) {
    return [_khoNewId_('L'), now, e.khoId, e.maHang, e.tenHang || '', e.user, e.loai, e.before == null ? '' : e.before, e.after == null ? '' : e.after,
      e.delta == null ? '' : e.delta, e.lyDo || '', e.ref || ''];
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, TONKHO_LOG_HEADERS.length).setValues(rows);
}
function readTonKhoLog_(p) {
  var sh = getSheet_(SH_TONKHO_LOG, TONKHO_LOG_HEADERS), last = sh.getLastRow();
  if (last < 2) return [];
  var limit = Math.max(1, Math.min(1000, parseInt(p && p.limit, 10) || 200));
  var from = Math.max(2, last - 20000 + 1);   // chi quet toi da 20.000 dong cuoi (log chi tang them)
  var vals = sh.getRange(from, 1, last - from + 1, TONKHO_LOG_HEADERS.length).getValues();
  var kid = p && p.khoId ? String(p.khoId) : '', ma = p && p.maHang ? _tonkhoCode_(p.maHang).toUpperCase() : '', out = [];
  for (var i = vals.length - 1; i >= 0 && out.length < limit; i--) {
    var r = vals[i];
    if (kid && String(r[2]) !== kid) continue;
    if (ma && _tonkhoCode_(r[3]).toUpperCase() !== ma) continue;
    out.push({ id: String(r[0]), ts: String(r[1]), khoId: String(r[2]), maHang: String(r[3]), tenHang: String(r[4] || ''), user: String(r[5] || ''), loai: String(r[6] || ''),
      before: r[7] === '' ? null : Number(r[7]), after: r[8] === '' ? null : Number(r[8]), delta: r[9] === '' ? null : Number(r[9]), lyDo: String(r[10] || ''), ref: String(r[11] || '') });
  }
  return out;
}

// ── Kho: chi admin ──
function khoSave_(data) {
  var a = _khoAuth_(data); if (a.err) return a.err;
  if (a.user.role !== 'admin') return jsonOut_({ error: 'Chi admin moi duoc tao/sua kho.', code: 'FORBIDDEN' });
  var k = data.kho || {}, name = String(k.name || '').trim();
  if (!name) return jsonOut_({ error: 'Thieu ten kho.' });
  return _khoWithLock_(function () {
    var sh = getSheet_(SH_KHO, KHO_HEADERS), last = sh.getLastRow(), vals = last >= 2 ? sh.getRange(2, 1, last - 1, KHO_HEADERS.length).getValues() : [];
    var id = k.id ? String(k.id) : '', row = 0;
    for (var i = 0; i < vals.length; i++) {
      if (id && String(vals[i][0]) === id) row = i + 2;
      else if (String(vals[i][1]).trim().toLowerCase() === name.toLowerCase() && String(vals[i][0]) !== id) return jsonOut_({ error: 'Da co kho ten "' + name + '".' });
    }
    if (id && !row) return jsonOut_({ error: 'Khong tim thay kho de sua.' });
    var users = readUsers_(getCrmSS_().getSheetByName(SH_USER)), known = {};
    users.forEach(function (u) { known[String(u.username || '').trim().toLowerCase()] = true; });
    var leaders = _khoUnames_(k.leaders), staff = _khoUnames_(k.staff).filter(function (u) { return leaders.indexOf(u) === -1; });
    var bad = leaders.concat(staff).filter(function (u) { return !known[u]; });
    if (bad.length) return jsonOut_({ error: 'Khong co tai khoan: ' + bad.join(', ') });
    var active = k.active === false ? false : true;
    if (row) {
      var old = _khoFromRow_(vals[row - 2]);
      sh.getRange(row, 1, 1, KHO_HEADERS.length).setValues([[old.id, name, JSON.stringify(leaders), JSON.stringify(staff), active, String(k.note || ''), old.createdAt, old.createdBy]]);
      return jsonOut_({ ok: true, kho: { id: old.id, name: name, leaders: leaders, staff: staff, active: active, note: String(k.note || '') } });
    }
    id = _khoNewId_('K');
    sh.getRange(last + 1, 1, 1, KHO_HEADERS.length).setValues([[id, name, JSON.stringify(leaders), JSON.stringify(staff), active, String(k.note || ''), _khoNowIso_(), a.user.username]]);
    return jsonOut_({ ok: true, kho: { id: id, name: name, leaders: leaders, staff: staff, active: active, note: String(k.note || '') } });
  });
}

// ── So luong ──
// Dat so luong = newQty (kiem ke). Bat buoc ly do. expectedVer (neu gui) phai khop ver hien tai.
function tonKhoSet_(data) {
  var g = _khoGate_(data, 'edit'); if (g.err) return g.err;
  var code = _tonkhoCode_(data.maHang), q = _khoNum_(data.newQty), why = String(data.lyDo || '').trim();
  if (!code) return jsonOut_({ error: 'Thieu ma hang.' });
  if (isNaN(q)) return jsonOut_({ error: 'So luong khong hop le.' });
  if (q < 0) return jsonOut_({ error: 'Ton kho khong the am.' });
  if (why.length < 2) return jsonOut_({ error: 'Nhap ly do (kiem ke / nhap / xuat...).' });
  return _khoWithLock_(function () {
    var L = _tonkhoLoad_(), pos = L.idx[_tonkhoKey_(g.kho.id, code)];
    if (pos === undefined) return jsonOut_({ error: 'Chua co mat hang "' + code + '" trong kho nay.' });
    var it = L.items[pos];
    if (data.expectedVer != null && Number(data.expectedVer) !== it.ver) return jsonOut_({ error: 'Co nguoi vua sua mat hang nay. Tai lai roi thu lai.', code: 'CONFLICT', current: it });
    var before = it.ton; it.ton = q; it.ver += 1; it.updatedAt = _khoNowIso_(); it.updatedBy = g.user.username;
    L.sh.getRange(it.row, 1, 1, TONKHO_HEADERS.length).setValues([_tonkhoItemToRow_(it)]);
    _tonkhoLog_([{ khoId: it.khoId, maHang: it.maHang, tenHang: it.tenHang, user: g.user.username, loai: 'kiem_ke', before: before, after: q, delta: Math.round((q - before) * 1000) / 1000, lyDo: why }]);
    return jsonOut_({ ok: true, item: it });
  });
}
// Nhap (+) / xuat (-) theo delta tren so HIEN TAI (an toan khi nhieu nguoi cung thao tac). Ly do tuy chon.
function tonKhoAdjust_(data) {
  var g = _khoGate_(data, 'edit'); if (g.err) return g.err;
  var code = _tonkhoCode_(data.maHang), d = _khoNum_(data.delta);
  if (!code) return jsonOut_({ error: 'Thieu ma hang.' });
  if (isNaN(d) || d === 0) return jsonOut_({ error: 'So luong nhap/xuat khong hop le.' });
  return _khoWithLock_(function () {
    var L = _tonkhoLoad_(), pos = L.idx[_tonkhoKey_(g.kho.id, code)];
    if (pos === undefined) return jsonOut_({ error: 'Chua co mat hang "' + code + '" trong kho nay.' });
    var it = L.items[pos], after = Math.round((it.ton + d) * 1000) / 1000;
    if (after < 0) return jsonOut_({ error: 'Khong du ton: hien co ' + it.ton + ', xuat ' + (-d) + '.', code: 'NEGATIVE', current: it });
    var before = it.ton; it.ton = after; it.ver += 1; it.updatedAt = _khoNowIso_(); it.updatedBy = g.user.username;
    L.sh.getRange(it.row, 1, 1, TONKHO_HEADERS.length).setValues([_tonkhoItemToRow_(it)]);
    _tonkhoLog_([{ khoId: it.khoId, maHang: it.maHang, tenHang: it.tenHang, user: g.user.username, loai: d > 0 ? 'nhap' : 'xuat', before: before, after: after, delta: d, lyDo: String(data.lyDo || '').trim() }]);
    return jsonOut_({ ok: true, item: it });
  });
}

// ── Mat hang: leader/admin ──
// Them moi (ton ban dau = data.ton, mac dinh 0) hoac sua ten / muc canh bao (minTon). Khong doi ton cua mat hang da co (dung tonKhoSet/Adjust).
function tonKhoItemSave_(data) {
  var g = _khoGate_(data, 'manage'); if (g.err) return g.err;
  var code = _tonkhoCode_(data.maHang), name = String(data.tenHang || '').trim();
  if (!code) return jsonOut_({ error: 'Thieu ma hang.' });
  var mt = (data.minTon === '' || data.minTon == null) ? null : _khoNum_(data.minTon);
  if (mt !== null && (isNaN(mt) || mt < 0)) return jsonOut_({ error: 'Muc canh bao khong hop le.' });
  return _khoWithLock_(function () {
    var L = _tonkhoLoad_(), pos = L.idx[_tonkhoKey_(g.kho.id, code)], now = _khoNowIso_();
    if (pos !== undefined) {
      var it = L.items[pos]; it.tenHang = name || it.tenHang; it.minTon = mt; it.ver += 1; it.updatedAt = now; it.updatedBy = g.user.username;
      L.sh.getRange(it.row, 1, 1, TONKHO_HEADERS.length).setValues([_tonkhoItemToRow_(it)]);
      return jsonOut_({ ok: true, item: it, created: false });
    }
    var q0 = (data.ton === '' || data.ton == null) ? 0 : _khoNum_(data.ton);
    if (isNaN(q0) || q0 < 0) return jsonOut_({ error: 'Ton ban dau khong hop le.' });
    var nit = { khoId: g.kho.id, maHang: code, tenHang: name, ton: q0, minTon: mt, updatedAt: now, updatedBy: g.user.username, ver: 1 };
    L.sh.getRange(L.sh.getLastRow() + 1, 1, 1, TONKHO_HEADERS.length).setValues([_tonkhoItemToRow_(nit)]);
    _tonkhoLog_([{ khoId: nit.khoId, maHang: code, tenHang: name, user: g.user.username, loai: 'tao', before: null, after: q0, delta: q0, lyDo: String(data.lyDo || 'Them mat hang').trim() }]);
    return jsonOut_({ ok: true, item: nit, created: true });
  });
}
function tonKhoItemDelete_(data) {
  var g = _khoGate_(data, 'manage'); if (g.err) return g.err;
  var code = _tonkhoCode_(data.maHang);
  if (!code) return jsonOut_({ error: 'Thieu ma hang.' });
  return _khoWithLock_(function () {
    var L = _tonkhoLoad_(), pos = L.idx[_tonkhoKey_(g.kho.id, code)];
    if (pos === undefined) return jsonOut_({ error: 'Khong tim thay mat hang.' });
    var it = L.items[pos];
    if (data.expectedVer != null && Number(data.expectedVer) !== it.ver) return jsonOut_({ error: 'Co nguoi vua sua mat hang nay. Tai lai roi thu lai.', code: 'CONFLICT', current: it });
    _tonkhoLog_([{ khoId: it.khoId, maHang: it.maHang, tenHang: it.tenHang, user: g.user.username, loai: 'xoa', before: it.ton, after: null, delta: -it.ton, lyDo: String(data.lyDo || 'Xoa mat hang').trim() }]);
    L.sh.deleteRow(it.row);
    return jsonOut_({ ok: true });
  });
}

// Nhap hang loat (vd file Excel tong hop ton kho cua Pos): items = [{maHang, tenHang, ton}]. mode 'set' = dat ton = so trong file; 'add' = cong them.
// Ma moi -> tao mat hang. Dong loi/trung bi bo qua + bao lai. Mac dinh ghi log 'import' cho tung dong CO DOI.
function tonKhoImport_(data) {
  var g = _khoGate_(data, 'manage'); if (g.err) return g.err;
  var items = Array.isArray(data.items) ? data.items : [], mode = data.mode === 'add' ? 'add' : 'set';
  if (!items.length) return jsonOut_({ error: 'Khong co dong nao de nhap.' });
  if (items.length > TONKHO_IMPORT_MAX_) return jsonOut_({ error: 'Qua nhieu dong (toi da ' + TONKHO_IMPORT_MAX_ + ').' });
  return _khoWithLock_(function () {
    var L = _tonkhoLoad_(), now = _khoNowIso_(), user = g.user.username, why = String(data.lyDo || '').trim() || ('Nhap Excel (' + mode + ')');
    var skipped = [], seenCode = {}, created = 0, updated = 0, unchanged = 0, dupInFile = 0, logs = [], newRows = [], dirtyRows = {};
    items.forEach(function (x, n) {
      var code = _tonkhoCode_(x && x.maHang), q = _khoNum_(x && x.ton);
      if (!code) { skipped.push({ n: n + 1, reason: 'thieu ma hang' }); return; }
      if (isNaN(q)) { skipped.push({ n: n + 1, maHang: code, reason: 'so luong khong hop le' }); return; }
      var key = _tonkhoKey_(g.kho.id, code);
      if (seenCode[key]) { dupInFile++; skipped.push({ n: n + 1, maHang: code, reason: 'trung ma trong file (giu dong dau)' }); return; }
      seenCode[key] = true;
      var pos = L.idx[key], name = String((x && x.tenHang) || '').trim();
      if (pos === undefined) {
        var target = q;   // ma moi: 'set' va 'add' deu bat dau tu so trong file
        if (target < 0) { skipped.push({ n: n + 1, maHang: code, reason: 'ton am' }); return; }
        var nit = { khoId: g.kho.id, maHang: code, tenHang: name, ton: target, minTon: null, updatedAt: now, updatedBy: user, ver: 1 };
        L.idx[key] = L.items.length; nit.row = 0; L.items.push(nit); newRows.push(nit); created++;
        logs.push({ khoId: nit.khoId, maHang: code, tenHang: name, user: user, loai: 'import', before: null, after: target, delta: target, lyDo: why });
        return;
      }
      var it = L.items[pos], after = mode === 'add' ? Math.round((it.ton + q) * 1000) / 1000 : q;
      if (after < 0) { skipped.push({ n: n + 1, maHang: code, reason: 'ton se am' }); return; }
      if (after === it.ton && (!name || name === it.tenHang)) { unchanged++; return; }
      var before = it.ton; it.ton = after; if (name) it.tenHang = name; it.ver += 1; it.updatedAt = now; it.updatedBy = user; dirtyRows[it.row] = it; updated++;
      if (after !== before) logs.push({ khoId: it.khoId, maHang: it.maHang, tenHang: it.tenHang, user: user, loai: 'import', before: before, after: after, delta: Math.round((after - before) * 1000) / 1000, lyDo: why });
    });
    Object.keys(dirtyRows).forEach(function (r) { L.sh.getRange(Number(r), 1, 1, TONKHO_HEADERS.length).setValues([_tonkhoItemToRow_(dirtyRows[r])]); });
    if (newRows.length) L.sh.getRange(L.sh.getLastRow() + 1, 1, newRows.length, TONKHO_HEADERS.length).setValues(newRows.map(_tonkhoItemToRow_));
    _tonkhoLog_(logs);
    return jsonOut_({ ok: true, mode: mode, total: items.length, created: created, updated: updated, unchanged: unchanged, duplicatesInFile: dupInFile, skipped: skipped.slice(0, 50), skippedCount: skipped.length });
  });
}


// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  TON KHO — TRU TON TU DONG THEO DON (nam trong file 24_TonKho). MAC DINH TAT. Nguon: sheet Pos "dữ liệu đơn" cot I (San pham) / J (Ma san pham) / K (So luong)
//  — doc qua readDonChiTiet_ (sanPham / maSanPham ';' / soLuong ','), cung cach tach voi buildDonProducts_.
//  Quy tac (Duyen chot 2026-10-12):
//   • Moi MA san pham tru tu kho dang CHUA ma do (chi co 2 kho chinh: Kho san xuat, Quay). Ma o >1 kho thi dung thu tu uu tien (KhoCauHinh.priority); chua dat -> GIU don o 'cho_duyet'.
//   • COMBO (sheet KhoCombo, admin khai bao thanh phan): tru theo thanh phan x so luong. Combo (ma CBxx / ten co "COMBO") chua khai bao -> GIU ca don 'cho_duyet', khong tru, bao de duyet; khai bao xong lan chay sau tu tru.
//   • Ma khong thuoc kho nao va khong giong combo (dich vu, qua, nguyen vat lieu...) -> bo qua, KHONG chan don.
//   • Don Huy/Hoan (_donHasExcludedStatus_: Hủy đơn/Hoàn đơn/Đã hoàn/Đang hoàn) -> KHONG tru; neu da tru roi thi CONG TRA dung so da tru ('hoan_don'); don huy roi co lai thi tru lai.
//  An toan: (1) chi xet don co ngay >= khoDeductStart (admin PHAI dat — khong bao gio tru lich su 11k dong); (2) so dong/ma-SL lech hoac SL <=0 hoac > TKD_MAX_QTY_ (vd "2001") -> GIU, khong tru;
//  (3) So tru khong de ton am: tru toi da bang ton hien co, phan thieu ghi 'shortage' + bao cao de kho kiem lai; (4) so cai: sheet TonKhoTruDon, khoa don = ngay|SDT|ma|SL|gia tri|ghi chu
//  => moi don tru DUNG 1 LAN; chay lai khong tru them. Don sua (khoa doi) / mat khoi sheet -> bao 'mo coi', admin tu hoan (tonKhoTruDonHoanTay), he thong KHONG tu hoan.
//  Che do (KhoCauHinh.mode): off (mac dinh) | dry (chi xem truoc) | on (tonKhoTruDonChay + trigger 10 phut tonKhoTruDonTick_). Xem truoc (tonKhoTruDonXemTruoc) luon chay duoc, KHONG ghi gi.
//  Cau hinh nam sheet rieng KhoCauHinh (KHONG dung setSetting chung vi action setSetting cho phep client ghi key bat ky).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SH_KHOCOMBO = 'KhoCombo';
var KHOCOMBO_HEADERS = ['comboCode','name','components','active'];
var SH_KHOCFG = 'KhoCauHinh';
var KHOCFG_HEADERS = ['key','value'];
var SH_TKD = 'TonKhoTruDon';
var TKD_HEADERS = ['key','ngay','sdt','trangThai','status','applied','shortage','problems','updatedAt','note'];
var TKD_MAX_QTY_ = 500;
var TKD_BATCH_ = 300;      // so don xu ly toi da moi lan chay (con lai tiep lan sau)
var TKD_SYSTEM_USER_ = 'he-thong';

function _tkdCfg_() {
  var sh = getSheet_(SH_KHOCFG, KHOCFG_HEADERS), last = sh.getLastRow(), m = {};
  if (last >= 2) sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r) { if (r[0]) m[String(r[0])] = String(r[1] == null ? '' : r[1]); });
  return { mode: (m.mode === 'dry' || m.mode === 'on') ? m.mode : 'off', start: m.start || '', priority: _khoJsonArr_(m.priority).map(String) };
}
function _tkdCfgSet_(key, value) {
  var sh = getSheet_(SH_KHOCFG, KHOCFG_HEADERS), last = sh.getLastRow();
  if (last >= 2) {
    var vals = sh.getRange(2, 1, last - 1, 2).getValues();
    for (var i = 0; i < vals.length; i++) if (String(vals[i][0]) === key) { sh.getRange(i + 2, 1, 1, 2).setValues([[key, value]]); return; }
  }
  sh.getRange(last + 1, 1, 1, 2).setValues([[key, value]]);
}
function readKhoCombo_() {
  var sh = getSheet_(SH_KHOCOMBO, KHOCOMBO_HEADERS), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, KHOCOMBO_HEADERS.length).getValues().filter(function (r) { return r[0]; }).map(function (r) {
    var comps = []; try { comps = JSON.parse(r[2] || '[]'); } catch (e) { comps = []; }
    comps = (Array.isArray(comps) ? comps : []).map(function (c) { return { code: _tonkhoCode_(c && c.code), qty: _khoNum_(c && c.qty) }; }).filter(function (c) { return c.code && c.qty > 0; });
    return { code: _tonkhoCode_(r[0]), name: String(r[1] || ''), components: comps, active: !(r[3] === false || String(r[3]).toLowerCase() === 'false' || r[3] === 0) };
  });
}
function khoComboSave_(data) {
  var a = _khoAuth_(data); if (a.err) return a.err;
  if (a.user.role !== 'admin') return jsonOut_({ error: 'Chi admin moi duoc khai bao combo.', code: 'FORBIDDEN' });
  var c = data.combo || {}, code = _tonkhoCode_(c.code);
  if (!code) return jsonOut_({ error: 'Thieu ma combo.' });
  var comps = [];
  for (var i = 0; i < (c.components || []).length; i++) {
    var cc = c.components[i], cd = _tonkhoCode_(cc && cc.code), q = _khoNum_(cc && cc.qty);
    if (!cd || isNaN(q) || q <= 0) return jsonOut_({ error: 'Thanh phan ' + (i + 1) + ' khong hop le (can ma va so luong > 0).' });
    if (cd.toUpperCase() === code.toUpperCase()) return jsonOut_({ error: 'Combo khong the chua chinh no.' });
    comps.push({ code: cd, qty: q });
  }
  var active = c.active === false ? false : true;
  if (active && !comps.length) return jsonOut_({ error: 'Combo can it nhat 1 thanh phan (hoac tat hoat dong).' });
  return _khoWithLock_(function () {
    var sh = getSheet_(SH_KHOCOMBO, KHOCOMBO_HEADERS), last = sh.getLastRow(), row = 0;
    if (last >= 2) {
      var vals = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var j = 0; j < vals.length; j++) if (_tonkhoCode_(vals[j][0]).toUpperCase() === code.toUpperCase()) { row = j + 2; break; }
    }
    var rec = [code, String(c.name || '').trim(), JSON.stringify(comps), active];
    if (row) sh.getRange(row, 1, 1, KHOCOMBO_HEADERS.length).setValues([rec]); else sh.getRange(last + 1, 1, 1, KHOCOMBO_HEADERS.length).setValues([rec]);
    return jsonOut_({ ok: true, combo: { code: code, name: rec[1], components: comps, active: active }, created: !row });
  });
}

// ── logic thuan ──
function _tkdOrderKey_(r) {
  var who = normPhone_(String(r.soDienThoai || '')) || String(r.khachHang || '').trim().toLowerCase();
  return [String(r.ngayTaoDon || '').trim(), who, String(r.maSanPham || '').trim(), String(r.soLuong || '').trim(), String(r.giaTriSauGiam == null ? '' : r.giaTriSauGiam), String(r.ghiChu || '').trim()].join('|');
}
function _tkdLooksCombo_(code, name) { return /^CB[-_ ]?/i.test(code) || /combo/i.test(name || ''); }
// Tach 1 dong don thanh cac dong hang: { lines:[{code, qty, from}], combos:[chua khai bao], problems:[text] }. combosMap: codeUpper -> combo active.
function _tkdExpandLines_(r, combosMap, knownCodes) {
  var codes = splitMulti_(r.maSanPham, ';'), names = splitMulti_(r.sanPham, ','), qtys = splitMulti_(r.soLuong, ',');
  var out = { lines: [], undefinedCombos: [], problems: [] };
  if (!codes.length) return out;
  if (qtys.length !== codes.length) { out.problems.push('Lech so ma / so luong (' + codes.length + ' ma, ' + qtys.length + ' SL)'); return out; }
  var aligned = names.length === codes.length;
  for (var k = 0; k < codes.length; k++) {
    var code = _tonkhoCode_(codes[k]), q = _khoNum_(qtys[k]);
    if (!code) continue;
    if (isNaN(q) || q <= 0) { out.problems.push('SL khong hop le cho ma ' + code + ': "' + qtys[k] + '"'); continue; }
    if (q > TKD_MAX_QTY_) { out.problems.push('SL bat thuong cho ma ' + code + ': ' + q); continue; }
    var cb = combosMap[code.toUpperCase()];
    if (cb) { cb.components.forEach(function (c) { out.lines.push({ code: c.code, qty: Math.round(c.qty * q * 1000) / 1000, from: code }); }); continue; }
    if (_tkdLooksCombo_(code, aligned ? names[k] : '') && !knownCodes[code.toUpperCase()]) { out.undefinedCombos.push(code); continue; }
    out.lines.push({ code: code, qty: q, from: '' });
  }
  return out;
}
// Chon kho cho 1 ma: { khoId } | { none:true } | { multi:[khoId] } (da ap dung uu tien neu co).
function _tkdPickKho_(codeUpper, byCode, priority) {
  var ids = byCode[codeUpper] || [];
  if (!ids.length) return { none: true };
  if (ids.length === 1) return { khoId: ids[0] };
  for (var i = 0; i < priority.length; i++) if (ids.indexOf(priority[i]) !== -1) return { khoId: priority[i] };
  return { multi: ids.slice() };
}

function _tkdLedger_() {
  var sh = getSheet_(SH_TKD, TKD_HEADERS), last = sh.getLastRow(), map = {};
  if (last >= 2) {
    var vals = sh.getRange(2, 1, last - 1, TKD_HEADERS.length).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (!vals[i][0]) continue;
      var ap = []; try { ap = JSON.parse(vals[i][5] || '[]'); } catch (e) { ap = []; }
      map[String(vals[i][0])] = { row: i + 2, key: String(vals[i][0]), ngay: String(vals[i][1] || ''), sdt: String(vals[i][2] || ''), trangThai: String(vals[i][3] || ''), status: String(vals[i][4] || ''), applied: ap,
        shortage: String(vals[i][6] || ''), problems: String(vals[i][7] || ''), note: String(vals[i][9] || '') };
    }
  }
  return { sh: sh, map: map };
}
function _tkdLedgerRow_(e) { return [e.key, e.ngay, e.sdt, e.trangThai, e.status, JSON.stringify(e.applied || []), e.shortage || '', e.problems || '', _khoNowIso_(), e.note || '']; }

// Chay: opts.apply (ghi that) | opts.rows (tiem du lieu de test). Tra bao cao. Chua kiem quyen/che do — nguoi goi lo.
function _tkdRun_(opts) {
  opts = opts || {};
  var cfg = _tkdCfg_();
  if (!cfg.start) return { error: 'Chua dat ngay bat dau (khoDeductStart). Khong the tinh don nao.' };
  var startD = parseVNDate_(cfg.start);
  if (!startD) return { error: 'Ngay bat dau khong hop le: "' + cfg.start + '" (dung dd/MM/yyyy).' };
  var rows = opts.rows || readDonChiTiet_();
  var kho = readKho_().filter(function (k) { return k.active; }), khoName = {}, activeId = {};
  kho.forEach(function (k) { khoName[k.id] = k.name; activeId[k.id] = true; });
  var combosMap = {}; readKhoCombo_().forEach(function (c) { if (c.active) combosMap[c.code.toUpperCase()] = c; });
  var L = _tonkhoLoad_(), byCode = {}, known = {};
  L.items.forEach(function (it, i) { if (!activeId[it.khoId]) return; var cu = _tonkhoCode_(it.maHang).toUpperCase(); known[cu] = true; (byCode[cu] = byCode[cu] || []).push(it.khoId); });
  var led = _tkdLedger_(), seenKeys = {}, now = _khoNowIso_();
  var rep = { ok: true, apply: !!opts.apply, considered: 0, duplicateRows: 0, deducted: 0, reversed: 0, held: 0, ignoredNoStock: 0, alreadyDone: 0, limitReached: false, perKho: {}, shortages: [], heldOrders: [], orphans: [], unknownCodes: {} };
  var logs = [], ledNew = [], ledUpd = [], dirty = {}, processed = 0;
  function addPerKho(khoId, q) { var n = khoName[khoId] || khoId; rep.perKho[n] = rep.perKho[n] || { lines: 0, qty: 0 }; rep.perKho[n].lines++; rep.perKho[n].qty = Math.round((rep.perKho[n].qty + q) * 1000) / 1000; }
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], d = parseVNDate_(r.ngayTaoDon);
    if (!d || d.getTime() < startD.getTime()) continue;
    if (!String(r.maSanPham || '').trim()) continue;
    var key = _tkdOrderKey_(r);
    if (seenKeys[key]) { rep.duplicateRows++; continue; }   // cung 1 don xuat hien 2 dong (import lap) -> chi xet 1 lan
    seenKeys[key] = true;
    rep.considered++;
    var ex = _donHasExcludedStatus_(r.trangThai), e = led.map[key];
    if (e && e.status === 'da_tru' && !ex) { rep.alreadyDone++; continue; }
    if (e && e.status === 'da_hoan' && ex) { rep.alreadyDone++; continue; }
    if (processed >= TKD_BATCH_) { rep.limitReached = true; continue; }
    // --- don Huy/Hoan: cong tra neu da tru ---
    if (ex) {
      if (e && e.status === 'da_tru') {
        processed++; rep.reversed++;
        e.applied.forEach(function (a) {
          var pos = L.idx[_tonkhoKey_(a.khoId, a.maHang)]; if (pos === undefined) return;
          var it = L.items[pos], before = it.ton; it.ton = Math.round((it.ton + a.qty) * 1000) / 1000; it.ver += 1; it.updatedAt = now; it.updatedBy = TKD_SYSTEM_USER_; dirty[it.row] = it;
          logs.push({ khoId: it.khoId, maHang: it.maHang, tenHang: it.tenHang, user: TKD_SYSTEM_USER_, loai: 'hoan_don', before: before, after: it.ton, delta: a.qty, lyDo: 'Don ' + (r.trangThai || 'huy/hoan') + ' ' + e.ngay + ' ' + e.sdt, ref: key });
        });
        e.status = 'da_hoan'; e.trangThai = String(r.trangThai || ''); e.note = 'Hoan do trang thai ' + e.trangThai; ledUpd.push(e);
      }
      continue;
    }
    // --- don hop le: tinh ke hoach ---
    var ex2 = _tkdExpandLines_(r, combosMap, known), holdWhy = [], plan = [], unknown = [];
    ex2.problems.forEach(function (p) { holdWhy.push(p); });
    ex2.undefinedCombos.forEach(function (c) { holdWhy.push('Combo chua khai bao: ' + c); });
    ex2.lines.forEach(function (ln) {
      var pick = _tkdPickKho_(ln.code.toUpperCase(), byCode, cfg.priority);
      if (pick.none) { unknown.push(ln.code); rep.unknownCodes[ln.code] = (rep.unknownCodes[ln.code] || 0) + 1; }
      else if (pick.multi) holdWhy.push('Ma ' + ln.code + ' co o nhieu kho (' + pick.multi.map(function (id) { return khoName[id] || id; }).join(', ') + ') — dat thu tu uu tien');
      else plan.push({ khoId: pick.khoId, code: ln.code, qty: ln.qty });
    });
    if (holdWhy.length) {
      rep.held++;
      if (rep.heldOrders.length < 100) rep.heldOrders.push({ ngay: String(r.ngayTaoDon), sdt: String(r.soDienThoai || ''), reasons: holdWhy });
      var ne = { key: key, ngay: String(r.ngayTaoDon), sdt: String(r.soDienThoai || ''), trangThai: String(r.trangThai || ''), status: 'cho_duyet', applied: [], problems: holdWhy.join(' | ') };
      // Don giu KHONG DOI so voi lan truoc thi khong tinh vao han muc (neu khong, vai don loi du lieu keo dai se chan het don hop le phia sau).
      if (e) { if (e.status !== 'cho_duyet' || e.problems !== ne.problems) { processed++; ne.row = e.row; ledUpd.push(ne); } } else { processed++; ledNew.push(ne); }
      continue;
    }
    if (!plan.length) { rep.ignoredNoStock++; continue; }
    processed++; rep.deducted++;
    var applied = [], shortLines = [];
    plan.forEach(function (pl) {
      var pos = L.idx[_tonkhoKey_(pl.khoId, pl.code)], it = L.items[pos], take = Math.min(it.ton, pl.qty), miss = Math.round((pl.qty - take) * 1000) / 1000, before = it.ton;
      it.ton = Math.round((it.ton - take) * 1000) / 1000; it.ver += 1; it.updatedAt = now; it.updatedBy = TKD_SYSTEM_USER_; dirty[it.row] = it;
      applied.push({ khoId: it.khoId, maHang: it.maHang, qty: take }); addPerKho(it.khoId, take);
      if (miss > 0) { shortLines.push(it.maHang + ' thieu ' + miss); if (rep.shortages.length < 100) rep.shortages.push({ kho: khoName[it.khoId] || it.khoId, maHang: it.maHang, thieu: miss, ngay: String(r.ngayTaoDon), sdt: String(r.soDienThoai || '') }); }
      if (take > 0) logs.push({ khoId: it.khoId, maHang: it.maHang, tenHang: it.tenHang, user: TKD_SYSTEM_USER_, loai: 'tru_don', before: before, after: it.ton, delta: -take, lyDo: 'Don ' + r.ngayTaoDon + ' ' + (r.soDienThoai || r.khachHang || '') + (miss > 0 ? ' (thieu ' + miss + ')' : ''), ref: key });
    });
    var le = { key: key, ngay: String(r.ngayTaoDon), sdt: String(r.soDienThoai || ''), trangThai: String(r.trangThai || ''), status: 'da_tru', applied: applied, shortage: shortLines.join('; '), problems: '' };
    if (e) { le.row = e.row; ledUpd.push(le); } else ledNew.push(le);
  }
  // don mo coi: da tru nhung khoa khong con trong sheet (don bi sua / xoa khoi Pos)
  Object.keys(led.map).forEach(function (k) { var x = led.map[k]; if (x.status === 'da_tru' && !seenKeys[k] && rep.orphans.length < 100) rep.orphans.push({ key: k, ngay: x.ngay, sdt: x.sdt }); });
  if (opts.apply) {
    Object.keys(dirty).forEach(function (rw) { L.sh.getRange(Number(rw), 1, 1, TONKHO_HEADERS.length).setValues([_tonkhoItemToRow_(dirty[rw])]); });
    ledUpd.forEach(function (x) { led.sh.getRange(x.row, 1, 1, TKD_HEADERS.length).setValues([_tkdLedgerRow_(x)]); });
    if (ledNew.length) led.sh.getRange(led.sh.getLastRow() + 1, 1, ledNew.length, TKD_HEADERS.length).setValues(ledNew.map(_tkdLedgerRow_));
    _tonkhoLog_(logs);
  }
  rep.unknownCodes = Object.keys(rep.unknownCodes).slice(0, 50).reduce(function (o, k) { o[k] = rep.unknownCodes[k]; return o; }, {});
  return rep;
}

function tonKhoTruDonStatus_() {
  var cfg = _tkdCfg_(), led = _tkdLedger_(), c = { da_tru: 0, da_hoan: 0, cho_duyet: 0 };
  Object.keys(led.map).forEach(function (k) { var s = led.map[k].status; if (c[s] !== undefined) c[s]++; });
  return { mode: cfg.mode, start: cfg.start, priority: cfg.priority, ledger: c, combos: readKhoCombo_().filter(function (x) { return x.active; }).length };
}
function tonKhoTruDonCauHinh_(data) {
  var a = _khoAuth_(data); if (a.err) return a.err;
  if (a.user.role !== 'admin') return jsonOut_({ error: 'Chi admin moi duoc doi cau hinh tru ton.', code: 'FORBIDDEN' });
  return _khoWithLock_(function () {
    if (data.mode !== undefined) {
      var m = String(data.mode);
      if (m !== 'off' && m !== 'dry' && m !== 'on') return jsonOut_({ error: 'Che do khong hop le (off / dry / on).' });
      if (m === 'on' && !(data.start !== undefined ? String(data.start).trim() : _tkdCfg_().start)) return jsonOut_({ error: 'Phai dat ngay bat dau truoc khi bat che do on.' });
      _tkdCfgSet_('mode', m);
    }
    if (data.start !== undefined) {
      var st = String(data.start).trim();
      if (st && !parseVNDate_(st)) return jsonOut_({ error: 'Ngay bat dau khong hop le (dung dd/MM/yyyy).' });
      _tkdCfgSet_('start', st);
    }
    if (data.priority !== undefined) {
      var ids = Array.isArray(data.priority) ? data.priority.map(String) : [], all = readKho_().map(function (k) { return k.id; });
      for (var i = 0; i < ids.length; i++) if (all.indexOf(ids[i]) === -1) return jsonOut_({ error: 'Kho uu tien khong ton tai: ' + ids[i] });
      _tkdCfgSet_('priority', JSON.stringify(ids));
    }
    return jsonOut_({ ok: true, config: tonKhoTruDonStatus_() });
  });
}
function tonKhoTruDonXemTruoc_(data) {
  var a = _khoAuth_(data); if (a.err) return a.err;
  if (a.user.role !== 'admin') return jsonOut_({ error: 'Chi admin moi xem truoc duoc.', code: 'FORBIDDEN' });
  return jsonOut_(_tkdRun_({ apply: false }));
}
function tonKhoTruDonChay_(data) {
  var a = _khoAuth_(data); if (a.err) return a.err;
  if (a.user.role !== 'admin') return jsonOut_({ error: 'Chi admin moi chay duoc.', code: 'FORBIDDEN' });
  if (_tkdCfg_().mode !== 'on') return jsonOut_({ error: "Che do dang '" + _tkdCfg_().mode + "'. Bat che do 'on' truoc khi chay that." });
  return _khoWithLock_(function () { return jsonOut_(_tkdRun_({ apply: true })); });
}
// Hoan tay 1 don mo coi (da tru nhung khoa khong con trong sheet): cong tra dung so da tru, danh dau da_hoan.
function tonKhoTruDonHoanTay_(data) {
  var a = _khoAuth_(data); if (a.err) return a.err;
  if (a.user.role !== 'admin') return jsonOut_({ error: 'Chi admin moi hoan duoc.', code: 'FORBIDDEN' });
  var key = String(data.key || '');
  return _khoWithLock_(function () {
    var led = _tkdLedger_(), e = led.map[key];
    if (!e) return jsonOut_({ error: 'Khong tim thay don trong so cai.' });
    if (e.status !== 'da_tru') return jsonOut_({ error: "Don dang o trang thai '" + e.status + "', khong co gi de hoan." });
    var L = _tonkhoLoad_(), now = _khoNowIso_(), logs = [], dirty = {};
    e.applied.forEach(function (ap) {
      var pos = L.idx[_tonkhoKey_(ap.khoId, ap.maHang)]; if (pos === undefined) return;
      var it = L.items[pos], before = it.ton; it.ton = Math.round((it.ton + ap.qty) * 1000) / 1000; it.ver += 1; it.updatedAt = now; it.updatedBy = a.user.username; dirty[it.row] = it;
      logs.push({ khoId: it.khoId, maHang: it.maHang, tenHang: it.tenHang, user: a.user.username, loai: 'hoan_don', before: before, after: it.ton, delta: ap.qty, lyDo: String(data.lyDo || 'Hoan tay don mo coi ' + e.ngay + ' ' + e.sdt), ref: key });
    });
    Object.keys(dirty).forEach(function (rw) { L.sh.getRange(Number(rw), 1, 1, TONKHO_HEADERS.length).setValues([_tonkhoItemToRow_(dirty[rw])]); });
    e.status = 'da_hoan'; e.note = 'Hoan tay boi ' + a.user.username; led.sh.getRange(e.row, 1, 1, TKD_HEADERS.length).setValues([_tkdLedgerRow_(e)]);
    _tonkhoLog_(logs);
    return jsonOut_({ ok: true, restored: e.applied.length });
  });
}

// ── Tu dong (trigger) + chay tay tu Apps Script Editor ──
function tonKhoTruDonTick_() {
  if (_tkdCfg_().mode !== 'on') return;
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return; }
  try { var r = _tkdRun_({ apply: true }); Logger.log('tonKhoTruDonTick_: ' + JSON.stringify({ deducted: r.deducted, reversed: r.reversed, held: r.held, error: r.error })); }
  catch (e2) { Logger.log('tonKhoTruDonTick_ loi: ' + String(e2 && e2.message || e2)); }
  finally { try { lock.releaseLock(); } catch (e3) {} }
}
function tonKhoTruDonCaiTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'tonKhoTruDonTick_') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tonKhoTruDonTick_').timeBased().everyMinutes(10).create();
  Logger.log('Da cai trigger tru ton moi 10 phut (chi chay that khi KhoCauHinh.mode = on).');
}
function tonKhoTruDonGoTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'tonKhoTruDonTick_') ScriptApp.deleteTrigger(t); });
  Logger.log('Da go trigger tru ton.');
}
function tonKhoTruDonXemTruocTay() { Logger.log(JSON.stringify(_tkdRun_({ apply: false }), null, 2)); }


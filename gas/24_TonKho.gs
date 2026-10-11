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


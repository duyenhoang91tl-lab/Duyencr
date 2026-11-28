// ═══════════════════════════════════════════════════════
//  THU VIEN ANH / GHI AM / MAU TIN (Social > Thu vien) — dung chung cho chat Pancake va chat noi bo.
//  Sheet "ThuVien" (tu tao): id, type(image|audio|template), name, tags, fileId, url, mime, size, text, createdBy, createdAt, deleted.
//  Tep luu trong folder Drive "CRM_ThuVien" (tu tao; hoac dat Script Property MLIB_FOLDER_ID), chia se "ai co link xem" de Pancake/chat mo duoc.
//  Moi action doi TOKEN PHIEN (_sessUser_), tai khoan demo khong dung. Xoa mem (deleted=1; tep Drive giu nguyen). Xoa/sua: nguoi tao hoac admin.
//  Gioi han: anh <= 6MB, ghi am <= 10MB (JSON base64 qua POST GAS). Mau tin <= 2000 ky tu.
// ═══════════════════════════════════════════════════════
var SH_MLIB_ = 'ThuVien';
var MLIB_HEADERS_ = ['id', 'type', 'name', 'tags', 'fileId', 'url', 'mime', 'size', 'text', 'createdBy', 'createdAt', 'deleted'];
var MLIB_TYPES_ = { image: 1, audio: 1, template: 1 };
var MLIB_MAX_BYTES_ = { image: 6 * 1024 * 1024, audio: 10 * 1024 * 1024 };
var MLIB_GET_ACTIONS_ = { mlibList: 1 };
var MLIB_POST_ACTIONS_ = { mlibUpload: 1, mlibAddDrive: 1, mlibSaveTpl: 1, mlibDelete: 1 };
function _mlibUser_(token) {
  var a = _sessUser_(token);
  if (!a) return { err: { ok: false, code: 'AUTH', error: 'Phien dang nhap het han hoac chua dang nhap.' } };
  if (String(a.role || '') === 'demo') return { err: { ok: false, error: 'Tai khoan test khong dung duoc thu vien.' } };
  return { u: { username: String(a.username || '').toLowerCase(), name: String(a.name || a.username || ''), admin: a.role === 'admin' } };
}
function _mlibSheet_() { return getSheet_(SH_MLIB_, MLIB_HEADERS_); }
function _mlibFolder_() {
  var pr = PropertiesService.getScriptProperties(), id = pr.getProperty('MLIB_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var it = DriveApp.getFoldersByName('CRM_ThuVien'), f = it.hasNext() ? it.next() : DriveApp.createFolder('CRM_ThuVien');
  pr.setProperty('MLIB_FOLDER_ID', f.getId());
  return f;
}
function _mlibUrl_(type, fileId) {
  return type === 'audio' ? 'https://drive.google.com/uc?export=download&id=' + fileId : 'https://drive.google.com/uc?export=view&id=' + fileId;
}
function _mlibClean_(s, max) { s = String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim(); s = s.length > max ? s.slice(0, max) : s; return /^[=+\-@]/.test(s) ? "'" + s : s; }
function _mlibDriveId_(s) {
  s = String(s || '').trim();
  var m = /\/d\/([A-Za-z0-9_-]{15,})/.exec(s) || /[?&]id=([A-Za-z0-9_-]{15,})/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{15,}$/.test(s) ? s : '';
}
function _mlibRow_(r) {
  return { id: String(r[0]), type: String(r[1]), name: String(r[2]), tags: String(r[3] || ''), fileId: String(r[4] || ''), url: String(r[5] || ''), mime: String(r[6] || ''),
           size: Number(r[7]) || 0, text: String(r[8] || ''), by: String(r[9] || ''), at: String(r[10] || '') };
}
function _mlibAppend_(rec) {
  var sh = _mlibSheet_();
  var id = 'ml' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  var at = new Date().toISOString();
  sh.appendRow([id, rec.type, _mlibClean_(rec.name, 120), _mlibClean_(rec.tags, 200), rec.fileId || '', rec.url || '', rec.mime || '', rec.size || 0, rec.text ? _mlibClean_(rec.text, 2000) : '', rec.by, at, '']);
  var o = _mlibRow_([id, rec.type, rec.name, rec.tags, rec.fileId, rec.url, rec.mime, rec.size, rec.text, rec.by, at]);
  return o;
}
function mlibList_(p) {
  var a = _mlibUser_(p.token); if (a.err) return a.err;
  var type = String(p.type || ''), sh = _mlibSheet_(), n = sh.getLastRow();
  if (n < 2) return { ok: true, items: [] };
  var vals = sh.getRange(2, 1, n - 1, MLIB_HEADERS_.length).getValues(), items = [];
  vals.forEach(function (r) { if (String(r[11]) === '1' || !MLIB_TYPES_[r[1]]) return; if (type && r[1] !== type) return; items.push(_mlibRow_(r)); });
  items.reverse();
  return { ok: true, items: items.slice(0, 500), me: a.u.username, admin: a.u.admin };
}
function mlibUpload_(d) {
  var a = _mlibUser_(d.token); if (a.err) return a.err;
  var type = String(d.type || '');
  if (type !== 'image' && type !== 'audio') return { ok: false, error: 'Loai tep khong hop le.' };
  var mime = String(d.mimeType || '').toLowerCase().split(';')[0];
  if (mime.indexOf(type + '/') !== 0) return { ok: false, error: type === 'image' ? 'Chi nhan tep anh.' : 'Chi nhan tep am thanh.' };
  if (!d.base64) return { ok: false, error: 'Thieu du lieu tep.' };
  var bytes = Utilities.base64Decode(String(d.base64));
  if (bytes.length > MLIB_MAX_BYTES_[type]) return { ok: false, error: 'Tep qua lon (toi da ' + Math.round(MLIB_MAX_BYTES_[type] / 1048576) + 'MB).' };
  var name = _mlibClean_(d.name || ('tep_' + Date.now()), 120) || ('tep_' + Date.now());
  var file = _mlibFolder_().createFile(Utilities.newBlob(bytes, mime, name.replace(/^'/, '')));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, item: _mlibAppend_({ type: type, name: name, tags: d.tags, fileId: file.getId(), url: _mlibUrl_(type, file.getId()), mime: mime, size: bytes.length, by: a.u.username }) };
}
function mlibAddDrive_(d) {
  var a = _mlibUser_(d.token); if (a.err) return a.err;
  var type = String(d.type || '');
  if (type !== 'image' && type !== 'audio') return { ok: false, error: 'Loai tep khong hop le.' };
  var id = _mlibDriveId_(d.link);
  if (!id) return { ok: false, error: 'Khong nhan ra link/ID Google Drive.' };
  var src;
  try { src = DriveApp.getFileById(id); } catch (e) { return { ok: false, error: 'Khong mo duoc tep. Hay chia se tep cho tai khoan chay GAS (hoac "ai co link") roi thu lai.' }; }
  var mime = String(src.getMimeType() || '').toLowerCase();
  if (mime.indexOf(type + '/') !== 0) return { ok: false, error: 'Tep nay khong phai ' + (type === 'image' ? 'anh' : 'am thanh') + ' (' + mime + ').' };
  if (src.getSize() > MLIB_MAX_BYTES_[type] * 3) return { ok: false, error: 'Tep qua lon.' };
  var name = _mlibClean_(d.name || src.getName(), 120);
  var file = src.makeCopy(name.replace(/^'/, ''), _mlibFolder_());   // sao chep vao folder thu vien de kiem soat quyen xem
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, item: _mlibAppend_({ type: type, name: name, tags: d.tags, fileId: file.getId(), url: _mlibUrl_(type, file.getId()), mime: mime, size: file.getSize(), by: a.u.username }) };
}
function mlibSaveTpl_(d) {
  var a = _mlibUser_(d.token); if (a.err) return a.err;
  var name = _mlibClean_(d.name, 120), text = String(d.text == null ? '' : d.text).trim();
  if (!name) return { ok: false, error: 'Thieu ten mau tin.' };
  if (!text) return { ok: false, error: 'Noi dung mau tin trong.' };
  if (text.length > 2000) return { ok: false, error: 'Mau tin qua dai (toi da 2000 ky tu).' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var id = String(d.id || '');
    if (id) {   // sua: nguoi tao hoac admin
      var sh = _mlibSheet_(), n = sh.getLastRow();
      var ids = n > 1 ? sh.getRange(2, 1, n - 1, 12).getValues() : [];
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === id && String(ids[i][11]) !== '1' && ids[i][1] === 'template') {
          if (!a.u.admin && String(ids[i][9]) !== a.u.username) return { ok: false, error: 'Chi nguoi tao hoac admin duoc sua.' };
          sh.getRange(i + 2, 3, 1, 1).setValue(name); sh.getRange(i + 2, 4, 1, 1).setValue(_mlibClean_(d.tags, 200)); sh.getRange(i + 2, 9, 1, 1).setValue(_mlibClean_(text, 2000));
          return { ok: true, item: _mlibRow_([id, 'template', name, _mlibClean_(d.tags, 200), '', '', '', 0, text, ids[i][9], ids[i][10]]) };
        }
      }
      return { ok: false, error: 'Khong tim thay mau tin.' };
    }
    return { ok: true, item: _mlibAppend_({ type: 'template', name: name, tags: d.tags, text: text, by: a.u.username }) };
  } finally { lock.releaseLock(); }
}
function mlibDelete_(d) {
  var a = _mlibUser_(d.token); if (a.err) return a.err;
  var id = String(d.id || ''); if (!id) return { ok: false, error: 'Thieu id.' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = _mlibSheet_(), n = sh.getLastRow(); if (n < 2) return { ok: false, error: 'Khong tim thay.' };
    var vals = sh.getRange(2, 1, n - 1, 12).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) !== id) continue;
      if (!a.u.admin && String(vals[i][9]) !== a.u.username) return { ok: false, error: 'Chi nguoi tao hoac admin duoc xoa.' };
      sh.getRange(i + 2, 12).setValue(1);
      return { ok: true };
    }
    return { ok: false, error: 'Khong tim thay.' };
  } finally { lock.releaseLock(); }
}
function mlibDoGet_(action, p) {
  try { return jsonOut_(mlibList_(p)); } catch (err) { return jsonOut_({ ok: false, error: 'Loi thu vien: ' + (err && err.message || err) }); }
}
function mlibDoPost_(action, d) {
  try {
    return jsonOut_(action === 'mlibUpload' ? mlibUpload_(d) : action === 'mlibAddDrive' ? mlibAddDrive_(d) : action === 'mlibSaveTpl' ? mlibSaveTpl_(d) : mlibDelete_(d));
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi thu vien: ' + (err && err.message || err) }); }
}

// ═══════════════════════════════════════════════════════
//  THU VIEN SAN PHAM (menu Social > Thu vien san pham) — moi san pham (theo bang gia DANH_MUC) hoac combo = 1 THU MUC anh, TOI DA 50 ANH / thu muc.
//  Sheet "ThuVienSP" (tu tao): id, productKey, productName, group, fileId, url, name, mime, size, createdBy, createdAt, deleted.
//  productKey = ten san pham bo dau/thuong/gon khoang trang (_plibKey_) — client gui ten, SERVER tu chuan hoa lai. Cac size/chat lieu cua cung 1 ten dung CHUNG 1 thu muc.
//  Combo dung chung co che: client gui productName = "Combo: <ten>", group = "Combo".
//  Tep luu trong folder Drive "CRM_ThuVienSanPham" (hoac Script Property PLIB_FOLDER_ID), moi san pham 1 thu muc con; chia se "ai co link xem".
//  Dung TOKEN PHIEN (_mlibUser_: demo khong dung). Xoa mem (deleted=1) de giai phong cho; xoa: nguoi tai len hoac admin. Anh <= 6MB.
//  GET plibList(token[, key]): khong key -> {counts:{key:{n,cover,name}}}; co key -> {items:[...]} cua thu muc do.  POST plibUpload / plibDelete.
// ═══════════════════════════════════════════════════════
var SH_PLIB_ = 'ThuVienSP';
var PLIB_HEADERS_ = ['id', 'productKey', 'productName', 'group', 'fileId', 'url', 'name', 'mime', 'size', 'createdBy', 'createdAt', 'deleted'];
var PLIB_MAX_PER_FOLDER_ = 50;
var PLIB_MAX_BYTES_ = 6 * 1024 * 1024;
var PLIB_GET_ACTIONS_ = { plibList: 1, plibDriveScan: 1, plibFolderImages: 1 };
var PLIB_POST_ACTIONS_ = { plibUpload: 1, plibDelete: 1, plibInfoSave: 1, plibLinkSave: 1 };
//  THONG TIN SAN PHAM (van ban tu do: y nghia, diem ban hang...) — sheet "ThuVienSPInfo": productKey, productName, group, info, updatedBy, updatedAt. Moi thu muc 1 dong; CHI ADMIN sua (server kiem), ai cung doc.
//  plibList khong key tra kem info trong counts (de o tim toan cuc tim ca trong noi dung); co key tra {info:{text,by,at}}. Luu rong = xoa noi dung. Cell ep dinh dang van ban (khong thanh cong thuc).
var SH_PLIBI_ = 'ThuVienSPInfo';
var PLIBI_HEADERS_ = ['productKey', 'productName', 'group', 'info', 'updatedBy', 'updatedAt'];
var PLIBI_MAX_ = 4000;
//  ANH CO SAN TREN DRIVE (nguon): thu muc goc "Hinh anh theo File Gia" cua Duyen (id mac dinh PLIB_SRC_DEFAULT_, doi bang Script Property PLIB_SRC_FOLDER_ID). CRM CHI DOC, khong tai/di chuyen/doi quyen tep cua Duyen.
//  plibDriveScan (GET): quet cay thu muc goc toi PLIB_SRC_MAX_DEPTH_ cap -> [{id,name,path}] (cache 10 phut; fresh=1 bo cache) + links (gan tay). KHOP THEO TEN lam o client (co bang gia), server chi liet ke.
//  plibFolderImages (GET): liet ke anh (image/*) trong 1 thu muc — CHI chap nhan thu muc nam trong cay goc (_plibInRoot_), khong thi ai cung doc duoc thu muc Drive bat ky ma tai khoan chay script thay.
//  plibLinkSave (POST, CHI ADMIN): gan tay 1 thu muc Drive (link hoac id) cho 1 SP/combo khi ten khong khop; de trong = go gan. Sheet "ThuVienSPLink" (1 dong/thu muc, productKey duy nhat).
var SH_PLIBL_ = 'ThuVienSPLink';
var PLIBL_HEADERS_ = ['productKey', 'productName', 'folderId', 'folderName', 'linkedBy', 'linkedAt'];
var PLIB_SRC_DEFAULT_ = '1Do-SdTTHKORNYBumpJYNUzl_H1u_x8rh';
var PLIB_SRC_MAX_DEPTH_ = 3;
var PLIB_SRC_MAX_FOLDERS_ = 3000;
var PLIB_SRC_MAX_IMAGES_ = 200;
function _plibSrcId_() { return PropertiesService.getScriptProperties().getProperty('PLIB_SRC_FOLDER_ID') || PLIB_SRC_DEFAULT_; }
function _plibSrcErr_(e) {
  var who = ''; try { who = Session.getEffectiveUser().getEmail(); } catch (x) {}
  return { ok: false, srcError: true, error: 'Khong mo duoc thu muc anh tren Drive' + (who ? ' — hay chia se thu muc do cho ' + who + ' (quyen Nguoi xem)' : '') + '. ' + String(e && e.message || e).slice(0, 120) };
}
function _plibIdFromUrl_(s) {
  s = String(s || '').trim(); if (!s) return '';
  var m = /\/folders\/([-\w]{10,})/.exec(s) || /[?&]id=([-\w]{10,})/.exec(s) || /^([-\w]{10,})$/.exec(s);
  return m ? m[1] : '';
}
function _plibInRoot_(folder, rootId) {
  var f = folder, hop = 0;
  while (f && hop++ < 8) {
    if (f.getId() === rootId) return true;
    var ps = f.getParents(); f = ps.hasNext() ? ps.next() : null;
  }
  return false;
}
function _plibScan_() {
  var root = DriveApp.getFolderById(_plibSrcId_()), out = [], queue = [{ f: root, path: '', d: 0 }], t0 = Date.now(), cut = false;
  while (queue.length) {
    if (Date.now() - t0 > 200000) { cut = true; break; }
    var cur = queue.shift(), it = cur.f.getFolders();
    while (it.hasNext()) {
      if (out.length >= PLIB_SRC_MAX_FOLDERS_) { cut = true; break; }
      var f = it.next(), name = f.getName(), path = cur.path ? cur.path + ' / ' + name : name;
      out.push({ id: f.getId(), name: name, path: path });
      if (cur.d + 1 < PLIB_SRC_MAX_DEPTH_) queue.push({ f: f, path: path, d: cur.d + 1 });
    }
    if (cut) break;
  }
  return { rootName: root.getName(), rootId: root.getId(), folders: out, truncated: cut };
}
function _plibLinkRows_() {
  var sh = getSheet_(SH_PLIBL_, PLIBL_HEADERS_), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, PLIBL_HEADERS_.length).getValues();
}
function _plibLinks_() {
  var m = {};
  _plibLinkRows_().forEach(function (r) { if (r[0] && r[2]) m[String(r[0])] = { folderId: String(r[2]), name: String(r[3] || '') }; });
  return m;
}
function plibDriveScan_(p) {
  var a = _mlibUser_(p.token); if (a.err) return a.err;
  var cache = null, ck = 'plibScan_' + _plibSrcId_(), res = null;
  try { cache = CacheService.getScriptCache(); } catch (e) {}
  if (!p.fresh && cache) { try { var c = cache.get(ck); if (c) res = JSON.parse(c); } catch (e) {} }
  if (!res) {
    try { res = _plibScan_(); } catch (e) { return _plibSrcErr_(e); }
    if (cache && !res.truncated) { try { var js = JSON.stringify(res); if (js.length < 95000) cache.put(ck, js, 600); } catch (e) {} }
  }
  return { ok: true, rootName: res.rootName, folders: res.folders, truncated: !!res.truncated, links: _plibLinks_(), admin: a.u.admin };
}
function plibFolderImages_(p) {
  var a = _mlibUser_(p.token); if (a.err) return a.err;
  var id = _plibIdFromUrl_(p.folderId); if (!id) return { ok: false, error: 'Thieu id thu muc.' };
  var folder;
  try { folder = DriveApp.getFolderById(id); } catch (e) { return _plibSrcErr_(e); }
  if (!_plibInRoot_(folder, _plibSrcId_())) return { ok: false, error: 'Thu muc nay nam ngoai thu muc anh da cau hinh.' };
  var items = [], more = false, it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next(), mime = String(f.getMimeType() || '');
    if (mime.indexOf('image/') !== 0) continue;
    if (items.length >= PLIB_SRC_MAX_IMAGES_) { more = true; break; }
    items.push({ fileId: f.getId(), name: f.getName(), mime: mime, size: f.getSize(), url: 'https://drive.google.com/file/d/' + f.getId() + '/view' });
  }
  items.sort(function (x, y) { return x.name < y.name ? -1 : x.name > y.name ? 1 : 0; });
  return { ok: true, folderId: id, name: folder.getName(), items: items, more: more };
}
function plibLinkSave_(d) {
  var a = _mlibUser_(d.token); if (a.err) return a.err;
  if (!a.u.admin) return { ok: false, error: 'Chi admin duoc gan thu muc Drive.' };
  var pname = _mlibClean_(d.productName, 120).replace(/^'/, ''), key = _plibKey_(pname);
  if (!key) return { ok: false, error: 'Thieu ten san pham.' };
  var raw = String(d.folder || '').trim(), id = '', fname = '';
  if (raw) {
    id = _plibIdFromUrl_(raw); if (!id) return { ok: false, error: 'Link / id thu muc khong hop le.' };
    var folder;
    try { folder = DriveApp.getFolderById(id); } catch (e) { return _plibSrcErr_(e); }
    if (!_plibInRoot_(folder, _plibSrcId_())) return { ok: false, error: 'Thu muc nay nam ngoai thu muc anh da cau hinh nen khong gan duoc.' };
    fname = _mlibClean_(folder.getName(), 120).replace(/^'/, '');
  }
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = getSheet_(SH_PLIBL_, PLIBL_HEADERS_), vals = _plibLinkRows_(), at = new Date().toISOString(), row = [key, pname, id, fname, a.u.username, at];
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) !== key) continue;
      var rg = sh.getRange(i + 2, 1, 1, PLIBL_HEADERS_.length); rg.setNumberFormat('@'); rg.setValues([row]);
      return { ok: true, link: id ? { folderId: id, name: fname } : null };
    }
    if (id) { var nr = sh.getLastRow() + 1, rg2 = sh.getRange(nr, 1, 1, PLIBL_HEADERS_.length); rg2.setNumberFormat('@'); rg2.setValues([row]); }
    return { ok: true, link: id ? { folderId: id, name: fname } : null };
  } finally { lock.releaseLock(); }
}
function _plibInfoSheet_() { return getSheet_(SH_PLIBI_, PLIBI_HEADERS_); }
function _plibInfoRows_() {
  var sh = _plibInfoSheet_(), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, PLIBI_HEADERS_.length).getValues();
}
function _plibKey_(s) { return _stripVN_(s).replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120); }
function _plibSheet_() { return getSheet_(SH_PLIB_, PLIB_HEADERS_); }
function _plibRoot_() {
  var pr = PropertiesService.getScriptProperties(), id = pr.getProperty('PLIB_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var it = DriveApp.getFoldersByName('CRM_ThuVienSanPham'), f = it.hasNext() ? it.next() : DriveApp.createFolder('CRM_ThuVienSanPham');
  pr.setProperty('PLIB_FOLDER_ID', f.getId());
  return f;
}
function _plibFolder_(name) {
  var root = _plibRoot_(), label = _mlibClean_(name, 100).replace(/^'/, '') || 'San pham';
  var it = root.getFoldersByName(label);
  return it.hasNext() ? it.next() : root.createFolder(label);
}
function _plibRow_(r) {
  return { id: String(r[0]), key: String(r[1]), productName: String(r[2]), group: String(r[3] || ''), fileId: String(r[4] || ''), url: String(r[5] || ''),
           name: String(r[6] || ''), mime: String(r[7] || ''), size: Number(r[8]) || 0, by: String(r[9] || ''), at: String(r[10] || '') };
}
function _plibRows_() {
  var sh = _plibSheet_(), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, PLIB_HEADERS_.length).getValues();
}
function plibList_(p) {
  var a = _mlibUser_(p.token); if (a.err) return a.err;
  var key = p.key ? _plibKey_(p.key) : '', vals = _plibRows_(), infos = _plibInfoRows_(), out = { ok: true, max: PLIB_MAX_PER_FOLDER_, me: a.u.username, admin: a.u.admin };
  if (key) {
    var items = [];
    vals.forEach(function (r) { if (String(r[11]) !== '1' && String(r[1]) === key) items.push(_plibRow_(r)); });
    items.reverse();
    out.key = key; out.items = items.slice(0, PLIB_MAX_PER_FOLDER_); out.n = items.length;
    out.info = { text: '', by: '', at: '' }; out.link = _plibLinks_()[key] || null;
    infos.forEach(function (r) { if (String(r[0]) === key) out.info = { text: String(r[3] || ''), by: String(r[4] || ''), at: String(r[5] || '') }; });
    return out;
  }
  var counts = {};
  vals.forEach(function (r) {
    if (String(r[11]) === '1') return;
    var k = String(r[1]), c = counts[k] || (counts[k] = { n: 0, cover: '', name: String(r[2]), info: '' });
    c.n++; c.cover = String(r[4] || c.cover);   // dong cuoi = anh moi nhat lam anh bia
  });
  infos.forEach(function (r) {   // thu muc chi co thong tin (chua co anh) van hien
    var k = String(r[0]), t = String(r[3] || ''); if (!k || !t) return;
    var c = counts[k] || (counts[k] = { n: 0, cover: '', name: String(r[1]), info: '' });
    c.info = t;
  });
  out.counts = counts; out.links = _plibLinks_();
  return out;
}
function plibUpload_(d) {
  var a = _mlibUser_(d.token); if (a.err) return a.err;
  var pname = _mlibClean_(d.productName, 120).replace(/^'/, ''), key = _plibKey_(pname);
  if (!key) return { ok: false, error: 'Thieu ten san pham.' };
  var mime = String(d.mimeType || '').toLowerCase().split(';')[0];
  if (mime.indexOf('image/') !== 0) return { ok: false, error: 'Chi nhan tep anh.' };
  if (!d.base64) return { ok: false, error: 'Thieu du lieu tep.' };
  var bytes = Utilities.base64Decode(String(d.base64));
  if (bytes.length > PLIB_MAX_BYTES_) return { ok: false, error: 'Tep qua lon (toi da ' + Math.round(PLIB_MAX_BYTES_ / 1048576) + 'MB).' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var vals = _plibRows_(), cnt = 0, firstName = '';
    vals.forEach(function (r) { if (String(r[1]) === key) { if (!firstName) firstName = String(r[2]); if (String(r[11]) !== '1') cnt++; } });
    if (firstName) pname = firstName;   // cung key luon dung TEN thu muc Drive da co (tranh tao 2 thu muc vi khac hoa/thuong/dau)
    if (cnt >= PLIB_MAX_PER_FOLDER_) return { ok: false, full: true, error: 'Thu muc nay da du ' + PLIB_MAX_PER_FOLDER_ + ' anh — xoa bot anh cu roi tai tiep.' };
    var fname = _mlibClean_(d.name || ('anh_' + Date.now()), 120).replace(/^'/, '') || ('anh_' + Date.now());
    var file = _plibFolder_(pname).createFile(Utilities.newBlob(bytes, mime, fname));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var id = 'pl' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), at = new Date().toISOString();
    var url = 'https://drive.google.com/uc?export=view&id=' + file.getId();
    _plibSheet_().appendRow([id, key, pname, _mlibClean_(d.group, 80), file.getId(), url, fname, mime, bytes.length, a.u.username, at, '']);
    return { ok: true, n: cnt + 1, max: PLIB_MAX_PER_FOLDER_, item: _plibRow_([id, key, pname, d.group, file.getId(), url, fname, mime, bytes.length, a.u.username, at]) };
  } finally { lock.releaseLock(); }
}
function plibDelete_(d) {
  var a = _mlibUser_(d.token); if (a.err) return a.err;
  var id = String(d.id || ''); if (!id) return { ok: false, error: 'Thieu id.' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var vals = _plibRows_();
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) !== id || String(vals[i][11]) === '1') continue;
      if (!a.u.admin && String(vals[i][9]) !== a.u.username) return { ok: false, error: 'Chi nguoi tai len hoac admin duoc xoa.' };
      _plibSheet_().getRange(i + 2, 12).setValue(1);
      return { ok: true };
    }
    return { ok: false, error: 'Khong tim thay.' };
  } finally { lock.releaseLock(); }
}
function plibInfoSave_(d) {
  var a = _mlibUser_(d.token); if (a.err) return a.err;
  if (!a.u.admin) return { ok: false, error: 'Chi admin duoc sua thong tin san pham.' };
  var pname = _mlibClean_(d.productName, 120).replace(/^'/, ''), key = _plibKey_(pname);
  if (!key) return { ok: false, error: 'Thieu ten san pham.' };
  var text = String(d.info == null ? '' : d.info).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\r\n?/g, '\n').trim();
  if (text.length > PLIBI_MAX_) return { ok: false, error: 'Thong tin qua dai (toi da ' + PLIBI_MAX_ + ' ky tu).' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = _plibInfoSheet_(), vals = _plibInfoRows_(), at = new Date().toISOString(), group = _mlibClean_(d.group, 80);
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) !== key) continue;
      var row = sh.getRange(i + 2, 3, 1, 4);   // group, info, updatedBy, updatedAt
      row.setNumberFormat('@'); row.setValues([[group || String(vals[i][2] || ''), text, a.u.username, at]]);
      return { ok: true, info: { text: text, by: a.u.username, at: at } };
    }
    var nr = sh.getLastRow() + 1, rg = sh.getRange(nr, 1, 1, PLIBI_HEADERS_.length);
    rg.setNumberFormat('@'); rg.setValues([[key, pname, group, text, a.u.username, at]]);
    return { ok: true, info: { text: text, by: a.u.username, at: at } };
  } finally { lock.releaseLock(); }
}
function plibDoGet_(action, p) {
  try { return jsonOut_(action === 'plibDriveScan' ? plibDriveScan_(p) : action === 'plibFolderImages' ? plibFolderImages_(p) : plibList_(p)); } catch (err) { return jsonOut_({ ok: false, error: 'Loi thu vien san pham: ' + (err && err.message || err) }); }
}
function plibDoPost_(action, d) {
  try { return jsonOut_(action === 'plibUpload' ? plibUpload_(d) : action === 'plibInfoSave' ? plibInfoSave_(d) : action === 'plibLinkSave' ? plibLinkSave_(d) : plibDelete_(d)); }
  catch (err) { return jsonOut_({ ok: false, error: 'Loi thu vien san pham: ' + (err && err.message || err) }); }
}


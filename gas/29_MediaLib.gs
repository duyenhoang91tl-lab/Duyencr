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

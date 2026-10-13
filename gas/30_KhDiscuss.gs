// ═══════════════════════════════════════════════════════
//  THAO LUAN KHACH (noi bo) — o "Thao luan" canh o Chat Pancake: nhan vien nhan cho nhau ve 1 khach, @ten de tag.
//  Sheet KhThaoLuan: id | phone | author | authorUser | text | mentions(JSON ten hien thi) | ts(ISO) | deleted.
//  GET khDiscuss(token, phone, after?) -> toi da 150 tin moi nhat cua khach (tang dan theo gio); POST khDiscussSend(token, phone, text),
//  khDiscussDelete(token, id). Nguoi gui lay tu PHIEN (khong tin client). @tag -> _notifyMentions_ (kind 'khthread', refType 'customer'),
//  cung kenh thong bao voi @tag ghi chu/cong viec (client js/39). Tai khoan demo KHONG dung duoc (nhu chat). Loi chi tra {ok:false}.
// ═══════════════════════════════════════════════════════
var SH_KHD_ = 'KhThaoLuan';
var KHD_HEADERS_ = ['id', 'phone', 'author', 'authorUser', 'text', 'mentions', 'ts', 'deleted'];
var KHD_MAX_TEXT_ = 1500;
var KHD_LIMIT_ = 150;
var KHD_TAIL_ROWS_ = 5000;
var KHD_RATE_MS_ = 600;
var KHD_GET_ACTIONS_ = { khDiscuss: 1 };
var KHD_POST_ACTIONS_ = { khDiscussSend: 1, khDiscussDelete: 1 };

function _khdPhone_(p) {
  var d = String(p == null ? '' : p).replace(/\D/g, '');
  if (d.indexOf('84') === 0 && d.length >= 11) d = '0' + d.slice(2);
  else if (d.charAt(0) !== '0' && d.length === 9) d = '0' + d;
  return /^0\d{8,10}$/.test(d) ? d : '';
}
function _khdSheet_() {
  var existed = !!getCrmSS_().getSheetByName(SH_KHD_);
  var sh = getSheet_(SH_KHD_, KHD_HEADERS_);
  if (!existed) { try { sh.getRange(1, 2, sh.getMaxRows(), 1).setNumberFormat('@'); sh.getRange(1, 7, sh.getMaxRows(), 1).setNumberFormat('@'); } catch (e) {} }
  return sh;
}
function _khdMsg_(r) {
  var m = []; try { m = JSON.parse(r[5] || '[]'); } catch (e) { m = []; }
  return { id: String(r[0]), author: String(r[2] || ''), authorUser: String(r[3] || ''), text: String(r[4] || ''), mentions: m, ts: String(r[6] || '') };
}
function khdList_(p) {
  var au = _chatUser_(p.token); if (!au.ok) return au;
  var phone = _khdPhone_(p.phone); if (!phone) return { ok: false, error: 'SDT khong hop le.' };
  var sh = _khdSheet_(), last = sh.getLastRow(), out = [];
  if (last >= 2) {
    var start = Math.max(2, last - KHD_TAIL_ROWS_ + 1);
    var v = sh.getRange(start, 1, last - start + 1, KHD_HEADERS_.length).getValues(), after = String(p.after || '');
    for (var i = 0; i < v.length; i++) {
      if (!v[i][0] || String(v[i][7]) === '1' || _khdPhone_(v[i][1]) !== phone) continue;
      if (after && String(v[i][6]) <= after) continue;
      out.push(_khdMsg_(v[i]));
    }
  }
  if (out.length > KHD_LIMIT_) out = out.slice(out.length - KHD_LIMIT_);
  return { ok: true, phone: phone, me: au.u.username, messages: out, now: new Date().toISOString() };
}
function khdSend_(d) {
  var au = _chatUser_(d.token); if (!au.ok) return au;
  var u = au.u, phone = _khdPhone_(d.phone); if (!phone) return { ok: false, error: 'SDT khong hop le.' };
  var text = String(d.text == null ? '' : d.text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (!text) return { ok: false, error: 'Tin nhan trong.' };
  if (text.length > KHD_MAX_TEXT_) return { ok: false, error: 'Tin nhan qua dai (toi da ' + KHD_MAX_TEXT_ + ' ky tu).' };
  var cache = CacheService.getScriptCache(), rk = 'khdrl_' + u.username, lastT = _chatNum_(cache.get(rk));
  if (lastT && Date.now() - lastT < KHD_RATE_MS_) return { ok: false, error: 'Gui qua nhanh, cho 1 chut roi gui lai.' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(4000); } catch (eL) { return { ok: false, error: 'He thong dang ban, thu gui lai sau vai giay.' }; }
  try {
    var id = 'kd_' + Date.now() + '_' + Math.floor(Math.random() * 1000), ts = new Date().toISOString();
    var mentions = _taskMentionNames_(text, []);
    _khdSheet_().appendRow([id, phone, _chatSafeCell_(u.name), u.username, _chatSafeCell_(text), JSON.stringify(mentions), ts, '']);
    cache.put(rk, String(Date.now()), 30);
    _notifyMentions_({ text: text, from: u.name, fromUser: u.username, kind: 'khthread', refType: 'customer', refId: phone, refId2: id });
    return { ok: true, message: { id: id, author: u.name, authorUser: u.username, text: text, mentions: mentions, ts: ts } };
  } finally { try { lock.releaseLock(); } catch (eR) {} }
}
function khdDelete_(d) {
  var au = _chatUser_(d.token); if (!au.ok) return au;
  var u = au.u, id = String(d.id || '');
  if (!id) return { ok: false, error: 'Thieu id.' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(4000); } catch (eL) { return { ok: false, error: 'He thong dang ban, thu lai sau.' }; }
  try {
    var sh = _khdSheet_(), last = sh.getLastRow(); if (last < 2) return { ok: false, error: 'Khong thay tin nhan.' };
    var start = Math.max(2, last - KHD_TAIL_ROWS_ + 1), ids = sh.getRange(start, 1, last - start + 1, 4).getValues();
    for (var i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) !== id) continue;
      // chot chan that: chi xoa tin cua chinh minh; Admin xoa duoc het (nhu ghi chu khach)
      if (String(ids[i][3]).toLowerCase() !== u.username && u.role !== 'admin') return { ok: false, error: 'Ban chi xoa duoc tin cua chinh minh.' };
      sh.getRange(start + i, 8).setValue('1');
      return { ok: true, id: id };
    }
    return { ok: false, error: 'Khong thay tin nhan.' };
  } finally { try { lock.releaseLock(); } catch (eR) {} }
}
function khdDoGet_(p) {
  try { return jsonOut_(khdList_(p)); } catch (err) { return jsonOut_({ ok: false, error: 'Loi thao luan: ' + (err && err.message || err) }); }
}
function khdDoPost_(action, d) {
  try { return jsonOut_(action === 'khDiscussSend' ? khdSend_(d) : khdDelete_(d)); }
  catch (err) { return jsonOut_({ ok: false, error: 'Loi thao luan: ' + (err && err.message || err) }); }
}

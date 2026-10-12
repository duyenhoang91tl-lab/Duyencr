// ═══════════════════════════════════════════════════════════════════════════════════════
//  CHAT NOI BO (them 2026-10-11): CS nhan tin cho nhau trong CRM — kenh chung / kenh team / nhom rieng / tin nhan 1-1.
//  Thiet ke (GAS la nguon du lieu chinh, Supabase chua bat han nen chat di theo duong GAS, khong them ha tang moi):
//   - Sheet "Chat_Kenh" (kenh tu tao + kenh 1-1 'dm:a|b' tao luc nhan tin dau) va "Chat_TinNhan" (chi them dong, xoa mem).
//   - Kenh co san KHONG luu sheet: 'general' (tat ca), 'team:<ten team viet thuong>' (thanh vien team do; admin thay moi team).
//   - MOI action doi token phien hop le (_sessUser_). Nguoi gui lay tu TOKEN o server, KHONG tin ten client gui len.
//     Quyen vao kenh kiem o server (public: ai cung vao; private/dm: chi thanh vien; team: dung team hoac admin).
//   - Cho tin moi = poll nhe: chatPoll chi doc 1 gia tri cache (chat_last) neu khong co tin moi -> khong cham sheet.
//     Tin moi doc tu "vong dem" CacheService (200 tin gan nhat) truoc, thieu moi doc duoi sheet.
//   - Noi dung tin bat dau bang = + - @ bi chen dau ' truoc khi ghi sheet de Google Sheets KHONG hieu la cong thuc.
//   - Xoa mem: cot deleted=1 (giu noi dung cho admin doi chieu), tang 'dver' de client tai lai kenh dang mo.
// ═══════════════════════════════════════════════════════════════════════════════════════
var SH_CHAT_CH_ = 'Chat_Kenh';
var CHAT_CH_HEADERS_ = ['id', 'name', 'type', 'members', 'createdBy', 'createdAt', 'archived', 'desc'];
var SH_CHAT_MSG_ = 'Chat_TinNhan';
var CHAT_MSG_HEADERS_ = ['id', 'channel', 'from', 'fromName', 'text', 'ts', 'replyTo', 'deleted'];
var CHAT_MAX_TEXT_ = 2000;
var CHAT_RING_MAX_ = 200;
var CHAT_RATE_MS_ = 500;
var CHAT_TAIL_ROWS_ = 600;
var CHAT_MAX_MEMBERS_ = 100;
var CHAT_GET_ACTIONS_ = { chatPoll: 1, chatChannels: 1, chatHistory: 1 };
var CHAT_POST_ACTIONS_ = { chatSend: 1, chatDelete: 1, chatCreateChannel: 1, chatUpdateChannel: 1 };

function _chatAuthErr_() { return { ok: false, code: 'AUTH', error: 'Phien dang nhap het han hoac chua dang nhap - dang nhap lai roi thu lai.' }; }
function _chatUser_(token) {
  var acct = _sessUser_(token);
  if (!acct) return _chatAuthErr_();
  var un = String(acct.username || '').trim().toLowerCase();
  return { ok: true, u: { username: un, name: String(acct.name || acct.username || ''), team: String(acct.team || '').trim(), role: acct.role || 'cs' } };
}
function _chatNum_(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function _chatLastId_() {
  var v = CacheService.getScriptCache().get('chat_last');
  if (v) return _chatNum_(v);
  return _chatNum_(PropertiesService.getScriptProperties().getProperty('chatLastId'));
}
function _chatVer_(key) {   // 'chver' (danh sach kenh doi) | 'dver' (co tin bi xoa)
  var v = CacheService.getScriptCache().get('chat_' + key);
  if (v) return _chatNum_(v);
  return _chatNum_(PropertiesService.getScriptProperties().getProperty('chat_' + key));
}
function _chatBump_(key) {
  var now = String(Date.now());
  PropertiesService.getScriptProperties().setProperty('chat_' + key, now);
  CacheService.getScriptCache().put('chat_' + key, now, 21600);
}
function _chatSafeCell_(s) { s = String(s == null ? '' : s); return /^[=+\-@]/.test(s) ? "'" + s : s; }

function _chatMsgSheet_() {
  var existed = !!getCrmSS_().getSheetByName(SH_CHAT_MSG_);
  var sh = getSheet_(SH_CHAT_MSG_, CHAT_MSG_HEADERS_);
  if (!existed) { try { sh.getRange(1, 3, sh.getMaxRows(), 3).setNumberFormat('@'); sh.getRange(1, 7, sh.getMaxRows(), 1).setNumberFormat('@'); } catch (e) {} }
  return sh;
}
function _chatChSheet_() {
  var existed = !!getCrmSS_().getSheetByName(SH_CHAT_CH_);
  var sh = getSheet_(SH_CHAT_CH_, CHAT_CH_HEADERS_);
  if (!existed) { try { sh.getRange(1, 2, sh.getMaxRows(), 1).setNumberFormat('@'); sh.getRange(1, 8, sh.getMaxRows(), 1).setNumberFormat('@'); } catch (e) {} }
  return sh;
}
// Kenh tu tao + kenh 1-1 (doc sheet, cache 6 gio, xoa cache khi doi).
function _chatCustomChannels_() {
  var cache = CacheService.getScriptCache(), raw = cache.get('chat_chs');
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  var out = [], sh = _chatChSheet_();
  if (sh.getLastRow() >= 2) {
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, CHAT_CH_HEADERS_.length).getValues();
    for (var i = 0; i < v.length; i++) {
      if (!v[i][0]) continue;
      var m = []; try { m = JSON.parse(v[i][3] || '[]'); } catch (e2) { m = []; }
      out.push({ id: String(v[i][0]), name: String(v[i][1] || ''), type: String(v[i][2] || 'private'), members: m,
        createdBy: String(v[i][4] || ''), createdAt: _chatNum_(v[i][5]),
        archived: v[i][6] === true || v[i][6] === 'TRUE' || v[i][6] === 1 || v[i][6] === '1', desc: String(v[i][7] || '') });
    }
  }
  try { cache.put('chat_chs', JSON.stringify(out), 21600); } catch (e3) {}
  return out;
}
function _chatActiveUsers_() {
  return readUsers_(getCrmSS_().getSheetByName(SH_USER)).filter(function (x) { return x.active !== false; });
}
// Tra mo ta kenh neu u duoc vao, nguoc lai null. customs = _chatCustomChannels_().
function _chatAccess_(u, chId, customs) {
  chId = String(chId || '');
  if (chId === 'general') return { id: 'general', name: 'Chung', type: 'general', desc: 'Kenh chung cho tat ca nhan vien' };
  if (chId.indexOf('team:') === 0) {
    var tn = chId.slice(5);
    if (!tn) return null;
    if (u.role !== 'admin' && String(u.team || '').toLowerCase() !== tn) return null;
    return { id: chId, name: 'Team ' + tn, type: 'team', desc: 'Kenh rieng cua team' };
  }
  for (var i = 0; i < customs.length; i++) {
    var c = customs[i];
    if (c.id !== chId || c.archived) continue;
    if (c.type === 'public') return c;
    if ((c.type === 'private' || c.type === 'dm') && c.members.indexOf(u.username) !== -1) return c;
    return null;
  }
  return null;
}
function _chatListFor_(u) {
  var customs = _chatCustomChannels_(), out = [];
  out.push({ id: 'general', name: 'Chung', type: 'general', desc: 'Kenh chung cho tat ca nhan vien', members: [], canManage: false });
  var teams = {};
  if (u.role === 'admin') { _chatActiveUsers_().forEach(function (x) { var t = String(x.team || '').trim().toLowerCase(); if (t) teams[t] = 1; }); }
  else if (u.team) teams[String(u.team).toLowerCase()] = 1;
  Object.keys(teams).sort().forEach(function (t) { out.push({ id: 'team:' + t, name: 'Team ' + t, type: 'team', desc: 'Kenh rieng cua team', members: [], canManage: false }); });
  customs.forEach(function (c) {
    if (c.archived) return;
    var ok = c.type === 'public' || c.members.indexOf(u.username) !== -1;
    if (!ok) return;
    out.push({ id: c.id, name: c.name, type: c.type, desc: c.desc, createdBy: c.createdBy,
      members: c.type === 'public' ? [] : c.members, canManage: c.type !== 'dm' && (u.role === 'admin' || c.createdBy === u.username) });
  });
  return out;
}
function _chatRec_(row) {   // dong sheet -> ban ghi gon gui client
  return { id: _chatNum_(row[0]), c: String(row[1]), u: String(row[2]), n: String(row[3]), t: String(row[4]), ts: _chatNum_(row[5]), r: String(row[6] || '') };
}
function _chatRingGet_() {
  var raw = CacheService.getScriptCache().get('chat_ring');
  if (!raw) return null;
  try { var r = JSON.parse(raw); return Array.isArray(r) ? r : null; } catch (e) { return null; }
}
function _chatRingPut_(r) {
  while (r.length > CHAT_RING_MAX_) r.shift();
  var s = JSON.stringify(r);
  while (s.length > 90000 && r.length > 20) { r.shift(); s = JSON.stringify(r); }   // moi key CacheService toi da 100KB
  try { CacheService.getScriptCache().put('chat_ring', s, 21600); } catch (e) {}
}
// Doc N dong cuoi cua sheet tin nhan (bo qua xoa mem).
function _chatTail_(sh, n) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var start = Math.max(2, last - n + 1);
  var v = sh.getRange(start, 1, last - start + 1, CHAT_MSG_HEADERS_.length).getValues(), out = [];
  for (var i = 0; i < v.length; i++) { if (!v[i][0]) continue; var del = v[i][7]; if (del === 1 || del === '1' || del === true) continue; out.push(_chatRec_(v[i])); }
  return out;
}
function _chatSince_(since) {
  var ring = _chatRingGet_();
  if (ring && ring.length && ring[0].id <= since) return ring.filter(function (m) { return m.id > since; });
  var tail = _chatTail_(_chatMsgSheet_(), CHAT_TAIL_ROWS_);
  if (!ring) _chatRingPut_(tail.slice(-CHAT_RING_MAX_));   // cache het han -> nap lai vong dem
  return tail.filter(function (m) { return m.id > since; });
}

function chatChannels_(p) {
  var au = _chatUser_(p.token); if (!au.ok) return au;
  var users = _chatActiveUsers_().map(function (x) { return { username: String(x.username).trim().toLowerCase(), name: x.name || x.username, team: x.team || '', role: x.role || 'cs' }; });
  return { ok: true, me: au.u, channels: _chatListFor_(au.u), users: users, chver: _chatVer_('chver'), last: _chatLastId_() };
}
function chatPoll_(p) {
  if (!_sessVerify_(p.token)) return _chatAuthErr_();   // buoc nhe: chi kiem chu ky token, chua doc sheet Users
  var since = _chatNum_(p.since), last = _chatLastId_();
  var res = { ok: true, last: last, chver: _chatVer_('chver'), dver: _chatVer_('dver'), msgs: [] };
  if (since >= last) return res;                       // duong nhanh: khong co tin moi
  var au = _chatUser_(p.token); if (!au.ok) return au;
  var customs = _chatCustomChannels_(), memo = {};
  _chatSince_(since).forEach(function (m) {
    if (memo[m.c] === undefined) memo[m.c] = !!_chatAccess_(au.u, m.c, customs);
    if (memo[m.c]) res.msgs.push(m);
  });
  if (res.msgs.length > 200) res.msgs = res.msgs.slice(-200);
  return res;
}
function chatHistory_(p) {
  var au = _chatUser_(p.token); if (!au.ok) return au;
  var customs = _chatCustomChannels_();
  var ch = _chatAccess_(au.u, p.channel, customs);
  if (!ch) return { ok: false, error: 'Khong co quyen xem kenh nay.' };
  var before = _chatNum_(p.before) || Infinity, limit = Math.min(100, Math.max(1, _chatNum_(p.limit) || 50));
  var sh = _chatMsgSheet_(), total = Math.max(0, sh.getLastRow() - 1), win = CHAT_TAIL_ROWS_, found = [];
  while (true) {
    found = _chatTail_(sh, win).filter(function (m) { return m.c === ch.id && m.id < before; });
    if (found.length >= limit || win >= total || win >= 20000) break;
    win *= 4;
  }
  var more = found.length > limit || (win < total && found.length >= limit);
  return { ok: true, channel: ch.id, msgs: found.slice(-limit), more: more, last: _chatLastId_(), dver: _chatVer_('dver') };
}
function chatSend_(d) {
  var au = _chatUser_(d.token); if (!au.ok) return au;
  var u = au.u;
  var text = String(d.text == null ? '' : d.text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (!text) return { ok: false, error: 'Tin nhan trong.' };
  if (text.length > CHAT_MAX_TEXT_) return { ok: false, error: 'Tin nhan qua dai (toi da ' + CHAT_MAX_TEXT_ + ' ky tu).' };
  var cache = CacheService.getScriptCache(), rk = 'chatrl_' + u.username, lastT = _chatNum_(cache.get(rk));
  if (lastT && Date.now() - lastT < CHAT_RATE_MS_) return { ok: false, error: 'Gui qua nhanh, cho 1 chut roi gui lai.' };
  var chId = String(d.channel || '');
  var lock = LockService.getScriptLock();
  try { lock.waitLock(4000); } catch (eL) { return { ok: false, error: 'He thong dang ban, thu gui lai sau vai giay.' }; }
  try {
    var customs = _chatCustomChannels_();
    var ch = _chatAccess_(u, chId, customs);
    if (!ch && chId.indexOf('dm:') === 0) {              // tin nhan 1-1 dau tien -> tao kenh
      var pair = chId.slice(3).split('|');
      var okPair = pair.length === 2 && pair[0] && pair[1] && pair[0] < pair[1] && pair.indexOf(u.username) !== -1 && pair[0] !== pair[1];
      if (okPair) {
        var other = pair[0] === u.username ? pair[1] : pair[0];
        var exists = _chatActiveUsers_().some(function (x) { return String(x.username).trim().toLowerCase() === other; });
        if (exists) {
          _chatChSheet_().appendRow([chId, '', 'dm', JSON.stringify(pair), u.username, Date.now(), '', '']);
          cache.remove('chat_chs'); _chatBump_('chver');
          ch = { id: chId, type: 'dm' };
        }
      }
    }
    if (!ch) return { ok: false, error: 'Khong co quyen gui vao kenh nay.' };
    var id = Math.max(_chatLastId_() + 1, Date.now()), ts = Date.now();
    var reply = String(d.replyTo || '').replace(/[^0-9]/g, '').slice(0, 20);
    _chatMsgSheet_().appendRow([id, ch.id, u.username, u.name, _chatSafeCell_(text), ts, reply, '']);
    PropertiesService.getScriptProperties().setProperty('chatLastId', String(id));
    cache.put('chat_last', String(id), 21600);
    cache.put(rk, String(ts), 30);
    var rec = { id: id, c: ch.id, u: u.username, n: u.name, t: text, ts: ts, r: reply };
    var ring = _chatRingGet_(); if (ring) { ring.push(rec); _chatRingPut_(ring); }
    return { ok: true, msg: rec, last: id };
  } finally { lock.releaseLock(); }
}
function chatDelete_(d) {
  var au = _chatUser_(d.token); if (!au.ok) return au;
  var id = _chatNum_(d.id); if (!id) return { ok: false, error: 'Thieu id tin nhan.' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(4000); } catch (eL) { return { ok: false, error: 'He thong dang ban, thu lai sau vai giay.' }; }
  try {
    var sh = _chatMsgSheet_(), last = sh.getLastRow(), win = CHAT_TAIL_ROWS_, row = -1, owner = '';
    while (row < 0) {
      var start = Math.max(2, last - win + 1);
      if (last >= 2) {
        var ids = sh.getRange(start, 1, last - start + 1, 3).getValues();
        for (var i = ids.length - 1; i >= 0; i--) { if (_chatNum_(ids[i][0]) === id) { row = start + i; owner = String(ids[i][2]); break; } }
      }
      if (row > 0 || start <= 2) break;
      win *= 4;
    }
    if (row < 0) return { ok: false, error: 'Khong tim thay tin nhan.' };
    if (owner !== au.u.username && au.u.role !== 'admin') return { ok: false, error: 'Chi nguoi gui hoac admin moi xoa duoc tin nhan.' };
    sh.getRange(row, 8).setValue(1);
    var ring = _chatRingGet_(); if (ring) _chatRingPut_(ring.filter(function (m) { return m.id !== id; }));
    _chatBump_('dver');
    return { ok: true, dver: _chatVer_('dver') };
  } finally { lock.releaseLock(); }
}
function _chatCleanMembers_(list, creator) {
  var valid = {}; _chatActiveUsers_().forEach(function (x) { valid[String(x.username).trim().toLowerCase()] = 1; });
  var seen = {}, out = [];
  [creator].concat(Array.isArray(list) ? list : []).forEach(function (m) {
    m = String(m || '').trim().toLowerCase();
    if (m && valid[m] && !seen[m]) { seen[m] = 1; out.push(m); }
  });
  return out.slice(0, CHAT_MAX_MEMBERS_);
}
function chatCreateChannel_(d) {
  var au = _chatUser_(d.token); if (!au.ok) return au;
  var u = au.u, name = String(d.name || '').replace(/[\u0000-\u001F]/g, '').trim().slice(0, 40);
  var type = d.type === 'public' ? 'public' : 'private';
  if (!name) return { ok: false, error: 'Nhap ten kenh.' };
  if (type === 'public' && u.role !== 'admin') return { ok: false, error: 'Chi admin moi tao duoc kenh chung. Ban co the tao nhom rieng (private).' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(4000); } catch (eL) { return { ok: false, error: 'He thong dang ban, thu lai sau vai giay.' }; }
  try {
    var customs = _chatCustomChannels_();
    var low = name.toLowerCase();
    if (low === 'chung' || customs.some(function (c) { return !c.archived && c.type !== 'dm' && String(c.name).toLowerCase() === low && (c.type === 'public' || type === 'public' || c.createdBy === u.username); }))
      return { ok: false, error: 'Ten kenh da ton tai.' };
    var members = type === 'public' ? [] : _chatCleanMembers_(d.members, u.username);
    var id = 'ch_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    var desc = String(d.desc || '').replace(/[\u0000-\u001F]/g, ' ').trim().slice(0, 200);
    _chatChSheet_().appendRow([id, name, type, JSON.stringify(members), u.username, Date.now(), '', desc]);
    CacheService.getScriptCache().remove('chat_chs'); _chatBump_('chver');
    return { ok: true, channel: { id: id, name: name, type: type, desc: desc, createdBy: u.username, members: members, canManage: true }, chver: _chatVer_('chver') };
  } finally { lock.releaseLock(); }
}
function chatUpdateChannel_(d) {
  var au = _chatUser_(d.token); if (!au.ok) return au;
  var u = au.u, id = String(d.id || '');
  var lock = LockService.getScriptLock();
  try { lock.waitLock(4000); } catch (eL) { return { ok: false, error: 'He thong dang ban, thu lai sau vai giay.' }; }
  try {
    var sh = _chatChSheet_(), last = sh.getLastRow(), row = -1;
    if (last >= 2) { var ids = sh.getRange(2, 1, last - 1, 1).getValues(); for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) { row = i + 2; break; } }
    if (row < 0) return { ok: false, error: 'Khong tim thay kenh (kenh Chung / Team / 1-1 khong sua duoc).' };
    var cur = sh.getRange(row, 1, 1, CHAT_CH_HEADERS_.length).getValues()[0];
    var type = String(cur[2]), createdBy = String(cur[4]), members = []; try { members = JSON.parse(cur[3] || '[]'); } catch (e) { members = []; }
    if (type === 'dm') return { ok: false, error: 'Khong sua duoc kenh 1-1.' };
    var isMember = members.indexOf(u.username) !== -1;
    // roi nhom: bat ky thanh vien nao cung duoc tu roi khoi nhom private
    if (d.leave && type === 'private' && isMember) {
      members = members.filter(function (m) { return m !== u.username; });
      sh.getRange(row, 4).setValue(JSON.stringify(members));
      if (!members.length) sh.getRange(row, 7).setValue(1);
    } else {
      if (u.role !== 'admin' && createdBy !== u.username) return { ok: false, error: 'Chi nguoi tao kenh hoac admin moi sua duoc.' };
      if (d.name != null) { var nm = String(d.name).replace(/[\u0000-\u001F]/g, '').trim().slice(0, 40); if (!nm) return { ok: false, error: 'Ten kenh khong duoc de trong.' }; sh.getRange(row, 2).setValue(nm); }
      if (d.desc != null) sh.getRange(row, 8).setValue(String(d.desc).replace(/[\u0000-\u001F]/g, ' ').trim().slice(0, 200));
      if (type === 'private' && (d.addMembers || d.removeMembers)) {
        var add = _chatCleanMembers_(d.addMembers, createdBy);
        var rem = (Array.isArray(d.removeMembers) ? d.removeMembers : []).map(function (m) { return String(m).trim().toLowerCase(); });
        add.forEach(function (m) { if (members.indexOf(m) === -1) members.push(m); });
        members = members.filter(function (m) { return rem.indexOf(m) === -1 || m === createdBy; }).slice(0, CHAT_MAX_MEMBERS_);
        sh.getRange(row, 4).setValue(JSON.stringify(members));
      }
      if (d.archived === true) sh.getRange(row, 7).setValue(1);
    }
    CacheService.getScriptCache().remove('chat_chs'); _chatBump_('chver');
    return { ok: true, chver: _chatVer_('chver') };
  } finally { lock.releaseLock(); }
}
function chatDoGet_(action, p) {
  try {
    var r = action === 'chatPoll' ? chatPoll_(p) : action === 'chatChannels' ? chatChannels_(p) : chatHistory_(p);
    return jsonOut_(r);
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi chat: ' + (err && err.message || err) }); }
}
function chatDoPost_(action, d) {
  try {
    var r = action === 'chatSend' ? chatSend_(d) : action === 'chatDelete' ? chatDelete_(d)
      : action === 'chatCreateChannel' ? chatCreateChannel_(d) : chatUpdateChannel_(d);
    return jsonOut_(r);
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi chat: ' + (err && err.message || err) }); }
}


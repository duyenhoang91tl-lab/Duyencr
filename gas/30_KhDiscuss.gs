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
// ── QUYEN XEM (yeu cau Duyen): chi (1) NGUOI DANG NHAN khach nay tren Pancake (assignee cua hoi thoai co SDT do) va (2) NGUOI DUOC PHAN QUYEN xem du lieu
//    cua nguoi dang nhan: Admin + CEO (vai tro co so 'viewer') xem het; Truong team xem khi nguoi nhan thuoc team minh; Quan ly/Truong phong xem khi nguoi nhan thuoc phong minh phu trach.
//    Khong co hoi thoai Pancake / chua ai nhan -> chi Admin + CEO. Ap dung cho DOC, GUI va nguoi duoc @tag (khong tag duoc nguoi khong co quyen).
function _khdAssignees_(phone) {
  var cache = CacheService.getScriptCache(), key = 'khda_' + phone, hit = cache.get(key);
  if (hit) { try { return JSON.parse(hit); } catch (e0) {} }
  var rows = sb_('GET', 'pk_conversations?select=page_id,assignee_ids&customer_phone=eq.' + _pkEnc_(normPhone_(phone)) + '&limit=8').json || [];
  var names = _pkStaffNames_(), out = [];
  rows.forEach(function (c) {
    var um = null;
    (Array.isArray(c.assignee_ids) ? c.assignee_ids : []).forEach(function (i) {
      i = String(i); var n = names[i];
      if (!n) { if (um === null) um = _pkUserMap_(c.page_id || ''); n = um[i]; }
      if (n && out.indexOf(n) === -1) out.push(String(n));
    });
  });
  try { cache.put(key, JSON.stringify(out), 60); } catch (e1) {}
  return out;
}
function _khdLeaderCovers_(user, tf) {
  var vNames = {}; _profNames_(user).forEach(function (n) { vNames[_normTxt_(n)] = true; });
  var ok = false;
  readTeams_(getCrmSS_().getSheetByName(SH_TEAM)).forEach(function (t) {
    if (ok) return;
    var mine = (t.leader && vNames[_normTxt_(t.leader)]) || (user.team && _normTxt_(t.name) === _normTxt_(user.team));
    if (!mine) return;
    var mem = [t.leader].concat(t.members || []);
    for (var i = 0; i < mem.length; i++) if (mem[i] && tf[_normTxt_(mem[i])]) { ok = true; return; }
  });
  return ok;
}
function _khdManagerCovers_(user, tf) {
  var mine = {}; _userDeptKeys_(user).forEach(function (k) { mine[_normTxt_(k)] = true; });
  var by = readSaleDepts_().byNorm, ok = false;
  Object.keys(tf).forEach(function (n) { var h = by[n]; if (h && h.key && mine[_normTxt_(h.key)]) ok = true; });
  return ok;
}
// assignees: ten nguoi dang nhan (tu _khdAssignees_). Tra {ok, why}.
function _khdUserAllowed_(user, assignees) {
  if (!user) return { ok: false };
  var base = _roleBase_(user.role);
  if (user.role === 'admin' || base === 'viewer') return { ok: true, why: 'scope' };
  if (!assignees || !assignees.length) return { ok: false };
  var mine = _profFold_(_profNames_(user));
  for (var i = 0; i < assignees.length; i++) if (mine[_normTxt_(assignees[i])]) return { ok: true, why: 'assignee' };
  var tf = _profFold_(assignees);
  if (base === 'leader' && _khdLeaderCovers_(user, tf)) return { ok: true, why: 'scope' };
  if (base === 'manager' && _khdManagerCovers_(user, tf)) return { ok: true, why: 'scope' };
  return { ok: false };
}
var KHD_FORBIDDEN_MSG_ = 'Chi nguoi dang nhan khach nay tren Pancake hoac nguoi duoc phan quyen (Admin, CEO, quan ly/truong team phu trach nguoi nhan) moi xem va nhan duoc trong thao luan nay.';
// Kiem tra user duoc xem thao luan cua phone. Admin/CEO khong can goi Pancake. Loi Supabase -> tu choi nguoi khac (khong lam hong).
function _khdAccess_(user, phone) {
  var base = _roleBase_(user.role);
  if (user.role === 'admin' || base === 'viewer') return { ok: true, assignees: null };
  var as;
  try { as = _khdAssignees_(phone); } catch (e) { return { ok: false, code: 'PKDOWN', error: 'Khong kiem tra duoc nguoi dang nhan tren Pancake luc nay, thu lai sau it phut.' }; }
  var r = _khdUserAllowed_(user, as);
  return r.ok ? { ok: true, assignees: as } : { ok: false, code: 'FORBIDDEN', error: KHD_FORBIDDEN_MSG_, assignees: as };
}
function khdList_(p) {
  var au = _chatUser_(p.token); if (!au.ok) return au;
  var phone = _khdPhone_(p.phone); if (!phone) return { ok: false, error: 'SDT khong hop le.' };
  var acc = _khdAccess_(au.u, phone); if (!acc.ok) return { ok: false, code: acc.code, error: acc.error };
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
  var acc = _khdAccess_(u, phone); if (!acc.ok) return { ok: false, code: acc.code, error: acc.error };
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
    // chi bao cho nguoi tag CO QUYEN xem thao luan nay; nguoi khong co quyen -> khong thong bao (khong lo thong tin) va tra ve 'skipped' de nguoi gui biet
    var all = readUsers_(getCrmSS_().getSheetByName(SH_USER)), tagged = _notifParseMentions_(text, all), only = {}, skipped = [];
    var asg = acc.assignees === null ? (function () { try { return _khdAssignees_(phone); } catch (eA) { return []; } })() : acc.assignees;
    all.forEach(function (x) {
      if (tagged.indexOf(String(x.username)) === -1) return;
      if (_khdUserAllowed_(x, asg).ok) only[String(x.username)] = 1; else skipped.push(String(x.name || x.username));
    });
    _notifyMentions_({ text: text, from: u.name, fromUser: u.username, kind: 'khthread', refType: 'customer', refId: phone, refId2: id, onlyUsers: only });
    return { ok: true, skipped: skipped, message: { id: id, author: u.name, authorUser: u.username, text: text, mentions: mentions, ts: ts } };
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

// ═══════════════════════════════════════════════════════════════
//  GIAM SAT CHAT PANCAKE — phat hien sale dung TU CAM va canh bao admin (yeu cau Duyen 2026-10-17)
//  Nguon tu cam: sheet "Luu y tu cam" (file Report Sale) qua readBannedWords_ (cot "Tu cam"; fallback neu mat quyen). Doi sheet la tu cap nhat (cache 30 phut).
//  Nguon tin: pk_messages (Supabase, do webhook Pancake ghi) direction='out' — TIN GUI RA cua page/sale; quet dinh ky (trigger 5 phut) tu moc cvCursor.
//  Dau ra: sheet "ChatViolations" (chi tiet tung tin vi pham) + THONG BAO trong CRM cho admin (mac dinh duyenht; moi lan quet gop 1 thong bao/nhan vien de khong don dap) + email tuy chon.
//  Khop: khong phan biet hoa thuong, theo TU/CUM (khong bat chuoi con: "loc" khong khop "block"); tin gõ KHONG DAU thi so voi ban bo dau; cum dai nuot cum ngan ("loc phuc tinh" khong bao them "loc").
//  Settings: chatAuditIgnore (tu bo qua, vd "tien, loc" vi qua pho bien khi chat), chatAuditAdmins (username nhan canh bao, mac dinh duyenht), chatAuditEmail (tuy chon).
//  Settings them (20/10): chatAuditNotifySale (0 = chi bao admin, khong bao chinh sale; mac dinh bao ca sale khop tai khoan CRM). Editor them: datChatAuditBaoSale(true/false).
//  Editor: batGiamSatChat(gioQuaKhu) / tatGiamSatChat / chayGiamSatChat / xemTuCamGiamSat / datChatAuditBoQua(csv) / datChatAuditAdmin(csv).
//  GIOI HAN: Pancake khong tra ten nhan vien cho tung tin gui tu app Pancake (xem docs/PANCAKE-INBOX.md) nen tin do ghi "(chua ro nhan vien)" kem Page + hoi thoai de tra.
// ═══════════════════════════════════════════════════════════════
var CV_SHEET = 'ChatViolations';
var CV_HEADERS = ['id', 'detectedAt', 'sentAt', 'page', 'convId', 'phone', 'customer', 'staff', 'words', 'snippet'];
var CV_DEFAULT_ADMINS = ['duyenht'];
function _cvNorm_(s) { return String(s === null || s === undefined ? '' : s).normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim(); }
function _cvHasVN_(s) { return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(String(s || '')); }
function _cvStrip_(s) { return _stripVN_(_cvNorm_(s)).replace(/đ/g, 'd'); }
function _cvWordCh_(ch) { return !!ch && /[0-9A-Za-zÀ-ỹ_]/.test(ch); }
// phrase xuat hien trong hay NHU MOT TU/CUM (ky tu truoc/sau khong phai chu-so).
function _cvFindPhrase_(hay, phrase) {
  if (!phrase) return false;
  var from = 0, i;
  while ((i = hay.indexOf(phrase, from)) !== -1) {
    if (!_cvWordCh_(hay.charAt(i - 1)) && !_cvWordCh_(hay.charAt(i + phrase.length))) return true;
    from = i + 1;
  }
  return false;
}
function _cvSplitCsv_(v) { return String(v || '').split(/[,;\n]/).map(function (x) { return _cvNorm_(x); }).filter(Boolean); }
// list: [{tuCam, thayThe}] -> [{raw, norm, strip, thayThe}] (bo trung, bo cum qua ngan, bo cum trong danh sach bo qua)
function _cvCompile_(list, ignoreCsv) {
  var ign = {}, seen = {}, out = [];
  _cvSplitCsv_(ignoreCsv).forEach(function (x) { ign[x] = 1; ign[_cvStrip_(x)] = 1; });
  (list || []).forEach(function (w) {
    var raw = String((w && (w.tuCam || w.raw)) || '').trim(), norm = _cvNorm_(raw);
    if (norm.length < 2 || seen[norm]) return;
    var strip = _cvStrip_(raw);
    if (ign[norm] || ign[strip]) return;
    seen[norm] = 1;
    out.push({ raw: raw, norm: norm, strip: strip, thayThe: String((w && w.thayThe) || '') });
  });
  return out;
}
// Tra ve cac tu cam co trong text: [{raw, thayThe}]. Cum dai nuot cum ngan nam trong no.
function cvDetect_(text, compiled) {
  var t = String(text || '');
  if (!t.trim()) return [];
  var norm = _cvNorm_(t), plain = !_cvHasVN_(t), stripped = plain ? _cvStrip_(t) : '', hits = [];
  (compiled || []).forEach(function (w) {
    if (_cvFindPhrase_(norm, w.norm) || (plain && w.strip && _cvFindPhrase_(stripped, w.strip))) hits.push(w);
  });
  return hits.filter(function (a) {
    return !hits.some(function (b) { return b !== a && b.norm.length > a.norm.length && b.norm.indexOf(a.norm) !== -1; });
  }).map(function (w) { return { raw: w.raw, thayThe: w.thayThe }; });
}
function _cvBannedCompiled_() {
  var cache = CacheService.getScriptCache(), list = null, raw = null;
  try { raw = cache.get('cv_banned_v1'); } catch (e) {}
  if (raw) { try { list = JSON.parse(raw); } catch (e1) {} }
  if (!list) { list = readBannedWords_() || []; try { cache.put('cv_banned_v1', JSON.stringify(list), 1800); } catch (e2) {} }
  var ign = ''; try { ign = getSetting_('chatAuditIgnore') || ''; } catch (e3) {}
  return _cvCompile_(list, ign);
}
function _cvAdmins_() {
  var v = ''; try { v = getSetting_('chatAuditAdmins') || ''; } catch (e) {}
  var a = String(v).split(/[,;\s]+/).map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
  return a.length ? a : CV_DEFAULT_ADMINS.slice();
}
// Ten nhan vien gui tin 'out': nhan vien CRM > nhan vien Pancake (staff_name) > raw.from.admin_name. Khong co -> '' (chua ro).
function _cvStaff_(m) {
  var f = m && m.fromraw, adm = f && typeof f === 'object' ? (f.admin_name || '') : '';
  return String((m && (m.crm_user || m.staff_name)) || adm || '').trim();
}
// msgs: [{id, text, sent_at, conversation_id, page_id, staff_name, crm_user, fromraw}] -> vi pham [{id, sentAt, convId, pageId, staff, words:[raw], snippet}]
function cvScanMessages_(msgs, compiled) {
  var out = [];
  (msgs || []).forEach(function (m) {
    if (!m || !m.id) return;
    var hits = cvDetect_(m.text, compiled);
    if (!hits.length) return;
    out.push({ id: String(m.id), sentAt: m.sent_at || '', convId: m.conversation_id || '', pageId: m.page_id || '', staff: _cvStaff_(m),
               words: hits.map(function (h) { return h.raw; }), suggest: hits.map(function (h) { return h.thayThe; }).filter(Boolean),
               snippet: String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 300) });
  });
  return out;
}
// Cau canh bao gop theo (nhan vien x hoi thoai) (<= 160 ky tu vi cot text cua Notifications). self=true: gui CHO CHINH sale do ("Ban dung tu cam...").
function _cvNotifText_(staff, vs, self) {
  var cnt = {}, order = [];
  vs.forEach(function (v) { v.words.forEach(function (w) { if (!cnt[w]) { cnt[w] = 0; order.push(w); } cnt[w]++; }); });
  order.sort(function (a, b) { return cnt[b] - cnt[a]; });
  var top = order.slice(0, 4).map(function (w) { return '"' + w + '"' + (cnt[w] > 1 ? ' ×' + cnt[w] : ''); }).join(', ');
  var cust = ''; for (var i = 0; i < vs.length; i++) { if (vs[i].customer) { cust = String(vs[i].customer).slice(0, 30); break; } }
  var s = '⚠️ ' + (self ? 'Bạn' : (staff || '(chưa rõ nhân viên)')) + ' dùng từ cấm trong ' + vs.length + ' tin' + (cust ? ' với ' + cust : '') + ': ' + top + (order.length > 4 ? ' …' : '');
  return s.length > 160 ? s.slice(0, 159) + '…' : s;
}
// Ten nhan vien (tu Pancake/CRM) -> cac username CRM (con hoat dong) khop theo ten hien thi / username / bi danh (cot names) — cung cach _notifyTaskEvent_.
function _cvStaffUsers_(users, staff) {
  var key = String(staff || '').trim().toLowerCase(), out = [];
  if (!key) return out;
  (users || []).forEach(function (u) {
    if (u.active === false) return;
    var al = [u.name, u.username].concat(u.names || []).map(function (x) { return String(x || '').trim().toLowerCase(); });
    if (al.indexOf(key) >= 0 && out.indexOf(String(u.username)) < 0) out.push(String(u.username));
  });
  return out;
}
var CV_NOTIF_MAX_GROUPS_ = 15;   // toi da so thong bao / nhan vien / luot quet (phan du gop vao thong bao cuoi) — tranh don dap
// THONG BAO (20/10/2026, Duyen): moi (nhan vien x HOI THOAI) 1 thong bao; gui cho admin VA cho CHINH sale do (neu khop tai khoan CRM; tat bang Settings chatAuditNotifySale = 0).
// refType='chatviolation', refId = ID hoi thoai (bam vao thong bao mo dung doan chat), refId2 = "SDT|ten khach".
function _cvNotify_(admins, vs) {
  if (!vs.length) return 0;
  var notifySale = true, users = [];
  try { var fl = String(getSetting_('chatAuditNotifySale') || '').trim().toLowerCase(); if (fl === '0' || fl === 'false' || fl === 'off' || fl === 'tat') notifySale = false; } catch (e0) {}
  if (notifySale) { try { users = readUsers_(getCrmSS_().getSheetByName(SH_USER)) || []; } catch (e1) { users = []; } }
  var byStaff = {}, staffOrder = [];
  vs.forEach(function (v) {
    var sk = v.staff || '', ck = v.convId || v.phone || '';
    if (!byStaff[sk]) { byStaff[sk] = { keys: [], groups: {} }; staffOrder.push(sk); }
    var st = byStaff[sk];
    if (!st.groups[ck]) { st.groups[ck] = []; st.keys.push(ck); }
    st.groups[ck].push(v);
  });
  var sh = getSheet_(SH_NOTIF, NOTIF_HEADERS), now = new Date().toISOString(), rows = [], seq = 0;
  var adminLow = {}; (admins || []).forEach(function (a) { adminLow[String(a).toLowerCase()] = 1; });
  staffOrder.forEach(function (sk) {
    var st = byStaff[sk], keys = st.keys.slice();
    if (keys.length > CV_NOTIF_MAX_GROUPS_) {   // qua nhieu hoi thoai: phan du gop vao nhom cuoi
      var tail = keys.splice(CV_NOTIF_MAX_GROUPS_ - 1);
      var merged = []; tail.forEach(function (k) { merged = merged.concat(st.groups[k]); });
      st.groups[tail[0]] = merged; keys.push(tail[0]);
    }
    var saleUsers = notifySale ? _cvStaffUsers_(users, sk).filter(function (u) { return !adminLow[u.toLowerCase()]; }) : [];
    keys.forEach(function (ck) {
      var list = st.groups[ck], first = list[0];
      var info = (first.phone || '') + '|' + (first.customer || '');
      var ref = first.convId || first.phone || '';
      var mk = function (to, self) {
        rows.push(['nt_' + Date.now() + '_cv' + (seq++) + '_' + Math.floor(Math.random() * 1000), to, 'Giám sát chat', 'chatviolation', 'chatviolation', ref, info, _cvNotifText_(sk, list, self), now, '']);
      };
      (admins || []).forEach(function (to) { mk(to, false); });
      saleUsers.forEach(function (to) { mk(to, true); });
    });
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, NOTIF_HEADERS.length).setValues(rows);
  return rows.length;
}
function _cvEmail_(vs) {
  var to = ''; try { to = String(getSetting_('chatAuditEmail') || '').trim(); } catch (e) {}
  if (!to || !vs.length) return 0;
  try {
    var lines = vs.slice(0, 30).map(function (v) { return '• ' + (v.staff || '(chưa rõ nhân viên)') + ' · ' + (v.pageLabel || v.pageId) + ' · ' + (v.customer || v.phone || v.convId) + ' · từ cấm: ' + v.words.join(', ') + '\n   "' + v.snippet.slice(0, 160) + '"'; });
    MailApp.sendEmail(to, '[CRM] ' + vs.length + ' tin chat dùng từ cấm', lines.join('\n') + (vs.length > 30 ? '\n… và ' + (vs.length - 30) + ' tin nữa (xem sheet ChatViolations)' : ''));
    return 1;
  } catch (e2) { return 0; }
}
// Bo sung phone/ten khach/nhan Page vao vi pham (1 truy van pk_conversations cho cac hoi thoai co vi pham).
function _cvEnrich_(vs) {
  var ids = {}, map = {};
  vs.forEach(function (v) { if (v.convId) ids[v.convId] = 1; });
  var keys = Object.keys(ids);
  if (keys.length) {
    try {
      var q = keys.slice(0, 100).map(function (x) { return '"' + String(x).replace(/"/g, '') + '"'; }).join(',');
      (sb_('GET', 'pk_conversations?select=id,customer_name,customer_phone&id=in.(' + _pkEnc_(q) + ')').json || []).forEach(function (c) { map[c.id] = c; });
    } catch (e) { Logger.log('cv enrich: ' + e); }
  }
  var pm = {}; try { pm = readPancakePageMap_() || {}; } catch (e1) {}
  vs.forEach(function (v) {
    var c = map[v.convId] || {};
    v.customer = c.customer_name || ''; v.phone = c.customer_phone ? normPhone_(String(c.customer_phone)) : '';
    v.pageLabel = pm[v.pageId] || v.pageId;
  });
  return vs;
}
// Quet 1 lan: tu moc cvCursor den hien tai (toi da 5 trang x 500 tin). Tra ve {scanned, violations, notified, cursor, note}.
function cvScanOnce_() {
  var res = { scanned: 0, violations: 0, notified: 0, cursor: '', note: '' };
  var props = PropertiesService.getScriptProperties(), lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) { res.note = 'dang chay luot khac'; return res; }
  try {
    var compiled = _cvBannedCompiled_();
    if (!compiled.length) { res.note = 'chua doc duoc danh sach tu cam'; return res; }
    var cursor = props.getProperty('cvCursor') || new Date(Date.now() - 3600 * 1000).toISOString();
    var all = [], page = 0, last = cursor, n;
    do {
      var rows = sb_('GET', 'pk_messages?select=id,conversation_id,page_id,text,sent_at,staff_name,crm_user,fromraw:raw-%3Efrom&direction=eq.out&sent_at=gt.' + _pkEnc_(last) + '&order=sent_at.asc&limit=500').json || [];
      n = rows.length; res.scanned += n;
      if (n) { all = all.concat(cvScanMessages_(rows, compiled)); last = rows[n - 1].sent_at || last; }
      page++;
    } while (n === 500 && page < 5);
    var vs = all;
    if (vs.length) {
      var sh = getSheet_(CV_SHEET, CV_HEADERS), have = {}, lr = sh.getLastRow();
      if (lr >= 2) sh.getRange(Math.max(2, lr - 1999), 1, Math.min(2000, lr - 1), 1).getValues().forEach(function (r) { have[String(r[0])] = 1; });
      vs = vs.filter(function (v) { return !have[v.id]; });
      if (vs.length) {
        _cvEnrich_(vs);
        var now = new Date().toISOString();
        var rowsOut = vs.map(function (v) { return [v.id, now, v.sentAt, v.pageLabel || v.pageId, v.convId, v.phone, v.customer, v.staff || '(chưa rõ nhân viên)', v.words.join(', '), v.snippet]; });
        sh.getRange(sh.getLastRow() + 1, 1, rowsOut.length, CV_HEADERS.length).setValues(rowsOut);
        res.notified = _cvNotify_(_cvAdmins_(), vs); _cvEmail_(vs);
      }
    }
    res.violations = vs.length;
    props.setProperty('cvCursor', last); res.cursor = last;
    return res;
  } catch (e) { res.note = 'loi: ' + (e && e.message || e); Logger.log('cvScanOnce_: ' + res.note); return res; }
  finally { try { lock.releaseLock(); } catch (e9) {} }
}
function chatAuditScan() { var r = cvScanOnce_(); Logger.log('Giam sat chat: quet ' + r.scanned + ' tin, ' + r.violations + ' vi pham moi, ' + r.notified + ' thong bao. ' + (r.note || '')); return r; }
function chayGiamSatChat() { return chatAuditScan(); }
// Bat giam sat: tao trigger 5 phut/lan va dat moc quet tu gioQuaKhu gio truoc (mac dinh 1 gio; toi da 72).
function batGiamSatChat(gioQuaKhu) {
  var h = Math.min(72, Math.max(0, Number(gioQuaKhu) >= 0 ? Number(gioQuaKhu) : 1));
  tatGiamSatChat();
  ScriptApp.newTrigger('chatAuditScan').timeBased().everyMinutes(5).create();
  PropertiesService.getScriptProperties().setProperty('cvCursor', new Date(Date.now() - h * 3600 * 1000).toISOString());
  Logger.log('Da BAT giam sat chat (5 phut/lan), quet tu ' + h + ' gio truoc. Canh bao gui cho: ' + _cvAdmins_().join(', ') + '. Xem tu cam dang dung: xemTuCamGiamSat.');
  return h;
}
function tatGiamSatChat() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'chatAuditScan') { ScriptApp.deleteTrigger(t); n++; } });
  Logger.log('Da tat giam sat chat (xoa ' + n + ' trigger).');
  return n;
}
function xemTuCamGiamSat() {
  var c = _cvBannedCompiled_();
  Logger.log('Giam sat chat dung ' + c.length + ' tu/cum cam (da bo cac tu trong chatAuditIgnore). Nhan canh bao: ' + _cvAdmins_().join(', '));
  c.forEach(function (w) { Logger.log('  - ' + w.raw + (w.thayThe ? '  → nen dung: ' + w.thayThe : '')); });
  return c.length;
}
function datChatAuditBoQua(csv) { setSetting_('chatAuditIgnore', String(csv || '')); try { CacheService.getScriptCache().remove('cv_banned_v1'); } catch (e) {} Logger.log('Tu bo qua khi giam sat chat: ' + (csv || '(khong)')); return csv; }
// Bat/tat gui thong bao tu cam CHO CHINH SALE (mac dinh BAT): datChatAuditBaoSale(false) de chi bao admin.
function datChatAuditBaoSale(bat) { setSetting_('chatAuditNotifySale', bat === false || String(bat).toLowerCase() === 'false' || String(bat) === '0' ? '0' : '1'); Logger.log('Bao tu cam cho chinh sale: ' + (getSetting_('chatAuditNotifySale') === '0' ? 'TAT' : 'BAT')); }
function datChatAuditAdmin(csv) { if (!String(csv || '').trim()) throw new Error('datChatAuditAdmin("duyenht")'); setSetting_('chatAuditAdmins', String(csv)); Logger.log('Nguoi nhan canh bao chat: ' + csv); return csv; }
// GET chatViolations (CHI admin, bat buoc token hop le): danh sach vi pham moi nhat + tong hop.
function cvList_(p) {
  var u = null; try { u = p && p.token ? _sessUser_(p.token) : null; } catch (e) {}
  if (!u || u.role !== 'admin') return { error: 'Chi admin xem duoc canh bao chat.', code: 'FORBIDDEN' };
  var sh = getCrmSS_().getSheetByName(CV_SHEET), items = [], byStaff = {}, byWord = {};
  if (sh && sh.getLastRow() >= 2) {
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, CV_HEADERS.length).getValues();
    for (var i = v.length - 1; i >= 0; i--) {
      var r = v[i]; if (!r[0]) continue;
      var o = { id: String(r[0]), detectedAt: r[1] instanceof Date ? r[1].toISOString() : String(r[1]), sentAt: r[2] instanceof Date ? r[2].toISOString() : String(r[2]), page: r[3], convId: r[4], phone: r[5], customer: r[6], staff: r[7], words: r[8], snippet: r[9] };
      if (items.length < 200) items.push(o);
      byStaff[o.staff] = (byStaff[o.staff] || 0) + 1;
      String(o.words).split(',').forEach(function (w) { w = w.trim(); if (w) byWord[w] = (byWord[w] || 0) + 1; });
    }
  }
  return { ok: true, items: items, byStaff: byStaff, byWord: byWord, admins: _cvAdmins_() };
}

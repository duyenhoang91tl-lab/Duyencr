// ═══════════════════════════════════════════════════════
//  CHAT PANCAKE TRONG CRM (hop thu Pancake buoc 4/5) — doc tin tu Supabase (pk_conversations / pk_messages, do webhook ghi),
//  gan hoi thoai voi khach theo SDT, gui tin tra loi qua API Pancake. Chi dung chung GAS vi GAS da co xac thuc phien (_sessUser_) + khoa Supabase.
//  Tai khoan test (demo) KHONG duoc xem/gui. Token Pancake nam o Script Properties (khong bao gio tra ve trinh duyet):
//    PANCAKE_PAGE_TOKENS = {"<page_id>":"<page_access_token>", ...}  (hoac PANCAKE_PAGE_TOKEN_<page_id>, hoac PANCAKE_PAGE_TOKEN cho 1 page)
//    PANCAKE_USER_TOKEN  = token tai khoan Pancake (tuy chon; neu co thi gui bang endpoint /api/v1 co trong tai lieu chinh thuc)
// ═══════════════════════════════════════════════════════
var PK_CHAT_SECTION_ = 1;
function _pkAuth_(token) {
  var su = _sessUser_(token);
  if (!su) return { err: jsonOut_({ error: 'Can dang nhap.', code: 'AUTH' }) };
  if (String(su.role || '') === 'demo') return { err: jsonOut_({ error: 'Tai khoan test khong xem duoc tin nhan Pancake.' }) };
  return { user: su };
}
function _pkEnc_(s) { return encodeURIComponent(String(s === null || s === undefined ? '' : s)); }
function _pkInList_(ids) { return 'in.(' + ids.map(function (x) { return '"' + String(x).replace(/["\\]/g, '') + '"'; }).join(',') + ')'; }
function _pkAtts_(arr) {
  var out = [];
  (Array.isArray(arr) ? arr : []).forEach(function (a) {
    if (!a || typeof a !== 'object') return;
    var u = String(a.url || a.preview_url || a.src || (a.payload && a.payload.url) || '');
    if (!/^https?:\/\//i.test(u)) return;
    out.push({ type: String(a.type || a.mime_type || ''), url: u, name: String(a.name || '') });
  });
  return out;
}
function _pkConvOut_(c) {
  return { id: c.id, pageId: c.page_id || '', name: c.customer_name || '', phone: c.customer_phone || '', lastAt: c.last_message_at || '',
           lastText: String(c.last_text || c.snippet || '').slice(0, 140), seen: c.seen !== false, replied: !!c.is_replied, type: c.conv_type || '' };
}
var PK_CONV_COLS_ = 'id,page_id,customer_name,customer_phone,last_message_at,last_text,snippet,seen,is_replied,conv_type';
// GET pkChat: cac hoi thoai gan voi SDT + tin nhan (moi nhat cuoi). after=<ISO> chi lay tin moi hon moc do (poll nhe).
function pkChat_(e) {
  var p = (e && e.parameter) || {};
  var a = _pkAuth_(p.token); if (a.err) return a.err;
  var phone = normPhone_(p.phone);
  if (phone.length < 9) return jsonOut_({ error: 'SDT khong hop le.' });
  try {
    var cv = sb_('GET', 'pk_conversations?select=' + PK_CONV_COLS_ + '&customer_phone=eq.' + _pkEnc_(phone) + '&order=last_message_at.desc.nullslast&limit=8').json || [];
    var out = { ok: true, phone: phone, conversations: cv.map(_pkConvOut_), messages: [], serverTime: new Date().toISOString() };
    if (!cv.length) return jsonOut_(out);
    var after = /^\d{4}-\d{2}-\d{2}T[\d:.+\-Z]+$/.test(String(p.after || '')) ? String(p.after) : '';
    var q = 'pk_messages?select=id,conversation_id,direction,text,sent_at,sender_name,attachments:raw->attachments&conversation_id=' + _pkEnc_(_pkInList_(cv.map(function (c) { return c.id; })))
          + (after ? '&sent_at=gt.' + _pkEnc_(after) : '') + '&order=sent_at.desc.nullslast&limit=' + (after ? 100 : 150);
    var ms = sb_('GET', q).json || [];
    out.messages = ms.reverse().map(function (m) {
      return { id: m.id, c: m.conversation_id, dir: m.direction === 'out' ? 'out' : 'in', text: String(m.text || ''), at: m.sent_at || '', from: m.sender_name || '', att: _pkAtts_(m.attachments) };
    });
    return jsonOut_(out);
  } catch (err) { return jsonOut_({ error: 'Doc chat loi: ' + String(err && err.message || err).slice(0, 200) }); }
}
// GET pkChatInbox: hop thu chung — cac hoi thoai moi nhat (q = loc theo ten/SDT, rong = tat ca). Man hinh Social > Chat.
function pkChatInbox_(e) {
  var p = (e && e.parameter) || {};
  var a = _pkAuth_(p.token); if (a.err) return a.err;
  var q = String(p.q || '').replace(/[*,()"\\]/g, ' ').trim();
  try {
    var filter = '';
    if (q.length >= 2) {
      var digits = q.replace(/\D/g, '');
      filter = '&' + ((digits.length >= 6 && digits.length >= q.length - 2) ? 'customer_phone=like.' + _pkEnc_('*' + digits + '*') : 'customer_name=ilike.' + _pkEnc_('*' + q + '*'));
    }
    var cv = sb_('GET', 'pk_conversations?select=' + PK_CONV_COLS_ + filter + '&order=last_message_at.desc.nullslast&limit=60').json || [];
    return jsonOut_({ ok: true, conversations: cv.map(_pkConvOut_), serverTime: new Date().toISOString() });
  } catch (err) { return jsonOut_({ error: 'Doc hop thu loi: ' + String(err && err.message || err).slice(0, 200) }); }
}
// GET pkChatConv: tin nhan cua 1 hoi thoai theo convId (after=<ISO> chi lay tin moi hon moc do).
function pkChatConv_(e) {
  var p = (e && e.parameter) || {};
  var a = _pkAuth_(p.token); if (a.err) return a.err;
  var conv = String(p.conv || '');
  if (!conv) return jsonOut_({ error: 'Thieu conv.' });
  try {
    var after = /^\d{4}-\d{2}-\d{2}T[\d:.+\-Z]+$/.test(String(p.after || '')) ? String(p.after) : '';
    var q = 'pk_messages?select=id,conversation_id,direction,text,sent_at,sender_name,attachments:raw->attachments&conversation_id=eq.' + _pkEnc_(conv)
          + (after ? '&sent_at=gt.' + _pkEnc_(after) : '') + '&order=sent_at.desc.nullslast&limit=' + (after ? 100 : 150);
    var ms = sb_('GET', q).json || [];
    return jsonOut_({ ok: true, messages: ms.reverse().map(function (m) {
      return { id: m.id, c: m.conversation_id, dir: m.direction === 'out' ? 'out' : 'in', text: String(m.text || ''), at: m.sent_at || '', from: m.sender_name || '', att: _pkAtts_(m.attachments) };
    }), serverTime: new Date().toISOString() });
  } catch (err) { return jsonOut_({ error: 'Doc tin nhan loi: ' + String(err && err.message || err).slice(0, 200) }); }
}
// GET pkChatFind: tim hoi thoai (theo ten khach Pancake hoac SDT) de gan cho khach — cho truong hop webhook chua tu bat duoc SDT.
function pkChatFind_(e) {
  var p = (e && e.parameter) || {};
  var a = _pkAuth_(p.token); if (a.err) return a.err;
  var q = String(p.q || '').replace(/[*,()"\\]/g, ' ').trim();
  if (q.length < 2) return jsonOut_({ error: 'Nhap it nhat 2 ky tu de tim.' });
  try {
    var digits = q.replace(/\D/g, '');
    var filter = (digits.length >= 6 && digits.length >= q.length - 2) ? 'customer_phone=like.' + _pkEnc_('*' + digits + '*') : 'customer_name=ilike.' + _pkEnc_('*' + q + '*');
    var cv = sb_('GET', 'pk_conversations?select=' + PK_CONV_COLS_ + '&' + filter + '&order=last_message_at.desc.nullslast&limit=15').json || [];
    return jsonOut_({ ok: true, conversations: cv.map(_pkConvOut_) });
  } catch (err) { return jsonOut_({ error: 'Tim hoi thoai loi: ' + String(err && err.message || err).slice(0, 200) }); }
}
// POST pkChatLink {convId, phone}: gan hoi thoai voi SDT khach (phone rong = bo gan).
function pkChatLink_(data) {
  var a = _pkAuth_(data && data.token); if (a.err) return a.err;
  var convId = String((data && data.convId) || ''); if (!convId) return jsonOut_({ error: 'Thieu convId.' });
  var raw = String((data && data.phone) || ''), phone = raw ? normPhone_(raw) : '';
  if (raw && !/^0\d{9}$/.test(phone)) return jsonOut_({ error: 'SDT khong hop le (can 10 so, bat dau 0).' });
  try {
    var r = sb_('PATCH', 'pk_conversations?id=eq.' + _pkEnc_(convId), { customer_phone: phone }, { Prefer: 'return=representation' });
    if (!r.json || !r.json.length) return jsonOut_({ error: 'Khong tim thay hoi thoai.' });
    Logger.log('pkChatLink ' + a.user.username + ' ' + convId + ' -> ' + phone);
    return jsonOut_({ ok: true, conversation: _pkConvOut_(r.json[0]) });
  } catch (err) { return jsonOut_({ error: 'Gan hoi thoai loi: ' + String(err && err.message || err).slice(0, 200) }); }
}
function _pkPageToken_(pageId) {
  var pr = PropertiesService.getScriptProperties();
  try { var m = JSON.parse(pr.getProperty('PANCAKE_PAGE_TOKENS') || '{}'); if (m && m[pageId]) return String(m[pageId]); } catch (e) {}
  return String(pr.getProperty('PANCAKE_PAGE_TOKEN_' + pageId) || pr.getProperty('PANCAKE_PAGE_TOKEN') || '');
}
// POST pkChatSend {convId, text}: gui tin tra loi (inbox) qua API Pancake. Token luon o Script Properties.
function pkChatSend_(data) {
  var a = _pkAuth_(data && data.token); if (a.err) return a.err;
  var convId = String((data && data.convId) || ''), text = String((data && data.text) || '').trim();
  if (!convId) return jsonOut_({ error: 'Thieu convId.' });
  if (!text) return jsonOut_({ error: 'Noi dung trong.' });
  if (text.length > 2000) return jsonOut_({ error: 'Tin qua dai (toi da 2000 ky tu).' });
  try {
    var rows = sb_('GET', 'pk_conversations?select=id,page_id,conv_type&id=eq.' + _pkEnc_(convId) + '&limit=1').json || [];
    if (!rows.length) return jsonOut_({ error: 'Khong tim thay hoi thoai.' });
    var page = String(rows[0].page_id || ''); if (!page) return jsonOut_({ error: 'Hoi thoai chua co page_id.' });
    if (String(rows[0].conv_type || '') === 'COMMENT') return jsonOut_({ error: 'Hoi thoai binh luan chua ho tro tra loi tu CRM.' });
    var userTok = String(PropertiesService.getScriptProperties().getProperty('PANCAKE_USER_TOKEN') || ''), pageTok = _pkPageToken_(page), url;
    if (userTok) url = 'https://pages.fm/api/v1/pages/' + _pkEnc_(page) + '/conversations/' + _pkEnc_(convId) + '/messages?access_token=' + _pkEnc_(userTok);
    else if (pageTok) url = 'https://pages.fm/api/public_api/v1/pages/' + _pkEnc_(page) + '/conversations/' + _pkEnc_(convId) + '/messages?page_access_token=' + _pkEnc_(pageTok);
    else return jsonOut_({ error: 'Chua cai token Pancake cho page ' + page + '. Vao Apps Script > Project Settings > Script properties, them PANCAKE_PAGE_TOKENS = {"' + page + '":"<page_access_token>"}.' });
    var res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify({ action: 'reply_inbox', message: text }), muteHttpExceptions: true });
    var code = res.getResponseCode(), body = res.getContentText() || '', j = null;
    try { j = JSON.parse(body); } catch (eJ) {}
    if (code >= 300 || (j && j.success === false)) return jsonOut_({ error: 'Pancake tu choi (HTTP ' + code + '): ' + body.slice(0, 240) });
    Logger.log('pkChatSend ' + a.user.username + ' ' + convId + ' len=' + text.length);
    return jsonOut_({ ok: true, id: (j && j.id) || '' });
  } catch (err) { return jsonOut_({ error: 'Gui tin loi: ' + String(err && err.message || err).slice(0, 200) }); }
}

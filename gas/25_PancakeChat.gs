// ═══════════════════════════════════════════════════════
//  CHAT PANCAKE TRONG CRM (hop thu Pancake buoc 4/5) — doc tin tu Supabase (pk_conversations / pk_messages, do webhook ghi),
//  gan hoi thoai voi khach theo SDT, gui tin tra loi qua API Pancake. Chi dung chung GAS vi GAS da co xac thuc phien (_sessUser_) + khoa Supabase.
//  Tai khoan test (demo) KHONG duoc xem/gui. Token Pancake nam o Script Properties (khong bao gio tra ve trinh duyet):
//    PANCAKE_PAGE_TOKENS = {"<page_id>":"<page_access_token>", ...}  (hoac PANCAKE_PAGE_TOKEN_<page_id>, hoac PANCAKE_PAGE_TOKEN cho 1 page)
//    PANCAKE_USER_TOKEN  = token tai khoan Pancake (tuy chon; neu co thi gui bang endpoint /api/v1 co trong tai lieu chinh thuc)
// ═══════════════════════════════════════════════════════
// LUU Y URL Supabase: UrlFetchApp.fetch NEM 'Invalid argument: <url>' neu URL chua ky tu '>' (hoac < " khoang trang { } | ^) chua ma hoa.
// NGUYEN NHAN GOC loi 'Doc tin nhan loi: Invalid argument' (12/10/2026): select dung 'attachments:raw->attachments' co '>' tran. Phai viet 'raw-%3Eattachments'.
// Mo hinh 'toan tu JSON' cua PostgREST (->, ->>) trong select luon phai ma hoa. tools/test-pk-chat-gas.js co mock bat ky tu loi nay.
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
// THE (tag) + NGUOI XU LY nhu Pancake (2026-10-12): webhook chi luu MA SO the (tags = [26, 28...]) va uuid nhan vien (assignee_ids) -> doi sang TEN + MAU
// bang API chinh thuc cua Pancake: GET /api/public_api/v1/pages/{page}/tags (-> {tags:[{id,text,color}]}) va /pages/{page}/users (-> {users:[{id,name}]}).
// Cache 6 gio theo page (CacheService) de khong goi Pancake moi lan poll; loi/chua co token page -> bo qua tham lang (hoi thoai van hien, chi thieu the).
var _pkMemo_ = {};   // trong 1 lan chay GAS (bien toan cuc khoi tao lai moi lan chay)
function _pkCacheGet_(k) { try { var v = CacheService.getScriptCache().get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function _pkCachePut_(k, o, ttl) { try { CacheService.getScriptCache().put(k, JSON.stringify(o), ttl); } catch (e) {} }
function _pkApiGet_(url) {
  try { var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true }); if (r.getResponseCode() >= 300) return null; return JSON.parse(r.getContentText() || 'null'); } catch (e) { return null; }
}
function _pkTagMap_(page) {   // id -> {t: ten, c: mau #hex}
  if (!page) return {};
  var key = 'pkTags_' + page, hit = _pkMemo_[key] || _pkCacheGet_(key); if (hit) { _pkMemo_[key] = hit; return hit; }
  var tok = _pkPageToken_(page), map = {};
  if (tok) {
    var j = _pkApiGet_('https://pages.fm/api/public_api/v1/pages/' + _pkEnc_(page) + '/tags?page_access_token=' + _pkEnc_(tok));
    (j && Array.isArray(j.tags) ? j.tags : []).forEach(function (t) {
      if (t && t.id !== undefined && t.id !== null) map[String(t.id)] = { t: String(t.text || t.name || ''), c: /^#[0-9a-fA-F]{3,8}$/.test(String(t.color || '')) ? String(t.color) : '' };
    });
  }
  _pkMemo_[key] = map; _pkCachePut_(key, map, Object.keys(map).length ? 21600 : 600);   // that bai: nho 10 phut de khong goi lai lien tuc
  return map;
}
function _pkUserMap_(page) {  // uuid nhan vien -> ten
  if (!page) return {};
  var key = 'pkUsers_' + page, hit = _pkMemo_[key] || _pkCacheGet_(key); if (hit) { _pkMemo_[key] = hit; return hit; }
  var tok = _pkPageToken_(page), map = {};
  if (tok) {
    var j = _pkApiGet_('https://pages.fm/api/public_api/v1/pages/' + _pkEnc_(page) + '/users?page_access_token=' + _pkEnc_(tok));
    (j && Array.isArray(j.users) ? j.users : []).forEach(function (u) { if (u && u.id) map[String(u.id)] = String(u.name || ''); });
  }
  _pkMemo_[key] = map; _pkCachePut_(key, map, Object.keys(map).length ? 21600 : 600);
  return map;
}
function _pkTagsOut_(raw, tmap) {
  var out = [];
  (Array.isArray(raw) ? raw : []).forEach(function (t) {
    if (t && typeof t === 'object') {   // phong khi Pancake gui the dang doi tuong {id, text, color}
      var nm = String(t.text || t.name || ''); if (nm) out.push({ id: String(t.id === undefined ? nm : t.id), t: nm, c: /^#[0-9a-fA-F]{3,8}$/.test(String(t.color || '')) ? String(t.color) : '' });
      return;
    }
    var m = tmap[String(t)]; if (m && m.t) out.push({ id: String(t), t: m.t, c: m.c });   // ma so khong co trong danh sach the (vd -99) -> bo
  });
  return out;
}
// Ten nhan vien Pancake (bang pk_staff, do pkNhanVienDongBo dong bo). NGUYEN NHAN GOC them: hoi thoai chi luu assignee_ids (uuid Pancake) nen
// khong hien duoc ten sale. LOI doc bang (chua tao / chua dong bo) KHONG duoc lam hong khung chat -> tra {} va chat van chay.
function _pkStaffNames_() {
  // Cache 6 gio (rong thi 10 phut): ham nay nam trong MOI lan poll hop thu -> neu moi lan lai goi Supabase thi ton 1 luot UrlFetch/poll.
  var hit = _pkCacheGet_('pkStaffAll_'); if (hit) return hit;
  var m = {};
  try {
    (sb_('GET', 'pk_staff?select=id,name&limit=1000').json || []).forEach(function (r) { if (r && r.id) m[String(r.id)] = String(r.name || ''); });
  } catch (e) { m = {}; }
  _pkCachePut_('pkStaffAll_', m, Object.keys(m).length ? 21600 : 600);
  return m;
}
function _pkConvOut_(c, names) {
  // assignees: ten tu bang pk_staff (pkNhanVienDongBo) truoc; thieu ten moi hoi API users cua Pancake (cache 6 gio). tags: ma so -> {ten, mau} (API tags cua page).
  var pg = c.page_id || '', ids = Array.isArray(c.assignee_ids) ? c.assignee_ids.map(String) : [], nm = names || {}, um = null, ass = [];
  ids.forEach(function (i) { var n = nm[i]; if (!n) { if (um === null) um = _pkUserMap_(pg); n = um[i]; } if (n) ass.push(n); });
  return { id: c.id, pageId: pg, name: c.customer_name || '', phone: c.customer_phone || '', lastAt: c.last_message_at || '',
           lastText: String(c.last_text || c.snippet || '').slice(0, 140), seen: c.seen !== false, replied: !!c.is_replied, type: c.conv_type || '',
           assigneeIds: ids, assignees: ass, tags: _pkTagsOut_(c.tags, _pkTagMap_(pg)) };
}
// TIN NHAN: nguoi gui. out = nhan vien tra loi: uu tien ten nhan vien CRM da gui (cot crm_user, ghi luc gui tu CRM), roi den ten nhan vien tren Pancake
// trong raw.from (admin_name — cung ten truong ma Pancake dung o conversation.last_sent_by). Khong co thi client hien ten page (m.from). in = khach (from = ten khach).
function _pkMsgOut_(m) {
  var f = (m.fromraw && typeof m.fromraw === 'object') ? m.fromraw : {};
  var dir = m.direction === 'out' ? 'out' : 'in', crm = dir === 'out' ? String(m.crm_user || '') : '';
  var staff = crm || (dir === 'out' ? String(f.admin_name || f.adminName || f.staff_name || f.user_name || '') : '');
  return { id: m.id, c: m.conversation_id, dir: dir, text: String(m.text || ''), at: m.sent_at || '', from: m.sender_name || '', staff: staff, crm: !!crm, att: _pkAtts_(m.attachments) };
}
// Doc tin: thu kem cot crm_user; neu schema chua deploy cot do (HTTP 400) thi doc lai khong co no — de CRM khong hong trong luc cho deploy schema.
function _pkMsgs_(tail) {
  var base = 'pk_messages?select=id,conversation_id,direction,text,sent_at,sender_name,fromraw:raw-%3Efrom,attachments:raw-%3Eattachments';
  try { return sb_('GET', base.replace('sender_name,', 'sender_name,crm_user,') + tail).json || []; }
  catch (e) { return sb_('GET', base + tail).json || []; }
}
// Ghi nhan NHAN VIEN CRM da gui tin (Pancake chi biet token cua page). Best-effort: loi thi bo qua, khong lam hong viec gui.
function _pkMarkCrmSender_(mid, convId, page, text, who) {
  if (!mid || !who) return;
  try {
    var r = sb_('PATCH', 'pk_messages?id=eq.' + _pkEnc_(mid), { crm_user: who }, { Prefer: 'return=representation' });
    if (r.json && r.json.length) return;   // webhook da vong lai truoc
    sb_('POST', 'pk_messages?on_conflict=id', { id: mid, conversation_id: convId, page_id: page, direction: 'out', text: text, sent_at: new Date().toISOString(), crm_user: who }, { Prefer: 'resolution=ignore-duplicates,return=minimal' });
  } catch (e) { Logger.log('pkMarkCrmSender: ' + String(e && e.message || e).slice(0, 160)); }
}
var PK_CONV_COLS_ = 'id,page_id,customer_name,customer_phone,last_message_at,last_text,snippet,seen,is_replied,conv_type,tags,assignee_ids';
// GET pkChat: cac hoi thoai gan voi SDT + tin nhan (moi nhat cuoi). after=<ISO> chi lay tin moi hon moc do (poll nhe).
function pkChat_(e) {
  var p = (e && e.parameter) || {};
  var a = _pkAuth_(p.token); if (a.err) return a.err;
  var phone = normPhone_(p.phone);
  if (phone.length < 9) return jsonOut_({ error: 'SDT khong hop le.' });
  try {
    var _names = _pkStaffNames_();
    var cv = sb_('GET', 'pk_conversations?select=' + PK_CONV_COLS_ + '&customer_phone=eq.' + _pkEnc_(phone) + '&order=last_message_at.desc.nullslast&limit=8').json || [];
    var out = { ok: true, phone: phone, conversations: cv.map(function (c) { return _pkConvOut_(c, _names); }), messages: [], serverTime: new Date().toISOString() };
    if (!cv.length) return jsonOut_(out);
    var after = /^\d{4}-\d{2}-\d{2}T[\d:.+\-Z]+$/.test(String(p.after || '')) ? String(p.after) : '';
    var tail = '&conversation_id=' + _pkEnc_(_pkInList_(cv.map(function (c) { return c.id; })))
          + (after ? '&sent_at=gt.' + _pkEnc_(after) : '') + '&order=sent_at.desc.nullslast&limit=' + (after ? 100 : 150);
    out.messages = _pkMsgs_(tail).reverse().map(_pkMsgOut_);
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
    // NGUYEN NHAN GOC loi 'urlfetch qua nhieu lan/ngay': moi tab poll 8s -> moi lan >=2 UrlFetch (Supabase + ten NV) x nhieu tab x ca ngay vuot han muc
    // (20.000/ngay tai khoan thuong). Danh sach hoi thoai giong nhau cho moi nguoi dung (khong loc theo nguoi) -> cache 15s DUNG CHUNG: bao nhieu tab cung chi ~4 luot/phut.
    var ck = 'pkInbox_' + encodeURIComponent(q).slice(0, 80), hit = _pkCacheGet_(ck);
    if (hit) return jsonOut_(hit);
    var _names = _pkStaffNames_();
    var cv = sb_('GET', 'pk_conversations?select=' + PK_CONV_COLS_ + filter + '&order=last_message_at.desc.nullslast&limit=60').json || [];
    var list = cv.map(function (c) { return _pkConvOut_(c, _names); });
    var res = { ok: true, conversations: list, serverTime: new Date().toISOString() };
    _pkCachePut_(ck, res, 15);
    return jsonOut_(res);
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
    var tail = '&conversation_id=eq.' + _pkEnc_(conv)
          + (after ? '&sent_at=gt.' + _pkEnc_(after) : '') + '&order=sent_at.desc.nullslast&limit=' + (after ? 100 : 150);
    return jsonOut_({ ok: true, messages: _pkMsgs_(tail).reverse().map(_pkMsgOut_), serverTime: new Date().toISOString() });
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
    var _names = _pkStaffNames_();
    var cv = sb_('GET', 'pk_conversations?select=' + PK_CONV_COLS_ + '&' + filter + '&order=last_message_at.desc.nullslast&limit=15').json || [];
    return jsonOut_({ ok: true, conversations: cv.map(function (c) { return _pkConvOut_(c, _names); }) });
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
    return jsonOut_({ ok: true, conversation: _pkConvOut_(r.json[0], _pkStaffNames_()) });
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
    _pkMarkCrmSender_((j && j.id) || '', convId, page, text, String(a.user.name || a.user.username || ''));   // tin hien ten nhan vien CRM da gui
    return jsonOut_({ ok: true, id: (j && j.id) || '' });
  } catch (err) { return jsonOut_({ error: 'Gui tin loi: ' + String(err && err.message || err).slice(0, 200) }); }
}

// ═══ GAN / GO THE (TAG) TU CRM nhu Pancake + NGUOI DA CHAT (2026-10-13) ═══
// Pancake -> CRM: the cua hoi thoai den qua webhook (su kien 'conversation' cap nhat cot tags). CRM -> Pancake: tai lieu chinh thuc
//   POST /api/public_api/v1/pages/{page}/conversations/{conv}/tags?page_access_token=...  body {action:'add'|'remove', tag_id:'<ma so>'}
//   -> {success:true, data:[ma the sau khi cap nhat]}. Ngay sau khi Pancake nhan, ghi luon `tags` moi vao Supabase de man hinh CRM hien ngay (webhook vong lai
//   sau do se ghi cung gia tri; su kien cu den tre co version nho hon bi bo qua nhu cu). Token page nam o Script Properties nhu pkChatSend.
function _pkTagsForget_(page) {
  try { delete _pkMemo_['pkTags_' + page]; } catch (e) {}
  try { CacheService.getScriptCache().remove('pkTags_' + page); } catch (e) {}
}
function _pkConvRow_(convId) {
  var rows = sb_('GET', 'pk_conversations?select=id,page_id,conv_type,tags&id=eq.' + _pkEnc_(convId) + '&limit=1').json || [];
  return rows[0] || null;
}
function _pkTagCatalog_(page) {   // [{id,t,c}] theo ma so tang dan (bo ma khong phai so)
  var map = _pkTagMap_(page), out = [];
  Object.keys(map).forEach(function (k) { if (map[k] && map[k].t && isFinite(Number(k))) out.push({ id: k, t: map[k].t, c: map[k].c }); });
  out.sort(function (a, b) { return Number(a.id) - Number(b.id); });
  return out;
}
// GET pkChatTags?pageId=<page>|conv=<convId>[&refresh=1]: danh sach the cua page (ten + mau) de chon khi gan the.
function pkChatTags_(e) {
  var p = (e && e.parameter) || {};
  var a = _pkAuth_(p.token); if (a.err) return a.err;
  try {
    var page = String(p.pageId || '');
    if (!page && p.conv) { var c = _pkConvRow_(String(p.conv)); page = c ? String(c.page_id || '') : ''; }
    if (!page) return jsonOut_({ error: 'Thieu pageId.' });
    if (!_pkPageToken_(page)) return jsonOut_({ error: 'Chua cai token Pancake cho page ' + page + ' (Script properties > PANCAKE_PAGE_TOKENS).' });
    if (String(p.refresh || '') === '1') _pkTagsForget_(page);   // vua tao/doi ten the tren Pancake -> bo cache 6 gio
    return jsonOut_({ ok: true, pageId: page, tags: _pkTagCatalog_(page) });
  } catch (err) { return jsonOut_({ error: 'Doc danh sach the loi: ' + String(err && err.message || err).slice(0, 200) }); }
}
// POST pkChatTag {convId, tagId, op:'add'|'remove'}: gan/go 1 the. Moi tai khoan dang nhap (tru test) deu gan/go duoc (giong viec xem/gui tin hien nay);
// Pancake tu luu lich su gan/go the (tag_histories) theo tai khoan cua token page.
function pkChatTag_(data) {
  var a = _pkAuth_(data && data.token); if (a.err) return a.err;
  var convId = String((data && data.convId) || ''), tagId = String(data && data.tagId !== undefined && data.tagId !== null ? data.tagId : '').trim(), op = String((data && data.op) || '').toLowerCase();
  if (!convId) return jsonOut_({ error: 'Thieu convId.' });
  if (!/^-?\d{1,9}$/.test(tagId)) return jsonOut_({ error: 'Ma the khong hop le.' });
  if (op !== 'add' && op !== 'remove') return jsonOut_({ error: 'op phai la add hoac remove.' });
  try {
    var conv = _pkConvRow_(convId);
    if (!conv) return jsonOut_({ error: 'Khong tim thay hoi thoai.' });
    var page = String(conv.page_id || ''); if (!page) return jsonOut_({ error: 'Hoi thoai chua co page_id.' });
    var tok = _pkPageToken_(page);
    if (!tok) return jsonOut_({ error: 'Chua cai token Pancake cho page ' + page + '. Vao Apps Script > Project Settings > Script properties, them PANCAKE_PAGE_TOKENS = {"' + page + '":"<page_access_token>"}.' });
    var map = _pkTagMap_(page);
    if (Object.keys(map).length && !map[tagId]) return jsonOut_({ error: 'The khong con tren page nay (co the vua bi xoa tren Pancake) - bam tai lai danh sach the roi thu lai.' });
    var url = 'https://pages.fm/api/public_api/v1/pages/' + _pkEnc_(page) + '/conversations/' + _pkEnc_(convId) + '/tags?page_access_token=' + _pkEnc_(tok);
    var res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify({ action: op, tag_id: tagId }), muteHttpExceptions: true });
    var code = res.getResponseCode(), body = res.getContentText() || '', j = null;
    try { j = JSON.parse(body); } catch (eJ) {}
    if (code >= 300 || (j && j.success === false)) return jsonOut_({ error: 'Pancake tu choi (HTTP ' + code + '): ' + body.slice(0, 240).split(tok).join('***') });
    var ids = (j && Array.isArray(j.data)) ? j.data : null;
    if (!ids) {   // Pancake khong tra danh sach the sau khi cap nhat -> tu tinh tu the hien co
      var cur = (Array.isArray(conv.tags) ? conv.tags : []).map(function (x) { return (x && typeof x === 'object') ? x.id : x; });
      ids = op === 'add' ? (cur.map(String).indexOf(tagId) >= 0 ? cur : cur.concat([Number(tagId)])) : cur.filter(function (x) { return String(x) !== tagId; });
    }
    try { sb_('PATCH', 'pk_conversations?id=eq.' + _pkEnc_(convId), { tags: ids }); }   // hien ngay tren CRM; loi thi webhook se bu
    catch (eS) { Logger.log('pkChatTag PATCH: ' + String(eS && eS.message || eS).slice(0, 160)); }
    Logger.log('pkChatTag ' + a.user.username + ' ' + convId + ' ' + op + ' ' + tagId);
    return jsonOut_({ ok: true, tags: _pkTagsOut_(ids, map), ids: ids });
  } catch (err) { return jsonOut_({ error: 'Gan the loi: ' + String(err && err.message || err).slice(0, 200) }); }
}
// (Khong tinh 'nguoi tra loi gan nhat' cho tung hoi thoai o DANH SACH: can them 1 truy van Supabase/lan poll, vi pham tran UrlFetch 20.000/ngay — xem NGUYEN NHAN
//  GOC o pkChatInbox_. 'Da chat' + ten nguoi gui duoi tung tin tinh o client tu cac tin da tai, khong ton luot goi nao.)
// Chay trong Apps Script Editor khi muon biet Pancake gui TEN NHAN VIEN o truong nao cua tin 'out' (neu CRM chua hien ten nguoi chat tren Pancake):
// ghi vao Execution log phan raw.from cua 5 tin nhan vien gan nhat.
function pkXemNguoiChat() {
  var rows = sb_('GET', 'pk_messages?select=id,conversation_id,sent_at,fromraw:raw-%3Efrom&direction=eq.out&order=sent_at.desc.nullslast&limit=40').json || [], n = 0;
  rows.forEach(function (r) { if (n >= 5) return; var f = r.fromraw; if (f && typeof f === 'object') { n++; Logger.log(r.sent_at + ' ' + r.id + ' from=' + JSON.stringify(f).slice(0, 400)); } });
  if (!n) Logger.log('Chua co tin nhan vien nao co truong from trong pk_messages.raw');
}


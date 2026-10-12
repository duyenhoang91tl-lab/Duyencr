// ═══════════════════════════════════════════════════════
//  KEO LICH SU TIN NHAN CU TU PANCAKE (hop thu Pancake buoc 3) — webhook chi cho tin MOI tu luc cai; tin cu hon thi keo qua API:
//    GET /api/public_api/v2/pages/{page}/conversations (60/lan, moi cap nhat truoc, con tro last_conversation_id)
//    GET /api/public_api/v1/pages/{page}/conversations/{conv}/messages?customer_id=..&current_count=.. (30 tin/lan)
//  Chay theo lo, co con tro (Script Property PK_HIST_STATE) nen bi ngat (het 6 phut) thi lan sau chay tiep. CHI THEM tin/hoi thoai CHUA co
//  (Prefer: ignore-duplicates) — khong ghi de du lieu webhook/gan tay. Phan chay tu Apps Script Editor: pkLichSuThu (chay thu, khong ghi),
//  pkLichSuChay (1 lo), pkLichSuCaiTrigger (tu chay moi 10 phut), pkLichSuXemTrangThai, pkLichSuLamLai. Token: PANCAKE_PAGE_TOKENS (nhu chat).
//  Mac dinh chi keo hoi thoai cap nhat trong 90 ngay (PK_HIST_DAYS), toi da 150 tin/hoi thoai (PK_HIST_MAX_MSGS).
// ═══════════════════════════════════════════════════════
var PK_HIST_SECTION_ = 1;
function _pkAllPageTokens_() {
  var pr = PropertiesService.getScriptProperties(), out = {}, all = {};
  try { var m = JSON.parse(pr.getProperty('PANCAKE_PAGE_TOKENS') || '{}'); if (m && typeof m === 'object') Object.keys(m).forEach(function (k) { if (m[k]) out[k] = String(m[k]); }); } catch (e) {}
  try { all = pr.getProperties() || {}; } catch (e2) {}
  Object.keys(all).forEach(function (k) { var mm = /^PANCAKE_PAGE_TOKEN_(.+)$/.exec(k); if (mm && all[k] && !out[mm[1]]) out[mm[1]] = String(all[k]); });
  return out;
}
function _pkIso_(s) {
  s = String(s || ''); if (!s) return '';
  if (!/(Z|[+\-]\d{2}:?\d{2})$/.test(s)) s += 'Z';   // Pancake tra gio UTC khong kem mui gio
  var d = new Date(s); return isNaN(d.getTime()) ? '' : d.toISOString();
}
function _pkPlain_(s) {
  return String(s || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
}
// SDT khach: chi tu tin KHACH nhan (phone_info, roi so go trong tin) — giong pk_ingest_pancake o schema.sql (tranh nham SDT cua page/sale).
function _pkPhoneOfMsg_(m, text) {
  var pi = Array.isArray(m.phone_info) ? m.phone_info : [], i, v, p;
  for (i = 0; i < pi.length; i++) {
    v = pi[i]; p = normPhone_(typeof v === 'string' ? v : (v && (v.phone_number || v.phone || v.captured)) || '');
    if (/^0\d{9}$/.test(p)) return p;
  }
  var mm = /(?:^|[^0-9])((?:\+?84|0)[35789][0-9]{8})(?:$|[^0-9])/.exec(String(text || '').replace(/[ .\-]/g, ''));
  if (mm) { p = normPhone_(mm[1]); if (/^0\d{9}$/.test(p)) return p; }
  return '';
}
function _pkMapMsg_(m, pageId, convId) {
  var from = (m && m.from) || {}, text = _pkPlain_(m.original_message || m.message || ''), out = String(from.id || '') === String(pageId);
  return { id: String(m.id || ''), conversation_id: convId, page_id: String(pageId), sender_id: String(from.id || ''), sender_name: String(from.name || ''),
           direction: out ? 'out' : 'in', text: text, sent_at: _pkIso_(m.inserted_at) || null, raw: { attachments: Array.isArray(m.attachments) ? m.attachments : [] }, _phone: out ? '' : _pkPhoneOfMsg_(m, text) };
}
function _pkMapConv_(c, pageId, msgs, phone) {
  var cust = (Array.isArray(c.customers) && c.customers[0]) || {}, last = msgs.length ? msgs[msgs.length - 1] : null;
  var ass = Array.isArray(c.current_assign_users) ? c.current_assign_users.map(function (u) { return String((u && u.id) || u || ''); }).filter(Boolean) : [];
  return { id: String(c.id || ''), page_id: String(pageId), psid: String((c.from && c.from.id) || cust.fb_id || ''), customer_id: String(c.customer_id || cust.id || ''),
           customer_name: String((c.from && c.from.name) || cust.name || ''), customer_phone: phone || '', snippet: String(c.snippet || ''),
           tags: Array.isArray(c.tags) ? c.tags : [], assignee_ids: ass, seen: c.seen !== false, is_replied: !!c.is_replied, conv_type: String(c.type || ''),
           last_message_at: (last && last.sent_at) || _pkIso_(c.updated_at) || null, last_text: last ? last.text : '', updated_at: new Date().toISOString() };
}
function _pkFetchJson_(url) {
  var res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true }), code = res.getResponseCode(), body = res.getContentText() || '', j = null;
  try { j = JSON.parse(body); } catch (e) {}
  if (code >= 300 || !j || j.success === false) throw new Error('Pancake HTTP ' + code + ': ' + body.slice(0, 200));
  return j;
}
function _pkInsertIgnore_(table, rows) {
  for (var i = 0; i < rows.length; i += 200) sb_('POST', table + '?on_conflict=id', rows.slice(i, i + 200), { Prefer: 'resolution=ignore-duplicates,return=minimal' });
}
// Keo toi da maxMsgs tin cua 1 hoi thoai (moi lan 30, lui dan bang current_count). Tra mang tin da map, cu -> moi.
function _pkFetchMsgs_(pageId, conv, tok, maxMsgs) {
  var got = {}, list = [], cnt = 0, base = 'https://pages.fm/api/public_api/v1/pages/' + _pkEnc_(pageId) + '/conversations/' + _pkEnc_(conv.id) + '/messages?page_access_token=' + _pkEnc_(tok) + '&customer_id=' + _pkEnc_(conv.customer_id || '');
  while (cnt < maxMsgs) {
    var j = _pkFetchJson_(base + (cnt ? '&current_count=' + cnt : '')), arr = Array.isArray(j.messages) ? j.messages : [], fresh = 0;
    arr.forEach(function (m) { if (m && m.id && !got[m.id]) { got[m.id] = 1; fresh++; list.push(_pkMapMsg_(m, pageId, conv.id)); } });
    cnt += arr.length;
    if (arr.length < 30 || !fresh) break;
    Utilities.sleep(200);
  }
  list.sort(function (a, b) { return String(a.sent_at || '') < String(b.sent_at || '') ? -1 : String(a.sent_at || '') > String(b.sent_at || '') ? 1 : 0; });
  return list;
}
function _pkHistState_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('PK_HIST_STATE') || '{}') || {}; } catch (e) { return {}; } }
function _pkHistSave_(st) { PropertiesService.getScriptProperties().setProperty('PK_HIST_STATE', JSON.stringify(st)); }
// Chay 1 lo. opts: { dryRun, budgetMs (mac dinh 270000), maxConvs (gioi han so hoi thoai/lan, dung de thu) }.
function pkHistSync_(opts) {
  opts = opts || {};
  var t0 = Date.now(), budget = opts.budgetMs || 270000, pr = PropertiesService.getScriptProperties();
  var days = Number(pr.getProperty('PK_HIST_DAYS')) || 90, maxMsgs = Number(pr.getProperty('PK_HIST_MAX_MSGS')) || 150;
  var cutoff = new Date(t0 - days * 86400000).toISOString(), toks = _pkAllPageTokens_(), pages = Object.keys(toks), st = _pkHistState_();
  var rep = { ok: true, dryRun: !!opts.dryRun, pages: pages.length, convs: 0, msgs: 0, phones: 0, done: true, errors: [], sample: [] }, convBudget = opts.maxConvs || 1e9;
  if (!pages.length) return { ok: false, error: 'Chua co token Pancake (PANCAKE_PAGE_TOKENS trong Script properties).' };
  for (var pi = 0; pi < pages.length; pi++) {
    var pg = pages[pi], ps = st[pg] = st[pg] || { cursor: '', done: false, convs: 0, msgs: 0 };
    if (opts.dryRun) ps = { cursor: '', done: false, convs: 0, msgs: 0 };
    if (ps.done) continue;
    while (!ps.done) {
      if (Date.now() - t0 > budget || convBudget <= 0) { rep.done = false; break; }
      var list;
      try { list = _pkFetchJson_('https://pages.fm/api/public_api/v2/pages/' + _pkEnc_(pg) + '/conversations?page_access_token=' + _pkEnc_(toks[pg]) + '&type=INBOX' + (ps.cursor ? '&last_conversation_id=' + _pkEnc_(ps.cursor) : '')).conversations || []; }
      catch (e) { rep.errors.push(pg + ': ' + String(e.message || e).slice(0, 160)); rep.ok = false; rep.done = false; break; }
      if (!list.length) { ps.done = true; break; }
      var stop = false, halted = false;   // stop = gap hoi thoai qua han (xong page nay); halted = het gio/het han muc lo (CHUA xong, lan sau chay tiep)
      for (var ci = 0; ci < list.length; ci++) {
        var c = list[ci];
        if (!c || !c.id) continue;
        if (String(_pkIso_(c.updated_at) || '') < cutoff) { stop = true; break; }   // danh sach xep moi -> cu: gap hoi thoai qua han thi dung han
        if (Date.now() - t0 > budget || convBudget <= 0) { halted = true; break; }
        try {
          var msgs = _pkFetchMsgs_(pg, c, toks[pg], maxMsgs), phone = '';
          msgs.forEach(function (m) { if (!phone && m._phone) phone = m._phone; });
          var conv = _pkMapConv_(c, pg, msgs, phone), rows = msgs.map(function (m) { var o = Object.assign({}, m); delete o._phone; return o; });
          if (opts.dryRun) { if (rep.sample.length < 2) rep.sample.push({ conv: conv, firstMsgs: rows.slice(0, 2), msgCount: rows.length }); }
          else {
            _pkInsertIgnore_('pk_conversations', [conv]);
            if (phone) sb_('PATCH', 'pk_conversations?id=eq.' + _pkEnc_(conv.id) + '&or=' + _pkEnc_('(customer_phone.is.null,customer_phone.eq.)'), { customer_phone: phone }, { Prefer: 'return=minimal' });
            if (rows.length) _pkInsertIgnore_('pk_messages', rows);
            ps.cursor = c.id;
          }
          rep.convs++; rep.msgs += rows.length; if (phone) rep.phones++; ps.convs++; ps.msgs += rows.length; convBudget--;
        } catch (e2) { rep.errors.push(c.id + ': ' + String(e2.message || e2).slice(0, 160)); rep.ok = false; ps.cursor = c.id; }
        Utilities.sleep(250);
      }
      if (!halted) { if (stop || list.length < 60) ps.done = true; }
      if (!opts.dryRun) st[pg] = ps;
      if (opts.dryRun) break;   // chay thu: chi 1 trang
      if (halted) { rep.done = false; break; }
    }
    if (!opts.dryRun) { st[pg] = ps; _pkHistSave_(st); }
    if (!ps.done) rep.done = false;
    if (opts.dryRun) break;
  }
  if (!opts.dryRun) _pkHistSave_(st);
  rep.state = st;
  return rep;
}
function pkLichSuThu() { Logger.log(JSON.stringify(pkHistSync_({ dryRun: true, maxConvs: 2 }), null, 2)); }
function pkLichSuChay() { Logger.log(JSON.stringify(pkHistSync_({}), null, 2)); }
function pkLichSuXemTrangThai() { Logger.log(JSON.stringify({ state: _pkHistState_(), pages: Object.keys(_pkAllPageTokens_()) }, null, 2)); }
function pkLichSuLamLai() { PropertiesService.getScriptProperties().deleteProperty('PK_HIST_STATE'); Logger.log('Da xoa con tro: lan chay sau keo lai tu dau (khong tao tin trung vi ignore-duplicates).'); }
function pkLichSuTick_() { try { var r = pkHistSync_({}); Logger.log('pkLichSuTick done=' + r.done + ' convs=' + r.convs + ' msgs=' + r.msgs + ' err=' + (r.errors || []).length); if (r.done && r.ok) removePkLichSuTrigger_(); } catch (e) { Logger.log('pkLichSuTick loi: ' + e); } }
function pkLichSuCaiTrigger() {
  removePkLichSuTrigger_();
  ScriptApp.newTrigger('pkLichSuTick_').timeBased().everyMinutes(10).create();
  Logger.log('Da cai trigger pkLichSuTick_ moi 10 phut (tu go khi keo xong).');
}
function removePkLichSuTrigger_() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'pkLichSuTick_') ScriptApp.deleteTrigger(t); }); }

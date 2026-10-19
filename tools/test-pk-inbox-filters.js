#!/usr/bin/env node
// Test BO LOC HOP THU (gas_v13.js _pkInboxFilter_ / pkChatInbox_ / pkChatFilterOpts_). Khong goi mang that. Chay: node tools/test-pk-inbox-filters.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const sec = src.slice(src.indexOf('var PK_CHAT_SECTION_'));
const rk = src.slice(src.indexOf('function _reportCacheKey_('), src.indexOf('function _scopeReport_() {'));
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
const calls = [], cache = {}, users = { u1: { username: 'u1', name: 'Lan', role: 'cs' } };
let rows = [['P1', 'Page Mot', 'Online'], ['P2', 'Page Hai', 'Online'], ['P3', 'Page Ba', 'Cua hang']];
const ctx = { jsonOut_: o => o, Logger: { log() {} }, _sessUser_: t => users[t] || null, SH_PK_PAGEMAP: 'PancakePageMap', PK_PAGEMAP_HEADERS: ['pageId', 'pageName', 'kenhBan'],
  getSheet_: () => ({ getLastRow: () => rows.length + 1, getRange: () => ({ getValues: () => rows }) }),
  sb_: (m, p) => { if (/[<>"\s{}|\\^`]/.test(String(p))) throw new Error('Invalid argument: ' + p); calls.push(p); if (/pk_staff/.test(p)) return { json: [{ id: 'S1', name: 'Hoa' }, { id: 'S2', name: 'An' }] }; return { json: [{ id: 'C1', page_id: 'P1', customer_name: 'A', customer_phone: '0912', assignee_ids: ['S1'], tags: [], seen: true, is_replied: false, conv_type: 'INBOX' }] }; },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => k === 'PANCAKE_PAGE_TOKENS' ? '{"P1":"t","P9":"t"}' : null }) },
  UrlFetchApp: { fetch: () => ({ getResponseCode: () => 404, getContentText: () => '' }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
  Utilities: { DigestAlgorithm: { MD5: 'MD5' }, Charset: { UTF_8: 'u8' }, computeDigest: (a, s) => Array.from(require('crypto').createHash('md5').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b) },
  encodeURIComponent, Date, JSON, RegExp, Array, String, Object, Number, isFinite, Math };
vm.createContext(ctx); vm.runInContext(src.slice(src.indexOf('function normPhone_'), src.indexOf('// SDT di dong Viet Nam HOP LE')) + sec + rk, ctx);
const reset = () => { calls.length = 0; Object.keys(cache).forEach(k => delete cache[k]); vm.runInContext('_pkMemo_ = {};', ctx); };
const inbox = p => ctx.pkChatInbox_({ parameter: Object.assign({ token: 'u1' }, p) });
const lastQ = () => calls.filter(c => /^pk_conversations/.test(c)).pop();
const info = { P1: { name: 'Page Mot', kenh: 'Online' }, P2: { name: 'Page Hai', kenh: 'Online' }, P3: { name: 'Page Ba', kenh: 'Cua hang' } };
const F = (p, i) => ctx._pkInboxFilter_(p, i || info);

ok(F({}).tail === '' && !F({}).active && F({}).order === 'desc', 'khong loc -> khong them dieu kien (giu hanh vi cu)');
ok(F({ type: 'comment' }).tail === '&conv_type=eq.COMMENT' && F({ type: 'xx' }).tail === '', 'loai: chi nhan INBOX/COMMENT');
ok(F({ un: 'new' }).tail === '&is_replied=eq.false' && F({ un: 'new' }).order === 'desc', 'chua tra loi - moi nhat truoc');
ok(/is_replied=eq.false&seen=eq.true/.test(F({ un: 'read' }).tail), 'da doc nhung chua tra loi');
const w = F({ un: 'wait' }); ok(w.order === 'asc' && /is_replied=eq.false&last_message_at=gte\.\d{4}-\d\d-\d\dT\d\d%3A00%3A00Z$/.test(w.tail), 'cho lau nhat: tang dan + gioi han 30 ngay: ' + w.tail);
ok(F({ un: 'bay' }).tail === '', 'gia tri chua tra loi la khong nhan');
ok(F({ ph: '1' }).tail === '&customer_phone=neq.', 'co SDT');
ok(F({ ph: '0' }).tail === '&or=(customer_phone.is.null,customer_phone.eq.)', 'chua co SDT');
ok(F({ page: 'P1' }).tail === '&page_id=eq.P1', 'theo Page');
ok(F({ nguon: 'online' }).tail === '&page_id=in.(P1,P2)', 'theo Nguon (kenh ban) -> cac Page cua kenh do, khong phan biet hoa/thuong');
ok(F({ nguon: 'Khong co' }).tail === '&id=eq.__khong_co__', 'nguon khong co Page nao -> khong tra gi (khong tra het)');
ok(/page_id=eq.P3&id=eq.__khong_co__/.test(F({ nguon: 'Online', page: 'P3' }).tail), 'page + nguon mau thuan -> rong');
ok(F({ nguon: 'Online', page: 'P1' }).tail === '&page_id=eq.P1', 'page + nguon khop -> theo page');
ok(F({ nv: 'S1' }).tail === '&assignee_ids=cs.%7BS1%7D', 'theo nhan vien: assignee_ids chua id (da ma hoa {})');
ok(F({ nv: 'x"},evil=1' }).tail === '&assignee_ids=cs.%7Bxevil1%7D' || !/[",()]/.test(F({ nv: 'x"},evil=1' }).tail.split('cs.')[1] || ''), 'ky tu la bi loai khoi id nhan vien (khong chen duoc dieu kien)');
ok(!/[<>"\s]/.test(F({ page: 'P1 ; drop', nv: 'a b' }).tail), 'khong lot khoang trang/dau nhay vao URL');
const all = F({ type: 'INBOX', un: 'new', ph: '1', page: 'P1', nv: 'S1' }); ok(all.active && all.tail.split('&').length === 6, 'gop nhieu bo loc cung luc');

// pkChatInbox_ that
reset(); let r = inbox({}); ok(r.ok && /^pk_conversations\?select=.*&order=last_message_at\.desc\.nullslast&limit=60$/.test(lastQ()) && cache['pkInbox_'], 'khong loc: URL va khoa cache giu nguyen nhu cu');
reset(); r = inbox({ ph: '1', nv: 'S1', un: 'new' }); ok(r.ok && /&is_replied=eq\.false&customer_phone=neq\.&assignee_ids=cs\.%7BS1%7D&order=last_message_at\.desc\.nullslast&limit=100$/.test(lastQ()), 'co loc: them dieu kien, limit 100: ' + lastQ());
ok(Object.keys(cache).some(k => /^pkInboxF_/.test(k)) && !cache['pkInbox_'], 'co loc: khoa cache RIENG, khong de len khoa khong-loc');
reset(); inbox({ ph: '1' }); inbox({ ph: '1' }); ok(calls.filter(c => /^pk_conversations/.test(c)).length === 1, 'goi lai cung bo loc trong 15s dung cache (khong ton luot)');
reset(); inbox({ ph: '1' }); inbox({ ph: '0' }); ok(calls.filter(c => /^pk_conversations/.test(c)).length === 2, 'bo loc khac nhau -> khoa cache khac nhau');
reset(); inbox({ un: 'wait' }); ok(/order=last_message_at\.asc\.nullslast/.test(lastQ()), 'cho lau nhat sap xep tang dan');
reset(); inbox({ q: 'Lan', ph: '1' }); ok(/customer_name=ilike\.\*Lan\*&customer_phone=neq\./.test(lastQ()), 'tim ten ket hop bo loc');
reset(); r = inbox({ nguon: 'Online' }); ok(/page_id=in\.\(P1,P2\)/.test(lastQ()), 'nguon doc bang Khop Page-Kenh trong sheet');
ok(ctx.pkChatInbox_({ parameter: { token: '' } }).code === 'AUTH', 'can dang nhap');

// lua chon
reset(); r = ctx.pkChatFilterOpts_({ parameter: { token: 'u1' } });
ok(r.ok && r.pages.length === 4 && r.pages.some(p => p.id === 'P9' && p.name === 'P9'), 'Page co token nhung chua trong bang Khop van hien (ten = id)');
ok(JSON.stringify(r.nguon) === JSON.stringify(['Cua hang', 'Online']), 'Nguon = cac Kenh ban khong trung: ' + JSON.stringify(r.nguon));
ok(JSON.stringify(r.staff.map(s => s.name)) === JSON.stringify(['An', 'Hoa']) && r.staff[0].id === 'S2', 'Nhan vien sap theo ten, kem id');
ok(ctx.pkChatFilterOpts_({ parameter: { token: '' } }).code === 'AUTH', 'danh sach loc can dang nhap');
ok(/if \(action === 'pkChatFilterOpts'\) return pkChatFilterOpts_\(e\);/.test(src), 'doGet co route pkChatFilterOpts');
console.log('ALL PK INBOX FILTER TESTS PASSED');

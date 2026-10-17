#!/usr/bin/env node
// Test Node cho DANH DAU DA DOC / CHUA DOC tu CRM (gas_v13.js pkChatRead_). Khong goi mang that.
// Chay: node tools/test-pk-chat-read.js -> "ALL PK READ TESTS PASSED" neu dat.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const sec = src.slice(src.indexOf('var PK_CHAT_SECTION_'));
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const calls = [], props = {}, users = { u1: { username: 'u1', name: 'Lan', role: 'cs' }, d1: { username: 'd1', role: 'demo' } };
const cache = {}; let sbReply = () => ({ json: [] }), apiReply = null, sbThrow = false;
const ctx = { jsonOut_: o => o, Logger: { log() {} }, _sessUser_: t => users[t] || null,
  sb_: (m, p, b) => { if (/[<>"\s{}|\\^`]/.test(String(p))) throw new Error('Invalid argument: ' + p); calls.push({ m, p, b }); if (m === 'PATCH' && sbThrow) throw new Error('boom'); return sbReply(m, p, b); },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null }) },
  UrlFetchApp: { fetch: (u, o) => { calls.push({ fetch: u, o }); const r = apiReply(u, o); return { getResponseCode: () => r.code, getContentText: () => r.body }; } },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
  encodeURIComponent, Date, JSON, RegExp, Array, String, Object, Number, isFinite, Math };
vm.createContext(ctx); vm.runInContext(src.slice(src.indexOf('function normPhone_'), src.indexOf('// SDT di dong Viet Nam HOP LE')) + sec, ctx);
const reset = () => { calls.length = 0; sbThrow = false; Object.keys(cache).forEach(k => delete cache[k]); vm.runInContext('_pkMemo_ = {};', ctx); };
const rd = (d) => ctx.pkChatRead_(Object.assign({ token: 'u1', convId: 'C1', op: 'unread' }, d));
const fetches = () => calls.filter(c => c.fetch), patches = () => calls.filter(c => c.m === 'PATCH');
sbReply = () => ({ json: [{ id: 'C1', page_id: 'P1', conv_type: 'INBOX', tags: [] }] }); props.PANCAKE_PAGE_TOKENS = '{"P1":"TOK123"}';
apiReply = () => ({ code: 200, body: '{"success":true}' });

reset();
ok(rd({ token: '' }).code === 'AUTH', 'read: can dang nhap');
ok(/Tai khoan test/.test(rd({ token: 'd1' }).error), 'read: tai khoan test bi chan');
ok(/Thieu convId/.test(rd({ convId: '' }).error), 'read: thieu convId');
for (const bad of ['', 'toggle', 'READ ', 'seen']) ok(/op phai/.test(rd({ op: bad }).error), 'read: op khong hop le bi chan: [' + bad + ']');
ok(fetches().length === 0, 'read: input sai KHONG goi Pancake');
reset(); sbReply = () => ({ json: [] }); ok(/Khong tim thay hoi thoai/.test(rd().error), 'read: hoi thoai khong ton tai');
sbReply = () => ({ json: [{ id: 'C1', page_id: 'P9' }] }); ok(/Chua cai token Pancake cho page P9/.test(rd().error) && fetches().length === 0, 'read: page chua co token -> huong dan, khong goi Pancake');
sbReply = () => ({ json: [{ id: 'C1', page_id: '' }] }); ok(/chua co page_id/.test(rd().error), 'read: thieu page_id');

// chua doc
sbReply = () => ({ json: [{ id: 'C1', page_id: 'P1' }] }); reset(); cache.pkInbox_ = '{"x":1}'; cache['pkInbox_abc'] = '{"y":1}';
let r = rd({ op: 'unread' });
ok(r.ok === true && r.seen === false, 'unread: ok + seen=false: ' + JSON.stringify(r));
ok(fetches()[0].fetch === 'https://pages.fm/api/public_api/v1/pages/P1/conversations/C1/unread?page_access_token=TOK123' && fetches()[0].o.method === 'post', 'unread: dung endpoint POST .../unread');
ok(JSON.stringify(patches().map(c => [c.p, c.b])) === JSON.stringify([['pk_conversations?id=eq.C1', { seen: false }]]), 'unread: ghi seen=false vao Supabase: ' + JSON.stringify(patches()));
ok(cache.pkInbox_ === undefined && cache['pkInbox_abc'] !== undefined, 'unread: xoa cache hop thu khong-loc (15s), khong dong vao cache khac');
// da doc
reset(); r = rd({ op: 'read' });
ok(r.ok && r.seen === true && /\/conversations\/C1\/read\?page_access_token=TOK123$/.test(fetches()[0].fetch) && patches()[0].b.seen === true, 'read: seen=true + endpoint /read');
// op viet hoa van nhan
reset(); r = rd({ op: 'UNREAD' }); ok(r.ok && r.seen === false && /\/unread\?/.test(fetches()[0].fetch), 'op viet hoa duoc chuan hoa');
// ma hoa convId co ky tu dac biet
sbReply = () => ({ json: [{ id: 'P1_123 456', page_id: 'P1' }] }); reset(); r = rd({ convId: 'P1_123 456' });
ok(r.ok && fetches()[0].fetch.indexOf('conversations/P1_123%20456/unread') > 0 && patches()[0].p === 'pk_conversations?id=eq.P1_123%20456', 'convId duoc ma hoa trong URL Pancake va truy van Supabase');
sbReply = () => ({ json: [{ id: 'C1', page_id: 'P1' }] });
// Pancake tu choi -> KHONG ghi Supabase, khong lo token
reset(); apiReply = () => ({ code: 403, body: '{"success":false,"message":"bad TOK123"}' }); r = rd();
ok(/Pancake tu choi \(HTTP 403\)/.test(r.error) && r.error.indexOf('TOK123') < 0 && patches().length === 0, 'Pancake 403: bao loi, che token, khong ghi Supabase: ' + r.error);
reset(); apiReply = () => ({ code: 200, body: '{"success":false}' }); r = rd(); ok(r.error && patches().length === 0, 'success:false cung la loi');
// Supabase PATCH loi -> van ok (webhook se bu)
reset(); apiReply = () => ({ code: 200, body: '{"success":true}' }); sbThrow = true; r = rd(); ok(r.ok && r.seen === false, 'PATCH Supabase loi van tra ok (webhook bu)');
// Pancake tra body rong / khong phai JSON nhung 200 -> coi la thanh cong
reset(); apiReply = () => ({ code: 200, body: '' }); r = rd(); ok(r.ok, 'HTTP 200 body rong = thanh cong');
// route doPost
ok(/if \(action === 'pkChatRead'\) return pkChatRead_\(data\);/.test(src), 'doPost co route pkChatRead');
console.log('ALL PK READ TESTS PASSED');

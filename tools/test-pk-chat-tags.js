#!/usr/bin/env node
// Test Node cho GAN/GO THE tu CRM + NGUOI TRA LOI GAN NHAT (gas_v13.js, phan Pancake chat). Khong goi mang that.
// Chay: node tools/test-pk-chat-tags.js -> "ALL PK TAG TESTS PASSED" neu dat.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const sec = src.slice(src.indexOf('var PK_CHAT_SECTION_'));
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const calls = [], props = {}, users = { u1: { username: 'u1', name: 'Lan', role: 'cs' }, d1: { username: 'd1', role: 'demo' } };
const cache = {}; let sbReply = () => ({ json: [] }), apiReply = null;
const TAGS = { tags: [{ id: 26, text: 'L1. Chuẩn', color: '#0a7a3a' }, { id: 5, text: 'Trả hàng', color: '#bd2727' }, { id: 'abc', text: 'rac', color: '#000' }, { id: 7, text: 'Hết hàng', color: 'red' }] };
const ctx = { jsonOut_: o => o, Logger: { log() {} }, _sessUser_: t => users[t] || null,
  sb_: (m, p, b, h) => { if (/[<>"\s{}|\\^`]/.test(String(p))) throw new Error('Invalid argument: ' + p); calls.push({ m, p, b, h }); return sbReply(m, p, b); },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null }) },
  UrlFetchApp: { fetch: (u, o) => { calls.push({ fetch: u, o }); const r = apiReply(u, o); return { getResponseCode: () => r.code, getContentText: () => r.body }; } },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; },
    getAll: ks => { const o = {}; ks.forEach(k => { if (cache[k] !== undefined) o[k] = cache[k]; }); return o; }, putAll: (o) => { Object.assign(cache, o); } }) },
  encodeURIComponent, Date, JSON, RegExp, Array, String, Object, Number, isFinite, Math };
vm.createContext(ctx); vm.runInContext(src.slice(src.indexOf('function normPhone_'), src.indexOf('// SDT di dong Viet Nam HOP LE')) + sec, ctx);
const reset = () => { calls.length = 0; Object.keys(cache).forEach(k => delete cache[k]); vm.runInContext('_pkMemo_ = {};', ctx); };
const okApi = (tagsData) => (u, o) => {
  if (o && o.method === 'post') return { code: 200, body: JSON.stringify({ success: true, data: tagsData }) };
  if (/\/tags\?page_access_token=/.test(u)) return { code: 200, body: JSON.stringify(TAGS) };
  return { code: 200, body: '{}' };
};
const fetches = () => calls.filter(c => c.fetch);
const sbq = () => calls.filter(c => c.p !== undefined && !/^pk_staff/.test(c.p));

// ---------- pkChatTags_ ----------
reset(); apiReply = okApi([]);
ok(ctx.pkChatTags_({ parameter: { pageId: 'P1' } }).code === 'AUTH', 'tags: khong token -> AUTH');
ok(/Tai khoan test/.test(ctx.pkChatTags_({ parameter: { token: 'd1', pageId: 'P1' } }).error), 'tags: demo bi chan');
ok(/Thieu pageId/.test(ctx.pkChatTags_({ parameter: { token: 'u1' } }).error), 'tags: thieu pageId');
let r = ctx.pkChatTags_({ parameter: { token: 'u1', pageId: 'P1' } });
ok(/PANCAKE_PAGE_TOKENS/.test(r.error) && fetches().length === 0, 'tags: chua cai token page -> huong dan, khong goi Pancake');
props.PANCAKE_PAGE_TOKENS = '{"P1":"TOK123"}'; reset();
r = ctx.pkChatTags_({ parameter: { token: 'u1', pageId: 'P1' } });
ok(r.ok && r.tags.map(t => t.id).join() === '5,7,26', 'tags: xep theo ma so tang dan, bo ma khong phai so: ' + JSON.stringify(r.tags));
ok(r.tags.find(t => t.id === '26').t === 'L1. Chuẩn' && r.tags.find(t => t.id === '26').c === '#0a7a3a', 'tags: ten + mau dung');
ok(r.tags.find(t => t.id === '7').c === '', 'tags: mau khong phai #hex bi bo (chong chen CSS)');
ok(fetches()[0].fetch === 'https://pages.fm/api/public_api/v1/pages/P1/tags?page_access_token=TOK123', 'tags: dung endpoint list tags cua Pancake');
ctx.pkChatTags_({ parameter: { token: 'u1', pageId: 'P1' } }); ok(fetches().length === 1, 'tags: lan 2 dung cache 6 gio, khong goi lai Pancake');
ctx.pkChatTags_({ parameter: { token: 'u1', pageId: 'P1', refresh: '1' } }); ok(fetches().length === 2, 'tags: refresh=1 bo cache va goi lai (vua tao the moi tren Pancake)');
reset(); sbReply = () => ({ json: [{ id: 'C1', page_id: 'P1' }] });
r = ctx.pkChatTags_({ parameter: { token: 'u1', conv: 'C1' } }); ok(r.ok && r.pageId === 'P1' && /pk_conversations\?select=id,page_id,conv_type,tags&id=eq\.C1/.test(sbq()[0].p), 'tags: tim page tu convId');
// ---------- pkChatTag_ ----------
const tag = (d) => ctx.pkChatTag_(Object.assign({ token: 'u1', convId: 'C1', tagId: '26', op: 'add' }, d));
sbReply = () => ({ json: [{ id: 'C1', page_id: 'P1', conv_type: 'INBOX', tags: [5] }] });
ok(tag({ token: '' }).code === 'AUTH' && /Tai khoan test/.test(tag({ token: 'd1' }).error), 'tag: can dang nhap, demo bi chan');
ok(/Thieu convId/.test(tag({ convId: '' }).error), 'tag: thieu convId');
for (const bad of ['', 'abc', '1;2', '99999999999', '1.5', '<b>']) ok(/Ma the khong hop le/.test(tag({ tagId: bad }).error), 'tag: ma the khong hop le bi chan: ' + bad);
ok(/op phai/.test(tag({ op: 'toggle' }).error) && /op phai/.test(tag({ op: '' }).error), 'tag: op chi add/remove');
reset(); sbReply = () => ({ json: [] }); ok(/Khong tim thay hoi thoai/.test(tag().error), 'tag: hoi thoai khong ton tai');
sbReply = () => ({ json: [{ id: 'C1', page_id: 'P9', conv_type: 'INBOX', tags: [] }] }); props.PANCAKE_PAGE_TOKENS = '{"P1":"TOK123"}';
ok(/Chua cai token Pancake cho page P9/.test(tag().error), 'tag: page chua co token -> huong dan');
reset(); sbReply = () => ({ json: [{ id: 'C1', page_id: 'P1', conv_type: 'INBOX', tags: [5] }] });
apiReply = okApi([5, 26]);
r = tag();
const post = fetches().find(c => c.o && c.o.method === 'post');
ok(r.ok && post.fetch === 'https://pages.fm/api/public_api/v1/pages/P1/conversations/C1/tags?page_access_token=TOK123', 'tag: dung endpoint POST .../conversations/{id}/tags');
ok(JSON.stringify(JSON.parse(post.o.payload)) === '{"action":"add","tag_id":"26"}' && post.o.contentType === 'application/json', 'tag: body {action:add, tag_id:"26"} (tag_id la chuoi theo tai lieu)');
ok(r.tags.map(t => t.t).join() === 'Trả hàng,L1. Chuẩn' && r.ids.join() === '5,26', 'tag: tra the sau khi cap nhat (ten + mau), khong tra ma la');
const patch = sbq().find(c => c.m === 'PATCH');
ok(patch && patch.p === 'pk_conversations?id=eq.C1' && JSON.stringify(patch.b) === '{"tags":[5,26]}', 'tag: ghi ngay tags moi vao Supabase de CRM hien tuc thi');
reset(); apiReply = okApi([26]); r = tag({ tagId: '5', op: 'remove' });
ok(JSON.parse(fetches().find(c => c.o && c.o.method === 'post').o.payload).action === 'remove' && r.tags.length === 1, 'tag: go the');
reset(); apiReply = okApi([5, -99, 26]); r = tag(); ok(r.tags.map(t => t.id).join() === '5,26' && r.ids.join() === '5,-99,26', 'tag: ma khong co trong danh sach the (-99) bi bo khi hien, van ghi dung vao DB');
reset(); apiReply = okApi([]); const t2 = ctx.pkChatTag_({ token: 'u1', convId: 'C1', tagId: '999', op: 'add' });
ok(/khong con tren page/.test(t2.error) && !fetches().some(c => c.o && c.o.method === 'post'), 'tag: the khong co tren page -> bao loi, KHONG goi Pancake');
// Pancake loi: bao loi, khong lo token, khong ghi DB
reset(); apiReply = (u, o) => (o && o.method === 'post') ? { code: 403, body: '{"success":false,"message":"no permission TOK123"}' } : { code: 200, body: JSON.stringify(TAGS) };
r = tag(); ok(/HTTP 403/.test(r.error) && !/TOK123/.test(JSON.stringify(r)) && !sbq().some(c => c.m === 'PATCH'), 'tag: Pancake tu choi -> loi, khong lo token, khong ghi DB');
reset(); apiReply = (u, o) => (o && o.method === 'post') ? { code: 200, body: '{"success":false}' } : { code: 200, body: JSON.stringify(TAGS) };
ok(/Pancake tu choi/.test(tag().error), 'tag: success=false -> loi');
// Pancake khong tra data: tu tinh tu the hien co
reset(); apiReply = (u, o) => (o && o.method === 'post') ? { code: 200, body: '{"success":true}' } : { code: 200, body: JSON.stringify(TAGS) };
r = tag(); ok(r.ids.join() === '5,26', 'tag: khong co data -> tu tinh them 26 vao [5]');
r = tag(); ok(r.ids.join() === '5,26', 'tag: them lai the da co khong nhan doi');
r = tag({ tagId: '5', op: 'remove' }); ok(r.ids.join() === '', 'tag: khong co data -> go 5');
// PATCH Supabase loi KHONG lam hong viec gan the (Pancake da nhan)
reset(); apiReply = okApi([5, 26]); const sbOld = sbReply; sbReply = (m) => { if (m === 'PATCH') throw new Error('db down'); return sbOld(); };
r = tag(); ok(r.ok && r.tags.length === 2, 'tag: loi ghi Supabase van tra ok (webhook se bu)'); sbReply = sbOld;
// ---------- hop thu KHONG ton them luot goi (tran UrlFetch 20.000/ngay) ----------
reset(); apiReply = okApi([]);
sbReply = (m, p) => p.startsWith('pk_conversations') ? { json: [{ id: 'A', page_id: 'P1', tags: [], assignee_ids: [] }] } : { json: [] };
ctx.pkChatInbox_({ parameter: { token: 'u1' } });
ok(!sbq().some(c => /^pk_messages/.test(c.p)), 'hop thu: khong doc them bang tin nhan (khong ton them luot UrlFetch cho "nguoi tra loi gan nhat")');
ok(typeof ctx._pkLastStaff_ === 'undefined', 'khong con ham _pkLastStaff_');
// dispatch that su ton tai
ok(/action === 'pkChatTags'\) return pkChatTags_\(e\)/.test(src) && /action === 'pkChatTag'\) return pkChatTag_\(data\)/.test(src), 'dispatch pkChatTags (GET) + pkChatTag (POST) co trong doGetCore_/doPostCore_');
console.log('ALL PK TAG TESTS PASSED');

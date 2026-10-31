// Test goi y phat tu tin nhan Pancake — 2026-10-31. Chay: node tools/test-team-penalty-suggest.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } }
const ctx = { _normTxt_: s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase() };
vm.createContext(ctx); vm.runInContext(grab('_tbScanMsgs_'), ctx);
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const T = (h, m) => new Date(Date.UTC(2026, 9, 30, h, m)).toISOString();
const mo = { hoa: 'Hoa', nam: 'Nam' };
const conv = (o) => Object.assign({ conv_type: 'INBOX', customer_name: 'K', customer_phone: '09', seen: true, is_replied: true, assignee_ids: [], page_id: 'p' }, o || {});
const M = (id, dir, t, staff, c) => ({ conversation_id: id, direction: dir, sent_at: t, crm_user: staff || null, staff_name: null, pk_conversations: c || conv() });
const now = Date.parse(T(23, 0)), end = Date.parse(T(23, 59));
// 1) tra loi sau 45p -> loai 1, sale = Hoa
let r = ctx._tbScanMsgs_([M('a', 'in', T(8, 0)), M('a', 'out', T(8, 45), 'Hoa')], now, end, 30, {}, mo);
ok(r.length === 1 && r[0].type === 1 && r[0].gapMin === 45 && r[0].sale === 'Hoa' && !r[0].open, 'tra loi tre 45p');
// 2) dung 30p khong phat
r = ctx._tbScanMsgs_([M('a', 'in', T(8, 0)), M('a', 'out', T(8, 30), 'Hoa')], now, end, 30, {}, mo);
ok(r.length === 0, '30p khong phat');
// 3) khach nhan nhieu tin lien tiep -> tinh tu tin dau
r = ctx._tbScanMsgs_([M('a', 'in', T(8, 0)), M('a', 'in', T(8, 20)), M('a', 'out', T(8, 40), 'Nam')], now, end, 30, {}, mo);
ok(r.length === 1 && r[0].gapMin === 40 && r[0].sale === 'Nam', 'tinh tu tin dau tien');
// 4) chua tra loi, da doc -> loai 3 ; chua doc -> loai 1
r = ctx._tbScanMsgs_([M('a', 'in', T(10, 0), '', conv({ seen: true, is_replied: false, assignee_ids: ['u1'] })), M('b', 'in', T(10, 0), '', conv({ seen: false, is_replied: false }))], now, end, 30, { u1: 'Hoa' }, mo);
const A = r.find(x => x.convId === 'a'), B = r.find(x => x.convId === 'b');
ok(A && A.type === 3 && A.open && A.sale === 'Hoa', 'da doc khong tra loi = loai 3');
ok(B && B.type === 1 && B.open && B.sale === '', 'chua doc = loai 1, chua ro sale');
// 5) binh luan bi bo qua
r = ctx._tbScanMsgs_([M('c', 'in', T(8, 0), '', conv({ conv_type: 'COMMENT' })), M('c', 'out', T(9, 0), 'Hoa', conv({ conv_type: 'COMMENT' }))], now, end, 30, {}, mo);
ok(r.length === 0, 'bo qua COMMENT');
// 6) ngay cu da duoc tra loi sau do (is_replied=true) -> khong goi y tin treo
r = ctx._tbScanMsgs_([M('d', 'in', T(22, 0), '', conv({ is_replied: true }))], now, end, 30, {}, mo);
ok(r.length === 0, 'tin treo nhung hoi thoai da duoc tra loi hom sau -> bo');
// 7) dang trong 30p den hien tai -> khong phat
r = ctx._tbScanMsgs_([M('e', 'in', T(22, 45), '', conv({ is_replied: false }))], now, end, 30, {}, mo);
ok(r.length === 0, 'moi 15p chua phat');
// 8) sap xep giam theo gap, khoa on dinh
r = ctx._tbScanMsgs_([M('a', 'in', T(8, 0)), M('a', 'out', T(8, 40), 'Hoa'), M('b', 'in', T(9, 0)), M('b', 'out', T(11, 0), 'Hoa')], now, end, 30, {}, mo);
ok(r.length === 2 && r[0].gapMin === 120 && /^m:b:2026-10-30T09:00$/.test(r[0].key), 'sap xep & khoa');
// 9) nhieu luot trong 1 hoi thoai
r = ctx._tbScanMsgs_([M('a', 'in', T(8, 0)), M('a', 'out', T(9, 0), 'Hoa'), M('a', 'in', T(13, 0)), M('a', 'out', T(14, 0), 'Hoa')], now, end, 30, {}, mo);
ok(r.length === 2, 'hai luot tre trong cung hoi thoai');
console.log(fail ? fail + ' FAIL' : 'ALL OK'); process.exit(fail ? 1 : 0);

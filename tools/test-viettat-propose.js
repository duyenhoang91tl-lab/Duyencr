#!/usr/bin/env node
// Test: ĐỀ XUẤT sửa mục viết tắt / mẫu tin -> admin duyệt cho cả team (Duyên 2026-11-17). Chạy HÀM THẬT trong gas_v13.js với sheet giả.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = vm.createContext({ SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(), DocumentApp: svc(), ContentService: svc(),
  HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console });
vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
// ---- sheet giả: rows[0] = tiêu đề (dòng 1) ----
const S = {};
function mk(name, headers, rows) {
  const sh = { rows: [headers.slice()].concat((rows || []).map(r => r.slice())), appendRow(r) { this.rows.push(r.slice()); },
    getLastRow() { return this.rows.length; }, getDataRange() { const t = this; return { getValues: () => t.rows.map(r => r.slice()) }; },
    getRange(r, c, n, w) { const t = this; n = n || 1; w = w || 1; return {
      getValues: () => { const o = []; for (let i = 0; i < n; i++) { const x = t.rows[r - 1 + i] || []; const q = x.slice(c - 1, c - 1 + w); while (q.length < w) q.push(''); o.push(q); } return o; },
      setValues: v => { v.forEach((x, i) => { const cur = t.rows[r - 1 + i] || (t.rows[r - 1 + i] = []); while (cur.length < c - 1 + x.length) cur.push(''); x.forEach((y, k) => { cur[c - 1 + k] = y; }); }); },
      setValue: y => { const cur = t.rows[r - 1] || (t.rows[r - 1] = []); while (cur.length < c) cur.push(''); cur[c - 1] = y; } }; } };
  S[name] = sh; return sh;
}
const J = o => JSON.parse(o.getContent());
const VT = ctx.VIETTAT_HEADERS, TPL = ctx.MSG_TPL_HEADERS;
const vtRow = (id, nhom, abbr, kw, opts, owner, upd) => { const r = new Array(VT.length).fill(''); r[0] = id; r[1] = nhom; r[2] = abbr; r[3] = kw; r[4] = JSON.stringify(opts); r[5] = owner; r[7] = upd; return r; };
const tplRow = (id, title, content, status, upd, abbr) => { const r = new Array(TPL.length).fill(''); r[0] = id; r[1] = title; r[2] = content; r[6] = upd; r[9] = status; r[15] = abbr || ''; return r; };
function reset() {
  Object.keys(S).forEach(k => delete S[k]);
  mk(ctx.SH_VIETTAT, VT, [vtRow('vt_1', 'Chung', 'stk', 'số tài khoản', ['STK cũ 123'], '', '2026-11-01T00:00:00.000Z'), vtRow('vt_2', 'Chung', 'rieng', '', ['của Mai'], 'Mai', '2026-11-01T00:00:00.000Z')]);
  mk(ctx.SH_MSG_TPL, TPL, [tplRow('7', 'Chào khách', 'Nội dung mẫu 7 gốc', 'approved', '2026-11-02T00:00:00.000Z', 'chao'), tplRow('8', 'Mẫu chờ', 'đang chờ', 'pending', '2026-11-02T00:00:00.000Z')]);
  mk(ctx.SH_NOTIF, ctx.NOTIF_HEADERS, []);
}
reset();
ctx.__S = S; ctx.__J = J;
vm.runInContext(`
  getCrmSS_ = function() { return { getSheetByName: function(n) { return __S[n] || null; } }; };
  getSheet_ = function(n, h) { if (!__S[n]) { __S[n] = { rows: [h.slice()], appendRow: function(r) { this.rows.push(r.slice()); }, getLastRow: function() { return this.rows.length; }, getDataRange: function() { var t = this; return { getValues: function() { return t.rows.map(function(r) { return r.slice(); }); } }; },
    getRange: function(r, c, n2, w) { var t = this; n2 = n2 || 1; w = w || 1; return { getValues: function() { var o = []; for (var i = 0; i < n2; i++) { var x = t.rows[r - 1 + i] || []; var q = x.slice(c - 1, c - 1 + w); while (q.length < w) q.push(''); o.push(q); } return o; },
      setValues: function(v) { v.forEach(function(x, i) { var cur = t.rows[r - 1 + i] || (t.rows[r - 1 + i] = []); while (cur.length < c - 1 + x.length) cur.push(''); x.forEach(function(y, k) { cur[c - 1 + k] = y; }); }); },
      setValue: function(y) { var cur = t.rows[r - 1] || (t.rows[r - 1] = []); while (cur.length < c) cur.push(''); cur[c - 1] = y; } }; } }; } return __S[n]; };
  jsonOut_ = function(o) { return { getContent: function() { return JSON.stringify(o); } }; };
  LockService = { getScriptLock: function() { return { tryLock: function() { return true; }, releaseLock: function() {} }; } };
  readUsers_ = function() { return [ { username: 'duyenht', name: 'Duyên HT', role: 'admin', active: true }, { username: 'admin2', name: 'Admin Hai', role: 'admin', active: true },
    { username: 'off', name: 'Admin Nghi', role: 'admin', active: false }, { username: 'cs_lan', name: 'Lan', role: 'cs', active: true } ]; };
  _vtNhom_ = function(x) { return String(x || '').trim() || 'Chung'; };
`, ctx);
const ADMIN = { priv: true, name: 'Duyên HT', role: 'admin' }, LAN = { priv: false, name: 'Lan' }, NONAME = { priv: false, name: '' };
const P = (d, c) => J(ctx.vietTatPropose_(d, c));
const L = c => ctx.vietTatProposalsList_(c);
const D = (d, c) => J(ctx.vietTatDecide_(d, c));
const notifs = () => S[ctx.SH_NOTIF].rows.slice(1);
const props = () => S[ctx.SH_VT_PROP] ? S[ctx.SH_VT_PROP].rows.slice(1) : [];

// ---------- 1) gửi đề xuất sửa mục chung ----------
let r = P({ targetId: 'crm_vt_1', abbr: 'stk', keyword: 'số tk', options: ['STK MỚI 999', '[[img:a.jpg]]', '[[aud:b.m4a]]'], baseUpdatedAt: '2026-11-01T00:00:00.000Z' }, LAN);
ok(r.ok && r.status === 'pending' && /^vp_/.test(r.id) && r.updatedExisting === false, 'Lan gửi đề xuất sửa mục chung (id có tiền tố crm_ được chuẩn hoá): ' + r.id);
ok(r.strippedMedia === 2 && JSON.parse(props()[0][6]).join('|') === 'STK MỚI 999', 'hình/ghi âm TRÊN MÁY bị bỏ (2), chỉ lưu chữ: ' + props()[0][6]);
ok(props().length === 1 && props()[0][1] === 'vt_1' && props()[0][2] === 'vt' && props()[0][7] === 'Lan' && props()[0][11] === 'pending', 'dòng đề xuất: đích vt_1, loại vt, người đề xuất Lan, trạng thái pending');
ok(r.notified === 2 && notifs().length === 2 && notifs().every(n => n[3] === 'vtpropose' && n[4] === 'vtpropose' && n[5] === r.id && n[9] === ''), 'THÔNG BÁO cho MỌI admin đang hoạt động (duyenht + admin2), KHÔNG gửi admin đã nghỉ, chưa đọc');
ok(notifs().map(n => n[1]).sort().join() === 'admin2,duyenht' && notifs()[0][7].length <= 160 && /Lan/.test(notifs()[0][7]) && /"stk"/.test(notifs()[0][7]) && /duyệt cho cả team/.test(notifs()[0][7]), 'nội dung thông báo ngắn gọn (<=160): ' + notifs()[0][7]);
ok(r.notified === 2 && !notifs().some(n => n[1] === 'cs_lan'), 'không gửi cho người không phải admin');
// admin tự đề xuất -> không tự báo mình
reset(); r = P({ targetId: 'vt_1', abbr: 'stk', options: ['x'] }, { priv: true, name: 'Duyên HT' });
ok(r.ok && r.notified === 1 && notifs()[0][1] === 'admin2', 'admin Duyên tự đề xuất: chỉ báo admin khác, không tự báo mình');
reset();
// ---------- 2) gửi lại cùng mục: cập nhật, không nhân đôi ----------
r = P({ targetId: 'vt_1', abbr: 'stk', options: ['bản 1'] }, LAN);
const id1 = r.id;
r = P({ targetId: 'crm_vt_1', abbr: 'stk', options: ['bản 2 sửa lại'] }, LAN);
ok(r.ok && r.id === id1 && r.updatedExisting === true && props().length === 1 && JSON.parse(props()[0][6])[0] === 'bản 2 sửa lại', 'gửi lại cùng mục: CẬP NHẬT đề xuất cũ (không nhân đôi)');
ok(notifs().filter(n => n[9] === '').length === 2 && notifs().filter(n => n[9] !== '').length === 2, 'báo lại admin: thông báo cũ chuyển "đã đọc", thông báo mới chưa đọc');
// ---------- 3) mẫu tin (tpl_) ----------
r = P({ targetId: 'crm_tpl_7', abbr: 'chao2', options: ['Nội dung mẫu 7 MỚI'] }, LAN);
ok(r.ok && props()[1][1] === 'tpl_7' && props()[1][2] === 'tpl', 'đề xuất sửa mẫu tin tpl_7: ghi đích tpl_7, loại tpl');
ok(!P({ targetId: 'crm_tpl_7', abbr: 'x', options: ['a', 'b'] }, { priv: false, name: 'Hoa' }).ok && /chỉ có 1 nội dung/.test(P({ targetId: 'tpl_7', abbr: 'x', options: ['a', 'b'] }, { name: 'Hoa' }).error), 'mẫu tin chỉ có 1 nội dung: gửi 2 nội dung -> báo rõ');
ok(/chưa được duyệt/.test(P({ targetId: 'tpl_8', abbr: 'x', options: ['a'] }, LAN).error), 'mẫu tin chưa duyệt: không đề xuất sửa');
ok(/Không tìm thấy mục chung/.test(P({ targetId: 'vt_zzz', abbr: 'x', options: ['a'] }, LAN).error) && /Không tìm thấy mục chung/.test(P({ targetId: 'tpl_999', abbr: 'x', options: ['a'] }, LAN).error), 'đích không còn: báo rõ, bảo bấm ☁ CRM');
ok(/CHUNG của team/.test(P({ targetId: 'vt_2', abbr: 'x', options: ['a'] }, LAN).error), 'mục RIÊNG của người khác: không đề xuất được');
// ---------- 4) kiểm tra đầu vào ----------
ok(P({ abbr: 'có cách', options: ['a'] }, LAN).error && P({ abbr: '', options: ['a'] }, LAN).error && P({ abbr: 'x'.repeat(31), options: ['a'] }, LAN).error, 'viết tắt rỗng / có khoảng trắng / quá 30 ký tự -> lỗi');
ok(/Thiếu nội dung/.test(P({ abbr: 'moi', options: [] }, LAN).error) && /Thiếu nội dung/.test(P({ abbr: 'moi', options: ['[[img:a.jpg]]', '  '] }, LAN).error), 'không có nội dung chữ (chỉ hình/trống) -> lỗi');
ok(P({ abbr: 'moi', options: ['a'] }, NONAME).code === 'AUTH', 'không có tên người đề xuất -> AUTH');
// ---------- 5) giới hạn 20 đề xuất chờ / người ----------
reset();
let okAll = true; for (let i = 0; i < 20; i++) okAll = okAll && P({ abbr: 'm' + i, options: ['n' + i] }, LAN).ok;
ok(okAll && props().length === 20, 'Lan gửi 20 đề xuất mục MỚI khác nhau: đều được');
r = P({ abbr: 'm20', options: ['n'] }, LAN);
ok(!r.ok && /tối đa 20/.test(r.error), 'đề xuất thứ 21 bị chặn (chống spam), báo rõ');
ok(P({ abbr: 'm0', options: ['sửa lại m0'] }, LAN).ok && props().length === 20, 'nhưng SỬA lại đề xuất mục mới có sẵn (cùng viết tắt) thì vẫn được, không tăng số lượng');
ok(P({ abbr: 'khac', options: ['n'] }, { priv: false, name: 'Hoa' }).ok, 'giới hạn tính RIÊNG từng người (Hoa vẫn gửi được)');
reset();
// ---------- 6) liệt kê theo quyền ----------
const a = P({ targetId: 'vt_1', abbr: 'stk', options: ['STK MỚI'], baseUpdatedAt: '2026-11-01T00:00:00.000Z' }, LAN);
const b = P({ targetId: 'tpl_7', abbr: 'chao', options: ['mẫu 7 mới'], baseUpdatedAt: '2026-11-02T00:00:00.000Z' }, { name: 'Hoa' });
const c = P({ abbr: 'moi', nhom: 'Túi Tiền', options: ['mục mới'] }, LAN);
let la = L(ADMIN);
ok(la.ok && la.admin && la.pending === 3 && la.items.length === 3, 'admin: thấy cả 3 đề xuất, pending = 3');
ok(la.items.find(x => x.id === a.id).target.options[0] === 'STK cũ 123' && la.items.find(x => x.id === a.id).conflict === false, 'admin thấy NỘI DUNG HIỆN TẠI của mục chung để so sánh; chưa đổi -> không xung đột');
ok(la.items.find(x => x.id === c.id).target === null && la.items.find(x => x.id === c.id).kind === 'new' && la.items.find(x => x.id === c.id).nhom === 'Túi Tiền', 'đề xuất mục mới: không có đích, giữ nhóm Túi Tiền');
S[ctx.SH_VIETTAT].rows[1][7] = '2026-11-10T00:00:00.000Z';   // admin sửa mục chung SAU khi Lan đề xuất
la = L(ADMIN);
ok(la.items.find(x => x.id === a.id).conflict === true && la.items.find(x => x.id === b.id).conflict === false, 'mục chung đã đổi sau khi đề xuất -> cờ XUNG ĐỘT cho admin biết');
const ll = L(LAN);
ok(ll.ok && !ll.admin && ll.items.length === 2 && ll.items.every(x => x.id === a.id || x.id === c.id) && !('target' in ll.items[0]), 'Lan chỉ thấy đề xuất CỦA MÌNH (2), không thấy của Hoa, không lộ nội dung đích');
ok(L(NONAME).code === 'AUTH', 'không có tên: AUTH');
ok(ctx._vpSummaryFor_(ADMIN).adminPending === 3 && ctx._vpSummaryFor_({ name: 'duyenht' }).adminPending === 3 && ctx._vpSummaryFor_({ name: 'Duyên HT' }).adminPending === 3, 'app: tên khớp admin (kể cả gõ "duyenht") -> nhận số đề xuất chờ = 3');
ok(ctx._vpSummaryFor_(LAN).adminPending === null && ctx._vpSummaryFor_(LAN).own.length === 2 && ctx._vpSummaryFor_({ name: 'Admin Nghi' }).adminPending === null, 'nhân viên thường / admin đã nghỉ: adminPending = null; người gửi thấy trạng thái đề xuất của mình');
// ---------- 7) duyệt ----------
ok(D({ id: a.id, decision: 'approve' }, LAN).code === 'FORBIDDEN' && D({ id: a.id, decision: 'approve' }, NONAME).code === 'FORBIDDEN', 'người KHÔNG phải admin: không duyệt được');
ok(/approve hoặc reject/.test(D({ id: a.id, decision: 'ok' }, ADMIN).error) && /Không tìm thấy/.test(D({ id: 'vp_x', decision: 'approve' }, ADMIN).error), 'decision sai / id không có -> lỗi');
let d1 = D({ id: a.id, decision: 'approve' }, ADMIN);
const vt1 = S[ctx.SH_VIETTAT].rows[1];
ok(d1.ok && d1.status === 'approved' && d1.applied === 'vt' && JSON.parse(vt1[4]).join('|') === 'STK MỚI' && vt1[2] === 'stk' && vt1[5] === '' && vt1[7] !== '2026-11-10T00:00:00.000Z', 'DUYỆT mục chung: cập nhật nội dung cho CẢ TEAM (owner vẫn rỗng = chung), updatedAt mới');
ok(props().find(x => x[0] === a.id)[11] === 'approved' && props().find(x => x[0] === a.id)[12] === 'Duyên HT' && props().find(x => x[0] === a.id)[13], 'ghi trạng thái approved + người duyệt + thời điểm');
ok(notifs().filter(n => n[5] === a.id).every(n => n[9] !== '') && notifs().filter(n => n[5] === b.id).every(n => n[9] === ''), 'duyệt xong: thông báo của đề xuất này chuyển "đã đọc" cho MỌI admin; đề xuất khác vẫn chưa đọc');
ok(D({ id: a.id, decision: 'reject' }, ADMIN).error.indexOf('đã được xử lý') >= 0, 'duyệt/từ chối lần 2: báo đã xử lý, không đổi gì');
let d2 = D({ id: b.id, decision: 'approve' }, ADMIN), t7 = S[ctx.SH_MSG_TPL].rows[1];
ok(d2.ok && d2.applied === 'tpl' && t7[2] === 'mẫu 7 mới' && t7[15] === 'chao' && String(t7[6]).length > 0 && t7[9] === 'approved' && t7[1] === 'Chào khách', 'DUYỆT mẫu tin: cập nhật nội dung + viết tắt của mẫu tin, giữ tiêu đề + trạng thái approved');
let d3 = D({ id: c.id, decision: 'approve' }, ADMIN);
const newVt = S[ctx.SH_VIETTAT].rows.find(x => x[2] === 'moi');
ok(d3.ok && d3.applied === 'new' && newVt && JSON.parse(newVt[4])[0] === 'mục mới' && newVt[1] === 'Túi Tiền' && newVt[5] === '', 'DUYỆT mục mới: tạo MỤC CHUNG mới (nhóm Túi Tiền, owner rỗng)');
// ---------- 8) từ chối + đích đã mất ----------
reset();
const e = P({ targetId: 'vt_1', abbr: 'stk', options: ['x'] }, LAN), f = P({ targetId: 'vt_1', abbr: 'stk', options: ['y'] }, { name: 'Hoa' });
let d4 = D({ id: e.id, decision: 'reject', note: 'Sai số tài khoản' }, ADMIN);
ok(d4.ok && d4.status === 'rejected' && props().find(x => x[0] === e.id)[14] === 'Sai số tài khoản' && JSON.parse(S[ctx.SH_VIETTAT].rows[1][4])[0] === 'STK cũ 123', 'TỪ CHỐI kèm lý do: mục chung KHÔNG đổi, lý do được lưu');
ok(L(LAN).items[0].status === 'rejected' && L(LAN).items[0].note === 'Sai số tài khoản', 'Lan xem được: bị từ chối + lý do');
S[ctx.SH_VIETTAT].rows.splice(1, 1);   // admin xoá mục chung vt_1
let d5 = D({ id: f.id, decision: 'approve' }, ADMIN);
ok(!d5.ok && /không còn/.test(d5.error) && props().find(x => x[0] === f.id)[11] === 'pending', 'đích đã bị xoá: duyệt báo lỗi, đề xuất VẪN chờ (admin có thể từ chối)');
ok(D({ id: f.id, decision: 'reject', note: 'mục đã xoá' }, ADMIN).ok, 'admin vẫn từ chối được đề xuất có đích đã mất');
ok(L(ADMIN).items.find(x => x.id === f.id).targetMissing === true && L(ADMIN).items.find(x => x.id === f.id).target === null, 'danh sách: đề xuất có đích đã mất được gắn cờ targetMissing, không gây lỗi');
// ---------- 9) sau khi duyệt vẫn đề xuất tiếp được ----------
reset();
const g = P({ targetId: 'vt_1', abbr: 'stk', options: ['v1'] }, LAN); D({ id: g.id, decision: 'approve' }, ADMIN);
const h = P({ targetId: 'vt_1', abbr: 'stk', options: ['v2'] }, LAN);
ok(h.ok && h.id !== g.id && h.updatedExisting === false && props().length === 2, 'đề xuất ĐÃ duyệt không bị coi là trùng: gửi đề xuất mới được');
// ---------- 10) nối dây ----------
ok(/action === 'vietTatProposals'\) return jsonOut_\(vietTatProposalsList_\(_tplCaller_\(e\.parameter\.token, e\.parameter\.ek, e\.parameter\.by\)\)\)/.test(src), 'doGet: action vietTatProposals');
ok(/action === 'vietTatPropose'\)\s+return vietTatPropose_\(data, _tplCaller_\(data\.token, data\.ek, data\.by\)\)/.test(src) && /action === 'vietTatDecide'\)\s+return vietTatDecide_\(data, _tplCaller_\(data\.token, '', ''\)\)/.test(src), 'doPost: vietTatPropose (ai cũng gửi được) + vietTatDecide (CHỈ token admin)');
ok(/_vo\.proposals = _vs\.own; if \(_vs\.adminPending !== null\) _vo\.adminPending = _vs\.adminPending;/.test(src), 'action vietTat trả thêm proposals (của mình) + adminPending cho app/extension');
console.log(fail ? '\nFAILED ' + fail : '\nALL VIETTAT-PROPOSE TESTS PASSED'); process.exit(fail ? 1 : 0);

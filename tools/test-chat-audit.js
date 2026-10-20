#!/usr/bin/env node
// Test: Giam sat chat Pancake — phat hien tu cam, quet pk_messages, ghi log, thong bao admin (chay HAM THAT, dung gia lap Supabase/Sheet).
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const logs = [];
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log: (x) => logs.push(String(x)) }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
const WORDS = [{ tuCam: 'Tài lộc', thayThe: 'Thuận lợi' }, { tuCam: 'cam kết', thayThe: '' }, { tuCam: 'Lộc', thayThe: '' }, { tuCam: 'Lộc phúc tình', thayThe: 'lpt' }, { tuCam: 'Tiền', thayThe: '' }, { tuCam: 'Mua bán', thayThe: 'kinh doanh' }, { tuCam: 'chắc chắn', thayThe: '' }];
const C = (ign) => ctx._cvCompile_(WORDS, ign || '');
const D = (t, ign) => ctx.cvDetect_(t, C(ign)).map((h) => h.raw);

// ---- phat hien ----
ok(JSON.stringify(D('Em cam kết hàng chính hãng ạ')) === '["cam kết"]', 'bat cum co dau: "cam kết"');
ok(JSON.stringify(D('EM CAM KẾT NHÉ')) === '["cam kết"]', 'khong phan biet hoa/thuong');
ok(D('Sản phẩm này mang lại TÀI LỘC cho chị').includes('Tài lộc'), 'bat "Tài lộc" viet hoa');
ok(JSON.stringify(D('em cam ket 100%')) === '["cam kết"]', 'tin KHONG DAU van bat: "em cam ket"');
ok(JSON.stringify(D('chị lọc nước giúp em')) === '[]', 'co dau thi KHONG nham "lọc" (loc) voi tu cam "lộc"');
ok(JSON.stringify(D('em xin lộc nhé')) === '["Lộc"]', 'bat tu don "Lộc" dung dau');
ok(JSON.stringify(D('chị check block giúp em')) === '[]' && JSON.stringify(D('kê lộcxxx')) === '[]', 'khong bat chuoi con ("block", "lộcxxx")');
ok(JSON.stringify(D('Combo Lộc phúc tình đang giảm')) === '["Lộc phúc tình"]', 'cum dai nuot cum ngan (khong bao them "Lộc")');
ok(JSON.stringify(D('chị chuyển tiền cọc nhé')) === '["Tiền"]', 'bat "Tiền" (tu thuong gap) khi chua bo qua');
ok(JSON.stringify(D('chị chuyển tiền cọc nhé', 'tiền, lộc')) === '[]', 'chatAuditIgnore bo qua "tiền" (co dau/hoa thuong)');
ok(JSON.stringify(D('chi chuyen tien coc nhe', 'tiền')) === '[]', 'chatAuditIgnore cung bo qua ban KHONG DAU');
ok(D('Mua bán thuận lợi, chắc chắn nhé').sort().join('|') === 'Mua bán|chắc chắn', 'nhieu tu cam trong 1 tin, moi tu 1 lan');
ok(D('').length === 0 && D(null).length === 0 && D('   ').length === 0, 'tin rong -> khong co');
ok(ctx._cvCompile_([{ tuCam: 'a' }, { tuCam: '' }, { tuCam: 'Cam kết' }, { tuCam: 'cam kết' }]).length === 1, 'bo cum qua ngan, bo cum rong, bo trung');

// ---- nhan vien ----
const S = ctx._cvStaff_;
ok(S({ crm_user: 'Lan', staff_name: 'Mai' }) === 'Lan' && S({ staff_name: 'Mai' }) === 'Mai' && S({ fromraw: { admin_name: 'Hoa' } }) === 'Hoa' && S({}) === '', 'nhan vien: crm_user > staff_name > raw.from.admin_name > rong');

// ---- quet tin ----
const msgs = [
  { id: 'm1', text: 'Em cam kết nhé', sent_at: '2026-10-17T01:00:00Z', conversation_id: 'c1', page_id: 'P1', staff_name: 'Lan' },
  { id: 'm2', text: 'Dạ vâng ạ', sent_at: '2026-10-17T01:01:00Z', conversation_id: 'c1', page_id: 'P1', staff_name: 'Lan' },
  { id: 'm3', text: 'Mang lại tài lộc, chắc chắn luôn', sent_at: '2026-10-17T01:02:00Z', conversation_id: 'c2', page_id: 'P1', staff_name: 'Lan' },
  { id: '', text: 'cam kết', sent_at: 'x' }, null,
  { id: 'm4', text: 'em cam ket', sent_at: '2026-10-17T01:03:00Z', conversation_id: 'c3', page_id: 'P2' },
];
const v = ctx.cvScanMessages_(msgs, C('tiền'));
ok(v.length === 3 && v.map((x) => x.id).join() === 'm1,m3,m4', 'cvScanMessages_ chi tra tin vi pham (bo tin sach, tin khong id, null)');
ok(v[1].words.sort().join('|') === 'Tài lộc|chắc chắn' && v[1].suggest.join() === 'Thuận lợi', 'tin m3: 2 tu cam + goi y thay the');
ok(v[2].staff === '' && v[0].staff === 'Lan', 'nhan vien: co / chua ro');

// ---- thong bao ----
const adm = ['duyenht'];
const nt = ctx._cvNotifText_('Lan', v.slice(0, 2).map((x) => Object.assign({}, x)));
ok(/^⚠️ Lan dùng từ cấm trong 2 tin/.test(nt) && nt.length <= 160, 'cau thong bao ngan gon <=160 ky tu: ' + nt);
ok(/chưa rõ nhân viên/.test(ctx._cvNotifText_('', [v[2]])), 'thong bao khi chua ro nhan vien');

// ---- luong quet day du voi gia lap ----
const SHEETS = {}; const fakeSheet = (name, headers) => { if (!SHEETS[name]) SHEETS[name] = { rows: [headers.slice()] };
  const s = SHEETS[name]; return { getLastRow: () => s.rows.length, getRange: (r, c, n, m) => ({ setValues: (vals) => { vals.forEach((row, i) => { s.rows[r - 1 + i] = row.slice(); }); }, getValues: () => s.rows.slice(r - 1, r - 1 + n).map((x) => x.slice(0, m)) }) }; };
const PROPS = {}; const SET = { chatAuditIgnore: 'tiền', chatAuditAdmins: 'duyenht, ad2', chatAuditEmail: '' };
const calls = []; let batches = [msgs];
ctx.__fake = { fakeSheet, PROPS, SET, calls, getBatches: () => batches };
vm.runInContext(`
  getSheet_ = function(n, h) { return __fake.fakeSheet(n, h); };
  getSetting_ = function(k) { return __fake.SET[k] || null; };
  setSetting_ = function(k, v) { __fake.SET[k] = v; return {}; };
  readBannedWords_ = function() { return ${JSON.stringify(WORDS)}; };
  readPancakePageMap_ = function() { return { P1: 'Fb Phong Thủy' }; };
  normPhone_ = function(s) { return String(s).replace(/\\D/g, ''); };
  PropertiesService = { getScriptProperties: function() { return { getProperty: function(k) { return __fake.PROPS[k] === undefined ? null : __fake.PROPS[k]; }, setProperty: function(k, v) { __fake.PROPS[k] = v; } }; } };
  CacheService = { getScriptCache: function() { var m = {}; return { get: function(k) { return m[k] || null; }, put: function(k, v) { m[k] = v; }, remove: function(k) { delete m[k]; } }; } };
  LockService = { getScriptLock: function() { return { tryLock: function() { return __fake.lockOk !== false; }, releaseLock: function() {} }; } };
  sb_ = function(method, path) {
    __fake.calls.push(path);
    if (path.indexOf('pk_conversations') === 0) return { json: [ { id: 'c1', customer_name: 'Chị Hoa', customer_phone: '0901 234 567' }, { id: 'c2', customer_name: 'Anh Nam', customer_phone: '' } ] };
    var b = __fake.getBatches(); return { json: b.length ? b.shift() : [] };
  };
`, ctx);
let r = ctx.cvScanOnce_();
ok(r.scanned === 6 && r.violations === 3, 'quet: 6 tin, 3 vi pham — got ' + JSON.stringify(r));
const cvRows = SHEETS['ChatViolations'].rows;
ok(cvRows.length === 4 && cvRows[1][0] === 'm1' && cvRows[1][5] === '0901234567' && cvRows[1][6] === 'Chị Hoa' && cvRows[1][3] === 'Fb Phong Thủy', 'ghi log: SDT chuan hoa, ten khach, ten Page (kenh)');
ok(cvRows[3][7] === '(chưa rõ nhân viên)' && cvRows[3][3] === 'P2', 'tin khong co nhan vien -> "(chua ro nhan vien)", Page chua khop hien ma Page');
const nr = SHEETS['Notifications'].rows;
ok(nr.length === 1 + 4 && r.notified === 4, '2 nhan vien (Lan + chua ro) x 2 admin = 4 thong bao, GOP theo nhan vien — got ' + r.notified);
ok(nr[1][1] === 'duyenht' && nr[2][1] === 'ad2' && nr[1][3] === 'chatviolation' && nr[1][4] === 'customer' && nr[1][5] === '0901234567', 'thong bao: nguoi nhan, loai, mo thang khach (customer + SDT)');
ok(nr.slice(1).every((x) => String(x[7]).length <= 160 && x[9] === ''), 'text <=160 ky tu, chua doc');
ok(PROPS.cvCursor === '2026-10-17T01:03:00Z', 'moc quet tien den tin cuoi (khong quet lai)');
ok(calls.some((c) => /direction=eq\.out/.test(c) && /order=sent_at\.asc/.test(c)), 'chi doc tin GUI RA, theo thu tu thoi gian');
// quet lai cung tin -> khong ghi trung
batches = [msgs]; r = ctx.cvScanOnce_();
ok(r.violations === 0 && SHEETS['ChatViolations'].rows.length === 4 && r.notified === 0, 'quet lai cung tin: khong ghi trung, khong thong bao lai');
// loi / khoa
ctx.__fake.lockOk = false; ok(ctx.cvScanOnce_().note === 'dang chay luot khac', 'dang co luot quet khac -> bo qua');
ctx.__fake.lockOk = true;
vm.runInContext("sb_ = function() { throw new Error('Chua cau hinh SUPABASE_URL'); };", ctx);
r = ctx.cvScanOnce_(); ok(/loi: Chua cau hinh SUPABASE/.test(r.note) && PROPS.cvCursor === '2026-10-17T01:03:00Z', 'Supabase loi -> bao loi, KHONG tien moc (khong mat tin)');
vm.runInContext("readBannedWords_ = function() { return []; };", ctx); ctx.CacheService.getScriptCache().remove('cv_banned_v1');
r = ctx.cvScanOnce_(); ok(/chua doc duoc danh sach tu cam/.test(r.note), 'khong co danh sach tu cam -> khong quet');

// ---- chi admin xem ----
vm.runInContext("_sessUser_ = function(t) { return t === 'ta' ? { username: 'ad', role: 'admin' } : (t === 'tc' ? { username: 'cs1', role: 'cs' } : null); }; getCrmSS_ = function() { return { getSheetByName: function(n) { return n === 'ChatViolations' ? __fake.fakeSheet(n, []) : null; } }; };", ctx);
ok(ctx.cvList_({ token: 'tc' }).code === 'FORBIDDEN' && ctx.cvList_({}).code === 'FORBIDDEN' && ctx.cvList_({ token: 'sai' }).code === 'FORBIDDEN', 'CS / khong token / token sai KHONG xem duoc');
const lst = ctx.cvList_({ token: 'ta' });
ok(lst.ok && lst.items.length === 3 && lst.byStaff['Lan'] === 2 && lst.byWord['cam kết'] >= 1, 'admin xem: 3 muc, tong hop theo nhan vien / tu');
ok(/chatViolations'\) return jsonOut_\(cvList_/.test(src), 'doGet co action chatViolations');

// ---- bat / tat / cai dat ----
let created = 0, deleted = 0; let trig = [{ getHandlerFunction: () => 'chatAuditScan' }, { getHandlerFunction: () => 'khac' }];
ctx.__trig = { inc: () => { created++; }, trig, del: () => { deleted++; } };
vm.runInContext(`ScriptApp = { getProjectTriggers: function() { return __trig.trig; }, deleteTrigger: function() { __trig.del(); }, newTrigger: function(fn) { return { timeBased: function() { return { everyMinutes: function(n) { return { create: function() { __trig.inc(); __trig.fn = fn; __trig.min = n; } }; } }; } }; } };`, ctx);
ctx.batGiamSatChat(2);
ok(created === 1 && deleted === 1 && ctx.__trig.fn === 'chatAuditScan' && ctx.__trig.min === 5, 'batGiamSatChat: xoa trigger cu, tao trigger 5 phut/lan');
ok(Math.abs(Date.now() - 2 * 3600 * 1000 - Date.parse(PROPS.cvCursor)) < 5000, 'batGiamSatChat(2): moc quet = 2 gio truoc');
ctx.batGiamSatChat(9999); ok(Date.now() - Date.parse(PROPS.cvCursor) <= 72 * 3600 * 1000 + 5000, 'gioi han quay lai toi da 72 gio');
ctx.datChatAuditBoQua('a, b'); ok(SET.chatAuditIgnore === 'a, b', 'datChatAuditBoQua luu Settings');
let threw = false; try { ctx.datChatAuditAdmin(''); } catch (e) { threw = true; } ok(threw, 'datChatAuditAdmin("") bao loi');
ok(JSON.stringify(ctx._cvAdmins_()) === JSON.stringify(['duyenht', 'ad2']), 'danh sach admin nhan canh bao doc tu Settings');
SET.chatAuditAdmins = ''; ok(JSON.stringify(ctx._cvAdmins_()) === '["duyenht"]', 'mac dinh admin = duyenht');
// ---- chuong thong bao tren web (js/39) ----
const nj = fs.readFileSync(path.join(__dirname, '..', 'js', '39-fn-notify.js'), 'utf8');
ok(/k === 'chatviolation'/.test(nj) && /chatviolation:'⚠️'/.test(nj), 'web: thong bao chatviolation hien nhu su kien he thong, icon ⚠️');
ok(/refType === 'chatviolation'/.test(nj), 'web: thong bao chua gan duoc SDT bao xem sheet ChatViolations');
console.log(fail ? '\nFAILED ' + fail : '\nALL CHAT AUDIT TESTS PASSED'); process.exit(fail ? 1 : 0);

// Duyen 2026-11-13: "khong thay ai quet bat tu cam va gui thong bao nua" -> them chanDoanGiamSatChat() (chi doc) + dau da chay trong chatAuditScan().
// Chay ham THAT trich tu gas_v13.js voi may GAS/Supabase gia lap: moi nguyen nhan hong phai duoc KET LUAN dung. node tools/test-chat-audit-diag.js
const fs = require('fs'), vm = require('vm');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(name) {
  const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name);
  let d = 0; const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } }
}
const CODE = grab('chatAuditScan') + '\n' + grab('chanDoanGiamSatChat');
const NOW = Date.parse('2026-11-13T10:00:00Z'), iso = (minAgo) => new Date(NOW - minAgo * 60000).toISOString();

function run(o) {
  o = Object.assign({ triggers: ['chatAuditScan', 'sbOrdersTick_'], lastRun: iso(2), lastOk: iso(2), lastRes: '{"scanned":3,"violations":0,"notified":0,"cursor":"x","note":""}',
    cursor: iso(10), lastOut: iso(3), pending: 0, banned: 5, cfg: { useSheet: true, items: [] }, admins: ['duyenht'], users: [{ username: 'duyenht', active: true }], sbThrow: null, cvRows: 2, ntRows: true }, o || {});
  const logs = [], store = {};
  if (o.lastRun) store.cvLastRun = o.lastRun; if (o.lastOk) store.cvLastOkAt = o.lastOk; if (o.lastRes) store.cvLastRes = o.lastRes; if (o.cursor) store.cvCursor = o.cursor;
  const sheet = (rows) => ({ getLastRow: () => rows.length, getRange: (r, c, nr, nc) => ({ getValues: () => { const out = []; for (let i = 0; i < (nr || 1); i++) { const row = rows[r - 1 + i] || []; out.push(Array.from({ length: nc || 1 }, (_, k) => row[c - 1 + k])); } return out; }, getValue: () => (rows[r - 1] || [])[c - 1] }) });
  const cvRows = [['id', 'detectedAt']]; for (let i = 0; i < o.cvRows; i++) cvRows.push(['m' + i, iso(30 + i)]);
  const ntRows = [['h']]; if (o.ntRows) ntRows.push(['n1', 'duyenht', 'Giám sát chat', 'chatviolation', 'chatviolation', 'c', 'i', 't', iso(45), '']);
  const ctx = {
    Logger: { log: (s) => logs.push(String(s)) },
    ScriptApp: { getProjectTriggers: () => o.triggers.map(h => ({ getHandlerFunction: () => h })) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => store[k] || null, setProperty: (k, v) => { store[k] = v; } }) },
    Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } },
    sb_: (m, p) => {
      if (o.sbThrow) throw new Error(o.sbThrow);
      if (/limit=1$/.test(p) && /order=sent_at.desc/.test(p)) return { json: o.lastOut ? [{ sent_at: o.lastOut }] : [] };
      if (/sent_at=gt\./.test(p)) return { json: Array.from({ length: o.pending }, (_, i) => ({ id: 'x' + i })) };
      return { json: [] };
    },
    _pkEnc_: (s) => encodeURIComponent(s),
    _bannedCfg_: () => o.cfg, _cvBannedCompiled_: () => Array.from({ length: o.banned }, (_, i) => ({ raw: 'w' + i })),
    getSetting_: () => '', _cvAdmins_: () => o.admins, readUsers_: () => o.users, getCrmSS_: () => ({ getSheetByName: () => ({}) }), SH_USER: 'Users',
    CV_SHEET: 'ChatViolations', CV_HEADERS: ['id', 'detectedAt'], SH_NOTIF: 'Notifications', NOTIF_HEADERS: ['id', 'toUser', 'fromUser', 'kind', 'refType', 'refId', 'refId2', 'text', 'createdAt', 'readAt'],
    getSheet_: (n) => sheet(n === 'ChatViolations' ? cvRows : ntRows),
    cvScanOnce_: () => o.scanRes || { scanned: 1, violations: 0, notified: 0, cursor: 'c', note: '' }
  };
  vm.createContext(ctx); vm.runInContext(CODE, ctx);
  const res = o.heartbeatOnly ? ctx.chatAuditScan() : ctx.chanDoanGiamSatChat();
  return { logs, res, store, text: logs.join('\n') };
}
const has = (r, re) => re.test(r.text);

// A) khoe manh
let r = run();
ok(r.res.problems.length === 0 && has(r, /✅ Không thấy lỗi hệ thống/), 'A: moi thu binh thuong -> khong bao loi, ket luan "khong thay loi he thong"');
ok(has(r, /ChatViolations: 2 dòng/) && has(r, /Thông báo "chatviolation" gần nhất: 45 phút/), 'A: in so dong ChatViolations va thoi diem thong bao gan nhat');
// B) mat trigger
r = run({ triggers: ['sbOrdersTick_'] });
ok(r.res.problems.length >= 1 && has(r, /KHÔNG có trigger "chatAuditScan"/) && has(r, /batGiamSatChat\(24\)/), 'B: mat trigger -> ket luan dung + huong dan batGiamSatChat(24)');
// C) trigger co nhung khong chay (Google chan / het han muc)
r = run({ lastRun: iso(95), lastOk: iso(95) });
ok(has(r, /trigger KHÔNG chạy trong 95 phút/) && has(r, /HẾT HẠN MỨC Apps Script/), 'C: trigger 95 phut khong chay -> nghi het han muc, chi cho xem Executions');
// D) Supabase / UrlFetch het han muc
r = run({ sbThrow: 'Service invoked too many times for one day: urlfetch.' });
ok(has(r, /KHÔNG đọc được Supabase/) && has(r, /HẾT HẠN MỨC Apps Script/), 'D: UrlFetch het han muc -> ket luan het han muc');
r = run({ sbThrow: 'Request failed for https://x.supabase.co returned code 401' });
ok(has(r, /KHÔNG đọc được Supabase/) && !has(r, /HẾT HẠN MỨC/) && has(r, /khóa\/URL Supabase/), 'D2: loi 401 khong phai quota -> goi y kiem tra khoa/URL Supabase');
// E) moc quet o tuong lai
r = run({ cursor: iso(-120) });
ok(has(r, /mốc quét nằm ở TƯƠNG LAI/), 'E: cvCursor o tuong lai -> bi bo qua toan bo tin moi');
// F) webhook ngung ghi
r = run({ lastOut: iso(3 * 1440) });
ok(has(r, /webhook Pancake đã ngừng ghi/), 'F: tin gui ra moi nhat 3 ngay truoc -> webhook ngung');
r = run({ lastOut: null });
ok(has(r, /webhook Pancake đã ngừng ghi/), 'F2: Supabase khong co tin out nao');
// G) danh sach tu cam rong
r = run({ banned: 0, cfg: { useSheet: false, items: [] } });
ok(has(r, /danh sách từ cấm đang RỖNG/) && has(r, /dùng thêm sheet = TẮT/), 'G: tu cam rong (tat sheet, khong co tu) -> ket luan, in cau hinh');
// H) nguoi nhan thong bao
r = run({ admins: ['duyenh'] });
ok(has(r, /"duyenh" KHÔNG có trong sheet tài khoản/), 'H: admin nhan sai ten dang nhap -> bao');
r = run({ users: [{ username: 'duyenht', active: false }] });
ok(has(r, /"duyenht" đang bị KHÓA/), 'H2: tai khoan admin bi khoa -> bao');
// I) quet ket: trigger on, moc dung yen, co tin chua quet
r = run({ cursor: iso(180), pending: 7 });
ok(has(r, /mốc quét không nhúc nhích \(lần cuối: 3 giờ trước\) dù có 7 tin chưa quét/), 'I: moc dung yen 3 gio, 7 tin chua quet, trigger on -> quet bi ket');
r = run({ cursor: iso(180), pending: 0 });
ok(r.res.problems.length === 0, 'I2: moc cu nhung khong co tin moi -> BINH THUONG (khong bao nham)');
// J) lan chay gan nhat bao loi
r = run({ lastRes: '{"scanned":0,"violations":0,"notified":0,"cursor":"","note":"loi: Service invoked too many times for one day: urlfetch"}' });
ok(has(r, /lần chạy gần nhất BÁO LỖI/) && has(r, /HẾT HẠN MỨC/), 'J: lan chay gan nhat note=loi (quota) -> bao loi + goi y han muc');
// K) trigger trung / gan het 20
r = run({ triggers: ['chatAuditScan', 'chatAuditScan'] });
ok(has(r, /2 trigger chatAuditScan trùng nhau/), 'K: 2 trigger chatAuditScan -> bao trung');
r = run({ triggers: Array.from({ length: 19 }, (_, i) => i === 0 ? 'chatAuditScan' : 't' + i) });
ok(has(r, /19\/20 trigger/), 'K2: 19/20 trigger -> canh bao gioi han');
// L) chua co dau chay (ban moi deploy) khong bi coi la loi
r = run({ lastRun: null, lastOk: null, lastRes: null });
ok(r.res.problems.length === 0 && has(r, /chưa có dấu chạy/), 'L: chua co dau chay (moi deploy) -> chi nhac doi, KHONG bao loi nham');
// M) chi doc: khong ghi gi vao Script Properties
r = run(); ok(r.store.cvLastRun === iso(2) && r.store.cvCursor === iso(10), 'M: chanDoan KHONG ghi/doi Script Properties (chi doc)');

// N) dau da chay trong chatAuditScan
r = run({ heartbeatOnly: true, lastRun: null, lastOk: null, lastRes: null, scanRes: { scanned: 4, violations: 1, notified: 2, cursor: 'c', note: '' } });
ok(r.store.cvLastRun && r.store.cvLastOkAt && /"scanned":4/.test(r.store.cvLastRes), 'N: lan chay ok -> ghi cvLastRun + cvLastOkAt + cvLastRes');
r = run({ heartbeatOnly: true, lastRun: null, lastOk: iso(500), lastRes: null, scanRes: { scanned: 0, violations: 0, notified: 0, cursor: '', note: 'loi: boom' } });
ok(r.store.cvLastRun && r.store.cvLastOkAt === iso(500) && /loi: boom/.test(r.store.cvLastRes), 'N2: lan chay loi -> ghi cvLastRun + cvLastRes nhung KHONG cap nhat cvLastOkAt');
r = run({ heartbeatOnly: true, lastRun: null, lastOk: null, lastRes: null, scanRes: { scanned: 0, violations: 0, notified: 0, cursor: '', note: 'dang chay luot khac' } });
ok(!!r.store.cvLastOkAt, 'N3: "dang chay luot khac" khong phai loi -> van tinh la chay ok');
ok(r.res && typeof r.res === 'object', 'N4: chatAuditScan van tra ve ket qua nhu cu (chayGiamSatChat dung duoc)');
process.exit(bad ? 1 : 0);

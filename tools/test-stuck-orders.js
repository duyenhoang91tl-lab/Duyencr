#!/usr/bin/env node
// Test DON KET (man "Cham soc & tai mua" + khung nhac viec + chip Tong quan): bam don -> thay KHACH + DON; CS PHU TRACH tich Da xem / Dang xu ly / Da xu ly xong.
// PHAN 1 (GAS, vm nap NGUYEN gas_v13.js): readDTTong_ co phone, ttTodayTasks_ lam giau (SDT/san pham/gia tri/nguoi xu ly/follow), ttFollowSet_ (quyen, lich su, giai doan, loi), route doPost.
// PHAN 2 (WEB, jsdom, cat NGUYEN VAN js/34 + js/36 + js/40): stuckRow_, _c2Rows, _c2OrderRow, hop chi tiet stuckOpen, luu stuckSave. CAN jsdom (thieu -> bo qua PHAN 2).
// Chay: node tools/test-stuck-orders.js -> "ALL STUCK-ORDER TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const root = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ───────────────── PHAN 1: GAS ─────────────────
class FakeSheet {
  constructor(rows) { this.data = rows; }
  getLastRow() { return this.data.length; }
  getRange(r, c, n, w) { n = n || 1; w = w || 1; const self = this; return {
    getValues: () => { const o = []; for (let i = 0; i < n; i++) { const row = self.data[r - 1 + i] || []; const x = []; for (let j = 0; j < w; j++) x.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); o.push(x); } return o; },
    getValue: () => { const row = self.data[r - 1] || []; return row[c - 1] === undefined ? '' : row[c - 1]; },
    setValues: vals => { for (let i = 0; i < vals.length; i++) { while (self.data.length < r + i) self.data.push([]); for (let j = 0; j < vals[i].length; j++) self.data[r - 1 + i][c - 1 + j] = vals[i][j]; } } }; }
}
function makeGas() {
  const env = { now: Date.now(), settings: {}, lockOk: true, orders: [], ordersThrow: false, users: {}, sheets: {} };
  const out = o => ({ _s: JSON.stringify(o), setMimeType() { return this; }, getContent() { return this._s; } });
  const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, parseFloat, isNaN, encodeURIComponent,
    Logger: { log() {} }, LockService: { getScriptLock: () => ({ tryLock: () => env.lockOk, waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, deleteProperty() {}, getProperties: () => ({}) }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {}, removeAll() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => out(JSON.parse(s)) } };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(root, 'gas_v13.js'), 'utf8'), ctx, { filename: 'gas_v13.js' });
  ctx.getSheet_ = (name, headers) => env.sheets[name] || (env.sheets[name] = new FakeSheet([headers.slice()]));
  ctx.getSetting_ = k => env.settings[k] == null ? null : env.settings[k];
  ctx.ttTrackStages_ = () => {};
  env.realReadDT = ctx.readDTTong_;
  ctx.readDTTong_ = () => { if (env.ordersThrow) throw new Error('DT TONG hong'); return env.orders; };
  ctx._sessUser_ = t => env.users[t] || null;
  env.run = c => vm.runInContext(c, ctx); env.ctx = ctx; env.out = o => JSON.parse(o.getContent());
  return env;
}
const H = 3600000;
function setup() {
  const e = makeGas(); e.settings = { ttLastTrackedMs: String(e.now), ttStageHours: '24' };
  const track = e.run("getSheet_(TT_TRACK_SHEET_, TT_TRACK_HEADERS_)");
  track.data.push(['3418875', 'Done', new Date(e.now - 284 * H), '', 'Hoa, Lan', '01/10/2026'], ['3418895', 'Done', new Date(e.now - 30 * H), '', 'Bình', '02/10/2026'], ['3419000', 'Done', new Date(e.now - 2 * H), '', 'Hoa', '14/10/2026']);
  e.orders = [{ id: '3418875', soDienThoai: '0912000001', sanPham: 'Vòng Phong Thủy', giaTriDon: 1250000, giaoCho: 'Nam', maBoDem: 'BD-77', kenhBan: 'Zalo', trangThai: 'Done' }, { id: '3418895', soDienThoai: '', sanPham: 'Nhẫn', giaTriDon: 0, giaoCho: '', maBoDem: '', kenhBan: '', trangThai: 'Done' }, { id: '999', soDienThoai: '0900000000', sanPham: 'khac', giaTriDon: 5 }];
  e.users = { T_HOA: { name: 'Hoa', username: 'hoa', role: 'cs', names: ['Hoa'] }, T_LAN: { name: 'Lan Anh', username: 'lan', role: 'cs', names: ['Lan'] }, T_BINH: { name: 'Binh', username: 'binh', role: 'cs', names: ['BÌNH'] }, T_NAM: { name: 'Nam', username: 'nam', role: 'cs', names: ['Nam'] }, T_ADMIN: { name: 'Admin', username: 'ad', role: 'admin', names: [] } };
  return e;
}
const items = e => e.run("ttTodayTasks_('')").tasks[0].items;
(async () => {
  // 1. readDTTong_ co phone
  { const e = makeGas(); const row = new Array(20).fill(''); row[0] = new Date(Date.UTC(2026, 9, 1, 3, 0)); row[3] = 912345678; row[6] = 'Done'; row[7] = 'x'; row[12] = 'Zalo'; row[13] = 'Hoa'; row[14] = 'Vòng'; row[17] = 100; row[19] = 'ID1';
    e.ctx.readDTTong_ = e.realReadDT; e.ctx.sbReadDTTongVals_ = () => ({ vals: [row], rowNums: [2] }); e.ctx._hiddenPageSaleSets_ = () => ({}); e.ctx._isDTRowHidden_ = () => false; e.ctx._dtBoDemCol_ = () => null;
    const o = e.run('readDTTong_(true)'); ok(o.length === 1 && o[0].soDienThoai === undefined && o[0].id === 'ID1' && o[0].saleBan === 'Hoa', 'readDTTong_ mac dinh KHONG tra SDT (rieng tu) va giu nguyen truong cu'); const o2 = e.run('readDTTong_(true, true)'); ok(/^0?912345678$/.test(String(o2[0].soDienThoai)) && o2[0].id === 'ID1', 'readDTTong_(true,true): co soDienThoai: ' + JSON.stringify(o2[0].soDienThoai)); }
  // 2. todayTasks lam giau
  let e = setup(); let it = items(e);
  ok(it.length === 2 && it[0].id === '3418875' && it[0].hours === 284 && it[0].sale === 'Hoa, Lan', '2 don ket sap xep theo gio, bo don moi (2h)');
  ok(it[0].phone === '0912000001' && it[0].sanPham === 'Vòng Phong Thủy' && it[0].value === 1250000 && it[0].giaoCho === 'Nam' && it[0].maBoDem === 'BD-77' && it[0].kenhBan === 'Zalo' && it[0].trangThai === 'Done' && it[0].follow === null, 'don 1 duoc lam giau day du, chua ai theo doi');
  ok(it[1].phone === '' && it[1].follow === null, 'don 2 khong co SDT -> phone rong, van tra ve');
  ok(e.run("ttTodayTasks_('Hoa')").tasks[0].items.length === 1 && e.run("ttTodayTasks_('bình')").tasks[0].items[0].id === '3418895', 'loc theo ten CS nhu cu (khong phan biet hoa/thuong; khong bo dau)');
  e.ordersThrow = true; it = items(e); ok(it.length === 2 && it[0].hours === 284 && it[0].sanPham === undefined && it[0].follow === null, 'loi doc DT TONG KHONG lam hong danh sach don ket (van tra truong goc)'); e.ordersThrow = false;
  // 3. theo doi: quyen
  const set = (tok, id, st, extra) => e.run('ttFollowSet_(' + JSON.stringify(Object.assign({ id, status: st, token: tok }, extra || {})) + ')');
  let r = set('T_BINH', '3418875', 'xem'); ok(!r.ok && r.code === 'FORBIDDEN' && e.run("getSheet_(TT_FOLLOW_SHEET_, TT_FOLLOW_HEADERS_)").data.length === 1, 'CS KHONG phu trach (Binh, don cua Hoa/Lan) bi tu choi, khong ghi gi: ' + JSON.stringify(r));
  r = set('T_NAM', '3418875', 'xem'); ok(!r.ok && r.code === 'FORBIDDEN', 'nguoi dang xu ly (giaoCho=Nam) nhung khong phai sale cung KHONG duoc tich — chi CS phu trach (Sale ban) hoac admin');
  r = set('T_HOA', '3418875', 'xem'); ok(r.ok && r.follow.status === 'xem' && r.follow.by === 'Hoa' && r.follow.at > 0 && r.follow.history.length === 1, 'CS phu trach (Hoa) tich Da xem: ' + JSON.stringify(r));
  r = set('T_LAN', '3418875', 'xuly', { note: '  da   goi\nkhach  ' }); ok(r.ok && r.follow.by === 'Lan Anh' && r.follow.note === 'da goi khach' && r.follow.history.length === 2, 'ten thu 2 trong cot Sale (Lan) cung duoc; ghi chu gon khoang trang; lich su 2 muc: ' + JSON.stringify(r));
  const fs_ = e.run("getSheet_(TT_FOLLOW_SHEET_, TT_FOLLOW_HEADERS_)"); ok(fs_.data.length === 2 && fs_.data[1][2] === 'xuly' && fs_.data[1][1] === 'Done', '1 dong/don (cap nhat, khong nhan doi), luu giai doan luc danh dau');
  it = items(e); ok(it[0].follow && it[0].follow.status === 'xuly' && it[0].follow.by === 'Lan Anh' && it[0].follow.history.length === 2 && it[1].follow === null, 'todayTasks tra follow cho dung don');
  r = set('T_BINH', '3418895', 'xong'); ok(r.ok && r.follow.status === 'xong', 'Binh (ten gan "BÌNH" hoa, sale ghi "Bình") tich don CUA MINH 3418895');
  r = set('T_ADMIN', '3418875', 'xong', { note: 'admin xu ly' }); ok(r.ok && r.follow.by === 'Admin', 'admin tich ho bat ky don nao');
  // fallback khong token (extension cu)
  r = e.run("ttFollowSet_({id:'3418875', status:'xem', by:'Hoa'})"); ok(r.ok && r.follow.by === 'Hoa', 'khong co token + by la sale cua don -> chap nhan (tuong thich ban cu)');
  r = e.run("ttFollowSet_({id:'3418875', status:'xem', by:'Binh'})"); ok(!r.ok && r.code === 'FORBIDDEN', 'khong co token + by khong phai sale -> tu choi');
  // loi dau vao
  ok(!e.run("ttFollowSet_({status:'xem', token:'T_HOA'})").ok && !e.run("ttFollowSet_({id:'3418875', status:'huy', token:'T_HOA'})").ok && /Khong thay don 777/.test(e.run("ttFollowSet_({id:'777', status:'xem', token:'T_HOA'})").error) && /Khong xac dinh duoc nguoi/.test(e.run("ttFollowSet_({id:'3418875', status:'xem'})").error), 'thieu id / trang thai la / don khong ton tai / khong biet nguoi thao tac');
  // lich su toi da 30, ghi chu 300
  for (let i = 0; i < 35; i++) set('T_HOA', '3418875', i % 2 ? 'xem' : 'xuly', { note: 'n' + i }); r = set('T_HOA', '3418875', 'xem', { note: 'x'.repeat(500) });
  ok(r.follow.note.length === 300 && e.run("getSheet_(TT_FOLLOW_SHEET_, TT_FOLLOW_HEADERS_)").data[1][6] && JSON.parse(e.run("getSheet_(TT_FOLLOW_SHEET_, TT_FOLLOW_HEADERS_)").data[1][6]).length === 30, 'ghi chu cat 300 ky tu, lich su giu 30 muc');
  // bo theo doi
  r = set('T_HOA', '3418875', 'bo'); ok(r.ok && r.follow === null && items(e)[0].follow === null && e.run("getSheet_(TT_FOLLOW_SHEET_, TT_FOLLOW_HEADERS_)").data[1][2] === '' && JSON.parse(e.run("getSheet_(TT_FOLLOW_SHEET_, TT_FOLLOW_HEADERS_)").data[1][6]).slice(-1)[0].s === 'bo', 'bo theo doi: follow=null, van giu lich su');
  // giai doan doi -> theo doi cu het hieu luc
  set('T_HOA', '3418875', 'xong', { note: 'xong giai doan Done' }); ok(items(e)[0].follow.status === 'xong', 'dang co theo doi');
  e.run("getSheet_(TT_TRACK_SHEET_, TT_TRACK_HEADERS_)").data[1][1] = 'Hoàn hàng'; ok(items(e)[0].stage === 'Hoàn hàng' && items(e)[0].follow === null, 'don sang GIAI DOAN KHAC roi lai ket -> theo doi cu khong con hieu luc (bat dau lai)');
  e.run("getSheet_(TT_TRACK_SHEET_, TT_TRACK_HEADERS_)").data[1][1] = 'Done';
  // khoa
  e.lockOk = false; const before = JSON.stringify(e.run("getSheet_(TT_FOLLOW_SHEET_, TT_FOLLOW_HEADERS_)").data); r = set('T_HOA', '3418875', 'xem'); ok(!r.ok && /dang ban/.test(r.error) && JSON.stringify(e.run("getSheet_(TT_FOLLOW_SHEET_, TT_FOLLOW_HEADERS_)").data) === before, 'khong lay duoc khoa -> bao ban, khong ghi'); e.lockOk = true;
  // 4. route doPost
  try { const po = e.out(e.run("doPost({postData:{contents: JSON.stringify({action:'stuckFollowSet', id:'3418895', status:'xuly', token:'T_BINH'})}})")); ok(po.ok === true && po.follow.status === 'xuly', 'doPost action=stuckFollowSet: ' + JSON.stringify(po).slice(0, 160)); }
  catch (er) { ok(false, 'doPost stuckFollowSet khong chay: ' + er.message); }
  console.log('PHAN 1 (GAS): dat');

  // ───────────────── PHAN 2: WEB ─────────────────
  let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (er) { console.log('SKIP PHAN 2: chua cai jsdom'); console.log('ALL STUCK-ORDER TESTS PASSED'); return; }
  const src34 = fs.readFileSync(path.join(root, 'js/34-fn-todaytasks.js'), 'utf8'), src36 = fs.readFileSync(path.join(root, 'js/36-fn-homechips.js'), 'utf8'), src40 = fs.readFileSync(path.join(root, 'js/40-fn-carepage.js'), 'utf8');
  function fnSpan(src, name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name); let d = 0, k = src.indexOf('{', i); for (let m = k; m < src.length; m++) { if (src[m] === '{') d++; else if (src[m] === '}') { d--; if (d === 0) return src.slice(i, m + 1); } } }
  const stuckBlock = src40.slice(src40.indexOf('var _stuck = {'));
  const c2label = src40.slice(src40.indexOf('var _C2_LABEL'), src40.indexOf('\n', src40.indexOf('var _C2_LABEL')) + 1);
  const pieces = [c2label, fnSpan(src36, '_hmCfg'), fnSpan(src36, 'hmCompute'), fnSpan(src34, '_ttCards'), fnSpan(src40, '_c2Rows'), stuckBlock].join('\n');
  function web(user, tasks) {
    const dom = new JSDOM('<!doctype html><body><div id="toast"></div></body>', { runScripts: 'outside-only' }), w = dom.window, env = { toasts: [], posts: [], reply: null, delay: 0, opened: [], dp: [], clip: [] };
    w.navigator.clipboard = { writeText: async t => { env.clip.push(t); } };
    const fetchFn = async (url, o) => { env.posts.push(JSON.parse(o.body)); if (env.delay) await sleep(env.delay); if (env.reply instanceof Error) throw env.reply; return { json: async () => env.reply }; };
    const f = new w.Function('currentUser', 'customerMap', 'careData', '_ttState', 'gsUrl', 'fetch', 'toast', 'esc', 'fmt', 'openDp', 'ttOpenCustomer_', 'document', 'navigator', pieces + '\nreturn { stuckRow_, hmCompute, _c2Rows, _c2OrderRow, stuckOpen, stuckSave, stuckClose, stuckFollowBadge_, stuckCopy, state: _stuck, find: _stuckFind, canAct: _stuckCanAct };');
    const esc = s => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'), fmt = n => (n || 0).toLocaleString('vi-VN');
    const api = f(user, { '0912000001': { name: 'Chị Lan <Hà>', cs: 'Hoa', orders: [] } }, { '0912000001': { cs: 'Hoa', status: 's1', updated: '' } }, { tasks: tasks, open: {}, hours: 24, at: 0 }, 'https://gas.test/exec', fetchFn, t => env.toasts.push(t), esc, fmt, p => env.dp.push(p), (ph, id) => env.opened.push([ph, id]), w.document, w.navigator);
    return Object.assign(api, { env, w, doc: w.document, ov: () => w.document.getElementById('stuck-ov') });
  }
  const T = () => [{ key: 'stuckStage', title: 'Đơn kẹt', count: 2, items: [
    { id: '3418875', stage: 'Done', hours: 284, sale: 'Hoa, Lan', ngayTao: '01/10/2026', phone: '0912000001', sanPham: 'Vòng <i>x</i> Phong Thủy', value: 1250000, giaoCho: 'Nam', maBoDem: 'BD-77', kenhBan: 'Zalo', trangThai: 'Done', follow: null },
    { id: '3418895', stage: 'Done', hours: 30, sale: 'Bình', ngayTao: '02/10/2026', phone: '', sanPham: '', value: 0, giaoCho: '', maBoDem: '', kenhBan: '', trangThai: '', follow: { status: 'xuly', by: 'Bình', at: Date.now(), note: 'dang goi', history: [] } }] }];
  const HOA = { name: 'Hoa', role: 'cs', names: ['Hoa'] }, BINH = { name: 'Binh', role: 'cs', names: ['Bình'] }, ADMIN = { name: 'Admin', role: 'admin', names: [] }, KHAC = { name: 'Khac', role: 'cs', names: ['Khac'] };
  // a. dong du lieu
  let W = web(HOA, T()); let row = W.stuckRow_(W.find('3418875'));
  ok(row.order === true && row.kind === 'order' && row.orderId === '3418875' && row.oid === '3418875' && row.phone === '0912000001' && row.name === 'Đơn BD-77' && row.cs === 'Hoa, Lan' && /Chị Lan <Hà> · Done · kẹt 284 giờ · Vòng <i>x<\/i> Phong Thủy · 1\.250\.000đ/.test(row.sub), 'stuckRow_: co SDT, ma don, CS phu trach, ten khach + sp + gia tri: ' + JSON.stringify(row));
  ok(W.stuckRow_(W.find('3418895')).name === 'Đơn 3418895' && W.stuckRow_(W.find('3418895')).sub === 'Done · kẹt 30 giờ', 'don khong co ma bo dem/SDT/khach: lui ve id Base');
  const hm = W.hmCompute(); ok(hm.today.length === 2 && hm.today.every(x => x.order && x.oid) && hm.today[0].phone === '0912000001', 'hmCompute: don ket di kem order/oid/phone');
  const rows = W._c2Rows().filter(x => x.type === 'order'); ok(rows.length === 2 && rows[0].oid === '3418875' && rows[0].cs === 'Hoa, Lan' && rows[1].follow.status === 'xuly', '_c2Rows: dong "Don ket" co oid, CS phu trach, follow: ' + JSON.stringify(rows.map(r => [r.oid, r.cs])));
  // b. hang bang
  let tr = new W.w.DOMParser().parseFromString('<table><tbody>' + W._c2OrderRow(rows[0]) + W._c2OrderRow(rows[1]) + '</tbody></table>', 'text/html').querySelectorAll('tr');
  ok(tr[0].getAttribute('data-oid') === '3418875' && /stuckOpen\(this\.dataset\.oid\)/.test(tr[0].getAttribute('onclick')) && /Chị Lan <Hà>/.test(tr[0].textContent) && /0912000001/.test(tr[0].textContent) && /Đơn BD-77/.test(tr[0].textContent) && !tr[0].querySelector('i, Hà'), 'hang don ket: ten khach + SDT + ma don, bam mo hop, escape HTML');
  ok(/Hoa, Lan/.test(tr[0].children[3].textContent) && /Chưa ai tích theo dõi/.test(tr[0].children[3].textContent) && /Bình/.test(tr[1].children[3].textContent) && /Đang xử lý · Bình/.test(tr[1].children[3].textContent) && /Chưa có SĐT khách/.test(tr[1].children[1].textContent), 'cot Phu trach: CS + trang thai theo doi; don khong SDT bao ro');
  ok(/chưa theo dõi/.test(W.stuckFollowBadge_(null, false)) && /Đã xem · A &lt;b&gt;/.test(W.stuckFollowBadge_({ status: 'xem', by: 'A <b>' }, false)) && /Đã xử lý xong/.test(W.stuckFollowBadge_({ status: 'xong', by: 'x' }, true)), 'nhan trang thai (escape ten nguoi)');
  // c. hop chi tiet
  W.stuckOpen('3418875'); ok(W.ov() && W.ov().style.display === 'flex', 'mo hop chi tiet'); let txt = W.ov().textContent;
  ok(/Chị Lan <Hà>/.test(txt) && /0912000001/.test(txt) && /Mã đơn Base3418875/.test(txt.replace(/\s+/g, '')) || /3418875/.test(txt), 'co khach + ma don');
  for (const s of ['Chị Lan <Hà>', '0912000001', '3418875', 'BD-77', 'Done', '284 giờ', 'Vòng <i>x</i> Phong Thủy', '1.250.000đ', 'Zalo', '01/10/2026', 'Nam', 'Hoa, Lan']) ok(txt.includes(s), 'hop chi tiet co: ' + s);
  ok(!W.ov().querySelector('i') && W.ov().querySelector('button[onclick*="ttOpenCustomer_(\'0912000001\',\'3418875\')"]') && /Chưa ai tích theo dõi/.test(txt), 'escape HTML trong du lieu; co nut Mo ho so khach (ttOpenCustomer_ phone+ma don); chua ai theo doi');
  ok(W.ov().querySelectorAll('button[onclick^="stuckSave"]').length === 3 && W.ov().querySelector('#stuck-note'), 'CS PHU TRACH (Hoa) thay 3 nut tich + o ghi chu');
  W.stuckClose(); ok(W.ov().style.display === 'none', 'dong hop');
  W = web(BINH, T()); W.stuckOpen('3418875'); ok(W.ov().querySelectorAll('button[onclick^="stuckSave"]').length === 0 && /Chỉ CS phụ trách đơn này \(Hoa, Lan\) hoặc quản trị mới tích được/.test(W.ov().textContent), 'CS KHAC (khong phai Hoa/Lan): khong co nut tich, co thong bao ro');
  W.stuckOpen('3418895'); ok(W.ov().querySelectorAll('button[onclick^="stuckSave"]').length >= 3 && /Đang xử lý · Bình/.test(W.ov().textContent) && /↩ Bỏ theo dõi/.test(W.ov().textContent) && /Đơn chưa có SĐT khách/.test(W.ov().textContent) && W.ov().querySelector('button[onclick*="ttOpenCustomer_(\'\',\'3418895\')"]'), 'Binh tich don CUA MINH: co nut + Bo theo doi; don khong SDT: canh bao, nut Mo ho so van co (tra theo ma don)');
  W = web(ADMIN, T()); W.stuckOpen('3418875'); ok(W.ov().querySelectorAll('button[onclick^="stuckSave"]').length === 3, 'admin thay nut o moi don');
  W = web(KHAC, T()); ok(!W.canAct(W.find('3418875')) && !W.canAct(W.find('3418895')), 'canAct: nguoi la khong co quyen'); W = web({ name: 'x', role: 'cs', names: ['binh'] }, T()); ok(!W.canAct(W.find('3418895')), 'ten khac dau (binh vs Bình): web CUNG khong cho, giong server (khong bo dau)'); W = web({ name: 'x', role: 'cs', names: ['  BÌNH '] }, T()); ok(W.canAct(W.find('3418895')), 'khac hoa/thuong + khoang trang: cho');
  W = web(HOA, T()); W.stuckOpen('777'); ok(!W.ov() && /không còn trong danh sách kẹt/.test(W.env.toasts[0]), 'don khong con ket: bao, khong mo hop');
  // d. luu theo doi
  W.stuckOpen('3418875'); W.doc.getElementById('stuck-note').value = 'da goi khach'; W.env.reply = { ok: true, follow: { status: 'xuly', by: 'Hoa', at: Date.now(), note: 'da goi khach', history: [{ s: 'xuly', by: 'Hoa', at: Date.now(), note: 'da goi khach' }] } }; W.env.delay = 40;
  const pr = W.stuckSave('xuly'); await sleep(5); ok(W.state.busy === true && [...W.ov().querySelectorAll('button[onclick^="stuckSave"]')].every(b => b.disabled), 'dang luu: khoa nut (khong bam trung)'); await W.stuckSave('xem'); await pr;
  ok(W.env.posts.length === 1 && JSON.stringify(W.env.posts[0]) === JSON.stringify({ action: 'stuckFollowSet', id: '3418875', status: 'xuly', note: 'da goi khach', by: 'Hoa' }), 'POST dung (bam trung bi bo qua): ' + JSON.stringify(W.env.posts));
  ok(W.find('3418875').follow.status === 'xuly' && /Đang xử lý · Hoa/.test(W.ov().textContent) && /da goi khach/.test(W.ov().textContent) && /Đã ghi: Đang xử lý/.test(W.env.toasts.join('|')) && W.state.busy === false, 'luu OK: cap nhat trang thai + ghi chu + thong bao');
  W.env.delay = 0; W.env.reply = { ok: false, code: 'FORBIDDEN', error: 'Chi CS phu trach don nay (hoac quan tri) moi duoc danh dau theo doi.' }; await W.stuckSave('xong'); ok(W.find('3418875').follow.status === 'xuly' && /Không lưu được: Chi CS phu trach/.test(W.ov().textContent) && !W.state.busy, 'server tu choi (FORBIDDEN): giu nguyen, hien ly do');
  W.env.reply = new Error('mat mang'); await W.stuckSave('xong'); ok(/Không lưu được: mat mang/.test(W.ov().textContent), 'loi mang: hien thong bao');
  W.env.reply = { ok: true, follow: null }; await W.stuckSave('bo'); ok(W.find('3418875').follow === null && /Chưa ai tích theo dõi/.test(W.ov().textContent) && /Đã bỏ theo dõi/.test(W.env.toasts.join('|')), 'bo theo doi');
  // d2. nut Mo ho so khach: dong hop roi goi ttOpenCustomer_(sdt, ma don) (ham cua phien khac, xu ly ca khach chua co trong danh sach)
  W = web(HOA, T()); W.stuckOpen('3418875'); ok(W.ov().querySelector('button[onclick*="ttOpenCustomer_"]').getAttribute('onclick') === "stuckClose();ttOpenCustomer_('0912000001','3418875')", 'onclick: dong hop + ttOpenCustomer_(sdt, ma don)');
  ok(/stuckOpen\(this\.dataset\.oid\)/.test(src36) && /stuckOpen\(this\.dataset\.oid\)/.test(src34) && /if \(x\.type === 'order' && x\.oid\) return _c2OrderRow\(x\);/.test(src40), 'noi vao: chip Tong quan, khung nhac viec, bang Cham soc & tai mua');
  console.log('ALL STUCK-ORDER TESTS PASSED');
})().catch(er => { console.error('FAIL (ngoai le): ' + (er && er.stack || er)); process.exit(1); });

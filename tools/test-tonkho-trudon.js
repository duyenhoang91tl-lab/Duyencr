#!/usr/bin/env node
// Test Node (sheet gia) cho TRU TON TU DONG THEO DON (gas_v13.js, khoi "TON KHO — TRU TON TU DONG THEO DON").
// Chay: node tools/test-tonkho-trudon.js -> "ALL TONKHO TRUDON TESTS PASSED". Khong goi mang that.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
function fnSrc(name) {
  const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name);
  let d = 0, k = src.indexOf('{', i);
  for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); }
  throw new Error('khong khop ngoac ' + name);
}
const a0 = src.indexOf('var SH_KHO ='), a1 = src.indexOf('var PK_CHAT_SECTION_ =');
const code = [fnSrc('normPhone_'), fnSrc('_stripVN_'), 'var VN_OFFSET_MS = 7 * 3600 * 1000;', fnSrc('_vnMidnight_'), fnSrc('_vnYmdParts_'), fnSrc('parseVNDate_'), fnSrc('splitMulti_'),
  "var POS_EXCLUDED_ORDER_STATUSES_ = ['huy don', 'hoan don', 'da hoan', 'dang hoan'];", fnSrc('_donHasExcludedStatus_'), src.slice(a0, a1)].join('\n');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const J = x => JSON.stringify(x);

const sheets = {};
const mkSheet = headers => { const rows = [headers.slice()]; return { rows, getLastRow: () => rows.length,
  getRange: (r, c, nr, nc) => ({ getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const row = rows[r - 1 + i] || []; const y = []; for (let j = 0; j < nc; j++) y.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); o.push(y); } return o; },
    setValues: v => { for (let i = 0; i < v.length; i++) { while (rows.length < r + i) rows.push([]); const row = rows[r - 1 + i] || (rows[r - 1 + i] = []); for (let j = 0; j < v[i].length; j++) row[c - 1 + j] = v[i][j]; } } }), deleteRow: r => { rows.splice(r - 1, 1); } }; };
const users = { admintok: { username: 'Admin1', role: 'admin', active: true }, l1tok: { username: 'leader1', role: 'cs', active: true }, s1tok: { username: 'staff1', role: 'cs', active: true } };
let ROWS = [], locks = 0, uuid = 0; const triggers = [];
const ctx = { jsonOut_: x => x, getSheet_: (n, h) => sheets[n] || (sheets[n] = mkSheet(h)), _sessUser_: t => users[t] || null, readUsers_: () => Object.values(users),
  getCrmSS_: () => ({ getSheetByName: () => ({}) }), SH_USER: 'Users', readDonChiTiet_: () => ROWS,
  LockService: { getScriptLock: () => ({ waitLock() { locks++; }, releaseLock() {} }) }, Utilities: { getUuid: () => String(++uuid).padStart(8, '0') + 'ab-0000-0000-0000-000000000000' }, Logger: { log() {} },
  ScriptApp: { getProjectTriggers: () => triggers.slice(), deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1), newTrigger: fn => ({ timeBased: () => ({ everyMinutes: m => ({ create: () => triggers.push({ getHandlerFunction: () => fn, minutes: m }) }) }) }) } };
vm.createContext(ctx); vm.runInContext(code, ctx);
const run = (fn, data) => { ctx.__d = data; return vm.runInContext(fn + '(__d)', ctx); };
const call = (expr) => vm.runInContext(expr, ctx);

// ---- du lieu: 2 kho (Kho san xuat, Quay), mat hang, combo ----
const KSX = run('khoSave_', { token: 'admintok', kho: { name: 'KHO SẢN XUẤT', leaders: ['leader1'], staff: ['staff1'] } }).kho.id;
const KQ = run('khoSave_', { token: 'admintok', kho: { name: 'QUẦY', leaders: ['leader1'], staff: [] } }).kho.id;
const add = (kid, code, ton) => run('tonKhoItemSave_', { token: 'admintok', khoId: kid, maHang: code, tenHang: code + ' ten', ton: ton });
add(KSX, 'VTNL-DT-CT', 10); add(KSX, 'N3L-NB-UT', 5); add(KSX, 'TS-X', 20); add(KQ, 'CB-COMP1', 8); add(KSX, 'AA', 5); add(KQ, 'AA', 5); add(KSX, 'LOW', 3);
const ton = (kid, code) => call('readTonKho_("' + kid + '")').find(x => x.maHang === code).ton;
const order = (o) => Object.assign({ ngayTaoDon: '07/10/2026', khachHang: 'Khach', soDienThoai: '0912000001', nguonDon: 'Quầy Hào Nam', trangThai: 'Đã nhận', sanPham: '', maSanPham: '', soLuong: '', giaTriSauGiam: 1000000, ghiChu: '' }, o);
const admin = (extra) => Object.assign({ token: 'admintok' }, extra || {});

// ===== cau hinh + quyen =====
let r = call('_tkdRun_({ apply: false })'); ok(/Chua dat ngay bat dau/.test(r.error), 'chua co ngay bat dau -> khong tinh gi');
for (const fn of ['tonKhoTruDonCauHinh_', 'tonKhoTruDonXemTruoc_', 'tonKhoTruDonChay_', 'tonKhoTruDonHoanTay_', 'khoComboSave_']) {
  ok(run(fn, { token: 'l1tok', mode: 'on', combo: { code: 'X' }, key: 'k' }).code === 'FORBIDDEN', fn + ': leader khong duoc');
  ok(run(fn, { token: 'nope' }).code === 'AUTH', fn + ': khong dang nhap -> AUTH');
}
ok(/ngay bat dau/.test(run('tonKhoTruDonCauHinh_', admin({ mode: 'on' })).error), "khong bat 'on' khi chua co ngay bat dau");
ok(/khong hop le/.test(run('tonKhoTruDonCauHinh_', admin({ mode: 'bat' })).error), 'che do sai');
ok(/dd\/MM\/yyyy/.test(run('tonKhoTruDonCauHinh_', admin({ start: 'hom qua' })).error), 'ngay sai');
ok(/uu tien khong ton tai/.test(run('tonKhoTruDonCauHinh_', admin({ priority: ['KXXX'] })).error), 'kho uu tien khong ton tai');
r = run('tonKhoTruDonCauHinh_', admin({ start: '01/10/2026' })); ok(r.ok && r.config.start === '01/10/2026' && r.config.mode === 'off', 'dat ngay bat dau, che do van off');
ok(/off/.test(run('tonKhoTruDonChay_', admin()).error), "che do off -> khong chay that");

// ===== combo =====
ok(/ma combo/.test(run('khoComboSave_', admin({ combo: { code: ' ' } })).error), 'thieu ma combo');
ok(/Thanh phan 1/.test(run('khoComboSave_', admin({ combo: { code: 'CB-TL', components: [{ code: 'TS-X', qty: 0 }] } })).error), 'thanh phan qty 0');
ok(/chinh no/.test(run('khoComboSave_', admin({ combo: { code: 'CB-TL', components: [{ code: 'cb-tl', qty: 1 }] } })).error), 'combo chua chinh no');
ok(/it nhat 1 thanh phan/.test(run('khoComboSave_', admin({ combo: { code: 'CB-TL', components: [] } })).error), 'combo rong');
r = run('khoComboSave_', admin({ combo: { code: 'CB-TL', name: 'COMBO TAM LOC', components: [{ code: 'TS-X', qty: 1 }, { code: 'CB-COMP1', qty: 2 }] } })); ok(r.ok && r.created, 'tao combo');
r = run('khoComboSave_', admin({ combo: { code: 'cb-tl', name: 'COMBO TAM LOC', components: [{ code: 'TS-X', qty: 1 }, { code: 'CB-COMP1', qty: 2 }] } })); ok(r.ok && !r.created && call('readKhoCombo_()').length === 1, 'sua combo (khong phan biet hoa thuong), khong tao trung');

// ===== don mau =====
const D = '07/10/2026';
const o1 = order({ soDienThoai: '0912000001', sanPham: 'VONG ,COMBO TAM LOC ,DAY THEP', maSanPham: 'VTNL-DT-CT ;CB-TL ;DTCD', soLuong: '1 ,2 ,1' });   // ma + combo (x2) + dich vu khong thuoc kho
const o2 = order({ soDienThoai: '0912000002', sanPham: 'NHAN', maSanPham: 'N3L-NB-UT', soLuong: '1' });
const oBefore = order({ ngayTaoDon: '30/09/2026', soDienThoai: '0912000003', sanPham: 'NHAN', maSanPham: 'N3L-NB-UT', soLuong: '3' });   // truoc ngay bat dau
const oNoCode = order({ soDienThoai: '0912000004', sanPham: 'GOI', maSanPham: '', soLuong: '' });
const oService = order({ soDienThoai: '0912000005', sanPham: 'DAY THEP', maSanPham: 'DTCD', soLuong: '1' });
const oMismatch = order({ soDienThoai: '0912000006', sanPham: 'A ,B', maSanPham: 'N3L-NB-UT ;TS-X', soLuong: '1' });
const oBigQty = order({ soDienThoai: '0912000007', sanPham: 'DAY ,NHAN', maSanPham: 'DTCD ;N3L-NB-UT', soLuong: '2001 ,1' });
const oBadQty = order({ soDienThoai: '0912000008', sanPham: 'NHAN', maSanPham: 'N3L-NB-UT', soLuong: '0' });
const oUndefCombo = order({ soDienThoai: '0912000009', sanPham: 'COMBO XX ,NHAN', maSanPham: 'CB-XX ;N3L-NB-UT', soLuong: '1 ,1' });
const oMulti = order({ soDienThoai: '0912000010', sanPham: 'AA', maSanPham: 'AA', soLuong: '2' });
const oLow = order({ soDienThoai: '0912000011', sanPham: 'LOW', maSanPham: 'LOW', soLuong: '5' });
const oFail = order({ soDienThoai: '0912000012', trangThai: 'Đã hoàn', sanPham: 'NHAN', maSanPham: 'N3L-NB-UT', soLuong: '1' });
ROWS = [o1, o2, oBefore, oNoCode, oService, oMismatch, oBigQty, oBadQty, oUndefCombo, oMulti, oLow, oFail, Object.assign({}, o2)];   // dong cuoi = o2 lap (import lap)

// ===== XEM TRUOC: khong ghi gi =====
const snap = () => J([call('readTonKho_("")'), sheets.TonKhoTruDon ? sheets.TonKhoTruDon.rows.length : 0, sheets.TonKhoLog.rows.length]);
const before = snap();
r = run('tonKhoTruDonXemTruoc_', admin());
ok(r.ok && !r.apply && snap() === before, 'xem truoc KHONG ghi (ton, so cai, log deu nguyen): ' + J(r).slice(0, 300));
ok(r.considered === 10 && r.duplicateRows === 1, 'xet 10 don tu 01/10 (bo don 30/09, don khong ma, dong lap): ' + r.considered + ' lap ' + r.duplicateRows);
ok(r.deducted === 3 && r.held === 5 && r.ignoredNoStock === 1 && r.reversed === 0, 'ke hoach: tru 3 (o1, o2, oLow), giu 5, bo qua 1 (dich vu), 0 hoan (don Da hoan chua tru thi khong lam gi): ' + J({ d: r.deducted, h: r.held, i: r.ignoredNoStock }));
const reasons = r.heldOrders.map(h => h.reasons.join('|')).join('\n');
ok(/Lech so ma/.test(reasons) && /SL bat thuong cho ma DTCD: 2001/.test(reasons) && /SL khong hop le cho ma N3L-NB-UT/.test(reasons) && /Combo chua khai bao: CB-XX/.test(reasons) && /co o nhieu kho/.test(reasons), 'ly do giu day du: ' + reasons);
ok(r.perKho['KHO SẢN XUẤT'] && r.perKho['QUẦY'], 'bao cao theo kho');

// ===== CHAY THAT =====
run('tonKhoTruDonCauHinh_', admin({ mode: 'on' }));
const lk = locks; r = run('tonKhoTruDonChay_', admin()); ok(r.ok && r.apply && r.deducted === 3 && locks === lk + 1, 'chay that duoi khoa: ' + J(r).slice(0, 200));
ok(ton(KSX, 'VTNL-DT-CT') === 9 && ton(KSX, 'TS-X') === 18 && ton(KQ, 'CB-COMP1') === 4 && ton(KSX, 'N3L-NB-UT') === 4, 'combo CB-TL x2 -> TS-X -2, CB-COMP1 -4; ma thuong tru dung kho: ' + [ton(KSX, 'VTNL-DT-CT'), ton(KSX, 'TS-X'), ton(KQ, 'CB-COMP1'), ton(KSX, 'N3L-NB-UT')]);
ok(ton(KSX, 'LOW') === 0, 'ton 3 ban 5: tru toi da 3, KHONG am (con 0)');
ok(r.shortages.length === 1 && r.shortages[0].maHang === 'LOW' && r.shortages[0].thieu === 2, 'ghi nhan thieu 2: ' + J(r.shortages));
ok(ton(KSX, 'AA') === 5 && ton(KQ, 'AA') === 5, 'ma o 2 kho chua co uu tien: KHONG tru');
const it0 = call('readTonKho_("' + KSX + '")').find(x => x.maHang === 'TS-X'); ok(it0.updatedBy === 'he-thong' && it0.ver >= 2, 'nguoi cap nhat = he-thong, ver tang');
const logs = call('readTonKhoLog_({ khoId: "' + KSX + '", maHang: "TS-X" })'); ok(logs[0].loai === 'tru_don' && logs[0].delta === -2 && logs[0].ref && /07\/10\/2026/.test(logs[0].lyDo), 'log tru_don co ref + ly do: ' + J(logs[0]));
let st = call('tonKhoTruDonStatus_()'); ok(st.ledger.da_tru === 3 && st.ledger.cho_duyet === 5 && st.mode === 'on' && st.combos === 1, 'trang thai: ' + J(st));
// ---- chay lai: khong tru them ----
const snap2 = snap(); r = run('tonKhoTruDonChay_', admin()); ok(r.deducted === 0 && r.alreadyDone === 3 && snap().length > 0, 'chay lai: khong tru them (alreadyDone=3): ' + J({ d: r.deducted, a: r.alreadyDone, h: r.held }));
ok(ton(KSX, 'TS-X') === 18, 'ton khong doi sau chay lai');
// don giu: chay lai khong nhan ban so cai
const ledRows = sheets.TonKhoTruDon.rows.length; run('tonKhoTruDonChay_', admin()); ok(sheets.TonKhoTruDon.rows.length === ledRows, 'don dang giu khong sinh them dong so cai moi lan chay');

// ===== giai quyet don giu =====
r = run('khoComboSave_', admin({ combo: { code: 'CB-XX', name: 'COMBO XX', components: [{ code: 'N3L-NB-UT', qty: 1 }] } })); ok(r.ok, 'khai bao combo con thieu');
run('tonKhoTruDonChay_', admin());
ok(ton(KSX, 'N3L-NB-UT') === 2, 'sau khai bao combo: don giu tu dong tru (N3L: 4 -> 2 = 1 ma + 1 thanh phan combo): ' + ton(KSX, 'N3L-NB-UT'));
ok(call('tonKhoTruDonStatus_()').ledger.cho_duyet === 4, 'cho_duyet con 4');
run('tonKhoTruDonCauHinh_', admin({ priority: [KQ] })); run('tonKhoTruDonChay_', admin());
ok(ton(KQ, 'AA') === 3 && ton(KSX, 'AA') === 5, 'dat uu tien Quay: ma AA tru o Quay 5 -> 3');

// ===== Huy / Hoan: cong tra, tru lai =====
const stockBefore = ton(KSX, 'VTNL-DT-CT'), tsBefore = ton(KSX, 'TS-X'), compBefore = ton(KQ, 'CB-COMP1');
ROWS[0] = Object.assign({}, o1, { trangThai: 'Đã hoàn' }); run('tonKhoTruDonChay_', admin());
ok(ton(KSX, 'VTNL-DT-CT') === stockBefore + 1 && ton(KSX, 'TS-X') === tsBefore + 2 && ton(KQ, 'CB-COMP1') === compBefore + 4, 'don Da hoan: cong tra DUNG so da tru (ca thanh phan combo)');
ok(call('readTonKhoLog_({ khoId: "' + KSX + '", maHang: "TS-X" })')[0].loai === 'hoan_don', 'log hoan_don');
run('tonKhoTruDonChay_', admin()); ok(ton(KSX, 'TS-X') === tsBefore + 2, 'chay lai khi van hoan: khong cong them');
ROWS[0] = Object.assign({}, o1, { trangThai: 'Đã nhận' }); run('tonKhoTruDonChay_', admin());
ok(ton(KSX, 'TS-X') === tsBefore && ton(KSX, 'VTNL-DT-CT') === stockBefore, 'don huy roi co lai: tru lai dung 1 lan');
// don vua vao da Huy: khong tru
ROWS.push(order({ soDienThoai: '0912000013', trangThai: 'Hủy đơn', sanPham: 'NHAN', maSanPham: 'TS-X', soLuong: '1' })); run('tonKhoTruDonChay_', admin()); ok(ton(KSX, 'TS-X') === tsBefore, 'don vua vao da Huy: khong tru');

// ===== don mo coi + hoan tay =====
const o3 = order({ soDienThoai: '0912000020', sanPham: 'X', maSanPham: 'TS-X', soLuong: '3' }); ROWS.push(o3); run('tonKhoTruDonChay_', admin()); ok(ton(KSX, 'TS-X') === tsBefore - 3, 'don moi tru 3');
ROWS = ROWS.filter(x => x !== o3); r = run('tonKhoTruDonChay_', admin()); ok(r.orphans.length === 1 && ton(KSX, 'TS-X') === tsBefore - 3, 'don mat khoi sheet: bao mo coi, KHONG tu hoan');
const orphanKey = r.orphans[0].key; ok(/Khong tim thay/.test(run('tonKhoTruDonHoanTay_', admin({ key: 'khong-co' })).error), 'hoan tay khoa la');
r = run('tonKhoTruDonHoanTay_', admin({ key: orphanKey })); ok(r.ok && ton(KSX, 'TS-X') === tsBefore, 'admin hoan tay don mo coi: cong tra 3');
ok(/khong co gi de hoan/.test(run('tonKhoTruDonHoanTay_', admin({ key: orphanKey })).error), 'hoan tay lan 2 bi chan');

// ===== gioi han moi lan chay =====
call('TKD_BATCH_ = 2'); for (let i = 0; i < 5; i++) ROWS.push(order({ soDienThoai: '09130000' + i, sanPham: 'X', maSanPham: 'TS-X', soLuong: '1' }));
const t0 = ton(KSX, 'TS-X'); r = run('tonKhoTruDonChay_', admin()); ok(r.limitReached && r.deducted === 2 && ton(KSX, 'TS-X') === t0 - 2, 'gioi han 2 don/lan: ' + J({ d: r.deducted, l: r.limitReached }));
run('tonKhoTruDonChay_', admin()); run('tonKhoTruDonChay_', admin()); ok(ton(KSX, 'TS-X') === t0 - 5, 'cac lan sau tiep tuc, tong dung 5 don (khong sot, khong trung)');
call('TKD_BATCH_ = 300');

// ===== trigger / tick =====
run('tonKhoTruDonCauHinh_', admin({ mode: 'dry' })); ROWS.push(order({ soDienThoai: '0914000001', sanPham: 'X', maSanPham: 'TS-X', soLuong: '1' }));
const t1 = ton(KSX, 'TS-X'); call('tonKhoTruDonTick_()'); ok(ton(KSX, 'TS-X') === t1, "tick o che do dry: khong tru");
run('tonKhoTruDonCauHinh_', admin({ mode: 'on' })); call('tonKhoTruDonTick_()'); ok(ton(KSX, 'TS-X') === t1 - 1, 'tick o che do on: tru');
call('tonKhoTruDonCaiTrigger()'); call('tonKhoTruDonCaiTrigger()'); ok(triggers.length === 1 && triggers[0].minutes === 10, 'cai trigger 10 phut, cai 2 lan van chi 1');
call('tonKhoTruDonGoTrigger()'); ok(triggers.length === 0, 'go trigger');
// kho ngung hoat dong: ma cua kho do khong con duoc tru
run('khoSave_', { token: 'admintok', kho: { id: KQ, name: 'QUẦY', leaders: ['leader1'], staff: [], active: false } });
ROWS.push(order({ soDienThoai: '0915000001', sanPham: 'X', maSanPham: 'CB-COMP1', soLuong: '1' })); const q0 = ton(KQ, 'CB-COMP1'); r = run('tonKhoTruDonChay_', admin());
ok(ton(KQ, 'CB-COMP1') === q0 && r.ignoredNoStock >= 1, 'kho ngung hoat dong: ma cua kho do bi coi nhu khong thuoc kho nao, khong tru');
console.log('ALL TONKHO TRUDON TESTS PASSED');

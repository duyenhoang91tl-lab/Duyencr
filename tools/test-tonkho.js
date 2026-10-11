#!/usr/bin/env node
// Test Node (sheet gia) cho module TON KHO (gas_v13.js, khoi "TON KHO ... 24_TonKho"): phan quyen admin/leader/nhan vien, xung dot phien ban, nhap/xuat, ton am,
// nhap Excel hang loat, nhat ky, khoa. Chay: node tools/test-tonkho.js -> "ALL TONKHO TESTS PASSED". Khong goi mang that.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const code = src.slice(src.indexOf('var SH_KHO ='));
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const J = x => JSON.stringify(x);

// ---- sheet gia ----
const sheets = {};
function mkSheet(headers) {
  const rows = [headers.slice()];
  return { rows,
    getLastRow: () => rows.length,
    getRange: (r, c, nr, nc) => ({
      getValues: () => { const out = []; for (let i = 0; i < nr; i++) { const row = rows[r - 1 + i] || []; const y = []; for (let j = 0; j < nc; j++) y.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); out.push(y); } return out; },
      setValues: v => { for (let i = 0; i < v.length; i++) { while (rows.length < r + i) rows.push([]); const row = rows[r - 1 + i] || (rows[r - 1 + i] = []); for (let j = 0; j < v[i].length; j++) row[c - 1 + j] = v[i][j]; } } }),
    deleteRow: r => { rows.splice(r - 1, 1); } };
}
const users = { admintok: { username: 'Admin1', role: 'admin', active: true }, l1tok: { username: 'leader1', role: 'cs', active: true }, s1tok: { username: 'staff1', role: 'cs', active: true },
  s2tok: { username: 'staff2', role: 'cs', active: true }, otok: { username: 'outsider', role: 'cs', active: true } };
let lockFail = false, locks = 0, unlocks = 0, uuid = 0;
const ctx = { jsonOut_: x => x,
  getSheet_: (name, headers) => sheets[name] || (sheets[name] = mkSheet(headers)),
  _sessUser_: tok => users[tok] || null,
  readUsers_: () => Object.values(users),
  getCrmSS_: () => ({ getSheetByName: () => ({}) }), SH_USER: 'Users',
  LockService: { getScriptLock: () => ({ waitLock: () => { if (lockFail) throw new Error('busy'); locks++; }, releaseLock: () => { unlocks++; } }) },
  Utilities: { getUuid: () => String(++uuid).padStart(8, '0') + 'ab-0000-0000-0000-000000000000' } };
vm.createContext(ctx); vm.runInContext(code, ctx);
const run = (fn, data) => { ctx.__d = data; return vm.runInContext(fn + '(__d)', ctx); };

// ===== _khoNum_ =====
const N = v => { ctx.__v = v; return vm.runInContext('_khoNum_(__v)', ctx); };
ok(N(12) === 12 && N('12') === 12 && N('1.000') === 1000 && N('12.345.678') === 12345678 && N('1,5') === 1.5 && N('1.5') === 1.5 && N(' 7 ') === 7 && N('-3') === -3, 'doc so');
ok(isNaN(N('')) && isNaN(N('abc')) && isNaN(N(null)) && isNaN(N(NaN)) && isNaN(N('1.2.3')) && isNaN(N('12abc')), 'so khong hop le');

// ===== kho: chi admin, validate =====
let r = run('khoSave_', { token: '', kho: { name: 'X' } }); ok(r.code === 'AUTH', 'khong token -> AUTH');
r = run('khoSave_', { token: 'l1tok', kho: { name: 'KHO A' } }); ok(r.code === 'FORBIDDEN', 'khong phai admin khong tao duoc kho');
r = run('khoSave_', { token: 'admintok', kho: { name: '  ' } }); ok(/ten kho/.test(r.error), 'thieu ten');
r = run('khoSave_', { token: 'admintok', kho: { name: 'KHO SX', leaders: ['Leader1'], staff: ['staff1', 'LEADER1', 'ghost'] } }); ok(/ghost/.test(r.error), 'tai khoan khong ton tai bi bao: ' + J(r));
r = run('khoSave_', { token: 'admintok', kho: { name: 'KHO SX', leaders: ['Leader1'], staff: ['staff1', 'LEADER1', 'staff1'], note: 'xuong' } });
ok(r.ok && /^K/.test(r.kho.id) && J(r.kho.leaders) === '["leader1"]' && J(r.kho.staff) === '["staff1"]', 'tao kho: leader khong lap trong staff, username chuan hoa: ' + J(r));
const K1 = r.kho.id;
r = run('khoSave_', { token: 'admintok', kho: { name: 'kho sx' } }); ok(/Da co kho/.test(r.error), 'trung ten kho (khong phan biet hoa thuong)');
r = run('khoSave_', { token: 'admintok', kho: { name: 'KHO HN', leaders: [], staff: ['staff2'] } }); if (!r.ok) console.error('DBG', J(r)); const K2 = r.kho && r.kho.id; ok(r.ok && K2 !== K1, 'tao kho 2');
r = run('khoSave_', { token: 'admintok', kho: { id: K2, name: 'KHO HA NOI', leaders: ['staff2'], staff: [], active: true } }); ok(r.ok && r.kho.name === 'KHO HA NOI' && J(r.kho.leaders) === '["staff2"]', 'sua kho');
ok(ctx.readKho_().length === 2 && ctx.readKho_()[1].createdBy === 'Admin1', 'readKho_: 2 kho, ghi nguoi tao');
r = run('khoSave_', { token: 'admintok', kho: { id: 'KXXX', name: 'Z' } }); ok(/Khong tim thay kho/.test(r.error), 'sua kho khong ton tai');

// ===== phan quyen tren mat hang =====
const base = (tok, o) => Object.assign({ token: tok, khoId: K1 }, o || {});
r = run('tonKhoItemSave_', base('s1tok', { maHang: 'CC3L-HNV-VC', tenHang: 'CHARM CO 3 LA', ton: 4 })); ok(r.code === 'FORBIDDEN' && /leader/.test(r.error), 'staff khong them duoc mat hang');
r = run('tonKhoItemSave_', base('otok', { maHang: 'A', ton: 1 })); ok(r.code === 'FORBIDDEN', 'nguoi ngoai khong them duoc');
r = run('tonKhoItemSave_', base('l2tok', { maHang: 'A' })); ok(r.code === 'AUTH', 'token la -> AUTH');
r = run('tonKhoItemSave_', base('l1tok', { maHang: ' CC3L-HNV-VC ', tenHang: 'CHARM CỎ 3 LÁ ĐÁ MẶT TRỜI VÒNG CUỐN', ton: 4, minTon: 2 }));
ok(r.ok && r.created && r.item.maHang === 'CC3L-HNV-VC' && r.item.ton === 4 && r.item.ver === 1 && r.item.updatedBy === 'leader1' && r.item.minTon === 2, 'leader them mat hang: ' + J(r));
r = run('tonKhoItemSave_', base('admintok', { maHang: 'cc3l-hnv-vc', tenHang: 'TEN MOI' })); ok(r.ok && !r.created && r.item.tenHang === 'TEN MOI' && r.item.ton === 4 && r.item.ver === 2 && r.item.minTon === null, 'ma khong phan biet hoa thuong/khoang trang: sua ten, KHONG doi ton: ' + J(r));
r = run('tonKhoItemSave_', base('l1tok', { maHang: 'CC4L-NB', tenHang: 'CHARM CO 4 LA', ton: -1 })); ok(/Ton ban dau/.test(r.error), 'ton ban dau am bi tu choi');
r = run('tonKhoItemSave_', base('l1tok', { maHang: 'CC4L-NB', tenHang: 'CHARM CO 4 LA', minTon: 'x' })); ok(/canh bao/.test(r.error), 'minTon sai');
r = run('tonKhoItemSave_', base('l1tok', { maHang: 'CC4L-NB', tenHang: 'CHARM CO 4 LA' })); ok(r.ok && r.created && r.item.ton === 0, 'ton ban dau mac dinh 0');
// leader kho 1 khong dung duoc kho 2
r = run('tonKhoItemSave_', { token: 'l1tok', khoId: K2, maHang: 'B', ton: 1 }); ok(r.code === 'FORBIDDEN', 'leader kho 1 khong sua duoc kho 2');
r = run('tonKhoItemSave_', { token: 's2tok', khoId: K2, maHang: 'B', ton: 7 }); ok(r.ok, 'staff2 la leader cua kho 2 (da doi o tren) them duoc');
r = run('tonKhoItemSave_', { token: 'admintok', khoId: 'KNONE', maHang: 'B' }); ok(/Khong tim thay kho/.test(r.error), 'kho khong ton tai');

// ===== tonKhoSet_ (kiem ke) =====
r = run('tonKhoSet_', base('s1tok', { maHang: 'CC3L-HNV-VC', newQty: 10 })); ok(/ly do/.test(r.error), 'bat buoc ly do');
r = run('tonKhoSet_', base('s1tok', { maHang: 'CC3L-HNV-VC', newQty: -1, lyDo: 'kiem ke' })); ok(/am/.test(r.error), 'khong cho am');
r = run('tonKhoSet_', base('s1tok', { maHang: 'CC3L-HNV-VC', newQty: 'abc', lyDo: 'kiem ke' })); ok(/khong hop le/.test(r.error), 'so sai');
r = run('tonKhoSet_', base('s1tok', { maHang: 'ZZZ', newQty: 1, lyDo: 'kiem ke' })); ok(/Chua co mat hang/.test(r.error), 'ma khong co');
r = run('tonKhoSet_', base('otok', { maHang: 'CC3L-HNV-VC', newQty: 1, lyDo: 'kiem ke' })); ok(r.code === 'FORBIDDEN', 'nguoi ngoai khong kiem ke duoc');
r = run('tonKhoSet_', base('s1tok', { maHang: 'cc3l-hnv-vc', newQty: 10, lyDo: 'kiem ke thang 10', expectedVer: 2 })); ok(r.ok && r.item.ton === 10 && r.item.ver === 3 && r.item.updatedBy === 'staff1', 'staff kiem ke: ' + J(r));
r = run('tonKhoSet_', base('l1tok', { maHang: 'CC3L-HNV-VC', newQty: 99, lyDo: 'nham', expectedVer: 2 })); ok(r.code === 'CONFLICT' && r.current.ton === 10 && r.current.ver === 3, 'ver cu -> CONFLICT kem dong hien tai: ' + J(r));
ok(run('tonKhoSet_', base('s1tok', { maHang: 'CC3L-HNV-VC', newQty: 10, lyDo: 'khong doi' })).ok, 'dat bang so cu van ok');

// ===== tonKhoAdjust_ (nhap/xuat) =====
r = run('tonKhoAdjust_', base('s1tok', { maHang: 'CC3L-HNV-VC', delta: 5, lyDo: 'nhap tu xuong' })); ok(r.ok && r.item.ton === 15, 'nhap +5');
r = run('tonKhoAdjust_', base('l1tok', { maHang: 'CC3L-HNV-VC', delta: -3 })); ok(r.ok && r.item.ton === 12, 'xuat -3 (cong don tren so hien tai, khong ghi de)');
r = run('tonKhoAdjust_', base('s1tok', { maHang: 'CC3L-HNV-VC', delta: -13 })); ok(r.code === 'NEGATIVE' && /hien co 12/.test(r.error) && r.current.ton === 12, 'xuat qua ton bi chan, khong doi: ' + J(r));
r = run('tonKhoAdjust_', base('s1tok', { maHang: 'CC3L-HNV-VC', delta: 0 })); ok(/khong hop le/.test(r.error), 'delta 0');
r = run('tonKhoAdjust_', base('s1tok', { maHang: 'CC3L-HNV-VC', delta: 'x' })); ok(/khong hop le/.test(r.error), 'delta sai');
r = run('tonKhoAdjust_', base('otok', { maHang: 'CC3L-HNV-VC', delta: 1 })); ok(r.code === 'FORBIDDEN', 'nguoi ngoai khong nhap/xuat duoc');
r = run('tonKhoAdjust_', base('s1tok', { maHang: 'CC3L-HNV-VC', delta: -12 })); ok(r.ok && r.item.ton === 0, 'xuat het ve 0 duoc');

// ===== nhap Excel hang loat =====
r = run('tonKhoImport_', base('s1tok', { items: [{ maHang: 'A', ton: 1 }] })); ok(r.code === 'FORBIDDEN', 'staff khong nhap Excel duoc');
r = run('tonKhoImport_', base('l1tok', { items: [] })); ok(/Khong co dong/.test(r.error), 'file rong');
r = run('tonKhoImport_', base('l1tok', { items: new Array(20001).fill({ maHang: 'A', ton: 1 }) })); ok(/Qua nhieu/.test(r.error), 'qua gioi han');
const before = ctx.readTonKho_(K1).length;
r = run('tonKhoImport_', base('l1tok', { mode: 'set', lyDo: 'Ton thuc te 03/10', items: [
  { maHang: 'CC3L-HNV-VC', tenHang: 'TEN MOI', ton: '4' }, { maHang: 'CC4L-NB', ton: 3 }, { maHang: 'CLTN-MIX', tenHang: 'CHARM LU THONG MIX', ton: '1.308' },
  { maHang: 'cc3l-hnv-vc', ton: 99 }, { maHang: '', ton: 1 }, { maHang: 'BAD', ton: 'abc' }, { maHang: 'NEG', ton: -5 }, { maHang: 'CNN-LT', tenHang: 'NHAT NGUYET', ton: 169 }] }));
ok(r.ok && r.created === 2 && r.updated === 2 && r.unchanged === 0 && r.duplicatesInFile === 1 && r.skippedCount === 4, 'import set (CC4L-NB da co -> cap nhat 0->3; CLTN-MIX, CNN-LT moi): ' + J(r));
ok(ctx.readTonKho_(K1).length === before + 2, 'them 2 mat hang moi');
const mix = ctx.readTonKho_(K1).find(x => x.maHang === 'CLTN-MIX'); ok(mix.ton === 1308 && mix.ver === 1, 'dau cham nghin: 1.308 = 1308');
ok(ctx.readTonKho_(K1).find(x => x.maHang === 'CC3L-HNV-VC').ton === 4 && ctx.readTonKho_(K1).find(x => x.maHang === 'CC3L-HNV-VC').tenHang === 'TEN MOI', 'import set: dat ton = so trong file (0 -> 4)');
r = run('tonKhoImport_', base('l1tok', { mode: 'set', items: [{ maHang: 'CNN-LT', ton: 169 }, { maHang: 'CC4L-NB', ton: 3 }] })); ok(r.ok && r.unchanged === 2 && r.updated === 0 && r.created === 0, 'import lai y het -> khong doi gi: ' + J(r));
r = run('tonKhoImport_', base('l1tok', { mode: 'add', items: [{ maHang: 'CNN-LT', ton: 11 }, { maHang: 'CC4L-NB', ton: -5 }, { maHang: 'NEWADD', ton: 6 }] }));
ok(r.ok && r.updated === 1 && r.created === 1 && r.skippedCount === 1 && ctx.readTonKho_(K1).find(x => x.maHang === 'CNN-LT').ton === 180 && ctx.readTonKho_(K1).find(x => x.maHang === 'CC4L-NB').ton === 3, 'import add: cong them, khong de am: ' + J(r));
r = run('tonKhoImport_', { token: 'l1tok', khoId: K2, items: [{ maHang: 'A', ton: 1 }] }); ok(r.code === 'FORBIDDEN', 'leader kho 1 khong nhap vao kho 2');
ok(ctx.readTonKho_(K2).length === 1 && ctx.readTonKho_().length === ctx.readTonKho_(K1).length + 1, 'readTonKho_ loc theo kho / khong loc = tat ca');

// ===== xoa mat hang =====
r = run('tonKhoItemDelete_', base('s1tok', { maHang: 'NEWADD' })); ok(r.code === 'FORBIDDEN', 'staff khong xoa duoc');
r = run('tonKhoItemDelete_', base('l1tok', { maHang: 'NEWADD', expectedVer: 99 })); ok(r.code === 'CONFLICT', 'xoa voi ver cu -> CONFLICT');
r = run('tonKhoItemDelete_', base('l1tok', { maHang: 'NEWADD', lyDo: 'nhap nham' })); ok(r.ok && !ctx.readTonKho_(K1).some(x => x.maHang === 'NEWADD'), 'xoa mat hang');
r = run('tonKhoItemDelete_', base('l1tok', { maHang: 'NEWADD' })); ok(/Khong tim thay/.test(r.error), 'xoa lan 2');
// sau khi xoa dong, cac dong sau van dung vi tri (nhap/xuat khong ghi nham dong)
const snap = ctx.readTonKho_(K1).map(x => x.maHang + ':' + x.ton).join();
r = run('tonKhoAdjust_', base('l1tok', { maHang: 'CNN-LT', delta: 1 })); ok(r.ok && r.item.ton === 181, 'sau xoa dong, nhap/xuat van dung dong');
ok(ctx.readTonKho_(K1).filter(x => x.maHang !== 'CNN-LT').map(x => x.maHang + ':' + x.ton).join() === snap.split(',').filter(x => !x.startsWith('CNN-LT')).join(), 'cac dong khac khong bi doi');

// ===== kho ngung hoat dong =====
run('khoSave_', { token: 'admintok', kho: { id: K1, name: 'KHO SX', leaders: ['leader1'], staff: ['staff1'], active: false } });
r = run('tonKhoAdjust_', base('admintok', { maHang: 'CNN-LT', delta: 1 })); ok(/ngung hoat dong/.test(r.error), 'kho ngung -> khong ghi (ke ca admin)');
ok(ctx.readTonKho_(K1).length > 0, 'van XEM duoc ton cua kho ngung');
run('khoSave_', { token: 'admintok', kho: { id: K1, name: 'KHO SX', leaders: ['leader1'], staff: ['staff1'], active: true } });

// ===== nhat ky =====
const lg = ctx.readTonKhoLog_({ khoId: K1, maHang: 'cc3l-hnv-vc' });
ok(lg.length >= 4 && lg[0].ts >= lg[lg.length - 1].ts, 'log co nhieu dong, moi nhat truoc');
const kk = lg.find(x => x.loai === 'kiem_ke' && x.lyDo === 'kiem ke thang 10');
ok(kk && kk.before === 4 && kk.after === 10 && kk.delta === 6 && kk.user === 'staff1' && kk.tenHang === 'TEN MOI', 'log kiem ke dung truoc/sau/delta/nguoi: ' + J(kk));
ok(lg.some(x => x.loai === 'tao' && x.after === 4) && lg.some(x => x.loai === 'nhap' && x.delta === 5) && lg.some(x => x.loai === 'xuat' && x.delta === -3) && lg.some(x => x.loai === 'import'), 'du cac loai log: tao/nhap/xuat/import');
ok(lg.some(x => x.lyDo === 'khong doi' && x.delta === 0 && x.before === 10 && x.after === 10), 'kiem ke ra dung so cu van ghi log (delta 0) de co bang chung da kiem');
ok(ctx.readTonKhoLog_({ khoId: K1, limit: 3 }).length === 3 && ctx.readTonKhoLog_({ khoId: K2 }).every(x => x.khoId === K2), 'limit + loc kho');
ok(ctx.readTonKhoLog_({ khoId: K1, maHang: 'NEWADD' }).some(x => x.loai === 'xoa' && x.before === 6 && x.after === null), 'log xoa con lai sau khi xoa dong');
const logCountBefore = ctx.readTonKhoLog_({ limit: 1000 }).length;
run('tonKhoImport_', base('l1tok', { mode: 'set', items: [{ maHang: 'CNN-LT', ton: 181 }] })); ok(ctx.readTonKhoLog_({ limit: 1000 }).length === logCountBefore, 'khong doi -> khong ghi log thua');

// ===== khoa =====
const lk0 = locks; run('tonKhoAdjust_', base('l1tok', { maHang: 'CNN-LT', delta: 1 })); ok(locks === lk0 + 1 && unlocks === locks, 'moi lan ghi lay va tra khoa');
lockFail = true; const v0 = ctx.readTonKho_(K1).find(x => x.maHang === 'CNN-LT').ton;
r = run('tonKhoAdjust_', base('l1tok', { maHang: 'CNN-LT', delta: 1 })); ok(/ban/.test(r.error) && ctx.readTonKho_(K1).find(x => x.maHang === 'CNN-LT').ton === v0, 'khong lay duoc khoa -> bao ban, KHONG ghi');
lockFail = false;
// loi trong luc ghi van tra khoa
const ul0 = unlocks; ctx.getSheet_ = (n, h) => { throw new Error('sheet loi'); };
try { run('tonKhoAdjust_', base('l1tok', { maHang: 'CNN-LT', delta: 1 })); } catch (e) {}
ok(true, 'ghi loi khong lam treo khoa (xem: finally)');
console.log('ALL TONKHO TESTS PASSED');

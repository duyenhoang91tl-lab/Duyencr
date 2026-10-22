#!/usr/bin/env node
// Test Node cho thu vien mau tin co DUYET (MessageTemplates): quyen admin/manager/nhan vien/extension, chuyen trang thai, mau cu. Khong goi mang that.
// Chay: node tools/test-msgtpl.js -> "ALL MSGTPL TESTS PASSED" neu dat.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const fn = name => { const i = src.indexOf('\nfunction ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); const j = src.indexOf('\n}\n', i); return src.slice(i + 1, j + 3); };
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const a = src.indexOf("var SH_MSG_TPL ="), b = src.indexOf('function _tplCaller_(');
const consts = src.slice(a, b);
// ---- sheet gia ----
let data = [];
const sheet = { getDataRange: () => ({ getValues: () => data.map(r => r.slice()) }), appendRow: r => { data.push(r.slice()); },
  getRange: (r, c, nr, nc) => ({ setValues: m => { m.forEach((row, i) => { data[r - 1 + i] = data[r - 1 + i] || []; row.forEach((v, j) => { data[r - 1 + i][c - 1 + j] = v; }); }); }, setValue: v => { data[r - 1][c - 1] = v; } }),
  deleteRow: r => { data.splice(r - 1, 1); } };
const users = { tok_admin: { username: 'ad', name: 'Admin', role: 'admin' }, tok_mgr: { username: 'qm', name: 'Quản Lý', role: 'manager' }, tok_lead: { username: 'ld', name: 'Trưởng Nhóm', role: 'leader' }, tok_cs: { username: 'lan', name: 'Lan', role: 'cs' }, tok_cs2: { username: 'mai', name: 'Mai', role: 'cs' } };
const ctx = { jsonOut_: o => o, getSheet_: () => sheet, _sessUser_: t => users[t] || null, _extKeyWho_: ek => ek === 'KEYZ' ? 'zalo' : (ek === 'KEYP' ? 'pancake' : (ek ? 'sai' : '')), Date, JSON, Math, String, isNaN };
vm.createContext(ctx);
vm.runInContext(consts + fn('_tplCaller_') + fn('_tplRowToObj_') + fn('_tplOwns_') + fn('readMessageTemplates_') + fn('saveMessageTemplate_') + fn('deleteMessageTemplate_') + fn('approveMessageTemplate_'), ctx);
const H = vm.runInContext('MSG_TPL_HEADERS', ctx);
const reset = () => { data = [H.slice()]; };
const C = (t, ek, n) => ctx._tplCaller_(t, ek, n);
const save = (d, c) => ctx.saveMessageTemplate_(d, c), read = c => ctx.readMessageTemplates_(c);
const T = (o) => Object.assign({ title: 'Chao khach', content: 'Xin chao anh/chi', tags: 'chao', product: 'Nhan vang 9999', topic: 'Khach hoi gia' }, o || {});

// 1) danh tinh nguoi goi
reset();
ok(C('tok_admin', '', '').priv && !C('tok_mgr', '', '').priv, '4c-3: CHI admin la nguoi duyet (manager KHONG con dac quyen duyet mau chuan)');
ok(!C('tok_lead', '', '').priv && !C('tok_cs', '', '').priv, 'leader/cs KHONG duyet duoc (doi MSG_TPL_APPROVER_ROLES_ neu muon)');
ok(C('', 'KEYZ', 'Lan').role === 'ext' && !C('', 'KEYZ', 'Lan').priv && C('', 'KEYZ', 'Lan').name === 'Lan', 'extension co khoa: khong dac quyen, ten tu khai');
ok(C('', 'KEYX_SAI', 'Hacker').role === 'anon' && C('', '', 'x').role === 'anon', 'khoa sai / khong gi -> an danh');
ok(C('token_gia', '', 'Admin').role === 'anon' && !C('token_gia', '', 'Admin').priv, 'token gia + ten admin tu khai KHONG thanh admin');
ok(C('', 'KEYZ', 'x'.repeat(200)).name.length === 60, 'ten tu khai bi cat 60 ky tu');
// 2) admin/manager tao mau -> da duyet ngay
let r = save(T(), C('tok_admin', '', '')); ok(r.ok && r.status === 'approved', 'admin tao -> approved');
let adminId = r.id; let row = ctx._tplRowToObj_(data[1]); ok(row.approvedBy === 'Admin' && row.product === 'Nhan vang 9999' && row.topic === 'Khach hoi gia' && row.createdBy === 'Admin', 'luu dung cot san pham/chu de/nguoi tao/nguoi duyet');
r = save(T({ title: 'Mau QL' }), C('tok_mgr', '', '')); ok(r.status === 'pending', '4c-3: manager tao -> pending (khong con tu duyet)');
// 3) nhan vien (web) de xuat -> pending; ten lay tu token, khong tin client
r = save(T({ title: 'Mau cua Lan', createdBy: 'Admin' }), C('tok_cs', '', '')); ok(r.ok && r.status === 'pending', 'cs web tao -> pending');
let lanId = r.id; ok(ctx._tplRowToObj_(data[data.length - 1]).createdBy === 'Lan', 'nguoi tao = ten that trong token, khong theo createdBy client gui');
// 4) extension de xuat -> pending (ten tu khai)
r = save(T({ title: 'Mau tu Zalo', createdBy: 'Mai' }), C('', 'KEYZ', 'Mai')); ok(r.status === 'pending', 'extension tao -> pending'); let maiExtId = r.id;
r = save(T({ title: 'An danh' }), C('', '', '')); ok(r.status === 'pending', 'an danh (client cu khong token) tao -> pending, khong bao gio approved');
// 5) tam nhin: nhan vien chi thay DA DUYET + mau CUA MINH; admin thay het
let lan = read(C('tok_cs', '', '')).map(t => t.title); ok(lan.length === 5 && lan.includes('Chao khach') && lan.includes('Mau cua Lan') && lan.includes('Mau tu Zalo'), '21/10/2026: Lan thay mau da duyet + mau CHO DUYET cua moi nguoi: ' + lan.join('|'));
{ const mai = read(C('tok_cs2', '', '')); ok(mai.some(t => t.title === 'Mau cua Lan') && mai.some(t => t.title === 'Mau tu Zalo') && mai.filter(t => t.status === 'pending').length === 4, 'Mai THAY ca mau cho duyet cua Lan (CS xem duoc kho chua duyet cua nhau)'); }
ok(read(C('', 'KEYZ', '')).length === 5 && read(C('', 'KEYZ', 'Mai')).length === 5, 'extension (co/khong ten): thay da duyet + cho duyet cua moi nguoi');
ok(read(C('tok_admin', '', '')).length === 5 && read(C('tok_mgr', '', '')).length === 5, 'admin thay tat ca; manager (khong dac quyen) thay da duyet + cho duyet');
ok(read().length === 1 && read(C('', '', '')).length === 1, 'khong caller / an danh: CHI mau da duyet (khong thay mau cho duyet)');
// 6) nhan vien KHONG sua/xoa duoc mau da duyet; sua duoc mau cua minh chua duyet (quay lai pending)
r = save(T({ id: adminId, content: 'doi noi dung' }), C('tok_cs', '', '')); ok(r.code === 'FORBIDDEN', 'cs sua mau da duyet -> bi chan');
ok(ctx._tplRowToObj_(data[1]).content === 'Xin chao anh/chi', 'mau da duyet khong bi doi');
r = save(T({ id: lanId, content: 'Lan sua lai' }), C('tok_cs2', '', '')); ok(r.code === 'FORBIDDEN', 'Mai sua mau cua Lan -> bi chan');
r = save(T({ id: lanId, content: 'Lan sua lai' }), C('tok_cs', '', '')); ok(r.ok && r.status === 'pending', 'Lan sua mau cua minh -> van pending');
r = ctx.deleteMessageTemplate_(adminId, C('tok_cs', '', '')); ok(r.code === 'FORBIDDEN' && data.length === 6, 'cs xoa mau da duyet -> bi chan');
r = ctx.deleteMessageTemplate_(lanId, C('tok_cs2', '', '')); ok(r.code === 'FORBIDDEN', 'Mai xoa mau cua Lan -> bi chan');
r = ctx.deleteMessageTemplate_(maiExtId, C('', 'KEYZ', 'Mai')); ok(r.ok && !data.some(x => x[0] === maiExtId), 'extension xoa mau cho duyet cua chinh minh -> duoc');
r = ctx.deleteMessageTemplate_(adminId, C('', 'KEYZ', 'Admin')); ok(r.code === 'FORBIDDEN', 'extension khai ten Admin van khong xoa duoc mau da duyet');
// 7) duyet: chi admin/manager
r = ctx.approveMessageTemplate_(lanId, 'approve', '', C('tok_cs', '', '')); ok(r.code === 'FORBIDDEN', 'cs tu duyet mau cua minh -> bi chan');
r = ctx.approveMessageTemplate_(lanId, 'approve', '', C('', 'KEYZ', 'Admin')); ok(r.code === 'FORBIDDEN', 'extension khong duyet duoc');
r = ctx.approveMessageTemplate_(lanId, 'approve', '', C('tok_lead', '', '')); ok(r.code === 'FORBIDDEN', 'leader khong duyet duoc');
r = ctx.approveMessageTemplate_(lanId, 'approve', '', C('tok_mgr', '', '')); ok(r.code === 'FORBIDDEN', '4c-3: manager KHONG duyet duoc mau chuan');
r = ctx.approveMessageTemplate_(lanId, 'approve', '', C('tok_admin', '', '')); ok(r.ok && r.status === 'approved', 'admin duyet');
row = ctx._tplRowToObj_(data.find(x => x[0] === lanId)); ok(row.status === 'approved' && row.approvedBy === 'Admin' && row.rejectReason === '', 'ghi nguoi duyet');
ok(read(C('tok_cs2', '', '')).some(t => t.id === lanId), 'sau khi duyet moi nguoi deu thay va dung duoc');
// 8) tu choi kem ly do; nhan vien thay ly do, sua lai -> pending, xoa ly do
let pid = save(T({ title: 'Mau xau' }), C('tok_cs2', '', '')).id;
r = ctx.approveMessageTemplate_(pid, 'reject', 'Sai gia', C('tok_admin', '', '')); ok(r.status === 'rejected', 'admin tu choi');
let seen = read(C('tok_cs2', '', '')).find(t => t.id === pid); ok(seen && seen.status === 'rejected' && seen.rejectReason === 'Sai gia', 'chu mau thay ly do tu choi');
ok(!read(C('tok_cs', '', '')).some(t => t.id === pid), 'nguoi khac khong thay mau bi tu choi cua Mai');
r = save(T({ id: pid, title: 'Mau xau', content: 'da sua' }), C('tok_cs2', '', '')); ok(r.status === 'pending', 'sua mau bi tu choi -> gui duyet lai');
row = ctx._tplRowToObj_(data.find(x => x[0] === pid)); ok(row.status === 'pending' && row.rejectReason === '' && row.approvedBy === '', 'xoa ly do + nguoi duyet cu khi gui lai');
ok(ctx.approveMessageTemplate_(pid, 'xoa', '', C('tok_admin', '', '')).error && ctx.approveMessageTemplate_('', 'approve', '', C('tok_admin', '', '')).error && ctx.approveMessageTemplate_('khong-co', 'approve', '', C('tok_admin', '', '')).error, 'decision/id sai -> bao loi');
// 9) admin sua mau da duyet: giu nguyen trang thai; sua mau pending cua nhan vien: van pending (phai bam duyet)
r = save(T({ id: adminId, content: 'Admin sua' }), C('tok_admin', '', '')); ok(r.status === 'approved' && ctx._tplRowToObj_(data[1]).content === 'Admin sua', 'admin sua giu approved');
let p2 = save(T({ title: 'Cho' }), C('tok_cs', '', '')).id; r = save(T({ id: p2, content: 'QL chinh' }), C('tok_admin', '', '')); ok(r.status === 'pending', 'QL sua mau pending -> van pending cho duyet');
// 10) mau CU (khong co cot status) = da duyet, hien cho moi nguoi; khong mat khi admin sua
data.push(['mt_cu', 'Mau cu', 'noi dung cu', 'cu', 'Ai do', new Date(), new Date()]);
ok(read(C('tok_cs', '', '')).some(t => t.id === 'mt_cu' && t.status === 'approved'), 'mau cu coi la approved');
save({ id: 'mt_cu', title: 'Mau cu', content: 'sua', tags: 'cu' }, C('tok_admin', '', '')); row = ctx._tplRowToObj_(data.find(x => x[0] === 'mt_cu')); ok(row.status === 'approved' && row.createdBy === 'Ai do', 'admin sua mau cu: giu nguoi tao, status thanh approved ro rang');
// 11) khong chiem id: nhan vien truyen id khong ton tai -> id MOI; admin duoc dat id (dong bo cu)
r = save(T({ id: 'mt_cu_gia' }), C('tok_cs', '', '')); ok(r.id !== 'mt_cu_gia' && r.status === 'pending', 'nhan vien khong tu dat id');
r = save(T({ id: 'mt_dong_bo' }), C('tok_admin', '', '')); ok(r.id === 'mt_dong_bo', 'admin dat id duoc (dong bo)');
// 12) kiem tra dau vao
ok(save({ title: '', content: 'x' }, C('tok_admin', '', '')).error && save({ title: 'x', content: '  ' }, C('tok_admin', '', '')).error, 'thieu tieu de/noi dung -> loi');
const long = save(T({ title: 't'.repeat(500), content: 'c'.repeat(9000), product: 'p'.repeat(900) }), C('tok_admin', '', '')); row = ctx._tplRowToObj_(data.find(x => x[0] === long.id)); ok(row.title.length === 200 && row.content.length === 4000 && row.product.length === 300, 'cat do dai');
// 13) hook that su nam trong code (khong bi sua mat sau nay)
ok(/saveMessageTemplate_\(data\.template \|\| data, _tplCaller_\(data\.token, data\.ek,/.test(src) && /deleteMessageTemplate_\(data\.id, _tplCaller_\(/.test(src) && /approveMessageTemplate_\(data\.id, data\.decision, data\.reason, _tplCaller_\(/.test(src) && /readMessageTemplates_\(_tc\)/.test(src), 'dispatch phai truyen caller');
// 10) 21/10/2026 — NHOM san pham luu duoc + AI hoc tu mau DA DUYET khop san pham/nhom (chua duyet / bi tu choi KHONG vao prompt)
vm.runInContext(fn('_psheetNoAccent_') + fn('_tplPromptBlock_'), ctx);
reset();
r = save(T({ title: 'Mau Nhan', product: 'Nhẫn Vàng 9999', nhom: 'Nhẫn', topic: 'Khách hỏi giá', content: 'Dạ em chào chị ạ\nNhẫn bên em giá tốt lắm ạ' }), C('tok_admin', '', ''));
ok(r.ok && ctx._tplRowToObj_(data[1]).nhom === 'Nhẫn', 'luu duoc cot nhom san pham');
r = save(T({ title: 'Mau Lac cho duyet', product: 'Lắc tay', nhom: 'Lắc', content: 'MAU-CHUA-DUYET-LAC' }), C('tok_cs', '', ''));
let lacId = r.id;
ok(ctx._tplRowToObj_(data[2]).nhom === 'Lắc' && r.status === 'pending', 'CS luu mau kem nhom -> pending');
r = save(T({ id: lacId, title: 'Mau Lac cho duyet', product: 'Lắc tay', nhom: 'Lắc bạc', content: 'MAU-CHUA-DUYET-LAC' }), C('tok_cs', '', ''));
ok(ctx._tplRowToObj_(data[2]).nhom === 'Lắc bạc', 'sua mau cap nhat duoc nhom');
let blk = ctx._tplPromptBlock_('Khach hoi nhan vang 9999 gia bao nhieu');
ok(blk.indexOf('Nhẫn bên em giá tốt') >= 0, 'AI nhan mau DA DUYET khi yeu cau nhac ten san pham (khong dau, khong phan biet hoa thuong)');
ok(ctx._tplPromptBlock_('khach hoi lac tay').indexOf('MAU-CHUA-DUYET-LAC') < 0, 'mau CHUA DUYET khong vao prompt AI');
ok(ctx._tplPromptBlock_('khach hoi ve mon hang bat ky khong lien quan') === '' && ctx._tplPromptBlock_('') === '', 'khong khop san pham/nhom -> khong chen gi');
ok(ctx._tplPromptBlock_('khach hoi NHAN dep khong').indexOf('Nhẫn bên em') >= 0, 'khop theo NHOM san pham (nhom = Nhan) du khong nhac ten day du');
ctx.approveMessageTemplate_(lacId, 'approve', '', C('tok_admin', '', ''));
ok(ctx._tplPromptBlock_('khach hoi lac tay').indexOf('MAU-CHUA-DUYET-LAC') >= 0, 'admin duyet xong -> AI bat dau hoc mau nay');
for (let k = 0; k < 6; k++) save(T({ title: 'Nhan ' + k, product: 'Nhẫn Vàng 9999', content: 'X'.repeat(900) }), C('tok_admin', '', ''));
blk = ctx._tplPromptBlock_('nhan vang 9999');
ok((blk.match(/^Mau \d/gm) || []).length === 3 && blk.length < 2000, 'toi da 3 mau, moi mau cat 500 ky tu -> prompt khong phinh');
console.log('ALL MSGTPL TESTS PASSED');

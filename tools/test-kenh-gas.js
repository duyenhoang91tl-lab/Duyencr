#!/usr/bin/env node
// Test ĐƠN CÁC KÊNH theo giai đoạn (gas_v13.js, khối 36_CrmStage): tạo đơn, mã bộ đếm, chuyển giai đoạn + nhật ký, công việc con (check tiền), bình luận, quyền xem/sửa.
// Chạy: node tools/test-kenh-gas.js -> "ALL KENH GAS TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sheets = {};
function mkSheet() { return { rows: [], getLastRow() { return this.rows.length; }, getMaxColumns() { return 30; }, getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }, appendRow(r) { this.rows.push(r.slice()); }, setFrozenRows() {}, insertColumnsAfter() {},
  getRange(r, c, nr, nc) { const s = this; return { getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const x = s.rows[r - 1 + i] || [], row = []; for (let j = 0; j < nc; j++) row.push(x[c - 1 + j] === undefined ? '' : x[c - 1 + j]); o.push(row); } return o; },
    setValues: v => { for (let i = 0; i < v.length; i++) { s.rows[r - 1 + i] = s.rows[r - 1 + i] || []; for (let j = 0; j < v[i].length; j++) s.rows[r - 1 + i][c - 1 + j] = v[i][j]; } }, setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; } }; } }; }
const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet()) };
let tokenUser = { role: 'sale', username: 'hoa' };
const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, isFinite, encodeURIComponent, RegExp,
  Logger: { log() {} }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {}, tryLock: () => true }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, getProperties: () => ({}) }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {}, removeAll() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
  Utilities: { getUuid: () => 'x', formatDate: () => '261117120000' }, SpreadsheetApp: { openById: () => ss } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8'), ctx, { filename: 'gas_v13.js' });
ctx.SpreadsheetApp = { openById: () => ss };
ctx._sessUser_ = () => tokenUser;
const J = o => JSON.parse(o.getContent());
const rowsOf = n => (sheets[n] ? sheets[n].rows.slice(1) : []);
ctx.readUsers_ = () => [{ username: 'ketoan1', name: 'Kế toán Oanh', role: 'cs' }, { username: 'hoa', name: 'Hoa', role: 'sale' }, { username: 'admin', name: 'Admin', role: 'admin' }];
const post = (action, d) => J(ctx.kenhDoPost_(action, Object.assign({ token: 't' }, d)));
const get = (action, p) => J(ctx.kenhDoGet_(action, Object.assign({ token: 't' }, p)));
const form = { phone: '0976 881 068', kenh: 'Page HT3', saleName: 'hoa', product: 'Chị Lan 0968271278 - nhẫn bạc 2500k giảm 10% còn 2250k + 40k ship', phanLoai: 'Cọc trước', deposit: 1000000, total: 2250000, diffExchange: 0, description: 'khách gấp' };

tokenUser = { role: 'sale', username: 'hoa', name: 'Hoa' };
// 1) tạo đơn
let r = post('kenhSave', { order: form, refKey: 'K1' });
ok(r.ok && r.order.id === '100001' && r.order.stage === 'Tiếp nhận đơn' && r.order.phone === '0976881068', 'tạo đơn: id 100001, giai đoạn đầu Tiếp nhận đơn, SĐT chuẩn hoá: ' + JSON.stringify(r).slice(0, 160));
ok(/^1T\d\d\/\d{4}$/.test(r.order.maBoDem), 'mã bộ đếm dạng 1T11/2026: ' + r.order.maBoDem);
const id1 = r.order.id;
ok(post('kenhSave', { order: form, refKey: 'K1' }).duplicate === true && rowsOf('Đơn Kênh').length === 1, 'bấm Lưu 2 lần (cùng refKey) không tạo đơn thứ 2');
r = post('kenhSave', { order: form, refKey: 'K2' }); ok(r.order.id === '100002' && /^2T/.test(r.order.maBoDem), 'đơn thứ 2: id 100002, mã bộ đếm 2T…');
ok(rowsOf('Đơn Kênh GĐ').length === 2 && rowsOf('Đơn Kênh BL').length === 2, 'mỗi đơn mới có 1 dòng nhật ký giai đoạn + 1 dòng hệ thống "đã tạo đơn"');
// 2) kiểm tra form
const bad = (patch, re, m) => { const x = post('kenhSave', { order: Object.assign({}, form, patch) }); ok(!x.ok && re.test(x.error), m + ': ' + (x.error || 'KHÔNG LỖI')); };
bad({ phone: '' }, /so dien thoai/, 'thiếu SĐT'); bad({ kenh: '' }, /Kenh ban/, 'thiếu kênh'); bad({ saleName: '' }, /Sale ban/, 'thiếu sale'); bad({ product: ' ' }, /San pham/, 'thiếu sản phẩm');
bad({ phanLoai: 'Trả góp' }, /Phan loai/, 'phân loại lạ'); bad({ total: -5 }, /khong duoc am/, 'tổng âm'); bad({ deposit: 3000000 }, /lon hon/, 'cọc lớn hơn tổng (không phải thanh toán toàn bộ)');
ok(post('kenhSave', { order: Object.assign({}, form, { phanLoai: 'Thanh toán toàn bộ', deposit: 2290000 }) }).ok, 'Thanh toán toàn bộ cho phép tiền CK = tổng + ship (lớn hơn tổng ko ship)');
// 3) bảng
let b = get('kenhBoard', {});
ok(b.ok && b.stages.length === 8 && b.stages[0] === 'Tiếp nhận đơn' && b.stages[6] === 'Hoàn thành' && b.stages[7] === 'Thất bại', 'bảng có đủ 8 giai đoạn đúng thứ tự Base');
ok(b.orders.length === 3 && b.stageCount['Tiếp nhận đơn'] === 3 && b.channels.some(c => c.name === 'Page HT3' && c.count === 3), 'bảng: 3 đơn, kênh Page HT3 đếm 3');
ok(get('kenhBoard', { kenh: 'Zalo' }).orders.length === 0 && get('kenhBoard', { q: '0968271278' }).orders.length === 3 && get('kenhBoard', { q: '0111' }).orders.length === 0, 'lọc kênh + tìm theo chữ trong sản phẩm');
// 4) chuyển giai đoạn + nhật ký + lý do thất bại
r = post('kenhMove', { id: id1, stage: 'Tạo đơn POS' }); ok(r.ok && r.order.stage === 'Tạo đơn POS', 'chuyển Tiếp nhận → Tạo đơn POS');
let lg = rowsOf('Đơn Kênh GĐ').filter(x => String(x[0]) === id1);
ok(lg.length === 2 && lg[0][3] !== '' && lg[1][3] === '', 'nhật ký: giai đoạn cũ có giờ ra, giai đoạn mới đang mở');
ok(!post('kenhMove', { id: id1, stage: 'Bay màu' }).ok, 'giai đoạn lạ bị từ chối');
ok(/ly do/.test(post('kenhMove', { id: id1, stage: 'Thất bại', note: ' ' }).error), 'Thất bại bắt buộc lý do');
ok(post('kenhMove', { id: id1, stage: 'Tạo đơn POS' }).unchanged === true, 'chuyển vào đúng giai đoạn đang đứng = không đổi gì');
r = post('kenhMove', { id: id1, stage: 'Thất bại', note: 'khách huỷ' }); ok(r.ok && r.order.failReason === 'khách huỷ', 'Thất bại kèm lý do');
ok(/chi admin/.test(post('kenhMove', { id: id1, stage: 'Tiếp nhận đơn' }).error), 'đơn đã ở giai đoạn cuối: Sale thường không mở lại được');
tokenUser = { role: 'admin', username: 'admin', name: 'Admin' };
ok(post('kenhMove', { id: id1, stage: 'Tiếp nhận đơn' }).ok, 'admin mở lại được đơn Thất bại');
ok(get('kenhOrder', { id: id1 }).order.failReason === '', 'mở lại thì xoá lý do thất bại cũ');
// 5) công việc con: giao Kế toán check tiền
tokenUser = { role: 'sale', username: 'hoa', name: 'Hoa' };
r = post('kenhTaskSave', { id: id1, task: { title: 'Check tiền', assignee: 'ketoan1', dept: 'Kế toán' } });
ok(r.ok && r.task.assigneeName === 'Kế toán Oanh' && r.task.status === 'open', 'tạo việc "Check tiền" giao Kế toán: ' + JSON.stringify(r).slice(0, 120));
const tid = r.task.id;
ok(!post('kenhTaskSave', { id: id1, task: { title: 'x', assignee: 'khongco' } }).ok && !post('kenhTaskSave', { id: id1, task: { title: ' ' } }).ok, 'người được giao không tồn tại / thiếu tên việc bị từ chối');
b = get('kenhBoard', {}); ok(b.orders.find(o => o.id === id1).taskOpen === 1 && b.orders.find(o => o.id === id1).taskTotal === 1, 'thẻ đơn báo 1 việc chưa xong');
// Kế toán (không phải Sale/người tạo) thấy được đơn nhờ được giao việc, và đánh dấu xong được
tokenUser = { role: 'cs', username: 'ketoan1', name: 'Kế toán Oanh' };
b = get('kenhBoard', {}); ok(b.orders.length === 1 && b.orders[0].id === id1, 'Kế toán chỉ thấy đúng đơn được giao việc (1/3 đơn)');
ok(get('kenhOrder', { id: '100002' }).code === 'FORBIDDEN', 'Kế toán xem đơn không liên quan → bị chặn');
ok(post('kenhMove', { id: id1, stage: 'Tạo đơn POS' }).ok, 'người đang có việc chưa xong trong đơn được chuyển giai đoạn');
r = post('kenhTaskDone', { taskId: tid, done: true, note: 'đã nhận đủ 1tr' }); ok(r.ok && r.task.status === 'done' && r.task.doneBy === 'ketoan1' && r.task.doneNote === 'đã nhận đủ 1tr', 'Kế toán đánh dấu xong việc check tiền kèm ghi chú');
ok(get('kenhBoard', {}).orders[0].taskOpen === 0, 'thẻ đơn hết việc chưa xong');
ok(!post('kenhUpdate', { id: id1, patch: { total: 1 } }).ok, 'Kế toán hết việc chưa xong → không còn quyền sửa đơn');
tokenUser = { role: 'sale', username: 'linh', name: 'Linh' };
ok(post('kenhTaskDone', { taskId: tid, done: false }).code === 'FORBIDDEN' && post('kenhMove', { id: id1, stage: 'Phân loại đơn' }).code === 'FORBIDDEN', 'người ngoài đơn không xem/đổi được');
// 6) bình luận + sửa + theo dõi
tokenUser = { role: 'sale', username: 'hoa', name: 'Hoa' };
r = post('kenhComment', { id: id1, text: 'Xuất tp', attach: [{ name: 'a.jpg', url: 'https://x/a.jpg' }] }); ok(r.ok && r.comment.kind === 'user' && r.comment.attach.length === 1, 'bình luận kèm ảnh');
ok(!post('kenhComment', { id: id1, text: '  ' }).ok, 'bình luận rỗng bị từ chối');
let d = get('kenhOrder', { id: id1 }); ok(d.comments.length >= 4 && d.comments[0].kind === 'sys' && d.comments[d.comments.length - 1].text === 'Xuất tp' && d.tasks.length === 1 && d.log.length >= 3 && d.canEdit === true, 'chi tiết: bình luận theo thứ tự thời gian (dòng hệ thống + người dùng), có việc, có nhật ký');
r = post('kenhUpdate', { id: id1, patch: { total: 2300000, deposit: 1100000 } }); ok(r.ok && r.order.total === 2300000 && r.order.deposit === 1100000, 'sửa tổng/cọc');
ok(!post('kenhUpdate', { id: id1, patch: { deposit: 9999999 } }).ok, 'sửa cọc vượt tổng bị chặn');
ok(post('kenhUpdate', { id: id1, patch: { stage: 'Hoàn thành', createdBy: 'x', id: '1' } }).ok && get('kenhOrder', { id: id1 }).order.stage !== 'Hoàn thành' && get('kenhOrder', { id: id1 }).order.createdBy === 'hoa', 'patch không đổi được giai đoạn/người tạo/mã');
ok(post('kenhFollow', { id: id1, followers: ['linh', 'ketoan1'] }).ok, 'đặt người theo dõi');
tokenUser = { role: 'sale', username: 'linh', name: 'Linh' };
ok(get('kenhOrder', { id: id1 }).ok && get('kenhOrder', { id: id1 }).canEdit === false, 'người theo dõi xem được nhưng không sửa được');
ok(get('kenhBoard', {}).orders.length === 1, 'người theo dõi thấy đúng đơn theo dõi');
// 7) admin thấy tất cả, danh sách kênh lấy từ Settings + đơn
tokenUser = { role: 'admin', username: 'admin', name: 'Admin' };
ok(get('kenhBoard', {}).orders.length === 3, 'admin thấy cả 3 đơn');
console.log('ALL KENH GAS TESTS PASSED');

#!/usr/bin/env node
// (mẫu từ test-kpi-commit-sheet) Test + action (gas_v13.js, mục 8 bước 8b-2): ghi sheet KpiCommit (1 dòng/kỳ/sale), phân quyền xem/gửi/duyệt, AuditLog, route doGet/doPost.
// Chạy: node tools/test-kpi-commit-sheet.js -> "ALL KPI COMMIT SHEET TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sheets = {};
function mkSheet() { return { rows: [], getLastRow() { return this.rows.length; }, getMaxColumns() { return 30; }, getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }, appendRow(r) { this.rows.push(r.slice()); }, setFrozenRows() {}, insertColumnsAfter() {},
  getRange(r, c, nr, nc) { const s = this; return { getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const x = s.rows[r - 1 + i] || [], row = []; for (let j = 0; j < nc; j++) row.push(x[c - 1 + j] === undefined ? '' : x[c - 1 + j]); o.push(row); } return o; },
    setValues: v => { for (let i = 0; i < v.length; i++) { s.rows[r - 1 + i] = s.rows[r - 1 + i] || []; for (let j = 0; j < v[i].length; j++) s.rows[r - 1 + i][c - 1 + j] = v[i][j]; } }, setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; } }; } }; }
const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet()) };
const USERS = { s1: { role: 'sale', username: 'hoa', name: 'Hoa Nguyễn', names: ['Hoa Nguyễn', 'Hoa NV'] }, s2: { role: 'sale', username: 'lan', name: 'Lan Phạm', names: [] },
  ld: { role: 'leader', username: 'tn', name: 'Trưởng Nhóm', names: [] }, ad: { role: 'admin', username: 'duyen', name: 'Duyên', names: [] } };
const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, isFinite, encodeURIComponent, RegExp,
  Logger: { log() {} }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {}, tryLock: () => true }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, getProperties: () => ({}) }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {}, removeAll() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
  Utilities: { getUuid: () => 'x', formatDate: () => '261117120000' }, SpreadsheetApp: { openById: () => ss } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8'), ctx, { filename: 'gas_v13.js' });
ctx.SpreadsheetApp = { openById: () => ss };
ctx._sessUser_ = t => USERS[t] || null;
ctx.getSetting_ = () => '';
ctx.SpreadsheetApp = { openById: () => ss };
ctx._sessUser_ = t => USERS[t] || null;
let CFG = '';
ctx.getSetting_ = k => (k === 'ticketConfig' ? CFG : '');
const J = o => JSON.parse(o.getContent());
const save = (tok, b) => J(ctx.ticketDoPost_('ticketSave', Object.assign({ token: tok, type: 'khieu_nai', title: 'Khách khiếu nại dây đứt', phone: '0966 238 929' }, b)));
const done = (tok, id, note) => J(ctx.ticketDoPost_('ticketDone', { token: tok, id, note }));
const list = (tok, p) => J(ctx.ticketDoGet_('ticketList', Object.assign({ token: tok }, p || {})));
// 1) tạo: chưa cấu hình owners → giao cho chính người tạo, hạn 24h, SĐT chuẩn hoá
let r = save('s1'); ok(r.ok && r.ticket.assignee === 'Hoa Nguyễn' && r.ticket.phone === '0966238929' && r.ticket.sla.state === 'open', 'tạo ticket: ' + JSON.stringify(r));
ok(Math.abs((r.ticket.dueAt - r.ticket.createdAt) - 24 * 3600000) < 1000, 'hạn khiếu nại = 24h');
const id1 = r.ticket.id; ok(sheets.Ticket.rows.length === 2, 'ghi 1 dòng sheet');
ok(save('s1', { type: 'la' }).code === 'TYPE' && save('s1', { title: '  ' }).code === 'TITLE', 'loại lạ / thiếu tiêu đề');
ok(J(ctx.ticketDoPost_('ticketSave', { token: 'x', type: 'ho_tro', title: 'a' })).code === 'AUTH' && J(ctx.ticketDoGet_('ticketList', { token: 'x' })).code === 'AUTH', 'chưa đăng nhập');
// 2) phân quyền xem
save('s2', { type: 'doi_tra', title: 'Đổi size nhẫn' });
ok(list('s1').rows.length === 1 && list('s2').rows.length === 1 && list('ld').rows.length === 2 && list('ad').rows.length === 2, 'sale chỉ thấy của mình, quản lý thấy hết');
ok(list('ad', { status: 'done' }).rows.length === 0 && list('ad', { phone: '0966238929' }).rows.length === 2 && list('ad', { phone: '0900000000' }).rows.length === 0, 'lọc status / phone');
// 3) cấu hình owners → giao cho owners[0], sale KHÔNG tự chọn người giao, quản lý được chọn
CFG = JSON.stringify({ owners: { bao_hanh: ['Kho Bảo Hành', 'Trưởng phòng CSKH'] } });
r = save('s1', { type: 'bao_hanh', title: 'Bảo hành lắc', assignee: 'Lan Phạm' }); ok(r.ticket.assignee === 'Kho Bảo Hành', 'giao theo owners[0], sale không tự chọn: ' + r.ticket.assignee);
r = save('ld', { type: 'bao_hanh', title: 'BH 2', assignee: 'Lan Phạm' }); ok(r.ticket.assignee === 'Lan Phạm', 'quản lý chọn người giao');
ok(list('s2').rows.some(t => t.title === 'BH 2'), 'người được giao thấy ticket');
// 4) trễ → báo trưởng phòng (escalateTo)
const sh = sheets.Ticket; sh.rows[1][10] = Date.now() - 3 * 3600000; // quá hạn 3h
let l = list('s1'); const late = l.rows.find(t => t.id === id1);
ok(late.sla.state === 'overdue' && late.sla.overdueMinutes >= 179 && l.overdue >= 1, 'quá hạn: ' + JSON.stringify(late.sla));
CFG = JSON.stringify({ owners: { khieu_nai: ['Trưởng phòng CSKH'] } }); ok(list('s1').rows.find(t => t.id === id1).escalateTo[0] === 'Trưởng phòng CSKH', 'trễ → escalateTo');
// 5) đóng: không phải người liên quan → cấm; người tạo/giao/quản lý → được; đóng 2 lần → báo
ok(done('s2', id1).code === 'FORBIDDEN', 'sale lạ không đóng được');
r = done('s1', id1, 'đã đổi dây'); ok(r.ok && r.ticket.status === 'done' && r.ticket.sla.state === 'done_late' && r.ticket.doneNote === 'đã đổi dây', 'đóng trễ: ' + JSON.stringify(r));
ok(done('ad', id1).code === 'DONE' && done('ad', 'TKnope').code === 'NOTFOUND', 'đóng lại / không có');
ok(sheets.Ticket.rows.length === 5 && sheets.Ticket.rows[1][2] === 'done', 'đóng ghi ĐÈ cùng dòng, không thêm dòng');
ok(list('s1').rows[list('s1').rows.length - 1].status === 'done', 'ticket đã đóng xếp cuối');
ok(sheets.AuditLog.rows.some(x => x[2] === 'ticket:create') && sheets.AuditLog.rows.some(x => x[2] === 'ticket:done' && /tre/.test(x[5])), 'AuditLog tạo/đóng (ghi chú trễ)');
// 6) route
ok(J(ctx.doGet({ parameter: { action: 'ticketList', token: 'ad' } })).ok === true, 'doGet route ticketList');
ok(J(ctx.doPost({ postData: { contents: JSON.stringify({ action: 'ticketSave', token: 'ad', type: 'ho_tro', title: 'x' }) } })).ok === true, 'doPost route ticketSave');
console.log('ALL TICKET SHEET TESTS PASSED');

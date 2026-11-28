#!/usr/bin/env node
// Test SỔ CAM KẾT KPI + action (gas_v13.js, mục 8 bước 8b-2): ghi sheet KpiCommit (1 dòng/kỳ/sale), phân quyền xem/gửi/duyệt, AuditLog, route doGet/doPost.
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
ctx.readSaleKpiConfig_ = () => ({ overrides: { 'Lan Phạm': 200000000 } });
const J = o => JSON.parse(o.getContent());
const vnNow = new Date(Date.now() + 7 * 3600000), P = vnNow.getUTCFullYear() + '-' + String(vnNow.getUTCMonth() + 1).padStart(2, '0');
const sub = (tok, b) => J(ctx.kpiCommitDoPost_('kpiCommitSubmit', Object.assign({ token: tok, period: P, amount: 300000000 }, b)));
const dec = (tok, b) => J(ctx.kpiCommitDoPost_('kpiCommitDecide', Object.assign({ token: tok, period: P, sale: 'Hoa Nguyễn', decision: 'approve' }, b)));
const list = (tok, p) => J(ctx.kpiCommitDoGet_('kpiCommitList', { token: tok, period: p || P }));
const rows = () => (sheets.KpiCommit ? sheets.KpiCommit.rows.slice(1) : []);
const audit = () => (sheets.AuditLog ? sheets.AuditLog.rows.slice(1) : []);
// 1) sale tự gửi cho mình → pending, 1 dòng trong sheet, có AuditLog
let r = sub('s1', {}); ok(r.ok && r.rec.status === 'pending' && r.rec.sale === 'Hoa Nguyễn' && r.rec.amount === 300000000, 'sale gửi: ' + JSON.stringify(r));
ok(rows().length === 1 && rows()[0][0] === P + '|hoa nguyen' && rows()[0][5] === 'pending' && rows()[0][3] === 300000000, 'ghi sheet đúng key/trạng thái: ' + JSON.stringify(rows()[0]));
ok(audit().some(x => x[2] === 'kpi-commit:submit' && x[1] === 'Hoa Nguyễn' && String(x[3]).includes('Hoa Nguyễn') && String(x[4]).includes('chua co') && String(x[5]).includes('300000000d/pending')), 'AuditLog submit: ' + JSON.stringify(audit()));
// 2) sửa → vẫn 1 dòng (ghi đè), history nối thêm cũ → mới
r = sub('s1', { amount: 350000000 }); ok(r.ok && rows().length === 1 && JSON.parse(rows()[0][10]).length === 2 && JSON.parse(rows()[0][10])[1].old.amount === 300000000, 'sửa ghi đè cùng dòng + history: ' + rows()[0][10]);
ok(sub('s1', { amount: 350000000 }).code === 'NOCHANGE', 'không đổi → báo');
// 3) phân quyền gửi
ok(sub('s1', { sale: 'Lan Phạm' }).code === 'FORBIDDEN', 'sale không gửi hộ người khác');
ok(sub('s1', { period: '2020-01' }).code === 'PERIOD', 'tháng cũ bị chặn với sale');
ok(sub('s1', { amount: 'abc' }).ok === false, 'số tiền sai');
ok(J(ctx.kpiCommitDoPost_('kpiCommitSubmit', { token: 'x', period: P, amount: 1 })).code === 'AUTH' && J(ctx.kpiCommitDoGet_('kpiCommitList', { token: 'x' })).code === 'AUTH', 'chưa đăng nhập');
// 4) tên phụ của cùng tài khoản được coi là "chính mình"
r = sub('s1', { sale: 'Hoa NV', amount: 120000000 }); ok(r.ok && r.rec.sale === 'Hoa NV' && rows().length === 2, 'gửi bằng tên phụ của chính mình');
// 5) xem: sale chỉ thấy của mình; leader thấy tất cả + canApprove + đếm chờ duyệt
r = sub('s2', { amount: 250000000 }); ok(r.ok, 'lan gửi');
let l = list('s1'); ok(l.ok && !l.canApprove && l.rows.length === 2 && l.rows.every(x => x.sale.startsWith('Hoa')), 'sale chỉ thấy cam kết của mình: ' + JSON.stringify(l.rows.map(x => x.sale)));
l = list('s2'); ok(l.rows.length === 1 && l.rows[0].sale === 'Lan Phạm' && l.rows[0].effective.source === 'override' && l.rows[0].effective.commit === 200000000 && l.rows[0].effective.pendingAmount === 250000000, 'lan: cam kết chờ duyệt chưa có hiệu lực, vẫn dùng commit riêng 200tr: ' + JSON.stringify(l.rows[0]));
l = list('ld'); ok(l.canApprove && l.rows.length === 3 && l.pending === 3 && l.requireApproval === true, 'leader thấy cả 3, 3 chờ duyệt');
ok(list('s1', '2030-01').rows.length === 0, 'kỳ khác không có dữ liệu');
// 6) duyệt: sale không được; leader được; tự duyệt chính mình bị chặn; ghi AuditLog; không thêm dòng
ok(dec('s1', {}).code === 'FORBIDDEN', 'sale không duyệt được');
ok(dec('ld', { sale: 'Không Có' }).code === 'NOTPENDING', 'không có bản chờ duyệt');
r = dec('ld', {}); ok(r.ok && r.rec.status === 'approved' && r.rec.approvedAmount === 350000000 && rows().length === 3, 'leader duyệt: approvedAmount = 350tr, không thêm dòng');
ok(audit().some(x => x[2] === 'kpi-commit:approve' && x[1] === 'Trưởng Nhóm' && String(x[5]).includes('approved')), 'AuditLog duyệt');
ok(dec('ld', {}).code === 'NOTPENDING', 'duyệt lần 2 → không còn chờ');
l = list('s1'); ok(l.rows.find(x => x.sale === 'Hoa Nguyễn').effective.commit === 350000000 && l.rows.find(x => x.sale === 'Hoa Nguyễn').effective.source === 'commitment', 'sau duyệt: hiệu lực = cam kết 350tr');
r = dec('ld', { sale: 'Lan Phạm', decision: 'reject', note: 'Thấp quá' }); ok(r.ok && r.rec.status === 'rejected' && JSON.parse(rows().find(x => x[2] === 'Lan Phạm')[10]).slice(-1)[0].note === 'Thấp quá', 'từ chối kèm lý do');
ok(sub('ld', { sale: 'Trưởng Nhóm', amount: 500000000 }).ok && dec('ld', { sale: 'Trưởng Nhóm' }).code === 'SELF', 'leader gửi cho mình rồi tự duyệt → bị chặn');
// 7) admin nhập hộ → hiệu lực ngay (set)
r = sub('ad', { sale: 'Lan Phạm', amount: 400000000 }); ok(r.ok && r.rec.status === 'approved' && r.rec.approvedAmount === 400000000 && r.rec.history.slice(-1)[0].action === 'set', 'admin nhập hộ → approved ngay');
r = sub('ad', { sale: 'Lan Phạm', amount: 410000000, period: '2020-01' }); ok(r.ok, 'admin sửa được tháng cũ');
// 8) route doGet / doPost
const g = J(ctx.doGet({ parameter: { action: 'kpiCommitList', token: 'ld', period: P } })); ok(g.ok && g.rows.length >= 3, 'doGet có route kpiCommitList');
const p = J(ctx.doPost({ postData: { contents: JSON.stringify({ action: 'kpiCommitSubmit', token: 's2', period: P, amount: 260000000 }) } })); ok(p.ok === true && p.rec.amount === 260000000, 'doPost có route kpiCommitSubmit: ' + JSON.stringify(p));
console.log('ALL KPI COMMIT SHEET TESTS PASSED');

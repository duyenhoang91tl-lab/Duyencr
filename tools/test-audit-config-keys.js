#!/usr/bin/env node
// BƯỚC 3 (mục 11 hạng mục CRM, quy tắc chung "nhật ký đổi cấu hình"): MỌI cấu hình hạng/KPI/điểm/hoa hồng/thưởng đổi qua
// setSetting_ phải để lại dòng AuditLog (giờ, người đổi theo token, giá trị cũ → mới). Khoá nhạy cảm chỉ ghi "đã đổi".
// Chạy: node tools/test-audit-config-keys.js -> "ALL AUDIT CONFIG KEY TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sheets = {};
function mkSheet() { return { rows: [], getLastRow() { return this.rows.length; }, getMaxColumns() { return 30; }, getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }, appendRow(r) { this.rows.push(r.slice()); }, setFrozenRows() {}, insertColumnsAfter() {},
  getRange(r, c, nr, nc) { const s = this; return { getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const x = s.rows[r - 1 + i] || [], row = []; for (let j = 0; j < nc; j++) row.push(x[c - 1 + j] === undefined ? '' : x[c - 1 + j]); o.push(row); } return o; },
    getValue: () => { const x = s.rows[r - 1] || []; return x[c - 1] === undefined ? '' : x[c - 1]; }, setValue: v => { s.rows[r - 1] = s.rows[r - 1] || []; s.rows[r - 1][c - 1] = v; },
    setValues: v => { for (let i = 0; i < v.length; i++) { s.rows[r - 1 + i] = s.rows[r - 1 + i] || []; for (let j = 0; j < v[i].length; j++) s.rows[r - 1 + i][c - 1 + j] = v[i][j]; } }, setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; },
    createTextFinder: k => ({ matchEntireCell() { return this; }, findNext: () => { for (let i = 1; i < s.rows.length; i++) if (String(s.rows[i][0]) === String(k)) return { getRow: () => i + 1 }; return null; } }) }; } }; }
const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet()) };
const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, isFinite, encodeURIComponent, RegExp,
  Logger: { log() {} }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {}, tryLock: () => true }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, getProperties: () => ({}) }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {}, removeAll() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
  Utilities: { getUuid: () => 'x', formatDate: () => '261117120000' }, SpreadsheetApp: { openById: () => ss } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8'), ctx, { filename: 'gas_v13.js' });
ctx.SpreadsheetApp = { openById: () => ss };
ctx._sessVerify_ = () => ({ u: 'duyen' });
ctx._AUDIT_TOKEN_ = 'tok';
const audit = () => (sheets.AuditLog ? sheets.AuditLog.rows.slice(1) : []);
const run = (k, v) => vm.runInContext('setSetting_(' + JSON.stringify(k) + ',' + JSON.stringify(v) + ')', ctx);
// các khoá cấu hình thuộc mục 7 (hoa hồng/thưởng), 8 (KPI), 9 (hạng/điểm)
const KEYS = ['tierConfig', 'saleKpiConfig', 'loyaltyConfig', 'individualRates', 'channelCommissionRates', 'bonusPrograms', 'closeRateThresholds', 'saleChannels', 'goldUnitAmount'];
KEYS.forEach(k => {
  const n0 = audit().length; run(k, '{"v":1}'); run(k, '{"v":2}');
  const rows = audit().slice(n0).filter(r => r[2] === 'config:setting:' + k);
  ok(rows.length === 2, k + ': 2 lần đổi phải có 2 dòng nhật ký, có ' + rows.length);
  ok(rows[0][1] === 'duyen' && rows[0][4] === '' && rows[0][5] === '{"v":1}', k + ': lần đầu cũ rỗng → mới');
  ok(rows[1][4] === '{"v":1}' && rows[1][5] === '{"v":2}', k + ': lần 2 ghi đúng cũ → mới');
  ok(/^\d{4}-\d{2}-\d{2}T/.test(String(rows[0][0])), k + ': có thời điểm');
});
// ghi lại đúng giá trị cũ → KHÔNG tạo dòng thừa
let n = audit().length; run('tierConfig', '{"v":2}'); ok(audit().length === n, 'giá trị không đổi → không ghi nhật ký');
// khoá nhạy cảm: chỉ báo "đã đổi", KHÔNG lộ giá trị
run('geminiKey', 'SECRET-ABC'); const sens = audit().filter(r => r[2] === 'config:setting:geminiKey');
ok(sens.length === 1 && !JSON.stringify(sens).includes('SECRET-ABC') && String(sens[0][5]).includes('ẩn giá trị'), 'khoá nhạy cảm không lộ giá trị');
// khoá máy tự cập nhật không làm đầy nhật ký
n = audit().length; run('ttLastTrackedMs', '123'); ok(audit().length === n, 'khoá máy tự cập nhật không ghi nhật ký');
// token hết hạn / thiếu → vẫn ghi, người = nhãn rõ ràng (không mất dấu vết)
ctx._sessVerify_ = () => null; run('loyaltyConfig', '{"v":3}');
ok(audit().filter(r => r[2] === 'config:setting:loyaltyConfig').pop()[1] === '(token hết hạn)', 'token hết hạn vẫn ghi, người = (token hết hạn)');
console.log('ALL AUDIT CONFIG KEY TESTS PASSED');

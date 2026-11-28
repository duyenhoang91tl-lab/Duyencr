#!/usr/bin/env node
// Test action `ping` của GAS: phải trả lời NGAY mà KHÔNG chạm SpreadsheetApp / PropertiesService (để đo độ trễ thuần của Apps Script).
// Chạy: node tools/test-gas-ping.js -> "ALL GAS-PING TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
let touched = [];
const boom = n => new Proxy({}, { get: (_, k) => { touched.push(n + '.' + String(k)); throw new Error(n + ' bị chạm'); } });
const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, isFinite, encodeURIComponent, Logger: { log() {} },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
  SpreadsheetApp: boom('SpreadsheetApp'), PropertiesService: boom('PropertiesService'), CacheService: boom('CacheService'), DriveApp: boom('DriveApp'), UrlFetchApp: boom('UrlFetchApp'), LockService: boom('LockService') };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8'), ctx, { filename: 'gas_v13.js' });
const r = JSON.parse(ctx.doGet({ parameter: { action: 'ping' } }).getContent());
ok(r.ok === true && typeof r.ver === 'string' && r.ver.length > 3 && typeof r.t === 'number', 'ping trả {ok,ver,t}: ' + JSON.stringify(r));
ok(touched.length === 0, 'ping KHÔNG được chạm dịch vụ Google nào: ' + touched.join(','));
ok(JSON.parse(ctx.doGet({ parameter: { action: 'ping', token: 'x' } }).getContent()).ok === true, 'ping có token vẫn trả ngay (không kiểm token)');
console.log('ALL GAS-PING TESTS PASSED');

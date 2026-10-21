#!/usr/bin/env node
// Test Node cho bizRules (quy tac tinh doanh thu/hoa hong cau hinh duoc). Chay: node tools/test-biz-rules.js -> "BIZ RULES TESTS PASSED".
// Nap NGUYEN gas_v13.js, chi thay getSetting_ bang gia tri gia. Kiem: (1) chua cai gi => y het hanh vi cu; (2) cai moi => doi dung cho.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
function withSetting(val) { // dat bizRules gia + xoa memo (moi request GAS la 1 lan chay moi)
  ctx.__V__ = val; vm.runInContext("getSetting_ = function(k){ return k === 'bizRules' ? __V__ : null; }; _BIZ_RULES_MEMO_ = null;", ctx);
}
const run = e => vm.runInContext(e, ctx);

// (1) CHUA CAI GI => hanh vi cu
withSetting(null);
ok(run("_bizRules_().commissionThreshold") === 15000000, 'mac dinh nguong 15tr');
ok(run("_donHasExcludedStatus_('Hủy đơn') && _donHasExcludedStatus_('Hoàn đơn') && _donHasExcludedStatus_('Đã hoàn') && _donHasExcludedStatus_('Đang hoàn')"), 'Pos mac dinh loai 4 trang thai');
ok(run("!_donHasExcludedStatus_('Hoàn thành') && !_donHasExcludedStatus_('') && !_donHasExcludedStatus_('Đã giao')"), 'Pos mac dinh khong loai trang thai khac');
ok(run("_isExcludedOrderStatus_('Thất bại') && _isExcludedOrderStatus_(' THẤT  BẠI ')"), 'Base mac dinh loai Thất bại');
ok(run("!_isExcludedOrderStatus_('Hủy đơn') && !_isExcludedOrderStatus_('Đã giao')"), 'Base mac dinh KHONG loai Huy don (khac Pos)');
ok(run("_quaySaleRatio_('Quầy Hào Nam','',true) === 0.3 && _quaySaleRatio_('Cửa hàng 2','',true) === 0.3"), 'quay mac dinh 30%');
ok(run("_quaySaleRatio_('Facebook','',true) === 1 && _quaySaleRatio_('Quầy Hào Nam','',false) === 1"), 'nguon khac / khong the sale => 1');
// JSON hong => van mac dinh, khong nem loi
withSetting('{khong phai json'); ok(run("_bizRules_().commissionThreshold") === 15000000, 'JSON hong => mac dinh');
withSetting('{"commissionThreshold":-5,"quayRatio":7,"posExcludedStatuses":"abc"}');
ok(run("_bizRules_().commissionThreshold") === 15000000 && run("_bizRules_().quayRatio") === 0.3 && run("_bizRules_().posExcludedStatuses.length") === 4, 'gia tri sai kieu/ngoai khoang => mac dinh');

// (2) CAI MOI => doi dung cho
withSetting(JSON.stringify({ commissionThreshold: 20000000, posExcludedStatuses: ['Đã hủy', 'Trả hàng'], baseExcludedStatuses: [], quayRatio: 0.4, quayKeywords: ['Showroom'] }));
ok(run("_bizRules_().commissionThreshold") === 20000000, 'nguong moi 20tr');
ok(run("_donHasExcludedStatus_('Đã hủy') && _donHasExcludedStatus_('trả hàng')"), 'Pos loai trang thai moi (khong dau/hoa-thuong)');
ok(run("!_donHasExcludedStatus_('Hủy đơn')"), 'Pos KHONG con loai Hủy đơn khi admin bo di');
ok(run("!_isExcludedOrderStatus_('Thất bại')"), 'Base: danh sach rong = khong loai trang thai nao');
ok(run("_quaySaleRatio_('Showroom Hà Nội','',true) === 0.4 && _quaySaleRatio_('Quầy Hào Nam','',true) === 1"), 'quay: tu khoa + ty le moi');

// (3) Chot chan quyen ghi bizRules: chi admin co token phien
vm.runInContext("_sessUser_ = function(t){ return ({ A: { role: 'admin' }, C: { role: 'cs' }, L: { role: 'leader' } })[t] || null; };", ctx);
ok(run("_bizRulesWriteDenied_('A')") === null, 'admin co token => duoc ghi');
ok(run("_bizRulesWriteDenied_('C').code") === 'FORBIDDEN' && run("_bizRulesWriteDenied_('L').code") === 'FORBIDDEN', 'cs / leader => tu choi');
ok(run("_bizRulesWriteDenied_('').code") === 'FORBIDDEN' && run("_bizRulesWriteDenied_('hong').code") === 'FORBIDDEN', 'khong token / token sai => tu choi');
console.log('BIZ RULES TESTS PASSED');

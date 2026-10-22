#!/usr/bin/env node
// Test Node cho "Từ cấm cấu hình được" (Settings 'bannedWordsCfg'). Chạy: node tools/test-banned-cfg.js -> "BANNED CFG TESTS PASSED".
// Nạp NGUYÊN gas_v13.js, thay getSetting_ + đọc sheet bằng giả. Kiểm: (1) chưa cài => y như cũ; (2) thêm/ghi đè/tắt sheet; (3) JSON hỏng; (4) chỉ admin ghi; (5) xóa cache.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const removed = [];
const ctx = { SpreadsheetApp: svc(), CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove: k => removed.push(k) }) }, PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
const run = e => vm.runInContext(e, ctx);
// Sheet giả: 2 dòng "Tài lộc"→"Thuận lợi", "May mắn"→""; mỗi hàm đọc sheet trả bản giả (không mở Google Sheet thật)
vm.runInContext("readBannedWordsSheet_ = function(){ return [{tuCam:'Tài lộc',thayThe:'Thuận lợi'},{tuCam:'May mắn',thayThe:''}]; };" +
  "readBannedWordsListSheet_ = function(){ return [{words:['tài lộc','may mắn'],allowed:'Thuận lợi'}]; };", ctx);
function withSetting(val) { ctx.__V__ = val; vm.runInContext("getSetting_ = function(k){ return k === 'bannedWordsCfg' ? __V__ : null; };", ctx); }
const words = () => run('readBannedWords_()').map(x => x.tuCam);

// (1) CHƯA CÀI => y như cũ (chỉ sheet)
withSetting(null);
ok(JSON.stringify(words()) === JSON.stringify(['Tài lộc', 'May mắn']), 'chua cai => chi co tu cua sheet');
ok(run('readBannedWordsList_()').length === 1, 'chua cai => danh sach AI chi co dong cua sheet');
ok(run('_bannedCfg_().useSheet') === true, 'mac dinh useSheet=true');

// (2) THÊM từ mới + GHI ĐÈ từ trùng sheet (không phân biệt hoa/thường/dấu)
withSetting(JSON.stringify({ items: [{ tuCam: 'Bảo hành trọn đời', thayThe: 'bảo hành theo chính sách' }, { tuCam: 'TAI LOC', thayThe: 'thuận lợi công việc' }] }));
let L = run('readBannedWords_()');
ok(L.length === 3, 'them 1 + ghi de 1 => 3 muc (khong nhan doi): ' + L.length);
ok(L.some(x => x.tuCam === 'Bảo hành trọn đời' && x.thayThe === 'bảo hành theo chính sách'), 'tu moi co mat');
ok(L.filter(x => /tai loc|tài lộc/i.test(x.tuCam)).length === 1 && L.find(x => /loc|lộc/i.test(x.tuCam)).thayThe === 'thuận lợi công việc', 'tu trung sheet bi ban cau hinh thay the');
const AL = run('readBannedWordsList_()');
ok(AL.some(x => x.words[0] === 'Bảo hành trọn đời' && x.allowed === 'bảo hành theo chính sách'), 'danh sach AI cung co tu moi');
ok(AL.length === 3 && !AL.some(x => x.words.indexOf('tài lộc') >= 0) && AL.some(x => x.words.length === 1 && x.words[0] === 'may mắn' && x.allowed === 'Thuận lợi') && AL.some(x => x.words[0] === 'TAI LOC' && x.allowed === 'thuận lợi công việc'), 'danh sach AI: tu trung sheet chi con 1 dong (ban cau hinh), tu khac cua sheet giu nguyen: ' + JSON.stringify(AL));

// (3) TẮT sheet => chỉ còn từ cấu hình; danh sách rỗng + tắt sheet => KHÔNG có từ cấm nào
withSetting(JSON.stringify({ useSheet: false, items: [{ tuCam: 'cam kết', thayThe: '' }] }));
ok(JSON.stringify(words()) === JSON.stringify(['cam kết']) && run('readBannedWordsList_()').length === 1, 'tat sheet => chi tu cau hinh');
withSetting(JSON.stringify({ useSheet: false, items: [] }));
ok(words().length === 0 && run('readBannedWordsList_()').length === 0, 'tat sheet + rong => khong tu cam nao');

// (4) Dữ liệu xấu: JSON hỏng / items sai kiểu / trùng / rỗng / quá dài => không ném lỗi, về mặc định hoặc lọc sạch
withSetting('{khong phai json'); ok(JSON.stringify(words()) === JSON.stringify(['Tài lộc', 'May mắn']), 'JSON hong => nhu mac dinh');
withSetting(JSON.stringify({ items: 'abc' })); ok(words().length === 2, 'items sai kieu => bo qua');
withSetting(JSON.stringify({ useSheet: false, items: [{ tuCam: '  ' }, null, 5, { tuCam: 'a  b' }, { tuCam: 'A B' }, { tuCam: 'x'.repeat(300), thayThe: 'y'.repeat(500) }] }));
L = run('_bannedCfg_().items');
ok(L.length === 2 && L[0].tuCam === 'a b' && L[1].tuCam.length === 100 && L[1].thayThe.length === 300, 'loc rong/trung/khoang trang, cat do dai: ' + JSON.stringify(L.map(x => x.tuCam.length)));
withSetting(JSON.stringify({ items: Array.from({ length: 700 }, (_, i) => ({ tuCam: 'w' + i })) })); ok(run('_bannedCfg_().items.length') === 500, 'toi da 500 tu');

// (5) CHỈ ADMIN có token mới ghi; ghi xong xóa cache AI + quét chat; lưu nhật ký không lộ lỗi
vm.runInContext("_sessUser_ = function(t){ return ({ A: { role: 'admin' }, C: { role: 'cs' } })[t] || null; };", ctx);
ok(run("_bizRulesWriteDenied_('A')") === null && run("_bizRulesWriteDenied_('C').code") === 'FORBIDDEN' && run("_bizRulesWriteDenied_('').code") === 'FORBIDDEN', 'chi admin co token');
ok(/key\) === 'bannedWordsCfg'|=== 'bannedWordsCfg'/.test(src.split("action === 'setSetting' && (String(d0.key")[1].slice(0, 400)), 'cong doPost chan bannedWordsCfg cho non-admin');
removed.length = 0; vm.runInContext("getSheet_ = function(){ return { getLastRow: function(){ return 1; }, appendRow: function(){} }; }; _auditCfg_ = function(){}; jsonOut_ = function(o){ return o; };", ctx);
ok(run("setSetting_('bannedWordsCfg','{}')").ok === true && removed.indexOf('banned_words_v1') >= 0 && removed.indexOf('cv_banned_v1') >= 0, 'luu xong xoa cache AI (banned_words_v1) + quet chat (cv_banned_v1)');
console.log('BANNED CFG TESTS PASSED');

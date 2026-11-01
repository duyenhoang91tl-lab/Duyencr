#!/usr/bin/env node
// Test Node cho CHECK PHAN VANG (gas_v13.js: readGoldWeights_/goldWeightList_). Du lieu = tab "Trong luong vang" that cua file Report Sale (doc 2026-10-23).
// Chay: node tools/test-gold-weight.js -> "ALL GOLD WEIGHT TESTS PASSED" neu dat. Khong goi mang that.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const fn = name => { const i = src.indexOf('\nfunction ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); const j = src.indexOf('\n}\n', i); return src.slice(i + 1, j + 3); };
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
// Gia tri nhu SpreadsheetApp tra ve: o so -> number (STT, "5", "2,5" hien 2,5 tren sheet VN = so 2.5), o chu -> string. Cot A trong, B..H.
const H = ['', 'STT', 'Nhóm sản phẩm', 'Tên thương mại', 'Chất liệu', 'Kiểu/Size', 'Giá', 'Lượng vàng'];
const D = [
  [1, 'Trang sức', 'Mặt cổ tỳ hưu', 'vàng 10k', '', '', '2,5 - 2,7'], [2, 'Nhẫn', 'nhẫn vạn lộc', 'vàng 10k', '', '', 5],
  [3, 'Lắc', 'TRANG SỨC LẮC TÚI TIỀN', 'vàng 10k', '', '', '7-8'], [4, 'Lắc', 'Vô cực', 'vàng 10k', '', '', '3-3,2'],
  [5, 'Nhẫn', 'Kim hút tiền', 'vàng 10k', '<16', '', 4.2], [6, 'Nhẫn', 'Kim 2027', '', '', '', 5],
  [7, 'Lắc', 'Tỳ hưu truyền thống', '', '', '', '9-9,5'], [8, 'Nhẫn', 'Hồ ly baby', '', '', 7150, 6.5],
  [9, 'Charm rơi', 'Khởi lộc', '', '', '', 2.5], [10, 'Nhẫn', 'Tỳ hưu', '', '', '', '5-5,5'],
  [11, 'Nhẫn', 'Túi tiền', '', '', '', '5,3-5,7'], [12, 'Charm xuyên', 'Tỳ hưu', '', '', 4550, ''], [13, 'Bi', '', '', '', 380, '2,4-2,6']
].map(r => [''].concat(r));
for (let i = 14; i <= 22; i++) D.push(['', i, '', '', '', '', '', '']);   // STT danh san, chua dien
const fresh = () => [H.slice()].concat(D.map(r => r.slice()));   // moi ca dung ban sao rieng (khong sua nham du lieu goc)
let sheetVals = fresh(), reads = 0, cacheStore = {}, settings = {}, openThrows = null, sheetsByGid = { 637853981: true };
const mkSheet = () => ({ getLastRow: () => sheetVals.length, getLastColumn: () => Math.max(...sheetVals.map(r => r.length)), getRange: (r, c, nr, nc) => ({ getValues: () => { reads++; return sheetVals.slice(r - 1, r - 1 + nr).map(row => { const x = row.slice(c - 1, c - 1 + nc); while (x.length < nc) x.push(''); return x; }); } }), getName: () => 'Trọng lượng vàng' });
const ctx = { Date, JSON, Math, String, Number, parseInt, parseFloat, isNaN, Array, Object, RegExp, Error,
  getSetting_: k => settings[k] || '',
  SpreadsheetApp: { openById: id => { if (openThrows) throw new Error(openThrows); ctx.__openedId = id; return { getSheetById: gid => { ctx.__gid = gid; return sheetsByGid[gid] ? mkSheet() : null; }, getSheets: () => [mkSheet()] }; } },
  CacheService: { getScriptCache: () => ({ get: k => cacheStore[k] ?? null, put: (k, v) => { cacheStore[k] = v; } }) } };
vm.createContext(ctx);
vm.runInContext(['var GOLD_WEIGHT_SS_ID', 'var GOLD_WEIGHT_GID', 'var GOLD_CACHE_KEY_'].map(v => { const i = src.indexOf(v + ' ='); return src.slice(i, src.indexOf('\n', i)); }).join('\n') + '\n' + fn('_stripVN_') + fn('_detectHeaderRow_') + fn('_goldCfg_') + fn('_goldCell_') + fn('_goldNum_') + fn('readGoldWeights_') + fn('goldWeightList_'), ctx);
const reset = () => { reads = 0; cacheStore = {}; settings = {}; openThrows = null; sheetsByGid = { 637853981: true }; sheetVals = fresh(); };

// 1) dung 13 san pham, bo 9 dong STT trong
let r = ctx.goldWeightList_(false);
ok(r.ok && r.total === 13 && r.items.length === 13 && r.unit === 'phan', 'doc dung 13 san pham, bo 9 dong chi co STT: ' + r.total);
ok(ctx.__openedId === '1qyyG2Pj8QOVNTb4B9JX8VQsrjFlZX-WhpovX1qDkvzM' && ctx.__gid === 637853981, 'mo dung file Report Sale + tab gid 637853981');
const by = n => r.items.find(x => x.ten === n);
// 2) gia tri phan vang dung & dinh dang kieu Viet
ok(by('Mặt cổ tỳ hưu').luongVang === '2,5 - 2,7' && by('Mặt cổ tỳ hưu').min === 2.5 && by('Mặt cổ tỳ hưu').max === 2.7, 'khoang "2,5 - 2,7" giu nguyen, min/max so');
ok(by('nhẫn vạn lộc').luongVang === '5' && by('nhẫn vạn lộc').min === 5 && by('nhẫn vạn lộc').max === 5, 'o so 5 -> "5"');
ok(by('Hồ ly baby').luongVang === '6,5', 'o so 6.5 -> "6,5" (dau phay kieu Viet)');
ok(by('Khởi lộc').luongVang === '2,5' && by('Kim hút tiền').luongVang === '4,2', 'o so thap phan -> dau phay');
ok(by('TRANG SỨC LẮC TÚI TIỀN').luongVang === '7-8' && by('Vô cực').luongVang === '3-3,2' && by('Vô cực').max === 3.2, 'khoang viet lien "7-8", "3-3,2"');
ok(by('Túi tiền').luongVang === '5,3-5,7' && by('Tỳ hưu truyền thống').luongVang === '9-9,5', 'khoang thap phan');
// 3) cac truong khac
const kim = by('Kim hút tiền'); ok(kim.nhom === 'Nhẫn' && kim.chatLieu === 'vàng 10k' && kim.size === '<16', 'nhom/chat lieu/size');
// 4) KHONG tra cot Gia
ok(r.items.every(x => !('gia' in x) && !('Giá' in x) && !JSON.stringify(x).includes('7150') && !JSON.stringify(x).includes('4550')), 'KHONG tra cot Giá');
// 5) dong thieu: khong co phan vang -> van tra ra (min/max null); khong co ten -> van tra theo nhom
const cx = r.items.find(x => x.nhom === 'Charm xuyên'); ok(cx.luongVang === '' && cx.min === null && cx.max === null, 'Charm xuyen Ty huu chua co phan vang: van co dong, min/max null');
const bi = r.items.find(x => x.nhom === 'Bi'); ok(bi && bi.ten === '' && bi.luongVang === '2,4-2,6', 'dong chi co nhom "Bi" + phan vang van tra ra');
// 6) cache: lan 2 khong doc sheet; refresh=true doc lai
reads = 0; ctx.goldWeightList_(false); ok(reads === 0, 'lan 2 dung cache (khong doc sheet)');
sheetVals[2][7] = 6; ctx.goldWeightList_(false); ok(reads === 0, 'sua sheet nhung cache con han -> chua thay');
const r2 = ctx.goldWeightList_(true); ok(reads > 0 && r2.items.find(x => x.ten === 'nhẫn vạn lộc').luongVang === '6', 'refresh=1 bo cache va doc lai');
// 7) doi thu tu cot / them cot: doc theo TEN tieu de
reset(); sheetVals = sheetVals.map(row => { const [a, stt, nhom, ten, chat, size, gia, vang] = row; return ['', vang, stt, ten, gia, nhom, size, chat, 'ghi chu']; });
sheetVals[0] = ['', 'Lượng vàng', 'STT', 'Tên thương mại', 'Giá', 'Nhóm sản phẩm', 'Kiểu/Size', 'Chất liệu', 'Ghi chú'];
r = ctx.goldWeightList_(true); ok(r.ok && r.total === 13 && r.items.find(x => x.ten === 'Vô cực').luongVang === '3-3,2' && r.items.find(x => x.ten === 'Vô cực').nhom === 'Lắc', 'doi thu tu cot van doc dung');
// 8) tieu de khong o dong 1 (them dong tieu de phu phia tren)
reset(); sheetVals = [['', 'BẢNG TRỌNG LƯỢNG', '', '', '', '', '', ''], ['', '', '', '', '', '', '', '']].concat(sheetVals);
r = ctx.goldWeightList_(true); ok(r.ok && r.total === 13, 'tieu de lui xuong dong 3 van tim ra: ' + (r.error || r.total));
// 9) tieu de bi doi ten nhung co "Phan vang"
reset(); sheetVals[0][7] = 'Phân vàng'; r = ctx.goldWeightList_(true); ok(r.ok && r.total === 13, 'cot ten "Phân vàng" cung nhan');
// 10) thieu cot bat buoc -> loi ro rang, khong tra du lieu sai
reset(); sheetVals[0][7] = 'Ghi chú'; r = ctx.goldWeightList_(true); ok(r.error && /Luong vang/.test(r.error) && !r.items, 'mat cot Luong vang -> loi ro');
// 11) tab doi gid nhung con ten -> tim theo ten
reset(); sheetsByGid = {}; r = ctx.goldWeightList_(true); ok(r.ok && r.total === 13, 'gid khong khop -> tim theo ten tab "Trong luong vang"');
// 12) khong truy cap duoc file -> huong dan chia se
reset(); openThrows = 'You do not have permission to access the requested document.'; r = ctx.goldWeightList_(true); ok(r.error && /chia se/.test(r.error), 'khong co quyen -> huong dan chia se file: ' + r.error);
// 13) cau hinh doi file/tab bang Settings
reset(); settings = { goldWeightSheetId: 'ABC123', goldWeightGid: '555' }; sheetsByGid = { 555: true }; r = ctx.goldWeightList_(true); ok(r.ok && ctx.__openedId === 'ABC123' && ctx.__gid === 555, 'Settings goldWeightSheetId/goldWeightGid ghi de mac dinh');
settings = { goldWeightGid: 'abc' }; sheetsByGid = { 637853981: true }; cacheStore = {}; ctx.goldWeightList_(true); ok(ctx.__gid === 637853981, 'gid sai dinh dang -> dung mac dinh');
// 14) bang chi co tieu de -> mang rong, khong loi
reset(); sheetVals = [H.slice()]; r = ctx.goldWeightList_(true); ok(r.ok && r.total === 0, 'bang rong -> total 0');
// 15) dispatch co that
ok(/action === 'goldWeightList'\) return jsonOut_\(goldWeightList_\(/.test(src), 'doGetCore_ co dispatch goldWeightList');
console.log('ALL GOLD WEIGHT TESTS PASSED');

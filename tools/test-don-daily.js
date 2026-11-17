#!/usr/bin/env node
// Test action GAS `donDaily` (don POS THEO TUNG DON — HANDOFF 2026-11-16 "Danh sach KH khop don POS", BUOC 1).
// Chay BAN THAT buildSalesReportB_ (khong gia lap quy tac) tren du lieu POS gia lap theo VI DU THAT cua Duyen: ngay 16/11, sale biichnguyen1993,
// don "The" chung 2-4 sale, SDT thieu so 0 / +84, don Huy/Hoan, tag khong phai sale, don ngoai cua so 90 ngay.  Chay: node tools/test-don-daily.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const store = new Map(), ttls = {};
const cache = { get: k => (store.has(k) ? store.get(k) : null), put: (k, v, t) => { store.set(k, String(v)); ttls[k] = t; }, putAll: (o, t) => Object.keys(o).forEach(k => cache.put(k, o[k], t)),
  getAll: ks => { const o = {}; ks.forEach(k => { if (store.has(k)) o[k] = store.get(k); }); return o; }, remove: k => store.delete(k), removeAll: ks => ks.forEach(k => store.delete(k)) };
const rng = { getValues: () => [], getValue: () => '', getDisplayValues: () => [], setValues() { return rng; }, setValue() { return rng; }, setNumberFormat() { return rng; }, setFontWeight() { return rng; }, clearContent() { return rng; } };
const fsheet = new Proxy({ getLastRow: () => 0, getLastColumn: () => 0, getMaxColumns: () => 30, getMaxRows: () => 1000, getRange: () => rng, getDataRange: () => rng, getName: () => 's' }, { get: (t, p) => (p in t ? t[p] : (() => undefined)) });
const emptySS = { insertSheet: () => fsheet, getSheetByName: () => null, getSheets: () => [], getSheetById: () => null, getId: () => 'x', getName: () => 'x', getUrl: () => 'x' };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: { openById: () => emptySS, getActiveSpreadsheet: () => emptySS, openByUrl: () => emptySS }, CacheService: { getScriptCache: () => cache, getUserCache: () => cache },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, getProperties: () => ({}), setProperty() {} }), getUserProperties: () => ({ getProperty: () => null }) },
  LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(), DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });

const R = (phone, kh, the, tt, gia, ngay) => ({ soDienThoai: phone, ngayTaoDon: ngay || '16/11/2026 10:00', khachHang: kh, theSale: the, trangThai: tt || 'Đã gửi hàng', giaTriSauGiam: gia, cod: 0, nguonDon: 'Pancake', marketer: '', sanPham: 'Nhẫn bạc', maSanPham: 'N1', soLuong: 1, ghiChu: '' });
ctx.__rows = [
  R('912345678', 'Lê phương thảo', 'biichnguyen1993, ninhnga99, thuydinh95', '', 3000000),      // 3 sale, SDT thieu so 0 -> chia 3
  R('0987654321', 'Phương Thùy', 'biichnguyen1993', '', 1500000),                                 // 1 sale
  R('+84 901 234 567', 'Huynh Kim Nguyet', 'biichnguyen1993, ninhnga99', '', 2000000),            // 2 sale, +84
  R('0933000111', 'Binh Lê', 'biichnguyen1993, ninhnga99, thuydinh95, mainguyen97', '', 4000000), // 4 sale
  R('0933000222', 'Trần tươi', 'biichnguyen1993, Chưa đối soát', '', 800000),                      // tag co khoang trang khong phai sale
  R('0933000333', 'Lọ Lem', 'biichnguyen1993, 8', '', 600000),                                     // tag toan so khong phai sale
  R('0933000444', 'Thanh Phương', 'biichnguyen1993', 'Hủy đơn', 9000000),                         // BI LOAI
  R('0933000555', 'Gau Panda', 'biichnguyen1993', 'Hoàn đơn', 9000000),                           // BI LOAI
  R('0933000666', 'C Trang', 'biichnguyen1993', 'Đã hoàn', 9000000),                               // BI LOAI
  R('0933000777', 'Khach Dang Hoan', 'biichnguyen1993', 'Đang hoàn', 9000000),                    // BI LOAI
  R('0933000888', 'Khach cu 15/11', 'biichnguyen1993', '', 700000, '15/11/2026 09:00'),           // ngay khac, trong cua so
  R('0933000999', 'Khach qua xa', 'biichnguyen1993', '', 5000000, '01/01/2026 09:00'),            // ngoai cua so 90 ngay
  R('', 'Khong co SDT', 'biichnguyen1993', '', 1000000)                                            // khong SDT -> bo
];
vm.runInContext('readDonChiTiet_=function(){return __rows;}', ctx);

const res = vm.runInContext('buildDonDaily_(90)', ctx);
const rows = res.rows, by = {}; rows.forEach(r => { by[r[0]] = r; });
ok(res.ok === true && res.days === 90 && res.ver === 'donDaily-v1', 'tra ok/days/ver');
ok(rows.every(r => r.length === 6 && /^\d{4}-\d{2}-\d{2}$/.test(r[1]) && Array.isArray(r[3]) && Array.isArray(r[5])), 'moi dong dung dinh dang [phone, ngay, ten, [sale], rev, shares]');
ok(by['0912345678'] && by['0912345678'][1] === '2026-11-16', 'SDT thieu so 0 (912345678) -> 0912345678, ngay 2026-11-16');
ok(by['0901234567'], 'SDT +84 901 234 567 -> 0901234567');
ok(JSON.stringify(by['0912345678'][3]) === JSON.stringify(['biichnguyen1993', 'ninhnga99', 'thuydinh95']), 'the chung 3 sale tach dung 3 ten');
ok(by['0933000111'][3].length === 4, 'the chung 4 sale tach dung 4 ten');
ok(by['0912345678'][5].every(x => x[1] === 1000000), 'don 3 sale 3.000.000 chia deu 1.000.000/sale');
ok(by['0933000111'][5].every(x => x[1] === 1000000), 'don 4 sale 4.000.000 chia deu 1.000.000/sale');
ok(by['0901234567'][5].every(x => x[1] === 1000000), 'don 2 sale 2.000.000 chia deu 1.000.000/sale');
ok(JSON.stringify(by['0933000222'][3]) === JSON.stringify(['biichnguyen1993']), 'tag "Chưa đối soát" (co khoang trang) KHONG phai sale');
ok(JSON.stringify(by['0933000333'][3]) === JSON.stringify(['biichnguyen1993']), 'tag toan so "8" KHONG phai sale');
['0933000444', '0933000555', '0933000666', '0933000777'].forEach((p, i) => ok(!by[p], 'don ' + ['Hủy đơn', 'Hoàn đơn', 'Đã hoàn', 'Đang hoàn'][i] + ' bi loai'));
ok(by['0933000888'] && by['0933000888'][1] === '2026-11-15', 'don ngay 15/11 van co (cua so 90 ngay)');
ok(!by['0933000999'], 'don 01/01/2026 (ngoai 90 ngay) khong co');
ok(rows.length === 7 && !rows.some(r => !r[0]), 'dung 7 don (6 don 16/11 + 1 don 15/11), khong dong thieu SDT (n=' + rows.length + ')');
ok(res.skipped.noPhone === 1 && res.skipped.noPhoneRev === 1000000 && res.skipped.noDate === 0 && res.n === 7, 'don khong SDT duoc dem rieng trong skipped (1 don / 1.000.000)');
// DOI CHIEU VOI BAO CAO B (quy tac dung chung): tong phan chia cua 1 sale trong 1 ngay = so "Theo Sale" cua Bao cao B cung bo loc
const rep = vm.runInContext('buildSalesReportB_({dateFrom:"2026-11-16",dateTo:"2026-11-16"})', ctx);
const bsRep = rep.bySale.find(x => x.name === 'biichnguyen1993');
let mine = 0, cnt = 0; rows.forEach(r => { if (r[1] === '2026-11-16') r[5].forEach(x => { if (x[0] === 'biichnguyen1993') { mine += x[1]; cnt++; } }); });
// Bao cao B tinh ca don KHONG SDT (1.000.000, thuoc biichnguyen1993) => rows + skipped phai cong ra DUNG so Bao cao B
ok(bsRep && Math.round(bsRep.giaTri) === Math.round(mine) + res.skipped.noPhoneRev, 'phan chia biichnguyen1993 16/11 + don khong SDT = so "Theo Sale" Bao cao B (' + Math.round(mine) + ' + ' + res.skipped.noPhoneRev + ' = ' + Math.round(bsRep.giaTri) + ')');
ok(bsRep && bsRep.orders === cnt + res.skipped.noPhone, 'so don biichnguyen1993 16/11 + don khong SDT = Bao cao B (' + cnt + ' + ' + res.skipped.noPhone + ')');
ok(rep.totalOrders === rows.filter(r => r[1] === '2026-11-16').length + res.skipped.noPhone, 'tong so don 16/11: rows + skipped = Bao cao B (' + rep.totalOrders + ')');
// Doi chieu tong rev ca don = tong POS khong loai
ok(rows.filter(r => r[1] === '2026-11-16').reduce((a, r) => a + r[4], 0) === 3000000 + 1500000 + 2000000 + 4000000 + 800000 + 600000, 'tong doanh thu ca don 16/11 = tong POS cac don khong bi loai');
// days khac -> cua so khac
const r30 = vm.runInContext('buildDonDaily_(1)', ctx); ok(r30.rows.every(r => r[1] === r30.to) && r30.days === 1, 'days=1 chi lay hom nay (to=' + r30.to + ')');
ok(vm.runInContext('buildDonDaily_(99999)', ctx).days === 400 && vm.runInContext('buildDonDaily_("abc")', ctx).days === 90, 'days ngoai 1..400 bi kep 400; sai kieu -> 90');
// Cache: key don_daily_v1 dung TTL = DON_CACHE_TTL_ va bi xoa boi removeAll cung 2 key kia
ok(/_cachePutBig_\('don_daily_v1', JSON\.stringify\(resDD\), DON_CACHE_TTL_\)/.test(src), 'don_daily_v1 dung cung hang so TTL');
const n = (src.match(/removeAll\(\[[^\]]*'don_phones_v6_n'[^\]]*'don_daily_v1_n'[^\]]*\]\)/g) || []).length;
ok(n >= 6 && !/removeAll\(\[[^\]]*'don_phones_v6_n'(?![^\]]*'don_daily_v1_n')[^\]]*\]\)/.test(src), 'MOI cho xoa cache Pos deu xoa ca don_daily_v1_n (' + n + ' cho)');
console.log(fails ? '\nCO LOI' : '\nTAT CA QUA'); process.exit(fails ? 1 : 0);

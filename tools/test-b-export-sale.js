#!/usr/bin/env node
// Test XUAT DOANH THU BAO CAO B theo ca team / tung sale (js/98-b-export-sale.js). Chay: node tools/test-b-export-sale.js
// Dung ham THAT _srBuildExportB_ (js/13) + _srBxPlan_ (js/98) tren du lieu B gia: 3 don, 1 don chia 2 sale, 1 don chua gan sale.
const fs = require('fs'), vm = require('vm');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const j13 = fs.readFileSync(__dirname + '/../js/13-fn-bpseedofficialonlinetemplate.js', 'utf8');
const grab = (src, name) => { const i = src.search(new RegExp('function ' + name + '\\(')); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } };
const ctx = { console, Object, Math, Number, String, Array, _foldVi: s => String(s).toLowerCase() };
vm.createContext(ctx);
['_srBuildExportB_', '_srExportBLabel_'].forEach(n => { const g = grab(j13, n); if (!g) { console.log('FAIL khong tim thay ' + n); process.exit(1); } vm.runInContext(g, ctx); });
vm.runInContext(fs.readFileSync(__dirname + '/../js/98-b-export-sale.js', 'utf8'), ctx);
const O = (khach, sdt, val, bsx, cod) => ({ ngayTaoDon: '2026-11-10', posRow: 5, ghiChu: 'GC' + khach, khachHang: khach, soDienThoai: sdt, nguonDon: 'FB', theSale: bsx.map(p => p[0]).join(','), giaTriSauGiam: val, cod: cod || 0, bsx, bcx: bsx.map(p => [p[0], (cod || 0) * p[1] / val]) });
const dB = { totalOrders: 3, totalGiaTri: 3000000, totalCod: 0, trungBinhDon: 1000000,
  orders: [O('A', '0901', 1000000, [['ninh', 1000000]]), O('B', '0902', 1000000, [['ninh', 500000], ['thuong', 500000]]), O('C', '0903', 1000000, [['(chưa gán sale)', 1000000]])],
  bySale: [{ name: 'ninh', orders: 2, giaTri: 1500000, cod: 0 }, { name: 'thuong', orders: 1, giaTri: 500000, cod: 0 }] };
const info = { dateFrom: '2026-11-01', dateTo: '2026-11-30', filters: ['Sale: ninh'], at: 'now' };
const run = (opts) => { ctx.__o = Object.assign({ info }, opts); return vm.runInContext('_srBxPlan_(' + JSON.stringify(dB) + ', __o)', ctx); };
const detailRows = (s) => s.rows.slice(1, -2);   // bo tieu de + dong trong + dong tong
// 1) ca team: 1 file, tat ca sale co ca (chua gan sale)
let p = run({ mode: 'team' });
ok(p.files.length === 1 && p.count === 3, 'ca team: 1 file, 3 sale (gom ca "(chua gan sale)")');
let sum = p.files[0].sheets[0].rows, tot = sum.filter(r => r[0] === 'TỔNG')[0];
ok(tot && tot[2].v === 3000000 && tot[1].v === 4, 'tong hop: tong gia tri 3.000.000 (cong ca don chua gan sale), so don cong tu bang');
ok(/không hiện ở bảng web/.test(JSON.stringify(sum)), 'sale chi co trong dong chia duoc danh dau "khong hien o bang web"');
let det = p.files[0].sheets[1];
ok(detailRows(det).length === 4 && det.rows[det.rows.length - 1][8].v === 3000000, 'chi tiet chung 4 dong chia, TONG = 3.000.000 (khop tong bao cao)');
ok(det.rows[det.rows.length - 1][8].f === 'SUM(I2:I5)', 'dong TONG la cong thuc SUM(I2:I5)');
// 2) chon rieng 1 sale (don chia 2 nguoi -> chi nhan phan cua minh)
p = run({ mode: 'files', names: ['ninh'] });
ok(p.files.length === 1 && p.files[0].sale === 'ninh', 'mode files + chon 1 sale -> 1 file cua sale do');
let d1 = p.files[0].sheets[1];
ok(detailRows(d1).length === 2 && detailRows(d1).every(r => r[6] === 'ninh'), 'file cua ninh chi co dong chia cua ninh');
ok(d1.rows[d1.rows.length - 1][8].v === 1500000, 'tong ninh = 1.500.000 = bang "Theo Sale" cua web');
ok(/KHỚP/.test(JSON.stringify(p.files[0].sheets[0].rows)), 'file co dong xac nhan KHOP bang web');
ok(!/thuong/.test(JSON.stringify(p.files[0])), 'file cua ninh KHONG chua ten/du lieu sale khac (thuong)');
ok(!/Đơn C|0903/.test(JSON.stringify(p.files[0])), 'file cua ninh khong chua don cua nguoi khac');
// 3) moi sale 1 file
p = run({ mode: 'files', names: ['ninh', 'thuong'] });
ok(p.files.length === 2 && p.files[0].file !== p.files[1].file, 'moi sale 1 file, ten file khac nhau');
ok(/ninh/.test(p.files[0].file) && /2026-11-01_den_2026-11-30/.test(p.files[0].file), 'ten file co ten sale + khoang ngay: ' + p.files[0].file);
// 4) 1 file nhieu sheet
p = run({ mode: 'sheets', names: ['ninh', 'thuong'] });
ok(p.files.length === 1 && p.files[0].sheets.map(s => s.name).join('|') === 'Tổng hợp|ninh|thuong', 'mode sheets: Tong hop + moi sale 1 sheet');
// 5) names rong = tat ca; ten khong ton tai bi bo qua
p = run({ mode: 'files', names: [] });
ok(p.files.length === 3, 'khong chon gi = tat ca sale (3 file)');
p = run({ mode: 'files', names: ['khong-co'] });
ok(p.files.length === 0 && p.count === 0, 'ten sale khong co trong du lieu -> khong ra file');
// 6) ten sheet/ten file an toan
const used = {}; ok(vm.runInContext('_srBxSheetName_("a/b:c*?[x]", {})', ctx) === 'a-b-c--' + '-x-', 'ten sheet bo ky tu cam: ' + vm.runInContext('_srBxSheetName_("a/b:c*?[x]", {})', ctx));
ok(vm.runInContext('_srBxSheetName_("Ten rat dai rat dai rat dai rat dai", {}).length', ctx) <= 31, 'ten sheet <= 31 ky tu');
ok(!/[\\\/:*?"<>|]/.test(vm.runInContext('_srBxFileName_(["DoanhThuB","a/b:c","2026"])', ctx)), 'ten file khong con ky tu cam');
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);

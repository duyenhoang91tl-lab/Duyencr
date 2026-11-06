#!/usr/bin/env node
// Test (du lieu GIA, khong co SDT/tien that): luat THUONG DOANH SO NGAY + THANG THEO MA DON cua tools/bonus-t10/calc_bonus.js.
// Luat Duyen (2026-11-04): ngay = ngay len don Base; doanh thu ngay = gia tri don CHIA theo so sale; dat >=60tr moi co 50k, >=100tr 100k;
// don quy uoc thang theo MA (563T10 = T10, 563T9 = T9, 563T11 = T11) -> chi tinh vao thang cua ma; "T10 + BH..T09" van la don T10 (ma dau tien).
// haPTN/thanhNP OFF: co o thang 10, bo qua tu thang 11.  Chay: node tools/test-bonus-t10-day-month.js
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const calc = path.join(__dirname, 'bonus-t10', 'calc_bonus.js');
let n = 0, fail = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.error('FAIL: ' + m); } };
let id = 0;
const O = (sale, gia, ngay, ghiChu) => ({ id: 'PT' + (++id), sheet: 'ĐƠN PT', maDon: 'M9' + id, saleBan: sale, nguonDon: 'Facebook / Test', maSanPham: 'X' + id, sanPham: 'VÒNG TAY TEST ' + id,
  soLuong: '', giaTriDon: gia, ngayTao: ngay.split('-').reverse().join('/'), ghiChu, trangThai: 'Đã nhận', giaTriTruocGiam: 0, baoHanh: false, sdt: String(900000000 + id), baseNgayTao: ngay, donGoc: true });
const orders = [
  O('saleA', 29e6, '2026-10-15', '1T10/2026'), O('saleA', 29e6, '2026-10-15', '2T10/2026'),            // 58tr  -> KHONG co thuong ngay
  O('saleA', 32e6, '2026-10-18', '3T10/2026'), O('saleA', 30e6, '2026-10-18', '4T10/2026'),            // 62tr  -> 50k
  O('saleA', 70e6, '2026-10-20', '5T09/2026'),                                                         // ma T09 -> LOAI khoi T10 (khong co thuong ngay 20/10)
  O('saleA', 70e6, '2026-10-21', '6T11/2026'),                                                         // ma T11 -> LOAI khoi T10
  O('saleA', 65e6, '2026-10-22', '7T10/2026 + BH8T09/2026/123'),                                       // ma dau T10 -> TINH, 65tr -> 50k
  O('saleB, saleC', 130e6, '2026-10-25', '9T10/2026'),                                                 // 65tr moi nguoi (sau chia) -> 50k moi nguoi
  O('saleB, saleC', 190e6, '2026-10-26', '10T10/2026'),                                                // 95tr moi nguoi -> chi 50k (chua toi 100tr)
  O('saleD', 99e6, '2026-10-27', '11T10/2026'), O('saleD', 1e6, '2026-10-27', '12T10/2026'),           // dung 100tr -> 100k
];
function run(month) {
  const W = fs.mkdtempSync(path.join(os.tmpdir(), 'bonus-')); fs.writeFileSync(W + '/orders.json', JSON.stringify(orders));
  fs.writeFileSync(W + '/channels.json', JSON.stringify({ saleA: 'online', saleB: 'online', saleC: 'online', saleD: 'online', haPTN: 'probation', thanhNP: 'probation' }));
  cp.execFileSync('node', [calc, W, String(month)], { stdio: 'pipe' });
  return JSON.parse(fs.readFileSync(W + '/bonus-result.json', 'utf8'));
}
const day = (r, s) => { const x = (r.bySale.find(b => b.name === s) || { items: [] }).items.filter(i => i.scope === 'Theo ngày (doanh số)'); const m = {}; x.forEach(i => { m[i.date] = (m[i.date] || 0) + i.amount; }); return m; };
const r = run(10);
const a = day(r, 'saleA');
ok(!a['2026-10-15'], '15/10 = 58tr khong duoc thuong ngay');
ok(a['2026-10-18'] === 50000, '18/10 = 62tr -> 50k');
ok(!a['2026-10-20'], 'don ma T09 khong duoc tinh vao T10');
ok(!a['2026-10-21'], 'don ma T11 khong duoc tinh vao T10');
ok(a['2026-10-22'] === 50000, '"7T10 + BH8T09" la don T10 -> 50k');
ok(day(r, 'saleB')['2026-10-25'] === 50000 && day(r, 'saleC')['2026-10-25'] === 50000, '130tr chia 2 sale = 65tr moi nguoi -> 50k moi nguoi');
ok(day(r, 'saleB')['2026-10-26'] === 50000, '190tr chia 2 = 95tr -> 50k, khong phai 100k');
ok(day(r, 'saleD')['2026-10-27'] === 100000, 'dung 100tr -> 100k');
const r11 = run(11);
ok(!day(r11, 'saleA')['2026-10-18'], 'chay thang 11: don ma T10 khong duoc tinh');
const src = fs.readFileSync(calc, 'utf8'); ok(/OFF_FROM = \{ haPTN: 11, thanhNP: 11 \}/.test(src), 'haPTN/thanhNP OFF tu thang 11');
console.log(fail ? fail + '/' + n + ' FAIL' : 'PASS ' + n + ' kiem tra'); process.exit(fail ? 1 : 0);

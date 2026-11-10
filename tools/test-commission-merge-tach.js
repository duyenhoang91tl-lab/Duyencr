// Test (Duyen 2026-11-06): don cung khach tach 2 don Pos, TONG >= 15tr => hoa hong theo muc >=15tr (1,5% Online) — calc_commission.js gop don tach nhu web CRM. Chay: node tools/test-commission-merge-tach.js
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const mk = (id, ma, ghi, gt, tt, sale) => ({ id, sheet: 'ĐƠN PT', maDon: ma, saleBan: sale || 'thuydinh95', nguonDon: 'Facebook / Hiền Phạm Thu Hiền', maSanPham: 'N1', sanPham: 'Nhẫn', soLuong: '1', giaTriDon: gt, ngayTao: '2026-10-05 10:00', ghiChu: ghi, trangThai: tt || 'Đã nhận' });
function run(orders) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-')); fs.writeFileSync(d + '/orders.json', JSON.stringify(orders)); fs.writeFileSync(d + '/channels.json', JSON.stringify({ thuydinh95: 'online', anhtrinh1995: 'online' }));
  const out = cp.execFileSync('node', [path.join(__dirname, 'bonus-t10', 'calc_commission.js'), d], { encoding: 'utf8' });
  return { res: JSON.parse(fs.readFileSync(d + '/commission-result.json', 'utf8')), out };
}
const row = (r, n) => r.res.rows.find(x => x.name === n) || {};
// A: 254T10 tach 2 don 9,0tr + 8,5tr = 17,5tr => 1 don >= 15tr
let r = run([mk('a1', 'M45018', '254T10/2026/1 TÁCH', 9000000), mk('a2', 'M45016', '254T10/2026/2 TÁCH', 8500000)]);
ok(row(r, 'thuydinh95').nAbove === 1 && row(r, 'thuydinh95').revAbove === 17500000 && !row(r, 'thuydinh95').revBelow, 'don tach 9tr + 8,5tr gop thanh 1 don 17,5tr => muc >= 15tr (revAbove 17.500.000, khong con revBelow)');
ok(/gop don tach: 1 nhom/.test(r.out) && /254T10\/2026=17500000/.test(r.out), 'log bao 1 nhom gop 254T10/2026 = 17.500.000');
const rate = row(r, 'thuydinh95').rateAbove15;
ok(Math.abs(row(r, 'thuydinh95').total - 17500000 * rate / 100) < 1, 'hoa hong = 17,5tr x ' + rate + '% (muc >= 15tr)');
// B: phan con lai cua tach co 1 don Huy => KHONG gop (don con lai 9tr < 15tr)
r = run([mk('b1', 'M1', '300T10/2026/1 TÁCH', 9000000), mk('b2', 'M2', '300T10/2026/2 TÁCH', 8500000, 'Đã hủy')]);
ok(row(r, 'thuydinh95').nBelow === 2 || (row(r, 'thuydinh95').revAbove || 0) === 0, 'dong Huy khong tham gia gop => khong len muc >= 15tr');
// C: 2 don KHONG co ma tach => giu tung don (khong tu y gop)
r = run([mk('c1', 'M3', '400T10', 9000000), mk('c2', 'M4', '401T10', 8500000)]);
ok(!row(r, 'thuydinh95').nAbove && row(r, 'thuydinh95').nBelow === 2, 'don khong co hau to /1 /2 TACH => khong gop');
// D: tach 2 don nhung tong < 15tr => van muc < 15tr
r = run([mk('d1', 'M5', '500T10/2026/1 TÁCH', 7000000), mk('d2', 'M6', '500T10/2026/2 TÁCH', 6000000)]);
ok(!row(r, 'thuydinh95').nAbove && row(r, 'thuydinh95').nBelow === 1 && row(r, 'thuydinh95').revBelow === 13000000, 'tach tong 13tr < 15tr => 1 don muc < 15tr');
console.log(fail ? 'FAIL ' + fail : 'ALL OK'); process.exit(fail ? 1 : 0);

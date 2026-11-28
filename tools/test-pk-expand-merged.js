// Test GAS _pkExpandMergedRows_ (buoc 3/4 Pancake gop thang): rai dong gop (dateTo > date) ra tung ngay.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('gas_v13.js', 'utf8');
function fn(name){ const i = src.search(new RegExp('function ' + name + '\\s*\\(')); if (i < 0) throw new Error('khong thay ' + name); let j = src.indexOf('{', i), d = 0; for (let k = j; k < src.length; k++){ if (src[k] == '{') d++; else if (src[k] == '}'){ d--; if (!d) return src.slice(i, k + 1); } } }
const ctx = { console, normOrderDate_: v => String(v || '').slice(0, 10) };
vm.createContext(ctx);
vm.runInContext(['_pkDaysBetween_', '_pkApportion_', '_pkExpandMergedRows_'].map(fn).join('\n'), ctx);
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
// dong Stats: [date,pageId,pageName,nhanVien,khCu,khMoi,tongTT,tinNhan,binhLuan,hoiThoaiMoi,dhKhMoi,dhKhCu,tongDH,dateTo]
const S = (d, p, nv, tt, dh, dt) => [d, p, 'P' + p, nv, 1, 2, tt, 4, 5, 6, dh, 0, dh, dt || ''];
// dong Daily: [date,pageId,pageName,khCu,khMoi,tongTT,tinNhan,binhLuan,hoiThoaiMoi,dhKhMoi,dhKhCu,tongDH]
const D = (d, p, tt, dh) => [d, p, 'P' + p, 0, 0, tt, 0, 0, 0, dh, 0, dh];
const sum = (rows, i) => rows.reduce((a, r) => a + (+r[i] || 0), 0);
const days = ctx._pkDaysBetween_('2026-08-30', '2026-09-02');
ok(JSON.stringify(days) === JSON.stringify(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']), 'dem ngay qua cuoi thang: ' + days);
const ap = ctx._pkApportion_(10, [1, 1, 1]);
ok(ap.reduce((a, b) => a + b) === 10 && ap.every(Number.isInteger), 'chia 10 cho 3 phan deu: tong dung 10, nguyen: ' + ap);
ok(JSON.stringify(ctx._pkApportion_(5, [0, 0])) === '[2.5,2.5]', 'trong so toan 0 -> chia deu');
// 1) khong gop: giu nguyen, them cot co=0, dateTo rong
let r = ctx._pkExpandMergedRows_([S('2026-08-05', 'p1', 'An', 10, 1)], []);
ok(r.length === 1 && r[0][13] === '' && r[0][14] === 0 && r[0][6] === 10, 'dong 1 ngay giu nguyen, co=0');
// 2) gop 3 ngay, co so lieu ngay THAT cua Page (tongTT 1:2:3, tongDH 0:1:2) -> rai theo ngay that
r = ctx._pkExpandMergedRows_([S('2026-08-01', 'p1', 'An', 60, 3, '2026-08-03')], [D('2026-08-01', 'p1', 10, 0), D('2026-08-02', 'p1', 20, 1), D('2026-08-03', 'p1', 30, 2)]);
const by = Object.fromEntries(r.map(x => [x[0], x]));
ok(r.length === 3 && sum(r, 6) === 60 && sum(r, 12) === 3, 'TONG khong doi: tongTT 60, tongDH 3');
ok(by['2026-08-01'][6] === 10 && by['2026-08-02'][6] === 20 && by['2026-08-03'][6] === 30, 'tongTT rai dung ty le ngay that 10/20/30');
ok(by['2026-08-01'][12] === 0 && by['2026-08-02'][12] === 1 && by['2026-08-03'][12] === 2, 'tongDH rai theo don that 0/1/2');
ok(r.every(x => x[14] === 1 && x[13] === ''), 'co = 1 (rai theo ngay that), dateTo rong');
// 3) khong co daily -> chia deu theo lich, co = 2
r = ctx._pkExpandMergedRows_([S('2026-08-01', 'p9', 'Bo', 31, 4, '2026-08-31')], []);
ok(r.length === 31 && sum(r, 6) === 31 && sum(r, 12) === 4 && r.every(x => x[14] === 2), 'thang 31 ngay khong co daily: chia deu, tong 31/4, co=2');
ok(r.every(x => Number.isInteger(x[6]) && Number.isInteger(x[12])), 'so nguyen sau khi rai');
// 4) ngay da co dong THAT cua dung (Page, nv) -> bo phan rai ngay do (khong cong doi)
r = ctx._pkExpandMergedRows_([S('2026-08-01', 'p1', 'An', 30, 0, '2026-08-03'), S('2026-08-02', 'p1', 'An', 50, 1)], []);
ok(r.filter(x => x[0] === '2026-08-02').length === 1 && r.find(x => x[0] === '2026-08-02')[6] === 50, 'ngay 08-02 chi con so THAT 50');
ok(r.length === 3, 'con 08-01, 08-03 (rai) + 08-02 (that) = 3 dong');
// 5) nhan vien KHAC cung Page: khong bi loai
r = ctx._pkExpandMergedRows_([S('2026-08-01', 'p1', 'An', 30, 0, '2026-08-03'), S('2026-08-02', 'p1', 'Binh', 50, 1)], []);
ok(r.filter(x => x[0] === '2026-08-02').length === 2, 'nhan vien khac cung ngay: giu ca 2');
// 6) 2 dong gop chong nhau cung (Page, nv): dong nap SAU thang tren ngay chong
r = ctx._pkExpandMergedRows_([S('2026-08-01', 'p1', 'An', 30, 0, '2026-08-03'), S('2026-08-02', 'p1', 'An', 20, 0, '2026-08-04')], []);
const ov = r.filter(x => x[0] === '2026-08-02' || x[0] === '2026-08-03');
ok(r.length === 4 && sum(r, 6) === 10 + 20, 'chong nhau: 4 ngay, dong sau thang ngay chong (08-01: 10, dong sau: 20): ' + sum(r, 6));
// 7) dong nhan vien khong tuong tac van rai (tong 0)
r = ctx._pkExpandMergedRows_([S('2026-08-01', 'p1', 'An', 0, 0, '2026-08-02')], []);
ok(r.length === 2 && sum(r, 6) === 0, 'tong 0 rai ra 0');
// 8) Date object trong cot ngay (Sheets) van chay
r = ctx._pkExpandMergedRows_([S('2026-08-01', 'p1', 'An', 4, 0, '2026-08-02')], []);
ok(r.length === 2, 'dateTo 2 ngay -> 2 dong');
console.log(fail ? fail + ' loi' : 'TAT CA OK'); process.exit(fail ? 1 : 0);

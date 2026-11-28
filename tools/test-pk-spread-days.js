// Test GAS _pkExpandMergedRows_ (Pancake gop thang, buoc 3/4): rai dong gop nhieu ngay ra tung ngay.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('gas_v13.js', 'utf8');
function fn(name){ const i = src.search(new RegExp('function ' + name + '\\s*\\(')); let j = src.indexOf('{', i), d = 0; for (let k = j; k < src.length; k++){ if (src[k] == '{') d++; else if (src[k] == '}'){ d--; if (!d) return src.slice(i, k + 1); } } }
const ctx = { console, normOrderDate_: v => String(v || '').slice(0, 10) };
vm.createContext(ctx);
vm.runInContext(['_pkDaysBetween_', '_pkApportion_', '_pkExpandMergedRows_'].map(fn).join('\n'), ctx);
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
// dong stats: [date,pageId,pageName,nhanVien,khCu,khMoi,tongTT,tinNhan,binhLuan,hoiThoaiMoi,dhKhMoi,dhKhCu,tongDH,dateTo]
const R = (date, pid, nv, tt, dh, dateTo) => [date, pid, 'P' + pid, nv, 0, tt, tt, tt, 0, 0, 0, dh, dh, dateTo || ''];
// daily: [date,pageId,pageName,khCu,khMoi,tongTT,tinNhan,binhLuan,hoiThoaiMoi,dhKhMoi,dhKhCu,tongDH]
const D = (date, pid, tt, dh) => [date, pid, 'P' + pid, 0, tt, tt, tt, 0, 0, 0, dh, dh];
const sum = (rows, i) => rows.reduce((a, r) => a + (+r[i] || 0), 0);
const byDate = rows => { const o = {}; rows.forEach(r => o[r[0]] = r); return o; };

let out = ctx._pkExpandMergedRows_([R('2026-08-01', 'p1', 'An', 60, 6, '2026-08-03')], [D('2026-08-01', 'p1', 10, 1), D('2026-08-02', 'p1', 20, 2), D('2026-08-03', 'p1', 30, 3)]);
let b = byDate(out);
ok(out.length === 3 && b['2026-08-01'][6] === 10 && b['2026-08-02'][6] === 20 && b['2026-08-03'][6] === 30, 'rai theo so lieu ngay that cua Page: TT 10/20/30');
ok(b['2026-08-02'][12] === 2 && b['2026-08-03'][12] === 3, 'don (tongDH) cung rai theo ngay that: 1/2/3');
ok(out.every(r => r[14] === 1 && r[13] === ''), 'co uoc tinh = 1 (rai theo ngay that), dateTo xoa');
out = ctx._pkExpandMergedRows_([R('2026-08-01', 'p1', 'An', 10, 10, '2026-08-03')], []);
ok(sum(out, 6) === 10 && out.map(r => r[6]).sort().join() === '3,3,4', 'khong co so lieu ngay: chia deu, tong giu dung 10 (4/3/3)');
ok(out.every(r => r[14] === 2), 'co uoc tinh = 2 (chia deu theo lich)');
out = ctx._pkExpandMergedRows_([R('2026-08-01', 'p1', 'An', 60, 6, '2026-08-03'), R('2026-08-02', 'p1', 'An', 7, 1, '')], [D('2026-08-01', 'p1', 10, 1), D('2026-08-02', 'p1', 20, 2), D('2026-08-03', 'p1', 30, 3)]);
b = byDate(out);
ok(out.length === 3 && b['2026-08-02'][6] === 7 && b['2026-08-02'][14] === 0, 'ngay co dong THAT cua dung (Page,nhan vien) -> so that thay phan rai (khong cong doi)');
ok(b['2026-08-01'][6] === 10 && b['2026-08-03'][6] === 30, 'cac ngay con lai van la phan rai');
out = ctx._pkExpandMergedRows_([R('2026-08-01', 'p1', 'An', 60, 6, '2026-08-03'), R('2026-08-01', 'p1', 'Binh', 30, 3, '2026-08-03'), R('2026-08-02', 'p1', 'An', 7, 1, '')], [D('2026-08-01', 'p1', 10, 1), D('2026-08-02', 'p1', 20, 2), D('2026-08-03', 'p1', 30, 3)]);
ok(out.filter(r => r[3] === 'Binh').length === 3, 'nhan vien KHAC khong co dong that van giu du 3 ngay');
out = ctx._pkExpandMergedRows_([R('2026-08-01', 'p1', 'An', 15, 0, '2026-08-15'), R('2026-08-10', 'p1', 'An', 22, 0, '2026-08-31')], []);
const an = out.filter(r => r[3] === 'An'), days = an.map(r => r[0]).sort();
ok(days.length === 31 && new Set(days).size === 31, 'hai dong gop chong nhau: moi ngay CHI 1 dong (khong cong doi), du 31 ngay');
ok(an.filter(r => r[0] >= '2026-08-10' && r[0] <= '2026-08-15').every(r => r[6] === 1) && an.filter(r => r[0] < '2026-08-10').every(r => r[6] === 1), 'ngay chong thuoc dong NAP SAU; dong cu chi giu ngay 01-09');
out = ctx._pkExpandMergedRows_([R('2026-08-05', 'p1', 'An', 5, 1, ''), R('2026-08-06', 'p1', 'An', 5, 1, '2026-08-06')], []);
ok(out.length === 2 && out.every(r => r[14] === 0), 'dong 1 ngay (dateTo rong hoac = date) giu nguyen, co = 0');
out = ctx._pkExpandMergedRows_([R('2026-08-01', 'p1', 'An', 9, 3, '2026-08-03')], [D('2026-08-01', 'p1', 1, 0), D('2026-08-02', 'p1', 1, 0), D('2026-08-03', 'p1', 7, 0)]);
b = byDate(out);
ok(b['2026-08-03'][6] === 7 && sum(out, 12) === 3 && out.map(r => r[12]).join() === '1,1,1', 'ngay that co TT nhung DH = 0 -> truong don chia deu (khong chia theo 0), tong giu 3');
console.log(fail ? fail + ' loi' : 'TAT CA OK'); process.exit(fail ? 1 : 0);

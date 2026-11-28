// Test buildPancakeReport_ tra byDay/byDayPage (buoc 4a/4 Pancake gop thang): TT/DH theo NGAY sau khi rai dong gop, co uoc tinh, an Page theo cai dat.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('gas_v13.js', 'utf8');
function fn(name){ const i = src.search(new RegExp('function ' + name + '\\s*\\(')); if (i < 0) throw new Error('khong thay ' + name); let j = src.indexOf('{', i), d = 0; for (let k = j; k < src.length; k++){ if (src[k] == '{') d++; else if (src[k] == '}'){ d--; if (!d) return src.slice(i, k + 1); } } }
let stats = [], daily = [], hidden = [];
const ctx = { console, Date, normOrderDate_: v => String(v || '').slice(0, 10), _normTxt_: v => String(v || '').trim().toLowerCase(),
  readPancakeMapCI_: () => ({ map: { An: 'An' }, mapCI: {} }), readPancakePageMap_: () => ({}), _hiddenPageSaleSets_: () => ({ channels: hidden, sales: [] }) };
vm.createContext(ctx);
vm.runInContext(['_pkDaysBetween_', '_pkApportion_', '_pkExpandMergedRows_', 'buildPancakeReport_'].map(fn).join('\n') + '\nvar _pkReportMemoCache_ = null;\nfunction _pkStatsRowsMemo_() { return _pkExpandMergedRows_(STATS, DAILY); }', ctx);
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
const S = (d, p, nv, tt, dh, dt) => [d, p, 'P' + p, nv, 1, 2, tt, 4, 5, 6, dh, 0, dh, dt || ''];
const D = (d, p, tt, dh) => [d, p, 'P' + p, 0, 0, tt, 0, 0, 0, dh, 0, dh];
function run(from, to){ ctx.STATS = stats; ctx.DAILY = daily; ctx._pkReportMemoCache_ = null; return ctx.buildPancakeReport_(from, to, 'equal'); }
// Thang gop 3 ngay co so lieu ngay that + 1 dong rieng ngay 08-02 cua Page khac
stats = [S('2026-08-01', 'p1', 'An', 60, 3, '2026-08-03'), S('2026-08-02', 'p2', 'An', 10, 1)];
daily = [D('2026-08-01', 'p1', 10, 0), D('2026-08-02', 'p1', 20, 1), D('2026-08-03', 'p1', 30, 2)];
let r = run('2026-08-01', '2026-08-03');
ok(Array.isArray(r.byDay) && r.byDay.length === 3, 'byDay co 3 ngay');
const d = Object.fromEntries(r.byDay.map(x => [x.date, x]));
ok(d['2026-08-01'].tongTT === 10 && d['2026-08-02'].tongTT === 30 && d['2026-08-03'].tongTT === 30, 'tongTT theo ngay (08-02 = 20 rai + 10 Page khac): ' + r.byDay.map(x => x.tongTT));
ok(d['2026-08-03'].tongDH === 2 && d['2026-08-03'].tyLeCD === 6.7, 'TLC ngay 08-03 = 2/30 = 6.7%: ' + d['2026-08-03'].tyLeCD);
ok(d['2026-08-01'].est === 1 && d['2026-08-02'].est === 1, 'co uoc tinh = 1 (rai theo ngay that)');
ok(r.byPage.reduce((a, x) => a + x.tongTT, 0) === r.byDay.reduce((a, x) => a + x.tongTT, 0), 'tong byDay = tong byPage (' + r.byDay.reduce((a, x) => a + x.tongTT, 0) + ')');
ok(r.byDayPage.length === 4, 'byDayPage: 3 ngay p1 + 1 ngay p2');
// Loc khoang ngay
r = run('2026-08-02', '2026-08-02');
ok(r.byDay.length === 1 && r.byDay[0].tongTT === 30, 'loc 1 ngay 08-02 -> chi ngay do');
// An Page theo cai dat admin
hidden = ['Pp2']; r = run('2026-08-01', '2026-08-03');
ok(r.byDay.find(x => x.date === '2026-08-02').tongTT === 20 && r.byDayPage.length === 3, 'Page bi an khong tinh vao byDay');
hidden = [];
// Khong co daily -> chia deu, est = 2
stats = [S('2026-08-01', 'p9', 'An', 30, 3, '2026-08-03')]; daily = [];
r = run('2026-08-01', '2026-08-03');
ok(r.byDay.every(x => x.tongTT === 10 && x.est === 2), 'chia deu theo lich: moi ngay 10, est=2');
// Dong that 1 ngay: est = 0
stats = [S('2026-08-05', 'p1', 'An', 8, 2)]; daily = [];
r = run('2026-08-01', '2026-08-31');
ok(r.byDay.length === 1 && r.byDay[0].est === 0 && r.byDay[0].tyLeCD === 25, 'so that: est=0, TLC 25%');
// Rong
stats = []; r = run('', '');
ok(Array.isArray(r.byDay) && r.byDay.length === 0 && Array.isArray(r.byPage), 'khong co du lieu -> byDay rong, byPage van co');
console.log(fail ? fail + ' loi' : 'TAT CA OK'); process.exit(fail ? 1 : 0);

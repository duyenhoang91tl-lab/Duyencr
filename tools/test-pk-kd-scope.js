// Test tỷ lệ chốt chung CHỈ phòng KD ở tab Báo cáo KPI Pancake (js/10). Chạy: node tools/test-pk-kd-scope.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../js/10-fn-pkkpipct.js', 'utf8');
const a = src.indexOf('function _pkKdInScope_'), b = src.indexOf('function _pkRenderKpiPancake');
if (a < 0 || b < 0) { console.log('FAIL không tìm thấy hàm'); process.exit(1); }
const ctx = { CH: { ninh: 'online', trinh: 'offline', tuoi: 'probation' } };
ctx._saleChannelOn_ = (n) => ctx.CH[n] || '';
vm.createContext(ctx); vm.runInContext(src.slice(a, b), ctx);
let ok = true; const t = (c, m) => { if (!c) { ok = false; console.log('FAIL', m); } };
const rows = [
  { name: 'ninh', tongTT: 100, donHangForRate: 10, nhom: 'Online' },
  { name: 'trinh', tongTT: 100, donHangForRate: 20, nhom: 'Văn phòng' },
  { name: 'tuoi', tongTT: 50, donHangForRate: 5, nhom: 'Thử việc' },          // thử việc: không thuộc phòng KD
  { name: 'Public API', tongTT: 800, donHangForRate: 1, nhom: '' },            // kéo tỷ lệ xuống
  { name: 'Duyen Hoang', tongTT: 300, donHangForRate: 2, nhom: '' }
];
const s = ctx._pkKdSplit_(rows, '2026-11-20');
t(s.scoped === true, 'có lọc');
t(s.kd.map(x => x.name).join() === 'ninh,trinh,tuoi', 'KD = online + offline + thu viec: ' + s.kd.map(x => x.name));
t(s.out.map(x => x.name).join() === 'Public API,Duyen Hoang', 'ngoài KD vẫn giữ để hiển thị: ' + s.out.map(x => x.name));
const kd = ctx._pkRateOf_(s.kd), all = ctx._pkRateOf_(rows);
t(kd.rate === 14 && kd.don === 35 && kd.tongTT === 250, 'KD 35/250 = 14%: ' + JSON.stringify(kd));
t(all.rate === Math.round(38 / 1350 * 1000) / 10, 'gộp mọi người thấp hơn nhiều (2.8%): ' + all.rate);
t(kd.rate > all.rate, 'bỏ người ngoài KD thì tỷ lệ chung không còn bị kéo xuống');
// dự phòng: chưa có phân loại Sale -> dùng nhóm SaleDirectory
ctx.CH = {};
const s2 = ctx._pkKdSplit_(rows, '2026-11-20');
t(s2.kd.map(x => x.name).join() === 'ninh,trinh,tuoi', 'dự phòng theo nhóm S/O/Thử việc: ' + s2.kd.map(x => x.name));
// 2026-11-26: cờ kd của server thắng — ngocNM thuộc Phòng ban Sale (không có kênh/nhóm S-O) vẫn được tính; người kd:false thì ra ngoài
const s4 = ctx._pkKdSplit_([{ name: 'ngocNM', tongTT: 10, donHangForRate: 1, nhom: '', kd: true }, { name: 'Public API', tongTT: 90, donHangForRate: 0, nhom: '', kd: false }], '2026-11-20');
t(s4.scoped && s4.kd.map(x => x.name).join() === 'ngocNM' && s4.out.map(x => x.name).join() === 'Public API', 'co kd cua server: ngocNM trong KD');
// không ai được phân loại ở cả 2 nguồn -> không lọc (tránh ra trống)
const s3 = ctx._pkKdSplit_(rows.map(r => ({ name: r.name, tongTT: r.tongTT, donHangForRate: r.donHangForRate, nhom: '' })), '2026-11-20');
t(s3.scoped === false && s3.kd.length === 5 && s3.out.length === 0, 'chưa phân loại -> không lọc');
t(ctx._pkRateOf_([]).rate === 0, 'rỗng = 0%');
console.log(ok ? 'OK' : 'FAILED'); process.exit(ok ? 0 : 1);

// Test doc file Pancake "Thong ke nhan vien" GOP nhieu ngay (js/09 _pkParseSdtWorkbook_). Chay: node tools/test-pk-sdt-range.js
// Tuy chon: node tools/test-pk-sdt-range.js <file.xlsx> de chay thu file that (can: npm i xlsx).
const fs = require('fs'), vm = require('vm');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../js/09-fn-deleteteam.js', 'utf8');
const grab = n => { const i = src.search(new RegExp('function ' + n + '\\(')); if (i < 0) throw new Error('khong thay ' + n); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
const ctx = { XLSX: { utils: { sheet_to_json: ws => ws } } }; vm.createContext(ctx);
['_pkYmdAdd_', '_pkHeaderRange_', '_pkDayCell_', '_pkParseSdtWorkbook_'].forEach(n => vm.runInContext(grab(n), ctx));
const parse = wb => vm.runInContext('_pkParseSdtWorkbook_', ctx)(wb);
const H = (t, title) => [['Thống kê nhân viên'], ['Đã tải về lúc: 27/11/2026 09:22:25'], ['Trang: A (111)'], ['Thời gian tải về: ' + t], [title || 'Page A - 111'], [], []];
const hStaff = ['Nhân viên', 'T.nhắn từ b.luận', 'Bình luận', 'Phiên tr.lời b.luận', 'Tin nhắn', 'Phiên t.lời t.nhắn', 'Th.gian ph.hồi TB', 'SĐT mang về', 'Số đơn chốt', 'T.lệ ph.hồi'];
const hTime = ['Thời gian'].concat(hStaff.slice(1, 9), ['Đơn chốt / SĐT']);
const T8 = '01/08/2026 00:00:00 - 31/08/2026 23:59:59';
const wb = { SheetNames: ['111 By staff', '111 By time', '222 By staff', '333 By staff'], Sheets: {
  '111 By staff': H(T8).concat([hStaff, ['An', '', '', '', 18, 7, '14m 1s', 5, '', '2%'], ['Hải Yến', '', '', '', '', '', '0s', '', 9, '0%']]),
  '111 By time': H(T8).concat([hTime, ['31/8/2026', '', '', '', 4, 1, '33m', 3, '', ''], ['09/8/2026', '', '', '', 25, 11, '7m', 2, 4, ''], ['02/8/2026', '', '', '', '', '', '0s', '', '', ''], ['15/09/2026', '', '', '', 9, 9, '1m', 9, 9, '']]),
  '222 By staff': H('27/11/2026 00:00:00 - 27/11/2026 23:59:59', 'Page B - 222').concat([hStaff, ['Bo', '', 2, 2, '', '', '1h', 1, '', '']]),
  '333 By staff': [['x'], ['y']] } };
const r = parse(wb);
const an = r.rows.find(x => x.nhanVien === 'An'), hy = r.rows.find(x => x.nhanVien === 'Hải Yến'), bo = r.rows.find(x => x.nhanVien === 'Bo');
ok(r.rows.length === 3, '3 dong nhan vien (2 Page A + 1 Page B)');
ok(an.date === '2026-08-01' && an.dateTo === '2026-08-31' && an.sdtMangVe === 5 && an.tinNhan === 18, 'file thang: date = ngay dau, dateTo = ngay cuoi (khong con don vao 01/08), cot dung');
ok(hy.soDonChot === 9 && hy.sdtMangVe === 0, 'cot So don chot (idx 8) doc dung');
ok(bo.date === '2026-11-27' && bo.dateTo === '', 'file 1 ngay: dateTo rong (nhu cu)');
ok(r.daily.length === 2 && r.daily[0].date === '2026-08-31' && r.daily[1].date === '2026-08-09', 'By time: giu ngay co so lieu (d/m/yyyy 1-2 chu so), bo ngay trong va ngay NGOAI khoang');
ok(r.daily[1].sdtMangVe === 2 && r.daily[1].soDonChot === 4 && r.daily[1].pageId === '111' && r.daily[1].pageName === 'Page A', 'By time: dung cot + pageId + ten Page');
ok(r.warnings.length === 1 && /333/.test(r.warnings[0]), 'sheet khong co ngay -> canh bao, khong loi');
if (process.argv[2]) {
  const X = require('xlsx'), wbr = X.readFile(process.argv[2]); const c2 = { XLSX: X }; vm.createContext(c2);
  ['_pkYmdAdd_', '_pkHeaderRange_', '_pkDayCell_', '_pkParseSdtWorkbook_'].forEach(n => vm.runInContext(grab(n), c2));
  const rr = vm.runInContext('_pkParseSdtWorkbook_', c2)(wbr);
  console.log('FILE THAT: rows', rr.rows.length, 'daily', rr.daily.length, 'warn', rr.warnings, 'khoang', [...new Set(rr.rows.map(x => x.date + '→' + x.dateTo))],
    'sdt', rr.rows.reduce((a, x) => a + x.sdtMangVe, 0), 'don', rr.rows.reduce((a, x) => a + x.soDonChot, 0), '| daily sdt', rr.daily.reduce((a, x) => a + x.sdtMangVe, 0), 'don', rr.daily.reduce((a, x) => a + x.soDonChot, 0));
}
console.log(bad ? bad + ' loi' : 'TAT CA OK'); process.exit(bad ? 1 : 0);

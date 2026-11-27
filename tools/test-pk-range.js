#!/usr/bin/env node
// Test doc file Pancake "Thong ke tuong tac" gop nhieu ngay (js/09 _pkHeaderRange_, _pkDayCell_, _pkParseWorkbook_). Chay: node tools/test-pk-range.js
const fs = require('fs'), vm = require('vm');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../js/09-fn-deleteteam.js', 'utf8');
const grab = n => { const i = src.search(new RegExp('function ' + n + '\\(')); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } };
const ctx = { XLSX: { utils: { sheet_to_json: ws => ws } } }; vm.createContext(ctx);
['_pkYmdAdd_', '_pkHeaderRange_', '_pkDayCell_', '_pkParseWorkbook_'].forEach(n => vm.runInContext(grab(n), ctx));
const H = t => [['Thống kê tương tác'], ['Đã tải về lúc: 27/11/2026 08:50:13'], ['Trang: A (111)'], ['Thời gian tải về: ' + t], ['Page A - 111']];
const sub = [['Nhân viên', 'Tương Tác khách hàng'], ['', 'KH cũ', 'KH mới', 'Tổng TT', 'Tin nhắn', 'Bình luận', 'Hội thoại mới', 'KH mới', 'KH cũ', 'Tổng ĐH']];
const rg = t => vm.runInContext('_pkHeaderRange_', ctx)(H(t));
ok(JSON.stringify(rg('01/08/2026 00:00:00 - 31/08/2026 23:59:59')) === '{"from":"2026-08-01","to":"2026-08-31"}', 'thang 8: 01/08 - 31/08 23:59:59');
ok(rg('01/08/2026 00:00:00 - 01/09/2026 00:00:00').to === '2026-08-31', 'moc cuoi 01/09 00:00:00 la moc loai tru -> het 31/08');
ok(rg('27/11/2026 00:00:00 - 27/11/2026 23:59:59').to === '2026-11-27', 'file 1 ngay -> from = to');
ok(rg('05/11/2026').to === '2026-11-05', 'dinh dang cu chi 1 ngay van doc duoc');
ok(rg('01/01/2027 00:00:00 - 01/01/2027 00:00:00').to === '2027-01-01', 'moc cuoi = moc dau -> khong am');
ok(vm.runInContext('_pkHeaderRange_', ctx)([['x'], ['y']]) === null, 'khong co dong thoi gian -> null');
const dc = vm.runInContext('_pkDayCell_', ctx);
ok(dc('31/08/2026') === '2026-08-31' && dc('06:00') === '' && dc('') === '' && dc(46265) === '2026-08-31', 'o ngay: dd/mm/yyyy, so ngay Excel; gio -> bo');
const wb = { SheetNames: ['111 By user', '111 By time', '222 By user'], Sheets: {
  '111 By user': H('01/08/2026 00:00:00 - 31/08/2026 23:59:59').concat(sub, [['An', 1, 2, 3, 3, '', 1, 1, 0, 1], ['Tổng TT', 1, 2, 3]]),
  '111 By time': H('01/08/2026 00:00:00 - 31/08/2026 23:59:59').concat(sub, [['02/08/2026', 0, 2, 2, 2, '', 1, 1, 0, 1], ['01/08/2026', 1, 0, 1, 1, '', 0, '', '', ''], ['15/09/2026', 5, 5, 10, 10, '', 1, 1, 0, 1], ['03/08/2026', '', '', '', '', '', '', '', '', '']]),
  '222 By user': H('27/11/2026 00:00:00 - 27/11/2026 23:59:59').concat(sub, [['Bo', 0, 4, 4, 4, '', 4, 1, 0, 1]]) } };
const r = vm.runInContext('_pkParseWorkbook_', ctx)(wb);
const a = r.rows.find(x => x.nhanVien === 'An'), b = r.rows.find(x => x.nhanVien === 'Bo');
ok(r.rows.length === 2 && a.date === '2026-08-01' && a.dateTo === '2026-08-31' && a.tongTT === 3 && a.tongDH === 1, 'By user thang: date=ngay dau, dateTo=ngay cuoi, bo dong Tong');
ok(b.date === '2026-11-27' && b.dateTo === '', 'By user 1 ngay: dateTo rong');
ok(r.daily.length === 2 && r.daily.map(d => d.date).join() === '2026-08-02,2026-08-01', 'By time: giu ngay co so lieu, bo ngay trong va ngay NGOAI khoang file');
ok(r.daily[0].pageId === '111' && r.daily[0].tongDH === 1 && r.daily[1].khCu === 1 && r.daily[0].pageName === 'Page A', 'By time: page + so lieu dung cot');
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);

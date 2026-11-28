// Test: Danh sách KH mặc định chỉ 7 cột chính; ai đã bật/tắt cột thì giữ; bảng không thừa khoảng trống khi ẩn cột. Chạy: node tools/test-list-cols-default.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const js6 = R('js/06-main-renew-sources.js'), js5 = R('js/05-fn-saveeditphone.js'), html = R('index.html'), css = R('css/01-base.css');
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const line = js6.split('\n').filter(l => /^const (_colVisDefault|colVisible) =/.test(l)).join('\n');
const run = saved => { const ctx = { loadLS: () => saved }; vm.createContext(ctx); vm.runInContext(line + '\nthis.v = colVisible;', ctx); return ctx.v; };
const shown = v => Object.keys(v).filter(k => v[k]).sort().join(',');
const SEVEN = 'care,cs,lastpos,name,order,sched,tier';
ok(shown(run(null)) === SEVEN, 'người chưa chỉnh: đúng 7 cột chính');
const old = { hang: true, note: true, cs: false };
const v = run(old);
ok(v.hang === true && v.note === true && v.cs === false && v.tier === true, 'ai đã bật/tắt cột: giữ lựa chọn đã lưu');
// ô tích trong index.html khớp mặc định
const def = run(null);
const chips = [...html.matchAll(/<input type="checkbox"( checked)? onchange="toggleCol\('(\w+)',this\)">/g)];
ok(chips.length === Object.keys(def).length && chips.every(m => !!m[1] === def[m[2]]), 'ô tích ở "Cột hiển thị" khớp mặc định (' + chips.length + ' cột)');
// reapplyColVisibility: ẩn cột + chỉnh colspan theo số cột đang hiện
const i = js5.indexOf('function reapplyColVisibility'), src = js5.slice(i, js5.indexOf('\n}\n', i) + 2);
const cols = Object.keys(def), cell = () => ({ style: { display: '' } });
const ths = cols.map(cell), spacers = [{ colSpan: 15 }, { colSpan: 15 }];
const doc = { querySelectorAll: s => s === '#main-table thead th' ? ths : s === '#main-table tbody td[colspan]' ? spacers : /^\.col-/.test(s) ? [ths[cols.indexOf(s.slice(5))]].filter(Boolean) : [] };
const ctx = { document: doc, colVisible: Object.assign({}, def) }; vm.createContext(ctx); vm.runInContext(src + '\nreapplyColVisibility();', ctx);
ok(spacers.every(t => t.colSpan === 7), 'dòng đệm trải đúng 7 cột');
ctx.colVisible.hang = true; ctx.colVisible.note = true; vm.runInContext('reapplyColVisibility()', ctx);
ok(spacers.every(t => t.colSpan === 9), 'bật thêm 2 cột → trải 9 cột');
ok(!/#main-table\{[^}]*min-width:\d/.test(css), 'bảng không còn min-width cứng (ẩn cột không thừa khoảng trống)');
ok(/#main-table th\[data-cf-th\]\{width:130px;\}/.test(css), 'cột trường tự tạo có bề rộng riêng');
ok(/\.col-bcstatus\{width:140px;\}/.test(css), 'cột Trạng thái gửi TN có bề rộng (trước bị co về 0)');
console.log(fail ? fail + ' lỗi' : 'TẤT CẢ OK'); process.exit(fail ? 1 : 0);

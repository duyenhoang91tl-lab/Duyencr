// Test: THẺ KHÁCH trên điện thoại (js/02 _cardLineHtml_, js/06 VT_ROW_H, css/16). Chiều cao dòng JS và CSS PHẢI luôn khớp (cuộn ảo tính theo số này).
const fs = require('fs'), vm = require('vm');
const js2 = fs.readFileSync('js/02-fn-showrowerrorbanner.js', 'utf8'), js6 = fs.readFileSync('js/06-main-renew-sources.js', 'utf8');
const css16 = fs.readFileSync('css/16-mobile-list.css', 'utf8'), css01 = fs.readFileSync('css/01-base.css', 'utf8');
function fn(src, name){ const i = src.search(new RegExp('function ' + name + '\\s*\\(')); let j = src.indexOf('{', i), d = 0; for (let k = j; k < src.length; k++){ if (src[k] == '{') d++; else if (src[k] == '}'){ d--; if (!d) return src.slice(i, k + 1); } } }
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
// 1) Chiều cao dòng: JS (điện thoại) = CSS (điện thoại); máy tính 58 = css/01
const jsPhone = +(js6.match(/matches \? (\d+) : (\d+)/) || [])[1], jsDesk = +(js6.match(/matches \? (\d+) : (\d+)/) || [])[2];
const cssPhone = +(css16.match(/@media \(max-width:640px\)\{\s*html body #main-table tbody tr:not\(\.vspacer\)\{height:(\d+)px;/) || [])[1];
const cssDesk = +(css01.match(/#main-table tbody tr:not\(\.vspacer\)\{height:(\d+)px;\}/) || [])[1];
ok(jsPhone > 0 && jsPhone === cssPhone, 'chiều cao dòng điện thoại: JS (' + jsPhone + ') = CSS (' + cssPhone + ')');
ok(jsDesk === 58 && jsDesk === cssDesk, 'chiều cao dòng máy tính vẫn 58: JS = CSS (' + jsDesk + '/' + cssDesk + ')');
ok(/matchMedia\('\(max-width:640px\)'\)/.test(js6), 'JS dùng cùng ngưỡng (max-width:640px) với CSS bằng matchMedia');
// 2) Máy tính: dòng thẻ ẨN mặc định, chỉ hiện trong @media ≤640px
ok(/\n\.cm-line\{display:none;\}/.test(css16), '.cm-line ẩn mặc định (máy tính không đổi)');
ok(/@media \(max-width:640px\)\{[^}]*\n[^]*td\.col-name \.cm-line\{display:flex/.test(css16), '.cm-line chỉ hiện trong @media ≤640px');
// 3) _cardLineHtml_
const ctx = { esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), _csCanonText_: s => 'CANON:' + s };
vm.createContext(ctx); vm.runInContext(fn(js2, '_cardLineHtml_'), ctx);
let h = ctx._cardLineHtml_({ phone: '0867 321.200', careCS: 'mai' }, ['Lan Anh']);
ok(h.includes('href="tel:0867321200"') && h.includes('https://zalo.me/0867321200'), 'nút Gọi/Zalo dùng SĐT đã làm sạch (chỉ số/+)');
ok(h.includes('stopPropagation') && (h.match(/stopPropagation/g) || []).length === 2, 'bấm Gọi/Zalo không mở hồ sơ (chặn nổi bọt)');
ok(h.includes('CANON:mai') && !h.includes('Lan Anh'), 'CS ưu tiên người đang chăm (careCS), có chuẩn hoá tên');
h = ctx._cardLineHtml_({ phone: '0901', careCS: '' }, ['Lan Anh']);
ok(h.includes('Lan Anh'), 'không có CS chăm sóc → lấy CS phụ trách đầu tiên');
h = ctx._cardLineHtml_({ phone: '', careCS: '' }, []);
ok(!h.includes('href='), 'không có SĐT → không có nút Gọi/Zalo');
h = ctx._cardLineHtml_({ phone: '0901', careCS: '<img src=x onerror=1>' }, []);
ok(!h.includes('<img'), 'tên CS được escape (không chèn HTML)');
ok(/\$\{_cardLineHtml_\(c, csNames\)\}<\/td>\s*\n\s*<td class="col-tier">/.test(js2), 'dòng thẻ nằm TRONG ô tên khách (không thêm cột mới)');
console.log(fail ? fail + ' lỗi' : 'TẤT CẢ OK'); process.exit(fail ? 1 : 0);

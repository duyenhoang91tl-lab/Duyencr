// Test: Danh sách KH gọn hơn trên máy tính (js/05 _lovIsOpen_/toggleColBar, css/16, index.html nút cột). Chỉ đổi MẶC ĐỊNH, ai đã chọn thì giữ.
const fs = require('fs'), vm = require('vm');
const js5 = fs.readFileSync('js/05-fn-saveeditphone.js', 'utf8'), css16 = fs.readFileSync('css/16-mobile-list.css', 'utf8'), html = fs.readFileSync('index.html', 'utf8');
function fn(src, name){ const i = src.search(new RegExp('function ' + name + '\\s*\\(')); let j = src.indexOf('{', i), d = 0; for (let k = j; k < src.length; k++){ if (src[k] == '{') d++; else if (src[k] == '}'){ d--; if (!d) return src.slice(i, k + 1); } } }
function env(store){
  const cls = new Set(), btn = { textContent: '' };
  const ctx = { localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    document: { body: { classList: { toggle: (c, on) => on ? cls.add(c) : cls.delete(c) } }, getElementById: id => id === 'tab-list' ? { style: { display: 'flex' } } : id === 'col-toggle-btn' ? btn : null },
    _lovSum_: () => {} };
  vm.createContext(ctx); vm.runInContext(['_lovIsOpen_', '_colsIsOpen_', 'toggleColBar', '_lovSync_'].map(n => fn(js5, n)).join('\n'), ctx);
  return { ctx, cls, btn, store };
}
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
let e = env({}); e.ctx._lovSync_();
ok(!e.cls.has('lov-open') && !e.cls.has('cols-open') && e.cls.has('lov-on-list'), 'chưa chọn gì: thống kê THU GỌN, thanh cột ẨN (mọi cỡ màn hình)');
ok(e.btn.textContent === '📋 Cột hiển thị ▾', 'nút cột hiển thị ▾ khi đang ẩn');
e.ctx.toggleColBar();
ok(e.cls.has('cols-open') && e.store.ome_list_cols_open === '1' && e.btn.textContent === '📋 Cột hiển thị ▴', 'bấm nút → mở thanh cột, lưu ome_list_cols_open=1, nhãn ▴');
e.ctx.toggleColBar();
ok(!e.cls.has('cols-open') && e.store.ome_list_cols_open === '0', 'bấm lần 2 → đóng, lưu 0');
e = env({ ome_list_ov_open: '1', ome_list_cols_open: '1' }); e.ctx._lovSync_();
ok(e.cls.has('lov-open') && e.cls.has('cols-open'), 'ai đã chọn MỞ trước đó thì giữ nguyên (không ghi đè lựa chọn)');
e = env({ ome_list_ov_open: '0' }); e.ctx._lovSync_();
ok(!e.cls.has('lov-open'), 'đã chọn đóng → đóng');
// CSS / HTML
ok(/@media \(min-width:901px\)\{\s*body\.lov-on-list:not\(\.lov-open\) #tab-list > \.toolbar\{display:flex !important;\}/.test(css16), 'máy tính: thanh công cụ LUÔN hiện dù thống kê thu gọn');
ok(/#tab-list > \.col-toggle-bar\{display:none;\}\s*\nbody\.cols-open #tab-list > \.col-toggle-bar\{display:flex;\}/.test(css16), 'thanh cột ẩn mặc định, hiện khi body.cols-open');
ok(!/body\.lov-on-list:not\(\.lov-open\) #tab-list > \.col-toggle-bar\{display:none !important;\}/.test(css16), 'đã bỏ luật cũ ép ẩn thanh cột theo thanh Tổng quan (sẽ chặn nút mới)');
ok(/id="col-toggle-btn" onclick="toggleColBar\(\)"/.test(html), 'có nút 📋 Cột hiển thị trong index.html');
ok(/\.stats-row,body\.lov-on-list:not\(\.lov-open\) #tab-list > \.toolbar\{display:none !important;\}/.test(fs.readFileSync('css/01-base.css', 'utf8')), 'luật gốc css/01 còn nguyên (điện thoại vẫn ẩn toolbar khi thu gọn)');
console.log(fail ? fail + ' lỗi' : 'TẤT CẢ OK'); process.exit(fail ? 1 : 0);

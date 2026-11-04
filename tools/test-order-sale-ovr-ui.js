// Test: js/65-order-sale-ovr.js — chuẩn hoá/kiểm tra dòng ép sale + nối menu/index. Chạy: node tools/test-order-sale-ovr-ui.js
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if (!c) bad++; };
const src = fs.readFileSync(__dirname + '/../js/65-order-sale-ovr.js', 'utf8');
const ctx = { String, Object, parseInt, RegExp }; vm.createContext(ctx);
vm.runInContext(src.slice(0, src.indexOf('function _osoEnsure_')), ctx);
ok(ctx._osoNormCode_(' 162t10/2026 ') === '162T10/2026' && ctx._osoNormCode_('NG83T10') === 'NG83T10' && ctx._osoNormCode_('M44816') === '' && ctx._osoNormCode_('abc') === '', 'chuẩn hoá mã: bỏ khoảng trắng/in hoa; mã Pos M44816 và chữ vô nghĩa bị từ chối');
let b = ctx._osoBuild_([{ code: '162t10/2026', name: ' yenNTH2004 ' }, { code: '430T10/2026', name: 'thuyha88' }, { code: '', name: '' }]);
ok(JSON.stringify(b.obj) === '{"162T10/2026":"yenNTH2004","430T10/2026":"thuyha88"}' && !b.errors.length, 'dựng JSON đúng định dạng backend đọc (khoá = mã, giá trị = tên); bỏ dòng trống');
b = ctx._osoBuild_([{ code: 'xx', name: 'a' }, { code: '5T10/2026', name: '' }, { code: '7T10/2026', name: 'a' }, { code: '7T10', name: 'b' }]);
ok(b.errors.length === 3 && Object.keys(b.obj).length === 1, 'báo lỗi: mã sai, thiếu tên, trùng mã (khác năm vẫn trùng) — chỉ giữ dòng hợp lệ');
const rt = ctx._osoToRows_({ '162T10/2026': 'yenNTH2004' }); ok(rt.length === 1 && rt[0].code === '162T10/2026' && rt[0].name === 'yenNTH2004', 'đọc ngược setting → dòng bảng');
ok(/act:ordersale/.test(fs.readFileSync(__dirname + '/../js/29-sidenav.js', 'utf8')) && /openOrderSaleOvrModal/.test(fs.readFileSync(__dirname + '/../js/29-sidenav.js', 'utf8')), 'nối vào menu Cài đặt team (admin)');
ok(/js\/65-order-sale-ovr\.js/.test(fs.readFileSync(__dirname + '/../index.html', 'utf8')), 'index.html nạp js/65');
process.exit(bad ? 1 : 0);

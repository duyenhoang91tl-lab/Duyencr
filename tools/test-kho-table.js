#!/usr/bin/env node
// R7c-2 — Tồn kho: mặt hàng dạng BẢNG (ui-kit); thiếu js/68 → danh sách dòng như cũ. Chạy: node tools/test-kho-table.js
const fs = require('fs'), vm = require('vm'), cp = require('child_process'), path = require('path');
const root = path.join(__dirname, '..'), F = 'js/46-fn-kho.js';
const cur = fs.readFileSync(path.join(root, F), 'utf8');
const old = cp.execSync('git show 7761ce6:' + F, { cwd: root, maxBuffer: 1 << 26 }).toString('utf8');
const css = fs.readFileSync(path.join(root, 'css/08-kho.css'), 'utf8');
function fn(src, n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thiếu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
const ITEMS = [{ maHang: 'A1', tenHang: 'Nhẫn <vàng>', ton: 2, minTon: 5 }, { maHang: 'B2', tenHang: '', ton: 50, minTon: 0 }, { maHang: 'C3', tenHang: 'Vòng', ton: 9, minTon: 3 }];
function run(src, kit, o) {
  o = o || {}; const el = { 'tk-list': { innerHTML: '' }, 'tk-info': { innerHTML: '' } };
  const ctx = { console, esc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), _tkNum: n => String(n), _tk: { items: o.items || ITEMS, q: '', low: false, shown: o.shown || 200 },
    document: { readyState: 'complete', addEventListener() {}, getElementById: id => el[id] }, location: { search: '' }, _tkCurKho: () => ({ name: 'K', active: true, note: '' }), _tkLevel: () => 'admin', _tkCanEdit: () => o.can !== false, _tkCanManage: () => true,
    _tkNorm: s => String(s).toLowerCase(), _tkIsLow: it => it.minTon > 0 && it.ton <= it.minTon };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((kit ? fs.readFileSync(path.join(root, 'js/68-ui-kit.js'), 'utf8') + '\n' : '') + fn(src, '_tkFiltered') + '\n' + fn(src, '_tkRenderList'), ctx);
  ctx._tkRenderList(); return el['tk-list'].innerHTML;
}
for (const [nm, o] of [['3 mặt hàng', {}], ['không quyền sửa', { can: false }], ['có nút Hiện thêm', { shown: 2 }], ['kho trống', { items: [] }]]) {
  const a = run(old, false, o), b0 = run(cur, false, o), b = run(cur, true, o);
  t(a === b0, nm + ': thiếu js/68 → danh sách y hệt bản cũ');
  if (nm === 'kho trống') { t(a === b, nm + ': thông báo trống KHÔNG đổi'); continue; }
  const rows = (b.match(/<tr class="tk-trow/g) || []).length, exp = Math.min(o.shown || 200, 3);
  t(/<table class="dash-table tk-table">/.test(b) && rows === exp, nm + ': dạng bảng, ' + exp + ' hàng');
  t(['A1', 'B2', 'C3'].slice(0, exp).every(c => b.indexOf('data-tk-hist="' + c + '"') >= 0), nm + ': nút Lịch sử (data-tk-hist) còn đủ');
  t((b.match(/data-tk-edit=/g) || []).length === (o.can === false ? 0 : exp), nm + ': nút Sửa (data-tk-edit) ' + (o.can === false ? 'ẩn' : 'còn đủ'));
  t((b.indexOf('data-tk-more="1"') >= 0) === (exp < 3), nm + ': nút Hiện thêm đúng');
}
const b = run(cur, true, {});
t(/tk-trow low/.test(b) && (b.match(/tk-trow low/g) || []).length === 1, 'chỉ hàng sắp hết (A1) có class low');
t(/ui-tone-danger/.test(b) && /sắp hết \(≤ 5\)/.test(b) && (b.match(/Còn hàng/g) || []).length === 2, 'chip đỏ "sắp hết (≤ 5)" cho A1, "Còn hàng" cho 2 hàng còn lại');
t(/Nhẫn &lt;vàng&gt;/.test(b) && !/<vàng>/.test(b), 'tên hàng được escape');
t(/<td class="tk-c-name">—<\/td>/.test(b), 'tên trống hiện "—" như cũ');
t(/@media \(max-width:640px\)[\s\S]*\.tk-table thead\{display:none;\}/.test(css) && /\.tk-c-ok\{display:none;\}/.test(css), 'CSS: ≤640px ẩn tiêu đề bảng, xếp lại thành dòng, ẩn chip "Còn hàng"');
if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');

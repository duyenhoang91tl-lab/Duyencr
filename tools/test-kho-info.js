#!/usr/bin/env node
// R7c-1 — Tồn kho: vùng thông tin thành thẻ số (uiStatGrid_); thiếu js/68 → dòng chữ như cũ. Chạy: node tools/test-kho-info.js
const fs = require('fs'), vm = require('vm'), cp = require('child_process'), path = require('path');
const root = path.join(__dirname, '..'), F = 'js/46-fn-kho.js';
const cur = fs.readFileSync(path.join(root, F), 'utf8');
const old = cp.execSync('git show 1da92ed:' + F, { cwd: root, maxBuffer: 1 << 26 }).toString('utf8');
function fn(src, n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thiếu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
function run(src, kit, kho, q, lvl) {
  const el = { tk: {}, 'tk-list': { innerHTML: '' }, 'tk-info': { innerHTML: '' } };
  const items = [{ maHang: 'A1', tenHang: 'Nhẫn', ton: 2, minTon: 5 }, { maHang: 'B2', tenHang: 'Dây', ton: 50, minTon: 0 }, { maHang: 'C3', tenHang: 'Vòng', ton: 9, minTon: 3 }];
  const ctx = { console, esc: s => String(s == null ? '' : s), _tkNum: n => String(n), _tk: { items, q: q || '', low: false, shown: 200 }, document: { readyState: 'complete', addEventListener() {}, getElementById: id => el[id] },
    location: { search: '' }, _tkCurKho: () => kho, _tkLevel: () => lvl, _tkCanEdit: () => true, _tkCanManage: () => true, _tkNorm: s => String(s).toLowerCase(), _tkIsLow: it => it.minTon > 0 && it.ton <= it.minTon };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((kit ? fs.readFileSync(path.join(root, 'js/68-ui-kit.js'), 'utf8') + '\n' : '') + fn(src, '_tkFiltered') + '\n' + fn(src, '_tkRenderList'), ctx);
  ctx._tkRenderList(); return el;
}
const text = h => h.replace(/<[^>]+>/g, '|').split('|').map(x => x.trim()).filter(Boolean).join(' ');
const K = { name: 'Kho A', active: true, note: 'ghi chú kho' }, K2 = { name: 'Kho B', active: false, note: '' };
for (const [nm, kho, q, lvl] of [['kho thường', K, '', 'admin'], ['đang tìm', K, 'nhan', 'staff'], ['kho ngưng', K2, '', '']]) {
  const a = run(old, false, kho, q, lvl), b0 = run(cur, false, kho, q, lvl), b = run(cur, true, kho, q, lvl);
  t(a['tk-info'].innerHTML === b0['tk-info'].innerHTML, nm + ': thiếu js/68 → dòng thông tin y hệt bản cũ');
  t(a['tk-list'].innerHTML === b['tk-list'].innerHTML && a['tk-list'].innerHTML === b0['tk-list'].innerHTML, nm + ': danh sách mặt hàng KHÔNG đổi');
  const h = b['tk-info'].innerHTML, tx = text(h);
  t(/ui-stat-grid/.test(h) && (h.match(/class="ui-stat /g) || []).length === 3, nm + ': 3 thẻ số');
  t(tx.includes(kho.name) && (!kho.note || tx.includes(kho.note)) && (kho.active || tx.includes('Kho đã ngưng hoạt động')) && (!lvl || /Bạn là|Chỉ xem/.test(tx)) || (!lvl && /Chỉ xem/.test(tx)), nm + ': tên kho · quyền · ngưng · ghi chú vẫn hiện');
}
const bn = run(cur, true, K, '', 'admin')['tk-info'].innerHTML;
const pair = (h, label) => { const m = h.match(new RegExp('ui-stat-lb">' + label + '</div><div class="ui-stat-n">([^<]*)<')); return m && m[1]; };
t(pair(bn, 'Mặt hàng') === '3' && pair(bn, 'Sắp hết') === '1' && pair(bn, 'Đang hiển thị') === '3', 'số liệu đúng: 3 mặt hàng, 1 sắp hết (A1: tồn 2 ≤ tối thiểu 5), hiển thị 3');
t(/ui-tone-danger/.test(bn), 'có hàng sắp hết → thẻ "Sắp hết" tone đỏ');
const bf = run(cur, true, K, 'nhan', 'admin')['tk-info'].innerHTML; t(/đang lọc/.test(bf), 'đang tìm: thẻ "Đang hiển thị" ghi chú đang lọc');
if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');

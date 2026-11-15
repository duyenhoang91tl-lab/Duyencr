#!/usr/bin/env node
// R7c-3 — Tồn kho: hộp thoại Lịch sử hiện loại thay đổi bằng chip ui-kit; thiếu js/68 → HTML y hệt bản cũ (commit 454eb21). Chạy: node tools/test-kho-hist-kit.js
const fs = require('fs'), vm = require('vm'), cp = require('child_process'), path = require('path');
const root = path.join(__dirname, '..'), F = 'js/46-fn-kho.js';
const cur = fs.readFileSync(path.join(root, F), 'utf8');
const old = cp.execSync('git show 454eb21:' + F, { cwd: root, maxBuffer: 1 << 26 }).toString('utf8');
function fn(src, n, pre) { const i = src.indexOf((pre || '') + 'function ' + n + '('); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
const LOG = [{ maHang: 'M<1>', loai: 'kiem_ke', lyDo: 'a&b', user: 'u', ts: 0, delta: 5, before: 1, after: 6 }, { maHang: 'M2', loai: 'xuat', delta: -2, before: 6, after: 4 }, { maHang: 'M3', loai: 'xoa' }, { maHang: 'M4', loai: 'la' }];
async function run(src, kit) {
  const el = { innerHTML: '' }, box = { querySelector: s => s === '#tk-h' ? el : {} };
  const ctx = { console, location: { search: '' }, document: { readyState: 'complete', addEventListener() {} }, _tkCurKho: () => ({ id: 'k' }), _tkDlg: () => box, tkDlgClose() {}, _tkGet: async () => ({ log: LOG }), _tkNum: n => String(n), esc: v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((kit ? fs.readFileSync(path.join(root, 'js/68-ui-kit.js'), 'utf8') + '\n' : '') + fn(src, 'tkHistDlg', 'async '), ctx);
  await ctx.tkHistDlg(''); return el.innerHTML;
}
const text = h => h.replace(/<[^>]+>/g, '|').split('|').map(x => x.trim()).filter(Boolean);
(async () => {
  const a = await run(old, false), b0 = await run(cur, false), b = await run(cur, true);
  t(a.length > 100 && a === b0, 'thiếu js/68 → HTML lịch sử y hệt bản cũ');
  const miss = text(a).filter(x => !text(b).includes(x)); t(!miss.length, 'qua ui-kit đủ chữ/số bản cũ' + (miss.length ? ' — THIẾU: ' + miss.join(' | ') : ''));
  t(/ui-tone-info[^>]*>Kiểm kê/.test(b) && /ui-tone-warning[^>]*>Xuất/.test(b) && /ui-tone-danger[^>]*>Xoá/.test(b), 'loại → chip đúng màu (kiểm kê xanh dương, xuất vàng, xoá đỏ)');
  t(/ui-tone-neutral[^>]*>la</.test(b), 'loại lạ → chip xám giữ nguyên chữ'); t(/M&lt;1&gt;/.test(b) && /a&amp;b/.test(b) && !/&amp;lt;/.test(b), 'escape đúng 1 lần');
  if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');
})();

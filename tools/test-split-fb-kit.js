#!/usr/bin/env node
// R7d-4 — Đơn chia sale: dòng tổng chia tay (Sửa lệch) + viền ô "Sale phản hồi" dùng màu token ui-kit; thiếu js/68 → màu cứng y hệt bản cũ (commit d6a4a38). Chạy: node tools/test-split-fb-kit.js
const fs = require('fs'), vm = require('vm'), cp = require('child_process'), path = require('path');
const root = path.join(__dirname, '..'), F = 'js/50-split-orders.js';
const cur = fs.readFileSync(path.join(root, F), 'utf8');
const old = cp.execSync('git show d6a4a38:' + F, { cwd: root, maxBuffer: 1 << 26 }).toString('utf8');
function fn(src, n, pre) { const i = src.indexOf((pre || '') + 'function ' + n + '('); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
async function run(src, kit, bad) {
  const outl = [], tgt = { classList: { contains: c => c === 'split-fb' }, getAttribute: () => 'k', value: 'x', title: '', style: { set outline(v) { outl.push(v); }, get outline() { return ''; } } };
  const rows = [{ posVal: 1e6 }, { posVal: 2e6 }];
  const ctx = { console, location: { search: '' }, document: { readyState: 'complete', addEventListener() {} }, gsUrl: 'u', setTimeout: f => 0, toast() {}, _srMRerender_() {},
    splitFixDefaultText_: () => 'A = 1', splitFixParseLines_: t => t === 'ERR' ? { errors: ['Sai <dòng>'], total: 0 } : { errors: [], total: t === 'OK' ? 1e6 : 1.5e6 },
    _srState: { fix: { data: { rows }, edits: { 0: 'ERR', 1: 'DIFF', 2: 'OK' } }, mSel: { sale: 'A', data: { pos: [{ fbKey: 'k' }] } } },
    fetch: async () => ({ json: async () => bad ? { ok: false, error: 'Không đủ quyền' } : { ok: true, text: 'x', by: 'u', at: 't' } }) };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((kit ? fs.readFileSync(path.join(root, 'js/68-ui-kit.js'), 'utf8') + '\n' : '') + ['splitEsc_', 'splitMoney_', 'splitKitOn_', 'splitErrColor_', 'splitToneColor_', 'splitFixSumHtml_'].map(n => fn(src, n)).join('\n') + '\n' + fn(src, '_srMFbChange_', 'async '), ctx);
  const sum = [ctx.splitFixSumHtml_(0), ctx.splitFixSumHtml_(1)]; ctx.splitMoney_ = ctx.splitMoney_;
  ctx._srState.fix.data.rows.push({ posVal: 1e6 }); const sumOk = ctx.splitFixSumHtml_(2);
  await ctx._srMFbChange_({ target: tgt }); return { sum: sum.concat(sumOk), outl };
}
(async () => {
  const a = await run(old, false), b0 = await run(cur, false), b = await run(cur, true), e0 = await run(old, false, true), e1 = await run(cur, true, true);
  t(JSON.stringify(a) === JSON.stringify(b0) && a.sum[0].includes('#c0392b') && a.sum[1].includes('#b9770e') && a.outl.join() === '2px solid #f59e0b,2px solid #16a34a', 'thiếu js/68 → dòng tổng + viền ô y hệt bản cũ (màu cứng)');
  t(b.sum[0].includes('var(--ui-danger)') && b.sum[1].includes('var(--ui-warning)') && !/#[0-9a-f]{6}/i.test(b.sum.join()), 'qua ui-kit: dòng tổng dùng token (lỗi=danger, chênh=warning), không còn màu cứng');
  t(b.outl.join() === '2px solid var(--ui-warning),2px solid var(--ui-success)', 'qua ui-kit: viền ô phản hồi vàng → xanh khi lưu được');
  t(e1.outl.join() === '2px solid var(--ui-warning),2px solid var(--ui-danger)' && e0.outl.join() === '2px solid #f59e0b,2px solid #dc2626', 'lỗi lưu: viền đỏ (token / màu cũ khi thiếu ui-kit)');
  t(/Sai &lt;dòng&gt;/.test(b.sum[0]) && /chênh -/.test(b.sum[1]) && /khớp/.test(b.sum[2]), 'chữ giữ nguyên + escape đúng 1 lần');
  if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');
})();

#!/usr/bin/env node
// R7d-3 — Đơn chia sale: dòng tóm tắt đối chiếu (panel chi tiết) + bảng Sửa lệch dùng chip ui-kit; thiếu js/68 → HTML y hệt bản cũ (commit 11c79f2). Chạy: node tools/test-split-fix-kit.js
const fs = require('fs'), vm = require('vm'), cp = require('child_process'), path = require('path');
const root = path.join(__dirname, '..'), F = 'js/50-split-orders.js';
const cur = fs.readFileSync(path.join(root, F), 'utf8');
const old = cp.execSync('git show 11c79f2:' + F, { cwd: root, maxBuffer: 1 << 26 }).toString('utf8');
function fn(src, n) { const i = src.indexOf('function ' + n + '('); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
function vr(src, n) { const m = src.match(new RegExp('var ' + n + ' = [^;]*;')); return m ? m[0] : ''; }
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
const NAMES = ['splitEsc_', 'splitMoney_', 'splitNum_', 'splitKitOn_', 'splitStateChip_', 'splitErrColor_', 'splitWarnBox_', 'splitCheckCell_', 'splitBaseKind_', 'splitCheckLabel_', 'splitDetRows_', 'splitDetailPanelHtml_', 'splitFixPanelHtml_'];
function mk(src, kit) {
  const ctx = { console, location: { search: '' }, document: { readyState: 'complete', addEventListener() {} }, _custLinkHtml_: (p, h) => h, _srIsAdmin_: () => true, splitFixSumHtml_: () => 'sum', splitFixDefaultText_: () => 'A = 1', splitFixCodeNy_: x => String(x) };
  ctx._srState = { fixOpen: true, fix: { edits: {}, data: { total: 2, rows: [
    { code: 'M1', ngay: '02/11', khach: 'An', sdt: '0901', posVal: 1e7, the: ['A'], baseSum: 9e6, lechTien: -1e6, base: [{ ma: 'B1', ngay: '01/11', saleBan: 'A', giaTri: 9e6, trangThai: 'ok', tinh: true }] },
    { code: 'M2', ngay: '03/11', khach: 'Bình', sdt: '0902', posVal: 5e6, the: [], baseSum: 5e6, lechTien: 0, base: [] }] }, extra: [], extraErr: true } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((kit ? fs.readFileSync(path.join(root, 'js/68-ui-kit.js'), 'utf8') + '\n' : '') + vr(src, 'SPLIT_DET_POS_HEAD') + vr(src, 'SPLIT_DET_BASE_HEAD') + '\n' + NAMES.map(n => fn(src, n)).join('\n'), ctx); return ctx;
}
const DET = { from: '2026-11-01', to: '2026-11-15', summary: { posOrders: 1, posTotal: 1e7, posShare: 5e6, check: { lech: 2, khop: 3, khongCoBase: 4, goiY: 1 } }, pos: [] };
const run = (src, kit) => { const c = mk(src, kit); return { p: c.splitDetailPanelHtml_({ tab: 'pos', sale: 'A', data: DET }), f: c.splitFixPanelHtml_(), fe: (c._srState.fix.err = 'Lỗi <x>', c.splitFixPanelHtml_()) }; };
const text = h => h.replace(/<[^>]+>/g, '|').replace(/[🔴🟢⚪]/gu, '').split('|').map(x => x.trim()).filter(Boolean);
const a = run(old, false), b0 = run(cur, false), b = run(cur, true);
// 15/11: bảng Sửa lệch thêm 1 dòng ghi chú thứ tự ưu tiên (file kế toán → admin → Base) — chủ ý thêm, cắt riêng dòng đó rồi mới so với bản cũ.
const noNote = h => h.replace(/<div style="font-size:12px;color:var\(--text-muted\);margin:4px 0">Thứ tự áp dụng:[\s\S]*?<\/div>/, '');
for (const k of ['p', 'f', 'fe']) t(a[k] === noNote(b0[k]), k + ': thiếu js/68 → HTML y hệt bản cũ (trừ dòng ghi chú ưu tiên)');
for (const k of ['p', 'f', 'fe']) { const miss = text(a[k]).filter(x => !text(b[k]).includes(x)); t(!miss.length, k + ': qua ui-kit đủ chữ/số bản cũ' + (miss.length ? ' — THIẾU: ' + miss.join(' | ') : '')); }
t(/ui-tone-danger[^>]*><i class="ui-dot"><\/i>2 đơn LỆCH Base/.test(b.p) && /ui-tone-success[^>]*><i class="ui-dot"><\/i>3 khớp/.test(b.p) && /ui-tone-neutral[^>]*><i class="ui-dot"><\/i>4 không có đơn Base/.test(b.p), 'tóm tắt đối chiếu: 3 chip đỏ/xanh/xám');
t(/\(1 đơn đối chiếu theo gợi ý SĐT/.test(b.p), 'giữ dòng chú gợi ý SĐT');
t(/ui-tone-danger[^>]*><i class="ui-dot"><\/i>lệch -/.test(b.f) && /ui-tone-warning[^>]*><i class="ui-dot"><\/i>lệch người bán/.test(b.f), 'Sửa lệch: lệch tiền → chip đỏ, lệch người bán → chip vàng');
t(!/#c0392b|#b9770e/.test(b.f + b.fe), 'Sửa lệch: không còn màu cứng'); t(/Lỗi &lt;x&gt;/.test(b.fe) && !/&amp;lt;/.test(b.fe), 'lỗi escape đúng 1 lần');
t(/onclick="splitFixSave_\(0\)"/.test(b.f) && /oninput="splitFixEdit_\(0,this.value\)"/.test(b.f) && /splitFixLoad_\(\)/.test(b.f), 'giữ nguyên nút Lưu / ô nhập / Tải lại');
if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');

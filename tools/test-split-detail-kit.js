#!/usr/bin/env node
// R7d-2 — Đơn chia sale: khung cảnh báo + chip đối chiếu Base của panel chi tiết sale / báo cáo M qua ui-kit; thiếu js/68 → HTML y hệt bản cũ (commit dcec0ba). Chạy: node tools/test-split-detail-kit.js
const fs = require('fs'), vm = require('vm'), cp = require('child_process'), path = require('path');
const root = path.join(__dirname, '..'), F = 'js/50-split-orders.js';
const cur = fs.readFileSync(path.join(root, F), 'utf8');
const old = cp.execSync('git show dcec0ba:' + F, { cwd: root, maxBuffer: 1 << 26 }).toString('utf8');
function fn(src, n) { const i = src.indexOf('function ' + n + '('); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
function vr(src, n) { const m = src.match(new RegExp('var ' + n + ' = [^;]*;')); return m ? m[0] : ''; }
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
const NAMES = ['splitPhoneKey_', 'splitEsc_', 'splitMoney_', 'splitNum_', 'splitPct_', 'splitTile_', 'splitStatGrid_', 'splitKitOn_', 'splitStateChip_', 'splitErrColor_', 'splitWarnBox_', 'splitCheckCell_', 'splitBaseKind_', 'splitCheckLabel_', 'splitDetRows_', 'splitDetailPanelHtml_', 'splitReportHtml_'];
function mk(src, kit) {
  const ctx = { console, location: { search: '' }, document: { readyState: 'complete', addEventListener() {} }, _custLinkHtml_: (p, h) => h };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((kit ? fs.readFileSync(path.join(root, 'js/68-ui-kit.js'), 'utf8') + '\n' : '') + 'var SPLIT_TILE_TONE_ = { blue: "info", green: "success", orange: "warning", purple: "brand" };\n' + vr(src, 'SPLIT_DET_POS_HEAD') + vr(src, 'SPLIT_DET_BASE_HEAD') + '\n' + NAMES.map(n => fn(src, n)).join('\n'), ctx); return ctx;
}
const DET = { from: '2026-11-01', to: '2026-11-15', warnings: ['Thiếu đơn <Base> & kế toán'], summary: { posOrders: 3, posTotal: 3e7, posShare: 1.5e7, check: { lech: 1, khop: 1, khongCoBase: 1 } },
  pos: [{ date: '02/11', month: '11/2026', name: 'An', phone: '0901', note: '', sales: 'A, B', product: 'Nhẫn', total: 1e7, share: 5e6, baseCheck: { status: 'lech', baseSales: ['A'], missing: ['B'], extra: [], baseCodes: ['X1'] }, fbKey: 'k1' },
         { date: '03/11', month: '11/2026', name: 'Bình', phone: '0902', note: '', sales: 'A, B', product: 'Lắc', total: 1e7, share: 5e6, baseCheck: { status: 'khop', baseSales: ['A', 'B'], missing: [], extra: [], baseCodes: [] } },
         { date: '04/11', month: '11/2026', name: 'Chi', phone: '0903', note: '', sales: 'A, B', product: 'Vòng', total: 1e7, share: 5e6, baseCheck: { status: 'khong' } }] };
const REP = { from: '2026-11-01', to: '2026-11-15', warnings: ['Cảnh báo báo cáo M'], total: { orders: 1, revenue: 1, aov: 1, splitOrders: 1, splitRevenue: 1, splitAov: 1 }, bySale: [] };
const M = { tab: 'pos', sale: 'A', data: DET };
const run = (src, kit) => { const c = mk(src, kit); return { p: c.splitDetailPanelHtml_(M), m: c.splitReportHtml_(REP, '', null) }; };
const text = h => h.replace(/<[^>]+>/g, '|').replace(/[🔴🟢⚪]/gu, '').split('|').map(x => x.trim()).filter(Boolean);
const a = run(old, false), b0 = run(cur, false), b = run(cur, true);
t(a.p === b0.p, 'panel chi tiết: thiếu js/68 → HTML y hệt bản cũ'); t(a.m === b0.m, 'báo cáo M: thiếu js/68 → HTML y hệt bản cũ');
for (const [nm, k] of [['panel chi tiết', 'p'], ['báo cáo M', 'm']]) {
  const miss = text(a[k]).filter(x => !text(b[k]).includes(x)); t(!miss.length, nm + ': qua ui-kit đủ chữ/số bản cũ' + (miss.length ? ' — THIẾU: ' + miss.join(' | ') : ''));
  t(!/#fff7ed|#fed7aa|#9a3412/.test(b[k]), nm + ': không còn màu cứng của khung cảnh báo'); t(/var\(--ui-warning-soft\)/.test(b[k]), nm + ': khung cảnh báo dùng token ui-warning');
}
t(/Thiếu đơn &lt;Base&gt; &amp; kế toán/.test(b.p) && !/&amp;amp;|&amp;lt;/.test(b.p + b.m), 'cảnh báo escape đúng 1 lần (không escape đôi)');
t(/ui-chip ui-tone-danger[^>]*><i class="ui-dot"><\/i>LỆCH Base/.test(b.p), 'cột Đối chiếu: LỆCH → chip đỏ');
t(/ui-chip ui-tone-success[^>]*><i class="ui-dot"><\/i>Khớp Base/.test(b.p), 'cột Đối chiếu: Khớp → chip xanh');
t(/ui-chip ui-tone-neutral[^>]*><i class="ui-dot"><\/i>Không có đơn Base để đối chiếu/.test(b.p), 'cột Đối chiếu: không có Base → chip xám');
t(/data-fb-key="k1"/.test(b.p) && /data-m-tab="pos"/.test(b.p) && /data-m-xlsx="1"/.test(b.p), 'giữ nguyên ô Sale phản hồi + nút tab/xuất (bộ bắt click không đổi)');
if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');

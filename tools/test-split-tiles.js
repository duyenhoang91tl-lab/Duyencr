#!/usr/bin/env node
// R7d-1 — Đơn chia sale: thẻ số của banner "Danh sách đơn chia" + báo cáo M dùng uiStatGrid_; thiếu js/68 → thẻ màu cũ y hệt. Chạy: node tools/test-split-tiles.js
const fs = require('fs'), vm = require('vm'), cp = require('child_process'), path = require('path');
const root = path.join(__dirname, '..'), F = 'js/50-split-orders.js';
const cur = fs.readFileSync(path.join(root, F), 'utf8');
const old = cp.execSync('git show ed2cf2c:' + F, { cwd: root, maxBuffer: 1 << 26 }).toString('utf8');
function fn(src, n) { const i = src.indexOf('function ' + n + '('); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
const NAMES = ['splitPhoneKey_', 'splitEsc_', 'splitMoney_', 'splitNum_', 'splitPct_', 'splitTile_', 'splitStatGrid_', 'splitBannerHtml_', 'splitDetailHtml_', 'splitReportHtml_'];
function mk(src, kit) {
  const ctx = { console, location: { search: '' }, document: { readyState: 'complete', addEventListener() {} }, _custLinkHtml_: (p, h) => h };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((kit ? fs.readFileSync(path.join(root, 'js/68-ui-kit.js'), 'utf8') + '\n' : '') + 'var SPLIT_TILE_TONE_ = { blue: "info", green: "success", orange: "warning", purple: "brand" };\n' + NAMES.map(n => fn(src, n)).join('\n'), ctx); return ctx;
}
const BANNER = { from: '2026-11-01', to: '2026-11-15', all: false, summary: { orders: 7, revenue: 12500000, customers: 5, value: 30000000 }, items: [{ date: '2026-11-02 10:00', phone: '0901', name: 'An', product: 'Nhẫn', value: 5e6, share: 2.5e6, frac: 0.5, withSales: ['B'] }] };
const REP = { from: '2026-11-01', to: '2026-11-15', total: { orders: 100, revenue: 9e8, aov: 9e6, splitOrders: 20, splitRevenue: 2e8, splitAov: 1e7, splitPctOrders: 20, splitPctRevenue: 22.2 }, bySale: [{ name: 'A & B', orders: 10, revenue: 1e8, aov: 1e7, splitOrders: 3, splitRevenue: 3e7, splitAov: 1e7 }] };
const run = (src, kit) => { const c = mk(src, kit); return { b: c.splitBannerHtml_(BANNER, { quick: 'month', from: '', to: '' }), m: c.splitReportHtml_(REP, '', null) }; };
const text = h => h.replace(/<[^>]+>/g, '|').split('|').map(x => x.trim()).filter(Boolean);
const a = run(old, false), b0 = run(cur, false), b = run(cur, true);
t(a.b === b0.b, 'banner: thiếu js/68 → HTML y hệt bản cũ'); t(a.m === b0.m, 'báo cáo M: thiếu js/68 → HTML y hệt bản cũ');
for (const [nm, k] of [['banner', 'b'], ['báo cáo M', 'm']]) {
  const miss = text(a[k]).filter(x => !text(b[k]).includes(x)); t(!miss.length, nm + ': thẻ số qua ui-kit đủ chữ/số bản cũ' + (miss.length ? ' — THIẾU: ' + miss.join(' | ') : ''));
  t(!/pro-kpi/.test(b[k]) && /ui-stat-grid/.test(b[k]), nm + ': dùng thẻ ui-stat, không còn thẻ màu pro-kpi');
}
t((b.b.match(/class="ui-stat /g) || []).length === 4, 'banner: 4 thẻ'); t((b.m.match(/class="ui-stat /g) || []).length === 6, 'báo cáo M: 6 thẻ (2 hàng × 3)');
t(!/&amp;amp;|&amp;lt;/.test(b.m + b.b), 'không bị escape đôi'); t(/A &amp; B/.test(b.m) && !/A & B/.test(b.m.replace(/&amp;/g, '')), 'tên sale có & vẫn escape đúng 1 lần ở bảng (phần không đụng tới)');
t(/margin-bottom:10px/.test(b.m) && /margin-bottom:14px/.test(b.m), 'giữ khoảng cách giữa các hàng thẻ như cũ');
t(['Số đơn chia', 'Doanh thu từ đơn chia', 'Số khách', 'Giá trị đơn gốc'].every(x => text(b.b).includes(x)) && text(b.b).includes('7'), 'banner: nhãn + số đơn đúng');
if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');

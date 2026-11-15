#!/usr/bin/env node
// R2 — kiểm bộ thành phần ui-* (js/68-ui-kit.js + css/20-kit.css). Chạy: node tools/test-ui-kit.js (không cần cài thêm; phần DOM tự bỏ qua nếu không có jsdom).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const K = require(path.join(ROOT, 'js/68-ui-kit.js'));
const css = fs.readFileSync(path.join(ROOT, 'css/20-kit.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const jsSrc = fs.readFileSync(path.join(ROOT, 'js/68-ui-kit.js'), 'utf8');
let fail = 0;
const ok = m => console.log('ok   ' + m), bad = m => { fail++; console.log('FAIL ' + m); };
const t = (c, m) => c ? ok(m) : bad(m);

// (1) mọi class ui-* viết trong js/68 đều có định nghĩa trong css/20 (trừ tiền tố ghép "ui-tone-" + tên đã khai và id trang mẫu)
const used = new Set(); for (const m of jsSrc.matchAll(/['" ]((?:ui)-[a-z][a-z0-9-]*)(?=[ '"])/g)) used.add(m[1]);
const defined = new Set(); for (const m of css.matchAll(/\.(ui-[a-z][a-z0-9-]*)/g)) defined.add(m[1]);
const IGNORE = new Set(['ui-kit-page', 'ui-kit', 'ui-tone-']);   // id/tiền tố
const missing = [...used].filter(c => !defined.has(c) && !IGNORE.has(c) && !/^ui-tone-$/.test(c));
t(!missing.length, 'mọi class ui-* trong JS đều có CSS' + (missing.length ? ' — THIẾU: ' + missing.join(', ') : ' (' + used.size + ' class)'));
for (const n of ['brand', 'success', 'warning', 'danger', 'info', 'neutral']) if (!defined.has('ui-tone-' + n)) bad('thiếu .ui-tone-' + n);

// (2) escape
const xss = '<img src=x onerror=alert(1)>';
const h = K.uiStat_({ label: xss, value: xss, note: xss, icon: xss });
t(!/<img/i.test(h), 'uiStat_ escape mọi chữ truyền vào');
// (3) delta
t(/ui-delta">▲ 12\.5%/.test(K.uiStat_({ label: 'a', value: '1', delta: 12.5 })), 'delta dương: ▲ xanh');
t(/ui-delta down">▼ 4%/.test(K.uiStat_({ label: 'a', value: '1', delta: -4 })), 'delta âm: ▼ đỏ nhạt (down)');
t(/ui-delta">Mới</.test(K.uiStat_({ label: 'a', value: '1', delta: 'Mới' })), 'delta chữ giữ nguyên');
t(!/ui-delta/.test(K.uiStat_({ label: 'a', value: '1' })), 'không có delta thì không vẽ nhãn');
t(/ui-tone-brand/.test(K.uiStat_({ label: 'a', value: '1', tone: 'hack"onclick' })), 'tone lạ → về brand (không chèn được thuộc tính)');
// (4) trang mẫu dựng được
t(/ui-stat-grid/.test(K.uiKitHtml_()), 'trang mẫu dựng được');
console.log(fail ? '\n' + fail + ' lỗi' : '\ntất cả đạt'); process.exit(fail ? 1 : 0);

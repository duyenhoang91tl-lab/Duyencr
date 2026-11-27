#!/usr/bin/env node
// Đo dung lượng web CRM SAU KHI NÉN (cần chạy `node tools/build-dist.js` trước): node tools/measure-load.js [--check]
// In: số file, tổng gzip/minify, 8 file nặng nhất, số hẹn giờ lặp & số chỗ biết ẩn tab. Có --check → vượt NGÂN SÁCH thì exit 1 (chạy trong CI trước khi deploy).
// Ngân sách (đặt ~13% trên số đo 26/11/2026: js 686 KB gz, css 54 KB gz, file nặng nhất 43 KB gz) — muốn nới thì sửa BUDGET ở đây KÈM lý do trong HANDOFF.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const BUDGET = { jsGzKB: 780, cssGzKB: 70, maxFileGzKB: 60 };
const dist = process.env.DIST_DIR || path.join(__dirname, '..', 'dist');
function sizes(dir, ext) { const d = path.join(dist, dir); if (!fs.existsSync(d)) return []; return fs.readdirSync(d).filter(f => f.endsWith(ext)).map(f => { const b = fs.readFileSync(path.join(d, f)); return { f, min: b.length, gz: zlib.gzipSync(b, { level: 6 }).length }; }); }
const js = sizes('js', '.js'), css = sizes('css', '.css');
if (!js.length) { console.log('Chưa có dist/js — chạy node tools/build-dist.js trước.'); process.exit(2); }
const kb = n => Math.round(n / 1024), sum = (a, k) => a.reduce((s, x) => s + x[k], 0);
const jsGz = kb(sum(js, 'gz')), cssGz = kb(sum(css, 'gz')), top = js.slice().sort((a, b) => b.gz - a.gz);
console.log('JS : ' + js.length + ' file · ' + jsGz + ' KB gzip · ' + kb(sum(js, 'min')) + ' KB sau nén');
console.log('CSS: ' + css.length + ' file · ' + cssGz + ' KB gzip');
console.log('Nặng nhất:'); top.slice(0, 8).forEach(x => console.log('  ' + String(kb(x.gz)).padStart(4) + ' KB gz  ' + x.f));
const src = path.join(__dirname, '..', 'js'); let iv = 0, vis = 0;
if (fs.existsSync(src)) fs.readdirSync(src).filter(f => f.endsWith('.js')).forEach(f => { const t = fs.readFileSync(path.join(src, f), 'utf8'); iv += (t.match(/setInterval\(/g) || []).length; vis += (t.match(/document\.hidden|visibilityState|visibilitychange/g) || []).length; });
console.log('Hẹn giờ lặp setInterval: ' + iv + ' · chỗ có xét ẩn tab: ' + vis);
let bad = 0; const over = (n, v, lim) => { if (v > lim) { bad++; console.log('VƯỢT NGÂN SÁCH ' + n + ': ' + v + ' > ' + lim); } };
over('JS gzip KB', jsGz, BUDGET.jsGzKB); over('CSS gzip KB', cssGz, BUDGET.cssGzKB); over('file JS nặng nhất gzip KB', kb(top[0].gz), BUDGET.maxFileGzKB);
console.log(bad ? 'VƯỢT NGÂN SÁCH' : 'Trong ngân sách (JS ≤ ' + BUDGET.jsGzKB + ' · CSS ≤ ' + BUDGET.cssGzKB + ' · 1 file ≤ ' + BUDGET.maxFileGzKB + ' KB gzip)');
process.exit(bad && process.argv.includes('--check') ? 1 : 0);

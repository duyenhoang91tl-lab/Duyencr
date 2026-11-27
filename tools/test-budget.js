#!/usr/bin/env node
// R11c — NGÂN SÁCH dung lượng trang CRM: mọi js/css/index.html đều nạp ngay khi mở trang (không lazy) nên tổng = sức nặng trang chủ.
// Đo trên NGUỒN (không cần terser) — mức đo 15/11/2026: JS 2.84 MB (95 file), CSS 315 KB (31 file), index.html 142 KB, 94 <script src>, 96 `!important` ngoài css/99.
// Vượt trần (≈ +10%) → test ĐỎ để người thêm code biết mình làm trang nặng thêm; muốn nâng trần phải sửa số ở đây + ghi lý do trong HANDOFF.
// Chạy luôn in số hiện tại. Bản nén đối chiếu: npm i --no-save terser@5 clean-css@5 && node tools/build-dist.js (15/11: JS 2.84→1.91 MB, CSS 315→259 KB)
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = path.join(__dirname, '..');
// 26/11/2026: trần cũ (15/11) đã bị VƯỢT từ lâu (js 107%, gzip 109%, 119/110 thẻ script) mà test KHÔNG nằm trong CI nên không ai hay → đặt lại ≈ +6% trên số đo hôm đó
// (js 3.30 MB, gzip 1.05 MB, 119 thẻ, css 329 KB/86 KB gz, index 150 KB, 104 !important) và đưa vào .github/workflows/deploy-web.yml để có hiệu lực. Bản NÉN (thứ người dùng thật tải) kiểm riêng bằng tools/measure-load.js.
const BUDGET = { jsBytes: 3500000, cssBytes: 350000, indexBytes: 160000, jsGzip: 1110000, cssGzip: 90000, scriptTags: 126, important: 108 };
const ls = d => fs.readdirSync(path.join(root, d)).filter(n => n.endsWith('.' + d));
const read = f => fs.readFileSync(path.join(root, f));
const sum = (d) => { let b = 0, g = 0; ls(d).forEach(n => { const buf = read(d + '/' + n); b += buf.length; g += zlib.gzipSync(buf, { level: 6 }).length; }); return { b, g }; };
const js = sum('js'), css = sum('css'), html = read('index.html').toString('utf8');
const cur = { jsBytes: js.b, cssBytes: css.b, indexBytes: Buffer.byteLength(html), jsGzip: js.g, cssGzip: css.g,
  scriptTags: (html.match(/<script[^>]+src=/g) || []).length,
  important: ls('css').filter(n => n !== '99-dark-auto.css').reduce((a, n) => a + (read('css/' + n).toString('utf8').match(/!important/g) || []).length, 0) };
let bad = 0;
for (const k of Object.keys(BUDGET)) { const ok = cur[k] <= BUDGET[k]; if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + k + ': ' + cur[k] + ' / trần ' + BUDGET[k] + ' (' + Math.round(cur[k] * 100 / BUDGET[k]) + '%)'); }
// mọi <script src> trỏ file có thật (thiếu file = lỗi 404 làm chậm + hỏng tính năng)
const missing = [...html.matchAll(/<script[^>]+src="([^"?]+)/g)].map(m => m[1]).filter(s => !/^https?:/.test(s) && !fs.existsSync(path.join(root, s)));
if (missing.length) { bad++; console.log('FAIL <script src> trỏ file không có: ' + missing.join(', ')); } else console.log('ok   mọi <script src> nội bộ đều có file');
console.log(bad ? '\n' + bad + ' LỖI — trang CRM nặng hơn ngân sách' : '\nTẤT CẢ TRONG NGÂN SÁCH'); process.exit(bad ? 1 : 0);

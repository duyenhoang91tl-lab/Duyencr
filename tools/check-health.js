#!/usr/bin/env node
// Kiểm tra "sức khoẻ" web CRM (không cần trình duyệt): node tools/check-health.js
// LỖI (exit 1): thẻ script/css trỏ file không tồn tại · cùng 1 file nạp 2 lần · JS sai cú pháp · thẻ js/css thiếu ?v= (bust cache khi sửa) · hàm toàn cục MỚI bị định nghĩa ở >1 file
// (file nạp sau ĐÈ file nạp trước mà không ai hay — chỉ 2 trường hợp cũ nằm trong ALLOW_DUP vì đã xem xét, xem HANDOFF 2026-11-26).
// CẢNH BÁO (không làm hỏng): file js/css không được nạp bằng thẻ nào trong index.html và tên không xuất hiện trong mã (có thể là file mồ côi).
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'); let errors = 0, warns = 0;
const err = m => { errors++; console.log('LỖI   ', m); }, warn = m => { warns++; console.log('CẢNH BÁO', m); };
const ALLOW_DUP = { _roleLabel: 'js/40 (cấu hình vai trò) đè bản cũ ở js/08 — chủ ý', proEsc_: 'js/36 đè js/33, cùng chức năng (36 escape thêm dấu nháy đơn)' };
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const refs = []; let m;
const re = /<(?:script[^>]*\ssrc|link[^>]*\shref)="((?:js|css)\/[^"?]+)(\?[^"]*)?"/g;
while ((m = re.exec(html))) refs.push({ file: m[1], q: m[2] || '' });
const seen = {};
refs.forEach(r => {
  if (!fs.existsSync(path.join(root, r.file))) err('index.html trỏ tới file KHÔNG tồn tại: ' + r.file);
  if (seen[r.file]) err('index.html nạp 2 lần: ' + r.file); seen[r.file] = 1;
  if (!/\?v=\w+/.test(r.q)) err('thẻ thiếu ?v= (không bust được cache khi sửa): ' + r.file);
});
const jsFiles = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f);
const cssFiles = fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css')).map(f => 'css/' + f);
const defs = {}, allText = [];
jsFiles.forEach(f => {
  const t = fs.readFileSync(path.join(root, f), 'utf8'); allText.push(t);
  try { new vm.Script(t, { filename: f }); } catch (e) { err('sai cú pháp ' + f + ': ' + e.message); }
  (t.match(/^(?:async\s+)?function\s+[A-Za-z0-9_$]+\s*\(/gm) || []).forEach(x => { const n = x.replace(/^(?:async\s+)?function\s+/, '').replace(/\s*\($/, ''); (defs[n] = defs[n] || new Set()).add(f); });
});
Object.keys(defs).forEach(n => { if (defs[n].size > 1 && !ALLOW_DUP[n]) err('hàm toàn cục "' + n + '" định nghĩa ở nhiều file (file nạp sau đè file trước): ' + [...defs[n]].join(', ')); });
const joined = allText.join('\n') + html;
jsFiles.concat(cssFiles).forEach(f => { if (!seen[f] && !joined.includes(path.basename(f))) warn('file không được nạp ở đâu (mồ côi?): ' + f); });
console.log('\n' + refs.length + ' thẻ js/css · ' + jsFiles.length + ' file js · ' + cssFiles.length + ' file css · ' + errors + ' lỗi · ' + warns + ' cảnh báo');
process.exit(errors ? 1 : 0);

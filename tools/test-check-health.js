#!/usr/bin/env node
// Test chính công cụ kiểm tra sức khoẻ: dựng dự án giả rồi xem nó bắt đúng lỗi. Chạy: node tools/test-check-health.js
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
function run(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-')); fs.mkdirSync(d + '/tools'); fs.mkdirSync(d + '/js'); fs.mkdirSync(d + '/css');
  fs.copyFileSync(__dirname + '/check-health.js', d + '/tools/check-health.js');
  Object.keys(files).forEach(f => fs.writeFileSync(path.join(d, f), files[f]));
  const r = cp.spawnSync('node', [d + '/tools/check-health.js'], { encoding: 'utf8' }); return { code: r.status, out: r.stdout };
}
const idx = tags => '<html><head>' + tags + '</head></html>';
let r = run({ 'index.html': idx('<script src="js/a.js?v=1"></script><link rel="stylesheet" href="css/a.css?v=1">'), 'js/a.js': 'function f(){}', 'css/a.css': 'a{}' });
ok(r.code === 0, 'dự án sạch → exit 0');
r = run({ 'index.html': idx('<script src="js/a.js"></script>'), 'js/a.js': 'function f(){}' });
ok(r.code === 1 && r.out.includes('thiếu ?v='), 'thiếu ?v= → lỗi');
r = run({ 'index.html': idx('<script src="js/zz.js?v=1"></script>') });
ok(r.code === 1 && r.out.includes('KHÔNG tồn tại'), 'trỏ file không tồn tại → lỗi');
r = run({ 'index.html': idx('<script src="js/a.js?v=1"></script><script src="js/a.js?v=2"></script>'), 'js/a.js': 'var x=1' });
ok(r.code === 1 && r.out.includes('nạp 2 lần'), 'nạp trùng → lỗi');
r = run({ 'index.html': idx('<script src="js/a.js?v=1"></script><script src="js/b.js?v=1"></script>'), 'js/a.js': 'function dup(){}', 'js/b.js': 'function dup(){return 1}' });
ok(r.code === 1 && r.out.includes('"dup"'), 'hàm toàn cục trùng giữa 2 file → lỗi');
r = run({ 'index.html': idx('<script src="js/a.js?v=1"></script>'), 'js/a.js': 'function (' });
ok(r.code === 1 && r.out.includes('sai cú pháp'), 'JS sai cú pháp → lỗi');
r = run({ 'index.html': idx('<script src="js/a.js?v=1"></script>'), 'js/a.js': 'var x=1', 'js/orphan.js': 'var y=2' });
ok(r.code === 0 && r.out.includes('mồ côi'), 'file mồ côi chỉ CẢNH BÁO, không làm hỏng');
console.log(bad ? bad + ' LỖI' : 'ĐẠT'); process.exit(bad ? 1 : 0);

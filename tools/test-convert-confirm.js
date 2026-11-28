#!/usr/bin/env node
// Test tools/convert-confirm.js bằng dự án giả. Chạy: node tools/test-convert-confirm.js
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
function run(files, html, apply) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-')); fs.mkdirSync(d + '/js'); Object.keys(files).forEach(f => fs.writeFileSync(d + '/js/' + f, files[f])); fs.writeFileSync(d + '/index.html', html || '<html></html>');
  const r = cp.spawnSync('node', [__dirname + '/convert-confirm.js', '--files', Object.keys(files).map(f => 'js/' + f).join(',')].concat(apply ? ['--apply'] : []), { encoding: 'utf8', env: Object.assign({}, process.env, { CONVERT_ROOT: d }) });
  return { out: r.stdout, code: (f) => fs.readFileSync(d + '/js/' + f, 'utf8') };
}
const A = f => 'x.js';
let r = run({ 'x.js': "async function a(){\n  if (!confirm('Xóa?')) return;\n  go();\n}\n" }, '', true);
ok(r.code('x.js').includes("(await uiConfirm('Xóa?'))") && !/[^i]confirm\(/.test(r.code('x.js')), 'hàm đã async: đổi thẳng');
r = run({ 'x.js': "function del(i){\n  if (!confirm('Xóa?')) return;\n  rm(i);\n}\n" }, '<button onclick="del(3)">x</button>', true);
ok(r.code('x.js').startsWith('async function del') && r.code('x.js').includes('await uiConfirm'), 'hàm thường, chỉ gọi từ onclick đơn lẻ: thêm async + đổi');
r = run({ 'x.js': "function ask(){ if (!confirm('ok?')) return false; return true; }\nfunction use(){ if (ask()) go(); }\n" }, '', true);
ok(r.code('x.js').includes("confirm('ok?')") && !r.code('x.js').includes('uiConfirm') && r.out.includes('dùng giá trị trả về'), 'có nơi dùng giá trị trả về: BỎ, giữ confirm gốc');
r = run({ 'x.js': "var h = \"<button onclick=\\\"if(!confirm('Xóa?'))return;del()\\\">x</button>\";\n" }, '', true);
ok(!r.code('x.js').includes('uiConfirm'), 'confirm trong chuỗi onclick HTML: BỎ');
r = run({ 'x.js': "function f(list){\n  list.forEach(function(x){ if (!confirm('x?')) return; go(x); });\n}\n" }, '', true);
ok(!r.code('x.js').includes('uiConfirm') && r.out.includes('sai cú pháp'), 'confirm trong callback lồng (await sai cú pháp): hoàn lại');
r = run({ 'x.js': "function f(e){\n  if (!confirm('x?')) return;\n  e.preventDefault();\n}\n" }, '', true);
ok(!r.code('x.js').includes('uiConfirm') && r.out.includes('preventDefault'), 'preventDefault sau khi hỏi: BỎ');
r = run({ 'x.js': "function f(){\n  if (!confirm('x?')) return;\n  var a = event.target;\n}\n" }, '', true);
ok(!r.code('x.js').includes('uiConfirm') && r.out.includes('`event`'), 'dùng event sau khi hỏi: BỎ');
r = run({ 'x.js': "// confirm('x') ví dụ trong comment\nfunction closeBox(force){ if (!force && dirty && !confirm('Bỏ?')) return; hide(); }\n" }, '', true);
ok(!r.code('x.js').includes('uiConfirm') && r.out.includes('giữ confirm gốc'), 'comment bị bỏ qua; hàm close* giữ confirm gốc');
r = run({ 'x.js': "function del(i){ if (!confirm('Xóa?')) return; rm(i); }\nfunction other(){ del(1); refresh(); }\n" }, '', true);
ok(!r.code('x.js').includes('uiConfirm') && r.out.includes('thứ tự lệnh'), 'sau lời gọi còn lệnh khác (đảo thứ tự): BỎ');
r = run({ 'x.js': "function f(){ if (typeof confirm==='function' && !confirm('Xóa?')) return; go(); }\n" }, '', true);
ok(r.code('x.js').includes("typeof confirm==='function' && !(await uiConfirm('Xóa?'))"), 'dạng typeof confirm && !confirm(...) đổi đúng, ngoặc khớp');
r = run({ 'x.js': "function f(){ if (!confirm('a (b) \"c\" ' + (x ? 'y)' : 'z'))) return; go(); }\n" }, '<button onclick="f()">', true);
ok(r.code('x.js').includes("(await uiConfirm('a (b) \"c\" ' + (x ? 'y)' : 'z')))"), 'đối số có ngoặc/chuỗi lồng nhau: khớp đúng');
r = run({ 'x.js': "function f(){ if (!confirm('x')) return; go(); }\n" }, '', false);
ok(!r.code('x.js').includes('uiConfirm') && r.out.includes('CHẠY THỬ'), 'không --apply: chỉ in kế hoạch, KHÔNG ghi file');
console.log(bad ? bad + ' LỖI' : 'ĐẠT'); process.exit(bad ? 1 : 0);

#!/usr/bin/env node
// Test ngân sách dung lượng (tools/measure-load.js) bằng dist giả. Chạy: node tools/test-measure-load.js
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
function run(jsKB, n, args) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-')); fs.mkdirSync(d + '/js'); fs.mkdirSync(d + '/css');
  for (let i = 0; i < n; i++) fs.writeFileSync(d + '/js/f' + i + '.js', crypto.randomBytes(Math.round(jsKB * 1024 / n)).toString('base64'));   // base64 ngẫu nhiên: nén ~75%
  fs.writeFileSync(d + '/css/a.css', 'a{}');
  const r = cp.spawnSync('node', [__dirname + '/measure-load.js'].concat(args || []), { encoding: 'utf8', env: Object.assign({}, process.env, { DIST_DIR: d }) }); return { code: r.status, out: r.stdout };
}
let r = run(200, 10, ['--check']); ok(r.code === 0 && r.out.includes('Trong ngân sách'), 'dưới ngân sách → exit 0');
r = run(1300, 20, ['--check']); ok(r.code === 1 && r.out.includes('VƯỢT NGÂN SÁCH JS gzip'), 'tổng JS vượt → exit 1 khi --check');
r = run(1300, 20, []); ok(r.code === 0 && r.out.includes('VƯỢT NGÂN SÁCH'), 'không --check: chỉ báo, không làm hỏng');
r = run(200, 1, ['--check']); ok(r.code === 1 && r.out.includes('file JS nặng nhất'), 'một file quá nặng → exit 1');
console.log(bad ? bad + ' LỖI' : 'ĐẠT'); process.exit(bad ? 1 : 0);

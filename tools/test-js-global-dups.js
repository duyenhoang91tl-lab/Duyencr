// Test: KHONG khai bao trung ten bien/ham toan cuc giua cac file js/*.js khi it nhat 1 ben la let/const/class
// (trinh duyet nem SyntaxError "Identifier 'x' has already been declared" -> file thu 2 KHONG chay, hoac ban dist vo ca trang).
// `var`/`function` trung ten thi JS cho phep nhung de ghi de nhau nen cung bao. Vi du da gap: _vt (let o js/06, var o js/57) 20/10/2026.
// Chay: node tools/test-js-global-dups.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'js');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const decl = {};   // ten -> [{file, kind}]
for (const f of files) {
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
  for (const l of lines) {
    // chi khai bao CAP TREN CUNG (khong thut le) — khai bao trong ham/khoi khong phai toan cuc
    const m = /^(let|const|var|class|async function|function)\s*\*?\s*([A-Za-z_$][\w$]*)/.exec(l); if (!m) continue;
    const kind = m[1].replace('async function', 'function'), name = m[2];
    (decl[name] = decl[name] || []).push({ file: f, kind });
  }
}
let fail = 0;
for (const [name, list] of Object.entries(decl)) {
  const byFile = {}; list.forEach(x => { (byFile[x.file] = byFile[x.file] || new Set()).add(x.kind); });
  const fs_ = Object.keys(byFile); if (fs_.length < 2) continue;
  const lexical = list.some(x => x.kind === 'let' || x.kind === 'const' || x.kind === 'class');
  if (lexical) { fail++; console.log('FAIL: "' + name + '" khai bao o nhieu file, co let/const/class => SyntaxError: ' + fs_.map(f => f + '(' + [...byFile[f]].join('/') + ')').join(', ')); }
  else console.log('warn: "' + name + '" (var/function) khai bao o nhieu file — ghi de nhau: ' + fs_.join(', '));
}
if (!fail) console.log('ok   khong co let/const/class trung ten toan cuc giua ' + files.length + ' file js/');
console.log(fail ? 'CO LOI' : 'ALL JS GLOBAL DUP TESTS PASSED'); process.exit(fail ? 1 : 0);

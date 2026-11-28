#!/usr/bin/env node
// Chuyển confirm(...) gốc → (await uiConfirm(...)) (js/96) một cách AN TOÀN, theo từng đợt file.
//   node tools/convert-confirm.js --files js/07-openassignmodal.js,js/15-fn-hidelogin.js        (chạy thử: chỉ in kế hoạch)
//   node tools/convert-confirm.js --files ... --apply                                           (ghi file)
//   node tools/convert-confirm.js --all [--apply]
// BỎ QUA (in lý do, KHÔNG sửa) khi: dòng comment · nằm trong chuỗi onclick="..." / dạng HTML · không tìm được `function tên(` khai báo ở đầu dòng bao quanh ·
//   hàm bao quanh KHÔNG async mà có nơi gọi DÙNG giá trị trả về (=, return, !, &&, ||, ?, :, tham số) — đổi sang async sẽ trả Promise làm sai logic ·
//   thân hàm dùng `event` (window.event hết hiệu lực sau await) · await rơi vào hàm lồng không async (kiểm bằng cú pháp từng chỗ).
// Mỗi chỗ sửa xong đều kiểm cú pháp cả file; lỗi → hoàn lại chỗ đó.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = process.env.CONVERT_ROOT || path.join(__dirname, '..');
const args = process.argv.slice(2), apply = args.includes('--apply');
let files = [];
if (args.includes('--all')) files = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js') && !/^96-ui-dialogs/.test(f)).map(f => 'js/' + f);
const fi = args.indexOf('--files'); if (fi >= 0) files = args[fi + 1].split(',').filter(Boolean);
if (!files.length) { console.log('Dùng: --files a.js,b.js | --all  [--apply]'); process.exit(2); }
const allSrc = {}; fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).forEach(f => allSrc['js/' + f] = fs.readFileSync(path.join(root, 'js', f), 'utf8'));
const indexHtml = fs.existsSync(path.join(root, 'index.html')) ? fs.readFileSync(path.join(root, 'index.html'), 'utf8') : '';
function balanced(t, open) {   // trả vị trí ký tự ')' khớp, có bỏ qua chuỗi
  let d = 0, q = null;
  for (let i = open; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '(') d++; else if (c === ')') { d--; if (d === 0) return i; }
  }
  return -1;
}
function funcEnd(t, headerIdx) { const b = t.indexOf('{', t.indexOf(')', headerIdx)); let d = 0, q = null; for (let i = b; i < t.length; i++) { const c = t[i]; if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; } if (c === '"' || c === "'" || c === '`') { q = c; continue; } if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return i; } } return -1; }
function valueUsed(name) {   // có nơi nào dùng giá trị trả về của name() không
  const re = new RegExp('(^|[^\\w$.])' + name.replace(/\$/g, '\\$') + '\\s*\\(', 'g');
  for (const f of Object.keys(allSrc).concat(['index.html'])) {
    const t = f === 'index.html' ? indexHtml : allSrc[f]; let m;
    while ((m = re.exec(t))) {
      const before = t.slice(Math.max(0, m.index - 30), m.index + m[1].length).replace(/\s+$/, '');
      if (/(^|[^\w$])(function|async function)\s*$/.test(before + ' ')) continue;   // chính khai báo hàm
      if (/(=|\(|!|&&|\|\||\?|:|,|return|await|\.then)\s*$/.test(before) && !/^on\w+=["'][^"']*$/.test(before)) {
        if (/["']\s*$/.test(before) && /on\w+\s*=\s*["']\s*$/.test(before)) continue;   // onclick="name()" → không dùng giá trị
        return f;
      }
    }
  }
  return null;
}
// Sau khi đổi sang async, mã đứng SAU lời gọi chạy NGAY (không đợi người dùng bấm) → nếu lời gọi không phải câu lệnh cuối của khối thì thứ tự bị đảo → bỏ.
function orderRisk(name) {
  const re = new RegExp('(^|[^\\w$.])' + name.replace(/\$/g, '\\$') + '\\s*\\(', 'g');
  for (const f of Object.keys(allSrc).concat(['index.html'])) {
    const t = f === 'index.html' ? indexHtml : allSrc[f]; let m;
    while ((m = re.exec(t))) {
      const at = m.index + m[1].length, before = t.slice(Math.max(0, at - 24), at);
      if (/function\s*$/.test(before)) continue;                                  // khai báo hàm
      const close = balanced(t, t.indexOf('(', at)); if (close < 0) continue;
      const rest = t.slice(close + 1, close + 400);
      const same = rest.split('\n')[0].replace(/^\s*;?/, '');                    // phần còn lại cùng dòng sau dấu ;
      if (/\S/.test(same) && !/^\s*(\}|["'`)]|\/\/)/.test(same)) return f + ' (còn lệnh sau trên cùng dòng)';
      const inAttr = /on\w+\s*=\s*\\?["'][^"'\n]*$/.test(t.slice(Math.max(0, at - 160), at));
      if (inAttr) { if (/^\s*;\s*[\w$]/.test(rest)) return f + ' (onclick còn lệnh sau)'; continue; }
      const nextLine = rest.split('\n').slice(1).find(l => /\S/.test(l));
      if (/^\s*;?\s*$/.test(rest.split('\n')[0]) && nextLine !== undefined && !/^\s*(\}|\)|\]|["'`]|\/\/|else\b|catch\b|finally\b)/.test(nextLine)) return f + ' (còn lệnh ở dòng sau)';
    }
  }
  return null;
}
let totalDone = 0, totalSkip = 0;
files.forEach(rel => {
  const p = path.join(root, rel); let t = fs.readFileSync(p, 'utf8'); const report = [];
  const sites = []; const re = /(^|[^\w$.])confirm\(/g; let m;
  while ((m = re.exec(t))) sites.push(m.index + m[1].length);
  for (let s = sites.length - 1; s >= 0; s--) {
    const idx = sites[s], lineStart = t.lastIndexOf('\n', idx) + 1, lineEnd = t.indexOf('\n', idx), line = t.slice(lineStart, lineEnd < 0 ? t.length : lineEnd);
    const ln = t.slice(0, idx).split('\n').length, skip = why => { report.push('  bỏ  dòng ' + ln + ': ' + why); totalSkip++; };
    const pre = line.slice(0, idx - lineStart);
    if (/^\s*(\/\/|\*|\/\*)/.test(line) || /\/\/[^'"]*$/.test(pre)) { continue; }
    if (/on[a-z]+\s*=\s*\\?["']/.test(line) || /<[a-z]+[^>]*\sonclick/.test(line) || /Promise\.resolve\(\s*$/.test(pre) || /uiConfirm/.test(line)) { skip('nằm trong chuỗi HTML onclick / đã có hộp thay thế'); continue; }
    const open = idx + 'confirm'.length, close = balanced(t, open); if (close < 0) { skip('không khớp ngoặc'); continue; }
    // hàm khai báo ở đầu dòng bao quanh
    const head = t.slice(0, idx); let hm, last = null; const hre = /^([ \t]*)(async[ \t]+)?function[ \t]+([A-Za-z0-9_$]+)[ \t]*\(/gm;
    while ((hm = hre.exec(head))) last = hm;
    if (!last) { skip('không tìm thấy hàm khai báo bao quanh'); continue; }
    const hEnd = funcEnd(t, last.index); if (hEnd < 0 || hEnd < idx) { skip('đang nằm ngoài hàm tìm được (hàm lồng/biểu thức)'); continue; }
    const isAsync = !!last[2], name = last[3];
    if (/\bevent\b/.test(t.slice(close, hEnd))) { skip('hàm ' + name + ' dùng `event` sau khi hỏi'); continue; }
    if (/preventDefault|stopPropagation|stopImmediatePropagation|returnValue/.test(t.slice(close, hEnd))) { skip('hàm ' + name + ' gọi preventDefault/stopPropagation SAU khi hỏi (vô hiệu sau await)'); continue; }
    if (!isAsync && /^(close|hide|dismiss)|Close$/.test(name)) { skip('hàm đóng/ẩn ' + name + ' (lời gọi hay đi kèm lệnh khác) — giữ confirm gốc'); continue; }
    if (!isAsync) {
      const u = valueUsed(name); if (u) { skip('hàm ' + name + ' không async và có nơi dùng giá trị trả về (' + u + ')'); continue; }
      const o = orderRisk(name); if (o) { skip('hàm ' + name + ' không async và thứ tự lệnh sau lời gọi có thể đảo: ' + o); continue; }
    }
    let nt = t.slice(0, idx) + '(await uiConfirm' + t.slice(open, close + 1) + ')' + t.slice(close + 1);
    if (!isAsync) { const hi = last.index + last[1].length; nt = nt.slice(0, hi) + 'async ' + nt.slice(hi); }
    try { new vm.Script(nt, { filename: rel }); } catch (e) { skip('sau khi đổi sai cú pháp (' + e.message + ') → hoàn lại'); continue; }
    t = nt; totalDone++; report.push('  đổi dòng ' + ln + ': ' + name + (isAsync ? '' : ' (+async)') + '  ' + line.trim().slice(0, 70));
  }
  console.log(rel + ':' + (report.length ? '\n' + report.reverse().join('\n') : ' không có confirm() cần đổi'));
  if (apply) fs.writeFileSync(p, t);
});
console.log('\n' + (apply ? 'ĐÃ GHI' : 'CHẠY THỬ (chưa ghi)') + ' — đổi ' + totalDone + ' chỗ, bỏ ' + totalSkip + ' chỗ.');

#!/usr/bin/env node
// R9c — action=audit&actionPrefix=...: lọc nhật ký theo tiền tố hành động trên TOÀN BỘ sheet (không bị cửa sổ 200 dòng mới nhất cắt).
// Chạy: node tools/test-audit-prefix.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'gas_v13.js'), 'utf8');
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };

function extract(name) {   // lấy nguyên hàm cấp cao theo tên (khớp ngoặc nhọn)
  const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('không thấy ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  throw new Error('không đóng được ' + name);
}
const ctx = {}; vm.createContext(ctx); vm.runInContext(extract('_auditReadByPrefix_'), ctx);
const read = (sh, p, l) => ctx._auditReadByPrefix_(sh, p, l);

// Sheet giả: hàng 1 = tiêu đề; getRange(r,c,n,w).getValues() trả về lát cắt; đếm số lần đọc để kiểm tra không quét thừa.
function sheet(rows) {
  const data = [['timestamp', 'user', 'action', 'phone', 'oldValue', 'newValue']].concat(rows);
  const s = { reads: 0, rowsRead: 0, getLastRow: () => data.length, getRange: (r, c, n) => ({ getValues: () => { s.reads++; s.rowsRead += n; return data.slice(r - 1, r - 1 + n).map(x => x.slice(0, 6)); } }) };
  return s;
}
const row = (i, action) => ['2026-11-' + String(1 + (i % 28)).padStart(2, '0'), 'u' + i, action, '', 'old' + i, 'new' + i];

// 1) cấu hình cũ nằm SÂU dưới 5000 dòng thao tác khách → vẫn tìm thấy (đúng lỗi gốc: cửa sổ 200 dòng bỏ sót)
const deep = []; deep.push(row(0, 'config:setting:roleConfig')); deep.push(row(1, 'config:setting:roleConfig'));
for (let i = 2; i < 5002; i++) deep.push(row(i, 'status'));
let sh = sheet(deep), r = read(sh, 'config:setting:roleConfig', 5);
t(r.length === 2 && r[0].user === 'u1' && r[1].user === 'u0', 'bản ghi nằm dưới 5000 dòng khách vẫn tìm thấy, MỚI NHẤT TRƯỚC (u1 rồi u0)');
t(r[0].action === 'config:setting:roleConfig' && r[0].oldValue === 'old1' && r[0].newValue === 'new1' && 'phone' in r[0], 'mỗi bản ghi đủ 6 trường như action=audit cũ');

// 2) đủ limit thì dừng sớm, không quét cả sheet
const many = []; for (let i = 0; i < 20000; i++) many.push(row(i, i % 2 ? 'config:setting:roleConfig' : 'status'));
sh = sheet(many); r = read(sh, 'config:setting:roleConfig', 5);
t(r.length === 5 && sh.rowsRead <= 1000, 'đủ 5 bản ghi thì dừng ở khối đầu (đọc ' + sh.rowsRead + ' dòng, không quét hết 20000)');
t(r[0].user === 'u19999' && r[4].user === 'u19991', 'thứ tự mới nhất → cũ (u19999 … u19991)');

// 3) trần quét 30000 dòng
const big = []; big.push(row(0, 'config:setting:roleConfig')); for (let i = 1; i < 40001; i++) big.push(row(i, 'status'));
sh = sheet(big); r = read(sh, 'config:setting:roleConfig', 5);
t(r.length === 0 && sh.rowsRead === 30000, 'bản ghi cách đáy >30000 dòng thì bỏ qua, đọc đúng 30000 dòng (' + sh.rowsRead + ')');

// 4) khớp theo TIỀN TỐ, không phải chứa chuỗi
sh = sheet([row(0, 'config:users'), row(1, 'config:setting:roleConfig'), row(2, 'x config:setting:roleConfig'), row(3, 'config:setting:hangKH')]);
t(read(sh, 'config:setting:', 10).map(x => x.user).join() === 'u3,u1', 'tiền tố "config:setting:" khớp u3,u1 — không khớp "x config…" và "config:users"');
t(read(sh, 'config:', 10).length === 3, 'tiền tố "config:" lấy mọi cấu hình (3 dòng), bỏ dòng "x config…"');

// 5) biên: sheet rỗng / chỉ tiêu đề / thiếu sheet / tiền tố rỗng / limit lạ
t(read(sheet([]), 'config:', 5).length === 0, 'sheet chỉ có dòng tiêu đề → []');
t(read(null, 'config:', 5).length === 0 && read(sheet([row(0, 'config:a')]), '', 5).length === 0, 'thiếu sheet hoặc tiền tố rỗng → [] (không lỗi)');
const ten = []; for (let i = 0; i < 300; i++) ten.push(row(i, 'config:a'));
t(read(sheet(ten), 'config:', 'abc').length === 20, 'limit không hợp lệ → mặc định 20');
t(read(sheet(ten), 'config:', 9999).length === 200 && read(sheet(ten), 'config:', 0).length === 20, 'limit bị chặn ở 200; 0 → mặc định 20');
t(read(sheet([row(0, 'config:a'), row(1, 'config:a'), row(2, 'config:a')]), 'config:', 1)[0].user === 'u2', 'limit=1 trả đúng bản ghi mới nhất');

// 6) nhánh cũ của action=audit không đổi: không có actionPrefix thì vẫn là 200 dòng mới nhất
const blk = src.slice(src.indexOf("if (action === 'audit') {"), src.indexOf("if (action === 'dashboard')"));
t(/_apAu \? |if \(_apAu\)/.test(blk) && /Math\.min\(200, lastA - 1\)/.test(blk) && /for \(var ai = vA\.length - 1; ai >= 0; ai--\)/.test(blk), 'action=audit: không có actionPrefix → giữ nguyên đoạn đọc 200 dòng mới nhất');

console.log(fail ? '\n' + fail + ' LỖI' : '\nĐẠT HẾT'); process.exit(fail ? 1 : 0);

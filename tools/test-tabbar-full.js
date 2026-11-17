// R15: thanh tab hồ sơ đáy (#pro-tabbar) phải phủ HẾT chiều ngang (right:0) — trước đây right:84px làm khung hồng/xanh hụt 1 góc bên phải (ảnh Duyên 15/11).
// Chỗ chừa cho chuông nhắc hẹn + dock AI nằm ở padding-right (các tab không chui dưới nút nổi), không phải ở mép khung.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const css = fs.readFileSync(path.join(__dirname, '../css/06-pro.css'), 'utf8');
const rule = (css.match(/html\.ui-pro #pro-tabbar\{[^}]*\}/) || [''])[0];
ok(rule, 'tìm thấy luật #pro-tabbar');
ok(/left:0;right:0;/.test(rule), 'khung phủ tới mép phải (right:0)');
const pr = (rule.match(/padding:0 (\d+)px 0 \d+px/) || [])[1];
ok(Number(pr) >= 76, 'chừa >= 76px bên phải cho chuông nhắc hẹn (52px + 16px) bằng padding-right, hiện ' + pr);
ok(/box-sizing:border-box/.test(rule), 'border-box để padding không làm tràn ngang');
// các luật khác (shell/sunset) không được đặt lại right
['css/13-shell.css', 'css/19-theme-sunset.css', 'css/07-teamchat.css'].forEach(f => {
  const t = fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); (t.match(/#pro-tabbar\s*\{[^}]*\}/g) || []).forEach(r => ok(!/[^-]right:\s*\d/.test(r), f + ': không đặt lại right cho #pro-tabbar'));
});
console.log('PASS', pass, 'FAIL', fail); process.exit(fail ? 1 : 0);

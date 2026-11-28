// Form tai khoan: chon thang cho Truong nhom (js/15). Chay: node tools/test-lead-account.js
const fs = require('fs'), path = require('path'), { JSDOM } = require('jsdom');
const s = fs.readFileSync(path.join(__dirname, '..', 'js', '15-fn-hidelogin.js'), 'utf8');
const grab = n => { const m = s.match(new RegExp('^function ' + n + '\\([\\s\\S]*?\\n}\\n', 'm')); if (!m) throw new Error(n); return m[0]; };
let fail = 0; const ok = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); if (!v) fail++; };
const w = new JSDOM('<body><div id="b"></div></body>', { runScripts: 'outside-only' }).window;
w.eval(grab('_acctMonthsHtml_') + grab('_acctCollectMonths_'));
w.document.getElementById('b').innerHTML = w._acctMonthsHtml_(['2024-06']);
const y = new Date().getFullYear();
ok('co nam nay, nam truoc va nam da chon truoc do', w.document.querySelectorAll('.acct-month-chk').length === 36);
[4, 5].forEach(m => { w.document.querySelector('[data-ym="' + y + '-0' + m + '"]').checked = true; });
ok('thu thap dung yyyy-MM, giu thang da chon', JSON.stringify(w._acctCollectMonths_()) === JSON.stringify(['2024-06', y + '-04', y + '-05']));
ok('addAccount luu viewMonths chi cho leader', /rec\.viewMonths = \(_roleBaseOf\(role\) === 'leader'\) \? _acctCollectMonths_\(\) : \[\];/.test(s));
ok('form co o chon thang + an/hien theo vai tro', s.includes('id="acct-months-wrap"') && /monthWrap\.style\.display/.test(s));
process.exit(fail ? 1 : 0);

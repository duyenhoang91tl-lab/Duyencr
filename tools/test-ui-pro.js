// Test P0 giao diện PRO: mọi selector trong css/06-pro.css phải nằm dưới html.ui-pro; ngoặc cân; <html class="ui-pro"> cố định, không còn công tắc.
const fs=require('fs');let bad=0;const ok=(c,m)=>{if(!c){bad++;console.log('FAIL',m)}else console.log('ok  ',m)};
const css=fs.readFileSync('css/06-pro.css','utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g,'');   // bỏ khối @keyframes: bước from/to không phải selector (tên keyframes là toàn cục nhưng vô hại)
ok((css.match(/{/g)||[]).length===(css.match(/}/g)||[]).length,'ngoặc {} cân');
const rules=css.replace(/@media[^{]*\{/g,'').split('}').map(r=>r.split('{')[0].trim()).filter(Boolean);
const un=rules.filter(r=>r.split(',').some(s=>!s.trim().startsWith('html.ui-pro')));
ok(un.length===0,'mọi selector bắt đầu bằng html.ui-pro'+(un.length?' — lỗi: '+un.join(' | '):''));
const html=fs.readFileSync('index.html','utf8');
ok(html.includes('css/06-pro.css'),'index.html nạp 06-pro.css');
ok(/<html[^>]*class="[^"]*\bui-pro\b/.test(html),'<html> có class ui-pro cố định (giao diện pro là mặc định)');
ok(!/Công tắc giao diện PRO/.test(html)&&!/ui_mode/.test(html)&&!/ui=classic/.test(html),'đã bỏ công tắc ?ui=pro / localStorage ui_mode');
ok(/html\.ui-pro header\{/.test(css)&&/html\.ui-pro #data-view \.tabs\{/.test(css),'có da header + ngăn kéo menu (P0b)');
const badSel=c=>c.replace(/@media[^{]*\{/g,'').split('}').map(r=>r.split('{')[0].trim()).filter(Boolean).filter(r=>r.split(',').some(x=>!x.trim().startsWith('html.ui-pro')));
ok(badSel(css+' .pro-x{color:red}').length===1&&badSel(css+' @media (max-width:900px){ .pro-y{color:red} }').length===1,'(tự kiểm) selector thiếu html.ui-pro VẪN bị bắt (kể cả trong @media) dù đã bỏ @keyframes');
process.exit(bad?1:0);
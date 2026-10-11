// Test P0 giao diện PRO: mọi selector trong css/06-pro.css phải nằm dưới html.ui-pro; ngoặc cân; công tắc trong index.html chạy đúng.
const fs=require('fs');let bad=0;const ok=(c,m)=>{if(!c){bad++;console.log('FAIL',m)}else console.log('ok  ',m)};
const css=fs.readFileSync('css/06-pro.css','utf8').replace(/\/\*[\s\S]*?\*\//g,'');
ok((css.match(/{/g)||[]).length===(css.match(/}/g)||[]).length,'ngoặc {} cân');
const rules=css.split('}').map(r=>r.split('{')[0].trim()).filter(Boolean);
const un=rules.filter(r=>r.split(',').some(s=>!s.trim().startsWith('html.ui-pro')));
ok(un.length===0,'mọi selector bắt đầu bằng html.ui-pro'+(un.length?' — lỗi: '+un.join(' | '):''));
const html=fs.readFileSync('index.html','utf8');
ok(html.includes('css/06-pro.css'),'index.html nạp 06-pro.css');
const sc=html.match(/<script>\/\* Công tắc[\s\S]*?<\/script>/);ok(!!sc,'có khối công tắc');
const code=sc[1]||sc[0].replace(/^<script>|<\/script>$/g,'');new Function(code);ok(true,'công tắc đúng cú pháp');
function run(search,store){const cl=new Set(),st=Object.assign({},store);
 new Function('document','location','localStorage','URLSearchParams',code)({documentElement:{classList:{add:c=>cl.add(c)}}},{search},{getItem:k=>st[k]||null,setItem:(k,v)=>st[k]=v},URLSearchParams);return [cl.has('ui-pro'),st.ui_mode]}
ok(run('',{})[0]===false,'mặc định = bản cũ');
ok(run('?ui=pro',{})[0]===true,'?ui=pro bật');
ok(run('',{ui_mode:'pro'})[0]===true,'nhớ lựa chọn');
ok(run('?ui=classic',{ui_mode:'pro'})[0]===false,'?ui=classic tắt');
process.exit(bad?1:0);

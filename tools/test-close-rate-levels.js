// Test mốc màu "Tỷ lệ chốt" nhiều mức (js/01 + js/11). Chạy: NODE_PATH=<nơi cài jsdom> node tools/test-close-rate-levels.js
const {JSDOM}=require('jsdom');const fs=require('fs'),path=require('path'),vm=require('vm');
const rd=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const j1=rd('js/01-fn-splitmulti.js'),j11=rd('js/11-fn-srload.js');
const a1=j1.indexOf('// ── Mốc màu "Tỷ lệ chốt" nhiều mức'),b1=j1.indexOf('async function _syncCloseRateThresholdsFromGAS');
const a2=j1.indexOf('async function _saveCloseRateThresholds'),b2=j1.indexOf('async function _syncHiddenPageSaleFromGAS');
const a3=j11.indexOf('function _srCloseRateBarHtml_'),b3=j11.indexOf('function _srCocTh()');
const dom=new JSDOM('<body><div id="host"></div></body>',{runScripts:'dangerously'});const w=dom.window;
const posts=[],toasts=[],audits=[];let renders=0;
w.fetch=async(u,o)=>{posts.push(o&&o.body?JSON.parse(o.body):u);return{json:async()=>({})}};
Object.assign(w,{gsUrl:'https://gs/x',toast:m=>toasts.push(m),logAudit:(...a)=>audits.push(a.join('|')),saveLS(){},loadLS(){return null},
  esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),currentUser:{role:'admin'},
  renderSalesReportTab(){renders++},renderKpiPancakeTab(){},_activeV9Tab:'salesreport',CLOSE_RATE_THRESHOLDS:null});
vm.runInContext('',dom.getInternalVMContext());
w.eval(j1.slice(a1,b1)+j1.slice(a2,b2)+j11.slice(a3,b3)+';CLOSE_RATE_THRESHOLDS=_crNormalize_(null);');
let ok=0,bad=0;const t=(n,v)=>{console.log((v?'OK  ':'FAIL')+' '+n);v?ok++:bad++;};
const ev=c=>w.eval(c);
(async()=>{
// 1) tương thích ngược: cấu hình cũ {red,green} cho màu y hệt hàm cũ ở MỌI tỷ lệ nguyên 0..100
const oldColor=(p,th)=>p>th.green?'#16a34a':(p>=th.red?'#d97706':'#dc2626');
let same=true;[{red:2,green:10},{red:1.1,green:10.5},{red:5,green:20},{red:0,green:30},{red:30,green:50}].forEach(th=>{
  w.__th=th;ev('CLOSE_RATE_THRESHOLDS=_crNormalize_(__th)');
  for(let p=0;p<=100;p++) if(ev('_crColorFor_('+p+')')!==oldColor(p,th)) {same=false;console.log('  lech',JSON.stringify(th),p,ev('_crColorFor_('+p+')'),oldColor(p,th));}
});t('cấu hình cũ {red,green} → màu GIỐNG HỆT cũ ở mọi tỷ lệ nguyên (kể cả mốc thập phân 1,1 / 10,5)',same);
// 2) 5 mức
w.__t={levels:[{from:0,color:'#dc2626'},{from:3,color:'#ea580c'},{from:6,color:'#eab308'},{from:10,color:'#84cc16'},{from:15,color:'#16a34a'}]};
ev('CLOSE_RATE_THRESHOLDS=_crNormalize_(__t)');
const exp=p=>p>=15?'#16a34a':p>=10?'#84cc16':p>=6?'#eab308':p>=3?'#ea580c':'#dc2626';
let ok5=true;for(let p=0;p<=100;p++) if(ev('_crColorFor_('+p+')')!==exp(p)) ok5=false;
t('5 mức 5 màu: đúng màu ở mọi tỷ lệ 0..100 (mốc 3/6/10/15)',ok5);
// 3) chuẩn hoá dữ liệu xấu
const norm=x=>{w.__x=x;return ev('_crNormalize_(__x)').levels;};
t('rỗng/null/sai kiểu → mặc định 3 mức',norm(null).length===3&&norm({})&&norm({levels:'x'}).length===3&&norm(5).length===3);
t('1 mức → mặc định; 9 mức → mặc định',norm({levels:[{from:0,color:'#ff0000'}]}).length===3&&norm({levels:Array.from({length:9},(_,i)=>({from:i*10,color:'#112233'}))}).length===3);
t('màu sai định dạng bị loại; mốc ngoài 0–100 bị loại',norm({levels:[{from:0,color:'red'},{from:5,color:'#aabbcc'},{from:50,color:'#112233'},{from:150,color:'#445566'}]}).length===2);
const messy=norm({levels:[{from:20,color:'#111111'},{from:5,color:'#222222'},{from:5,color:'#333333'},{from:2,color:'#444444'}]});
t('nhập lộn xộn → tự sắp tăng dần, bỏ trùng mốc, mức đầu = 0',messy[0].from===0&&messy.every((x,i)=>!i||x.from>messy[i-1].from)&&messy.length===3);
// 4) hiển thị
ev('CLOSE_RATE_THRESHOLDS=_crNormalize_(__t)');
w.__rows=[{name:'An',held:100,closed:2,closeRate:2},{name:'Binh',held:100,closed:12,closeRate:12},{name:'Chi',held:100,closed:20,closeRate:20}];
w.document.getElementById('host').innerHTML=ev('_srCloseRateBarHtml_(__rows,"","tương tác")');
const host=w.document.getElementById('host');
t('chú thích có 5 ô màu',(host.innerHTML.match(/■/g)||[]).length===5);
t('chú thích đúng nhãn mức (<3% … 6–9% … ≥15%)',/&lt;3%/.test(host.innerHTML)&&/6–9%/.test(host.innerHTML)&&/≥15%/.test(host.innerHTML));
const barColors=[...host.querySelectorAll('div[style*="height:100%"]')].map(d=>d.style.background);
t('thanh màu đúng theo mức: 2% đỏ, 12% xanh lá nhạt, 20% xanh đậm',barColors.join()==='rgb(22, 163, 74),rgb(132, 204, 22),rgb(220, 38, 38)');
const form=host.querySelector('.close-rate-edit-form');
t('form sửa mặc định ẨN (không chiếm chỗ)',form&&form.style.display==='none');
t('form có 5 dòng, dòng đầu khoá "từ 0"',form.querySelectorAll('.cr-row').length===5&&form.querySelector('.cr-from').disabled===true);
w.currentUser.role='cs';host.innerHTML=ev('_srCloseRateBarHtml_(__rows,"","x")');t('không phải admin → không có form/nút sửa',!host.querySelector('.close-rate-edit-form')&&!/sửa mốc/.test(host.innerHTML));w.currentUser.role='admin';
host.innerHTML=ev('_srCloseRateBarHtml_(__rows,"","x")');
// 5) thao tác form
const F=()=>host.querySelector('.close-rate-edit-form'),btn=txt=>[...F().querySelectorAll('button')].find(b=>b.textContent.includes(txt));
const rows=()=>F().querySelectorAll('.cr-row');
btn('Thêm mức').click();btn('Thêm mức').click();btn('Thêm mức').click();
t('thêm mức tới tối đa 8',rows().length===8);
btn('Thêm mức').click();t('thêm quá 8 bị chặn + báo',rows().length===8&&toasts.slice(-1)[0].includes('Tối đa 8'));
t('mức mới có mốc tăng dần (lớn hơn mức cuối)',[...rows()].map(r=>parseFloat(r.querySelector('.cr-from').value)).every((v,i,a)=>!i||v>a[i-1]));
for(let i=0;i<6;i++) rows()[rows().length-1].querySelector('button').click();
t('xoá về còn 2 mức',rows().length===2);
rows()[1].querySelector('button').click();t('xoá khi còn 2 mức bị chặn + báo',rows().length===2&&toasts.slice(-1)[0].includes('ít nhất 2'));
btn('Về mặc định').click();t('về mặc định → 3 mức 0/2/11',rows().length===3&&[...rows()].map(r=>r.querySelector('.cr-from').value).join()==='0,2,11');
// sửa thành 5 mức rồi lưu
F().querySelector('.cr-rows').innerHTML='';
[[0,'#dc2626'],[3,'#ea580c'],[6,'#eab308'],[10,'#84cc16'],[15,'#16a34a']].forEach(([f,c],i)=>F().querySelector('.cr-rows').insertAdjacentHTML('beforeend',ev('_srCrRowHtml_('+f+',"'+c+'",'+(i===0)+')')));
posts.length=0;renders=0;btn('Lưu').click();
t('lưu 5 mức: cập nhật biến + vẽ lại báo cáo',ev('CLOSE_RATE_THRESHOLDS.levels.length')===5&&renders===1);
await new Promise(r=>setTimeout(r,20));
const post=posts.find(p=>p&&p.action==='setSetting');
t('lưu 5 mức: gửi setSetting closeRateThresholds dạng {levels}',post&&post.key==='closeRateThresholds'&&JSON.parse(post.value).levels.length===5);
t('lưu: có ghi nhật ký thay đổi',audits.some(a=>a.includes('mốc màu')&&a.includes('≥15%')));
// lỗi nhập
host.innerHTML=ev('_srCloseRateBarHtml_(__rows,"","x")');
F().querySelector('.cr-rows').innerHTML='';
[[0,'#dc2626'],[5,'#ea580c'],[5,'#16a34a']].forEach(([f,c],i)=>F().querySelector('.cr-rows').insertAdjacentHTML('beforeend',ev('_srCrRowHtml_('+f+',"'+c+'",'+(i===0)+')')));
const before=JSON.stringify(ev('CLOSE_RATE_THRESHOLDS'));btn('Lưu').click();
t('2 mức trùng mốc → báo lỗi, KHÔNG lưu',toasts.slice(-1)[0].includes('trùng mốc 5%')&&JSON.stringify(ev('CLOSE_RATE_THRESHOLDS'))===before);
F().querySelectorAll('.cr-from')[2].value='abc';btn('Lưu').click();t('mốc không phải số → báo lỗi, KHÔNG lưu',toasts.slice(-1)[0].includes('không hợp lệ')&&JSON.stringify(ev('CLOSE_RATE_THRESHOLDS'))===before);

console.log('\n'+ok+' OK, '+bad+' FAIL');process.exit(bad?1:0);
})();

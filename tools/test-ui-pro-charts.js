// Test P3b/c: _srChartSvg — (1) ui-pro TẮT: đầu ra GIỐNG HỆT bản gốc (git HEAD~) cho mọi kiểu gọi; (2) ui-pro BẬT: ô số màu + bảng màu pro + thanh bo tròn.
const fs=require('fs'),vm=require('vm'),cp=require('child_process');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
function fn(src,name){let i=src.indexOf('function '+name+'(');if(i<0)throw new Error('thiếu '+name);let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1)}}}
const cur=fs.readFileSync('js/10-fn-pkkpipct.js','utf8');
const base=process.env.BASE_REF?cp.execSync('git show '+process.env.BASE_REF+':js/10-fn-pkkpipct.js',{encoding:'utf8'}):null;
const colors=fs.readFileSync(require('fs').existsSync('js/16-main-currentuser.js')?'js/16-main-currentuser.js':'js/10-fn-pkkpipct.js','utf8');
const allJs=fs.readdirSync('js').map(f=>fs.readFileSync('js/'+f,'utf8')).join('\n');
const cm=/(?:var|const|let)\s+_SR_CHART_COLORS\s*=\s*\[[^\]]*\]/.exec(allJs);if(!cm)throw new Error('không thấy _SR_CHART_COLORS');
const stubs=cm[0]+';var esc=function(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")};var fmt=function(n){return (Number(n)||0).toLocaleString("vi-VN")};var _srMoney=function(n){return fmt(n)+"đ"};';
function mk(src,pro){const ctx={document:{documentElement:{classList:{contains:c=>pro&&c==='ui-pro'}}}};vm.createContext(ctx);
 vm.runInContext(stubs+fn(src,'_srChartSvg'),ctx);if(pro)vm.runInContext(fs.readFileSync('js/34-pro-charts.js','utf8'),ctx);return ctx._srChartSvg}
const rows=[{name:'An',v:5000000,o:12},{name:'Bình <x>',v:3200000,o:7},{name:'Chi',v:900000,o:3},{name:'',v:100000,o:1},{name:'Zero',v:0,o:0}];
const calls=[['pie',true,'o'],['bar',true,'o'],['pie',true],['bar',true],['pie',false],['bar',false]];
if(base){calls.forEach(c=>{const a=mk(base,false)(rows,'name','v',c[0],c[1],c[2]),b=mk(cur,false)(rows,'name','v',c[0],c[1],c[2]);ok(a===b,'ui-pro TẮT giống hệt bản gốc: '+c.join('/'))});
 ok(mk(base,false)([], 'name','v','pie',true)===mk(cur,false)([], 'name','v','pie',true),'rỗng giống hệt')}
else console.log('(bỏ qua so sánh bản gốc: đặt BASE_REF=<commit> để bật)');
const P=mk(cur,true);
let h=P(rows,'name','v','bar',true,'o');
ok(h.includes('pro-kpi blue')&&h.includes('pro-kpi green')&&h.includes('pro-kpi orange')&&h.includes('>23<'),'PRO bar+đơn: 3 ô số màu, tổng đơn 23');
ok(h.includes('9.200.000đ')&&h.includes('400.000đ'),'PRO: tổng DT 9.200.000đ, TB/đơn 400.000đ (9.2tr/23)');
ok(!h.includes('TỔNG SỐ ĐƠN'),'PRO: không còn dải KPI cũ');
ok(h.includes('border-radius:7px')&&h.includes('height:14px')&&h.includes('#4a2c8f'),'PRO: thanh bo tròn + màu pro');
ok(h.includes('Bình &lt;x&gt;')&&h.includes('(chưa gán)'),'PRO: escape tên + tên rỗng → (chưa gán)');
h=P(rows,'name','v','bar',true);ok(h.includes('pro-kpi purple')&&h.includes('>Tổng<')&&!h.includes('pro-kpi blue'),'PRO bar không có cột đơn: 1 ô Tổng');
h=P(rows,'name','v','pie',true,'o');ok(h.includes('<svg')&&h.includes('#4a2c8f')&&h.includes('#1d4ed8')&&h.includes('pro-kpi green'),'PRO pie: donut + màu pro + ô số');
ok(!P(rows,'name','v','pie',true).includes('pro-kpi'),'PRO pie không cột đơn: giữ TỔNG ở giữa donut, không ô số');
h=P([{name:'a',v:0}],'name','v','pie',false);ok(h.includes('Không có dữ liệu'),'PRO: không dữ liệu → thông báo cũ');
process.exit(bad?1:0);

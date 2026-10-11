// Test: lọc nhanh ngày (Hôm nay, Hôm qua, Tuần này/trước, Tháng này/trước, Quý, Năm) cho AI phân tích team + Tổng quan.
// Trích đúng hàm thật từ js/*.js (không chép lại) rồi chạy với "hôm nay" giả = Chủ nhật 11/10/2026 (ca khó của tuần ISO) và 15/01/2026 (ca qua năm).
const fs=require('fs'),vm=require('vm');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
function fn(file,name){const s=fs.readFileSync(file,'utf8');let i=s.indexOf('function '+name+'(');if(i<0)throw new Error('thiếu '+name);let d=0,j=s.indexOf('{',i);for(let k=j;k<s.length;k++){if(s[k]=='{')d++;else if(s[k]=='}'){d--;if(!d)return s.slice(i,k+1)}}}
const s16=fs.readFileSync('js/16-main-currentuser.js','utf8');const arr=s16.slice(s16.indexOf('var _PK_QUICK_RANGES'),s16.indexOf('];',s16.indexOf('var _PK_QUICK_RANGES'))+2);
const code=[arr,fn('js/04-fn-synczalophonesettingsfromgas.js','_ymd'),fn('js/10-fn-pkkpipct.js','_pkQuickRange'),fn('js/10-fn-pkkpipct.js','_quickRangeSelectHtml'),fn('js/30-fn-teamanalysis.js','_taQuick'),fn('js/31-fn-orgoverview.js','_ovQuick')].join('\n');
function run(y,m,d){const els={'ta-from':{},'ta-to':{},'ov-from':{},'ov-to':{}};let loads=0;
 class FD extends Date{constructor(...a){a.length?super(...a):super(y,m,d,10,0)}}
 const ctx={Date:FD,document:{getElementById:i=>els[i]||null},_ovLoad:()=>{loads++}};vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,els,get loads(){return loads}}}
let t=run(2026,9,11);
const exp={today:['2026-10-11','2026-10-11'],yesterday:['2026-10-10','2026-10-10'],thisWeek:['2026-10-05','2026-10-11'],lastWeek:['2026-09-28','2026-10-04'],thisMonth:['2026-10-01','2026-10-31'],lastMonth:['2026-09-01','2026-09-30'],thisQuarter:['2026-10-01','2026-12-31'],lastQuarter:['2026-07-01','2026-09-30'],thisYear:['2026-01-01','2026-12-31'],lastYear:['2025-01-01','2025-12-31']};
for(const k in exp){t.ctx._taQuick(k);ok(t.els['ta-from'].value===exp[k][0]&&t.els['ta-to'].value===exp[k][1],'AI team · '+k+' '+exp[k].join('→')+' (được '+t.els['ta-from'].value+'→'+t.els['ta-to'].value+')');}
t.ctx._ovQuick('lastWeek');ok(t.els['ov-from'].value==='2026-09-28'&&t.els['ov-to'].value==='2026-10-04'&&t.loads===1,'Tổng quan · Tuần trước + tự tải 1 lần');
t.els['ta-from'].value='X';t.ctx._taQuick('custom');ok(t.els['ta-from'].value==='X','chọn "Tuỳ chỉnh" giữ nguyên ô ngày');
const n0=t.loads;t.ctx._ovQuick('custom');ok(t.loads===n0,'Tổng quan · custom không tải lại');
const h=t.ctx._quickRangeSelectHtml('custom','f(this.value)');
['Hôm nay','Hôm qua','Tuần này','Tuần trước','Tháng này','Tháng trước','Quý này','Quý trước','Năm này','Năm trước'].forEach(l=>ok(h.includes('>'+l+'<'),'select có "'+l+'"'));
t=run(2026,0,15);t.ctx._taQuick('lastQuarter');ok(t.els['ta-from'].value==='2025-10-01'&&t.els['ta-to'].value==='2025-12-31','qua năm: Quý trước = Q4/2025');
t.ctx._taQuick('lastMonth');ok(t.els['ta-from'].value==='2025-12-01'&&t.els['ta-to'].value==='2025-12-31','qua năm: Tháng trước = 12/2025');
process.exit(bad?1:0);

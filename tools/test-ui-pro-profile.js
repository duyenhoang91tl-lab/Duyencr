// Test P2 bước 1: mô phỏng logic bằng dữ liệu thật dạng CRM.
const m=require('../js/33-pro-profile.js');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const tree=[{label:'Chốt',value:'Chốt'},{label:'Phân vân/Tiềm năng',value:'Phân vân/Tiềm năng'},{label:'Đang sd',children:[{label:'Hiệu quả',value:'Đang sd - Hiệu quả'},{label:'Kém',value:'Đang sd - Kém'}]},{label:'Chưa liên hệ',value:'Chưa liên hệ'}];
let s=m.proStageModel_(tree,'Chốt');ok(s.length===4&&s[0].cur&&s.filter(x=>x.cur).length===1,'status lá → đúng 1 giai đoạn hiện tại');
s=m.proStageModel_(tree,'Đang sd - Kém');ok(s[2].cur&&s.filter(x=>x.cur).length===1,'status con → node cha sáng');
s=m.proStageModel_(tree,'');ok(s.every(x=>!x.cur),'status rỗng → không sáng');
s=m.proStageModel_(tree,'Không có trong cây');ok(s.every(x=>!x.cur),'status lạ → không sáng, không lỗi');
ok(m.proStageModel_(null,'x').length===0,'cây rỗng an toàn');
const now=new Date(2026,9,11);
ok(m.proDaysSinceLastOrder_([{date:new Date(2026,9,1)},{date:new Date(2026,6,1)}],now)===10,'lấy đơn GẦN NHẤT (10 ngày)');
ok(m.proDaysSinceLastOrder_([{year:2026,month:9}],now)===40,'đơn chỉ có tháng/năm → từ ngày 1');
ok(m.proDaysSinceLastOrder_([{year:26,month:9}],now)===40,'năm 2 chữ số (26) → 2026');
ok(m.proDaysSinceLastOrder_([],now)===null,'không đơn → null');
ok(m.proDaysSinceLastOrder_([{date:new Date(2027,0,1)}],now)===0,'đơn tương lai → 0, không âm');
let h=m.proKpiHtml_(200,3,12500000);ok(h.includes('pro-kpi red')&&h.includes('12.500.000'),'>180 ngày → đỏ; tiền định dạng');
ok(m.proKpiHtml_(null,0,0).includes('—'),'không đơn → hiện —');
ok(m.proStageHtml_([{label:'<b>',cur:true}]).includes('&lt;b>'),'escape nhãn');
// Gắn vào openDp/renderDpTab bằng DOM giả (vm)
const vm=require('vm'),fs=require('fs');
function sim(proOn){const els={};const tabs={parentNode:{insertBefore:(n,ref)=>{els['dp-pro']=n}}};
 const doc={documentElement:{classList:{contains:c=>proOn&&c==='ui-pro'}},getElementById:id=>els[id]||null,querySelector:()=>tabs,createElement:()=>({set innerHTML(v){this._h=v},get innerHTML(){return this._h},remove(){delete els['dp-pro']}})};
 const calls=[];const ctx={document:doc,console,module:undefined,currentPhone:'0901',careData:{'0901':{status:'Chốt'}},allCustomers:[{phone:'0901',orders:[{date:null,revenue:1000}]}],CARE_STATUS_TREE:tree,_posStatsOn:false,donStatsByPhone:{},_custRev_:()=>1000,
  openDp:function(p){calls.push('open')},renderDpTab:function(t){calls.push('tab')}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/33-pro-profile.js','utf8')+';this.openDp=openDp;this.renderDpTab=renderDpTab;',ctx);
 ctx.allCustomers[0].orders[0].date=vm.runInContext('new Date(Date.now()-5*86400000)',ctx);
 ctx.openDp('0901');ctx.renderDpTab('care');return {calls,host:els['dp-pro']};}
let r=sim(true);ok(r.calls.join()==='open,tab','hàm gốc vẫn được gọi');ok(r.host&&r.host.innerHTML.includes('pro-stage')&&r.host.innerHTML.includes('class="cur"')&&r.host.innerHTML.includes('>5<'),'ui-pro BẬT → chèn thanh giai đoạn + 5 ngày');
r=sim(false);ok(r.calls.join()==='open,tab'&&!r.host,'ui-pro TẮT → không chèn gì, bản cũ nguyên');
process.exit(bad?1:0);

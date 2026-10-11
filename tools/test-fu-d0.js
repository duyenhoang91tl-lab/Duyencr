const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(require('path').join(__dirname,'..','gas_v13.js'),'utf8');
const a=src.indexOf('function runFollowUpScan_'),b=src.indexOf('\n}\n',a)+3;
function run(tpls,off){
 const today=new Date();today.setHours(0,0,0,0);
 const ctx={Object,Array,String,Math,Date,isNaN,parseInt,
  readFollowUpTemplates_:()=>tpls,readFollowUpLogKeys_:()=>({}),_fuConfig_:()=>({start:new Date(2026,4,1),sources:['web'],offDays:off||{}}),
  getCrmSS_:()=>({getSheetByName:()=>1}),SH_CARE:'c',readCare_:()=>[],normPhone_:x=>String(x),
  parseVNDate_:x=>new Date(x),_vnYmd_:d=>d.toISOString().slice(0,10),
  readAllOrders_:()=>[{phone:'0912345678',date:today,source:'web',product:'Vong',name:'A'}],
  fuSourceAllowed_:()=>true,productCodeFromText_:()=>'',FU_CHECKPOINTS:[7],
  renderFollowUpTemplate_:(t,o)=>t+o.days,
 };
 vm.createContext(ctx);vm.runInContext(src.slice(a,b),ctx);
 try{ return JSON.stringify(ctx.runFollowUpScan_()).slice(0,90);}catch(e){return 'PASSED tryAdd -> '+e.message.slice(0,50);}
}
console.log('D0 on :',run({'*|0':'hi'}));
console.log('D0 off:',run({'*|0':'hi'},{0:true}));
console.log('no D0 tpl:',run({'*|7':'hi'}));

// Test P2e GAS: saveFuResults_ / readFuResults_ (Supabase bat, Supabase loi -> sheet, chong trung).
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','gas_v13.js'),'utf8');
const a=src.indexOf("var SH_FU_RESULTS"),b=src.indexOf('function readFollowUpLogKeys_');
function mk(sb){
  const sheet={rows:[FU=>0]}; const data=[['id']]; // header placeholder
  const sh={getLastRow:()=>data.length,getRange:(r,c,n,w)=>({getValues:()=>data.slice(r-1,r-1+n).map(x=>x.slice(c-1,c-1+w)),setValues:v=>{v.forEach((row,i)=>data[r-1+i]=row);}})};
  const sbRows=[]; let sbFail=false;
  const ctx={Logger:{log(){}},jsonOut_:o=>o,normPhone_:x=>String(x).replace(/\D/g,''),Date,Array,Object,String,Number,isNaN,parseInt,
    sbCfg_:()=>({ok:sb}),sbWriteOn_:()=>true,
    sb_:(m,p,body)=>{ if(sbFail) throw new Error('down'); if(m==='POST'){body.forEach(r=>{const i=sbRows.findIndex(x=>x.id===r.id); i<0?sbRows.push(r):sbRows[i]=r;}); return {};} return {json:sbRows}; },
    getSheet_:()=>sh,getCrmSS_:()=>({getSheetByName:()=>sh}),FU_FAIL:()=>{sbFail=true;},data,sbRows};
  vm.createContext(ctx); vm.runInContext(src.slice(a,b),ctx); return ctx;
}
let c=mk(true);
const R=(id,res)=>({id,phone:'0912 345 678',due:'2026-10-11',doneAt:'2026-10-11T08:00:00Z',result:res,by:'Lan',note:'n',redo:''});
console.log(JSON.stringify(c.saveFuResults_([R('dao_09_2026-10-04_7','contacted'),R('dao_09_2026-10-04_7','nopick'),R('x','bad'),R('dao_09_2026-09-10_m1','refused')])));
console.log('supabase rows',c.sbRows.length,c.sbRows[1].milestone,c.sbRows[0].phone);
console.log('doc',c.readFuResults_('2026-10-01','2026-10-31').length);
c.FU_FAIL(); console.log(JSON.stringify(c.saveFuResults_([R('dao_09_2026-10-04_14','resched')])),'sheet rows',c.data.length-1);
console.log(JSON.stringify(c.saveFuResults_([R('dao_09_2026-10-04_14','resched')])),'sau trung',c.data.length-1);
console.log('doc gop',c.readFuResults_('','').length);
c=mk(false); console.log(JSON.stringify(c.saveFuResults_([R('a_0','contacted')])), c.readFuResults_('2026-10-01','2026-10-31')[0].milestone);

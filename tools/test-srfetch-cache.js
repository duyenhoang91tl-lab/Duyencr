// Test bo nho dem + dung chung request cua _srFetch (js/10): chay node tools/test-srfetch-cache.js
const fs=require('fs');
const src=fs.readFileSync(require('path').join(__dirname,'..','js/10-fn-pkkpipct.js'),'utf8');
const a=src.indexOf('var _SR_CACHE_ACTIONS_'); const b=src.indexOf('// Dung chung cho MOI man hinh bao cao');
const code=src.slice(a,b);
let calls=0, mode='ok';
const ctx={gsUrl:'https://x/exec',_srState:{},AbortController,setTimeout,clearTimeout,Date,
 fetch:async(u)=>{calls++; await new Promise(r=>setTimeout(r,30)); if(mode==='http') return {ok:false,status:500}; if(mode==='err') return {ok:true,text:async()=>JSON.stringify({error:'x'})};
   return {ok:true,text:async()=>JSON.stringify({orders:[{a:1}],n:calls})};}};
const vm=require('vm'); vm.createContext(ctx); vm.runInContext(code+';this.F=_srFetch;this.C=_srCacheClear_;',ctx);
(async()=>{
 const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) process.exitCode=1;};
 let [x,y]=await Promise.all([ctx.F('salesReportB',{d:'1'}),ctx.F('salesReportB',{d:'1'})]);
 ok(calls===1,'2 request giong het cung luc = 1 lan fetch (calls='+calls+')');
 x.orders.push({z:1}); ok(y.orders.length===1,'moi noi goi nhan ban sao rieng');
 let z=await ctx.F('salesReportB',{d:'1'}); ok(calls===2,'khong truyen useCache => luon goi lai (calls='+calls+')');
 z=await ctx.F('salesReportB',{d:'1'},true); ok(calls===2 && z.orders.length===1,'useCache=true trong 60s => khong goi (calls='+calls+')');
 await ctx.F('salesReportB',{d:'2'},true); ok(calls===3,'tham so khac => goi moi');
 await ctx.F('storeCaseReport',{d:'1',fresh:'1'},true); await ctx.F('storeCaseReport',{d:'1',fresh:'1'},true); ok(calls===5,'fresh=1 khong cache');
 await ctx.F('getSetting',{k:'a'},true); await ctx.F('getSetting',{k:'a'},true); ok(calls===7,'action khong nam danh sach khong cache');
 ctx.C(); await ctx.F('salesReportB',{d:'1'},true); ok(calls===8,'sau _srCacheClear_ goi lai');
 mode='err'; ctx.C(); let e1=await ctx.F('salesReportB',{d:'9'},true); let n=calls; await ctx.F('salesReportB',{d:'9'},true); ok(e1===null && calls===n+1 && /Máy chủ báo lỗi/.test(ctx._srState.lastFetchError),'loi {error} khong duoc cache va bao loi dung');
 mode='http'; await ctx.F('salesReportA',{d:'9'},true); ok(/HTTP 500/.test(ctx._srState.lastFetchError),'loi HTTP van bao dung');
 mode='ok'; for(let i=0;i<30;i++) await ctx.F('salesReportA',{d:'k'+i},true); ok(Object.keys(vm.runInContext('_srCache_',ctx)).length<=14,'cache gioi han 14 muc');
})();

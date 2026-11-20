// Test phạm vi phòng kinh doanh (Online + Văn phòng) cho mục 1-2 Báo cáo A/B (js/11). Chạy: node tools/test-kd-scope.js
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(__dirname+'/../js/11-fn-srload.js','utf8');
const a=src.indexOf('function _srKdInScope_'), b=src.indexOf('function _srRenderA(d)');
const ctx={_srState:{dateTo:'2026-11-20'},SALE_CHANNELS:{ninhnga99:'online',yenNTH2004:'online',anhtrinh1995:'offline',tuoipham1993:'probation'},
 _saleChannelOn_:(n,y)=>ctx.SALE_CHANNELS[n]||''};
vm.createContext(ctx); vm.runInContext(src.slice(a,b),ctx);
let ok=true; const t=(c,m)=>{ if(!c){ok=false;console.log('FAIL',m);} };
const rows=['ninhnga99','yenNTH2004','anhtrinh1995','tuoipham1993','Duyen Hoang','Public API','Kieu Ngoc'].map(n=>({name:n,held:10,closed:1}));
const r=ctx._srKdScopeRows_(rows).map(x=>x.name);
t(r.join()==='ninhnga99,yenNTH2004,anhtrinh1995','chi online+van phong: '+r);
const d={saleCloseRate:rows,saleCloseByPage:{rows}};
const c=ctx._srKdScopeData_(d);
t(c.saleCloseRate.length===3,'saleCloseRate loc'); t(c.saleCloseByPage.rows.length===7,'muc 3 giu tat ca'); t(d.saleCloseRate.length===7,'d goc khong doi');
ctx.SALE_CHANNELS={}; t(ctx._srKdScopeRows_(rows).length===7,'chua phan loai -> khong loc');
console.log(ok?'OK':'FAILED'); process.exit(ok?0:1);

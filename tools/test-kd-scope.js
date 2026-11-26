// Test phạm vi phòng kinh doanh (Online + Văn phòng) cho mục 1-2 Báo cáo A/B (js/11). Chạy: node tools/test-kd-scope.js
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(__dirname+'/../js/11-fn-srload.js','utf8');
const a=src.indexOf('function _srKdInScope_'), b=src.indexOf('function _srRenderA(d)');
const ctx={_srState:{dateTo:'2026-11-20'},SALE_CHANNELS:{ninhnga99:'online',yenNTH2004:'online',anhtrinh1995:'offline',tuoipham1993:'probation'},
 _saleChannelOn_:(n,y)=>ctx.SALE_CHANNELS[n]||'', esc:x=>String(x)};
vm.createContext(ctx); vm.runInContext(src.slice(a,b),ctx);
let ok=true; const t=(c,m)=>{ if(!c){ok=false;console.log('FAIL',m);} };
const rows=['ninhnga99','yenNTH2004','anhtrinh1995','tuoipham1993','Duyen Hoang','Public API','Kieu Ngoc'].map(n=>({name:n,held:10,closed:1}));
const r=ctx._srKdScopeRows_(rows).map(x=>x.name);
t(r.join()==='ninhnga99,yenNTH2004,anhtrinh1995,tuoipham1993','du phong theo ten: online + van phong + THU VIEC (tuoipham1993 la probation), loai Duyen Hoang/Public API/Kieu Ngoc: '+r);
const d={saleCloseRate:rows,saleCloseByPage:{rows}};
const c=ctx._srKdScopeData_(d);
t(c.saleCloseRate.length===4,'saleCloseRate loc'); t(c.saleCloseByPage.rows.length===7,'muc 3 giu tat ca'); t(d.saleCloseRate.length===7,'d goc khong doi');
ctx.SALE_CHANNELS={}; t(ctx._srKdScopeRows_(rows).length===7,'chua phan loai -> khong loc');

// --- 2026-11-21: co kd tu server (theo NGUOI: Online+Van phong+Thu viec+phong Sale) ---
ctx.SALE_CHANNELS={ninhnga99:'online'};
const rk=[{name:'ninhnga99',kd:true,held:10},{name:'thuongBT',kd:true,held:5},{name:'ngocNM',kd:true,held:7},{name:'Duyen Hoang',kd:false,held:3},{name:'Public API',kd:false,held:2},{name:'Zero',kd:false,held:0,closed:0}];
const rr=ctx._srKdScopeRows_(rk).map(x=>x.name);
t(rr.join()==='ninhnga99,thuongBT,ngocNM','kd:true giu ca ban moi thuongBT/ngocNM du SALE_CHANNELS khong co ten do: '+rr);
const cd=ctx._srKdScopeData_({saleCloseRate:rk});
t(cd.kdHidden.join()==='Duyen Hoang,Public API','kdHidden = nguoi bi an co du lieu (bo dong 0 tuong tac): '+cd.kdHidden);
t(/Đang ẩn <b>2<\/b>/.test(ctx._srKdNoteHtml_(cd))&&ctx._srKdNoteHtml_(cd).includes('Duyen Hoang'),'ghi chu liet ke ai bi an');
t(ctx._srKdNoteHtml_({kdHidden:[]})==='','khong ai bi an -> khong ghi chu');
const mixed=[{name:'ninhnga99',kd:true},{name:'ThuMoi'},{name:'NguoiLa'}]; ctx.SALE_CHANNELS={thumoi:'probation',ThuMoi:'probation'};
t(ctx._srKdScopeRows_(mixed).map(x=>x.name).join()==='ninhnga99,ThuMoi','dong khong co kd (dong don quay moi them) -> du phong theo SALE_CHANNELS, gom Thu viec');
ctx.SALE_CHANNELS={}; t(ctx._srKdScopeRows_([{name:'a'},{name:'b'}]).length===2,'khong kd + chua phan loai ai -> giu het');
console.log(ok?'OK':'FAILED'); process.exit(ok?0:1);

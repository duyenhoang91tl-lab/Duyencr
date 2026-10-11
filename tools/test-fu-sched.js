// Test P2b: lich CS tu dong (checkDataDaoRenewSchedules) theo cau hinh mau tin / fuOffDays / fuStart / fuSources.
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','04-fn-synczalophonesettingsfromgas.js'),'utf8');
function grab(name){const i=src.indexOf('function '+name+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}}
const names=['_isDataDaoRenew','_isNewLeadSource','_ymd','_parseFlexDate','_addDateMonths','_addDateDays','_fuIso_','_fuSrcMatch','_fuMilestonesFromCfg','_fuClientCfgGet','checkDataDaoRenewSchedules'];
function run(cfg, orders, zalo){
  const ctx={console,Date,Object,Array,String,JSON,parseInt,Number,
    _fuCfgState:{loaded:true,loading:false,cfg:cfg},
    DATA_DAO_SOURCES:['data đảo'],NEW_LEAD_SOURCES:['landipage','landing','messenger','capture','web'],
    allCustomers:[{phone:'0912345678',orders:orders,zaloStatus:zalo||''}],schedules:[],
    loadLS:()=>({}),saveLS(k,v){ctx.saved=v;},_remOwnerStamp:()=>({owner:'x'}),syncAutoHenToCareData(){},updateSchedBadges(){},
    careData:{}, _foldVi:s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D'),
    typeof_:0};
  vm.createContext(ctx);
  vm.runInContext('var _fuCfgState=this._fuCfgState;'+names.map(grab).join('\n'),ctx);
  vm.runInContext('checkDataDaoRenewSchedules()',ctx);
  return ctx.schedules.map(s=>s.id.replace('dao_0912345678_','')+' '+s.date);
}
const o=[{source:'web',orderDate:'2026-09-10',date:'2026-09-10'}];
console.log('mac dinh      :',run(null,o).join(' | '));
console.log('cau hinh D0+3 :',run({days:[0,3,7],off:{},start:'',sources:[]},o).join(' | '));
console.log('tat 7         :',run({days:[7,14,30,60],off:{7:true},start:'',sources:[]},o).join(' | '));
console.log('fuStart 10/10 :',run({days:[7],off:{},start:'2026-10-10',sources:[]},o).join(' | ')||'(trong)');
console.log('nguon renew   :',run({days:[7],off:{},start:'',sources:['renew']},[{source:'Renew X',orderDate:'2026-09-10',date:'2026-09-10'}]).join(' | '));
console.log('nguon web khi cfg renew:',run({days:[7],off:{},start:'',sources:['renew']},o).join(' | ')||'(trong)');

console.log('don hoan     :',run(null,[{source:'web',orderDate:'2026-09-10',date:'2026-09-10',status:'Đã hoàn'}]).join(' | ')||'(trong)');
console.log('don huy      :',run(null,[{source:'web',orderDate:'2026-09-10',date:'2026-09-10',status:'Hủy'}]).join(' | ')||'(trong)');
console.log('khach chan   :',run(null,o,'Chặn').join(' | ')||'(trong)');
console.log('zalo ngung hd:',run(null,o,'Zalo ngừng hd').join(' | ')||'(trong)');
console.log('da ket ban   :',run(null,o,'Đã kết bạn').length,'viec');
console.log('2 don cung ngay moc:',run({days:[7],off:{},start:'',sources:[]},[{source:'web',orderDate:'2026-09-10',date:'2026-09-10'},{source:'web',orderDate:'2026-09-10',date:'2026-09-10',status:'x'}]).length,'viec (ky vong 1)');
console.log('don dang giao khong bi loai:',run(null,[{source:'web',orderDate:'2026-09-10',date:'2026-09-10',status:'Đang giao'}]).length,'viec');

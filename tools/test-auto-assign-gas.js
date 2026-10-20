// Test chia tu dong (gas_v13.js): ly do khi khong chia duoc, tu thu lai khi loi truoc luc chia, giu khoa khi da chia mot phan, kiemTraChiaTuDong.
// Chay: node tools/test-auto-assign-gas.js
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','gas_v13.js'),'utf8');
const m=/function isValidVnPhone_\(p\) \{[\s\S]*?\n\}\n/.exec(src)[0];
const aa=src.slice(src.indexOf("var AA_TZ"),src.indexOf('function caiTriggerChiaTuDong'));
let ok=0,fail=0;const t=(n,v)=>{console.log((v?'OK  ':'FAIL')+' '+n);v?ok++:fail++;};
const settings={},saved=[],cared=[];let triggers=1,loadThrow=null,careThrow=null,custs=[];
const NOW=new Date('2026-10-14T03:00:00Z');   // 10h sang gio VN (T4)
const ctx={Logger:{log(){}},
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
 Utilities:{formatDate:(d,tz,f)=>{const v=new Date(d.getTime()+7*3600e3);const iso=v.toISOString();return f==='yyyy-MM-dd'?iso.slice(0,10):f==='H'?String(v.getUTCHours()):f==='u'?String(v.getUTCDay()||7):iso}},
 getSetting_:k=>settings[k]||'',setSetting_:(k,v)=>{settings[k]=v},
 ScriptApp:{getProjectTriggers:()=>Array.from({length:triggers},()=>({getHandlerFunction:()=>'autoAssignTick_'}))},
 CacheService:{getScriptCache:()=>({remove(){}})},
 readTeams_:()=>[{id:'T1',name:'Van Phong',leader:'Lan',members:['Lan','Minh']}],getCrmSS_:()=>({getSheetByName:()=>({})}),SH_TEAM:'Team',
 saveAssignEntry_:e=>saved.push(e),console,Date:class extends Date{constructor(...a){a.length?super(...a):super(NOW.getTime())}},JSON,Math,Object,Array,String,Number,Set,Map,parseInt,isNaN};
vm.createContext(ctx);vm.runInContext(m+'\n'+aa+';this.api={run:autoAssignRun_,why:_aaWhyEmpty_,check:kiemTraChiaTuDong,plan:_aaPlanAll};',ctx);
ctx._aaLoadCustomers_=()=>{if(loadThrow)throw new Error(loadThrow);return{custs:custs,ever:{}}};
ctx._aaSetCareCS_=(map)=>{if(careThrow)throw new Error(careThrow);cared.push(map);return Object.keys(map).length};
const mk=(n,dates)=>({phone:'09'+String(10000000+n),ds:dates,dataSrc:{dt:true,don:true},tier:'',hangKey:'thuong'});
const cfgOf=(o)=>Object.assign({enabled:true,days:[0,1,2,3,4,5,6],runHour:7,onlyUnassigned:true,dateFrom:'2026-01-01',dateTo:'2026-08-31',dailyTotal:0,
  teams:{T1:{on:true,mode:'count',val:5}},memberMode:{T1:'pct'},members:{},src:{mode:'pct',vals:{}},prio:{mode:'pct',vals:{}},hang:{mode:'pct',vals:{}}},o||{});
const reset=(cfg)=>{Object.keys(settings).forEach(k=>delete settings[k]);settings.autoAssignCfg=JSON.stringify(cfg);saved.length=0;cared.length=0;loadThrow=null;careThrow=null;triggers=1;};
// 1) KH POS co don NGOAI khoang ngay (thang 9) -> khong chia, phai NOI RO ly do (khong im lang)
custs=[1,2,3,4,5,6].map(n=>mk(n,['2026-09-10']));reset(cfgOf());
let r=ctx.api.run(false);
t('KH ngoai khoang ngay don: khong chia ca nao',r.people===0&&saved.length===0);
t('co canh bao NOI RO ly do + so KH sau tung buoc loc',r.warn.length===1&&/khoang 2026-01-01 den 2026-08-31/.test(r.warn[0])&&r.diag.total===6&&r.diag.validPhone===6&&r.diag.afterDate===0);
// 2) trong khoang -> chia duoc
custs=[1,2,3,4,5,6].map(n=>mk(n,['2026-05-10']));reset(cfgOf());
r=ctx.api.run(false);
t('KH trong khoang ngay don: chia duoc (quota 5/nguoi)',r.people>0&&r.total>0&&saved.length===r.people&&cared.length===1);
t('danh dau da chay hom nay (khong chia lai)',JSON.parse(settings.autoAssignState).lastRun==='2026-10-14'&&ctx.api.run(false).skipped==='hom nay da chia');
// 3) tat ca da tung chia -> ly do
custs=[1,2,3].map(n=>mk(n,['2026-05-10']));reset(cfgOf());ctx._aaLoadCustomers_=()=>({custs:custs,ever:{[custs[0].phone]:1,[custs[1].phone]:1,[custs[2].phone]:1}});
r=ctx.api.run(false);t('da chia het: bao ro "da tung duoc chia"',r.people===0&&/da tung duoc chia/.test(r.warn[0])&&r.diag.unassigned===0);
ctx._aaLoadCustomers_=()=>{if(loadThrow)throw new Error(loadThrow);return{custs:custs,ever:{}}};
// 4) khong co nguoi nhan (team chua tich) -> ly do
custs=[1,2,3].map(n=>mk(n,['2026-05-10']));reset(cfgOf({teams:{T1:{on:false,mode:'count',val:5}}}));
r=ctx.api.run(false);t('chua tich Team: bao ro khong co nguoi nhan / han muc',r.people===0&&/khong co nguoi nhan hoac han muc = 0/.test(r.warn[0]));
// 5) LOI truoc khi chia (vd het han muc UrlFetch) -> MO KHOA de gio sau tu thu lai
custs=[1,2,3,4,5,6].map(n=>mk(n,['2026-05-10']));reset(cfgOf());loadThrow='Service invoked too many times for one day: urlfetch.';
r=ctx.api.run(false);let st=JSON.parse(settings.autoAssignState);
t('loi truoc luc chia: tra loi + retry=true',!!r.error&&r.retry===true&&r.partial===false);
t('lastRun KHONG bi khoa ca ngay (de tick sau chay lai) + ghi lastError',st.lastRun!=='2026-10-14'&&/urlfetch/.test(st.lastError.msg)&&st.lastError.partial===false);
loadThrow=null;r=ctx.api.run(false);st=JSON.parse(settings.autoAssignState);
t('tick sau (het loi): chia duoc va xoa lastError',r.people>0&&saved.length>0&&st.lastRun==='2026-10-14'&&!st.lastError);
// 6) LOI SAU khi da chia mot phan (gan CS that bai) -> GIU khoa (tranh chia trung) nhung bao loi
custs=[1,2,3,4,5,6].map(n=>mk(n,['2026-05-10']));reset(cfgOf());careThrow='ghi that bai';
r=ctx.api.run(false);st=JSON.parse(settings.autoAssignState);
t('loi sau khi da luu lich su chia: partial=true, KHONG retry',r.partial===true&&r.retry===false&&saved.length>0);
t('giu khoa hom nay (khong chia trung) + lastError.partial',st.lastRun==='2026-10-14'&&st.lastError.partial===true);
// 7) chay thu (force) khong dong den lastRun cu khi loi
reset(cfgOf());settings.autoAssignState=JSON.stringify({lastRun:'2026-10-13'});loadThrow='x';r=ctx.api.run(true);
t('force loi: khong doi lastRun cu',JSON.parse(settings.autoAssignState).lastRun==='2026-10-13'&&!!r.error);
// 8) kiemTraChiaTuDong: chua cai trigger + ke hoach + KHONG ghi gi
custs=[1,2,3,4].map(n=>mk(n,['2026-09-10']));reset(cfgOf());triggers=0;loadThrow=null;
const before=JSON.stringify(settings),info=ctx.api.check();
t('kiemTra: bao CHUA CAI TRIGGER',/CHUA CAI TRIGGER/.test(info.canhBao)&&info.trigger===0);
t('kiemTra: ke hoach cho thay buoc loc lam ve 0 + ly do, khong ghi gi',info.keHoachHomNay.locTungBuoc.afterDate===0&&/khoang ngay/.test(info.keHoachHomNay.lyDo)&&JSON.stringify(settings)===before&&saved.length===0&&cared.length===0);
t('kiemTra: cau hinh tom tat dung',info.cauHinh.soTeamDaTich===1&&info.cauHinh.tuNgay==='2026-01-01'&&info.cauHinh.chiChuaChia===true);
console.log(fail?('FAILED '+fail):'ALL AUTO-ASSIGN TESTS PASSED');process.exit(fail?1:0);

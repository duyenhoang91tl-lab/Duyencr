#!/usr/bin/env node
// Test phan quyen vai tro + bo phan (gas_v13.js): chuan hoa cau hinh, base cua vai tro, quyen hang muc (vai tro AND bo phan, perms rieng), ai duoc luu.
// Chay: node tools/test-roles.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','gas_v13.js'),'utf8');
const ctx={console,Date,JSON,Math,parseInt,isNaN,String,Object,Array,RegExp,
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  ContentService:{createTextOutput:s=>({setMimeType:()=>JSON.parse(s)}),MimeType:{JSON:1}},
  Utilities:{},SpreadsheetApp:{},CacheService:{},PropertiesService:{},Logger:{log(){}}};
vm.createContext(ctx);vm.runInContext(src,ctx);
let SETTINGS={},SAVED=[];
ctx.jsonOut_=o=>o;
ctx.getSetting_=k=>SETTINGS[k]===undefined?null:SETTINGS[k];
ctx.setSetting_=(k,v)=>{SETTINGS[k]=v;SAVED.push(k);return{ok:true};};
const USERS={tokA:{username:'adm',role:'admin'},tokC:{username:'cs1',role:'cs',names:['Hà'],team:''}};
ctx._sessUser_=t=>USERS[t]||null;
let fail=0;const ok=(c,m)=>{if(!c){console.log('FAIL:',m);fail++;}else console.log('ok  :',m);};
const run=(f,...a)=>vm.runInContext(f+'(...__a)',Object.assign(ctx,{__a:a}));
const setCfg=o=>{SETTINGS.roleConfig=JSON.stringify(o);};
const U=(role,extra)=>Object.assign({username:role+'1',role,name:'N',names:['N']},extra||{});

// mac dinh: chua cai gi -> moi thu cho phep (khong doi hanh vi cu)
ok(run('_featureAllowed_',U('cs'),'salesreport')===true&&run('_featureAllowed_',U('leader'),'act:assign')===true,'chua cai gi: cho phep het nhu cu');
ok(run('_roleBase_','ceo')==='viewer'&&run('_roleBase_','tp')==='manager'&&run('_roleBase_','manager')==='manager'&&run('_roleBase_','leader')==='leader'&&run('_roleBase_','cs')==='cs'&&run('_roleBase_','admin')==='admin','base cua vai tro built-in');
ok(run('_roleBase_','khong_co')==='cs','vai tro la -> base cs (khong nang quyen)');
// chuan hoa
let n=run('_roleCfgNormalize_',{roles:[{key:'admin',base:'cs',perms:['x']},{key:'ceo',base:'admin',perms:['salesreport','salesreport','']},{key:'ketoan',label:'Kế toán',base:'viewer',perms:['audit']},{key:'xau',label:'X',base:'admin'},{key:'BAD KEY'},{key:'ketoan'}],deptPerms:{online:['tab-kh'],vp:'khong phai mang',  '':['a']}});
const rr=k=>n.roles.find(r=>r.key===k);
ok(rr('admin').base==='admin'&&rr('admin').perms===null,'admin: base khoa, perms luon null (khong tu khoa minh)');
ok(rr('ceo').base==='viewer'&&rr('ceo').perms.length===1,'built-in: khong doi base duoc, perms bo trung/rong');
ok(rr('ketoan').base==='viewer'&&rr('ketoan').label==='Kế toán','vai tro tuy chinh giu base hop le');
ok(rr('xau').base==='cs','vai tro tuy chinh KHONG duoc dat base admin (chong nang quyen)');
ok(!rr('BAD KEY')&&n.roles.filter(r=>r.key==='ketoan').length===1,'key sai / trung bi bo');
ok(Array.isArray(n.deptPerms.online)&&!('vp' in n.deptPerms)&&!('' in n.deptPerms),'deptPerms: chi nhan mang, bo key rong');
// quyen theo vai tro
setCfg({roles:[{key:'cs',perms:['tab-kh','tab-schedule']},{key:'ceo',perms:null}]});
ok(run('_featureAllowed_',U('cs'),'tab-kh')===true&&run('_featureAllowed_',U('cs'),'salesreport')===false,'vai tro cs chi duoc muc da tick');
ok(run('_featureAllowed_',U('ceo'),'salesreport')===true,'ceo perms null = xem het');
ok(run('_featureAllowed_',U('admin'),'salesreport')===true,'admin luon duoc');
ok(run('_featureAllowed_',U('leader'),'salesreport')===true,'vai tro khac chua cai -> khong gioi han');
// quyen theo bo phan (nhan vien thuoc phong 'online' theo saleDepts)
SETTINGS.saleDepts=JSON.stringify({'N':'online','M':'vp'});
setCfg({roles:[],deptPerms:{online:['tab-kh','salesreport'],vp:null}});
ok(run('_featureAllowed_',U('cs'),'salesreport')===true&&run('_featureAllowed_',U('cs'),'audit')===false,'phong online chi duoc muc da tick');
ok(run('_featureAllowed_',U('cs',{names:['M']}),'audit')===true,'phong vp perms null -> khong gioi han');
ok(run('_featureAllowed_',U('cs',{names:['Khac']}),'audit')===true,'nguoi chua gan phong -> khong bi gioi han theo phong');
// vai tro AND bo phan
setCfg({roles:[{key:'cs',perms:['tab-kh','audit']}],deptPerms:{online:['tab-kh','salesreport']}});
ok(run('_featureAllowed_',U('cs'),'tab-kh')===true,'co o ca vai tro lan phong -> duoc');
ok(run('_featureAllowed_',U('cs'),'audit')===false&&run('_featureAllowed_',U('cs'),'salesreport')===false,'thieu o vai tro HOAC o phong -> khong duoc');
// manager: phong lay tu cot team, nhieu phong -> hop
setCfg({roles:[],deptPerms:{a:['tab-kh'],b:['audit']}});
const mg=U('tp',{team:'a, b',names:['Z']});
ok(run('_featureAllowed_',mg,'tab-kh')&&run('_featureAllowed_',mg,'audit')&&!run('_featureAllowed_',mg,'salesreport'),'truong phong 2 phong: quyen = hop cac phong');
ok(run('_userDeptKeys_',mg).join()==='a,b','phong cua truong phong lay tu cot team');
// perms rieng cua tai khoan (co san) van thang cho tab, khong anh huong act:*
setCfg({roles:[{key:'cs',perms:['act:bc']}],deptPerms:{}});
ok(run('_featureAllowed_',U('cs',{perms:['salesreport']}),'salesreport')===true&&run('_featureAllowed_',U('cs',{perms:['salesreport']}),'tab-kh')===false,'perms rieng: la danh sach tab ung voi tai khoan');
ok(run('_featureAllowed_',U('cs',{perms:['salesreport']}),'act:bc')===true&&run('_featureAllowed_',U('cs',{perms:['salesreport']}),'act:dup')===false,'tac vu act:* theo vai tro, khong theo perms tab');
// client payload: nguoi thuong khong thay cau hinh nguoi khac
setCfg({roles:[{key:'cs',perms:['tab-kh']},{key:'ceo',perms:['audit']}],deptPerms:{online:['x'],vp:['y']}});
let pc=run('roleConfigForClient_',U('cs'));
ok(pc.ok&&!pc.config&&Array.isArray(pc.access.rolePerms)&&pc.access.rolePerms[0]==='tab-kh','nhan vien chi nhan quyen cua minh');
ok(!JSON.stringify(pc).includes('"y"')&&!JSON.stringify(pc.access).includes('ceo'),'khong lo quyen vai tro/phong khac');
ok(run('roleConfigForClient_',U('admin')).config.roles.length===2,'admin nhan cau hinh day du');
// luu: chi admin
SAVED=[];
let r=run('saveRoleConfig_',{roles:[{key:'cs',perms:['tab-kh']}]},'tokC');
ok(r.error&&!SAVED.length,'nhan vien KHONG luu duoc phan quyen');
r=run('saveRoleConfig_',{roles:[{key:'cs',perms:['tab-kh']}]},'sai');
ok(r.error&&!SAVED.length,'khong token KHONG luu duoc');
r=run('saveRoleConfig_',{roles:[{key:'cs',perms:['tab-kh']},{key:'admin',perms:['a']}]},'tokA');
ok(r.ok&&SAVED[0]==='roleConfig'&&JSON.parse(SETTINGS.roleConfig).roles.find(x=>x.key==='admin').perms===null,'admin luu duoc, du lieu da chuan hoa');
// _profScope_: viewer (CEO) xem moi nguoi
ok(run('_profScope_',U('ceo'),{username:'x',name:'X',names:['X']},null)===true,'CEO xem ho so moi nguoi');
ok(run('_profScope_',U('cs'),{username:'x',name:'X',names:['X']},null)===false,'nhan vien khong xem ho so nguoi khac');
// ===== buoc 3: chan o backend =====
USERS.tokCs={username:'cs1',role:'cs',names:['Hà']};USERS.tokOld={username:'o',role:'cs',perms:['salesreport']};USERS.tokCeo={username:'c',role:'ceo'};
SETTINGS={};
ok(run('_featureGate_','salesReportA','tokCs')===null,'chua cai gi: khong chan');
setCfg({roles:[{key:'cs',perms:['tab-kh']}]});
let g=run('_featureGate_','salesReportA','tokCs');ok(g&&g.code==='FORBIDDEN'&&g.feature==='salesreport','vai tro cs bi gioi han -> FORBIDDEN');
ok(run('_featureGate_','orgOverview','tokCs').feature==='overview'&&run('_featureGate_','audit','tokCs').feature==='audit','map action -> hang muc (overview, audit)');
ok(run('_featureGate_','lookup','tokCs')===null,'action khong co trong bang -> cho qua');
ok(run('_featureGate_','salesReportA','')===null&&run('_featureGate_','salesReportA','tokSai')===null,'khong token / token la -> cho qua (do _enforceCheck_ lo)');
ok(run('_featureGate_','salesReportA','tokA')===null&&run('_featureGate_','salesReportA','tokCeo')===null,'admin & vai tro chua gioi han -> cho qua');
setCfg({roles:[]});ok(run('_featureGate_','salesReportA','tokOld')===null&&run('_featureGate_','orgOverview','tokOld')===null,'tai khoan co perms rieng (cu) khong bi gate backend chan nham (skipUserPerms)');setCfg({roles:[{key:'cs',perms:['tab-kh']}]});
ctx._sessUser_=()=>{throw new Error('x');};ok(run('_featureGate_','salesReportA','tokCs')===null,'loi khi tra user -> nuot, khong chan');
ctx._sessUser_=t=>USERS[t]||null;
setCfg({roles:[],deptPerms:{online:['tab-kh']}});
ok(run('_featureGate_','salesReportA','tokCs')===null,'bo phan khong khop nguoi dung -> khong chan');
// ===== BUOC 4c-1: chi chu so huu moi duoc sua/xoa don o backend =====
{
  let PROPS={};
  ctx.PropertiesService={getScriptProperties:()=>({getProperty:k=>PROPS[k]===undefined?null:PROPS[k],setProperty:(k,v)=>{PROPS[k]=v;}})};
  const US={tokD:{username:'Duyent',role:'admin'},tokA2:{username:'admin2',role:'admin'},tokC:{username:'cs1',role:'cs'},tokL:{username:'ld',role:'leader'}};
  ctx._sessUser_=t=>US[t]||null;
  // chua cai chu so huu -> du phong role admin
  ok(run('_ownerGate_','deleteOrder','tokD')===null&&run('_ownerGate_','deleteOrder','tokA2')===null,'chua cai owner: moi admin duoc xoa don (nhu cu)');
  ok(run('_ownerGate_','deleteOrder','tokC').code==='FORBIDDEN'&&run('_ownerGate_','patchOrder','tokL').code==='FORBIDDEN','CS / leader goi thang deleteOrder/patchOrder -> FORBIDDEN');
  // cai owner = duyent (khong phan biet hoa thuong)
  run('datChuSoHuu','Duyent');
  ok(run('_ownerGate_','replaceOrders','tokD')===null,'owner duyent duoc sua/xoa');
  ok(run('_ownerGate_','deleteDuplicateOrders','tokA2').code==='FORBIDDEN','admin khac KHONG phai owner -> bi chan');
  for(const a of ['patchOrder','deleteOrder','deleteDuplicateOrders','replaceOrders','importSheetRows','dedupeCare','findDuplicateOrders']) ok(run('_ownerGate_',a,'tokC').code==='FORBIDDEN',a+' bi chan voi CS');
  // action thuong cua CS khong bi chan
  for(const a of ['saveSingle','customers','lookup','addCareLead','setOrderCareCS','saveTask','reminders']) ok(run('_ownerGate_',a,'tokC')===null,a+' van chay binh thuong voi CS');
  ok(run('_ownerGate_','deleteOrder','')===null&&run('_ownerGate_','deleteOrder','tokSai')===null,'khong token / token sai: de cong tac 4b xu ly (khong chan o day)');
  // doGet/doPost that su goi gate
  ok(/_ownerGate_\(action, p\.token\)/.test(src)&&/_ownerGate_\(d0\.action, d0\.token\)/.test(src),'doGet va doPost deu goi _ownerGate_');
  run('xoaChuSoHuu','duyent');
  ok(run('_ownerGate_','deleteOrder','tokA2')===null,'xoa owner -> quay lai du phong role admin');
}

// ===== BUOC 4c-2a: pham vi khach theo CS o server (lookup/donOrdersByPhone/cskhDetail) =====
{
  let PR={}, NOTES=[];
  ctx.PropertiesService={getScriptProperties:()=>({getProperty:k=>PR[k]===undefined?null:PR[k],setProperty:(k,v)=>{PR[k]=v;}})};
  const mk=(role,names)=>({username:role+(names&&names[0]||''),role,names:names||[]});
  const own=h=>()=>h;   // namesFn gia: tap ten so huu 1 SDT
  const H={'Hoa':1,'Lan':1};
  ok(ctx._scopeVerdict_(mk('cs',['Hoa']),'0901',own(H))===true,'CS co ten trong careCS/don/assign -> trong pham vi');
  ok(ctx._scopeVerdict_(mk('cs',['Mai']),'0901',own(H))===false,'CS khac -> NGOAI pham vi');
  ok(ctx._scopeVerdict_(mk('cs',['Mai','Lan']),'0901',own(H))===true,'tai khoan gop nhieu ten: 1 ten khop la du');
  ok(ctx._scopeVerdict_(mk('manager',['Mai']),'0901',own(H))===false,'manager khoi tao nhu CS (theo ten duoc gan)');
  ok(ctx._scopeVerdict_(mk('cs',[]),'0901',own(H))===false,'CS chua gan ten -> khong thay khach nao (nhu client)');
  ok(ctx._scopeVerdict_(mk('admin',[]),'0901',own(H))===true,'admin xem tat ca');
  ok(ctx._scopeVerdict_(mk('viewer',[]),'0901',own(H))===true&&ctx._scopeVerdict_(mk('ceo',[]),'0901',own(H))===true,'viewer/ceo khong gioi han (nhu client)');
  ctx.getCrmSS_=()=>({getSheetByName:()=>({})});
  ctx.readTeams_=()=>[{name:'T1',leader:'Lan',members:['Hoa','Mai']},{name:'T2',leader:'Bao',members:['Cuc']}];
  ok(ctx._scopeVerdict_(mk('leader',['Lan']),'0901',own({'Hoa':1}))===true,'leader: khach cua THANH VIEN team -> trong pham vi (4c-2c)');
  ok(ctx._scopeVerdict_(mk('leader',['Lan']),'0901',own({'Cuc':1}))===false,'leader: khach cua team KHAC -> NGOAI pham vi');
  ok(ctx._scopeVerdict_(mk('leader',['Lan']),'0901',own({'Lan':1}))===true,'leader: khach cua chinh minh -> trong pham vi');
  ok(ctx._scopeVerdict_({username:'l2',role:'leader',names:[],team:'T2'},'0901',own({'Cuc':1}))===true,'leader theo user.team khi chua gan ten -> thay khach thanh vien team do');
  ok(ctx._scopeVerdict_({username:'l3',role:'leader',names:[]},'0901',own({'Cuc':1}))===false,'leader khong ten, khong team -> khong thay gi');
  // gate theo che do
  const U1={username:'cs_mai',role:'cs',names:['Mai']};
  ctx._sessUser_=t=>t==='tokMai'?U1:null;
  ctx._scopeNamesForPhone_=()=>H;
  const CS={};ctx.CacheService={getScriptCache:()=>({get:k=>CS[k]===undefined?null:CS[k],put:(k,v)=>{CS[k]=v;}})};
  ctx.Utilities={formatDate:()=> '20261014'};
  ok(ctx._scopeGate_('lookup','tokMai','0901')===null,'mac dinh OFF: khong lam gi');
  PR.scopeMode='log';
  ok(ctx._scopeGate_('lookup','tokMai','0901123')===null,'che do LOG: khong chan');
  const rep=ctx._scopeReport_();
  ok(rep.rows.some(r=>r.k==='cs_mai | lookup | OUT'&&r.n===1)&&rep.outSamples[0]==='cs_mai:***123','LOG ghi dem OUT + SDT da che ***123');
  ok(!JSON.stringify(rep).includes('0901123'),'log KHONG chua SDT day du');
  PR.scopeMode='enforce';
  const d=ctx._scopeGate_('donOrdersByPhone','tokMai','0901');
  ok(d&&d.code==='FORBIDDEN','che do ENFORCE: CS ngoai pham vi -> FORBIDDEN');
  ctx._scopeNamesForPhone_=()=>({'Mai':1});
  ok(ctx._scopeGate_('cskhDetail','tokMai','0901')===null,'ENFORCE: khach cua chinh minh -> cho qua');
  ok(ctx._scopeGate_('customers','tokMai','0901')===null,'action ngoai danh sach -> khong dong vao');
  ok(ctx._scopeGate_('lookup','','0901')===null&&ctx._scopeGate_('lookup','tokSai','0901')===null,'khong token / token sai -> de 4b xu ly');
  ok(ctx._scopeGate_('lookup','tokMai','')===null,'khong co phone -> bo qua');
  ok(/_scopeGate_\(action, p\.token, p\.phone\)/.test(src),'doGet goi _scopeGate_');
  ctx._sessUser_=()=>{throw new Error('x');};
  ok(ctx._scopeGate_('lookup','tokMai','0901')===null,'loi bat ngo -> nuot, KHONG chan nham');
  // lookup = chi cac action doc theo SDT
  ok(Object.keys(ctx.SCOPE_ACTIONS_).sort().join()==='cskhDetail,donOrdersByPhone,lookup','SCOPE_ACTIONS_ dung 3 action doc theo SDT');
}

// ===== BUOC 4c-2b: loc danh sach theo pham vi (customers/orders/careLeads/reminders) =====
{
  let PR={scopeMode:'enforce'}, CSH={};
  ctx.PropertiesService={getScriptProperties:()=>({getProperty:k=>PR[k]===undefined?null:PR[k],setProperty:(k,v)=>{PR[k]=v;}})};
  ctx.CacheService={getScriptCache:()=>({get:k=>CSH[k]===undefined?null:CSH[k],put:(k,v)=>{CSH[k]=v;}})};
  ctx.Utilities={formatDate:()=>'20261014'};
  ctx.normPhone_=x=>String(x).replace(/\D/g,'');
  // allowed names
  ctx.getCrmSS_=()=>({getSheetByName:()=>({})});
  ctx.readTeams_=()=>[{name:'T1',leader:'Lan',members:['Hoa','Mai']},{name:'T2',leader:'Bao',members:['Cuc']}];
  const A=u=>ctx._scopeAllowedNames_(u);
  ok(A({role:'admin'})===null&&A({role:'viewer'})===null&&A({role:'ceo'})===null,'admin/viewer/ceo: khong gioi han (null)');
  ok(Object.keys(A({role:'cs',names:['Hoa']})).join()==='Hoa','CS: chi ten minh');
  ok(Object.keys(A({role:'manager',names:['Hoa','Nga']})).sort().join()==='Hoa,Nga','manager/CS gop nhieu ten');
  ok(Object.keys(A({role:'leader',names:['Lan'],team:''})).sort().join()==='Hoa,Lan,Mai','leader: minh + thanh vien team cua minh');
  ok(Object.keys(A({role:'leader',names:['Zed'],team:'T2'})).sort().join()==='Bao,Cuc,Zed','leader theo user.team: them thanh vien team do');
  ok(Object.keys(A({role:'cs',names:[]})).length===0,'CS chua gan ten -> tap rong (khong thay gi)');
  // filter
  const set={'0901':1,'0902':1};
  const F=ctx._scopeFilterObj_;
  let f=F('customers',{rows:[{phone:'0901'},{phone:'0903'},{phone:'0902'}],careStatus:{a:1}},set);
  ok(f.obj.rows.length===2&&f.total===3&&f.kept===2&&f.obj.careStatus.a===1,'customers: loc rows, giu careStatus');
  f=F('orders',{orders:[{phone:'0901'},{phone:'0999'}],errorCount:2},set); ok(f.obj.orders.length===1&&f.obj.errorCount===2,'orders: loc, giu errorCount');
  f=F('careLeads',{rows:[{phone:'0902'},{phone:'0555'}]},set); ok(f.obj.rows.length===1,'careLeads: loc theo SDT');
  f=F('reminders',{reminders:[{phone:'0901'},{phone:'0555'}]},set); ok(f.obj.reminders.length===1,'reminders: loc theo SDT');
  f=F('customers',{rows:[{phone:'84901'}]},{'0901':1}); ok(true,'(chuan hoa SDT dung chung normPhone_)');
  const orig={rows:[{phone:'0903'}]}; f=F('customers',orig,set); ok(orig.rows.length===1,'khong sua doi object goc (copy)');
  ok(F('customers',{error:'x'},set).obj.error==='x','payload loi/khong co mang -> tra nguyen');
  // 4c-2c: cskhDuyenLite / cskhDuyen (rows) va searchOrder (results)
  for(const act of ['cskhDuyenLite','cskhDuyen']){ f=F(act,{ok:true,rows:[{phone:'0901'},{phone:'0555'}],total:2},set); ok(f.obj.rows.length===1&&f.obj.total===2&&f.obj.ok===true,act+': loc rows theo SDT, giu cac truong khac'); }
  f=F('searchOrder',{ok:true,results:[{phone:'0901',code:'A'},{phone:'0555',code:'B'}]},set); ok(f.obj.results.length===1&&f.obj.results[0].code==='A','searchOrder: loc results theo SDT');
  ok(['cskhDuyenLite','cskhDuyen','searchOrder'].every(a=>ctx.SCOPE_LIST_ACTIONS_[a]===1),'SCOPE_LIST_ACTIONS_ co 3 action 4c-2c');
  // serve
  const U={username:'cs_hoa',role:'cs',names:['Hoa']};
  ctx._sessUser_=t=>t==='tok'?U:(t==='tokAd'?{username:'ad',role:'admin',names:[]}:null);
  ctx._scopePhoneSet_=()=>set;
  const mkResp=o=>({getContent:()=>JSON.stringify(o)});
  ctx.doGetCore_=()=>mkResp({rows:[{phone:'0901'},{phone:'0903'}]});
  ctx.jsonOut_=o=>({getContent:()=>JSON.stringify(o)});
  let out=ctx._scopeListServe_('customers',{token:'tok'},{});
  ok(JSON.parse(out.getContent()).rows.length===1,'ENFORCE: CS nhan danh sach da loc');
  out=ctx._scopeListServe_('customers',{token:'tokAd'},{}); ok(out===null,'admin: tra null -> doGet chay nhu cu');
  PR.scopeMode='log';
  out=ctx._scopeListServe_('customers',{token:'tok'},{}); ok(JSON.parse(out.getContent()).rows.length===2,'LOG: tra NGUYEN VEN (khong loc)');
  ok(ctx._scopeReport_().rows.some(r=>/cs_hoa \| customers \| LIST would-filter 1\/2/.test(r.k)),'LOG: ghi dem so dong se bi loc');
  PR.scopeMode='off'; ok(ctx._scopeListServe_('customers',{token:'tok'},{})===null,'OFF: khong lam gi');
  PR.scopeMode='enforce';
  ok(ctx._scopeListServe_('teams',{token:'tok'},{})===null&&ctx._scopeListServe_('customers',{token:''},{})===null,'action khac / khong token -> null');
  ctx.doGetCore_=()=>{throw new Error('boom');}; ok(ctx._scopeListServe_('customers',{token:'tok'},{})===null,'doGetCore_ loi -> null (de doGet tu xu ly)');
  ctx.doGetCore_=()=>({getContent:()=>'not json'}); ok(ctx._scopeListServe_('customers',{token:'tok'},{})===null,'phan hoi khong phai JSON -> null');
  ok(/_scopeListServe_\(action, p, e\)/.test(src),'doGet goi _scopeListServe_');
}

// ===== BUOC 4c-3: cau hinh cau truc chi admin/leader/manager; mau follow-up CS chi sua cua minh =====
{
  const US={tA:{username:'ad',role:'admin'},tL:{username:'ld',role:'leader'},tM:{username:'mg',role:'manager'},tC:{username:'cs_hoa',name:'Hoa',role:'cs',names:['Hoa']}};
  ctx._sessUser_=t=>US[t]||null;
  for(const a of ['saveTeams','saveMktTeams','saveSaleGroups','saveCareStatus']){
    ok(ctx._cfgGate_(a,'tC').code==='FORBIDDEN',a+': CS goi thang -> FORBIDDEN');
    ok(ctx._cfgGate_(a,'tA')===null&&ctx._cfgGate_(a,'tL')===null&&ctx._cfgGate_(a,'tM')===null,a+': admin/leader/manager duoc');
  }
  ok(ctx._cfgGate_('saveSingle','tC')===null&&ctx._cfgGate_('saveFollowUpTemplates','tC')===null&&ctx._cfgGate_('saveMessageTemplate','tC')===null,'trang thai tung khach (saveSingle) / mau cua CS KHONG bi chan o cong cau hinh');
  ok(ctx._cfgGate_('saveTeams','')===null&&ctx._cfgGate_('saveTeams','tokSai')===null,'khong token / token sai: de cong tac 4b xu ly');
  ok(/_cfgGate_\(d0\.action, d0\.token\)/.test(src),'doPost goi _cfgGate_');
  // gop mau follow-up
  const cur=[['*','7','chung admin',''],['CF','3','cua Hoa','hoa'],['CF','5','cua Mai','mai'],['*','10','cua Hoa2','hoa']];
  const list=[{productCode:'*',days:'7',template:'CS thu xoa mau chung',cs:''},{productCode:'cf',days:'3',template:'Hoa sua',cs:'Hoa'},{productCode:'*',days:'9',template:'Hoa them',cs:'hoa'},{productCode:'*',days:'1',template:'ghi de cua Mai',cs:'mai'},{productCode:'*',days:'',template:'thieu ngay',cs:'hoa'}];
  const m=ctx._fuMergeForUser_(cur,list,US.tC);
  const txt=m.map(r=>r[2]+'|'+r[3]).sort().join(' ; ');
  ok(txt==='Hoa sua|hoa ; Hoa them|hoa ; chung admin| ; cua Mai|mai','CS: giu mau chung + mau cua Mai nguyen ven, chi thay mau cua minh (khong ghi de, khong xoa): '+txt);
  ok(m.every(r=>r.length===4)&&m.find(r=>r[2]==='Hoa sua')[0]==='CF','dong hop le co 4 cot, ma SP viet hoa');
  ok(ctx._fuMergeForUser_(cur,[],US.tC).length===2&&ctx._fuMergeForUser_(cur,[],US.tC).every(r=>r[3]!=='hoa'),'CS gui bang rong -> chi xoa mau cua minh');
}

console.log(fail?'\nFAILED '+fail:'\nALL ROLES TESTS PASSED');process.exit(fail?1:0);

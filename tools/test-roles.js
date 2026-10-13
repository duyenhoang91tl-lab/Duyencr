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
console.log(fail?'\nFAILED '+fail:'\nALL ROLES TESTS PASSED');process.exit(fail?1:0);

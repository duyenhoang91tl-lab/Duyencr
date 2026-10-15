#!/usr/bin/env node
// Test client phan quyen (js/40-fn-rolesettings.js): base vai tro, _featAllowed KHOP _featureAllowed_ cua GAS (so sanh ngau nhien), catalog, thao tac ma tran.
const fs=require('fs'),vm=require('vm');
// ---- server ----
const sctx={console,Date,JSON,Math,parseInt,isNaN,String,Object,Array,RegExp,LockService:{getScriptLock:()=>({})},ContentService:{createTextOutput:s=>({setMimeType:()=>JSON.parse(s)}),MimeType:{JSON:1}},Utilities:{},SpreadsheetApp:{},CacheService:{},PropertiesService:{},Logger:{log(){}}};
vm.createContext(sctx);vm.runInContext(fs.readFileSync('gas_v13.js','utf8'),sctx);
let SET={};sctx.jsonOut_=o=>o;sctx.getSetting_=k=>SET[k]===undefined?null:SET[k];
const S=(f,...a)=>vm.runInContext(f+'(...__a)',Object.assign(sctx,{__a:a}));
// ---- client ----
const els={};const mk=()=>({classList:{add(){},remove(){}},style:{},innerHTML:'',value:''});
const doc={getElementById:id=>els[id]||(els[id]=mk()),createElement:()=>mk(),body:Object.assign(mk(),{appendChild(){}}),addEventListener(){}};
doc.body.classList={add(){},remove(){}};
const toasts=[];
const cctx={console,document:doc,JSON,Math,Date,String,Array,Object,RegExp,parseInt,setTimeout:()=>0,
  localStorage:{getItem:()=>null,setItem(){}},toast:m=>toasts.push(m),esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  gsUrl:'https://gas',fetch:async()=>({json:async()=>({})}),confirm:()=>true,alert(){},
  _PERM_TAB_DEFS:[{id:'overview',label:'Tổng quan'},{id:'tab-kh',label:'Danh sách KH'},{id:'salesreport',label:'Báo cáo doanh số'},{id:'audit',label:'Nhật ký'},{id:'tab-chat',label:'Chat (Social)'}],
  accounts:[{username:'u1',role:'cs',names:['Hà']},{username:'u2',role:'ceo'}],
  currentUser:{role:'cs'},_applyAuthIdentity:function(){}};
cctx.window=cctx;
cctx._SN_GROUPS=[{k:'ov',t:'🏠 Tổng quan',ids:['act:notif','overview']},{k:'kh',t:'👤 Khách',ids:['tab-kh']},{k:'rp',t:'📊 Báo cáo',ids:['salesreport','act:fureport']},{k:'st',t:'⚙ Settings',ids:['act:roles','config','audit','act:acct']}];
cctx._SN_ACTS={notif:{t:'🔔 Thông báo'},fureport:{t:'📞 Chăm sóc theo mốc'},roles:{t:'🛡 Phân quyền',admin:true},acct:{t:'🔑 Tài khoản',admin:true}};
vm.createContext(cctx);vm.runInContext(fs.readFileSync('js/40-fn-rolesettings.js','utf8'),cctx);
const C=(code)=>vm.runInContext(code,cctx);
let fail=0;const ok=(c,m)=>{if(!c){console.log('FAIL:',m);fail++;}else console.log('ok  :',m);};

ok(C("_roleBaseOf('ceo')")==='viewer'&&C("_roleBaseOf('tp')")==='manager'&&C("_roleBaseOf('leader')")==='leader'&&C("_roleBaseOf('admin')")==='admin'&&C("_roleBaseOf('demo')")==='demo','base cua vai tro built-in (demo giu "demo" nhu code cu)');
ok(C("_roleBaseOf('lam_la')")==='cs','vai tro la -> cs');
C("_roleCfg={v:1,roles:[{key:'ketoan',label:'Kế toán',base:'viewer',perms:null}],deptPerms:{}}");
ok(C("_roleBaseOf('ketoan')")==='viewer'&&C("_roleLabel('ketoan')")==='Kế toán'&&C("_roleLabel('ceo')")==='CEO / Giám đốc'&&C("_roleLabel('cs')")==='Nhân viên kinh doanh'&&C("_roleLabel('leader')")==='Trưởng nhóm','base + nhan vai tro tuy chinh/built-in');
ok(C("_roleKeysForSelect()").join()==='admin,ceo,tp,manager,leader,cs,ketoan,demo','danh sach vai tro cho o chon tai khoan');

// ---- catalog ----
const cat=C("_rsCatalog()");const ids=[].concat(...cat.map(g=>g.items.map(i=>i.id)));
ok(ids.includes('act:notif')&&ids.includes('act:fureport')&&ids.includes('salesreport')&&ids.includes('tab-chat'),'catalog co tab + tac vu + tab ngoai nhom');
ok(!ids.includes('act:roles')&&!ids.includes('act:acct'),'tac vu chi-admin KHONG nam trong catalog (khong cap duoc)');
ok(ids.length===new Set(ids).size&&['overview','tab-kh','salesreport','audit','tab-chat'].every(x=>ids.includes(x)),'moi tab trong _PERM_TAB_DEFS xuat hien dung 1 lan');
ok(!cat.some(g=>g.items.some(i=>!i.label||i.label.length<2)),'moi muc co nhan');

// ---- khop server: ngau nhien ----
let seed=12345;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
const FEATS=['overview','tab-kh','salesreport','audit','tab-chat','act:notif','act:fureport'];
const pickPerm=()=>{const r=rnd();if(r<.35)return null;return FEATS.filter(()=>rnd()<.5);};
const ROLES=['admin','ceo','tp','manager','leader','cs','ketoan'];
let mism=0,cases=0;
for(let t=0;t<400;t++){
  const cfg={v:1,roles:[],deptPerms:{}};
  ROLES.forEach(r=>{if(rnd()<.6)cfg.roles.push({key:r,label:r,base:r==='ketoan'?'viewer':'cs',perms:pickPerm()});});
  ['online','vp','kt'].forEach(k=>{const p=pickPerm();if(p&&rnd()<.8)cfg.deptPerms[k]=p;});
  const saleDepts={Hà:'online','Lan Anh':'vp',Dũng:'kt'};
  SET.roleConfig=JSON.stringify(cfg);SET.saleDepts=JSON.stringify(saleDepts);
  const user={username:'u',role:ROLES[Math.floor(rnd()*ROLES.length)],name:'X',names:[['Hà'],['Lan Anh'],['Dũng'],['Khac'],['Hà','Dũng']][Math.floor(rnd()*5)],team:rnd()<.5?'online, kt':'',perms:rnd()<.2?FEATS.filter(()=>rnd()<.5):null};
  const normCfg=S('_roleCfgNormalize_',JSON.parse(JSON.stringify(cfg)));
  const access=S('roleConfigForClient_',user).access;
  C('_roleCfg='+JSON.stringify(normCfg));
  cctx._roleAccess=access;C('_roleAccess='+JSON.stringify(access));C('currentUser={role:'+JSON.stringify(user.role)+'}');
  FEATS.forEach(f=>{
    cases++;const sv=S('_featureAllowed_',user,f);
    const cm=C('_featAllowedFor('+JSON.stringify({role:user.role,perms:user.perms,team:user.team,names:user.names})+','+JSON.stringify(f)+',_roleCfg,'+JSON.stringify(saleDepts)+')');
    // _featAllowed (cua chinh minh) chi dung khi KHONG co perms rieng cho tab; voi act:* luon dung
    let me=cm;
    if(!(f.indexOf('act:')!==0&&user.perms&&user.perms.length)) me=C('_featAllowed('+JSON.stringify(f)+')');
    if(sv!==cm||sv!==me){mism++;if(mism<4)console.log('  lech',JSON.stringify({user,f,sv,cm,me,cfg:normCfg}).slice(0,400));}
  });
}
ok(mism===0,'client khop server tren '+cases+' truong hop ngau nhien (mism='+mism+')');

// ---- thao tac ma tran ----
C("_rs.cfg={v:1,roles:[],deptPerms:{}};_rs.depts=[{key:'online',label:'Online'},{key:'vp',label:'Văn phòng'}];_rs.sec='byrole';");
C("_rsLimit('role','cs',true)");
const all=C("_rsAllIds()");
ok(JSON.stringify(C("_rsRole('cs').perms"))===JSON.stringify(all),'bat Gioi han: bat dau day du (khong khoa trang)');
C("_rsCell('role','cs','audit',false)");
ok(!C("_rsRole('cs').perms").includes('audit')&&C("_rsRole('cs').perms").includes('tab-kh'),'bo tick 1 muc');
C("_rsGroup('role','cs',JSON.stringify(['overview','act:notif']),false)");
ok(!C("_rsRole('cs').perms").includes('overview')&&!C("_rsRole('cs').perms").includes('act:notif'),'tat ca nhom');
C("_rsGroup('role','cs',JSON.stringify(['overview','act:notif']),true)");
ok(C("_rsRole('cs').perms").includes('overview')&&C("_rsRole('cs').perms").includes('act:notif'),'bat lai ca nhom');
C("_rsLimit('role','cs',false)");ok(C("_rsRole('cs').perms")===null,'tat Gioi han -> perms null (xem tat ca)');
C("_rsLimit('dept','online',true);_rsCell('dept','online','salesreport',false)");
ok(Array.isArray(C("_rs.cfg.deptPerms.online"))&&!C("_rs.cfg.deptPerms.online").includes('salesreport'),'ma tran bo phan');
C("_rsLimit('dept','online',false)");ok(C("'online' in _rs.cfg.deptPerms")===false,'tat gioi han phong -> bo khoi deptPerms');
C("_rsLimit('role','ceo',true);_rsLimit('role','tp',false);_rsCell('role','ceo','audit',false);_rs.sec='byrole'");
els['rs-copy-from']={value:'ceo'};els['rs-copy-to']={value:'tp'};C("_rsCopy('role')");
ok(JSON.stringify(C("_rsRole('tp').perms"))===JSON.stringify(C("_rsRole('ceo').perms")),'sao chep quyen giua 2 cot');
ok(C("_rsMatrixHtml('role')").includes('Giới hạn')&&C("_rsMatrixHtml('dept')").includes('Online'),'ve ma tran vai tro + bo phan khong loi');
// them / xoa vai tro
els['rs-new-label']={value:'Marketing lead'};els['rs-new-base']={value:'viewer'};C("_rsRoleAdd()");
ok(C("_rs.cfg.roles.some(function(r){return r.key==='marketing_lead'&&r.base==='viewer'})"),'them vai tro tuy chinh: key tu ten khong dau');
C("accounts.push({username:'u3',role:'marketing_lead'})");let alerted=0;cctx.alert=()=>alerted++;C("_rsRoleDel('marketing_lead')");
ok(alerted===1&&C("_rs.cfg.roles.some(function(r){return r.key==='marketing_lead'})"),'khong xoa duoc vai tro con tai khoan dung');
C("accounts.pop();_rsRoleDel('marketing_lead')");ok(!C("_rs.cfg.roles.some(function(r){return r.key==='marketing_lead'})"),'xoa duoc khi khong con ai dung');
// preview
C("_rs.cfg={v:1,roles:[{key:'cs',label:'Nhân viên',perms:['tab-kh']}],deptPerms:{}};_rs.saleDepts={};_rs.prevUser='u1';");
const pv=C("_rsPreviewHtml()");ok(pv.includes('rs-pv-i ok')&&pv.includes('rs-pv-i no'),'xem thu hien muc duoc / khong duoc');
console.log(fail?'\nFAILED '+fail:'\nALL ROLES UI TESTS PASSED');process.exit(fail?1:0);

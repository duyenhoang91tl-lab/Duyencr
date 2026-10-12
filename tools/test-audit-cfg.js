#!/usr/bin/env node
// Test nhat ky thay doi cau hinh 0e (gas_v13.js): setSetting_/saveUsers_/saveTeams_ ghi AuditLog dung nguoi, truoc/sau, an gia tri nhay cam.
// Chay: node tools/test-audit-cfg.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','gas_v13.js'),'utf8');
const sheets={};
function mkSheet(){
  const rows=[];
  return {rows,
    getLastRow:()=>rows.length,getLastColumn:()=>rows.length?rows[0].length:0,
    appendRow:r=>{rows.push(r.slice());},clearContents:()=>{rows.length=0;},
    getDataRange:()=>({getValues:()=>rows.map(r=>r.slice())}),
    getRange:(r,c,nr=1,nc=1)=>({
      getValues:()=>{const o=[];for(let i=0;i<nr;i++){const row=rows[r-1+i]||[];const x=[];for(let j=0;j<nc;j++)x.push(row[c-1+j]===undefined?'':row[c-1+j]);o.push(x);}return o;},
      setValues:v=>{for(let i=0;i<nr;i++){rows[r-1+i]=rows[r-1+i]||[];for(let j=0;j<nc;j++)rows[r-1+i][c-1+j]=v[i][j];}},
      setValue:v=>{rows[r-1]=rows[r-1]||[];rows[r-1][c-1]=v;},

      getValue:()=>{const x=(rows[r-1]||[])[c-1];return x===undefined?'':x;},
      createTextFinder:txt=>({matchEntireCell:()=>({findNext:()=>{for(let i=0;i<nr;i++){if(String((rows[r-1+i]||[])[c-1])===String(txt))return{getRow:()=>r+i};}return null;}})})
    })};
}
const ctx={console,Date,JSON,Math,parseInt,isNaN,String,Object,Array,
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  ContentService:{createTextOutput:s=>({setMimeType:()=>JSON.parse(s)}),MimeType:{JSON:1}},
  Utilities:{},SpreadsheetApp:{},CacheService:{},PropertiesService:{},Logger:{log(){}}};
vm.createContext(ctx); vm.runInContext(src,ctx);
ctx.jsonOut_=o=>o;
ctx.getSheet_=(n,h)=>{if(!sheets[n]){sheets[n]=mkSheet();if(h)sheets[n].appendRow(h);}return sheets[n];};
ctx.getCrmSS_=()=>({getSheetByName:n=>sheets[n]||null});

ctx.getSheet_('Settings',['key','value']);
ctx._sessVerify_=t=>t==='tok'?{u:'duyen'}:null;
let fail=0;const ok=(c,m)=>{if(!c){console.log('FAIL:',m);fail++;}else console.log('ok  :',m);};
const run=(f,...a)=>vm.runInContext(f+'(...__a)',Object.assign(ctx,{__a:a}));
const setTok=t=>vm.runInContext('_AUDIT_TOKEN_='+JSON.stringify(t),ctx);
const audit=()=>sheets.AuditLog?sheets.AuditLog.rows.slice(1):[];

setTok('tok');
run('setSetting_','tierConfig','{"a":1}');
let a=audit();
ok(a.length===1&&a[0][1]==='duyen'&&a[0][2]==='config:setting:tierConfig'&&a[0][4]===''&&a[0][5]==='{"a":1}','tao moi: ghi nguoi doi + gia tri moi');
run('setSetting_','tierConfig','{"a":1}');
ok(audit().length===1,'luu lai y het -> khong ghi nhat ky');
run('setSetting_','tierConfig','{"a":2}');
a=audit();ok(a.length===2&&a[1][4]==='{"a":1}'&&a[1][5]==='{"a":2}','doi gia tri: ghi truoc/sau');
run('setSetting_','apiGroq','gsk_SECRET_123');
a=audit();ok(a[2][2]==='config:setting:apiGroq'&&!/SECRET/.test(JSON.stringify(a)),'API key: chi ghi "da doi", khong lo gia tri');
run('setSetting_','autoAssignState','{}');run('setSetting_','ttLastTrackedMs','5');run('setSetting_','gasSourceChunk_0','xx');
ok(audit().length===3,'khoa may tu cap nhat khong ghi nhat ky');
setTok('');
run('setSetting_','careStatus','[1]');
ok(audit()[3][1]==='(không token)','khong token -> ghi "(không token)" chu khong bo qua');
setTok('sai');
run('setSetting_','careStatus','[2]');
ok(audit()[4][1]==='(token hết hạn)','token sai/het han duoc ghi ro');
setTok('tok');
// users
ctx.getSheet_('Users',['username','passHash','role','name','team','active','names','perms','saleType','startDate']);
run('saveUsers_',[{username:'ha',role:'cs',name:'Hà',team:'T1',active:true},{username:'duyen',role:'admin',name:'Duyên',active:true}]);
let n0=audit().length;
let r=run('saveUsers_',[{username:'ha',role:'manager',name:'Hà',team:'T1',active:true},{username:'duyen',role:'admin',name:'Duyên',active:true},{username:'moi',role:'cs',name:'Mới',active:true}]);
a=audit().slice(n0);
ok(r.ok&&a.length===2,'saveUsers: 1 doi vai tro + 1 them moi = 2 dong (admin khong doi khong ghi): '+a.length);
const ch=a.find(x=>/^ha:/.test(x[4]));ok(ch&&/vai trò cs/.test(ch[4])&&/vai trò manager/.test(ch[5]),'doi vai tro cs -> manager co truoc/sau');
ok(a.some(x=>x[4]===''&&/^moi:/.test(x[5])),'them tai khoan moi ghi dong "them"');
n0=audit().length;
run('saveUsers_',[{username:'duyen',role:'admin',name:'Duyên',active:true},{username:'moi',role:'cs',name:'Mới',active:false}]);
a=audit().slice(n0);
ok(a.some(x=>/^ha:/.test(x[4])&&x[5]==='(đã xóa)')&&a.some(x=>/KHÓA/.test(x[5])),'xoa tai khoan + khoa tai khoan deu ghi');
ok(!JSON.stringify(audit()).match(/passHash|setPassword/),'khong lo hash mat khau');
// teams
ctx.getSheet_('Teams',['id','name','leader','members','color','channels','ratePct']);
ctx.readTeams_=()=>[{id:'t1',name:'Team A',leader:'Hà',members:['Hà','My']}];
n0=audit().length;
run('saveTeams_',[{id:'t1',name:'Team A',leader:'Hà',members:['Hà','My','Lan']}]);
a=audit().slice(n0);ok(a.length===1&&/2 thành viên/.test(a[0][4])&&/3 thành viên/.test(a[0][5]),'team: them thanh vien ghi truoc/sau');
// loi nhat ky khong lam hong luu
ctx.getSheet_=(n,h)=>{if(n==='AuditLog')throw new Error('boom');if(!sheets[n]){sheets[n]=mkSheet();if(h)sheets[n].appendRow(h);}return sheets[n];};
r=run('setSetting_','tierConfig','{"a":3}');
ok(r.ok&&sheets.Settings.rows.some(x=>x[0]==='tierConfig'&&x[1]==='{"a":3}'),'AuditLog loi -> setting van duoc luu');
console.log(fail?'\nFAILED '+fail:'\nALL AUDIT-CFG TESTS PASSED');process.exit(fail?1:0);

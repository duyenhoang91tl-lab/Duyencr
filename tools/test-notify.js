#!/usr/bin/env node
// Test thong bao @tag (gas_v13.js): parse @ten, khong tu bao minh, ten dai uu tien, comment/task/note, doc + danh dau da doc dung nguoi.
// Chay: node tools/test-notify.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','gas_v13.js'),'utf8');
const sheets={};
function mkSheet(){
  const rows=[];
  return {rows,
    getLastRow:()=>rows.length,getLastColumn:()=>rows.length?rows[0].length:0,
    appendRow:r=>{rows.push(r.slice());},
    getDataRange:()=>({getValues:()=>rows.map(r=>r.slice())}),
    getRange:(r,c,nr=1,nc=1)=>({
      getValues:()=>{const o=[];for(let i=0;i<nr;i++){const row=rows[r-1+i]||[];const x=[];for(let j=0;j<nc;j++)x.push(row[c-1+j]===undefined?'':row[c-1+j]);o.push(x);}return o;},
      setValues:v=>{for(let i=0;i<nr;i++){rows[r-1+i]=rows[r-1+i]||[];for(let j=0;j<nc;j++)rows[r-1+i][c-1+j]=v[i][j];}},
      setValue:v=>{rows[r-1]=rows[r-1]||[];rows[r-1][c-1]=v;},
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
ctx.getCrmSS_=()=>({getSheetByName:n=>n==='USERS_STUB'?null:(sheets[n]||null)});
const USERS=[
  {username:'ha',name:'Hà',names:['Hà'],active:true},
  {username:'hamy',name:'Hà My',names:['Hà My','My Ha'],active:true},
  {username:'duyen',name:'Duyên',names:['Duyên','Duyên Hoàng'],active:true},
  {username:'off',name:'Nghỉ',names:[],active:false}];
ctx.readUsers_=()=>USERS;
let fail=0;const ok=(c,m)=>{if(!c){console.log('FAIL:',m);fail++;}else console.log('ok  :',m);};
const run=(f,...a)=>vm.runInContext(f+'(...__a)',Object.assign(ctx,{__a:a}));
const P=t=>run('_notifParseMentions_',t,USERS).sort().join(',');

ok(P('nhờ @Hà xem giúp')==='ha','tag 1 nguoi');
ok(P('@Hà My ơi')==='hamy','ten dai uu tien: @Hà My khong bao nham @Hà');
ok(P('@hà my và @DUYÊN nhé')==='duyen,hamy','khong phan biet hoa thuong, tag nhieu nguoi');
ok(P('@Duyên Hoàng kiểm tra')==='duyen','tag bang bi danh (names)');
ok(P('email a@Hà.com')==='','@ dinh lien chu truoc (email) khong tinh');
ok(P('@Hàng xóm')==='','@Hàng khong khop @Hà (ranh gioi tu)');
ok(P('@Nghỉ ơi')==='','tai khoan khoa khong duoc bao');
ok(P('khong tag')==='','khong co @');
ok(P('@Hà, @Hà My.')==='ha,hamy','dau cau sau ten van khop');

// comment: Duyen tag Ha va tu tag minh
let r=run('saveTaskComment_',{taskId:'tk1',author:'Duyên',content:'@Hà xem giúp, @Duyên ghi nhớ'});
ok(r.ok,'luu binh luan');
let n=run('readNotifications_','ha');
ok(n.unread===1&&n.items.length===1,'Ha co 1 thong bao chua doc');
ok(n.items[0].kind==='comment'&&n.items[0].refType==='task'&&n.items[0].refId==='tk1'&&n.items[0].refId2===r.id&&n.items[0].from==='Duyên','thong bao tro dung cong viec + binh luan');
ok(run('readNotifications_','duyen').unread===0,'khong tu bao chinh minh');
ok(run('readNotifications_','hamy').unread===0,'nguoi khac khong thay');
// task: tao moi tag Ha My; sua chi bao nguoi MOI
r=run('saveTaskEntry_',{title:'Làm báo cáo',description:'@Hà My phụ trách',createdBy:'Duyên'});
ok(r.ok&&run('readNotifications_','hamy').unread===1,'tao cong viec tag Ha My -> 1 thong bao');
const tid=r.id;
run('saveTaskEntry_',{id:tid,title:'Làm báo cáo',description:'@Hà My phụ trách',createdBy:'Duyên'});
ok(run('readNotifications_','hamy').unread===1,'sua cong viec khong doi tag -> khong bao lai');
run('saveTaskEntry_',{id:tid,title:'Làm báo cáo',description:'@Hà My phụ trách và @Hà',createdBy:'Duyên'});
ok(run('readNotifications_','hamy').unread===1&&run('readNotifications_','ha').unread===2,'them tag moi chi bao nguoi moi');
// note khach
ok(run('_notifyMentions_',{text:'KH hẹn mai, @Duyên gọi lại',from:'Hà',kind:'note',refType:'customer',refId:'0912345678'})===1,'ghi chu khach tag Duyen');
const dn=run('readNotifications_','duyen');
ok(dn.items[0].refType==='customer'&&dn.items[0].refId==='0912345678'&&dn.items[0].kind==='note','thong bao ghi chu tro dung SDT khach');
// da doc
ok(run('markNotifRead_','hamy',[dn.items[0].id],false).marked===0,'danh dau id cua nguoi khac -> khong doi');
ok(run('markNotifRead_','duyen',[dn.items[0].id],false).marked===1&&run('readNotifications_','duyen').unread===0,'danh dau da doc');
ok(run('markNotifRead_','ha',[],true).marked===2&&run('readNotifications_','ha').unread===0,'danh dau tat ca');
// khong phinh: luu binh luan khong loi khi readUsers_ hong
ctx.readUsers_=()=>{throw new Error('boom');};
r=run('saveTaskComment_',{taskId:'tk2',author:'Hà',content:'@Duyên'});
ok(r.ok,'loi thong bao khong lam hong viec luu binh luan');
ok(/notifications:1, notifRead:1, notifMention:1/.test(src),'3 action moi nam trong NTL_ACTIONS_');
console.log(fail?'\nFAILED '+fail:'\nALL NOTIFY TESTS PASSED');process.exit(fail?1:0);

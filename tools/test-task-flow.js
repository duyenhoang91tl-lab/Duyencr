#!/usr/bin/env node
// Test logic QUY TRINH CONG VIEC (gas_v13.js): chuyen tiep, yeu cau/duyet, quyen. Mo phong Sheets bang bo nho.
// Chay: node tools/test-task-flow.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','gas_v13.js'),'utf8');
const sheets={};
function mkSheet(){
  const rows=[];
  const sh={
    rows,
    getLastRow:()=>rows.length, getLastColumn:()=>rows.length?rows[0].length:0,
    appendRow:r=>{rows.push(r.slice());},
    deleteRow:i=>{rows.splice(i-1,1);},
    getDataRange:()=>({getValues:()=>rows.map(r=>r.slice())}),
    getRange:(r,c,nr=1,nc=1)=>({
      getValues:()=>{const o=[];for(let i=0;i<nr;i++){const row=rows[r-1+i]||[];const x=[];for(let j=0;j<nc;j++)x.push(row[c-1+j]===undefined?'':row[c-1+j]);o.push(x);}return o;},
      setValues:v=>{for(let i=0;i<nr;i++){rows[r-1+i]=rows[r-1+i]||[];for(let j=0;j<nc;j++)rows[r-1+i][c-1+j]=v[i][j];}},
      createTextFinder:txt=>({matchEntireCell:()=>({findNext:()=>{for(let i=0;i<nr;i++){if(String((rows[r-1+i]||[])[c-1])===String(txt))return{getRow:()=>r+i};}return null;}})})
    })
  };
  return sh;
}
const ctx={console,Date,JSON,Math,parseInt,isNaN,String,Object,Array,
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  ContentService:{createTextOutput:s=>({setMimeType:()=>JSON.parse(s),_raw:s}),MimeType:{JSON:1}},
  Utilities:{}, SpreadsheetApp:{}, CacheService:{}, PropertiesService:{}, Logger:{log(){}},
};
vm.createContext(ctx);
vm.runInContext(src,ctx);
ctx.jsonOut_=o=>o;
ctx.getSheet_=(name,headers)=>{ if(!sheets[name]){sheets[name]=mkSheet(); if(headers)sheets[name].appendRow(headers);} return sheets[name]; };
let fail=0; const ok=(c,m)=>{ if(!c){console.log('FAIL:',m);fail++;} else console.log('ok  :',m); };
const run=(f,...a)=>vm.runInContext(f+'(...__a)',Object.assign(ctx,{__a:a}));

// 1) mau co san + tao viec theo quy trinh co duyet
const flows=run('readTaskFlows_'); ok(flows.length===2,'seed 2 quy trinh');
const ht=flows.find(f=>f.id==='flow_hoantien'); ok(ht.stages.length===4&&ht.stages[1].approval===true,'Hoan tien: 4 buoc, buoc 2 can duyet');
const A=ht.stages.map(s=>s.id);
let r=run('saveTaskEntry_',{title:'0338975750',flowId:'flow_hoantien',createdBy:'Duyên',
  stageAssignees:{[A[0]]:['Thúy Anh'],[A[1]]:['Oanh'],[A[2]]:['Diệu My'],[A[3]]:['Thúy Anh']},stageApprovers:{[A[1]]:['Kế toán Oanh']}});
ok(r.ok,'tao viec'); const id=r.id;
let t=run('readTasks_',sheets.Tasks)[0];
ok(t.stageIdx===0&&t.status==='Đang làm'&&t.csAssigned.length===3,'khoi tao buoc 0, Dang lam, csAssigned gop nguoi cac buoc: '+t.csAssigned);
// 2) sai nguoi
r=run('taskAdvance_',{taskId:id,by:'Oanh'}); ok(r.error&&/khong phai nguoi/i.test(r.error),'Oanh chua den luot -> chan');
// 3) chuyen tiep thuong buoc 0
r=run('taskAdvance_',{taskId:id,by:'Thúy Anh'}); ok(r.ok&&r.stageIdx===1,'Thuy Anh chuyen buoc 0->1');
// 4) buoc 1 can duyet -> tao request
r=run('taskAdvance_',{taskId:id,by:'Oanh'}); ok(r.ok&&r.pending,'buoc 1 gui yeu cau duyet'); const rid=r.requestId;
t=run('readTasks_',sheets.Tasks)[0]; ok(t.stageIdx===1,'chua chuyen buoc khi chua duyet');
r=run('taskAdvance_',{taskId:id,by:'Oanh'}); ok(r.error&&/cho nguoi duyet/i.test(r.error),'khong gui trung khi dang cho');
// 5) nguoi la duyet -> chan; tu choi -> giu nguyen
r=run('taskRequestDecide_',{requestId:rid,by:'Hùng',decision:'approve'}); ok(r.error,'nguoi ngoai danh sach duyet bi chan');
r=run('taskRequestDecide_',{requestId:rid,by:'Kế toán Oanh',decision:'reject',note:'thieu STK'}); ok(r.rejected,'tu choi');
t=run('readTasks_',sheets.Tasks)[0]; ok(t.stageIdx===1,'tu choi -> giu buoc 1');
r=run('taskRequestDecide_',{requestId:rid,by:'Kế toán Oanh',decision:'approve'}); ok(r.error&&/da duoc xu ly/i.test(r.error),'khong duyet lai yeu cau da xu ly');
// 6) gui lai, chap nhan -> sang buoc 2
r=run('taskAdvance_',{taskId:id,by:'Oanh'}); const rid2=r.requestId; ok(r.pending,'gui lai');
r=run('taskRequestDecide_',{requestId:rid2,by:'Kế toán Oanh',decision:'approve'}); ok(r.ok&&r.stageIdx===2,'chap nhan -> buoc 2');
const log=run('readTasks_',sheets.Tasks)[0].stageLog; ok(log[1].approvedBy==='Kế toán Oanh'&&log[1].doneAt,'stageLog ghi nguoi duyet + doneAt');
// 7) toi cuoi -> Hoan thanh
r=run('taskAdvance_',{taskId:id,by:'Diệu My'}); ok(r.ok&&r.stageIdx===3,'buoc 2->3');
r=run('taskAdvance_',{taskId:id,by:'Thúy Anh'}); ok(r.ok&&r.status==='Hoàn thành'&&r.stageIdx===4,'buoc cuoi -> Hoan thanh');
r=run('taskAdvance_',{taskId:id,by:'Thúy Anh'}); ok(r.error,'da hoan thanh -> khong chuyen nua');
// 8) sua task (modal cu) khong pha stageIdx/stageLog
t=run('readTasks_',sheets.Tasks)[0];
r=run('saveTaskEntry_',{id:id,title:'0338975750 (sua)',status:'Hoàn thành',csAssigned:t.csAssigned});
const t2=run('readTasks_',sheets.Tasks)[0]; ok(t2.stageIdx===4&&t2.flowId==='flow_hoantien'&&t2.stageLog.length===4&&Object.keys(t2.stageAssignees).length===4,'sua task giu nguyen flow/stage/nguoi phu trach');
// 9) thao luan: he thong + comment co file/tag
const cm=run('readTaskComments_',sheets.TaskComments,id); ok(cm.length>=6&&cm.some(c=>c.kind==='request'),'luong thao luan co dong he thong + request: '+cm.length);
r=run('saveTaskComment_',{taskId:id,author:'Duyên',content:'@Oanh xem giúp',files:[{name:'a.pdf',url:'u'}],mentions:['Oanh']});
const cm2=run('readTaskComments_',sheets.TaskComments,id).pop(); ok(cm2.files[0].name==='a.pdf'&&cm2.mentions[0]==='Oanh'&&cm2.kind==='comment','comment co file + mention');
// 10) xoa quy trinh dang dung bi chan; viec cu (khong flow) van doc duoc
r=run('deleteTaskFlow_','flow_hoantien'); ok(r.error,'khong xoa quy trinh dang dung');
sheets.Tasks.appendRow(['tk_old','Viec cu','','["A"]','','Đang làm','X','','','[]','','[]']);
const old=run('readTasks_',sheets.Tasks).find(x=>x.id==='tk_old'); ok(old.flowId===''&&old.stageIdx===0&&Array.isArray(old.mentions),'viec cu (12 cot) van doc duoc');
console.log(fail?('\n'+fail+' FAIL'):'\nALL PASS'); process.exit(fail?1:0);

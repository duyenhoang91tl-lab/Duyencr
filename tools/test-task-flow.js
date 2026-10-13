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
      setValue:v=>{rows[r-1]=rows[r-1]||[];rows[r-1][c-1]=v;},
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
const USERS=[['thuyanh','Thúy Anh'],['oanh','Oanh'],['ketoan','Kế toán Oanh'],['dieumy','Diệu My'],['duyen','Duyên'],['hung','Hùng']].map(([u,n])=>({username:u,name:n,active:true,names:[]}));
ctx.readUsers_=()=>USERS; ctx.getCrmSS_=()=>({getSheetByName:()=>null});
ctx._sessUser_=tok=>({tokThuy:USERS[0],tokOanh:USERS[1],tokAdmin:{username:'admin',name:'Quản trị',role:'admin'}})[tok]||null;
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
// 11) M5a: khoa cau truc quy trinh dang dung
const cur=run('readTaskFlows_').find(f=>f.id==='flow_hoantien');
const renamed=JSON.parse(JSON.stringify(cur)); renamed.stages[0].name='Đề nghị chi (mới)'; renamed.stages[2].approval=true;
ok(run('saveTaskFlow_',renamed).ok,'quy trinh dang dung: doi ten + co can duyet van duoc');
const ins=JSON.parse(JSON.stringify(cur)); ins.stages.splice(1,0,{id:'new1',name:'Buoc chen'});
ok(/nhan ban/i.test(run('saveTaskFlow_',ins).error||''),'quy trinh dang dung: CHEN buoc bi chan');
const rev=JSON.parse(JSON.stringify(cur)); rev.stages.reverse(); ok(run('saveTaskFlow_',rev).error,'quy trinh dang dung: DOI THU TU bi chan');
const rem=JSON.parse(JSON.stringify(cur)); rem.stages.pop(); ok(run('saveTaskFlow_',rem).error,'quy trinh dang dung: XOA buoc bi chan');
const unused=run('saveTaskFlow_',{name:'Moi',stages:[{name:'A'},{name:'B'}]}); ok(unused.ok,'tao quy trinh moi');
const nf=run('readTaskFlows_').find(f=>f.id===unused.id); nf.stages.splice(1,0,{name:'Giua'});
ok(run('saveTaskFlow_',nf).ok&&run('readTaskFlows_').find(f=>f.id===unused.id).stages.length===3,'quy trinh CHUA dung: doi cau truc thoai mai');
// 12) M6: thong bao su kien quy trinh (sheet Notifications, nguoi nhan = username)
const N=()=>(sheets.Notifications?sheets.Notifications.rows.slice(1):[]);
const nk=(to,kind)=>N().filter(x=>x[1]===to&&x[3]===kind).length;
ok(nk('thuyanh','task_assign')===1&&nk('oanh','task_assign')===0,'tao viec: chi nguoi buoc DAU duoc bao "giao ban"');
ok(nk('oanh','task_turn')===1&&nk('dieumy','task_turn')===1&&nk('thuyanh','task_turn')===1,'chuyen tiep: nguoi buoc ke tiep duoc bao "den luot ban" (Oanh, Dieu My, Thuy Anh buoc cuoi)');
ok(nk('ketoan','task_request')===2,'gui yeu cau duyet: nguoi duyet duoc bao (2 lan gui)');
ok(nk('oanh','task_decision')===2,'nguoi gui duoc bao ket qua duyet (1 tu choi + 1 chap nhan)');
ok(nk('duyen','task_done')===1,'hoan thanh: nguoi tao duoc bao');
ok(N().every(x=>x[4]==='task'&&x[5]===id&&x[8]&&x[9]===''),'moi thong bao tro dung viec, chua doc');
ok(N().filter(x=>x[2]==='Thúy Anh').every(x=>x[1]!=='thuyanh')&&N().every(x=>x[1]!==({'Oanh':'oanh'}[x[2]])),'khong tu bao chinh nguoi thao tac');
// 13) danh tinh bang token phien: khong gia danh bang truong by
r=run('saveTaskEntry_',{title:'Viec 2',flowId:'flow_donhang',createdBy:'Duyên',stageAssignees:Object.fromEntries(run('readTaskFlows_').find(f=>f.id==='flow_donhang').stages.map((st,i)=>[st.id,[i?'Oanh':'Thúy Anh']]))});
const id2=r.id;
r=run('taskAdvance_',{taskId:id2,by:'Thúy Anh',token:'tokOanh'}); ok(r.error&&/khong phai nguoi/i.test(r.error),'token cua Oanh + by="Thuy Anh" -> bi chan (danh tinh lay tu token)');
r=run('taskAdvance_',{taskId:id2,by:'Oanh',token:'tokThuy'}); ok(r.ok&&r.stageIdx===1,'token cua Thuy Anh duoc chap nhan du by khai sai');
ok(run('readTasks_',sheets.Tasks).find(x=>x.id===id2).stageLog[0].by==='Thúy Anh','stageLog ghi ten theo token');
// 14) tag: server tu tinh ten hien thi tu text, gop Tasks.mentions
run('saveTaskComment_',{taskId:id2,author:'Duyên',content:'@oanh va @Kế toán Oanh xem giúp',mentions:[]});
const cm3=run('readTaskComments_',sheets.TaskComments,id2).pop();
ok(JSON.stringify(cm3.mentions.slice().sort())===JSON.stringify(["Kế toán Oanh","Oanh"]),'server tinh mentions (ten dai uu tien, khong nham Oanh/Ke toan Oanh)');
ok(JSON.stringify(run('readTasks_',sheets.Tasks).find(x=>x.id===id2).mentions.slice().sort())===JSON.stringify(["Kế toán Oanh","Oanh"]),'Tasks.mentions gop dung');
ok(nk('oanh','comment')>=1&&nk('ketoan','comment')>=1,'thong bao @tag cua he thong cu van chay');
run('saveTaskComment_',{taskId:id2,author:'Duyên',content:'@oanh lan nua'});
ok(run('readTasks_',sheets.Tasks).find(x=>x.id===id2).mentions.length===2,'tag lap khong nhan doi');
// 15) Admin ep chuyen tiep
r=run('taskAdvance_',{taskId:id2,by:'Quản trị',force:true}); ok(/chi admin/i.test(r.error||''),'force khong token -> bi chan (khong tin by)');
r=run('taskAdvance_',{taskId:id2,token:'tokOanh',force:true}); ok(/chi admin/i.test(r.error||''),'force voi token nhan vien thuong -> bi chan');
const HT=run('readTaskFlows_').find(f=>f.id==='flow_hoantien').stages.map(x=>x.id);
r=run('saveTaskEntry_',{title:'Viec 3',flowId:'flow_hoantien',createdBy:'Duyên',stageAssignees:Object.fromEntries(HT.map((sid,i)=>[sid,[i<2?'Thúy Anh':'Oanh']])),stageApprovers:{}});
const id3=r.id; run('taskAdvance_',{taskId:id3,by:'Thúy Anh'});
const rq=run('taskAdvance_',{taskId:id3,by:'Thúy Anh'}); ok(rq.pending,'viec 3 dang cho duyet (nguoi duyet = nguoi buoc ke tiep: Oanh)');
r=run('taskAdvance_',{taskId:id3,token:'tokAdmin',force:true,note:'gap'}); ok(r.ok&&r.forced&&r.stageIdx===2,'admin ep chuyen: bo qua nguoi phu trach + dang cho duyet');
ok(run('readTaskRequests_',id3,false).every(q=>q.status!=='pending')&&run('readTaskRequests_',id3,false).some(q=>q.status==='cancelled'),'yeu cau duyet dang cho bi HUY');
ok(run('readTaskComments_',sheets.TaskComments,id3).some(c=>/ADMIN ÉP CHUYỂN/.test(c.content)&&/hủy 1 yêu cầu/.test(c.content)),'luong thao luan ghi ro admin ep chuyen');
r=run('taskRequestDecide_',{requestId:rq.requestId,by:'Oanh',decision:'approve'}); ok(r.error,'yeu cau da huy khong duyet duoc nua');
// 16) Doi nguoi phu trach / nguoi duyet giua chung
const DH=run('readTaskFlows_').find(f=>f.id==='flow_donhang').stages.map(x=>x.id);
r=run('saveTaskEntry_',{title:'Viec 4',flowId:'flow_donhang',createdBy:'Duyên',stageAssignees:Object.fromEntries(DH.map(sid=>[sid,['Thúy Anh']]))});
const id4=r.id, sid=DH;
r=run('taskReassign_',{taskId:id4,stageId:sid[0],assignees:['Hùng'],by:'Hùng'}); ok(/chi admin/i.test(r.error||''),'nguoi ngoai khong doi duoc');
r=run('taskReassign_',{taskId:id4,stageId:sid[0],assignees:[],by:'Duyên'}); ok(r.error,'khong cho de trong nguoi phu trach');
const before=nk('hung','task_turn');
r=run('taskReassign_',{taskId:id4,stageId:sid[0],assignees:['Hùng','Thúy Anh'],by:'Duyên'}); ok(r.ok,'nguoi tao doi duoc buoc hien tai');
ok(nk('hung','task_turn')===before+1,'nguoi MOI cua buoc hien tai duoc bao');
r=run('taskReassign_',{taskId:id4,stageId:sid[3],assignees:['Diệu My'],token:'tokThuy'}); ok(r.ok,'nguoi dang phu trach doi duoc buoc tuong lai');
ok(nk('dieumy','task_assign')>=1,'nguoi moi cua buoc tuong lai duoc bao "giao ban phu trach"');
let t4=run('readTasks_',sheets.Tasks).find(x=>x.id===id4); ok(t4.stageAssignees[sid[3]][0]==='Diệu My'&&t4.csAssigned.indexOf('Diệu My')>=0&&t4.csAssigned.indexOf('Hùng')>=0,'stageAssignees + csAssigned cap nhat');
run('taskAdvance_',{taskId:id4,by:'Thúy Anh'});
r=run('taskReassign_',{taskId:id4,stageId:sid[0],assignees:['Oanh'],by:'Duyên'}); ok(/da xong/i.test(r.error||''),'giai doan DA XONG khong doi duoc');
r=run('taskReassign_',{taskId:id4,stageId:sid[2],assignees:['Oanh'],token:'tokAdmin'}); ok(r.ok,'admin (token that) doi duoc');
ok(run('readTaskComments_',sheets.TaskComments,id4).some(c=>/người phụ trách:/.test(c.content)&&/→/.test(c.content)),'thao luan ghi "ai -> ai"');
r=run('taskReassign_',{taskId:id4,stageId:sid[1],approvers:['Oanh'],by:'Duyên'}); ok(/khong can nguoi duyet/i.test(r.error||''),'buoc khong can duyet -> khong gan nguoi duyet');
// nguoi duyet: viec 5 (hoan tien), nguoi duyet ban dau = Ke toan Oanh, dang cho duyet -> doi sang Hung
r=run('saveTaskEntry_',{title:'Viec 5',flowId:'flow_hoantien',createdBy:'Duyên',stageAssignees:Object.fromEntries(HT.map((x,i)=>[x,[i<2?'Thúy Anh':'Oanh']])),stageApprovers:{[HT[1]]:['Kế toán Oanh']}});
const id5=r.id; run('taskAdvance_',{taskId:id5,by:'Thúy Anh'}); const rq5=run('taskAdvance_',{taskId:id5,by:'Thúy Anh'}); ok(rq5.pending&&nk('ketoan','task_request')>=1,'viec 5 dang cho Ke toan Oanh duyet');
r=run('taskReassign_',{taskId:id5,stageId:HT[1],approvers:[],by:'Duyên'}); ok(r.ok,'de trong nguoi duyet -> dung nguoi buoc ke tiep (Oanh) lam nguoi duyet');
let q5=run('readTaskRequests_',id5,true)[0]; ok(JSON.stringify(q5.approvers)==='["Oanh"]','yeu cau dang cho duoc cap nhat nguoi duyet');
const nh=nk('hung','task_request'); r=run('taskReassign_',{taskId:id5,stageId:HT[1],approvers:['Hùng'],by:'Duyên'});
q5=run('readTaskRequests_',id5,true)[0]; ok(r.ok&&JSON.stringify(q5.approvers)==='["Hùng"]'&&nk('hung','task_request')===nh+1,'doi sang Hung: yeu cau cap nhat + Hung duoc bao "xin ban duyet"');
r=run('taskRequestDecide_',{requestId:q5.id,by:'Kế toán Oanh',decision:'approve'}); ok(/khong nam trong/i.test(r.error||''),'nguoi duyet CU het quyen duyet');
r=run('taskRequestDecide_',{requestId:q5.id,by:'Hùng',decision:'approve'}); ok(r.ok&&r.stageIdx===2,'nguoi duyet MOI duyet duoc, viec chuyen buoc');
// yeu cau cho + nguoi duyet duy nhat la chinh nguoi gui -> khong de trong
r=run('saveTaskEntry_',{title:'Viec 6',flowId:'flow_hoantien',createdBy:'Duyên',stageAssignees:Object.fromEntries(HT.map((x,i)=>[x,[i<2?'Thúy Anh':'Oanh']])),stageApprovers:{[HT[1]]:['Kế toán Oanh']}});
const id6=r.id; run('taskAdvance_',{taskId:id6,by:'Thúy Anh'}); run('taskAdvance_',{taskId:id6,by:'Thúy Anh'});
r=run('taskReassign_',{taskId:id6,stageId:HT[1],approvers:['Thúy Anh'],by:'Duyên'}); ok(/it nhat 1 nguoi duyet/i.test(r.error||''),'khong cho nguoi duyet chi la chinh nguoi gui yeu cau');
console.log(fail?('\n'+fail+' FAIL'):'\nALL PASS'); process.exit(fail?1:0);

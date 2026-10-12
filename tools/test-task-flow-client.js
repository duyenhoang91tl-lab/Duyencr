#!/usr/bin/env node
// Test client "Cong viec kieu Base" (js/44-fn-taskflow.js + js/45-fn-taskflow-admin.js + hien thi thong bao js/39-fn-notify.js).
// DOM gia, chay: node tools/test-task-flow-client.js   (test backend: node tools/test-task-flow.js)
const fs=require('fs'),path=require('path'),vm=require('vm');
const rd=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
const els={}, rowOf={};
function el(id){ return els[id]||(els[id]={id,value:'',innerHTML:'',disabled:false,style:{},addEventListener(){},closest(){return rowOf[id]||null;},getAttribute(k){return this['_'+k]||null;},classList:{add(){},remove(){}}}); }
const FLOWS=[{id:'f1',name:'Hoàn tiền',stages:[{id:'a',name:'Đề nghị',approval:false},{id:'b',name:'Xác nhận',approval:true},{id:'c',name:'Chi',approval:false}]}];
const ctx={console,JSON,Array,Object,Set,Promise,Date,Math,setTimeout,
  fetch:async()=>({json:async()=>({flows:FLOWS})}),
  document:{getElementById:el,querySelectorAll:()=>[]},
  gsUrl:'http://x',accounts:[{name:'Oanh'},{name:'Thúy Anh'},{name:'Kế toán Oanh',role:'admin'}],_allCSNames:()=>['Diệu My'],
  esc:s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),_foldVi:fold,
  allTasks:[],allTaskComments:[],loadTasks:async()=>{},renderTaskTables(){},openTaskModal(){},openTaskDetailModal(){},switchTaskDetailTab(){},renderTaskComments(){}};
ctx.window=ctx; vm.createContext(ctx);
vm.runInContext(rd('js/44-fn-taskflow.js'),ctx);
vm.runInContext(rd('js/45-fn-taskflow-admin.js'),ctx);
let fail=0; const ok=(c,m)=>{ if(!c){console.log('FAIL:',m);fail++;} else console.log('ok  :',m); };
const R=c=>vm.runInContext(c,ctx);
(async()=>{
 // ── M2: chon quy trinh ──
 await ctx.loadTaskFlows(true); ok(R('allTaskFlows.length')===1,'tai quy trinh tu GAS');
 rowOf['task-f-status']={style:{}}; el('task-f-legacy-assign'); el('task-f-flow-stages');
 ctx.openTaskModal(); await new Promise(r=>setTimeout(r,5));
 ok(/Hoàn tiền \(3 giai đoạn\)/.test(el('task-f-flow').innerHTML),'select co quy trinh');
 ok(R('_tfValidate()')===''&&JSON.stringify(R('_tfCollect()'))==='{}','khong chon quy trinh -> hop le, khong them truong');
 el('task-f-flow').value='f1'; R('_tfOnFlowChange()');
 ok(el('task-f-legacy-assign').style.display==='none'&&rowOf['task-f-status'].style.display==='none','chon quy trinh -> an Team/user cu + Trang thai');
 ok(/chưa có người/.test(R('_tfValidate()')),'chua gan nguoi -> bao loi');
 R('_tfAdd("as","a","Thúy Anh")');R('_tfAdd("as","b","Oanh")');R('_tfAdd("as","c","Thúy Anh")');R('_tfAdd("as","c","Thúy Anh")');
 ok(R('_tfValidate()')===''&&R('_tfStageAssign.c.length')===1,'du nguoi -> hop le; trung ten khong nhan doi');
 R('_tfAdd("ap","b","Kế toán Oanh")');
 const c=R('_tfCollect()'); ok(c.flowId==='f1'&&c.stageAssignees.b[0]==='Oanh'&&c.stageApprovers.b[0]==='Kế toán Oanh'&&!('a' in c.stageApprovers),'collect dung, chi buoc approval co nguoi duyet');
 ok(/cần duyệt khi chuyển tiếp/.test(el('task-f-flow-stages').innerHTML)&&/Kế toán Oanh/.test(el('task-f-flow-stages').innerHTML),'render co badge + admin chon duoc lam nguoi duyet');
 R('_tfRemove("as","c","Thúy Anh")'); ok(/"Chi"/.test(R('_tfValidate()')),'bo nguoi -> bao loi lai');
 R('_tfInit({flowId:"f1",stageAssignees:{a:["Oanh"],b:["Oanh"],c:["Oanh"]},stageApprovers:{b:["Thúy Anh"]}})');
 ok(el('task-f-flow').disabled===true&&R('_tfStageApprove.b[0]')==='Thúy Anh','sua viec: khoa doi quy trinh, nap lai nguoi phu trach');
 // ── M3: mo hinh chi tiet ──
 const flow=FLOWS[0], t0=Date.parse('2026-10-05T00:00:00Z');
 const t={id:'t',flowId:'f1',createdBy:'Duyên',stageIdx:1,stageAssignees:{a:['Thúy Anh'],b:['Oanh'],c:['My']},
  stageLog:[{stageId:'a',startedAt:'2026-10-05T00:00:00Z',doneAt:'2026-10-05T04:30:00Z',by:'Thúy Anh'},{stageId:'b',startedAt:'2026-10-05T04:30:00Z'}],pendingReq:[]};
 ctx.__t=t; ctx.__f=flow;
 const M=(me,now)=>R('_tfStageModel(__t,__f,"'+me+'",'+now+')');
 let m=M('Oanh',t0+10*3600000);
 ok(m.rows[0].state==='done'&&m.rows[1].state==='current'&&m.rows[2].state==='todo','trang thai buoc done/current/todo');
 ok(m.rows[0].hours===4.5&&Math.abs(m.rows[1].hours-5.5)<1e-9,'gio thuc te tu stageLog');
 ok(m.canAdvance&&m.needsApproval&&!M('My',t0).canAdvance&&M('Duyên',t0).canAdvance,'ai bam duoc Chuyen tiep: nguoi phu trach/nguoi tao');
 t.pendingReq=[{id:'r',status:'pending',requestedBy:'Oanh',approvers:['Kế toán Oanh'],createdAt:'2026-10-05T05:00:00Z'}];
 ok(!M('Oanh',t0).canAdvance&&M('Kế toán Oanh',t0).myApprovals.length===1&&M('Oanh',t0).myApprovals.length===0,'dang cho duyet: an nut chuyen tiep; chi nguoi duyet thay Chap nhan/Tu choi');
 ctx.allTaskFlows=[flow]; ctx._tfLoaded=true; ctx.currentUser={name:'Kế toán Oanh'};
 ok(/Chấp nhận/.test(R('_tfDetailHtml(__t)'))&&/chờ duyệt/.test(R('_tfListBadge(__t)')),'HTML chi tiet cho nguoi duyet + nhan danh sach');
 t.stageIdx=3; t.pendingReq=[]; m=M('Oanh',t0); ok(m.finished&&!m.canAdvance&&m.rows.every(r=>r.state==='done'),'hoan thanh: het nut');
 ok(R('_tfStageModel(null,__f,"x")')===null,'viec khong quy trinh -> null');
 // ── M4: thao luan ──
 ctx.__c={kind:'system',author:'Oanh',content:'đã chuyển tiếp',createdAt:'2026-10-05T00:00:00Z'};
 ok(/tf-sys/.test(R('_tfCommentHtml(__c)')),'dong he thong');
 ctx.__c={kind:'comment',author:'Duyên',content:'@Oanh <b>xem</b>',mentions:['Oanh'],files:[{name:'a.pdf',url:'https://d/x',size:20480}],images:['https://i/1'],createdAt:'2026-10-05T00:00:00Z'};
 const h=R('_tfCommentHtml(__c)');
 ok(/tf-mention">@Oanh/.test(h)&&/&lt;b&gt;/.test(h)&&!/<b>xem/.test(h),'tag to mau + noi dung escape (chong XSS)');
 ok(/a\.pdf/.test(h)&&/20 KB/.test(h)&&/https:\/\/i\/1/.test(h),'hien tep + dung luong + anh');
 ctx.__t2={createdBy:'Duyên',createdAt:'1',images:['u0']}; ctx.__cm=[ctx.__c,{kind:'system',author:'x',content:'y',images:[],files:[]}];
 const att=R('_tfCollectAttachments(__t2,__cm)'); ok(att.length===3&&att.filter(a=>a.kind==='file').length===1,'tai lieu dinh kem = anh mo ta + anh/tep thao luan');
 ok(R('_tfIsImage({mime:"image/png"})&&!_tfIsImage({mime:"application/pdf"})&&_tfIsImage({file:{type:"image/jpeg"}})'),'nhan dien anh / tep');
 ok(!/_tfExtractMentions|tf-mention-box/.test(rd('js/44-fn-taskflow.js')),'khong con goi y @ rieng (js/39-fn-notify.js lo)');
 // ── M5: bo loc + quan ly ──
 const T=[
  {id:'1',flowId:'f1',status:'Đang làm',stageIdx:0,stageAssignees:{a:['Hà'],b:['Oanh'],c:['Hà']},pendingReq:[],mentions:[]},
  {id:'2',flowId:'f1',status:'Đang làm',stageIdx:1,stageAssignees:{a:['Hà'],b:['Oanh'],c:['Hà']},pendingReq:[{status:'pending',approvers:['Kế toán']}],mentions:['Hà']},
  {id:'3',flowId:'f1',status:'Hoàn thành',stageIdx:3,stageAssignees:{a:['Hà'],b:['Hà'],c:['Hà']},pendingReq:[],mentions:[]},
  {id:'4',status:'Đang làm',csAssigned:['Hà'],mentions:[]}];
 ctx.allTasks=T; ctx.__T=T;
 const S=(i,s,me)=>{ctx.__i=i;return R('_tfScopeMatch(__T[__i],"'+s+'","'+me+'")');};
 ok(S(0,'waitMe','Hà')===true&&S(0,'waitMe','Oanh')===false&&S(1,'waitMe','Oanh')===false,'Cho toi xu ly: dung nguoi o buoc hien tai, dang cho duyet thi khong');
 ok(S(1,'approveMe','Kế toán')===true&&S(1,'approveMe','Hà')===false&&S(0,'approveMe','Kế toán')===false,'Cho toi duyet');
 ok(S(2,'waitMe','Hà')===false&&S(3,'waitMe','Hà')===false,'viec xong / viec thuong khong nam trong cho xu ly');
 ok(S(1,'taggedMe','Hà')===true&&S(0,'taggedMe','Hà')===false,'Toi duoc tag');
 ok(S(0,'mine','Hà')===undefined&&S(0,'all','Hà')===undefined&&S(0,'waitMe','')===false,'scope cu -> undefined (js/26 xu ly nhu truoc); chua dang nhap -> false');
 const cn=R('_tfCounts(allTasks,"Hà")'); ok(cn.waitMe===1&&cn.taggedMe===1&&cn.approveMe===0,'so dem tab');
 ok(R('_tfmUsedCount("f1")')===3,'dem viec dang dung quy trinh');
 ok(JSON.stringify(R('_tfmMoveStage([1,2,3],0,1)'))==='[2,1,3]'&&JSON.stringify(R('_tfmMoveStage([1,2,3],0,-1)'))==='[1,2,3]','doi thu tu giai doan');
 ok(R('_tfmValidate({name:"",stages:[{name:"a"}]})')&&R('_tfmValidate({name:"x",stages:[{name:" "}]})')&&/Trùng/.test(R('_tfmValidate({name:"x",stages:[{name:"A"},{name:" a "}]})'))&&R('_tfmValidate({name:"x",stages:[{name:"A"},{name:"B"}]})')==='','validate');
 const cl=R('_tfmCloneDraft(allTaskFlows[0])'); ok(cl.id===''&&cl.stages.every(s=>s.id==='')&&cl.stages[1].approval===true,'nhan ban bo id, giu co can duyet');
 // ── M6: hien thi thong bao su kien quy trinh (js/39-fn-notify.js) ──
 const nsrc=rd('js/39-fn-notify.js');
 const nctx={}; vm.createContext(nctx);
 vm.runInContext(nsrc.match(/function _ntIsTaskEvt[^\n]*\n/)[0]+nsrc.match(/function _ntTaskIcon[^\n]*\n/)[0],nctx);
 ok(vm.runInContext('_ntIsTaskEvt({kind:"task_turn"})&&!_ntIsTaskEvt({kind:"comment"})&&!_ntIsTaskEvt({kind:"note"})&&!_ntIsTaskEvt(null)',nctx),'nhan dien kind task_* (khong dung vao note/comment cu)');
 ok(['task_assign','task_turn','task_request','task_decision','task_done'].every(k=>vm.runInContext('_ntTaskIcon({kind:"'+k+'"})',nctx)!=='🔔'),'moi kind quy trinh co bieu tuong rieng');
 ok(/_ntIsTaskEvt\(it\)/.test(nsrc)&&/đã nhắc bạn/.test(nsrc),'_ntRender: kind task_* hien cau day du, kind cu giu nguyen "da nhac ban"');
 console.log(fail?('\n'+fail+' FAIL'):'\nALL PASS'); process.exit(fail?1:0);
})();

const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(require('path').join(__dirname,'..','gas_v13.js'),'utf8');
const sec=src.slice(src.indexOf('var PK_CHAT_SECTION_'));
const np=src.slice(src.indexOf('function normPhone_'),src.indexOf('// SDT di dong Viet Nam HOP LE'));
const calls=[],props={},users={u1:{username:'u1',role:'cs'},d1:{username:'d1',role:'demo'}};
const cache={};let sbReply=()=>({json:[]}), fetchReply=()=>({code:200,body:'{"success":true,"id":"m_1"}'});
const ctx={jsonOut_:o=>o,Logger:{log(){}},
 _sessUser_:t=>users[t]||null,
 // UrlFetchApp that nem 'Invalid argument: <url>' neu URL co ky tu khong hop le (> < " khoang trang { } | \ ^ `). Mock cu khong kiem tra nen
 // loi `raw->attachments` (ky tu > chua ma hoa) lot qua test va chi no tren may that (12/10/2026).
 sb_:(m,p,b,h)=>{if(/[<>"\s{}|\\^`]/.test(String(p)))throw new Error('Invalid argument: https://x.supabase.co/rest/v1/'+p);calls.push({m,p,b,h});return sbReply(m,p,b)},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null})},
 UrlFetchApp:{fetch:(u,o)=>{calls.push({fetch:u,o});const r=fetchReply();return{getResponseCode:()=>r.code,getContentText:()=>r.body}}},
 CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v}})},
 encodeURIComponent,Date,JSON,RegExp,Array,String,Object,Number};
vm.createContext(ctx);vm.runInContext(np+sec,ctx);
const cq=()=>calls.filter(c=>c.p===undefined||!/^pk_staff/.test(String(c.p)));
const mq=()=>cq().filter(c=>/^pk_messages/.test(String(c.p)));   // chi cac truy van doc tin nhan   // bo qua truy van pk_staff (ten nhan vien) de chi so khong lech
const t=(n,v)=>console.log((v?'OK  ':'FAIL'),n);
(async()=>{
 t('khong token -> AUTH',ctx.pkChat_({parameter:{phone:'0900000001'}}).code==='AUTH');
 t('demo bi chan',/Tai khoan test/.test(ctx.pkChat_({parameter:{token:'d1',phone:'0900000001'}}).error));
 t('SDT sai',/khong hop le/.test(ctx.pkChat_({parameter:{token:'u1',phone:'12'}}).error));
 // pkChat: 2 hoi thoai, tin tra ve desc -> out asc
 sbReply=(m,p)=>p.startsWith('pk_conversations')?{json:[{id:'P1_U1',page_id:'P1',customer_name:'An',customer_phone:'0900000001',last_message_at:'2026-10-12T01:00:00Z',last_text:'xin chao',seen:true,is_replied:false,conv_type:'INBOX'}]}
   :{json:[{id:'m2',conversation_id:'P1_U1',direction:'out',text:'da vang',sent_at:'2026-10-12T01:00:00Z',sender_name:'Page',attachments:null},{id:'m1',conversation_id:'P1_U1',direction:'in',text:'xin chao',sent_at:'2026-10-12T00:59:00Z',sender_name:'An',attachments:[{type:'photo',url:'https://x/y.jpg'},{url:'javascript:alert(1)'}]}]};
 calls.length=0;let r=ctx.pkChat_({parameter:{token:'u1',phone:'+84 900 000 001',after:''}});
 t('pkChat: SDT chuan hoa 0900000001 trong truy van',cq()[0].p.includes('customer_phone=eq.0900000001'));
 t('pkChat: tin xep cu->moi',r.messages.map(m=>m.id).join()==='m1,m2' && r.messages[0].dir==='in' && r.messages[1].dir==='out');
 t('pkChat: chi giu url http(s) cua dinh kem',r.messages[0].att.length===1 && r.messages[0].att[0].url==='https://x/y.jpg');
 t('pkChat: in.() dung ngoac kep + ma hoa',cq()[1].p.includes(encodeURIComponent('in.("P1_U1")')));
 calls.length=0;ctx.pkChat_({parameter:{token:'u1',phone:'0900000001',after:'2026-10-12T00:59:30Z'}});
 t('pkChat after -> sent_at=gt',cq()[1].p.includes('sent_at=gt.2026-10-12T00%3A59%3A30Z')&&cq()[1].p.includes('limit=100'));
 calls.length=0;ctx.pkChat_({parameter:{token:'u1',phone:'0900000001',after:"x'; drop"}});
 t('pkChat after khong hop le bi bo',!cq()[1].p.includes('sent_at=gt'));
 // Find
 calls.length=0;sbReply=()=>({json:[]});ctx.pkChatFind_({parameter:{token:'u1',q:'Nguyen (Van) *A,'}});
 t('Find ten: bo ky tu dac biet',cq()[0].p.includes('customer_name=ilike.')&&!/[(),]|%2C|%28/.test(cq()[0].p.split('customer_name=ilike.')[1].split('&')[0]));
 calls.length=0;ctx.pkChatFind_({parameter:{token:'u1',q:'0912345678'}});
 t('Find SDT -> customer_phone like',cq()[0].p.includes('customer_phone=like.'));
 t('Find qua ngan',/it nhat 2/.test(ctx.pkChatFind_({parameter:{token:'u1',q:'a'}}).error));
 // Link
 t('Link SDT sai',/khong hop le/.test(ctx.pkChatLink_({token:'u1',convId:'C',phone:'123'}).error));
 sbReply=()=>({json:[{id:'C',customer_phone:'0912345678'}]});calls.length=0;r=ctx.pkChatLink_({token:'u1',convId:'C',phone:'84912345678'});
 t('Link thanh cong + chuan hoa',r.ok&&cq()[0].m==='PATCH'&&cq()[0].b.customer_phone==='0912345678'&&cq()[0].h.Prefer==='return=representation');
 sbReply=()=>({json:[]});t('Link khong thay hoi thoai',/Khong tim thay/.test(ctx.pkChatLink_({token:'u1',convId:'C',phone:''}).error));
 // Send
 sbReply=()=>({json:[{id:'P1_U1',page_id:'P1',conv_type:'INBOX'}]});
 t('Send: rong',/trong/.test(ctx.pkChatSend_({token:'u1',convId:'P1_U1',text:'  '}).error));
 t('Send: demo bi chan',/Tai khoan test/.test(ctx.pkChatSend_({token:'d1',convId:'P1_U1',text:'a'}).error));
 r=ctx.pkChatSend_({token:'u1',convId:'P1_U1',text:'hi'});t('Send: chua co token -> huong dan',/PANCAKE_PAGE_TOKENS/.test(r.error)&&!/pages\.fm/.test(r.error));
 props.PANCAKE_PAGE_TOKENS='{"P1":"TOK123"}';calls.length=0;r=ctx.pkChatSend_({token:'u1',convId:'P1_U1',text:'Chao ban'});
 const f=calls.find(c=>c.fetch);
 t('Send: dung public_api + page_access_token + body reply_inbox',r.ok&&f.fetch.startsWith('https://pages.fm/api/public_api/v1/pages/P1/conversations/P1_U1/messages?page_access_token=TOK123')&&JSON.parse(f.o.payload).action==='reply_inbox'&&JSON.parse(f.o.payload).message==='Chao ban');
 props.PANCAKE_USER_TOKEN='USR9';calls.length=0;ctx.pkChatSend_({token:'u1',convId:'P1_U1',text:'x'});
 t('Send: co user token -> endpoint /api/v1 + access_token',calls.find(c=>c.fetch).fetch.startsWith('https://pages.fm/api/v1/pages/P1/conversations/P1_U1/messages?access_token=USR9'));
 fetchReply=()=>({code:403,body:'{"success":false,"message":"no permission"}'});r=ctx.pkChatSend_({token:'u1',convId:'P1_U1',text:'x'});
 t('Send: Pancake loi -> bao loi, khong lo token',/HTTP 403/.test(r.error)&&!/USR9|TOK123/.test(JSON.stringify(r)));
 fetchReply=()=>({code:200,body:'{"success":true,"id":"m_9"}'});sbReply=()=>({json:[{id:'P1_C',page_id:'P1',conv_type:'COMMENT'}]});
 t('Send: hoi thoai binh luan bi chan',/binh luan/.test(ctx.pkChatSend_({token:'u1',convId:'P1_C',text:'x'}).error));
 t('Send: qua dai',/qua dai/.test(ctx.pkChatSend_({token:'u1',convId:'P1_U1',text:'a'.repeat(2001)}).error));

  // ── THE + NGUOI XU LY + NGUOI GUI (2026-10-12) ──
  for(const k in cache)delete cache[k];for(const k in ctx._pkMemo_)delete ctx._pkMemo_[k];   // cac ca truoc da cache ban do the RONG (that bai -> nho 10 phut) -> xoa de ca moi doc dung
  props.PANCAKE_PAGE_TOKENS='{"P1":"TOK123"}';
  const apiCalls=[];
  fetchReply=null;
  ctx.UrlFetchApp.fetch=(u,o)=>{apiCalls.push(u);let b='{}';
    if(/\/tags\?/.test(u))b=JSON.stringify({tags:[{id:26,text:'L1. Chuan',color:'#009344'},{id:28,text:'S7 ninhLTK',color:'javascript:evil'},{id:1,text:'Cau hoi',color:'#822ba1'}]});
    if(/\/users\?/.test(u))b=JSON.stringify({users:[{id:'u-uuid-1',name:'Le Ninh'},{id:'u-uuid-2',name:'Lan Anh'}]});
    return{getResponseCode:()=>200,getContentText:()=>b}};
  const convRow={id:'P1_U1',page_id:'P1',customer_name:'Men Hoang',customer_phone:'0934230669',last_message_at:'2026-10-12T01:00:00Z',last_text:'Sao v c',seen:true,is_replied:true,conv_type:'INBOX',tags:[26,28,-99,1],assignee_ids:['u-uuid-1','khong-co']};
  sbReply=(m,p)=>p.startsWith('pk_conversations')?{json:[convRow]}:{json:[]};
  let rr=ctx.pkChatInbox_({parameter:{token:'u1',q:''}});
  let c0=rr.conversations[0];
  t('the: ma so -> ten + mau (ma khong co trong danh sach bi bo)',c0.tags.map(x=>x.t).join('|')==='L1. Chuan|S7 ninhLTK|Cau hoi' && c0.tags[0].c==='#009344');
  t('the: mau khong hop le (javascript:) bi bo, khong lot vao client',c0.tags[1].c==='');
  t('nguoi xu ly: uuid -> ten, uuid la bi bo',c0.assignees.join()==='Le Ninh');
  t('page token KHONG nam trong ket qua tra ve',!JSON.stringify(rr).includes('TOK123'));
  const n1=apiCalls.length;ctx.pkChatInbox_({parameter:{token:'u1',q:''}});
  t('the/nhan vien duoc cache: goi lai khong goi them Pancake',apiCalls.length===n1 && n1===2);
  t('goi dung endpoint tags + users cua page',apiCalls.some(u=>u.startsWith('https://pages.fm/api/public_api/v1/pages/P1/tags?page_access_token=TOK123'))&&apiCalls.some(u=>u.includes('/pages/P1/users?')));
  // thu tu uu tien ten nguoi xu ly: bang pk_staff (pkNhanVienDongBo) truoc, API users cua Pancake la du phong
  for(const k in cache)delete cache[k];for(const k in ctx._pkMemo_)delete ctx._pkMemo_[k];   // hop thu co cache 15s (phien khac): xoa de khong nhan ket qua cu
  sbReply=(m,p)=>p.startsWith('pk_conversations')?{json:[convRow]}:(p.startsWith('pk_staff')?{json:[{id:'u-uuid-1',name:'Le Ninh (pk_staff)'}]}:{json:[]});
  rr=ctx.pkChatInbox_({parameter:{token:'u1',q:''}});
  t('nguoi xu ly: co ten trong pk_staff thi dung (uu tien hon API); uuid con lai khong ten -> bo',rr.conversations[0].assignees.join()==='Le Ninh (pk_staff)'&&rr.conversations[0].assigneeIds.length===2);
  sbReply=(m,p)=>p.startsWith('pk_conversations')?{json:[convRow]}:{json:[]};
  // the dang doi tuong + khong co token page -> khong loi
  rr=ctx._pkConvOut_({id:'X',page_id:'PX',tags:[{id:5,text:'VIP',color:'#abc'}],assignee_ids:[]},{});
  t('the dang doi tuong {id,text,color} dung truc tiep',rr.tags[0].t==='VIP'&&rr.tags[0].c==='#abc'&&Array.isArray(rr.assignees));
  props.PANCAKE_PAGE_TOKENS='{}';for(const k in cache)delete cache[k];for(const k in ctx._pkMemo_)delete ctx._pkMemo_[k];
  rr=ctx.pkChatInbox_({parameter:{token:'u1',q:''}});
  t('chua co token page: van tra hoi thoai, tags rong, khong loi',rr.ok&&rr.conversations[0].tags.length===0);
  props.PANCAKE_PAGE_TOKENS='{"P1":"TOK123"}';
  // tin nhan: nguoi gui
  const mrows=[{id:'m3',conversation_id:'P1_U1',direction:'out',text:'tu CRM',sent_at:'2026-10-12T03:00:00Z',sender_name:'Pham Thu Hien',crm_user:'Duyen',fromraw:{id:'P1',name:'Pham Thu Hien',admin_name:'Le Ninh'},attachments:null},
    {id:'m2',conversation_id:'P1_U1',direction:'out',text:'tu app Pancake',sent_at:'2026-10-12T02:00:00Z',sender_name:'Pham Thu Hien',crm_user:'',fromraw:{id:'P1',name:'Pham Thu Hien',admin_name:'Le Ninh'},attachments:null},
    {id:'m1',conversation_id:'P1_U1',direction:'in',text:'hi',sent_at:'2026-10-12T01:00:00Z',sender_name:'Men Hoang',crm_user:'Nguoi la',fromraw:{id:'U1',name:'Men Hoang',admin_name:'khong duoc lot'},attachments:null}];
  sbReply=(m,p)=>p.startsWith('pk_conversations')?{json:[convRow]}:{json:mrows};calls.length=0;
  rr=ctx.pkChatConv_({parameter:{token:'u1',conv:'P1_U1'}});
  const byId=Object.fromEntries(rr.messages.map(m=>[m.id,m]));
  t('tin gui tu CRM: hien ten nhan vien CRM (uu tien cao nhat) + co co crm',byId.m3.staff==='Duyen'&&byId.m3.crm===true);
  t('tin gui tu app Pancake: lay ten nhan vien tu raw.from.admin_name',byId.m2.staff==='Le Ninh'&&byId.m2.crm===false);
  t('tin khach: khong co staff (khong lot admin_name/crm_user cua nguoi khac), from = ten khach',byId.m1.staff===''&&byId.m1.from==='Men Hoang'&&byId.m1.crm===false);
  t('truy van tin chon crm_user + raw->from da ma hoa (khong co ky tu > tran)',mq()[0].p.includes('crm_user')&&mq()[0].p.includes('fromraw:raw-%3Efrom'));
  // cot crm_user chua co (schema chua deploy) -> doc lai khong co cot do
  calls.length=0;sbReply=(m,p)=>{ if(p.includes('crm_user'))throw new Error('Supabase HTTP 400 (GET pk_messages): column pk_messages.crm_user does not exist'); return {json:mrows.map(x=>{const y=Object.assign({},x);delete y.crm_user;return y})}};
  rr=ctx.pkChatConv_({parameter:{token:'u1',conv:'P1_U1'}});
  t('chua co cot crm_user: tu doc lai khong loi, van co ten nhan vien Pancake',rr.ok&&rr.messages.length===3&&rr.messages.find(m=>m.id==='m2').staff==='Le Ninh'&&mq().length===2&&!mq()[1].p.includes('crm_user'));
  // gui tu CRM -> ghi ten nhan vien CRM
  sbReply=()=>({json:[{id:'P1_U1',page_id:'P1',conv_type:'INBOX'}]});
  ctx.UrlFetchApp.fetch=(u,o)=>({getResponseCode:()=>200,getContentText:()=>'{"success":true,"id":"m_77"}'});
  users.u1.name='Nguyen Duyen';
  const writes=[];sbReply=(m,p,b)=>{ if(m!=='GET')writes.push({m,p,b}); if(m==='PATCH')return{json:[]}; return {json:[{id:'P1_U1',page_id:'P1',conv_type:'INBOX'}]}};
  rr=ctx.pkChatSend_({token:'u1',convId:'P1_U1',text:'Chao chi'});
  t('gui tu CRM: webhook chua vong lai -> PATCH khong co dong -> chen dong moi co crm_user (ten day du)',rr.ok&&writes[0].m==='PATCH'&&writes[1].m==='POST'&&writes[1].b.crm_user==='Nguyen Duyen'&&writes[1].b.id==='m_77'&&writes[1].h===undefined);
  t('gui tu CRM: chen kieu ignore-duplicates (khong ghi de du lieu webhook)',writes[1].p.includes('on_conflict=id'));
  writes.length=0;sbReply=(m,p,b)=>{ if(m!=='GET')writes.push({m,p,b}); if(m==='PATCH')return{json:[{id:'m_77'}]}; return {json:[{id:'P1_U1',page_id:'P1',conv_type:'INBOX'}]}};
  ctx.pkChatSend_({token:'u1',convId:'P1_U1',text:'Chao chi'});
  t('gui tu CRM: webhook da vong lai truoc -> chi PATCH crm_user, khong chen them',writes.length===1&&writes[0].m==='PATCH'&&writes[0].b.crm_user==='Nguyen Duyen');
  sbReply=(m,p,b)=>{ if(m==='PATCH')throw new Error('Supabase HTTP 400'); return {json:[{id:'P1_U1',page_id:'P1',conv_type:'INBOX'}]}};
  rr=ctx.pkChatSend_({token:'u1',convId:'P1_U1',text:'Chao chi'});
  t('gui tu CRM: ghi ten loi -> van bao gui thanh cong (best-effort)',rr.ok===true);

  { const src=require('fs').readFileSync(require('path').join(__dirname,'..','gas_v13.js'),'utf8'); const mv=src.match(/var PK_GAS_VER_ = '(v13\.\d+-[a-z0-9-]+)'/), cv=src.match(/ver: '(v13\.\d+-[a-z0-9-]+)' \}\);/);
    t('action=count tra CHUOI VIET THANG dung dang v13.NN-ten (test-crm-ask doc chuoi nay) va PK_GAS_VER_ cung dang do',!!mv&&!!cv); }
  // ── gv (nhan phien ban GAS), tagN, last_sent_by, chan doan ──
  for(const k in cache)delete cache[k];for(const k in ctx._pkMemo_)delete ctx._pkMemo_[k];
  props.PANCAKE_PAGE_TOKENS='{"P1":"TOK123"}';
  const convGv=Object.assign({},convRow,{lsb:{admin_id:'1',admin_name:'Le Ninh'}});
  const mm=[{id:'o2',conversation_id:'P1_U1',direction:'out',text:'moi nhat',sent_at:'2026-10-12T05:00:00Z',sender_name:'Page',crm_user:'',fromraw:{id:'P1',name:'Page'},attachments:null},
    {id:'i1',conversation_id:'P1_U1',direction:'in',text:'khach',sent_at:'2026-10-12T04:00:00Z',sender_name:'Khach',crm_user:'',fromraw:{id:'U1'},attachments:null},
    {id:'o1',conversation_id:'P1_U1',direction:'out',text:'cu',sent_at:'2026-10-12T03:00:00Z',sender_name:'Page',crm_user:'',fromraw:{id:'P1',name:'Page'},attachments:null}];
  sbReply=(m,p)=>p.startsWith('pk_conversations')?{json:[convGv]}:(p.startsWith('pk_messages')?{json:mm.slice()}:{json:[]});   // moi lan goi la ban sao moi (that: JSON moi), vi reverse() dao mang tai cho
  rr=ctx.pkChatConv_({parameter:{token:'u1',conv:'P1_U1'}});
  t('pkChatConv tra gv (GAS moi) de client biet da deploy',rr.gv===ctx.PK_GAS_VER_&&/^v13\.\d+-[a-z0-9-]+$/.test(rr.gv));
  const byI=Object.fromEntries(rr.messages.map(m=>[m.id,m]));
  t('last_sent_by -> dien ten cho tin out MOI NHAT khi raw.from khong co ten',byI.o2.staff==='Le Ninh');
  t('last_sent_by KHONG gan cho tin out cu hon (khong the biet ai gui) va khong gan cho tin khach',byI.o1.staff===''&&byI.i1.staff==='');
  mm[0].crm_user='Duyen';rr=ctx.pkChatConv_({parameter:{token:'u1',conv:'P1_U1'}});
  t('ten nhan vien CRM duoc uu tien hon last_sent_by',rr.messages.find(m=>m.id==='o2').staff==='Duyen');mm[0].crm_user='';
  rr=ctx.pkChatInbox_({parameter:{token:'u1',q:''}});
  t('pkChatInbox tra gv + tagN (so the da luu)',rr.gv===ctx.PK_GAS_VER_&&/^v13\.\d+-[a-z0-9-]+$/.test(rr.gv)&&rr.conversations[0].tagN===4);
  t('truy van hoi thoai lay last_sent_by da ma hoa',cq().some(c=>/pk_conversations/.test(c.p)&&c.p.includes('lsb:raw-%3Econversation-%3Elast_sent_by')));
  // chan doan: chi admin
  users.u1.role='cs';rr=ctx.pkChatDiag_({parameter:{token:'u1',conv:'P1_U1'}});
  t('chan doan: khong phai admin -> tu choi',!!rr.error&&!rr.ok);
  users.u1.role='admin';
  ctx.UrlFetchApp.fetch=(u,o)=>{let b='{}',code=200;if(/\/tags\?/.test(u))b=JSON.stringify({tags:[{id:26,text:'L1',color:'#009344'}]});if(/\/users\?/.test(u)){b='unauthorized';code=401}return{getResponseCode:()=>code,getContentText:()=>b}};
  mm[0].raw={from:{id:'P1',name:'Page',admin_name:'Le Ninh'},message:'NOI DUNG KHONG DUOC LO',page_id:'P1',inserted_at:'2026-10-12T05:00:00'};
  sbReply=(m,p)=>p.startsWith('pk_conversations')?{json:[convGv]}:(p.startsWith('pk_messages')?{json:mm.map(x=>Object.assign({},x))}:{json:[]});
  rr=ctx.pkChatDiag_({parameter:{token:'u1',conv:'P1_U1'}});
  t('chan doan (admin): co the luu, ket qua API tags/users (ma 401 hien ro), last_sent_by',rr.ok&&JSON.stringify(rr.tagsStored)==='[26,28,-99,1]'&&rr.tagsApi.ok&&rr.tagsApi.n===1&&rr.usersApi.ok===false&&rr.usersApi.code===401&&rr.lastSentBy.admin_name==='Le Ninh');
  t('chan doan: khoa raw.from cua tin gan nhat + noi dung tin KHONG bi lo + khong lo token',rr.messages[0].from.admin_name==='Le Ninh'&&rr.messages[0].rawKeys.includes('from')&&!JSON.stringify(rr).includes('NOI DUNG KHONG DUOC LO')&&!JSON.stringify(rr).includes('TOK123'));

  // ── last_sent_by tu API Pancake (API cong khai khong co ten theo TUNG tin) + luu lai ──
  for(const k in cache)delete cache[k];for(const k in ctx._pkMemo_)delete ctx._pkMemo_[k];
  const fcalls=[];
  ctx.UrlFetchApp.fetch=(u)=>{fcalls.push(u);let b='{}';if(/v2\/pages\/P1\/conversations/.test(u))b=JSON.stringify({success:true,conversations:[{id:'P1_U1',last_sent_by:{admin_id:'9',admin_name:'Lan Anh',id:'P1',name:'Page'}},{id:'P1_U9',last_sent_by:{id:'P1',name:'Page'}}]});return{getResponseCode:()=>200,getContentText:()=>b}};
  const wr=[];
  const mk=crm=>mm.map(x=>Object.assign({},x,{crm_user:x.id==='o2'?crm:'',fromraw:{id:'P1',name:'Page'}}));
  let crmVal='';
  sbReply=(m,p,b)=>{ if(m==='PATCH'){wr.push({p,b});return{json:[]};} return p.startsWith('pk_conversations')?{json:[Object.assign({},convGv,{lsb:null})]}:{json:mk(crmVal)}};
  rr=ctx.pkChatConv_({parameter:{token:'u1',conv:'P1_U1'}});
  const bb=Object.fromEntries(rr.messages.map(m=>[m.id,m]));
  t('API last_sent_by: gan ten nhan vien cho tin out MOI NHAT (khong co trong webhook)',bb.o2.staff==='Lan Anh'&&bb.o1.staff===''&&bb.i1.staff==='');
  t('API goi dung: v2 conversations cua page + page_access_token + type=INBOX',fcalls.length===1&&fcalls[0].includes('/v2/pages/P1/conversations?page_access_token=TOK123&type=INBOX'));
  t('da LUU staff_name cho tin do (PATCH chi khi chua co ten, khong de len ten da biet)',wr.length===1&&wr[0].p.includes('id=eq.o2')&&wr[0].p.includes('staff_name.is.null')&&wr[0].b.staff_name==='Lan Anh');
  ctx.pkChatConv_({parameter:{token:'u1',conv:'P1_U1'}});
  t('cache 60s: goi lai KHONG goi them API Pancake',fcalls.length===1);
  wr.length=0;crmVal='Duyen';rr=ctx.pkChatConv_({parameter:{token:'u1',conv:'P1_U1'}});
  t('tin gui tu CRM: giu ten CRM, KHONG ghi staff_name tu last_sent_by',rr.messages.find(m=>m.id==='o2').staff==='Duyen'&&wr.length===0);
  crmVal='';for(const k in cache)delete cache[k];for(const k in ctx._pkMemo_)delete ctx._pkMemo_[k];
  ctx.UrlFetchApp.fetch=()=>({getResponseCode:()=>500,getContentText:()=>'oops'});wr.length=0;
  rr=ctx.pkChatConv_({parameter:{token:'u1',conv:'P1_U1'}});
  t('API Pancake loi: khong hong chat, tin out hien ten page',rr.ok&&rr.messages.find(m=>m.id==='o2').staff==='');
  sbReply=(m,p,b)=>{ if(m==='PATCH')throw new Error('column staff_name does not exist'); return p.startsWith('pk_conversations')?{json:[Object.assign({},convGv,{lsb:null})]}:{json:mk('')}};
  ctx.UrlFetchApp.fetch=(u)=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({success:true,conversations:[{id:'P1_U1',last_sent_by:{admin_name:'Lan Anh'}}]})});
  for(const k in cache)delete cache[k];for(const k in ctx._pkMemo_)delete ctx._pkMemo_[k];
  rr=ctx.pkChatConv_({parameter:{token:'u1',conv:'P1_U1'}});
  t('chua co cot staff_name (schema chua deploy): van hien ten, khong loi',rr.ok&&rr.messages.find(m=>m.id==='o2').staff==='Lan Anh');
})();

// Test keo lich su Pancake (gas_v13.js, phan "KEO LICH SU TIN NHAN CU") bang mock UrlFetchApp/Supabase. Chay: node tools/test-pk-hist-gas.js
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','gas_v13.js'),'utf8');
const pk=src.slice(src.indexOf('var PK_CHAT_SECTION_'));   // gom ca phan chat (cung dung _pkEnc_) va phan lich su
const np=src.slice(src.indexOf('function normPhone_'),src.indexOf('// SDT di dong Viet Nam HOP LE'));
let ok=0,fail=0;const t=(n,v)=>{console.log((v?'OK  ':'FAIL')+' '+n);v?ok++:fail++;};
const iso=(daysAgo,min)=>new Date(Date.now()-daysAgo*86400000+min*60000).toISOString().replace('Z','').replace(/\.\d+$/,'.000000');
const mkMsgs=(conv,n,page,fromCust,extra)=>Array.from({length:n},(_,i)=>({id:conv+'_m'+i,conversation_id:conv,from:i%2?{id:page,name:'Page'}:{id:fromCust,name:'Khach'},inserted_at:iso(1,i),message:i%2?'<p>Da vang</p>':'Khach hoi '+i,attachments:i===0?[{type:'photo',url:'https://x/a.jpg'}]:[],phone_info:[]}));
const convs=[ // moi cap nhat -> cu
 {id:'P1_A',customer_id:'cA',from:{id:'A',name:'An'},customers:[{id:'cA',fb_id:'A',name:'An'}],type:'INBOX',updated_at:iso(1,70),tags:[1,2],current_assign_users:[{id:'u1'}]},
 {id:'P1_B',customer_id:'cB',from:{id:'B',name:'Binh'},type:'INBOX',updated_at:iso(5,0),tags:[]},
 {id:'P1_C',customer_id:'cC',from:{id:'C',name:'Cu'},type:'INBOX',updated_at:iso(200,0),tags:[]}];
const msgsOf={P1_A:mkMsgs('P1_A',65,'P1','A'),P1_B:[{id:'B1',from:{id:'B'},inserted_at:iso(5,1),message:'SDT em 0912.345.678 nhe',phone_info:[],attachments:[]},{id:'B2',from:{id:'P1'},inserted_at:iso(5,2),message:'Hotline shop 0987654321',phone_info:[],attachments:[]}],P1_C:mkMsgs('P1_C',3,'P1','C')};
const db={conv:[],msg:[],patch:[]},props={PANCAKE_PAGE_TOKENS:'{"P1":"TOK"}'},fetches=[];let failList=false;
const ctx={Logger:{log(){}},Utilities:{sleep(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v},deleteProperty:k=>{delete props[k]},getProperties:()=>props})},
 UrlFetchApp:{fetch:(u)=>{fetches.push(u);let body;
   if(failList&&u.includes('/v2/')) return{getResponseCode:()=>401,getContentText:()=>'{"success":false,"message":"bad token"}'};
   if(u.includes('/v2/pages/P1/conversations')){const cur=(/last_conversation_id=([^&]+)/.exec(u)||[])[1];const i=cur?convs.findIndex(c=>c.id===decodeURIComponent(cur))+1:0;body={success:true,conversations:convs.slice(i)};}
   else{const m=/conversations\/([^/]+)\/messages/.exec(u),id=decodeURIComponent(m[1]),cc=Number((/current_count=(\d+)/.exec(u)||[0,0])[1]);const all=msgsOf[id].slice().reverse();body={success:true,messages:all.slice(cc,cc+30)};}
   return{getResponseCode:()=>200,getContentText:()=>JSON.stringify(body)};}},
 sb_:(m,p,b,h)=>{if(m==='POST'&&p.startsWith('pk_conversations'))db.conv.push(...b);else if(m==='POST'&&p.startsWith('pk_messages'))b.forEach(x=>{if(!db.msg.some(y=>y.id===x.id))db.msg.push(x)});else if(m==='PATCH')db.patch.push({p,b});return{json:null}},
 encodeURIComponent,Date,JSON,RegExp,Array,String,Object,Number,Math,isNaN,parseInt};
vm.createContext(ctx);vm.runInContext(np+pk+';this.api={sync:pkHistSync_,tok:_pkAllPageTokens_,map:_pkMapMsg_,iso:_pkIso_,plain:_pkPlain_};',ctx);
// --- ham thuan
t('gio UTC khong mui gio -> them Z',ctx.api.iso('2026-10-12T01:00:00.000000')==='2026-10-12T01:00:00.000Z');
t('go HTML + entity',ctx.api.plain('<p>A &amp; B&nbsp;<b>c</b></p>')==='A & B c');
t('map tin: from=page -> out, khong lay SDT tu tin page',(m=>m.direction==='out'&&m._phone==='')(ctx.api.map({id:'x',from:{id:'P1'},message:'0987654321',inserted_at:'2026-10-12T01:00:00'},'P1','C')));
t('map tin: khach nhan SDT -> in + chuan hoa',(m=>m.direction==='in'&&m._phone==='0912345678')(ctx.api.map({id:'x',from:{id:'B'},message:'em 0912.345.678',inserted_at:'2026-10-12T01:00:00'},'P1','C')));
t('doc token tu PANCAKE_PAGE_TOKENS + PANCAKE_PAGE_TOKEN_<id>',(props.PANCAKE_PAGE_TOKEN_P2='T2',Object.keys(ctx.api.tok()).sort().join())==='P1,P2'&&(delete props.PANCAKE_PAGE_TOKEN_P2,true));
// --- chay thu (khong ghi)
let r=ctx.api.sync({dryRun:true,maxConvs:2});
t('dryRun: khong ghi gi vao Supabase, khong luu con tro',db.conv.length===0&&db.msg.length===0&&!props.PK_HIST_STATE&&r.dryRun&&r.sample.length===2);
t('dryRun: mau co hoi thoai + tin',r.sample[0].conv.id==='P1_A'&&r.sample[0].msgCount===65);
// --- chay that
fetches.length=0;r=ctx.api.sync({});
t('chay that: 2 hoi thoai (bo cai qua 90 ngay)',r.ok&&r.convs===2&&db.conv.map(c=>c.id).join()==='P1_A,P1_B');
t('keo du 65 tin cua A qua 3 trang (30+30+5)',db.msg.filter(m=>m.conversation_id==='P1_A').length===65&&fetches.filter(u=>u.includes('P1_A/messages')).length===3);
t('tin xep cu->moi, huong tin dung, HTML da go',(a=>a[0].direction==='in'&&a[1].direction==='out'&&a[1].text==='Da vang'&&a[0].sent_at<a[1].sent_at)(db.msg.filter(m=>m.conversation_id==='P1_A').sort((x,y)=>x.sent_at<y.sent_at?-1:1)));
t('raw.attachments duoc luu (de tab Chat hien anh)',db.msg.find(m=>m.id==='P1_A_m0').raw.attachments[0].url==='https://x/a.jpg');
t('SDT B lay tu tin KHACH, bo qua hotline cua page',db.conv.find(c=>c.id==='P1_B').customer_phone==='0912345678'&&db.patch.length===1&&db.patch[0].b.customer_phone==='0912345678'&&db.patch[0].p.includes('customer_phone.is.null'));
t('A khong co SDT -> khong PATCH',!db.patch.some(x=>x.p.includes('P1_A')));
t('conv map: tags/assignee/type/psid',(c=>c.psid==='A'&&c.conv_type==='INBOX'&&c.tags.join()==='1,2'&&c.assignee_ids.join()==='u1'&&c.customer_id==='cA')(db.conv[0]));
t('da xong -> luu trang thai done',JSON.parse(props.PK_HIST_STATE).P1.done===true&&r.done===true);
// --- chay lai: khong lap
const n=db.msg.length;fetches.length=0;r=ctx.api.sync({});t('chay lai khi da done: khong goi API, khong them gi',fetches.length===0&&db.msg.length===n);
// --- ngat + chay tiep bang con tro
delete props.PK_HIST_STATE;db.conv.length=0;db.msg.length=0;db.patch.length=0;
r=ctx.api.sync({maxConvs:1});t('lo 1: chi 1 hoi thoai, chua xong, con tro = P1_A',r.convs===1&&r.done===false&&JSON.parse(props.PK_HIST_STATE).P1.cursor==='P1_A');
r=ctx.api.sync({});t('lo 2: tiep tu P1_B, khong keo lai A',r.convs===1&&db.conv.map(c=>c.id).join()==='P1_A,P1_B'&&r.done===true);
// --- loi token
delete props.PK_HIST_STATE;failList=true;r=ctx.api.sync({});t('token sai -> bao loi ro rang, khong crash',r.ok===false&&/HTTP 401/.test(r.errors[0])&&!/TOK/.test(JSON.stringify(r)));failList=false;
// --- chua cai token
const keep=props.PANCAKE_PAGE_TOKENS;delete props.PANCAKE_PAGE_TOKENS;r=ctx.api.sync({});t('chua cai token -> huong dan',r.ok===false&&/PANCAKE_PAGE_TOKENS/.test(r.error));props.PANCAKE_PAGE_TOKENS=keep;
console.log('\n'+ok+' OK, '+fail+' FAIL');process.exit(fail?1:0);

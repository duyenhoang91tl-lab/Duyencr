// Test duyet mau tin tren Pancake AI: background (dang nhap admin/token/duyet) + content script (nut noi, thong bao, hop thoai). Chay: node tools/test-pk-approver-ext.js
const fs=require('fs'),vm=require('vm'),path=require('path'),{JSDOM}=require('jsdom');
const ex=path.join(__dirname,'..','extension-pancake');
const bgSrc=fs.readFileSync(path.join(ex,'pancake-background.js'),'utf8'),apprSrc=fs.readFileSync(path.join(ex,'pancake-approver.js'),'utf8');
let ok=0,fail=0;const t=(n,v)=>{console.log((v?'OK  ':'FAIL')+' '+n);v?ok++:fail++;};
const fn=(src,n)=>{const i=src.indexOf('async function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}};
(async()=>{
// ===== BACKGROUND =====
const store={local:{},sync:{}},calls=[];let reply=null;
const area=o=>({get:async()=>JSON.parse(JSON.stringify(o)),set:async v=>Object.assign(o,v),remove:async k=>{[].concat(k).forEach(x=>delete o[x])}});
const ctx={chrome:{storage:{local:area(store.local),sync:area(store.sync)}},DEFAULT_SETTINGS:{gasUrl:'https://w.example/gas'},Date,JSON,Math,Number,String,Array,Object,encodeURIComponent,Error,
 fetch:async(u,o)=>{calls.push({u,o});const r=typeof reply==='function'?reply(u,o):reply;return{json:async()=>r}}};
vm.createContext(ctx);
const code=fs.readFileSync(path.join(ex,'pancake-background.js'),'utf8');
const consts='const APPROVER_KEY = "pkApprover";';
vm.runInContext(consts+'\n'+['_apprGet_','handleApproverLogin','handleApproverLogout','handleApproverStatus','handleTplPending','handleTplDecide'].map(n=>fn(bgSrc,n)).join('\n')+
 '\nasync function _postGas_(body){const r=await fetch("https://w.example/gas",{method:"POST",body:JSON.stringify(body)});const d=await r.json();if(d.error)throw new Error(d.error);return d;}\nthis.api={login:handleApproverLogin,logout:handleApproverLogout,status:handleApproverStatus,pending:handleTplPending,decide:handleTplDecide};',ctx);
const rej=async(p)=>{try{await p;return null}catch(e){return String(e.message)}};
t('dang nhap thieu thong tin -> bao loi, khong goi mang',/Nh/.test(await rej(ctx.api.login({username:'a',password:''})))&&calls.length===0);
reply={ok:false,error:'Sai tai khoan hoac mat khau.'};
t('sai mat khau: tra loi cua server, KHONG luu gi',/Sai tai khoan/.test(await rej(ctx.api.login({username:'duyenht',password:'x'})))&&!store.local.pkApprover);
reply={ok:true,token:'TOK.SIG',expiresInMs:7*864e5,user:{username:'lan',name:'Lan',role:'cs'}};
t('tai khoan khong phai admin -> tu choi, KHONG luu token',/kh.ng ph.i admin/.test(await rej(ctx.api.login({username:'lan',password:'p'})))&&!store.local.pkApprover);
reply={ok:true,token:'TOK.SIG',expiresInMs:7*864e5,user:{username:'duyenht',name:'Duyen HT',role:'admin'}};
const lr=await ctx.api.login({username:'duyenht',password:'matkhau'});
const sent=JSON.parse(calls[calls.length-1].o.body);
t('admin dang nhap: goi webLogin dung, luu token + han dung o storage.local',sent.action==='webLogin'&&sent.username==='duyenht'&&store.local.pkApprover.token==='TOK.SIG'&&store.local.pkApprover.expiresAt>Date.now()+6*864e5);
t('KHONG tra token ra ngoai (content script chi thay ten/han) va KHONG luu mat khau',!JSON.stringify(lr).includes('TOK')&&!JSON.stringify(store.local).includes('matkhau')&&lr.name==='Duyen HT');
t('status: da dang nhap, khong lo token',(await ctx.api.status()).loggedIn===true&&!JSON.stringify(await ctx.api.status()).includes('TOK'));
calls.length=0;reply={ok:true,count:2,items:[{id:'a',title:'A'},{id:'b',title:'B'}]};
let pr=await ctx.api.pending();
t('pending: goi tplPending kem token, tra danh sach',/action=tplPending&token=TOK\.SIG/.test(calls[0].u)&&pr.loggedIn&&pr.count===2&&pr.items.length===2);
reply={error:'Chi admin / quan ly moi xem duoc mau cho duyet.',code:'FORBIDDEN'};
pr=await ctx.api.pending();
t('pending bi tu choi (phien het han/mat quyen): xoa token, bao expired',pr.loggedIn===false&&pr.expired===true&&!store.local.pkApprover);
t('pending khi chua dang nhap: khong goi mang',(calls.length=0,(await ctx.api.pending()).loggedIn===false&&calls.length===0));
store.local.pkApprover={token:'T2',name:'D',expiresAt:Date.now()+1e6};reply={ok:true,id:'a',status:'approved'};
await ctx.api.decide({id:'a',decision:'approve'});let b=JSON.parse(calls[calls.length-1].o.body);
t('duyet: gui approveMessageTemplate + token + id',b.action==='approveMessageTemplate'&&b.id==='a'&&b.decision==='approve'&&b.token==='T2');
await ctx.api.decide({id:'b',decision:'reject',reason:'x'.repeat(500)});b=JSON.parse(calls[calls.length-1].o.body);
t('tu choi: gui ly do (cat 300 ky tu)',b.decision==='reject'&&b.reason.length===300);
t('quyet dinh la/thieu id -> loi, khong goi mang',(calls.length=0,/Thi/.test(await rej(ctx.api.decide({id:'a',decision:'delete'})))&&/Thi/.test(await rej(ctx.api.decide({decision:'approve'})))&&calls.length===0));
reply={error:'Chi admin / quan ly moi duoc duyet mau tin.',code:'FORBIDDEN'};
t('duyet bi FORBIDDEN: bao het phien + xoa token',/h.t h.n|kh.ng c.n quy/.test(await rej(ctx.api.decide({id:'a',decision:'approve'})))&&!store.local.pkApprover);
store.local.pkApprover={token:'T3',name:'D',expiresAt:Date.now()-1};
t('token da het han: coi nhu chua dang nhap va don dep',(await ctx.api.status()).loggedIn===false&&!store.local.pkApprover);
store.local.pkApprover={token:'T4',expiresAt:Date.now()+1e6};await ctx.api.logout();t('dang xuat: xoa token',!store.local.pkApprover);

// ===== CONTENT SCRIPT (jsdom) =====
const dom=new JSDOM('<body></body>',{runScripts:'outside-only',url:'https://pancake.vn/',pretendToBeVisual:true});const w=dom.window;
const msgs=[],plan={pending:null,decide:{ok:true,data:{ok:true}}},localSt={};
w.chrome={runtime:{lastError:null,sendMessage:(m,cb)=>{msgs.push(m);const r=m.type==='TPL_PENDING'?plan.pending:m.type==='TPL_DECIDE'?plan.decide:null;setTimeout(()=>cb(r),0)}},
 storage:{local:{get:async()=>JSON.parse(JSON.stringify(localSt)),set:v=>Object.assign(localSt,v)},onChanged:{addListener(){}}}};
w.eval(apprSrc);const A=w.__pkAppr,q=s=>w.document.querySelector(s),qa=s=>Array.from(w.document.querySelectorAll(s)),wait=ms=>new Promise(r=>setTimeout(r,ms));
const items=[{id:'m1',title:'Mau vong tay',content:'Noi dung <b>1</b>',createdBy:'Lan',createdAt:new Date().toISOString(),product:'Vong tay'},{id:'m2',title:'Mau B',content:'B',createdBy:'Hoa'}];
plan.pending={ok:true,data:{loggedIn:false}};await A.tick(true);
t('chua dang nhap: khong co nut noi',!q('.pk-appr-pill')||q('.pk-appr-pill').style.display==='none');
plan.pending={ok:true,data:{loggedIn:true,name:'D',count:2,items}};await A.tick(true);
t('dang nhap + co mau: hien nut "2 mau tin cho duyet"',q('.pk-appr-pill').style.display!=='none'&&/2 m/.test(q('.pk-appr-pill').textContent));
t('mau MOI -> thong bao gop "2 mau tin moi cho duyet"',q('.pk-appr-toast')&&q('.pk-appr-toast').style.display!=='none'&&/2 m/.test(q('.pk-appr-toast').textContent));
A.tick;q('.pk-appr-toast').style.display='none';await A.tick(true);
t('poll lai cung danh sach: KHONG bao lai (da thay)',q('.pk-appr-toast').style.display==='none'&&Array.isArray(localSt.pkApprSeen)&&localSt.pkApprSeen.length===2);
q('.pk-appr-pill').click();await wait(10);
t('bam nut: mo hop thoai co 2 the, noi dung duoc escape (khong chen HTML)',qa('.pk-appr-card').length===2&&q('.pk-appr-content').innerHTML.includes('&lt;b&gt;')&&!q('.pk-appr-content b'));
// duyet the dau
q('.pk-appr-card[data-id="m1"] .pk-appr-ok').click();await wait(20);
const dm=msgs.filter(m=>m.type==='TPL_DECIDE').pop();
t('bam Duyet: gui TPL_DECIDE approve dung id, the bien mat, nut cap nhat 1',dm.payload.id==='m1'&&dm.payload.decision==='approve'&&qa('.pk-appr-card').length===1&&/1 m/.test(q('.pk-appr-pill').textContent));
// tu choi: lan 1 hien o ly do, chua gui
const before=msgs.filter(m=>m.type==='TPL_DECIDE').length;
q('.pk-appr-card[data-id="m2"] .pk-appr-no').click();await wait(10);
t('bam Tu choi lan 1: hien o nhap ly do, CHUA gui',msgs.filter(m=>m.type==='TPL_DECIDE').length===before&&q('.pk-appr-reason').style.display!=='none');
q('.pk-appr-reason input').value='Sai thong tin';q('.pk-appr-card[data-id="m2"] .pk-appr-no').click();await wait(20);
const rm=msgs.filter(m=>m.type==='TPL_DECIDE').pop();
t('Tu choi lan 2: gui reject + ly do; het mau -> an nut noi, hop thoai bao het',rm.payload.decision==='reject'&&rm.payload.reason==='Sai thong tin'&&q('.pk-appr-pill').style.display==='none'&&/Kh.ng c.n m.u/.test(q('.pk-appr-list').textContent));
// loi khi duyet: the van con, hien loi, nut bam lai duoc
plan.pending={ok:true,data:{loggedIn:true,name:'D',count:1,items:[items[0]]}};await A.tick(true);
plan.decide={ok:false,error:'Phien dang nhap het han.'};
q('.pk-appr-card[data-id="m1"] .pk-appr-ok').click();await wait(20);
t('loi khi duyet: the van con, hien loi, nut bam lai duoc',qa('.pk-appr-card').length===1&&/Phien dang nhap het han/.test(q('.pk-appr-err').textContent)&&q('.pk-appr-err').style.display!=='none'&&!q('.pk-appr-ok').disabled);
// dang xuat / het phien -> nut bien mat
plan.pending={ok:true,data:{loggedIn:false,expired:true}};await A.tick(true);
t('het phien/dang xuat: nut noi bien mat, danh sach rong',q('.pk-appr-pill').style.display==='none'&&A.state().items.length===0);
// khong poll khi tab an
const n0=msgs.length;Object.defineProperty(w.document,'hidden',{value:true,configurable:true});await A.tick(false);
t('tab dang an: khong goi background (tiet kiem luot goi)',msgs.length===n0);
// extension vua reload -> khong nem loi
w.chrome.runtime.sendMessage=()=>{throw new Error('Extension context invalidated.')};Object.defineProperty(w.document,'hidden',{value:false,configurable:true});
let thrown=false;try{await A.tick(true)}catch(e){thrown=true}
t('extension vua cap nhat/reload: im lang, khong nem loi ra trang Pancake',!thrown);
w.close();
console.log(fail?('FAILED '+fail):'ALL PK APPROVER EXT TESTS PASSED');process.exit(fail?1:0);
})();

const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(require('path').join(__dirname,'..','gas_v13.js'),'utf8');
const sec=src.slice(src.indexOf('var PK_CHAT_SECTION_'));
const np=src.slice(src.indexOf('function normPhone_'),src.indexOf('// SDT di dong Viet Nam HOP LE'));
const calls=[],props={},users={u1:{username:'u1',role:'cs'},d1:{username:'d1',role:'demo'}};
let sbReply=()=>({json:[]}), fetchReply=()=>({code:200,body:'{"success":true,"id":"m_1"}'});
const ctx={jsonOut_:o=>o,Logger:{log(){}},
 _sessUser_:t=>users[t]||null,
 sb_:(m,p,b,h)=>{calls.push({m,p,b,h});return sbReply(m,p,b)},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null})},
 UrlFetchApp:{fetch:(u,o)=>{calls.push({fetch:u,o});const r=fetchReply();return{getResponseCode:()=>r.code,getContentText:()=>r.body}}},
 encodeURIComponent,Date,JSON,RegExp,Array,String,Object,Number};
vm.createContext(ctx);vm.runInContext(np+sec,ctx);
const t=(n,v)=>console.log((v?'OK  ':'FAIL'),n);
(async()=>{
 t('khong token -> AUTH',ctx.pkChat_({parameter:{phone:'0900000001'}}).code==='AUTH');
 t('demo bi chan',/Tai khoan test/.test(ctx.pkChat_({parameter:{token:'d1',phone:'0900000001'}}).error));
 t('SDT sai',/khong hop le/.test(ctx.pkChat_({parameter:{token:'u1',phone:'12'}}).error));
 // pkChat: 2 hoi thoai, tin tra ve desc -> out asc
 sbReply=(m,p)=>p.startsWith('pk_conversations')?{json:[{id:'P1_U1',page_id:'P1',customer_name:'An',customer_phone:'0900000001',last_message_at:'2026-10-12T01:00:00Z',last_text:'xin chao',seen:true,is_replied:false,conv_type:'INBOX'}]}
   :{json:[{id:'m2',conversation_id:'P1_U1',direction:'out',text:'da vang',sent_at:'2026-10-12T01:00:00Z',sender_name:'Page',attachments:null},{id:'m1',conversation_id:'P1_U1',direction:'in',text:'xin chao',sent_at:'2026-10-12T00:59:00Z',sender_name:'An',attachments:[{type:'photo',url:'https://x/y.jpg'},{url:'javascript:alert(1)'}]}]};
 calls.length=0;let r=ctx.pkChat_({parameter:{token:'u1',phone:'+84 900 000 001',after:''}});
 t('pkChat: SDT chuan hoa 0900000001 trong truy van',calls[0].p.includes('customer_phone=eq.0900000001'));
 t('pkChat: tin xep cu->moi',r.messages.map(m=>m.id).join()==='m1,m2' && r.messages[0].dir==='in' && r.messages[1].dir==='out');
 t('pkChat: chi giu url http(s) cua dinh kem',r.messages[0].att.length===1 && r.messages[0].att[0].url==='https://x/y.jpg');
 t('pkChat: in.() dung ngoac kep + ma hoa',calls[1].p.includes(encodeURIComponent('in.("P1_U1")')));
 calls.length=0;ctx.pkChat_({parameter:{token:'u1',phone:'0900000001',after:'2026-10-12T00:59:30Z'}});
 t('pkChat after -> sent_at=gt',calls[1].p.includes('sent_at=gt.2026-10-12T00%3A59%3A30Z')&&calls[1].p.includes('limit=100'));
 calls.length=0;ctx.pkChat_({parameter:{token:'u1',phone:'0900000001',after:"x'; drop"}});
 t('pkChat after khong hop le bi bo',!calls[1].p.includes('sent_at=gt'));
 // Find
 calls.length=0;sbReply=()=>({json:[]});ctx.pkChatFind_({parameter:{token:'u1',q:'Nguyen (Van) *A,'}});
 t('Find ten: bo ky tu dac biet',calls[0].p.includes('customer_name=ilike.')&&!/[(),]|%2C|%28/.test(calls[0].p.split('customer_name=ilike.')[1].split('&')[0]));
 calls.length=0;ctx.pkChatFind_({parameter:{token:'u1',q:'0912345678'}});
 t('Find SDT -> customer_phone like',calls[0].p.includes('customer_phone=like.'));
 t('Find qua ngan',/it nhat 2/.test(ctx.pkChatFind_({parameter:{token:'u1',q:'a'}}).error));
 // Link
 t('Link SDT sai',/khong hop le/.test(ctx.pkChatLink_({token:'u1',convId:'C',phone:'123'}).error));
 sbReply=()=>({json:[{id:'C',customer_phone:'0912345678'}]});calls.length=0;r=ctx.pkChatLink_({token:'u1',convId:'C',phone:'84912345678'});
 t('Link thanh cong + chuan hoa',r.ok&&calls[0].m==='PATCH'&&calls[0].b.customer_phone==='0912345678'&&calls[0].h.Prefer==='return=representation');
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
})();

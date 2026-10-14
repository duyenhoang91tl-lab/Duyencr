// Test GAS v13.47: Thảo luận khách (khDiscuss / khDiscussSend / khDiscussDelete) — chạy hàm THẬT trong gas_v13.js với sheet/cache/lock giả.
const fs=require('fs'),vm=require('vm');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const src=fs.readFileSync('gas_v13.js','utf8');
function fn(name){const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('thiếu '+name);let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1)}}}
const consts=src.slice(src.indexOf("var SH_KHD_ ="),src.indexOf("function _khdPhone_("));
const code=consts+src.match(/var KHD_FORBIDDEN_MSG_ = '[^']*';/)[0]+'\n'+['_khdAssignees_','_khdLeaderCovers_','_khdManagerCovers_','_khdUserAllowed_','_khdAccess_','_userDeptKeys_','_profNames_','_normTxt_','normPhone_','_khdPhone_','_khdSheet_','_khdMsg_','khdList_','khdSend_','khdDelete_','khdDoGet_','khdDoPost_','_chatSafeCell_','_chatNum_'].map(fn).join('\n');
function mk(){
 const rows=[KHD()];function KHD(){return ['id','phone','author','authorUser','text','mentions','ts','deleted']}
 const sh={getLastRow:()=>rows.length,getMaxRows:()=>1000,appendRow:r=>rows.push(r.slice()),getRange:(r,c,nr,nc)=>({getValues:()=>rows.slice(r-1,r-1+nr).map(x=>x.slice(c-1,c-1+nc)),setValue:v=>{rows[r-1][c-1]=v},setNumberFormat:()=>{}})};
 const U={ha:{username:'ha',name:'Hà',role:'cs',names:['Hà']},lan:{username:'lan',name:'Lan',role:'cs',names:['Lan']},boss:{username:'boss',name:'Sếp',role:'admin'},ceo:{username:'ceo',name:'Giám đốc',role:'ceo'},
  ld1:{username:'ld1',name:'Trưởng Một',role:'leader',team:'T1'},ld2:{username:'ld2',name:'Trưởng Hai',role:'leader',team:'T2'},mg1:{username:'mg1',name:'QL A',role:'manager',team:'PhongA'},mg2:{username:'mg2',name:'QL B',role:'manager',team:'PhongB'}};
 const sessions={tA:U.ha,tB:U.lan,tAd:U.boss,tCeo:U.ceo,tL1:U.ld1,tL2:U.ld2,tM1:U.mg1,tM2:U.mg2};
 const BASE={admin:'admin',ceo:'viewer',leader:'leader',manager:'manager',cs:'cs'};
 const CONV={'0934230669':[{page_id:'p',assignee_ids:['s1','s2']}],'0999888777':[{page_id:'p',assignee_ids:['s2']}],'0911111111':[{page_id:'p',assignee_ids:['s1']}],'0922222222':[{page_id:'p',assignee_ids:[]}],'0933333333':[]};
 const cacheStore={},notifs=[],sbCalls=[];const world={sbFail:false};
 const ctx={getCrmSS_:()=>({getSheetByName:n=>n==='KhThaoLuan'?sh:null}),getSheet_:()=>sh,jsonOut_:x=>x,SH_TEAM:'Teams',SH_USER:'Users',
  _chatUser_:t=>sessions[t]?{ok:true,u:Object.assign({team:''},sessions[t])}:{ok:false,code:'AUTH',error:'Can dang nhap'},
  _taskMentionNames_:(t)=>(String(t).match(/@(\w+)/g)||[]).map(x=>x.slice(1)),
  _notifyMentions_:o=>{notifs.push(o);return 1},
  readUsers_:()=>Object.keys(U).map(k=>U[k]),
  _notifParseMentions_:(t)=>(String(t).match(/@(\w+)/g)||[]).map(x=>x.slice(1)).filter(n=>U[n]),
  _roleBase_:r=>BASE[r]||'cs',
  _profFold_:names=>{const f={};(names||[]).forEach(n=>{f[String(n).trim().toLowerCase()]=true});return f},
  readSaleDepts_:()=>({byNorm:{'hà':{name:'Hà',key:'PhongA'},'lan':{name:'Lan',key:'PhongB'}}}),
  readTeams_:()=>[{name:'T1',leader:'Trưởng Một',members:['Hà']},{name:'T2',leader:'Trưởng Hai',members:['Lan']}],
  _pkEnc_:encodeURIComponent,_pkStaffNames_:()=>({s1:'Hà',s2:'Lan'}),_pkUserMap_:()=>({}),
  sb_:(m,q)=>{sbCalls.push(q);if(world.sbFail)throw new Error('supabase down');const ph=/customer_phone=eq\.(\d+)/.exec(q)[1];return {json:CONV[ph]||[]}},
  CacheService:{getScriptCache:()=>({get:k=>cacheStore[k]||null,put:(k,v)=>{cacheStore[k]=v},remove:k=>delete cacheStore[k]})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Date,Math,JSON,String,Number,Object,Array,RegExp,parseInt,encodeURIComponent};
 vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,rows,notifs,cache:cacheStore,world,sbCalls};}
const clear=(m)=>{Object.keys(m.cache).forEach(k=>delete m.cache[k])};
let m=mk(),c=m.ctx;
ok(c._khdPhone_('+84 934 230 669')==='0934230669'&&c._khdPhone_('934230669')==='0934230669'&&c._khdPhone_('0934230669')==='0934230669'&&c._khdPhone_('12')===''&&c._khdPhone_('')==='','chuẩn hoá SĐT: +84 / thiếu 0 / sai → rỗng');
ok(c.khdList_({token:'zz',phone:'0934230669'}).ok===false&&c.khdSend_({token:'zz',phone:'0934230669',text:'x'}).ok===false&&c.khdDelete_({token:'zz',id:'a'}).ok===false,'chưa đăng nhập / token sai → từ chối cả 3 action');
ok(c.khdList_({token:'tA',phone:'abc'}).error.includes('SDT'),'SĐT sai → báo lỗi');
// gửi
let r=c.khdSend_({token:'tA',phone:'+84 934 230 669',text:'Khách này hỏi combo @lan xem giúp',author:'GIẢ MẠO',authorUser:'admin'});
ok(r.ok&&r.message.author==='Hà'&&r.message.authorUser==='ha','người gửi lấy từ PHIÊN, bỏ qua author/authorUser client gửi (chống giả mạo)');
ok(m.rows[1][1]==='0934230669'&&m.rows[1][3]==='ha'&&m.rows[1][7]==='','lưu SĐT đã chuẩn hoá vào đúng cột');
ok(JSON.stringify(r.message.mentions)==='["lan"]'&&m.notifs.length===1&&m.notifs[0].kind==='khthread'&&m.notifs[0].refType==='customer'&&m.notifs[0].refId==='0934230669'&&m.notifs[0].fromUser==='ha','@tag → tạo thông báo kind=khthread, refType=customer, refId=SĐT chuẩn');
clear(m);m.notifs.length=0;
r=c.khdSend_({token:'tA',phone:'0934230669',text:'=HYPERLINK("http://x")'});ok(r.ok&&m.rows[2][4].startsWith("'="),'chống chèn công thức Sheet (=…)');
clear(m);ok(c.khdSend_({token:'tA',phone:'0934230669',text:'   '}).ok===false,'tin trống bị từ chối');
ok(c.khdSend_({token:'tA',phone:'0934230669',text:'x'.repeat(1501)}).error.includes('qua dai')&&c.khdSend_({token:'tA',phone:'0934230669',text:'x'.repeat(1500)}).ok,'giới hạn 1500 ký tự (1500 được, 1501 không)');
ok(c.khdSend_({token:'tA',phone:'0934230669',text:'nhanh quá'}).error.includes('nhanh'),'gửi dồn dập → bị giới hạn tốc độ');
clear(m);
// đọc
c.khdSend_({token:'tB',phone:'0999888777',text:'khách khác'});clear(m);c.khdSend_({token:'tB',phone:'0934230669',text:'trả lời Hà'});
let l=c.khdList_({token:'tA',phone:'0934230669'});
ok(l.ok&&l.me==='ha'&&l.messages.length===4&&l.messages.every(x=>x.id)&&!l.messages.some(x=>x.text==='khách khác'),'đọc: chỉ tin của ĐÚNG khách (không lẫn khách khác), có me');
ok(l.messages[0].text.startsWith('Khách này hỏi combo')&&l.messages[3].text==='trả lời Hà','đọc: thứ tự cũ → mới');
ok(c.khdList_({token:'tA',phone:'0934230669',after:l.messages[2].ts}).messages.length<=1,'đọc: after=mốc → chỉ tin mới hơn (cho poll nhẹ)');
// xoá
const mid=l.messages.find(x=>x.text==='trả lời Hà').id;
ok(c.khdDelete_({token:'tA',id:mid}).ok===false,'CS không xoá được tin của người khác (chốt chặn ở server)');
ok(c.khdDelete_({token:'tB',id:mid}).ok===true&&!c.khdList_({token:'tA',phone:'0934230669'}).messages.some(x=>x.id===mid),'xoá tin của chính mình → biến khỏi danh sách');
const mid2=l.messages[0].id;ok(c.khdDelete_({token:'tAd',id:mid2}).ok===true,'Admin xoá được tin của người khác');
ok(c.khdDelete_({token:'tB',id:'khong_co'}).ok===false&&c.khdDelete_({token:'tB',id:''}).ok===false,'id lạ/rỗng → báo lỗi, không ném');
// giới hạn 150
const big=mk();for(let i=0;i<200;i++)big.rows.push(['k'+i,'0934230669','Hà','ha','t'+i,'[]',new Date(Date.now()+i*1000).toISOString(),'']);
const bl=big.ctx.khdList_({token:'tA',phone:'0934230669'}).messages;ok(bl.length===150&&bl[149].text==='t199'&&bl[0].text==='t50','đọc: tối đa 150 tin MỚI NHẤT');
// ── QUYỀN XEM: chỉ người đang nhận trên Pancake + người được phân quyền ──
const A=mk(),ac=A.ctx,ses={ha:'tA',lan:'tB',admin:'tAd',ceo:'tCeo',ld1:'tL1',ld2:'tL2',mg1:'tM1',mg2:'tM2'};
const can=(who,phone)=>{const r=ac.khdList_({token:ses[who],phone});return r.ok};
const clr=()=>{Object.keys(A.cache).forEach(k=>delete A.cache[k])};
ok(can('ha','0911111111')&&!can('lan','0911111111'),'0911111111 do Hà nhận: Hà đọc được, Lan (nhân viên không nhận) KHÔNG');
let fr=ac.khdList_({token:'tB',phone:'0911111111'});ok(fr.code==='FORBIDDEN'&&fr.error.includes('Pancake')&&fr.error.includes('phan quyen'),'bị chặn: trả code FORBIDDEN + lý do (người nhận Pancake / được phân quyền)');
ok(ac.khdSend_({token:'tB',phone:'0911111111',text:'chen ngang'}).code==='FORBIDDEN'&&A.rows.length===1,'GỬI cũng bị chặn: không ghi dòng nào vào sheet');
ok(can('lan','0934230669')&&can('ha','0934230669'),'hội thoại có 2 người nhận (Hà + Lan): cả hai đều đọc được');
ok(can('admin','0911111111')&&can('ceo','0911111111'),'Admin + CEO (vai trò xem toàn công ty) đọc được mọi khách');
ok(can('ld1','0911111111')&&!can('ld2','0911111111'),'Trưởng team: xem khi người nhận thuộc team mình (T1 có Hà), team khác (T2) KHÔNG');
ok(can('mg1','0911111111')&&!can('mg2','0911111111'),'Quản lý: xem khi người nhận thuộc phòng mình phụ trách (PhongA có Hà), phòng khác KHÔNG');
ok(can('mg1','0934230669')&&can('mg2','0934230669')&&can('ld2','0934230669'),'khách có người nhận ở nhiều phòng/team: quản lý/trưởng team của từng bên đều đọc được');
ok(!can('ha','0922222222')&&!can('ha','0933333333')&&!can('mg1','0922222222')&&!can('ld1','0933333333'),'chưa ai nhận / không có hội thoại Pancake: nhân viên, quản lý, trưởng team đều KHÔNG');
ok(can('admin','0922222222')&&can('ceo','0933333333'),'…chỉ Admin + CEO xem được những khách đó');
// cache + lỗi Supabase
clr();A.sbCalls.length=0;ac.khdList_({token:'tA',phone:'0911111111'});ac.khdList_({token:'tA',phone:'0911111111'});ok(A.sbCalls.length===1,'người nhận được cache 60s: 2 lần đọc chỉ hỏi Pancake 1 lần');
clr();A.world.sbFail=true;fr=ac.khdList_({token:'tA',phone:'0911111111'});ok(fr.ok===false&&fr.code==='PKDOWN'&&fr.error.includes('thu lai'),'Pancake/Supabase lỗi: nhân viên bị từ chối nhẹ nhàng (PKDOWN), không ném lỗi');
ok(can('admin','0911111111')&&can('ceo','0911111111'),'…Admin/CEO không cần gọi Pancake nên vẫn dùng được khi Pancake lỗi');
A.world.sbFail=false;clr();
// @tag chỉ báo cho người có quyền
A.notifs.length=0;clr();let sr=ac.khdSend_({token:'tA',phone:'0911111111',text:'nhờ @lan @boss @ceo @ld1 @ld2 xem'});
const only=A.notifs[0].onlyUsers;
ok(sr.ok&&only.boss===1&&only.ceo===1&&only.ld1===1&&!only.lan&&!only.ld2,'@tag: chỉ báo cho người CÓ quyền (boss, ceo, ld1); lan và ld2 KHÔNG có quyền → không thông báo');
ok(sr.skipped.indexOf('Lan')>=0&&sr.skipped.indexOf('Trưởng Hai')>=0&&sr.skipped.length===2,'trả về danh sách người tag nhưng không có quyền (để người gửi biết): Lan, Trưởng Hai');
// xoá tin của mình vẫn được dù mất quyền xem sau đó
const mine=A.rows.filter(r=>r[3]==='ha').pop()[0];ok(ac.khdDelete_({token:'tA',id:mine}).ok===true,'xoá tin của chính mình vẫn được');
// router + tách file
ok(/KHD_GET_ACTIONS_\[action\] === 1\) return khdDoGet_\(p\)/.test(src)&&/KHD_POST_ACTIONS_\[action\] === 1\) return khdDoPost_\(action, data\)/.test(src),'doGet/doPost có route khDiscuss*');
ok(fs.existsSync('gas/30_KhDiscuss.gs')&&fs.readFileSync('gas/30_KhDiscuss.gs','utf8').includes('function khdSend_('),'gas/30_KhDiscuss.gs đã sinh');
ok(/ver: 'v13\.\d+-[a-z-]+'/.test(src),'action=count trả ver v13.xx-tên (để đối chiếu bản đang chạy)');
process.exit(bad?1:0);

// Test GAS v13.41: Thảo luận khách (khDiscuss / khDiscussSend / khDiscussDelete) — chạy hàm THẬT trong gas_v13.js với sheet/cache/lock giả.
const fs=require('fs'),vm=require('vm');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const src=fs.readFileSync('gas_v13.js','utf8');
function fn(name){const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('thiếu '+name);let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1)}}}
const consts=src.slice(src.indexOf("var SH_KHD_ ="),src.indexOf("function _khdPhone_("));
const code=consts+['_khdPhone_','_khdSheet_','_khdMsg_','khdList_','khdSend_','khdDelete_','khdDoGet_','khdDoPost_','_chatSafeCell_','_chatNum_'].map(fn).join('\n');
function mk(){
 const rows=[KHD()];function KHD(){return ['id','phone','author','authorUser','text','mentions','ts','deleted']}
 const sh={getLastRow:()=>rows.length,getMaxRows:()=>1000,appendRow:r=>rows.push(r.slice()),getRange:(r,c,nr,nc)=>({getValues:()=>rows.slice(r-1,r-1+nr).map(x=>x.slice(c-1,c-1+nc)),setValue:v=>{rows[r-1][c-1]=v},setNumberFormat:()=>{}})};
 const sessions={tA:{username:'ha',name:'Hà',role:'cs'},tB:{username:'lan',name:'Lan',role:'cs'},tAd:{username:'boss',name:'Sếp',role:'admin'}};
 const cacheStore={},notifs=[];
 const ctx={getCrmSS_:()=>({getSheetByName:n=>n==='KhThaoLuan'?sh:null}),getSheet_:()=>sh,jsonOut_:x=>x,
  _chatUser_:t=>sessions[t]?{ok:true,u:Object.assign({team:''},sessions[t])}:{ok:false,code:'AUTH',error:'Can dang nhap'},
  _taskMentionNames_:(t)=>(String(t).match(/@(\w+)/g)||[]).map(x=>x.slice(1)),
  _notifyMentions_:o=>{notifs.push(o);return 1},
  CacheService:{getScriptCache:()=>({get:k=>cacheStore[k]||null,put:(k,v)=>{cacheStore[k]=v},remove:k=>delete cacheStore[k]})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Date,Math,JSON,String,Number};
 vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,rows,notifs,cache:cacheStore};}
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
// router + tách file
ok(/KHD_GET_ACTIONS_\[action\] === 1\) return khdDoGet_\(p\)/.test(src)&&/KHD_POST_ACTIONS_\[action\] === 1\) return khdDoPost_\(action, data\)/.test(src),'doGet/doPost có route khDiscuss*');
ok(fs.existsSync('gas/30_KhDiscuss.gs')&&fs.readFileSync('gas/30_KhDiscuss.gs','utf8').includes('function khdSend_('),'gas/30_KhDiscuss.gs đã sinh');
ok(/ver: 'v13\.43-kh-discuss'/.test(src),'ver = v13.43-kh-discuss (action=count)');
process.exit(bad?1:0);

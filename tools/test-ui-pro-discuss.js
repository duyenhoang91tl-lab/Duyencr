// Test: ô Thảo luận khách (js/49) trong hồ sơ khách + Social > Chat (js/48) và ô ghi chú nhanh P5b. Code thật bằng jsdom. Chạy: node tools/test-ui-pro-discuss.js (cần jsdom)
const {JSDOM}=require('jsdom');const fs=require('fs'),path=require('path');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('OK  ',t)};
const R=f=>path.join(__dirname,'..',f),src=f=>fs.readFileSync(R('js/'+f),'utf8');
function fn(code,name){const i=code.indexOf('function '+name+'(');if(i<0)throw new Error('thiếu '+name);let d=0,j=code.indexOf('{',i);for(let k=j;k<code.length;k++){if(code[k]=='{')d++;else if(code[k]=='}'){d--;if(!d)return code.slice(i,k+1)}}}
const dom=new JSDOM('<!doctype html><html class="ui-pro"><body><div id="dp-overlay"></div><div id="tab-chat" style="display:block"><div id="chat-wrap"></div></div></body></html>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://x.test/'});
const w=dom.window,reqs=[];const iso=n=>new Date(Date.now()-n*60000).toISOString();
let SERVER=[{id:'k1',author:'Lan',authorUser:'lan',text:'Khách này hỏi combo, @Hà xem giúp',mentions:['Hà'],ts:iso(5)},{id:'k2',author:'Hà',authorUser:'ha',text:'Ok mình gọi chiều nay <b>x</b>',mentions:[],ts:iso(3)}];
w.localStorage.setItem('ome_sess_token','TOK');
w.eval('var gsUrl="https://gs.example/exec"; var currentUser={name:"Hà",role:"cs"}; var _activeV9Tab="chat"; var currentPhone=""; var _posStatsOn=false; var donStatsByPhone={}; var schedules=[]; var SCHED_TYPES=[]; var CARE_STATUS_TREE=[{label:"Chốt",value:"Chốt"}]; function _custRev_(){return 0;} function _ymd(d){return d.toISOString().slice(0,10);} var careData={"0934230669":{status:"Chốt",note:""}}; var _synced=[],_saved=[],_touched=[],_mentions=[]; function queueCareSync(p){_synced.push(p)} function saveLS(k,v){_saved.push(k)} function _touchCare(p){_touched.push(p)} function ntNoteMention(p,t){_mentions.push([p,t])}');
const s03=src('03-fn-refreshopendptab.js');w.eval(['_parseNotes','_notesToStr','_fmtNoteTime'].map(n=>fn(s03,n)).join('\n'));
w.allCustomers=[{phone:'0934230669',name:'Mến Hoàng',tier:'Vàng',orders:[]}];
const toasts=[];w.toast=m=>toasts.push(m);w.confirm=()=>true;w.openDp=()=>{};
let sendFail=false;
w.fetch=async(u,o)=>{const body=o&&o.body?JSON.parse(o.body):null;reqs.push({u,body,method:o&&o.method||'GET'});let r={};
 if(u.includes('pkChatInbox'))r={conversations:[{id:'C1',name:'Mến Hoàng',phone:'+84 934 230 669',lastText:'x',lastAt:iso(1),seen:true,type:'INBOX'},{id:'C2',name:'Không SĐT',phone:'',lastText:'y',lastAt:iso(2),seen:true,type:'INBOX'}]};
 else if(u.includes('pkChatConv'))r={messages:[]};
 else if(u.includes('action=khDiscuss&')){const m=/after=([^&]*)/.exec(u);const after=m?decodeURIComponent(m[1]):'';r={ok:true,phone:'0934230669',me:'ha',messages:SERVER.filter(x=>!after||x.ts>after),now:iso(0)}}
 else if(body&&body.action==='khDiscussSend'){r=sendFail?{ok:false,error:'Gui qua nhanh'}:(()=>{const mm={id:'k'+(SERVER.length+1),author:'Hà',authorUser:'ha',text:body.text,mentions:[],ts:iso(0)};SERVER.push(mm);return {ok:true,message:mm}})()}
 else if(body&&body.action==='khDiscussDelete'){SERVER=SERVER.filter(x=>x.id!==body.id);r={ok:true,id:body.id}}
 return {json:async()=>r}};
for(const f of ['33-pro-profile.js','41-fn-pkchat.js','42-fn-socialchat.js','48-pro-chatinfo.js','49-pro-discuss.js'])w.eval(src(f));
const $=id=>w.document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
// — hàm thuần —
ok(w.khdTextHtml_('Chào @Hà <img src=x onerror=1>',['Hà'])==='Chào <span class="khd-at">@Hà</span> &lt;img src=x onerror=1&gt;','tô @tên (chỉ tên server xác nhận) + chống chèn HTML');
ok(w.khdTextHtml_('a @Lan Anh b',['Lan','Lan Anh']).includes('<span class="khd-at">@Lan Anh</span>'),'tên dài ưu tiên trước tên ngắn');
ok(w.khdTextHtml_('x.y (z) @a+b',['a+b']).includes('<span class="khd-at">@a+b</span>'),'tên có ký tự đặc biệt regex không làm hỏng');
const mg=w.khdMergeMsgs_([{id:'a',ts:'2026-01-02'}],[{id:'a',ts:'2026-01-02'},{id:'b',ts:'2026-01-01'}]);ok(mg.length===2&&mg[0].id==='b','gộp tin: bỏ trùng id, cũ → mới');
ok(/^\d\d:\d\d \d\d\/\d\d$/.test(w.khdFmtTime_(new Date().toISOString()))&&w.khdFmtTime_('xx')==='','định dạng giờ HH:MM dd/mm');
(async()=>{
 // — tab trong hồ sơ khách —
 const host=w.document.createElement('div');host.id='dp-body';w.document.body.appendChild(host);
 host.innerHTML=w.renderKhdTab({phone:'0934230669'});await sleep(30);
 ok(!!$('khd-dp')&&$('khd-input')&&host.textContent.includes('Thảo luận nội bộ'),'tab Thảo luận: có hộp + ô nhập (id khd-input cho gợi ý @)');
 const g=reqs.find(x=>x.u.includes('action=khDiscuss&'));ok(g&&g.u.includes('token=TOK')&&g.u.includes('phone=0934230669')&&!g.u.includes('after=0'),'tải lần đầu: GET khDiscuss kèm token + phone');
 const ms=[...$('khd-dp').querySelectorAll('.khd-m')];
 ok(ms.length===2&&ms[0].classList.contains('in')&&ms[1].classList.contains('out'),'tin người khác bên trái, tin của mình (ha) bên phải');
 ok(ms[0].querySelector('.khd-au').textContent==='Lan'&&ms[0].innerHTML.includes('khd-at')&&!ms[1].querySelector('.khd-au'),'hiện tên người gửi + tô @Hà; tin của mình không lặp tên');
 ok(ms[1].innerHTML.includes('&lt;b&gt;x&lt;/b&gt;')&&!ms[1].querySelector('b'),'nội dung tin bị escape (không render HTML)');
 ok(ms[1].querySelector('[data-khd-del]')&&!ms[0].querySelector('[data-khd-del]'),'CS chỉ thấy nút xoá ở tin của chính mình');
 // gửi
 $('khd-input').value='Em đã nhắn khách @Lan';$('khd-dp').querySelector('[data-khd-send]').click();await sleep(30);
 const p=reqs.filter(x=>x.body&&x.body.action==='khDiscussSend').pop();
 ok(p&&p.body.token==='TOK'&&p.body.phone==='0934230669'&&p.body.text==='Em đã nhắn khách @Lan','gửi: POST khDiscussSend kèm token/phone/text');
 ok($('khd-input').value===''&&$('khd-dp').querySelectorAll('.khd-m').length===3,'gửi xong: xoá ô nhập, tin hiện ngay');
 $('khd-input').value='gửi bằng Enter';$('khd-input').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await sleep(30);
 ok($('khd-dp').querySelectorAll('.khd-m').length===4,'Enter gửi tin');
 const n0=reqs.length;$('khd-input').value='xuống dòng';$('khd-input').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true,cancelable:true}));await sleep(10);
 ok(reqs.length===n0&&$('khd-input').value==='xuống dòng','Shift+Enter KHÔNG gửi (xuống dòng)');
 $('khd-input').value='   ';$('khd-dp').querySelector('[data-khd-send]').click();await sleep(10);ok(reqs.length===n0,'tin trống không gọi server');
 sendFail=true;$('khd-input').value='sẽ lỗi';$('khd-dp').querySelector('[data-khd-send]').click();await sleep(30);sendFail=false;
 ok($('khd-input').value==='sẽ lỗi'&&toasts.some(t=>t.includes('Gui qua nhanh')),'gửi lỗi: GIỮ nội dung đã gõ + báo lỗi');
 // xoá
 const del=$('khd-dp').querySelectorAll('[data-khd-del]')[0];const delId=del.getAttribute('data-khd-del');del.click();await sleep(30);
 ok(reqs.some(x=>x.body&&x.body.action==='khDiscussDelete'&&x.body.id===delId)&&![...$('khd-dp').querySelectorAll('[data-khd-del]')].some(a=>a.getAttribute('data-khd-del')===delId),'xoá: POST khDiscussDelete + tin biến mất');
 // poll nhẹ / đầy đủ
 const S=w.eval('_khd.dp');S.n=0;reqs.length=0;await w.khdPoll_('dp',false);ok(reqs[0].u.includes('after=')&&!/after=&|after=$/.test(reqs[0].u),'poll thường: gửi after=mốc cuối (nhẹ)');
 S.n=4;reqs.length=0;await w.khdPoll_('dp',false);ok(/after=(&|$)/.test(reqs[0].u),'poll thứ 5: tải lại đủ (after rỗng) để thấy tin bị xoá bởi người khác');
 // đóng tab → dừng poll
 host.innerHTML='';reqs.length=0;await w.khdPoll_('dp',false);ok(reqs.length===0&&!w.eval('_khd.dp'),'rời tab (hộp bị gỡ khỏi DOM) → dừng poll, không gọi mạng nữa');
 // chưa đăng nhập
 w.localStorage.removeItem('ome_sess_token');host.innerHTML=w.renderKhdTab({phone:'0934230669'});reqs.length=0;await sleep(30);
 ok(reqs.length===0&&host.textContent.includes('đăng nhập')&&$('khd-input').disabled,'chưa đăng nhập/tài khoản demo → báo rõ, khoá ô nhập, không gọi mạng');
 w.localStorage.setItem('ome_sess_token','TOK');host.innerHTML='';
 // — Social > Chat: cột phải có 2 tab —
 w.renderSocialChatTab();await sleep(60);w.scPick('C1');await sleep(30);
 const info=$('sc-info');ok(info.querySelectorAll('[data-sct]').length===2&&info.querySelector('[data-sct="info"]').classList.contains('on')&&$('sc-pane-discuss').style.display==='none','cột phải: 2 tab Thông tin | Thảo luận, mặc định Thông tin');
 reqs.length=0;info.querySelector('[data-sct="discuss"]').click();await sleep(40);
 ok($('sc-pane-info').style.display==='none'&&$('sc-pane-discuss').style.display!=='none'&&reqs.some(x=>x.u.includes('action=khDiscuss&')&&x.u.includes('phone=0934230669')),'bấm Thảo luận: ẩn Thông tin, tải thảo luận theo SĐT đã chuẩn hoá (+84 934… → 0934230669)');
 ok($('khd-input-sc')&&$('khd-sc').querySelectorAll('.khd-m').length>=2,'hộp thảo luận ở Social > Chat dùng ô nhập khd-input-sc');
 w.scPick('C2');await sleep(30);ok(info.querySelector('[data-sct="discuss"]').classList.contains('on')&&$('sc-pane-discuss').textContent.includes('chưa gắn SĐT'),'đổi sang hội thoại chưa gắn SĐT: giữ tab Thảo luận, báo rõ chưa có thảo luận');
 w.scPick('C1');await sleep(30);info.querySelector('[data-sct="info"]').click();ok(!w.eval('_khd.sc'),'quay lại tab Thông tin → dừng poll thảo luận');
 // — ghi chú nhanh P5b —
 const nb=$('sc-note-new');ok(!!nb&&nb.placeholder.includes('Enter để lưu'),'có ô "Nhập ghi chú (Enter để lưu, @ để tag)" ở đầu cột Thông tin');
 nb.value='Khách hẹn thứ 6 @Lan';nb.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await sleep(20);
 const care=w.eval('careData["0934230669"]'),notes=w.eval('_parseNotes(careData["0934230669"].note)');
 ok(notes.length===1&&notes[0].text==='Khách hẹn thứ 6 @Lan'&&notes[0].user==='Hà'&&/^\d\d:\d\d \d\d\/\d\d\/\d{4}$/.test(notes[0].time),'ghi chú nhanh: lưu đúng nội dung/người/giờ vào careData (không cần mở panel hồ sơ)');
 ok(care.status==='Chốt','không làm mất các trường chăm sóc khác (tình trạng vẫn "Chốt")');
 ok(w.eval('_synced').join()==='0934230669'&&w.eval('_saved').join()==='ome_care'&&w.eval('_touched').join()==='0934230669','đẩy đồng bộ GAS (queueCareSync) + lưu localStorage + đánh dấu cập nhật');
 ok(w.eval('_mentions').length===1&&w.eval('_mentions')[0][1].includes('@Lan'),'@tag trong ghi chú → ntNoteMention (thông báo)');
 ok(w.allCustomers[0].careNote===care.note&&$('sc-info').textContent.includes('Dòng thời gian (1)')&&$('sc-note-new').value==='','cột phải vẽ lại ngay: timeline có 1 mục, ô ghi chú trống');
 const before=w.eval('_synced.length');$('sc-note-new').value='  ';$('sc-note-new').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await sleep(10);ok(w.eval('_synced.length')===before,'ghi chú trống: không lưu');
 // — nối dây trong code —
 const idx=fs.readFileSync(R('index.html'),'utf8');ok(idx.includes('data-tab="chat" onclick="switchDpTab(\'chat\',this)">💬 Chat Pancake</div>')&&idx.includes('data-tab="discuss" onclick="switchDpTab(\'discuss\',this)">🗨 Thảo luận</div>')&&idx.includes('js/49-pro-discuss.js'),'index.html: tab "💬 Chat Pancake" + tab "🗨 Thảo luận" cạnh nhau + nạp js/49');
 ok((s03.match(/tab==='discuss' && typeof renderKhdTab === 'function'/g)||[]).length===2&&s03.includes("'chat','discuss'"),'js/03: renderDpTab + switchDpTab đều có nhánh discuss, thứ tự tab đủ 6');
 const s39=src('39-fn-notify.js');ok(/_NT_FIELDS = \{[^}]*'khd-input':1[^}]*'khd-input-sc':1[^}]*'sc-note-new':1/.test(s39),'gợi ý @ bật cho 3 ô mới (khd-input, khd-input-sc, sc-note-new)');
 const ntW=new w.Function(fn(s39,'_ntWhere')+';return _ntWhere')();ok(ntW({kind:'khthread',refId:'0934230669'}).includes('thảo luận về khách 0934230669')&&ntW({kind:'note',refId:'1'}).includes('ghi chú khách'),'thông báo kind khthread có nhãn riêng, kind cũ không đổi');
 ok(/it\.kind === 'khthread'[^\n]*switchDpTab\('discuss'/.test(s39),'bấm thông báo thảo luận → mở hồ sơ rồi chuyển thẳng sang tab Thảo luận');
 process.exit(bad?1:0);
})();

// Test P5: Social > Chat kiểu Pancake — cột "Thông tin khách" (js/48) gắn vào js/42, chạy code thật bằng jsdom. Chạy: node tools/test-ui-pro-chatinfo.js (cần: npm i jsdom)
const {JSDOM}=require('jsdom');const fs=require('fs'),path=require('path');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('OK  ',t)};
const src=f=>fs.readFileSync(path.join(__dirname,'..','js',f),'utf8');
const dom=new JSDOM('<!doctype html><html class="ui-pro"><body><div id="dp-overlay"></div><div id="tab-chat" style="display:block"><div id="chat-wrap"></div></div></body></html>',{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,log=[];
const iso=new Date().toISOString();
const CONVS=[{id:'C1',name:'Mến Hoàng',phone:'+84 934 230 669',lastText:'Ukie em',lastAt:iso,seen:false,type:'INBOX'},{id:'C2',name:'Khách lạ',phone:'',lastText:'hi',lastAt:iso,seen:true,type:'INBOX'},{id:'C3',name:'Chị Ba',phone:'0999888777',lastText:'ok',lastAt:iso,seen:true,type:'INBOX'}];
w.eval('var gsUrl="https://gs.example/exec"; var _activeV9Tab="chat"; var careData={"0934230669":{status:"Chốt",zalo:"Đã kết bạn",khStatus:"KH cũ",cs:"Hà",birthday:"1990-05-02",note:"[]",custom:{tag:"VIP"}}}; var currentPhone=""; var _posStatsOn=false; var donStatsByPhone={}; var schedules=[]; var SCHED_TYPES=[{key:"goi",label:"Hẹn gọi"}]; var CARE_STATUS_TREE=[{label:"Chốt",value:"Chốt"},{label:"Phân vân",value:"Phân vân"}]; function _custRev_(c){return 3000000;} function _ymd(d){return d.toISOString().slice(0,10);}');
w.allCustomers=[{phone:'0934230669',name:'Mến Hoàng',tier:'Vàng',orders:[{date:new w.Date(Date.now()-5*86400000),revenue:3000000,product:'Combo A'}]}];
w.fetch=async(u,o)=>{log.push({u,o});const r=u.includes('pkChatInbox')?{conversations:CONVS}:u.includes('pkChatConv')?{messages:[{id:'m1',c:'C1',dir:'in',text:'Xin giá',at:iso,att:[]},{id:'m2',c:'C1',dir:'out',text:'Dạ vâng',at:iso,att:[]}]}:{};return {json:async()=>r}};
const opened=[];w.openDp=p=>opened.push(p);w.toast=()=>{};
w.eval(src('33-pro-profile.js'));w.eval(src('41-fn-pkchat.js'));w.eval(src('42-fn-socialchat.js'));w.eval(src('48-pro-chatinfo.js'));
const $=id=>w.document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
// — hàm thuần —
ok(w.proPhoneNorm_('+84 934.230.669')==='0934230669'&&w.proPhoneNorm_('84934230669')==='0934230669'&&w.proPhoneNorm_('0934 230 669')==='0934230669'&&w.proPhoneNorm_('934230669')==='0934230669'&&w.proPhoneNorm_('')==='','chuẩn hoá SĐT: +84 / 84 / có cách / thiếu số 0 / rỗng');
ok(w.proInitials_('Mến Hoàng')==='MH'&&w.proInitials_('An')==='A'&&w.proInitials_('')==='?'&&w.proInitials_('Nguyễn Thị Lan')==='TL','chữ cái avatar');
(async()=>{
 w.renderSocialChatTab();await sleep(60);
 const kids=[...$('chat-wrap').children].map(x=>x.id||x.className);
 ok(kids.join()==='sc-list-first'.replace('sc-list-first',kids.join())&&kids.length===3&&kids[2]==='sc-info'&&$('chat-wrap').children[0].className==='sc-list'&&$('chat-wrap').children[1].id==='sc-main','3 cột: danh sách | hội thoại | thông tin khách');
 const rows=[...w.document.querySelectorAll('.sc-conv')];
 ok(rows.length===3&&rows[0].querySelector('.sc-av').textContent==='MH'&&rows[0].querySelector('.sc-dot')&&!rows[1].querySelector('.sc-dot'),'danh sách: avatar chữ cái + chấm cam khi CHƯA ĐỌC (chỉ hội thoại chưa đọc)');
 ok($('sc-info').textContent.includes('Chọn một hội thoại'),'chưa chọn → gợi ý chọn hội thoại');
 w.scPick('C1');await sleep(30);
 const h=$('sc-info').innerHTML;
 ok(h.includes('Mến Hoàng')&&h.includes('0934230669')&&h.includes('Vàng')&&h.includes('pro-stage')&&h.includes('pro-kpi'),'chọn hội thoại có SĐT "+84 934 230 669" → tìm đúng khách 0934230669: tên, hạng, thanh giai đoạn, ô số');
 ok(h.includes('class="cur"')&&h.includes('Hà')&&h.includes('VIP')&&h.includes('Đã kết bạn')&&h.includes('1990-05-02'),'thông tin chăm sóc: tình trạng (tô sáng), CS phụ trách, nhãn, kết bạn Zalo, sinh nhật');
 ok(h.includes('>5<')&&h.includes('3.000.000'),'ô số: 5 ngày từ đơn cuối, doanh thu');
 ok(h.includes('Chưa có lịch hẹn')&&h.includes('Dòng thời gian'),'việc tiếp theo + dòng thời gian');
 $('sc-info').querySelector('[data-sc-open]').click();ok(opened.join()==='0934230669'&&$('dp-overlay').classList.contains('open'),'bấm "Mở hồ sơ đầy đủ" → mở panel hồ sơ đúng khách');
 opened.length=0;w.scOpenProfile();ok(opened.join()==='0934230669','nút "👤 Mở hồ sơ" ở đầu hội thoại: mở thẳng panel hồ sơ khi có khách');
 w.scPick('C2');await sleep(10);ok($('sc-info').textContent.includes('chưa gắn SĐT')&&!$('sc-info').querySelector('[data-sc-open]'),'hội thoại chưa gắn SĐT → báo rõ, không có nút mở');
 w.scPick('C3');await sleep(10);ok($('sc-info').textContent.includes('Chưa có khách nào trong CRM')&&$('sc-info').textContent.includes('0999888777'),'SĐT không có trong CRM → báo rõ, vẫn hiện SĐT');
 ok(log.every(x=>!(x.o&&x.o.method==='POST')),'cột thông tin chỉ ĐỌC: không có POST ghi dữ liệu nào');
 w.eval('var _t=document.createElement("div");');
 const evil=w.proChatInfoHtml_({name:'<img src=x onerror=1>',phone:'0934230669'},null,null);ok(!evil.includes('<img')&&evil.includes('&lt;img'),'escape tên hội thoại (chống chèn HTML)');
 process.exit(bad?1:0);
})();

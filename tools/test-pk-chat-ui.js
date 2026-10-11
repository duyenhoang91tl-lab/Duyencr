// Test giao dien tab Chat Pancake (js/41-fn-pkchat.js) bang jsdom. Chay: node tools/test-pk-chat-ui.js (can: npm i jsdom)
const {JSDOM}=require('jsdom');const fs=require('fs'),path=require('path');
const code=fs.readFileSync(path.join(__dirname,'..','js','41-fn-pkchat.js'),'utf8');
const dom=new JSDOM('<body><div id="dp-overlay" class="open"><div id="dp-body"></div></div></body>',{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,log=[];let ok=0,fail=0;
const t=(n,v)=>{console.log((v?'OK  ':'FAIL')+' '+n);v?ok++:fail++;};
let respond={};
w.eval('var gsUrl="https://gs.example/exec";');
w.fetch=async(u,o)=>{log.push({u,o});const key=Object.keys(respond).find(k=>u.includes(k)||(o&&o.body&&o.body.includes(k)));const r=key?respond[key](u,o):{};return{json:async()=>r};};
w.toast=m=>log.push({toast:m});w.confirm=()=>true;
w.eval(code);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const $=id=>w.document.getElementById(id);
const conv={id:'P1_U1',pageId:'P1',name:'An Nguyen',phone:'0900000001',lastAt:'2026-10-12T01:00:00+00:00',lastText:'xin chao',seen:true,replied:false,type:'INBOX'};
const msgs=[{id:'m1',c:'P1_U1',dir:'in',text:'Xin chào <b>shop</b>\nCó size M không?',at:'2026-10-12T00:59:00+00:00',from:'An',att:[{type:'photo',url:'https://x/y.jpg',name:''}]},
            {id:'m2',c:'P1_U1',dir:'out',text:'Dạ còn ạ',at:'2026-10-12T01:00:00+00:00',from:'Page',att:[]}];
(async()=>{
 respond={'action=pkChat&':()=>({ok:true,phone:'0900000001',conversations:[conv],messages:msgs})};
 $('dp-body').innerHTML=w.renderPkChatTab({phone:'0900000001'});
 await sleep(60);
 t('hien 2 bong bong, cu -> moi',[...w.document.querySelectorAll('.pkc-m')].map(x=>x.className.replace('pkc-m ','')).join()==='in,out');
 t('noi dung duoc escape (khong chen HTML)',!$('pkc-msgs').innerHTML.includes('<b>shop')&&$('pkc-msgs').innerHTML.includes('&lt;b&gt;shop&lt;/b&gt;')&&$('pkc-msgs').innerHTML.includes('<br>'));
 t('anh dinh kem hien <img>',!!$('pkc-msgs').querySelector('img.pkc-img'));
 t('1 hoi thoai -> khong hien chip',$('pkc-convs').innerHTML==='');
 t('o soan tin hien',$('pkc-compose').style.display!=='none');
 t('lan dau goi pkChat theo SDT, khong co after',log[0].u.includes('action=pkChat&phone=0900000001')&&!log[0].u.includes('after='));
 // poll nhe dung moc after
 log.length=0;respond={'action=pkChat&':()=>({ok:true,conversations:[conv],messages:[{id:'m3',c:'P1_U1',dir:'in',text:'Gui anh',at:'2026-10-12T01:05:00+00:00',att:[]}]})};
 await w.pkcLoad(false);
 t('poll: gui after=moc tin cuoi',log[0].u.includes('after='+encodeURIComponent('2026-10-12T01:00:00+00:00')));
 t('poll: tin moi noi them (3 bong bong)',w.document.querySelectorAll('.pkc-m').length===3);
 // gui tin
 log.length=0;respond={'pkChatSend':()=>({ok:true,id:'m_9'}),'action=pkChat&':()=>({ok:true,conversations:[conv],messages:[{id:'m4',c:'P1_U1',dir:'out',text:'Da co anh nhe',at:new Date().toISOString(),att:[]}]})};
 $('pkc-input').value='  Da co anh nhe ';await w.pkcSend();
 const post=log.find(l=>l.o&&l.o.method==='POST');const body=JSON.parse(post.o.body);
 t('gui: POST pkChatSend dung convId + noi dung da trim',body.action==='pkChatSend'&&body.convId==='P1_U1'&&body.text==='Da co anh nhe');
 t('gui: hien tin tam ngay + xoa o nhap',$('pkc-input').value===''&&$('pkc-msgs').innerHTML.includes('Da co anh nhe'));
 await sleep(1700);
 t('gui: khi tin that ve thi tin tam bi bo (khong lap)',($('pkc-msgs').innerHTML.match(/Da co anh nhe/g)||[]).length===1);
 // gui loi
 log.length=0;respond={'pkChatSend':()=>({error:'Chua cai token Pancake'})};
 $('pkc-input').value='Tin se loi';await w.pkcSend();
 t('gui loi: tra lai noi dung vao o nhap + bao loi',$('pkc-input').value==='Tin se loi'&&/Chua cai token/.test($('pkc-status').textContent)&&!$('pkc-msgs').innerHTML.includes('Tin se loi'));
 // tim + gan
 respond={'action=pkChatFind':()=>({ok:true,conversations:[{id:'P1_U9',name:'Lan Anh',phone:'0911111111',lastText:'chi oi',lastAt:'2026-10-11T01:00:00Z'}]})};
 $('pkc-q').value='Lan';await w.pkcFind();
 t('tim: hien ket qua + canh bao SDT dang gan',$('pkc-found').innerHTML.includes('Lan Anh')&&$('pkc-found').innerHTML.includes('đang gắn 0911111111'));
 log.length=0;respond={'pkChatLink':()=>({ok:true}),'action=pkChat&':()=>({ok:true,conversations:[{...conv,id:'P1_U9',name:'Lan Anh'}],messages:[]})};
 await w.pkcLink('P1_U9','0911111111');
 const lk=JSON.parse(log.find(l=>l.o&&l.o.method==='POST').o.body);
 t('gan: POST pkChatLink dung convId + SDT khach hien tai',lk.action==='pkChatLink'&&lk.convId==='P1_U9'&&lk.phone==='0900000001');
 await sleep(30);t('gan: tai lai (full) sau khi gan',log.some(l=>l.u&&l.u.includes('action=pkChat&')&&!l.u.includes('after=')));
 // khong co hoi thoai
 respond={'action=pkChat&':()=>({ok:true,conversations:[],messages:[]})};
 $('dp-body').innerHTML=w.renderPkChatTab({phone:'0955555555'});await sleep(40);
 t('khong co hoi thoai: bao + an o soan + mo san phan gan',/Chưa có hội thoại/.test($('pkc-msgs').textContent)&&$('pkc-compose').style.display==='none'&&$('pkc-link').open===true);
 // loi tai
 respond={'action=pkChat&':()=>({error:'Can dang nhap.',code:'AUTH'})};
 $('dp-body').innerHTML=w.renderPkChatTab({phone:'0966666666'});await sleep(40);
 t('loi AUTH hien o dong trang thai',/Can dang nhap/.test($('pkc-status').textContent));
 // dung poll khi roi tab
 w.eval('_pkcStop()');t('_pkcStop xoa timer',w.eval('_pkc.timer')===null);
 console.log('\n'+ok+' OK, '+fail+' FAIL');process.exit(fail?1:0);
})();

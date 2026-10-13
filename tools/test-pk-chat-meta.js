// Test NGUOI GUI + GIO + THE + NGUOI XU LY trong chat Pancake (js/41 tab trong ho so khach + js/42 man Chat chung) bang jsdom.
// Chay: node tools/test-pk-chat-meta.js (can: npm i jsdom)
const {JSDOM}=require('jsdom');const fs=require('fs'),path=require('path');
const rd=f=>fs.readFileSync(path.join(__dirname,'..','js',f),'utf8');
const dom=new JSDOM('<body><div id="dp-overlay" class="open"><div id="dp-body"></div></div><div id="chat-wrap"></div><div id="sc-convs"></div></body>',{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;let ok=0,fail=0;const t=(n,v)=>{console.log((v?'OK  ':'FAIL')+' '+n);v?ok++:fail++;};
let respond={};const log=[];
w.eval('var gsUrl="https://gs.example/exec"; var currentUser={name:"Nguyen Duyen",username:"duyen"}; var _activeV9Tab="chat";');
w.fetch=async(u,o)=>{log.push({u,o});const k=Object.keys(respond).find(k=>u.includes(k)||(o&&o.body&&o.body.includes(k)));return{json:async()=>(k?respond[k](u,o):{})};};
w.toast=()=>{};w.confirm=()=>true;
w.eval(rd('41-fn-pkchat.js'));w.eval(rd('42-fn-socialchat.js'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const $=id=>w.document.getElementById(id);
const TAGS=[{id:'26',t:'L1. Chuẩn',c:'#009344'},{id:'28',t:'S7 ninhLTK',c:'javascript:alert(1)'},{id:'1',t:'<img src=x onerror=alert(1)>',c:'#822ba1'},{id:'4',t:'L4',c:'#111'},{id:'5',t:'L5',c:'#222'}];
const conv={id:'P1_U1',pageId:'P1',name:'Mến Hoàng',phone:'0934230669',lastAt:'2026-10-12T03:00:00+00:00',lastText:'Sao v c',seen:true,replied:true,type:'INBOX',tags:TAGS,assignees:['Le Ninh']};
const AT=['2026-10-12T01:06:00+00:00','2026-10-12T02:43:00+00:00','2026-10-12T03:00:00+00:00','2026-10-12T03:10:00+00:00'];
const msgs=[{id:'m1',c:'P1_U1',dir:'in',text:'Sao v c',at:AT[0],from:'Mến Hoàng',staff:'',crm:false,att:[]},
  {id:'m2',c:'P1_U1',dir:'out',text:'Em ơi chị xin lỗi',at:AT[1],from:'Phạm Thu Hiền - Hiền Tour',staff:'Le Ninh',crm:false,att:[]},
  {id:'m3',c:'P1_U1',dir:'out',text:'Gửi từ CRM',at:AT[2],from:'Phạm Thu Hiền - Hiền Tour',staff:'Duyen',crm:true,att:[]},
  {id:'m4',c:'P1_U1',dir:'out',text:'Tin gửi từ app',at:AT[3],from:'Phạm Thu Hiền - Hiền Tour',staff:'',crm:false,att:[]}];
(async()=>{
  // ── tab Chat trong hồ sơ khách ──
  respond={'action=pkChat&':()=>({ok:true,phone:'0934230669',conversations:[conv],messages:msgs})};
  $('dp-body').innerHTML=w.renderPkChatTab({phone:'0934230669'});await sleep(60);
  const metas=[...w.document.querySelectorAll('#pkc-msgs .pkc-t')];
  const hm=s=>w._pkcHm(s);
  t('moi tin co dong nguoi gui · gio (4 dong)',metas.length===4);
  t('tin khach: ten khach + gio',metas[0].textContent.startsWith('Mến Hoàng · '+hm(AT[0])));
  t('tin nhan vien Pancake: ten nhan vien (khong phai ten page) + gio',metas[1].textContent.startsWith('Le Ninh · '+hm(AT[1]))&&!metas[1].textContent.includes('Hiền Tour'));
  t('tin gui tu CRM: ten nhan vien CRM + nhan CRM',metas[2].textContent.startsWith('Duyen · '+hm(AT[2]))&&!!metas[2].querySelector('.pkc-crm'));
  t('tin khong biet nhan vien: hien ten page',metas[3].textContent.startsWith('Phạm Thu Hiền - Hiền Tour · '));
  t('re chuot hien du ngay gio giay (dd/mm/yyyy hh:mm:ss)',/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(metas[1].getAttribute('title')));
  const tg=[...w.document.querySelectorAll('#pkc-meta .pkc-tag')];
  t('hien du 5 the + nguoi xu ly',tg.length===5&&/Le Ninh/.test($('pkc-meta').textContent));
  t('mau the lay tu Pancake (#009344)',/#009344|rgb\(0, 147, 68\)/i.test(tg[0].getAttribute('style')||''));
  t('mau khong hop le (javascript:) khong vao style',!(tg[1].getAttribute('style')||'').includes('javascript'));
  t('ten the bi escape (khong chen HTML)',!$('pkc-meta').querySelector('img')&&$('pkc-meta').innerHTML.includes('&lt;img'));
  // ── gửi: tin tạm hiện tên người đang đăng nhập ──
  respond={'pkChatSend':()=>({ok:true,id:'m_9'}),'action=pkChat&':()=>({ok:true,conversations:[conv],messages:msgs})};
  $('pkc-input').value='Chào chị';const p=w.pkcSend();
  const tmp=[...w.document.querySelectorAll('#pkc-msgs .pkc-t')].pop();
  t('tin tam: hien ten nguoi dang dang nhap + CRM + dau ✓',tmp.textContent.startsWith('Nguyen Duyen · ')&&!!tmp.querySelector('.pkc-crm')&&tmp.textContent.includes('✓'));
  await p;
  // ── màn Chat chung (js/42) ──
  w.eval('_sc.convs='+JSON.stringify([conv,Object.assign({},conv,{id:'P1_U2',name:'Không thẻ',tags:[],assignees:[]})])+';');
  w._scRenderList();
  const rows=w.document.querySelectorAll('#sc-convs .sc-conv');
  t('danh sach: hoi thoai co the hien toi da 3 the + "+2"',rows[0].querySelectorAll('.pkc-tag').length===4&&/\+2/.test(rows[0].querySelector('.pkc-tag.more').textContent));
  t('danh sach: hoi thoai khong the -> khong co dong the',!rows[1].querySelector('.sc-conv-g'));
  w.document.body.insertAdjacentHTML('beforeend','<div id="sc-main"><div id="sc-head"></div><div id="sc-msgs"></div><div id="sc-status"></div><div id="sc-compose"></div></div>');
  respond={'action=pkChatConv':()=>({ok:true,messages:msgs})};
  w.scPick('P1_U1');await sleep(60);
  t('khung chat: dau trang co the + nguoi xu ly',$('sc-head-m').querySelectorAll('.pkc-tag').length===5&&/Le Ninh/.test($('sc-head-m').textContent));
  const m2=[...w.document.querySelectorAll('#sc-msgs .pkc-t')];
  t('khung chat: nguoi gui + gio duoi tung tin',m2.length===4&&m2[1].textContent.startsWith('Le Ninh · ')&&m2[2].querySelector('.pkc-crm'));
  // thẻ đổi khi danh sách tải lại lúc đang mở
  w.eval('_sc.convs[0].tags=[{id:"9",t:"Moi them",c:"#0d5aff"}];');w._scRenderList();
  t('khung chat: the cap nhat theo danh sach moi khi dang mo',$('sc-head-m').querySelectorAll('.pkc-tag').length===1&&$('sc-head-m').textContent.includes('Moi them'));
  console.log('\n'+ok+' OK, '+fail+' FAIL');process.exit(fail?1:0);
})();

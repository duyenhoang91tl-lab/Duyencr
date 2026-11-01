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

  // ── luon co ten nguoi gui (du lieu thieu) ──
  const mnone=[{id:'z1',c:'P1_U1',dir:'out',text:'x',at:AT[1],from:'',staff:'',crm:false,att:[]},{id:'z2',c:'P1_U1',dir:'in',text:'y',at:AT[0],from:'',staff:'',crm:false,att:[]}];
  t('tin nhan vien khong biet ten -> hien "Nhân viên" (khong de trong)',w._pkcMetaHtml(mnone[0],conv).includes('<b>Nhân viên</b>'));
  t('tin khach thieu ten -> lay ten hoi thoai; khong co hoi thoai -> "Khách"',w._pkcMetaHtml(mnone[1],conv).includes('<b>Mến Hoàng</b>')&&w._pkcMetaHtml(mnone[1],null).includes('<b>Khách</b>'));
  // ── canh bao khi co the nhung chua lay duoc ten ──
  const rowW=w._pkcMetaRow({tags:[],tagN:3,assignees:[]});
  t('co 3 the nhung chua co ten -> hien canh bao ⚠ ro rang (khong im lang)',/pkc-warn/.test(rowW)&&rowW.includes('3 thẻ'));
  t('khong co the nao (tagN=0) -> khong canh bao',!/pkc-warn/.test(w._pkcMetaRow({tags:[],tagN:0,assignees:[]})));
  // ── nhan phien ban giao dien + GAS ──
  t('dong trang thai co phien ban giao dien + GAS moi',w._pkcVerText('v13.99-test').includes(w.PKC_UI_VER)&&w._pkcVerText('v13.99-test').includes('GAS v13.99-test'));
  t('GAS cu (khong co gv) -> canh bao "chua deploy lai"',w._pkcVerText('').includes('GAS CŨ')&&w._pkcVerText('').includes('deploy'));
  // ── cot Thong tin ben phai (js/48): The Pancake + Nguoi xu ly ──
  const src48=fs.readFileSync(path.join(__dirname,'..','js','48-pro-chatinfo.js'),'utf8');
  const blk=src48.slice(src48.indexOf('function proPkBlock_'),src48.indexOf('function proChatInfoHtml_'));
  w.eval('function proEsc_(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}'+blk);
  const h1=w.proPkBlock_(conv);
  t('cot Thong tin: "Thẻ Pancake" co du the + "Người xử lý"',h1.includes('Thẻ Pancake')&&(h1.match(/pkc-tag/g)||[]).length===5&&h1.includes('Người xử lý')&&h1.includes('Le Ninh'));
  t('cot Thong tin: co the nhung chua co ten -> canh bao; khong gi ca -> rong',w.proPkBlock_({tags:[],tagN:2,assignees:[]}).includes('pkc-warn')&&w.proPkBlock_({tags:[],tagN:0,assignees:[]})==='');
  t('cot Thong tin: ten nguoi xu ly bi escape',w.proPkBlock_({tags:[],tagN:0,assignees:['<b>x</b>']}).includes('&lt;b&gt;'));
  // ── nut Chan doan: chi admin ──
  w.eval('function _ovIsAdmin(){return window.__adm===true}');
  w.eval('window.__adm=false');w.scPick('P1_U1');await sleep(40);
  t('khong phai admin: KHONG co nut Chẩn đoán',!$('sc-head').textContent.includes('Chẩn đoán'));
  w.eval('window.__adm=true');w.scPick('P1_U1');await sleep(40);
  t('admin: co nut Chẩn đoán o dau khung chat',$('sc-head').textContent.includes('Chẩn đoán'));
  respond={'action=pkChatDiag':()=>({ok:true,gv:'v13.99-test',tagsStored:[26,28],tagsApi:{ok:false,code:401}})};
  await w.scDiag();
  const dtxt=$('sc-diag-t').value;
  t('chan doan: hien JSON that + phien ban giao dien/GAS (de dan cho nguoi ho tro)',dtxt.includes('"tagsStored"')&&dtxt.includes('"code": 401')&&dtxt.includes(w.PKC_UI_VER)&&log.some(l=>/action=pkChatDiag&conv=P1_U1/.test(l.u)));
  console.log('\n'+ok+' OK, '+fail+' FAIL');process.exit(fail?1:0);
})();

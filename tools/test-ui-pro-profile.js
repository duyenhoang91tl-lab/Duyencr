// Test P2 bước 1: mô phỏng logic bằng dữ liệu thật dạng CRM.
const m=require('../js/33-pro-profile.js');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const tree=[{label:'Chốt',value:'Chốt'},{label:'Phân vân/Tiềm năng',value:'Phân vân/Tiềm năng'},{label:'Đang sd',children:[{label:'Hiệu quả',value:'Đang sd - Hiệu quả'},{label:'Kém',value:'Đang sd - Kém'}]},{label:'Chưa liên hệ',value:'Chưa liên hệ'}];
let s=m.proStageModel_(tree,'Chốt');ok(s.length===4&&s[0].cur&&s.filter(x=>x.cur).length===1,'status lá → đúng 1 giai đoạn hiện tại');
s=m.proStageModel_(tree,'Đang sd - Kém');ok(s[2].cur&&s.filter(x=>x.cur).length===1,'status con → node cha sáng');
s=m.proStageModel_(tree,'');ok(s.every(x=>!x.cur),'status rỗng → không sáng');
s=m.proStageModel_(tree,'Không có trong cây');ok(s.every(x=>!x.cur),'status lạ → không sáng, không lỗi');
ok(m.proStageModel_(null,'x').length===0,'cây rỗng an toàn');
const now=new Date(2026,9,11);
ok(m.proDaysSinceLastOrder_([{date:new Date(2026,9,1)},{date:new Date(2026,6,1)}],now)===10,'lấy đơn GẦN NHẤT (10 ngày)');
ok(m.proDaysSinceLastOrder_([{year:2026,month:9}],now)===40,'đơn chỉ có tháng/năm → từ ngày 1');
ok(m.proDaysSinceLastOrder_([{year:26,month:9}],now)===40,'năm 2 chữ số (26) → 2026');
ok(m.proDaysSinceLastOrder_([],now)===null,'không đơn → null');
ok(m.proDaysSinceLastOrder_([{date:new Date(2027,0,1)}],now)===0,'đơn tương lai → 0, không âm');
let h=m.proKpiHtml_(200,3,12500000);ok(h.includes('pro-kpi red')&&h.includes('12.500.000'),'>180 ngày → đỏ; tiền định dạng');
ok(m.proKpiHtml_(null,0,0).includes('—'),'không đơn → hiện —');
ok(m.proStageHtml_([{label:'<b>',cur:true}]).includes('&lt;b>'),'escape nhãn');
// ── P2b/P2c ──
ok(m.proNoteTs_('14:05 03/10/2026')===new Date(2026,9,3,14,5).getTime(),'parse giờ ghi chú HH:MM dd/mm/yyyy');
ok(m.proNoteTs_('')===null&&m.proNoteTs_('abc')===null,'ghi chú cũ không có giờ → null');
const T=[{key:'goi',label:'Hẹn gọi'},{key:'sp',label:'Nhắc SP'}];
const sc=[{id:'a',phone:'09',date:'2026-10-20',type:'goi',note:'Gọi hỏi kết quả'},{id:'b',phone:'09',date:'2026-10-05',type:'sp',note:'Nhắc mua lại'},{id:'c',phone:'09',date:'2026-10-11',type:'goi'},{id:'d',phone:'09',date:'2026-09-01',type:'goi',done:true},{id:'e',phone:'XX',date:'2026-10-12',type:'goi'}];
let na=m.proNextActions_(sc,'09','2026-10-11',T,3);
ok(na.map(x=>x.id).join()==='b,c,a','quá hạn → hôm nay → sắp tới; bỏ lịch done và của KH khác');
ok(na[0].state==='over'&&na[1].state==='today'&&na[2].state==='soon','trạng thái over/today/soon đúng');
ok(m.proNextActions_(sc,'09','2026-10-11',T,2).length===2,'giới hạn số mục');
ok(m.proNextHtml_([]).includes('Chưa có lịch hẹn')&&m.proNextHtml_(na).includes('Quá hạn')&&m.proNextHtml_(na).includes('data-pro-go'),'HTML: rỗng / có chip quá hạn / có nút chuyển tab');
ok(m.proNextHtml_([{date:'2026-10-20',label:'<x>',note:'',state:'soon'}]).includes('&lt;x&gt;'),'escape nhãn lịch');
const notes=[{text:'Khách hỏi combo',user:'Hà',time:'09:00 08/10/2026'},{text:'ghi chú cũ',user:'',time:''}];
const ords=[{date:new Date(2026,9,9),revenue:3000000,product:'Combo A'},{year:26,month:7,revenue:500000}];
const tl=m.proTimeline_(notes,[{date:'2026-10-10',type:'goi',typeLabel:'Hẹn gọi',note:'ok',done:true}],ords,30);
ok(tl.map(x=>x.kind).join()==='sched,order,note,order,note','sắp mới→cũ, mục không ngày xuống cuối ('+tl.map(x=>x.kind).join()+')');
ok(tl[0].title.startsWith('✓ Hẹn gọi')&&tl[1].title.includes('3.000.000đ')&&tl[3].when==='07/2026','tiêu đề lịch done, tiền, đơn chỉ tháng/năm');
ok(m.proTimeline_(notes,[],[],1).length===1,'giới hạn limit');
ok(m.proTimelineHtml_([],0)===''&&m.proTimelineHtml_(tl,5).includes('Dòng thời gian (5)'),'HTML timeline');
ok(m.proTimelineHtml_([{kind:'note',when:'x',title:'<script>'}],1).includes('&lt;script&gt;'),'escape nội dung timeline');
// Gắn vào openDp/renderDpTab bằng DOM giả (vm)
const vm=require('vm'),fs=require('fs');
function sim(proOn){const els={};const tabs={parentNode:{insertBefore:(n,ref)=>{els['dp-pro']=n}}};
 const doc={documentElement:{classList:{contains:c=>proOn&&c==='ui-pro'}},getElementById:id=>els[id]||null,querySelector:()=>tabs,createElement:()=>({querySelector:()=>null,set innerHTML(v){this._h=v},get innerHTML(){return this._h},remove(){delete els['dp-pro']}})};
 const calls=[];const ctx={document:doc,console,module:undefined,currentPhone:'0901',careData:{'0901':{status:'Chốt'}},allCustomers:[{phone:'0901',orders:[{date:null,revenue:1000}]}],CARE_STATUS_TREE:tree,_posStatsOn:false,donStatsByPhone:{},_custRev_:()=>1000,_ymd:d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),
  openDp:function(p){calls.push('open')},renderDpTab:function(t){calls.push('tab')}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/33-pro-profile.js','utf8')+';this.openDp=openDp;this.renderDpTab=renderDpTab;',ctx);
 ctx.allCustomers[0].orders[0].date=vm.runInContext('new Date(Date.now()-5*86400000)',ctx);
 ctx.openDp('0901');ctx.renderDpTab('care');return {calls,host:els['dp-pro']};}
let r=sim(true);ok(r.calls.join()==='open,tab','hàm gốc vẫn được gọi');ok(r.host&&r.host.innerHTML.includes('pro-stage')&&r.host.innerHTML.includes('class="cur"')&&r.host.innerHTML.includes('>5<'),'ui-pro BẬT → chèn thanh giai đoạn + 5 ngày');
r=sim(false);ok(r.calls.join()==='open,tab'&&!r.host,'ui-pro TẮT → không chèn gì, bản cũ nguyên');
// R5b: thanh thao tác nhanh
{
const Q=m.proQuickActionsHtml_;
let h=Q('0912 345 678');
ok(h.includes('href="tel:0912345678"')&&h.includes('href="https://zalo.me/0912345678"')&&h.includes('target="_blank"')&&h.includes('rel="noopener"'),'Gọi = tel:, Zalo = zalo.me (tab mới, noopener), SĐT bỏ dấu cách');
ok(['note','sched','order'].every(k=>h.includes('<button type="button" class="pro-qa" data-pro-qa="'+k+'">')),'3 nút Ghi chú / Đặt lịch / Tạo đơn là <button type="button"> (không submit form)');
ok(Q('+84912345678').includes('tel:+84912345678')&&Q('+84912345678').includes('zalo.me/84912345678'),'số quốc tế: tel giữ "+", Zalo chỉ chữ số');
ok(Q('')===''&&Q(null)===''&&Q('abc')==='','SĐT rỗng/không có chữ số → không vẽ thanh');
h=Q('0912"><script>alert(1)</script>');ok(!h.includes('<script')&&!h.includes('">'+'<s'),'chèn ký tự lạ vào SĐT không phá được href (chỉ giữ chữ số)');
ok(m.proQuickPhone_(' 0901-234.567 ')==='0901234567','chuẩn hoá SĐT có gạch/chấm');
}
// R5b: bấm nút → chuyển tab + focus đúng ô (DOM giả; chạy NGUYÊN hàm proQuickGo_ trong file thật)
{
const fs=require('fs'),vm=require('vm');
const calls=[];let formDisp='none',focused=[];
const el=(id)=>({style:id==='add-order-form'?{get display(){return formDisp}}:{},focus(){focused.push(id)},scrollIntoView(){}});
const tabs=['care','schedule','history'].map((k)=>({k}));
const ctx={console,document:{querySelectorAll:()=>tabs,getElementById:(id)=>({'cs-note-new':1,'new-snote':1,'add-order-form':1,'mo-product':1}[id]?el(id):null)},
 switchDpTab:(key,t)=>{calls.push('tab:'+key)},_toggleAddOrderForm:()=>{calls.push('toggle');formDisp=formDisp==='none'?'block':'none'}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/33-pro-profile.js','utf8'),ctx);
ctx.proQuickGo_('note');ok(calls.join()==='tab:care'&&focused.join()==='cs-note-new','Ghi chú → tab Chăm sóc + focus ô ghi chú mới');
calls.length=0;focused.length=0;ctx.proQuickGo_('sched');ok(calls.join()==='tab:schedule'&&focused.join()==='new-snote','Đặt lịch → tab Lịch hẹn + focus ô nội dung lịch');
calls.length=0;focused.length=0;ctx.proQuickGo_('order');ok(calls.join()==='tab:history,toggle'&&focused.join()==='mo-product'&&formDisp==='block','Tạo đơn → tab Lịch sử đơn, MỞ form (đang ẩn), focus ô sản phẩm');
calls.length=0;focused.length=0;ctx.proQuickGo_('order');ok(calls.join()==='tab:history'&&formDisp==='block','bấm Tạo đơn lần nữa khi form đã mở → KHÔNG tắt (hàm gốc là toggle)');
}
process.exit(bad?1:0);

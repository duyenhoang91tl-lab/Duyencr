// Test P4: thanh tab hồ sơ + ngữ cảnh/ẩn SĐT/prompt/gọi AI của trợ lý (hàm thật từ js/33 + js/38, chạy trong vm không DOM).
const fs=require('fs'),vm=require('vm');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const ctx={console,AbortController,setTimeout,clearTimeout,careData:{},_posStatsOn:false,donStatsByPhone:{},schedules:[],SCHED_TYPES:[{key:'goi',label:'Hẹn gọi'}]};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/33-pro-profile.js','utf8')+'\n'+fs.readFileSync('js/38-pro-dock.js','utf8')+'\nthis.X={proTabsAdd_,proTabsRemove_,proScrub_,proClip_,proCustomerContext_,proSalesContext_,proAskPrompt_,proAskRequest_,proAnswerHtml_,proProfileData_,proDaysSinceLastOrder_,proNoteTs_};',ctx);
const X=ctx.X;
// — tab —
let t=[];for(let i=1;i<=10;i++)t=X.proTabsAdd_(t,{phone:'p'+i,name:'K'+i},8);
ok(t.length===8&&t[0].phone==='p3'&&t[7].phone==='p10','tối đa 8 tab, bỏ tab cũ nhất');
t=X.proTabsAdd_(t,{phone:'p5',name:'K5 mới'},8);ok(t.length===8&&t[7].phone==='p5'&&t.filter(x=>x.phone==='p5').length===1,'mở lại khách đã có → không trùng, chuyển về cuối');
ok(X.proTabsRemove_(t,'p5').length===7&&X.proTabsRemove_(t,'zzz').length===8,'đóng tab');
// — ẩn SĐT —
ok(X.proScrub_('gọi 0901234567 nhé')==='gọi [SĐT] nhé','ẩn SĐT liền');
ok(X.proScrub_('zalo 0901 234 567 / +84901234567')==='zalo [SĐT] / [SĐT]','ẩn SĐT có cách và +84');
ok(X.proScrub_('0901.234.567 và 090-123-4567')==='[SĐT] và [SĐT]','ẩn SĐT có chấm/gạch');
ok(X.proScrub_('Đơn 3.000.000đ, 12/10/2026, 5 hộp')==='Đơn 3.000.000đ, 12/10/2026, 5 hộp','KHÔNG làm hỏng tiền/ngày/số lượng');
ok(X.proScrub_('mã 123456789012')==='mã [SĐT]','dãy ≥9 chữ số liền cũng bị ẩn');
ok(X.proClip_('a'.repeat(300),50).length===50,'cắt độ dài');
// — ngữ cảnh khách —
const now=new Date(2026,9,11);
const c={phone:'0901234567',name:'Chị Lan 0987654321',tier:'Vàng',careStatus:'Chốt',orders:[{date:new Date(2026,9,1),revenue:3000000,product:'Combo A'}]};
ctx.careData['0901234567']={status:'Chốt',note:'[]'};
ctx.schedules.push({id:1,phone:'0901234567',date:'2026-10-05',type:'goi',note:'hỏi kết quả, gọi 0912345678'},{id:2,phone:'0901234567',date:'2026-10-20',type:'goi',note:'nhắc mua lại'});
const D={care:{status:'Chốt'},nOrd:1,types:ctx.SCHED_TYPES,orders:c.orders,notes:[{text:'Khách hỏi giá, SĐT 0933222111',user:'Hà',time:'09:00 08/10/2026'}],mine:ctx.schedules.map(x=>Object.assign({},x,{typeLabel:'Hẹn gọi'}))};
const cc=X.proCustomerContext_(c,D,10,3000000,now);
ok(!/0901234567|0987654321|0912345678|0933222111/.test(cc),'ngữ cảnh khách KHÔNG chứa SĐT nào (kể cả trong tên/ghi chú/lịch)');
ok(cc.includes('Tên: Chị Lan [SĐT]')&&cc.includes('Hạng: Vàng')&&cc.includes('Tình trạng CS: Chốt'),'có tên/hạng/tình trạng');
ok(cc.includes('Số đơn: 1')&&cc.includes('3.000.000đ')&&cc.includes('Ngày từ đơn cuối: 10'),'có số đơn, doanh thu, ngày từ đơn cuối');
ok(cc.includes('05/10/2026')&&cc.includes('[QUÁ HẠN]')&&cc.includes('20/10/2026'),'lịch chưa xong, đánh dấu quá hạn');
ok(cc.includes('Khách hỏi giá, SĐT [SĐT]')&&cc.includes('Combo A'),'ghi chú (đã ẩn) + đơn gần nhất');
ok(X.proCustomerContext_({name:'X',phone:'1'},{care:{},nOrd:0,types:[],orders:[],notes:[],mine:[]},null,0,now).includes('chưa có đơn'),'khách mới: ghi "chưa có đơn", không lỗi');
// — ngữ cảnh doanh số —
const people=Array.from({length:20},(_,i)=>({name:'NV'+i,revenue:(i+1)*1000000,orders:i+1,pct:50+i,tyLeChot:30,failedOrders:1,rating:i%2?'tot':'kem'}));
const sc=X.proSalesContext_({label:'Team: A',people,company:{revenue:210000000,orders:210,aov:1000000,pct:80.5,tyLeChot:31.2,failed:20,tot:10,trungbinh:0,kem:10,chuadu:0,soNguoi:20}},{from:'2026-10-01',to:'2026-10-11'});
ok(sc.includes('Phạm vi: Team: A')&&sc.includes('2026-10-01 → 2026-10-11')&&sc.includes('210.000.000đ')&&sc.includes('%KPI 80.5%'),'ngữ cảnh doanh số: phạm vi, kỳ, tổng');
ok(sc.includes('Top 15')&&sc.split('\n').filter(l=>l.startsWith('- NV')).length===15&&sc.indexOf('NV19')<sc.indexOf('NV18'),'chỉ top 15, sắp theo doanh thu giảm dần');
ok(sc.includes('Cần cải thiện')&&sc.includes('Làm tốt'),'có xếp loại');
// — prompt —
const long='x'.repeat(20000);
let pr=X.proAskPrompt_(long,'câu hỏi '.repeat(200),[{role:'user',text:'h'.repeat(900)},{role:'bot',text:'đ'.repeat(900)}]);
ok(pr.length<=9000&&pr.startsWith('NGỮ CẢNH:')&&pr.includes('CÂU HỎI:'),'prompt ≤ 9000 ký tự (giới hạn GAS) dù ngữ cảnh/câu hỏi dài ('+pr.length+')');
ok(!X.proAskPrompt_('ctx','gọi 0901234567').includes('0901234567'),'câu hỏi nhập SĐT cũng bị ẩn');
// — gọi AI —
(async()=>{
 let seen;const f=(ok_,body)=>async(u,o)=>{seen={u,o};return {json:async()=>body}};
 let r=await X.proAskRequest_('https://gas/x','P',f(1,{ok:true,text:'Trả lời',provider:'Groq'}));
 const sent=JSON.parse(seen.o.body);
 ok(r.ok&&r.text==='Trả lời'&&r.provider==='Groq'&&sent.action==='ai'&&sent.crmAsk===true&&sent.prompt==='P'&&seen.o.method==='POST'&&!seen.o.headers,'gửi POST action=ai + crmAsk:true, không header lạ (tránh preflight CORS)');
 r=await X.proAskRequest_('https://gas/x','P',f(1,{error:'Unknown action'}));ok(!r.ok&&/v13\.32/.test(r.error),'Unknown action → nhắc backend chưa lên v13.32');
 r=await X.proAskRequest_('https://gas/x','P',f(1,{ok:false,error:'Chua co key AI'}));ok(!r.ok&&r.error.includes('key AI'),'lỗi từ backend được chuyển nguyên');
 r=await X.proAskRequest_('','P',f(1,{}));ok(!r.ok&&r.error.includes('GAS'),'chưa có link GAS → báo rõ');
 r=await X.proAskRequest_('https://gas/x','P',async()=>{throw new Error('mạng lỗi')});ok(!r.ok&&r.error.includes('mạng lỗi'),'lỗi mạng không ném ra ngoài');
 ok(X.proAnswerHtml_('a<b>\nc')==='a&lt;b&gt;<br>c','hiển thị câu trả lời: escape HTML + xuống dòng');
 process.exit(bad?1:0);
})();

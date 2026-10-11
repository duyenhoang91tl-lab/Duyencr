// Test P4: thanh tab hồ sơ + ngữ cảnh/ẩn SĐT/prompt/gọi AI của trợ lý (hàm thật từ js/33 + js/38, chạy trong vm không DOM).
const fs=require('fs'),vm=require('vm');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const ctx={console,AbortController,setTimeout,clearTimeout,careData:{},_posStatsOn:false,donStatsByPhone:{},schedules:[],SCHED_TYPES:[{key:'goi',label:'Hẹn gọi'}]};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/33-pro-profile.js','utf8')+'\n'+fs.readFileSync('js/38-pro-dock.js','utf8')+'\nthis.X={proIntent_,proRuleCustomer_,proRuleSales_,proRuleAnswer_,proTabsAdd_,proTabsRemove_,proScrub_,proClip_,proCustomerContext_,proSalesContext_,proAskPrompt_,proAskRequest_,proAnswerHtml_,proProfileData_,proDaysSinceLastOrder_,proNoteTs_};',ctx);
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
// — trả lời THÔ theo quy tắc —
const I=(m,q)=>X.proIntent_(m,q);
ok(I('customer','Tóm tắt khách này')==='summary'&&I('customer','Nên làm gì tiếp với khách này?')==='next'&&I('customer','Gợi ý tin nhắn chăm sóc')==='message','nhận ý định 3 gợi ý của chế độ Khách (tin nhắn ưu tiên trước "chăm sóc")');
ok(I('sales','Tóm tắt doanh số kỳ này')==='summary'&&I('sales','Ai cần hỗ trợ nhất và vì sao?')==='support'&&I('sales','Điểm đáng chú ý nhất là gì?')==='notable','nhận ý định 3 gợi ý của chế độ Doanh số');
ok(I('customer','thời tiết hôm nay')===''&&I('sales','kể chuyện cười')==='','câu ngoài mẫu → không hiểu');
ok(X.proRuleAnswer_('customer','thời tiết',{})===X.proRuleAnswer_('sales','abc',{})&&X.proRuleAnswer_('customer','x',{}).includes('chưa hiểu'),'câu lạ → báo chưa hiểu, mời bấm gợi ý');
const Dm=Object.assign({},D,{nOrd:1});const cl={name:'Lan',phone:'0901234567',tier:'Vàng'};
let r=X.proRuleCustomer_('summary',cl,Dm,10,3000000,now);
ok(r.includes('Lan (hạng Vàng)')&&r.includes('Tình trạng CS: Chốt'.toLowerCase().replace('tình','tình'))||r.includes('tình trạng CS: Chốt'),'khách·tóm tắt: tên/hạng/tình trạng');
ok(r.includes('Đã mua 1 đơn, tổng 3.000.000đ; đơn gần nhất cách 10 ngày.')&&r.includes('Lịch chưa xong: 2 (1 quá hạn)')&&r.includes('Ghi chú gần nhất: Khách hỏi giá'),'khách·tóm tắt: đơn, lịch quá hạn, ghi chú (hiển thị nội bộ, không ẩn)');
r=X.proRuleCustomer_('next',cl,Dm,10,3000000,now);
ok(r.startsWith('• Xử lý lịch QUÁ HẠN trước: Hẹn gọi ngày 05/10')&&r.split('\n').length<=3,'khách·việc tiếp: quá hạn lên đầu, ≤3 gạch');
const Dn={care:{status:'Chốt'},nOrd:2,types:[],orders:[],notes:[],mine:[]};
r=X.proRuleCustomer_('next',cl,Dn,200,5000000,now);ok(r.includes('200 ngày chưa mua lại')&&r.includes('Chưa có lịch hẹn nào'),'khách·việc tiếp: >180 ngày + chưa có lịch');
r=X.proRuleCustomer_('next',cl,Object.assign({},Dn,{nOrd:0,care:{}}),null,0,now);ok(r.includes('Chưa có đơn nào')&&r.includes('Chưa gán tình trạng CS'),'khách mới: ưu tiên chốt đơn đầu + nhắc gán tình trạng');
r=X.proRuleCustomer_('next',cl,Dn,20,1,now);ok(r.includes('Chưa có lịch hẹn'),'khách mua gần đây chưa có lịch → đặt lịch');
ok(X.proRuleCustomer_('next',cl,Object.assign({},Dn,{mine:[{id:9,phone:'0901234567',date:'2026-10-30',type:'goi',typeLabel:'Hẹn gọi'}]}),20,1,now).includes('Chưa thấy việc gấp'),'không có việc gấp → nói rõ');
ok(X.proRuleCustomer_('message',cl,Dn,45,1,now).includes('45 ngày')&&X.proRuleCustomer_('message',cl,Dn,5,1,now).includes('mấy hôm')&&X.proRuleCustomer_('message',cl,Object.assign({},Dn,{nOrd:0}),null,0,now).includes('băn khoăn'),'tin mẫu: 3 tình huống (mua lại / mới mua / chưa mua)');
ok(X.proRuleCustomer_('message',cl,Dn,45,1,now).includes('chỉnh theo cuộc trò chuyện'),'tin mẫu có nhắc chỉnh trước khi gửi');
const ppl=[{name:'A',revenue:60e6,orders:30,pct:110,tyLeChot:40,failedOrders:2,rating:'tot'},{name:'B',revenue:20e6,orders:10,pct:60,tyLeChot:20,failedOrders:5,rating:'kem'},{name:'C',revenue:10e6,orders:5,pct:40,tyLeChot:15,failedOrders:1,rating:'kem'},{name:'D',revenue:10e6,orders:5,pct:null,tyLeChot:null,failedOrders:0,rating:'chuadu'}];
const S={label:'Team: X',people:ppl,company:{revenue:100e6,orders:50,aov:2e6,pct:85,tyLeChot:30,failed:8,tot:1,trungbinh:0,kem:2,chuadu:1,soNguoi:4}},DD={from:'2026-10-01',to:'2026-10-11'};
r=X.proRuleSales_('summary',S,DD);ok(r.includes('Team: X · 2026-10-01 → 2026-10-11')&&r.includes('Doanh thu 100.000.000đ · 50 đơn · TB/đơn 2.000.000đ')&&r.includes('%KPI 85%')&&r.includes('Top: 1. A (60.000.000đ) · 2. B')&&r.includes('chưa đủ dữ liệu 1'),'doanh số·tóm tắt: số liệu + top 3 đúng thứ tự');
r=X.proRuleSales_('support',S,DD);ok(r.indexOf('• C')<r.indexOf('• B')&&!r.includes('• A')&&!r.includes('• D')&&r.includes('+1 người chưa đủ dữ liệu'),'doanh số·hỗ trợ: C(40%) trước B(60%), loại A đạt và D chưa đủ dữ liệu');
ok(X.proRuleSales_('support',{label:'x',people:[ppl[0]],company:{}},DD).includes('Không ai đang dưới ngưỡng'),'doanh số·hỗ trợ: không ai yếu → nói rõ');
r=X.proRuleSales_('notable',S,DD);ok(r.includes('KPI đang 85%')&&r.includes('thiếu 15 điểm')&&r.includes('Dẫn đầu doanh thu: A')&&r.includes('chiếm 60%')&&r.includes('Nhiều đơn thất bại nhất: B (5 đơn)')&&r.split('\n').length===4,'doanh số·đáng chú ý: KPI, dẫn đầu, tập trung 60%, thất bại nhiều nhất; tối đa 4 gạch (gọn trên điện thoại)');
ok(X.proRuleSales_('notable',{people:[],company:{pct:90,tyLeChot:30}},DD).includes('Tỷ lệ chốt chung 30%'),'doanh số·đáng chú ý: có tỷ lệ chốt khi còn chỗ');
ok(X.proRuleSales_('notable',{people:[],company:{pct:120}},DD).includes('ĐẠT KPI')&&X.proRuleSales_('notable',{people:[],company:{pct:50}},DD).includes('thấp'),'doanh số·đáng chú ý: ngưỡng đạt / thấp');
ok(X.proRuleSales_('notable',{people:[],company:{}},DD).includes('Chưa đủ số liệu'),'doanh số·không có số liệu → nói rõ, không lỗi');
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

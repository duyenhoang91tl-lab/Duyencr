// Test P1 giao diện PRO — Trang chủ: đồng hồ, thanh phân bố, khuyến nghị (hàm thuần trong js/36-pro-home.js).
const m=require('../js/36-pro-home.js');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
// Đồng hồ
let g=m.proGaugeHtml_(78.1,'% KPI','đạt mục tiêu');
ok(g.includes('78.1%')&&g.includes('g-fg warn'),'78.1% → số thật + vòng màu cam (70–99)');
ok(m.proGaugeHtml_(120,'x').includes('g-fg ok')&&m.proGaugeHtml_(120,'x').includes('120%'),'120% → xanh, hiện số thật');
const C=(Math.PI*52).toFixed(1);ok(m.proGaugeHtml_(130,'x').includes('stroke-dasharray="'+C+' '+C+'"'),'130% → vòng chỉ tô tối đa 100% (không tràn)');
ok(m.proGaugeHtml_(21.2,'x').includes('g-fg bad'),'<70% → đỏ');
for(const v of [null,undefined,'','abc']) ok(m.proGaugeHtml_(v,'x').includes('—')&&!m.proGaugeHtml_(v,'x').includes('g-fg'),'pct '+JSON.stringify(v)+' → "—", không tô vòng');
ok(m.proGaugeHtml_(0,'x').includes('0%')&&!m.proGaugeHtml_(0,'x').includes('g-fg'),'0% → hiện 0%, không tô vòng');
ok(m.proGaugeHtml_(50,'<script>').includes('&lt;script&gt;')&&!m.proGaugeHtml_(50,'<script>').includes('<script>'),'escape nhãn');
// Thanh phân bố
const L=[...Array(5).fill({careStatus:'Chốt'}),...Array(3).fill({careStatus:'Đang sd'}),{careStatus:''},{}];
let b=m.proStatusBarsHtml_(L,8);
ok(b.indexOf('Chốt')<b.indexOf('Đang sd')&&b.indexOf('Đang sd')<b.indexOf('Chưa có trạng thái'),'sắp theo số khách giảm dần; trống gộp "Chưa có trạng thái"');
ok(b.includes('5 · 50%')&&b.includes('3 · 30%')&&b.includes('2 · 20%')&&b.includes('Tổng 10 khách'),'số khách + % theo TỔNG đúng');
ok(b.includes('width:100%'),'thanh dài nhất = 100%');
ok((m.proStatusBarsHtml_(Array.from({length:12},(_,i)=>({careStatus:'S'+i})),8).match(/pro-bar-row/g)||[]).length===8,'chỉ top 8');
ok(m.proStatusBarsHtml_([],8).includes('Chưa có dữ liệu'),'danh sách rỗng an toàn');
ok(m.proStatusBarsHtml_(null,8).includes('Chưa có dữ liệu'),'null an toàn');
ok(m.proStatusBarsHtml_([{careStatus:'<b>x</b>'}],8).includes('&lt;b&gt;')&&!m.proStatusBarsHtml_([{careStatus:'<b>x</b>'}],8).includes('<b>x'),'escape tình trạng CS');
let big=Array.from({length:136000},(_,i)=>({careStatus:'S'+(i%9)}));let t0=Date.now();m.proStatusBarsHtml_(big,8);ok(Date.now()-t0<400,'136k khách đếm < 400ms ('+(Date.now()-t0)+'ms)');
// Khuyến nghị
const due=[{date:'2026-10-08'},{date:'2026-10-09'},{date:'2026-10-11'},{date:'2026-10-11'},{date:'2026-10-11'}];
let r=m.proRecoItems_(due,'2026-10-11',[]);
ok(r.length===2&&r[0].n===2&&r[0].tone==='bad'&&r[0].go==='overdue'&&r[1].n===3&&r[1].go==='schedule','2 quá hạn (đỏ, trước) + 3 hôm nay');
r=m.proRecoItems_([{date:'2026-10-12'}],'2026-10-11',[]);ok(r.length===1&&r[0].n==='✓','lịch ngày mai không tính → báo xong việc');
r=m.proRecoItems_([],'2026-10-11',[]);ok(r.length===1&&r[0].n==='✓','không lịch → báo xong việc');
ok(m.proRecoItems_([{date:'2026-10-11T00:00:00'},{date:'2026-10-09T08:30:00'}],'2026-10-11',[]).map(x=>x.n).join()==='1,1','ngày có kèm giờ vẫn phân đúng quá hạn/hôm nay');
r=m.proRecoItems_(null,'2026-10-11',null);ok(r.length===1,'null an toàn');
r=m.proRecoItems_([],'2026-10-11',[{title:'Đơn kẹt >24h',count:4},{title:'rỗng',count:0}]);ok(r.length===1&&r[0].n===4&&r[0].go==='','đơn Base kẹt hiện (bỏ thẻ count=0), không có nút mở');
r=m.proRecoItems_(due,'2026-10-11',[{title:'<i>x</i>',count:1}]);ok(m.proRecoHtml_(r).includes('&lt;i&gt;')&&m.proRecoHtml_(r).includes('data-home-go="overdue"'),'escape tiêu đề việc + nút có data-home-go');
ok(m.proRecoHtml_(m.proRecoItems_(due,'2026-10-11',[])).includes('pro-next bad'),'mục quá hạn dùng pro-next bad');
// Trang chủ
const h=m.proHomeHtml_({label:'Toàn công ty',from:'2026-10-01',to:'2026-10-11',c:{pct:78.1,tyLeChot:21.2,soNguoi:3,revenue:319e6,orders:109,failed:6,ordersPerDay:9.9,aov:2926000},money:(n)=>(n/1e6)+' tr',ratingHtml:'1 tốt',barsHtml:'<i>B</i>',recoHtml:'<i>R</i>'});
ok(h.includes('id="pro-home"')&&h.includes('319 tr')&&h.includes('109')&&h.includes('pro-kpi blue')&&h.includes('78.1%')&&h.includes('21.2%')&&h.includes('3 nhân sự'),'trang chủ đủ: đồng hồ + 4 ô số + nhân sự');
ok(m.proHomeHtml_({label:'<x>',c:{}}).includes('&lt;x&gt;'),'escape nhãn phạm vi');
ok(m.proHomeHtml_({c:null,label:'a'}).includes('—'),'không có số liệu → "—", không lỗi');
// R4a: hội thoại Pancake chưa trả lời
r=m.proRecoItems_([{date:'2026-10-09'},{date:'2026-10-11'}],'2026-10-11',[],37);
ok(r.length===3&&r[2].n===37&&r[2].tone==='bad'&&r[2].go==='chat'&&r[2].text.includes('CHƯA TRẢ LỜI'),'37 hội thoại chưa trả lời → mục đỏ cuối danh sách, bấm mở tab chat');
r=m.proRecoItems_([],'2026-10-11',[],m.PRO_UNREPLIED_CAP);ok(r.length===1&&r[0].n===m.PRO_UNREPLIED_CAP+'+','chạm trần 100 → hiện "100+" (server chỉ trả tối đa 100)');
for(const v of [null,undefined,0,NaN,'abc',-3]){r=m.proRecoItems_([],'2026-10-11',[],v);ok(r.length===1&&r[0].n==='✓','unreplied '+String(v)+' → không hiện mục, vẫn báo xong việc');}
r=m.proRecoItems_([],'2026-10-11',[],5);ok(r.length===1&&r[0].n===5,'chỉ có tin chưa trả lời → KHÔNG báo "xong việc"');
r=m.proRecoItems_([],'2026-10-11',[]);ok(r.length===1&&r[0].n==='✓','không truyền tham số thứ 4 (gọi kiểu cũ) vẫn chạy');
ok(m.proRecoHtml_(m.proRecoItems_([],'2026-10-11',[],5)).includes('data-home-go="chat"'),'HTML có nút data-home-go="chat"');
ok(m.proHomeHtml_({label:'x',from:'a',to:'b',c:{},recoHtml:'<i>R</i>'}).includes('id="pro-reco-list"><i>R</i>'),'thẻ khuyến nghị có id pro-reco-list để vẽ lại riêng');
// R4b: kỳ trước + mũi tên
{
const R=m.proPrevRange_;
let x=R('2026-11-01','2026-11-15','2026-11-15');ok(x&&x.from==='2026-10-17'&&x.to==='2026-10-31'&&x.days===15,'Tháng này 1–15/11 → kỳ trước 17–31/10 (15 ngày)');
x=R('2026-11-01','2026-11-30','2026-11-15');ok(x&&x.days===15&&x.to==='2026-10-31','kỳ chọn tới 30/11 nhưng nay mới 15/11 → cắt ở hôm nay (khớp GAS effTo), KHÔNG so 30 ngày với 15 ngày');
x=R('2026-10-01','2026-10-31','2026-11-15');ok(x.from==='2026-08-31'&&x.to==='2026-09-30'&&x.days===31,'tháng 10 (31 ngày) → 31 ngày liền trước: 31/08–30/09');
ok(R('2026-11-10','2026-11-01','2026-11-15')===null&&R('abc','2026-11-01')===null,'ngày ngược/sai → null');
x=R('2026-03-01','2026-03-07','2026-11-15');ok(x.from==='2026-02-22'&&x.to==='2026-02-28','qua ranh tháng 2 (năm thường) đúng');
const D=m.proDeltaPct_;
ok(D(120,100)===20&&D(80,100)===-20&&D(100,100)===0&&D(1,3)===-66.7,'% thay đổi + làm tròn 0,1');
ok(D(5,0)===null&&D(5,null)===null&&D(null,5)===null&&D('x',5)===null,'kỳ trước 0/thiếu → null (không chia 0)');
ok(m.proDeltaPts_(32,28)===4&&m.proDeltaPts_(20.5,31)===-10.5&&m.proDeltaPts_(null,3)===null,'hiệu số điểm tỷ lệ chốt');
let h=m.proDeltaHtml_(12.3);ok(h.includes('pro-d up')&&h.includes('▲ 12,3% so kỳ trước'),'tăng → ▲ dấu phẩy VN');
h=m.proDeltaHtml_(-5);ok(h.includes('pro-d down')&&h.includes('▼ 5%'),'giảm → ▼, bỏ dấu trừ trong số');
ok(m.proDeltaHtml_(0).includes('= kỳ trước')&&m.proDeltaHtml_(null)==='','0 → "= kỳ trước"; null → rỗng');
const base={label:'x',from:'a',to:'b',recoHtml:''};
let H=m.proHomeHtml_({...base,c:{revenue:120,orders:60,ordersPerDay:2,aov:2,failed:1,tyLeChot:32},prev:{revenue:100,orders:50,ordersPerDay:2,aov:4,tyLeChot:28}});
ok(H.includes('▲ 20% so kỳ trước')&&H.includes('▼ 50% so kỳ trước')&&H.includes('4 điểm so kỳ trước'),'thẻ số hiện ▲20% doanh thu/đơn, ▼50% giá trị đơn TB, +4 điểm tỷ lệ chốt');
H=m.proHomeHtml_({...base,c:{revenue:120,orders:60,failed:1,tyLeChot:32}});
ok(!H.includes('so kỳ trước'),'chưa có kỳ trước → không hiện mũi tên (giữ giao diện cũ)');
}
// R4c: cảnh báo tụt
{
const A=m.proAlertItems_, M=(n,rev,tl,tt)=>({name:n,revenue:rev,tyLeChot:tl,tongTT:tt});
const prev=[M('An',20e6,30,100),M('Bình',10e6,30,100),M('Chi',2e6,30,100),M('Dũng',50e6,40,100),M('Em',8e6,30,10)];
const cur =[M('An',10e6,29,100),M('Bình',9e6,15,100),M('Chi',0,5,100),M('Dũng',50e6,40,100),M('Em',1e6,5,10),M('Mới',1e6,1,100)];
const r=A(cur,prev);
ok(r.length===2,'2 mục: tụt doanh số + tụt tỷ lệ chốt');
ok(r[0].n===2&&r[0].text.includes('An (−50%)')&&r[0].text.includes('Em (−87,5%)'),'tụt doanh số: An −50%, Em −87,5% (Em prev 8tr ≥ 5tr); Bình −10% và Dũng 0% KHÔNG bị báo');
ok(r[0].text.indexOf('Em')<r[0].text.indexOf('An'),'sắp nặng nhất trước');
ok(!r[0].text.includes('Chi'),'Chi kỳ trước chỉ 2tr < ngưỡng 5tr → bỏ qua dù về 0');
ok(r[1].n===2&&r[1].text.includes('Bình (−15 điểm)')&&r[1].text.includes('Chi (−25 điểm)')&&r[1].text.indexOf('Chi')<r[1].text.indexOf('Bình'),'tụt chốt: Chi −25 điểm (nặng nhất trước) + Bình −15; An −1 điểm và Dũng 0 không bị báo');
ok(!r[1].text.includes('Em')&&!r[1].text.includes('Mới'),'Em (10 tin <30) và người mới (không có kỳ trước) không bị báo chốt');
ok(A(cur,[]).length===0&&A([],prev).length===0&&A(null,null).length===0,'thiếu dữ liệu → không cảnh báo');
ok(m.proAlertItems_([M('<b>X</b>',1,1,100)],[M('<b>X</b>',9e6,1,100)])[0].text.includes('&lt;b&gt;'),'escape tên sale');
const many=Array.from({length:5},(_,i)=>M('S'+i,1e6,30,100)), pm=Array.from({length:5},(_,i)=>M('S'+i,10e6,30,100));
ok(A(many,pm)[0].n===5&&A(many,pm)[0].text.includes('…'),'>3 người → liệt kê 3 + "…" nhưng n = 5');
ok(m.proRecoItems_([],'2026-11-15',[],0,A(cur,prev)).length===2,'mục cảnh báo xuất hiện trong khuyến nghị, không còn "xong việc"');
}
process.exit(bad?1:0);

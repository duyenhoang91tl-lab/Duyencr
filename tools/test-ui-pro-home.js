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
process.exit(bad?1:0);

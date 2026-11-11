// Test: Trợ lý AI chế độ Doanh số lấy số từ BÁO CÁO B + lọc ngày (hàm thật js/38 chạy trong vm, không DOM).
// Ví dụ thật của Duyên 2026-11-09: kỳ 2026-11-01 → 2026-11-09 trước đây ra "Doanh thu 0đ · 0 đơn" (đọc từ Tổng quan).
const fs=require('fs'),vm=require('vm');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const ctx={console,AbortController,setTimeout,clearTimeout,Date};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/33-pro-profile.js','utf8')+'\n'+fs.readFileSync('js/38-pro-dock.js','utf8')+'\nthis.X={proSalesBLoad_,proSalesBBuild_,proSalesBContext_,proSalesBIntent_,proRuleSalesB_,proRuleSalesBAnswer_,proIntent_,_proDock};',ctx);
const X=ctx.X;
const dB={totalOrders:5,totalGiaTri:12500000,totalCod:9000000,bySale:[
  {name:'Thuydinh1995',orders:2,giaTri:6000000,cod:4000000},{name:'yenNTH2004',orders:2,giaTri:4500000,cod:3000000},{name:'ninhnga99',orders:1,giaTri:2000000,cod:2000000},{name:'(chưa gán sale)',orders:0,giaTri:0,cod:0}]};
let calls=[];const fetchB=async(a,p)=>{calls.push(a+':'+p.dateFrom+'>'+p.dateTo);return a==='salesReportB'?dB:{ok:false,error:'no store'};};
(async()=>{
  let r=await X.proSalesBLoad_('2026-11-01','2026-11-09',{fetchB});
  ok(r.ok&&r.B.rev===12500000&&r.B.orders===5&&r.B.aov===2500000,'B: doanh thu 12.500.000đ · 5 đơn · TB 2.500.000đ (không còn 0đ)');
  ok(r.B.rows.length===3&&r.B.rows[0].name==='Thuydinh1995','xếp theo doanh thu, bỏ dòng 0đ');
  ok(calls[0]==='salesReportB:2026-11-01>2026-11-09','gọi salesReportB đúng khoảng ngày');
  const n=calls.length;await X.proSalesBLoad_('2026-11-01','2026-11-09',{fetchB});ok(calls.length===n,'hỏi lại cùng kỳ → dùng cache, không gọi lại');
  await X.proSalesBLoad_('2026-10-01','2026-10-31',{fetchB});ok(calls.some(c=>c.includes('2026-10-01')),'đổi kỳ (Tháng trước) → gọi lại');
  const bad1=await X.proSalesBLoad_('2026-09-01','2026-09-30',{fetchB:async()=>null,errFn:()=>'Server trả về lỗi HTTP 500'});
  ok(!bad1.ok&&/500/.test(bad1.error),'lỗi GAS → báo lỗi thật, KHÔNG báo 0đ');
  const B=r.B,s=X.proRuleSalesBAnswer_('Tóm tắt doanh số kỳ này',B);
  ok(/12\.500\.000đ/.test(s)&&/5 đơn/.test(s)&&/2026-11-01 → 2026-11-09/.test(s)&&/Thuydinh1995/.test(s),'tóm tắt có số thật + kỳ + top');
  ok(/Thuydinh1995/.test(X.proRuleSalesBAnswer_('Top doanh số',B)),'hỏi top → xếp hạng');
  ok(/ninhnga99/.test(X.proRuleSalesBAnswer_('Ai cần hỗ trợ nhất và vì sao?',B)),'ai cần hỗ trợ → doanh thu thấp nhất');
  ok(/Dẫn đầu/.test(X.proRuleSalesBAnswer_('Điểm đáng chú ý nhất là gì?',B)),'điểm đáng chú ý');
  const E=X.proSalesBBuild_({totalOrders:0,totalGiaTri:0,bySale:[]},null,'2026-11-01','2026-11-09');
  ok(/Không có đơn nào/.test(X.proRuleSalesB_('summary',E)),'kỳ rỗng → báo không có đơn, gợi ý đổi kỳ');
  ok(/Thuydinh1995 \| 6\.000\.000đ \| 2/.test(X.proSalesBContext_(B)),'ngữ cảnh gửi AI có bảng theo sale');
  ok(X.proSalesBIntent_('tom tat')==='summary'&&X.proSalesBIntent_('xyz')==='','intent');
  console.log(bad?'\n'+bad+' FAIL':'\nTẤT CẢ ĐẠT');process.exit(bad?1:0);
})();

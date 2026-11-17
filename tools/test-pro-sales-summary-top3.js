#!/usr/bin/env node
// TÓM TẮT DOANH SỐ trong Trợ lý AI (js/38): top 3 tốt nhất + top 3 thấp nhất; bỏ câu "(Bảng theo sale đã cộng thêm...)" và dòng "AI: Quy tắc..." ở tóm tắt.
// Ví dụ thật của Duyên 16/11 (kỳ 2026-11-01 → 2026-11-30, 1037 đơn, đơn quầy 13.226.400đ). Chạy: node tools/test-pro-sales-summary-top3.js
const fs=require('fs'),vm=require('vm');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const src=fs.readFileSync('js/38-pro-dock.js','utf8');
const ctx={console,AbortController,setTimeout,clearTimeout,Date};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/33-pro-profile.js','utf8')+'\n'+src+'\nthis.X={proSalesBBuild_,proRuleSalesBAnswer_,proRichSalesB_,proRichHtml_,proSalesBBestWorst_,proSalesBIntent_};',ctx);
const X=ctx.X;
const d={totalOrders:1037,totalGiaTri:5415659014,totalCod:1962978000,bySale:[
 {name:'ninhnga99',orders:120,giaTri:517570167},{name:'huyenmaii1990',orders:110,giaTri:473825000},{name:'Thuydinh1995',orders:90,giaTri:344854900},
 {name:'Nguyễn Thị A',orders:60,giaTri:214008667},{name:'Trịnh Phương B',orders:50,giaTri:207034000},{name:'Sale6',orders:40,giaTri:150000000},
 {name:'Sale7',orders:30,giaTri:90000000},{name:'Sale8',orders:20,giaTri:40000000},{name:'Sale9',orders:5,giaTri:9000000},{name:'KhongDon',orders:0,giaTri:0}]};
const B=X.proSalesBBuild_(d,null,'2026-11-01','2026-11-30'); B.storeTotal=13226400; // mô phỏng có đơn quầy
const t=X.proRuleSalesBAnswer_('Tóm tắt doanh số kỳ này',B);
ok(/Top 3 doanh thu tốt nhất: 1\. ninhnga99 \(517\.570\.167đ\) · 2\. huyenmaii1990 \(473\.825\.000đ\) · 3\. Thuydinh1995 \(344\.854\.900đ\)/.test(t),'top 3 tốt nhất đúng thứ tự (đúng ví dụ ảnh)');
ok(/Top 3 doanh thu thấp nhất: 1\. Sale9 \(9\.000\.000đ\) · 2\. Sale8 \(40\.000\.000đ\) · 3\. Sale7 \(90\.000\.000đ\)/.test(t),'top 3 thấp nhất: tăng dần, bỏ sale 0 đơn');
ok(!/Bảng theo sale|đơn quầy|13\.226\.400/.test(t),'đã bỏ câu "Bảng theo sale đã cộng thêm phần sale đơn quầy"');
ok(/Doanh thu 5\.415\.659\.014đ · 1037 đơn/.test(t)&&/COD 1\.962\.978\.000đ/.test(t),'vẫn giữ dòng tổng doanh thu/đơn/TB/COD');
ok(/Bảng theo sale đã cộng thêm phần sale đơn quầy/.test(X.proRuleSalesBAnswer_('Top doanh số',B)),'các câu hỏi khác (top) KHÔNG đổi: vẫn có ghi chú đơn quầy');
// biểu đồ thanh
const rich=X.proRichSalesB_('summary',B), items=rich.bars.items, hd=items.filter(x=>x.heading).map(x=>x.heading);
ok(hd.length===2&&items.length===8,'biểu đồ: 2 tiêu đề + 3 + 3 thanh');
ok(items[1].label==='ninhnga99'&&items[5].label==='Sale9','biểu đồ: nhóm cao nhất rồi nhóm thấp nhất');
const html=X.proRichHtml_(rich);
ok((html.match(/pro-rich-bar"/g)||[]).length===6&&(html.match(/pro-rich-hd/g)||[]).length===2,'HTML: 6 thanh + 2 tiêu đề');
ok(/style="width:100%"/.test(html),'thanh dài nhất = 100% (tiêu đề không làm hỏng phép tính max)');
// ít sale
const few=X.proSalesBBuild_({totalOrders:3,totalGiaTri:9e6,bySale:[{name:'A',orders:1,giaTri:5e6},{name:'B',orders:1,giaTri:3e6},{name:'C',orders:1,giaTri:1e6}]},null,'a','b');
const tf=X.proRuleSalesBAnswer_('Tóm tắt',few); ok(/tốt nhất/.test(tf)&&!/thấp nhất/.test(tf),'≤3 sale: chỉ có nhóm tốt nhất, không lặp người sang nhóm thấp nhất');
const five=X.proSalesBBuild_({totalOrders:5,totalGiaTri:9e6,bySale:[1,2,3,4,5].map(i=>({name:'S'+i,orders:1,giaTri:(6-i)*1e6}))},null,'a','b');
const bw=X.proSalesBBestWorst_(five.rows); ok(bw.best.length===3&&bw.worst.length===2&&bw.worst[0].name==='S5','5 sale: thấp nhất chỉ gồm 2 người còn lại, không trùng top 3');
const emp=X.proRuleSalesBAnswer_('Tóm tắt',X.proSalesBBuild_({totalOrders:0,totalGiaTri:0,bySale:[]},null,'a','b')); ok(/Không có đơn nào/.test(emp),'kỳ rỗng vẫn báo không có đơn');
// dòng "AI: Quy tắc · Báo cáo B" ở tóm tắt
ok(/provider: proSalesBIntent_\(question\)==='summary' \? '' : 'Quy tắc · Báo cáo B/.test(src),'tóm tắt không gắn provider → dòng "AI: ..." không hiện');
ok(/m\.provider\?'<div class="pro-ai-by">/.test(src),'dòng "AI:" chỉ in khi provider khác rỗng');
console.log(bad?('FAIL '+bad):'TẤT CẢ QUA'); process.exit(bad?1:0);

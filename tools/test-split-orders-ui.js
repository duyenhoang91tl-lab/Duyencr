// Test giao diện Đơn chia (js/50): "Danh sách đơn chia" ở lọc nguồn dữ liệu + Báo cáo M — code thật bằng jsdom. Chạy: node tools/test-split-orders-ui.js (cần jsdom)
const {JSDOM}=require('jsdom');const fs=require('fs'),path=require('path');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const R=f=>path.join(__dirname,'..',f),read=f=>fs.readFileSync(R(f),'utf8');
function fn(code,name){const i=code.indexOf('function '+name+'(');if(i<0)throw new Error('thiếu '+name);let d=0,j=code.indexOf('{',i);for(let k=j;k<code.length;k++){if(code[k]=='{')d++;else if(code[k]=='}'){d--;if(!d)return code.slice(i,k+1)}}}
const dom=new JSDOM('<!doctype html><html class="ui-pro"><body><div id="dp-overlay"></div><div id="tab-list"><div class="toolbar">TB</div><div id="cust">list</div></div></body></html>',{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,reqs=[];
const s10=read('js/10-fn-pkkpipct.js'),s16=read('js/16-main-currentuser.js');
w.eval(s16.slice(s16.indexOf('var _PK_QUICK_RANGES'),s16.indexOf('];',s16.indexOf('var _PK_QUICK_RANGES'))+2)+'\n'+['_ymd'].map(()=>'function _ymd(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}').join('')+'\n'+fn(s10,'_pkQuickRange')+'\n'+fn(s10,'_quickRangeSelectHtml'));
const D1={ok:true,from:'2026-10-01',to:'2026-10-31',all:false,truncated:false,summary:{orders:2,customers:2,revenue:2600000,value:4000000},items:[{phone:'0911000003',name:'Khách 3',date:'05/10/2026',product:'Combo C',value:3000000,share:2100000,frac:0.7,withSales:['Chi']},{phone:'0911000001',name:'Khách <b>1</b>',date:'02/10/2026',product:'Combo A',value:1000000,share:500000,frac:0.5,withSales:['Bình']}]};
let resp=D1;
w.eval('var gsUrl="https://gs.example/exec"; var allCustomers=[{phone:"0911000003"},{phone:"911000001"},{phone:"0999999999"}]; var _filters=0; function applyFilters(){_filters++} var _opened=[]; function openDp(p){_opened.push(p)}; var _srState={lastFetchError:"",sub:"M",loading:false}; var _fetched=[]; async function _srFetch(a,p){_fetched.push([a,p]);return window.__rep||null}; function _srApplyQuickRange(){}; function _srLoad(){}; var _csv=[]; function _srGDownloadCsv_(f,r){_csv.push([f,r])}; function toast(){}');
w.fetch=async(u)=>{reqs.push(u);return {json:async()=>resp}};
w.eval(read('js/50-split-orders.js'));
const $=id=>w.document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
// — hàm thuần —
ok(w.splitPhoneKey_('+84 911.000.001')==='0911000001'&&w.splitPhoneKey_('911000001')==='0911000001'&&w.splitPhoneKey_('')==='','chuẩn hoá SĐT (+84 / thiếu 0 / rỗng)');
const html=w.splitBannerHtml_(D1,{quick:'thisMonth',from:'',to:'',loading:false});
ok(html.includes('Danh sách đơn chia')&&html.includes('các đơn bạn được sale khác chia')&&html.includes('>2<')&&html.includes('2.600.000₫')&&html.includes('4.000.000₫'),'banner: tiêu đề + số đơn chia 2 + doanh thu từ đơn chia 2.600.000₫ + giá trị gốc 4.000.000₫');
ok(html.includes('Phần của bạn')&&html.includes('Chia cùng')&&html.includes('70%')&&html.includes('Chi')&&html.includes('Bình'),'chi tiết: cột "Phần của bạn" (70%) và "Chia cùng" (Chi / Bình)');
ok(html.includes('Khách &lt;b&gt;1&lt;/b&gt;')&&!html.includes('<b>1</b>'),'escape tên khách (chống chèn HTML)');
ok(html.includes('Hôm nay')&&html.includes('Tuần trước')&&html.includes('Tháng trước')&&html.includes('Quý này')&&html.includes('Năm này'),'bộ lọc kỳ trong banner có ĐỦ mốc nhanh (Hôm nay … Năm này)');
ok(w.splitBannerHtml_(Object.assign({},D1,{all:true}),{quick:'thisMonth'}).includes('tất cả đơn chia (Admin/CEO)'),'Admin/CEO: nhãn "tất cả đơn chia"');
ok(w.splitBannerHtml_(null,{loading:true}).includes('Đang tải')&&w.splitBannerHtml_({ok:false,error:'Can dang nhap'},{}).includes('⚠ Can dang nhap')&&w.splitBannerHtml_(Object.assign({},D1,{items:[],summary:{orders:0,customers:0,revenue:0,value:0}}),{}).includes('Không có đơn chia'),'trạng thái: đang tải / lỗi / không có đơn');
ok(w.splitBannerHtml_(Object.assign({},D1,{truncated:true}),{}).includes('thu hẹp khoảng ngày'),'quá 3000 đơn: báo đang cắt bớt');
(async()=>{
 // — luồng banner —
 w.splitBannerSync_('all');ok(!$('split-banner'),'mục nguồn khác: không tạo banner');
 w.splitBannerSync_('split');await sleep(40);
 const el=$('split-banner');ok(el&&el.style.display!=='none'&&el.previousElementSibling.className==='toolbar','chọn "Danh sách đơn chia": banner xuất hiện ngay dưới thanh công cụ');
 ok(reqs.length===1&&reqs[0].includes('action=splitOrderMine')&&/dateFrom=\d{4}-\d\d-01/.test(reqs[0])&&/dateTo=\d{4}-\d\d-\d\d/.test(reqs[0]),'tự tải lần đầu, kỳ mặc định = THÁNG NÀY (từ ngày 01)');
 ok(el.textContent.includes('2.600.000₫')&&w.eval('_filters')>=1,'tải xong: banner có số liệu + lọc lại danh sách khách');
 ok(w.splitCustomerPass_({phone:'0911000003'})&&w.splitCustomerPass_({phone:'911000001'})&&!w.splitCustomerPass_({phone:'0999999999'}),'lọc khách: giữ khách có đơn chia (kể cả SĐT lệch định dạng), bỏ khách khác');
 w.splitBannerSync_('split');await sleep(10);ok(reqs.length===1,'áp lọc lại nhiều lần không gọi server lại (đã tải)');
 w.splitBannerSync_('dt');ok($('split-banner').style.display==='none','chuyển sang nguồn khác: ẩn banner');
 // đổi kỳ
 w.splitBannerSync_('split');w.splitSetQuick_('lastMonth');await sleep(40);
 const lm=w.eval('_pkQuickRange("lastMonth")');ok(reqs.length===2&&reqs[1].includes('dateFrom='+lm.from)&&reqs[1].includes('dateTo='+lm.to),'chọn "Tháng trước": gọi lại đúng khoảng ngày');
 w.splitSetQuick_('custom');ok($('split-from')&&$('split-to'),'chọn "Tuỳ chỉnh": hiện 2 ô ngày + nút Xem');
 // bấm dòng → mở hồ sơ
 w.splitSetQuick_('thisMonth');await sleep(40);
 const tr=$('split-banner').querySelector('[data-split-phone="0911000001"]');tr.click();ok(w.eval('_opened').join()==='911000001'&&$('dp-overlay').classList.contains('open'),'bấm 1 dòng chi tiết → mở hồ sơ đúng khách (khớp SĐT lệch định dạng)');
 // lỗi
 resp={ok:false,code:'AUTH',error:'Can dang nhap (tai khoan that) de xem don chia.'};w.splitSetQuick_('today');await sleep(40);
 ok($('split-banner').textContent.includes('Can dang nhap')&&!w.splitCustomerPass_({phone:'0911000003'}),'lỗi AUTH: banner báo lý do, KHÔNG hiện khách nào');
 w.fetch=async()=>{throw new Error('net')};w.splitSetQuick_('yesterday');await sleep(40);ok($('split-banner').textContent.includes('Không tải được'),'mất mạng: báo lỗi, không treo');
 // — Báo cáo M —
 const REP={ok:true,from:'2026-10-01',to:'2026-10-15',scope:'all',total:{orders:6,revenue:8300000,aov:1383333,splitOrders:3,splitRevenue:4300000,splitValue:5000000,splitAov:1433333,splitPctOrders:50,splitPctRevenue:51.8},warnings:[],
  bySale:[{name:'An',orders:3,revenue:4600000,aov:1533333,splitOrders:2,splitRevenue:2600000,splitAov:1300000,splitPct:56.5},{name:'Chi',orders:2,revenue:1050000,aov:525000,splitOrders:2,splitRevenue:1050000,splitAov:525000,splitPct:100},{name:'Dung <i>',orders:1,revenue:800000,aov:800000,splitOrders:0,splitRevenue:0,splitAov:0,splitPct:0}]};
 const mh=w.splitReportHtml_(REP,'');
 ok(mh.includes('Tổng số đơn (thực tế)')&&mh.includes('>6<')&&mh.includes('8.300.000₫')&&mh.includes('1.383.333₫'),'M·KPI trên cùng như báo cáo doanh số: tổng đơn thực tế 6, doanh thu 8.300.000₫, TB đơn 1.383.333₫');
 ok(mh.includes('Số đơn chia')&&mh.includes('50% tổng số đơn')&&mh.includes('4.300.000₫')&&mh.includes('51,8% doanh thu')&&mh.includes('TB đơn chia'),'M·KPI đơn chia: 3 đơn (50%), doanh thu 4.300.000₫ (51,8%), TB đơn chia');
 ok(['Sale','Tổng đơn','Doanh thu','TB/đơn','Số đơn chia','Doanh thu từ đơn chia','TB/đơn chia','% doanh thu từ đơn chia'].every(h=>mh.includes('<th'+(h==='Sale'?'':' class="r"')+'>'+h+'</th>')),'M·bảng theo từng sale có đủ 8 cột yêu cầu');
 ok(mh.includes('2.600.000₫')&&mh.includes('1.300.000₫')&&mh.includes('56,5%')&&mh.includes('Dung &lt;i&gt;'),'M·dòng An: DT chia 2.600.000₫, TB 1.300.000₫, 56,5%; escape tên');
 ok(mh.includes('Tổng (cộng theo từng sale)')&&mh.includes('4.450.000₫')===false&&mh.includes('3.650.000₫'),'M·dòng tổng cộng theo sale (DT chia 2,6tr+1,05tr = 3.650.000₫)');
 ok(w.splitReportHtml_(REP,'chi').includes('<b>Chi</b>')&&!w.splitReportHtml_(REP,'chi').includes('<b>An</b>'),'M·ô tìm tên sale lọc dòng');
 ok(w.splitReportHtml_({ok:false,error:'Ban khong co quyen'},'').includes('Ban khong co quyen')&&w.splitReportHtml_(null,'').includes('Chưa có dữ liệu'),'M·lỗi / chưa có dữ liệu: báo rõ');
 ok(w.splitReportHtml_(Object.assign({},REP,{scope:'scoped'}),'').includes('phạm vi của bạn'),'M·người không phải Admin/CEO: ghi chú "phạm vi của bạn"');
 const csv=w.splitCsvRows_(REP);ok(csv[0].length===8&&csv.length===5&&csv[4][0]==='TỔNG THỰC TẾ'&&csv[4][1]===6,'M·CSV: tiêu đề 8 cột + dòng tổng thực tế');
 // render + tải
 const wrap=w.document.createElement('div');w.document.body.appendChild(wrap);w.__rep=REP;w.eval('_srState.mDateQuick="lastWeek"');await w.splitReportLoad_();
 const f=w.eval('_fetched').pop(),lw=w.eval('_pkQuickRange("lastWeek")');ok(f[0]==='splitOrderReport'&&f[1].dateFrom===lw.from&&f[1].dateTo===lw.to&&w.eval('_srState.dataM')===REP,'M·tải: gọi splitOrderReport đúng khoảng ngày "Tuần trước" và lưu kết quả');
 w.renderSalesReportTabM_(wrap,'<select id="sub"></select>');ok(wrap.querySelector('#sub')&&wrap.querySelector('#sr-m-body table')&&wrap.innerHTML.includes('Hôm qua')&&wrap.innerHTML.includes('⬇ CSV'),'M·màn hình: có chọn báo cáo + bộ lọc ngày nhanh đủ mốc + bảng + nút CSV');
 w.eval('_srState.loading=true');w.renderSalesReportTabM_(wrap,'');ok(wrap.textContent.includes('Đang tải'),'M·đang tải: hiện "Đang tải…"');w.eval('_srState.loading=false');
 w.eval('_srMExportCsv_()');ok(w.eval('_csv').length===1&&w.eval('_csv')[0][0].startsWith('Bao-cao-don-chia_2026-10-01'),'M·xuất CSV đúng tên file + dữ liệu');
 // — nối dây —
 const idx=read('index.html'),s02=read('js/02-fn-showrowerrorbanner.js'),s06=read('js/06-main-renew-sources.js'),s11=read('js/11-fn-srload.js');
 ok(idx.includes('<option value="split">Danh sách đơn chia')&&idx.indexOf('js/50-split-orders.js')>idx.indexOf('js/49-pro-discuss.js'),'index.html: có mục "Danh sách đơn chia" trong lọc nguồn dữ liệu + nạp js/50');
 ok(s02.includes("splitBannerSync_(dataSrcF)")&&s02.includes("dataSrcF === 'split' && !(typeof splitCustomerPass_ === 'function' && splitCustomerPass_(c))"),'js/02: applyFilters gọi banner + điều kiện lọc split');
 ok(/\['M','Báo cáo M – Tổng quan đơn chia'\]\];/.test(s06),'js/06: Báo cáo M nằm trong danh sách báo cáo (Admin bật/tắt/đổi tên được)');
 ok(s11.includes("_srState.sub === 'M') {\n    // Tổng quan đơn chia")&&s11.includes("if (_srState.sub === 'M') { renderSalesReportTabM_(wrap, subTabs); return; }"),'js/11: _srLoad có nhánh M + renderSalesReportTab điều hướng sang màn M');
 process.exit(bad?1:0);
})();

// Test giao diện Đơn chia (js/50): "Danh sách đơn chia" ở lọc nguồn dữ liệu + Báo cáo M — code thật bằng jsdom. Chạy: node tools/test-split-orders-ui.js (cần jsdom)
const {JSDOM}=require('jsdom');const fs=require('fs'),path=require('path');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const R=f=>path.join(__dirname,'..',f),read=f=>fs.readFileSync(R(f),'utf8');
function fn(code,name){const i=code.indexOf('function '+name+'(');if(i<0)throw new Error('thiếu '+name);let d=0,j=code.indexOf('{',i);for(let k=j;k<code.length;k++){if(code[k]=='{')d++;else if(code[k]=='}'){d--;if(!d)return code.slice(i,k+1)}}}
const dom=new JSDOM('<!doctype html><html class="ui-pro"><body><div id="dp-overlay"></div><div id="tab-list"><div class="toolbar">TB</div><div id="cust">list</div></div></body></html>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://x.test/'});
const w=dom.window,reqs=[];
const s10=read('js/10-fn-pkkpipct.js'),s16=read('js/16-main-currentuser.js');
w.eval(s16.slice(s16.indexOf('var _PK_QUICK_RANGES'),s16.indexOf('];',s16.indexOf('var _PK_QUICK_RANGES'))+2)+'\n'+['_ymd'].map(()=>'function _ymd(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}').join('')+'\n'+fn(s10,'_pkQuickRange')+'\n'+fn(s10,'_quickRangeSelectHtml'));
const D1={ok:true,from:'2026-10-01',to:'2026-10-31',all:false,truncated:false,summary:{orders:2,customers:2,revenue:2600000,value:4000000},items:[{phone:'0911000003',name:'Khách 3',date:'05/10/2026',product:'Combo C',value:3000000,share:2100000,frac:0.7,withSales:['Chi']},{phone:'0911000001',name:'Khách <b>1</b>',date:'02/10/2026',product:'Combo A',value:1000000,share:500000,frac:0.5,withSales:['Bình']}]};
let resp=D1;
w.eval('var gsUrl="https://gs.example/exec"; var allCustomers=[{phone:"0911000003"},{phone:"911000001"},{phone:"0999999999"}]; var _filters=0; function applyFilters(){_filters++} var _opened=[]; function openDp(p){_opened.push(p)}; var _srState={lastFetchError:"",sub:"M",loading:false}; var _fetched=[]; async function _srFetch(a,p){_fetched.push([a,p]);return window.__rep||null}; function _srApplyQuickRange(){}; function _srLoad(){}; var _csv=[]; function _srGDownloadCsv_(f,r){_csv.push([f,r])}; function toast(){}');
w.fetch=async(u)=>{reqs.push(u);return {json:async()=>resp}};
const s13=read('js/13-fn-bpseedofficialonlinetemplate.js');
w.eval("var currentUser={name:'Tester',role:'admin'}; var teams=[]; var _srSidebarHtml=''; var _srSidebarHidden=false; function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;')} function _srSubSelectHtml_(){return '<select id=\"sub\"></select>'} function _srbMenuHTML_(){return '<div id=\"menu\"></div>'} var _SRB_COMBO_CFG={}; function _srbIsLeaderScope_(){return false} function _srSetField(){} function _srApply(){} function splitDetailPanelHtml_X(){}");
w.eval(['_srbMenuCats_','_srbSubCfg_','_srBarHtml_'].map(n=>fn(s13,n)).join('\n'));
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
 const REP={ok:true,from:'2026-10-01',to:'2026-10-15',scope:'all',total:{orders:6,revenue:8300000,aov:1383333,splitOrders:3,splitRevenue:4300000,splitValue:5000000,splitAov:1433333,splitPctOrders:50,splitPctRevenue:51.8},warnings:[],detailTruncated:false,
  bySale:[{name:'An',orders:3,revenue:4600000,aov:1533333,splitOrders:2,splitRevenue:2600000,splitAov:1300000,splitPct:56.5},{name:'Chi',orders:2,revenue:1050000,aov:525000,splitOrders:2,splitRevenue:1050000,splitAov:525000,splitPct:100},{name:'Dung <i>',orders:1,revenue:800000,aov:800000,splitOrders:0,splitRevenue:0,splitAov:0,splitPct:0}],
  detail:[{date:'07/10/2026',name:'Khách 4',phone:'0911000004',nguon:'Quầy',product:'Quầy',value:1000000,sales:[{name:'Bình',share:150000},{name:'Chi',share:150000}],others:[]},
   {date:'05/10/2026',name:'Khách 3 <b>',phone:'0911000003',nguon:'Facebook',product:'Combo C',value:3000000,sales:[{name:'An',share:2100000},{name:'Chi',share:900000}],others:[]},
   {date:'02/10/2026',name:'Khách 1',phone:'0911000001',nguon:'Facebook',product:'Combo A',value:1000000,sales:[{name:'An',share:500000}],others:['Bình']}]};
 const mh=w.splitReportHtml_(REP,'','');
 ok(mh.includes('Tổng số đơn (thực tế)')&&mh.includes('>6<')&&mh.includes('8.300.000₫')&&mh.includes('1.383.333₫'),'M·KPI trên cùng như báo cáo doanh số: tổng đơn thực tế 6, doanh thu 8.300.000₫, TB đơn 1.383.333₫');
 ok(mh.includes('Số đơn chia')&&mh.includes('50% tổng số đơn')&&mh.includes('4.300.000₫')&&mh.includes('51,8% doanh thu')&&mh.includes('TB đơn chia'),'M·KPI đơn chia: 3 đơn (50%), doanh thu 4.300.000₫ (51,8%), TB đơn chia');
 ok(['Sale','Tổng đơn','Doanh thu','TB/đơn','Số đơn chia','Doanh thu từ đơn chia','TB/đơn chia','% doanh thu từ đơn chia'].every(h=>mh.includes('>'+h+'</th>')),'M·bảng theo từng sale có đủ 8 cột yêu cầu');
 ok(mh.includes('2.600.000₫')&&mh.includes('1.300.000₫')&&mh.includes('56,5%')&&mh.includes('Dung &lt;i&gt;'),'M·dòng An: DT chia 2.600.000₫, TB 1.300.000₫, 56,5%; escape tên');
 ok(mh.includes('Tổng (cộng theo từng sale)')&&mh.includes('3.650.000₫'),'M·dòng tổng cộng theo sale (DT chia 2,6tr+1,05tr = 3.650.000₫)');
 ok(mh.includes('data-m-sale="An"'),'M·(phiên đối soát) dòng sale vẫn bấm được để mở chi tiết đối soát Base/Pos');
 const dh=w.splitReportDetailHtml_(REP,'','',300);
 ok(dh.includes('Danh sách đơn chia trong kỳ')&&dh.includes('3 đơn')&&dh.includes('Khách 4')&&dh.includes('Bình: 150.000₫; Chi: 150.000₫')&&dh.includes('Facebook'),'M·danh sách chi tiết: 3 đơn chia, có kênh, "tên: phần" từng sale (Bình 150.000₫, Chi 150.000₫)');
 ok(dh.includes('Khách 3 &lt;b&gt;')&&!dh.includes('Khách 3 <b>'),'M·chi tiết: escape tên khách');
 ok(w.splitDetailFilter_(REP.detail,'','facebook').length===2&&w.splitDetailFilter_(REP.detail,'','0911000004').length===1&&w.splitDetailFilter_(REP.detail,'','combo c').length===1&&w.splitDetailFilter_(REP.detail,'','binh').length===0&&w.splitDetailFilter_(REP.detail,'','Bình').length===2,'M·ô tìm trong chi tiết: theo kênh / SĐT / sản phẩm / tên sale (kể cả "chia cùng")');
 ok(w.splitReportHtml_(REP,'chi','').includes('data-m-sale="Chi"')&&!w.splitReportHtml_(REP,'chi','').includes('data-m-sale="An"'),'M·ô tìm lọc dòng sale');
 ok(w.splitReportDetailHtml_(Object.assign({},REP,{detailTruncated:true}),'','',300).includes('thu hẹp khoảng ngày'),'M·chi tiết bị cắt (>1500 đơn): báo rõ, bảng theo sale vẫn đủ');
 ok(w.splitReportDetailHtml_(Object.assign({},REP,{detail:[]}),'','',300).includes('Không có đơn chia nào khớp'),'M·không có đơn chia: báo rõ');
 ok(w.splitReportHtml_({ok:false,error:'Ban khong co quyen'},'','').includes('Ban khong co quyen')&&w.splitReportHtml_(null,'','').includes('Chưa có dữ liệu'),'M·lỗi / chưa có dữ liệu: báo rõ');
 ok(w.splitReportHtml_(Object.assign({},REP,{scope:'scoped'}),'','').includes('phạm vi của bạn'),'M·người không phải Admin/CEO: ghi chú "phạm vi của bạn"');
 ok(!w.splitMBodyHtml_({ok:false,error:'x'},'',null).includes('Danh sách đơn chia trong kỳ')&&w.splitMBodyHtml_(REP,'',null).includes('Danh sách đơn chia trong kỳ'),'M·thân báo cáo: chỉ hiện danh sách chi tiết khi có dữ liệu');
 const csv=w.splitCsvRows_(REP);ok(csv[0].length===8&&csv.length===5&&csv[4][0]==='TỔNG THỰC TẾ'&&csv[4][1]===6,'M·CSV tổng hợp: tiêu đề 8 cột + dòng tổng thực tế');
 const dcsv=w.splitDetailCsvRows_(REP,'','');ok(dcsv.length===4&&dcsv[0].length===7&&dcsv[1][0]==='07/10/2026'&&dcsv[2][6]==='An: 2100000; Chi: 900000'&&dcsv[3][6]==='An: 500000; Bình','M·CSV chi tiết: tiêu đề 7 cột, 3 đơn, "tên: phần" từng sale');
 ok(w.splitDetailCsvRows_(REP,'','facebook').length===3,'M·CSV chi tiết theo ô tìm đang gõ: lọc còn 2 đơn Facebook');
 // thanh lọc CHUNG (hàm thật js/13) với báo cáo M
 w.eval('_srState.sub="M"; _srState.saleBOptions=["An","Bình","Chi"]; _srState.nguonOptions=["Facebook","Zalo","Quầy"]; _srState.leaderTeamOptions=["An","Bình"];');
 w.eval('_srIsAdmin=function(){return window.__admin!==false}; _srbIsLeaderScope_=function(){return !!window.__leader}');
 w.__admin=true;const cats=JSON.parse(w.eval('JSON.stringify(_srbMenuCats_().map(function(c){return {key:c.key,label:c.label,state:c.stateKey,opts:c.opts?c.opts():null}}))'));
 ok(cats.map(c=>c.key).join()==='sale,mNguon'&&cats[0].state==='mSale'&&cats[0].opts.join()==='An,Bình,Chi'&&cats[1].state==='mNguon'&&cats[1].opts.join()==='Facebook,Zalo,Quầy','M·menu Bộ lọc (Admin): Sale (mSale, đủ danh sách sale) + Kênh bán (mNguon, đủ danh sách nguồn đơn)');
 w.__admin=false;w.__leader=true;const cl=JSON.parse(w.eval('JSON.stringify(_srbMenuCats_().map(function(c){return {key:c.key,label:c.label,opts:c.opts?c.opts():null}}))'));
 ok(cl[0].key==='sale'&&cl[0].label.includes('team')&&cl[0].opts.join()==='An,Bình','M·Trưởng team: lọc sale chỉ trong team mình');
 w.__leader=false;const cn=JSON.parse(w.eval('JSON.stringify(_srbMenuCats_().map(function(c){return c.key}))'));ok(cn.join()==='mNguon','M·nhân viên: không có lọc Sale (server tự giới hạn), chỉ còn lọc Kênh');
 w.__admin=true;const cfg=w.eval('_srbSubCfg_()');
 ok(cfg.date.join()==='mDateQuick,mDateFrom,mDateTo'&&cfg.lockKey==='mSale'&&cfg.tasks.join('').includes("_srMExportCsv_('summary')")&&cfg.tasks.join('').includes("_srMExportCsv_('detail')")&&cfg.tasks.join('').includes('exportSalesReportToSheet()')&&cfg.tasks.join('').includes('sr-export-sheet-btn'),'M·menu ⚙ Tác vụ (Admin): CSV tổng hợp + CSV chi tiết + 📤 Xuất ra Sheet');
 w.__admin=false;ok(!w.eval('_srbSubCfg_()').tasks.join('').includes('exportSalesReportToSheet()')&&w.eval('_srbSubCfg_()').tasks.join('').includes("_srMExportCsv_('detail')"),'M·nhân viên: có CSV nhưng KHÔNG có nút xuất Sheet (chỉ Admin)');
 w.__admin=true;
 // render + tải
 const wrap=w.document.createElement('div');w.document.body.appendChild(wrap);w.__rep=REP;w.eval('_srState.mDateQuick="lastWeek"; _srState.mSale=["An"]; _srState.mNguon=["Facebook","Zalo"]; function getSetting_X(){}');await w.splitReportLoad_();
 const fl=w.eval('_fetched'),f=fl.filter(x=>x[0]==='splitOrderReport').pop(),lw=w.eval('_pkQuickRange("lastWeek")');ok(f&&f[1].dateFrom===lw.from&&f[1].dateTo===lw.to&&f[1].sale==='An'&&f[1].nguon==='Facebook,Zalo'&&w.eval('_srState.dataM')===REP,'M·tải: gọi splitOrderReport kèm khoảng ngày "Tuần trước" + sale + kênh đã chọn');
 w.eval('_srState.mSale=[];_srState.mNguon=[];_srState.mSearch="";_srState.mSel=null');
 w.renderSalesReportTabM_(wrap,'');
 ok(wrap.querySelector('.srb-bar')&&wrap.querySelector('#sub')&&wrap.innerHTML.includes('Hôm qua')&&wrap.innerHTML.includes('Quý trước')&&wrap.innerHTML.includes('Tác vụ'),'M·màn hình dùng thanh lọc CHUNG: chọn báo cáo + ngày nhanh đủ mốc + 🔎 Bộ lọc + Lọc + ⚙ Tác vụ');
 ok(wrap.querySelector('#sr-m-search')&&wrap.innerHTML.includes('Excel đối soát TẤT CẢ sale')&&wrap.querySelector('#sr-m-body table.split-dtl'),'M·giữ nút "Excel đối soát TẤT CẢ sale" của phiên đối soát + ô tìm + bảng chi tiết');
 wrap.querySelectorAll('.split-dtl tbody tr')[2].click();ok(w.eval('_opened').pop()==='911000001','M·bấm 1 dòng chi tiết → mở hồ sơ đúng khách (khớp SĐT lệch định dạng)');
 w.eval('_srState.mSearch="zzz"');w.eval('_srMRerender_()');ok(wrap.querySelector('#sr-m-body').textContent.includes('Không có đơn chia nào khớp'),'M·tìm không có kết quả: báo rõ');w.eval('_srState.mSearch=""');
 w.eval('_srState.loading=true');w.renderSalesReportTabM_(wrap,'');ok(wrap.textContent.includes('Đang tải'),'M·đang tải: hiện "Đang tải…"');w.eval('_srState.loading=false');
 w.eval('_srMExportCsv_("summary")');w.eval('_srState.mSearch="facebook"');w.eval('_srMExportCsv_("detail")');
 const csvs=w.eval('_csv');ok(csvs.length===2&&csvs[0][0].startsWith('Bao-cao-don-chia_2026-10-01')&&csvs[1][0].startsWith('Chi-tiet-don-chia_2026-10-01')&&csvs[1][1].length===3,'M·xuất 2 CSV: tổng hợp + chi tiết (theo ô tìm đang gõ: 2 đơn + dòng tiêu đề)');
 w.eval('_srState.mSearch=""');
 // xuất Sheet
 w.eval('_srState.mDateFrom="2026-10-01";_srState.mDateTo="2026-10-15";_srState.mSale=["An"];_srState.mNguon=["Facebook"]');w.localStorage.setItem('ome_sess_token','TOK');
 const posts=[];w.fetch=async(u,o)=>{posts.push({u,o});return {json:async()=>({ok:true,tabName:'BC_M_20261015_101500',sheetUrl:'https://sheet.test/#gid=77'})}};const alerts=[];w.alert=m=>alerts.push(m);
 await w.splitExportSheet_();const pb=JSON.parse(posts[0].o.body);
 ok(posts[0].o.method==='POST'&&pb.action==='exportSplitOrderSheet'&&pb.token==='TOK'&&pb.dateFrom==='2026-10-01'&&pb.dateTo==='2026-10-15'&&pb.sale.join()==='An'&&pb.nguon.join()==='Facebook'&&alerts[0].includes('BC_M_20261015_101500')&&alerts[0].includes('https://sheet.test/#gid=77'),'M·xuất Sheet: POST đúng action/token/ngày/sale/kênh + báo tên tab và link');
 w.fetch=async()=>({json:async()=>({ok:false,error:'Chi Admin duoc xuat'})});await w.splitExportSheet_();ok(alerts.pop().includes('Chi Admin duoc xuat'),'M·xuất Sheet lỗi: hiện lý do từ server');
 // — nối dây —
 const idx=read('index.html'),s02=read('js/02-fn-showrowerrorbanner.js'),s06=read('js/06-main-renew-sources.js'),s11=read('js/11-fn-srload.js');
 ok(idx.includes('<option value="split">Danh sách đơn chia')&&idx.indexOf('js/50-split-orders.js')>idx.indexOf('js/49-pro-discuss.js'),'index.html: có mục "Danh sách đơn chia" trong lọc nguồn dữ liệu + nạp js/50');
 ok(s02.includes("splitBannerSync_(dataSrcF)")&&s02.includes("dataSrcF === 'split' && !(typeof splitCustomerPass_ === 'function' && splitCustomerPass_(c))"),'js/02: applyFilters gọi banner + điều kiện lọc split');
 ok(/\['M','Báo cáo M – Tổng quan đơn chia'\](,\['[A-Z]','[^']+'\])*\];/.test(s06),   // M khong con la bao cao CUOI (da co N — Tinh don thuan)
    'js/06: Báo cáo M nằm trong danh sách báo cáo (Admin bật/tắt/đổi tên được)');
 ok(s11.includes("_srState.sub === 'M') {\n    // Tổng quan đơn chia")&&s11.includes("if (_srState.sub === 'M') { renderSalesReportTabM_(wrap, subTabs); return; }"),'js/11: _srLoad có nhánh M + renderSalesReportTab điều hướng sang màn M');
 ok(s11.includes("if (_srState.sub === 'M') return splitExportSheet_();"),'js/11: nút "Xuất ra Sheet" chung chuyển sang splitExportSheet_ khi đang ở báo cáo M');
 process.exit(bad?1:0);
})();

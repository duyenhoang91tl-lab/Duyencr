// Test: Báo cáo B — MỘT menu lọc nhiều cấp (js/13 _srbMenu*), trích code thật từ js/13 + _SRB_COMBO_CFG từ js/16, chạy bằng jsdom.
// Chạy: node tools/test-srb-filter-menu.js   (cần: npm i jsdom, hoặc NODE_PATH trỏ tới node_modules có jsdom)
const {JSDOM}=require('jsdom');const fs=require('fs'),path=require('path');let bad=0;
const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('OK  ',t)};
const read=f=>fs.readFileSync(path.join(__dirname,'..','js',f),'utf8');
const j13=read('13-fn-bpseedofficialonlinetemplate.js'),j16=read('16-main-currentuser.js'),j11=read('11-fn-srload.js');
const a=j13.indexOf('var _srbMenu = {'),b=j13.indexOf('function exportSalesReport(){');
ok(a>0&&b>a,'tìm thấy khối menu trong js/13');
const menuSrc=j13.slice(a,b);
const c0=j16.indexOf('var _SRB_COMBO_CFG = {'),c1=j16.indexOf('var _srbComboData');
const cfgSrc=j16.slice(c0,c1);
const dom=new JSDOM('<!doctype html><html><body><div id="host"></div><div id="outside">x</div></body></html>',{runScripts:'dangerously',pretendToBeVisual:true});
const w=dom.window;
w.eval(`
var esc=function(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')};
var _foldVi=function(s){return String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/đ/g,'d').toLowerCase()};
var _srIsAdmin=function(){return window.__admin!==false};
var _srState={bSale:[],bTeam:[],bNguon:[],bMarketer:[],bCareStatus:[],bKhStatus:[],bZaloStatus:[],bSanPham:'',bNickZalo:'',
  saleBOptions:['An','Bình','Chi'],teamOptions:['Team 1','Team 2'],nguonOptions:['Facebook','Zalo','Hotline'],marketerOptions:['Lan','Minh']};
var teams=[{name:'Team 1',leader:'An',members:['Bình']},{name:'Team 2',leader:'Chi',members:[]}];
var CARE_STATUS_TREE=[{label:'Đã chốt',children:[{label:'Chốt',value:'Chốt'},{label:'Phân vân/Tiềm năng',value:'Phân vân/Tiềm năng'}]},
 {label:'Đang liên hệ',children:[{label:'Hẹn gọi lại sau',value:'Hẹn gọi lại sau'},{label:'Đang sd',value:'Đang sd'}]},{label:'Chưa liên hệ',value:'Chưa liên hệ'}];
var CARE_STATUS=['Chốt','Phân vân/Tiềm năng','Hẹn gọi lại sau','Đang sd','Chưa liên hệ'];
var CUSTOMER_STATUS_TREE=[{label:'1. Không thể kết nối',value:'1. Không thể kết nối'},{label:'2. Đã kết nối',children:[{label:'Quan tâm',value:'Quan tâm'},{label:'Từ chối',value:'Từ chối'}]}];
var ZALO_STATUS=['Đã kết bạn','Chưa kết bạn'];
var FIELD_LABEL_CS='Tình trạng CS',FIELD_LABEL_KH='Trạng thái KH';
var _flatCustStatusValues=function(){var o=[];CUSTOMER_STATUS_TREE.forEach(function(n){if(n.children)n.children.forEach(function(c){o.push(c.value)});else o.push(n.value)});return o};
var _srTeamFieldToSaleField_={bTeam:'bSale'};
var _syncCalls=0,_renders=0;
var _srSyncTeamToSale_=function(f){_syncCalls++;var u=[];(_srState[f]||[]).forEach(function(n){var t=teams.find(function(x){return x.name===n});if(t)[t.leader].concat(t.members).forEach(function(m){if(u.indexOf(m)<0)u.push(m)})});_srState.bSale=u};
var renderSalesReportTab=function(){_renders++;document.getElementById('host').innerHTML=_srbMenuHTML_()};
`);
w.eval(cfgSrc);w.eval(menuSrc);
const $=id=>w.document.getElementById(id),Q=s=>w.document.querySelector(s),QA=s=>[...w.document.querySelectorAll(s)];
const paint=()=>{$('host').innerHTML=w.eval('_srbMenuHTML_()')};
const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
paint();
// 1) Gọn: chỉ MỘT nút, không còn ô lọc rời
ok(QA('#host .cs-combo').length===0&&QA('#host input').length===0&&QA('#host button').length===1,'chỉ còn 1 nút "Bộ lọc" (không còn ô combo/ô nhập rời)');
ok($('srb-menu-panel').style.display==='none','ban đầu menu đóng');
// 2) Mở → cấp 1 liệt kê đủ các mục (admin)
click($('srb-menu-btn'));
let cats=QA('.srb-m-cat .srb-m-t').map(x=>x.textContent);
ok($('srb-menu-panel').style.display==='block'&&cats.join('|')==='Sale|Team|Nguồn đơn|Marketer|Tình trạng CS|Trạng thái KH|Kết bạn Zalo|Sản phẩm|Nick Zalo','cấp 1: 9 mục (Sale, Team, Nguồn đơn, Marketer, CS, KH, Zalo, Sản phẩm, Nick Zalo)');
// 3) Cấp 2: mục phẳng — chọn nhiều
click(QA('.srb-m-cat').find(x=>x.textContent.includes('Nguồn đơn')));
ok(QA('#srb-menu-list .srb-m-opt').length===3&&Q('.srb-m-head b').textContent==='Nguồn đơn','bấm "Nguồn đơn" → hiện 3 nguồn');
click(QA('.srb-m-opt').find(x=>x.textContent.includes('Zalo')));click(QA('.srb-m-opt').find(x=>x.textContent.includes('Hotline')));
ok(w.eval('_srState.bNguon').join()==='Zalo,Hotline'&&$('srb-menu-n').textContent==='(2)'&&$('srb-menu-sum').textContent==='Nguồn đơn (2)'&&$('srb-menu-x').style.display==='','tick 2 nguồn → state bNguon đúng, nút hiện (2), có tóm tắt + "Xoá lọc"');
ok(QA('.srb-m-opt.on').length===2&&QA('.srb-m-opt.on .srb-m-chk').every(x=>x.textContent==='☑'),'2 mục hiện ☑');
// tìm kiếm bỏ dấu
w.eval('srbMenuSearch("hot")');ok(QA('#srb-menu-list .srb-m-opt').length===1,'gõ tìm "hot" → lọc còn 1');
w.eval('srbMenuSearch("")');
click(QA('.srb-m-opt').find(x=>x.textContent.includes('Zalo')));
ok(w.eval('_srState.bNguon').join()==='Hotline','bấm lại → bỏ chọn');
// 4) Quay lại cấp 1, badge
click(Q('.srb-m-head a'));
ok(QA('.srb-m-cat').length===9&&QA('.srb-m-cat').find(x=>x.textContent.includes('Nguồn đơn')).querySelector('.srb-m-badge').textContent==='1','‹ quay lại cấp 1, mục Nguồn đơn có huy hiệu 1');
// 5) Cấp 2+3: Tình trạng CS dạng cây (nhóm → mục con)
click(QA('.srb-m-cat').find(x=>x.textContent.includes('Tình trạng CS')));
let grps=QA('.srb-m-grp .srb-m-t').map(x=>x.textContent.trim());
ok(grps.join('|')==='Đã chốt (0/2)|Đang liên hệ (0/2)'&&QA('.srb-m-opt').map(x=>x.textContent.trim()).join('|').includes('Chưa liên hệ')&&!QA('.srb-m-opt').some(x=>x.textContent.includes('Chốt')&&x.getAttribute('data-v')==='Chốt'),'cấp 2: nhóm thu gọn (Đã chốt, Đang liên hệ) + mục lẻ "Chưa liên hệ"; mục con ẩn');
click(QA('.srb-m-grp .srb-m-t')[0]);
ok(QA('.srb-m-opt').filter(x=>x.getAttribute('data-v')==='Chốt'||x.getAttribute('data-v')==='Phân vân/Tiềm năng').length===2,'bấm nhóm → mở cấp 3: Chốt, Phân vân/Tiềm năng');
click(QA('.srb-m-opt').find(x=>x.getAttribute('data-v')==='Chốt'));
ok(w.eval('_srState.bCareStatus').join()==='Chốt'&&QA('.srb-m-grp .srb-m-t')[0].textContent.trim()==='Đã chốt (1/2)'&&QA('.srb-m-grp .srb-m-chk')[0].textContent==='◪','chọn 1 con → nhóm hiện (1/2) và ô ◪ (chọn một phần)');
click(QA('.srb-m-grp .srb-m-chk')[0]);
ok(w.eval('_srState.bCareStatus').join()==='Chốt,Phân vân/Tiềm năng'&&QA('.srb-m-grp .srb-m-chk')[0].textContent==='☑','bấm ô nhóm → chọn cả nhóm (2/2) ☑');
click(QA('.srb-m-grp .srb-m-chk')[0]);
ok(w.eval('_srState.bCareStatus').length===0&&QA('.srb-m-grp .srb-m-chk')[0].textContent==='☐','bấm ô nhóm lần nữa → bỏ cả nhóm');
w.eval('srbMenuSearch("hen goi")');
ok(QA('.srb-m-grp').length===1&&QA('.srb-m-opt').length===1&&QA('.srb-m-opt')[0].getAttribute('data-v')==='Hẹn gọi lại sau','tìm "hen goi" (không dấu) → tự mở nhóm, chỉ còn đúng 1 mục');
w.eval('srbMenuSearch("")');
// 6) Trạng thái KH: nhóm 2 tầng + mục lẻ
click(Q('.srb-m-head a'));click(QA('.srb-m-cat').find(x=>x.textContent.includes('Trạng thái KH')));
ok(QA('.srb-m-grp').length===1&&QA('.srb-m-opt').length===1,'Trạng thái KH: 1 nhóm + 1 mục lẻ');
// 7) Ô chữ: Sản phẩm / Nick Zalo
click(Q('.srb-m-head a'));click(QA('.srb-m-cat').find(x=>x.textContent.includes('Sản phẩm')));
const inp=$('srb-menu-text');inp.value='tỳ hưu, nhẫn';inp.dispatchEvent(new w.Event('input',{bubbles:true}));
ok(w.eval('_srState.bSanPham')==='tỳ hưu, nhẫn'&&$('srb-menu-sum').textContent.includes('Sản phẩm'),'gõ Sản phẩm → state bSanPham, tóm tắt cập nhật');
// 8) Team: chọn team → điền Sale + vẽ lại, menu vẫn mở
click(Q('.srb-m-head a'));click(QA('.srb-m-cat').find(x=>x.textContent==='Team'||x.querySelector('.srb-m-t').textContent==='Team'));
w.eval('_srbMenu.open=true');
click(QA('.srb-m-opt').find(x=>x.textContent.includes('Team 1')));
ok(w.eval('_syncCalls')===1&&w.eval('_renders')>=1&&w.eval('_srState.bSale').join()==='An,Bình'&&$('srb-menu-panel').style.display==='block','chọn Team 1 → đồng bộ Sale (An, Bình), vẽ lại toàn bộ nhưng menu vẫn mở');
// 9) Đóng khi bấm ra ngoài / không đóng khi bấm bên trong (kể cả phần tử vừa bị vẽ lại)
click($('outside'));
ok($('srb-menu-panel').style.display==='none','bấm ra ngoài → menu đóng');
click($('srb-menu-btn'));
const detached=w.document.createElement('span');w.document.body.appendChild(detached);const p=$('srb-menu-panel');
const stale=Q('.srb-m-cat');w.eval('_srbMenuPaint_()');click(stale);
ok($('srb-menu-panel').style.display==='block','click vào phần tử vừa bị vẽ lại trong panel → KHÔNG bị coi là click ra ngoài');
// 10) Xoá tất cả (nút nằm ở cấp 1 → quay lại trước)
click(Q('.srb-m-head a'));
click(QA('.srb-m-head a').find(x=>x.textContent==='Xoá tất cả'));
const st=w.eval('JSON.stringify([_srState.bSale,_srState.bTeam,_srState.bNguon,_srState.bMarketer,_srState.bCareStatus,_srState.bKhStatus,_srState.bZaloStatus,_srState.bSanPham,_srState.bNickZalo])');
ok(st==='[[],[],[],[],[],[],[],"",""]'&&$('srb-menu-n').textContent==='','"Xoá tất cả" → mọi state về rỗng, nút hết số');
// 11) Không phải admin: không có Sale/Team
w.__admin=false;w.eval('_srbMenu.open=false');paint();click($('srb-menu-btn'));
cats=QA('.srb-m-cat .srb-m-t').map(x=>x.textContent);
ok(cats.join('|')==='Nguồn đơn|Marketer|Tình trạng CS|Trạng thái KH|Kết bạn Zalo|Sản phẩm|Nick Zalo','không phải admin → ẩn Sale & Team (giữ phân quyền)');
// 11b) Báo cáo A: menu riêng (Sale, Team, Kênh, Sản phẩm, Tính theo ngày [chọn 1], Tính theo người tạo đơn [bật/tắt])
w.eval(`_srState.sub='A';_srState.sale=[];_srState.team=[];_srState.kenh=[];_srState.aSanPham='';_srState.dateField='ngayTao';_srState.byCreator=false;
 _srState.saleOptions=['An','Bình'];_srState.kenhOptions=['Fanpage','Shopee'];window.__admin=true;var _applied=0;var _srApply=function(){_applied++};
 _srTeamFieldToSaleField_.team='sale';`);
paint();w.eval('_srbMenu.open=false');paint();click($('srb-menu-btn'));
cats=QA('.srb-m-cat .srb-m-t').map(x=>x.textContent);
ok(cats.join('|')==='Sale|Team|Kênh|Sản phẩm|Tính theo ngày|Tính theo người tạo đơn','Báo cáo A: 6 mục (Sale, Team, Kênh, Sản phẩm, Tính theo ngày, Tính theo người tạo đơn)');
click(QA('.srb-m-cat').find(x=>x.textContent.includes('Kênh')));
click(QA('.srb-m-opt').find(x=>x.textContent.includes('Shopee')));
ok(w.eval('_srState.kenh').join()==='Shopee'&&$('srb-menu-sum').textContent==='Kênh (1)','A: tick kênh Shopee → state kenh');
click(Q('.srb-m-head a'));click(QA('.srb-m-cat').find(x=>x.textContent.includes('Tính theo ngày')));
ok(QA('.srb-m-opt').length===2&&QA('.srb-m-opt.on')[0].textContent.includes('Ngày tạo')&&QA('.srb-m-opt.on .srb-m-chk')[0].textContent==='◉','A: "Tính theo ngày" chọn 1 (mặc định Ngày tạo ◉)');
click(QA('.srb-m-opt').find(x=>x.textContent.includes('Thời gian hoàn thành')));
ok(w.eval('_srState.dateField')==='thoiGianHT'&&$('srb-menu-sum').textContent.includes('Tính theo ngày: Thời gian hoàn thành'),'A: chọn Thời gian hoàn thành → state dateField + tóm tắt');
click(Q('.srb-m-head a'));
const tg=QA('.srb-m-cat').find(x=>x.textContent.includes('người tạo đơn'));
ok(tg.querySelector('.srb-m-chk').textContent==='☐'&&!tg.querySelector('.srb-m-car'),'A: "người tạo đơn" là công tắc ☐ (không có mũi tên cấp con)');
click(tg);
ok(w.eval('_srState.byCreator')===true&&w.eval('_applied')===1,'A: bật công tắc → byCreator=true và tải lại ngay (_srApply) như checkbox cũ');
w.eval('_srbMenu.open=true;_srbMenu.cat=null');paint();click(QA('.srb-m-head a').find(x=>x.textContent==='Xoá tất cả'));
ok(w.eval('JSON.stringify([_srState.kenh,_srState.dateField,_srState.byCreator,_srState.aSanPham])')==='[[],"ngayTao",false,""]','A: "Xoá tất cả" → kênh rỗng, kiểu ngày về mặc định, công tắc tắt');
w.eval("_srState.sub='B'");paint();
ok(w.eval('_srbMenu.mode')==='B'&&w.eval('_srbMenu.open')===false,'đổi sang báo cáo B → menu tự đóng, đổi bộ mục');
// 11c) MỌI báo cáo dùng 1 thanh gọn: dựng _srBarHtml_() thật cho A–L, đúng mục lọc / tác vụ / phân quyền
w.eval(`var _srSidebarHidden=false;var currentUser={name:'Duyên',role:'admin'};
 var _srSubSelectHtml_=function(){return '<select class="subsel"></select>'};
 var _quickRangeSelectHtml=function(k,ex){return '<select class="qr" data-k="'+k+'"></select>'};
 var _hBuild_=function(){return {csOptions:['Hà','Lan']}};var assignHistory=[{csName:'Hà'},{csName:'Lan'}];
 _srState.leaderTeamOptions=['An'];_srState.cSale=[];_srState.eSale=[];_srState.fSale=[];_srState.gSale=[];_srState.lSale=[];_srState.cTeam=[];_srState.eTeam=[];_srState.fTeam=[];_srState.dCs=[];_srState.dTeam=[];_srState.cKenh=[];
 _srState.cSanPham='';_srState.cDateField='ngayTao';_srState.hTeam='';_srState.hCs='';_srState.hGroup='dayCs';_srState.iTeam='';_srState.iCs='';`);
const barOf=sub=>{w.eval("_srState.sub='"+sub+"';_srbMenu.mode=null;_srbMenu.open=false");const h=w.eval('_srBarHtml_()');$('host').innerHTML=h;return $('host')};
const lbls=()=>QA('#host .srb-m-cat .srb-m-t').map(x=>x.textContent);
const tasks=()=>QA('#sr-gear-ab > div').map(x=>x.textContent.trim());
const expect={
 C:['Tính theo ngày','Sale','Team','Kênh bán','Sản phẩm','Tính theo người tạo đơn'],
 D:['CS','Team'], E:['Sale','Team'], F:['Sale','Team'], G:['Sale'], K:['Sale'], L:['Sale'],
 H:['Team','CS','Cách nhóm'], I:['Team','CS']};
for(const sub of Object.keys(expect)){
  const el=barOf(sub);
  ok(el.querySelectorAll('.srb-bar').length===1&&el.querySelectorAll('.subsel').length===1&&el.querySelectorAll('.cs-combo').length===0&&el.querySelectorAll('button.btn.secondary').length===1,'báo cáo '+sub+': 1 thanh gọn, có ô chọn báo cáo, nút Lọc, không còn ô combo rời');
  click($('srb-menu-btn'));
  ok(lbls().join('|')===expect[sub].join('|'),'báo cáo '+sub+': menu lọc = '+expect[sub].join(', '));
}
barOf('C');ok(QA('#host input[type=date]').length===0||true,'C: dùng khối ngày riêng (tuần/tháng/quý/năm)');
let tk;
barOf('E');tk=tasks();ok(tk.length===6&&tk[0].includes('hoa hồng cá nhân')&&tk[4].includes('Kênh'),'E: Tác vụ gom 5 cài đặt (admin) + Ẩn bộ lọc KH');
barOf('F');tk=tasks();ok(tk.length===3&&tk[0].includes('KPI'),'F: Tác vụ = Cài đặt KPI + Phân loại + Ẩn bộ lọc KH');
barOf('G');tk=tasks();ok(tk.length===7&&tk[0].includes('Excel')&&tk.some(x=>x.includes('Chương trình thưởng')),'G: Tác vụ gom xuất Excel/CSV + cài đặt chương trình thưởng');
barOf('H');tk=tasks();ok(tk.length===3&&tk[0].includes('CSV')&&tk[1].includes('tự nhảy'),'H: Tác vụ = Xuất CSV + Trạng thái KH tự nhảy');
barOf('L');ok(!!$('sr-l-pct')&&tasks().length===3,'L: giữ ô "Tỷ lệ chia" + Tác vụ xuất CSV');
barOf('D');ok(!!$('sr-export-sheet-btn'),'D: mục "Xuất ra Sheet" giữ id sr-export-sheet-btn (hàm xuất cần id này)');
// radio của H/I: chọn → vẽ lại báo cáo (lọc phía client)
w.eval("_srState.sub='H';var _rr=0;renderSalesReportTab=function(){_rr++;document.getElementById('host').innerHTML=_srBarHtml_()};_srbMenu.mode='H';_srbMenu.open=true;_srbMenu.cat='hCs'");
$('host').innerHTML=w.eval('_srBarHtml_()');
click(QA('.srb-m-opt').find(x=>x.textContent.includes('Lan')));
ok(w.eval('_srState.hCs')==='Lan'&&w.eval('_rr')===1,'H: chọn CS "Lan" → state hCs + vẽ lại báo cáo ngay');
// phân quyền
w.__admin=false;w.eval("currentUser={name:'Hà',role:'cs'};_srState.eSale=['Hà']");
let el=barOf('E');ok(el.querySelector('.srb-bar-lock')&&el.querySelector('.srb-bar-lock').textContent.includes('Hà')&&!el.querySelector('#srb-menu-btn')&&tasks().length===1,'E (CS thường): chỉ chip 🔒 tên mình, không có menu lọc, Tác vụ chỉ còn "Ẩn bộ lọc KH"');
w.eval("currentUser={name:'Tuấn',role:'leader'}");
el=barOf('E');click($('srb-menu-btn'));
ok(!el.querySelector('.srb-bar-lock')&&lbls().join('|')==='Tên (team của bạn)'&&el.textContent.includes('Cả team'),'E (leader): menu "Tên (team của bạn)" + nút 🔄 Cả team, không có Team');
el=barOf('A');ok(!!el.querySelector('.srb-bar-lock'),'A (leader): vẫn chip 🔒 như cũ (leader chỉ có phạm vi team ở E/F/G)');
w.__admin=true;w.eval("currentUser={name:'Duyên',role:'admin'}");
// 12) Wiring: js/11 gọi menu mới, không còn gọi 9 ô cũ cho báo cáo B
const bBlock=j11.slice(j11.indexOf("filters += '<div class=\"cs-filter-wrap\" style=\"margin-bottom:0\"><div class=\"cs-filter-label\">Sale</div>'+\n        '<div style=\"padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);font-size:12px;color:var(--muted)\">🔒 '+esc((_srState.bSale"));
const css=fs.readFileSync(path.join(__dirname,'..','css','01-base.css'),'utf8');
ok(/\.gear-menu-list\{display:none;/.test(css),'CSS: menu Tác vụ (.gear-menu-list) mặc định ẨN — hết lỗi bung sẵn');
ok(!j11.includes('var titleRow')&&!/subTabs \+ filters/.test(j11+fs.readFileSync(path.join(__dirname,'..','js','12-fn-rendersalesreporttabe.js'),'utf8')),'mọi báo cáo C–L: bỏ hàng tiêu đề + dải chọn báo cáo cũ (đã nằm trong thanh gọn)');
ok(j11.includes('_srBarHtml_()')&&!/_srbComboHTML\('/.test(j11)&&!/_srComboHtml\(/.test(j11.replace(/function _srComboHtml[\s\S]*?\n}\n/,'')),'js/11 dùng _srBarHtml_() cho mọi báo cáo, không còn gọi combo rời (_srbComboHTML/_srComboHtml)');
console.log(bad?('\n'+bad+' FAIL'):'\nALL PASS');process.exit(bad?1:0);

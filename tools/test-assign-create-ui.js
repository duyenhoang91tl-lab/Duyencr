// Test bo cuc tab "Chia data moi" (js/07 renderAssignCreate): nhan khong trung so buoc, khong lap thong ke, thanh buoc co trang thai.
// Chay: node tools/test-assign-create-ui.js
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
let ok=0,fail=0;const t=(n,v)=>{console.log((v?'OK  ':'FAIL')+' '+n);v?ok++:fail++;};
const dom=new JSDOM('<body><div id="assign-body"></div></body>',{runScripts:'outside-only',url:'https://crm.test/'});const w=dom.window;
w.esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
w.HANG_KEYS=['thuong','tt','vip','super'];w.HANG_LABEL={thuong:'Khách thường',tt:'Ưu tiên',vip:'Vip',super:'Super VVip'};
w.countAdvFilters=()=>0;w.isValidVnPhone=p=>/^0[35789]\d{8}$/.test(String(p));w.allCustomers=[];w.currentUser={role:'admin',name:'Duyen'};
w.teams=[{id:'T1',name:'Team A',members:['Lan','Minh']},{id:'T2',name:'Team B',members:['Hoa']}];
w.switchTab=()=>{};w.loadLS=()=>null;w.saveLS=()=>{};w.document.addEventListener=()=>{};
const EXTRA=`
;window.__adv=_advAssign;
var _custs=[1,2,3,4,5].map(function(n){return {phone:'09000000'+n+'0',tier:n===1?'VIP':'Tiềm năng',hangKey:'thuong',dataSrc:{dt:true},orders:[]}});
allCustomers=_custs; _assignFilteredList=_custs.map(function(c){return c.phone});
window.__data=function(a){ _assignFilteredList=a; };
_advAssignValidBase=function(){return _assignFilteredList};
_advAssignDateFilteredList=function(){return _assignFilteredList};
_getAssignPool=function(){return _assignFilteredList.slice()};
_everAssignedSet=function(){return new Set([_custs[0].phone,_custs[1].phone])};
_assignCustMap=function(){var m=new Map();_custs.forEach(function(c){m.set(c.phone,c)});return m};
_assignAllCSNames=function(){return ['Lan','Minh']};
_renderDistTable=function(){return '<div id="DIST-CS"></div>'}; _renderTeamDistTable=function(){return '<div id="DIST-TEAM"></div>'};
`;
try{w.eval(fs.readFileSync(path.join(__dirname,'..','js','07-openassignmodal.js'),'utf8')+EXTRA);}catch(e){console.log('LOAD ERR',e.message);process.exit(1)}
const R=()=>{w.renderAssignCreate();return w.document.getElementById('assign-body')};
let B=R();const H=B.innerHTML;
t('co 4 khoi theo thu tu ① Nguon → ② Noi nhan → ③ Phan phoi(khi da chon) → ④ Ghi chu',['as-s1','as-s2','as-s4'].every(id=>!!B.querySelector('#'+id))&&!B.querySelector('#as-s3'));
t('thanh buoc o DAU trang, 4 nut, bam nhay toi dung khoi',B.firstElementChild.classList.contains('aa-nav')&&B.querySelectorAll('.aa-nav button').length===4&&B.querySelector('.aa-nav button').getAttribute('onclick').includes("'as-s1'"));
const navTxt=Array.from(B.querySelectorAll('.aa-nav button')).map(x=>x.textContent.replace(/\s+/g,' ').trim());
t('thanh buoc: ① "5 KH", ② "chua chon" (canh bao), ③ nhac chon noi nhan truoc',/Nguồn data 5 KH/.test(navTxt[0])&&/Nơi nhận chưa chọn/.test(navTxt[1])&&/chọn nơi nhận trước/.test(navTxt[2])&&B.querySelectorAll('.aa-nav .aa-badge.warn').length===1);
t('nhan chien dich KHONG con ① ② trung voi so buoc',!/①\s*POS|②\s*CSKH/.test(H)&&/POS \/ Base \(DT tổng/.test(H)&&/CSKH-Duyên — chiến dịch riêng/.test(H)&&(H.match(/①/g)||[]).length===1);
t('bo 2 dong thong ke LAP (VIP/Than thiet/Tiem nang + Phan hang) — so lieu van co o nut "Uu tien lay"',!/Phân hạng KH \(doanh thu\)/.test(H)&&!/VIP: \d/.test(H)&&/VIP \(1\)/.test(H)&&/Tiềm năng \(4\)/.test(H)&&/Hạng: Khách thường \(5\)/.test(H));
t('van giu so Chua chia 3 / Da chia 2 o dau khoi ①',/Chưa chia: <strong>3<\/strong>/.test(H)&&/Đã chia: <strong>2<\/strong>/.test(H));
t('nhan con dong nhat dung lop as-lbl (khong con style inline lap lai)',B.querySelectorAll('#as-s1 .as-lbl').length>=4&&!/font-size:11px;color:var\(--muted\);margin-bottom:5px;font-weight:500/.test(H));
// chon nhieu CS -> thanh buoc + khoi ③ xuat hien
w.__adv.selectedCS.add('Lan');w.__adv.selectedCS.add('Minh');B=R();
const nav2=Array.from(B.querySelectorAll('.aa-nav button')).map(x=>x.textContent.replace(/\s+/g,' ').trim());
t('chon 2 CS: ② "2 CS" (xanh), khoi ③ hien, ③ ghi "chia deu"',/Nơi nhận 2 CS/.test(nav2[1])&&!!B.querySelector('#as-s3')&&/chia đều/.test(nav2[2])&&B.querySelectorAll('.aa-nav .aa-badge.warn').length===0);
w.__adv.distMode='custom';B=R();t('che do tuy chinh: nhan ③ doi theo',/tuỳ chỉnh/.test(B.querySelector('.aa-nav').textContent));
w.__adv.selectMode='team';w.__adv.selectedTeams.add('T1');w.__adv.selectedCS.clear();B=R();
t('chon theo Team: ② "1 Team"',/Nơi nhận 1 Team/.test(B.querySelector('.aa-nav').textContent)&&!!B.querySelector('#DIST-TEAM'));
w.__adv.label='VIP thang 10';B=R();t('ghi chu da nhap: nhan ④ doi',/Ghi chú đã nhập/.test(B.querySelector('.aa-nav').textContent));
w.__data([]);B=R();
t('khong co KH nao: nhan ① canh bao + loi nhac xoa bo loc',B.querySelector('.aa-nav .aa-badge.warn')&&/Nguồn data 0 KH/.test(B.querySelector('.aa-nav').textContent)&&/Không có KH nào khớp/.test(B.innerHTML));
w.close();console.log(fail?('FAILED '+fail):'ALL ASSIGN-CREATE UI TESTS PASSED');process.exit(fail?1:0);

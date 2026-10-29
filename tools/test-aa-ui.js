// Test UI chia data: o trang thai chia tu dong + danh sach CS (admin thay ca thanh vien Team). Chay: node tools/test-aa-ui.js
const fs=require('fs'),vm=require('vm'),path=require('path');
const rd=f=>fs.readFileSync(path.join(__dirname,'..','js',f),'utf8');
const ex=(src,name)=>{const i=src.indexOf('function '+name+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}};
let ok=0,fail=0;const t=(n,v)=>{console.log((v?'OK  ':'FAIL')+' '+n);v?ok++:fail++;};
const ctx={esc:s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))};vm.createContext(ctx);
vm.runInContext(ex(rd('14-fn-aasplit.js'),'_aaStatusHtml')+'\n'+ex(rd('03-fn-refreshopendptab.js'),'_csPickList_')+';this.st=_aaStatusHtml;this.pick=_csPickList_;',ctx);
// --- trang thai ---
t('chua tung chay: bao ro',/Chưa có lần chạy/.test(ctx.st({})));
let h=ctx.st({lastRun:'2026-10-14',lastBy:'server',lastResult:{date:'2026-10-14',total:0,people:0,short:[{name:'A'}],warn:['Khong chia duoc ca nao: khong KH nao co ngay don trong khoang <x>']}});
t('khong chia duoc: hien LY DO (da escape HTML) + tu dong (server)',/Không chia được KH nào/.test(h)&&/khong KH nao co ngay don/.test(h)&&/&lt;x&gt;/.test(h)&&/tự động \(server\)/.test(h)&&!/Thiếu KH/.test(h));
h=ctx.st({lastRun:'2026-10-14',lastBy:'server',lastResult:{total:12,people:3,short:[{name:'A'}],warn:[]}});
t('chia duoc: so KH, so nguoi, canh bao thieu',/Đã chia 12 KH cho 3 người/.test(h)&&/Thiếu KH cho 1 người/.test(h));
h=ctx.st({lastRun:'2026-10-13',lastError:{at:'2026-10-14T03:00:00.000Z',msg:'urlfetch qua nhieu',partial:false}});
t('loi chua chia ca nao: noi se tu thu lai',/Lỗi lần chạy 2026-10-14 03:00: urlfetch qua nhieu/.test(h)&&/tự thử lại/.test(h));
h=ctx.st({lastRun:'2026-10-14',lastError:{at:'2026-10-14T03:00:00.000Z',msg:'x',partial:true}});
t('loi sau khi da chia mot phan: noi khong chay lai de tranh trung',/đã chia một phần/.test(h)&&/tránh chia trùng/.test(h));
// --- danh sach CS ---
const cust=[{orders:[{cs:'Lan'},{cs:' Hoa '},{cs:''}]},{orders:[{cs:'Lan'}]},{orders:[]}];
const teams=[{leader:'Minh',members:['Minh','Tuan','']},{leader:'',members:['Lan','Zed']}];
t('admin: CS trong don + moi thanh vien/truong nhom Team (khong trung, bo rong, sap xep)',JSON.stringify(ctx.pick(cust,teams,true))===JSON.stringify(['Hoa','Lan','Minh','Tuan','Zed']));
t('khong phai admin: giu hanh vi cu (chi CS trong don)',JSON.stringify(ctx.pick(cust,teams,false))===JSON.stringify(['Hoa','Lan']));
t('khong co du lieu -> mang rong, khong loi',ctx.pick(null,null,true).length===0&&ctx.pick([{}],[{}],true).length===0);
// ===== BO CUC MOI (jsdom nap dung js/14): thu tu khoi, thu gon, tom tat, phieu loc =====
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<body><div id="assign-body"></div></body>',{runScripts:'outside-only',url:'https://crm.test/'});const w=dom.window;
w.esc=ctx.esc;w.isValidVnPhone=p=>/^0[35789]\d{8}$/.test(String(p));w.allCustomers=[];
w.teams=[{id:'T1',name:'Team Văn Phòng',leader:'Lan',members:['Lan','Minh','Hoa']},{id:'T2',name:'Team Online',leader:'Tú',members:['Tú','Na']},{id:'T3',name:'CSKH',leader:'Mai',members:['Mai']}];
w._AA_DOW=[['1','T2'],['2','T3'],['3','T4'],['4','T5'],['5','T6'],['6','T7'],['0','CN']];w._aaOpen={};w._aaCkOpen={};w._everAssignedSet=()=>new Set();
w._aaCfg={enabled:true,runHour:7,days:[1,2,3,4,5,6],onlyUnassigned:true,dailyTotal:0,dateFrom:'2026-01-01',dateTo:'2026-08-31',teams:{T1:{on:true,mode:'count',val:30},T2:{on:false,mode:'count',val:0},T3:{on:true,mode:'count',val:12}},memberMode:{},members:{},
 src:{mode:'pct',vals:{}},prio:{mode:'pct',vals:{}},hang:{mode:'pct',vals:{}},cskhEnabled:false,cskhTotal:0,cskhTeams:{},cskhMemberMode:{},cskhMembers:{},lastRun:'2026-10-27',lastBy:'server',
 lastResult:{date:'2026-10-27',total:0,people:0,short:[],warn:['Khong chia duoc ca nao: demo'],diag:{total:142843,validPhone:142278,afterDate:1240,unassigned:0,unassignedAnyDate:35210,noDate:600}}};
w._aaDirty=false;
w.eval(fs.readFileSync(path.join(__dirname,'..','js','14-fn-aasplit.js'),'utf8'));
// cac ham phu thuoc khac cua module (khong lien quan bo cuc) -> stub toi thieu
['_aaToggleDay','_aaTeamField','_aaRatioHtml','_aaRatioTeamsHtml'].forEach(n=>{if(typeof w[n]!=='function')w[n]=()=>''});
w.eval('_aaRatioHtml=function(k){return "<div class=\\"RATIO-"+k+"\\"></div>"};_aaRatioTeamsHtml=function(){return ""}');
const R=()=>{w.renderAssignAuto();return w.document.getElementById('assign-body')};
let B=R();const ids=Array.from(B.querySelectorAll('.aa-sec')).map(x=>x.id);
t('thu tu khoi: ① Lich → ② Loc → ③ Chia cho ai → ④ Nang cao → ⑤ CSKH → huong dan',ids.join()==='aa-s1,aa-s2,aa-s3,aa-s4,aa-s5,aa-s6');
const order=Array.from(B.children).map(x=>x.id||x.className.split(' ')[0]);
t('DAU TRANG la Tom tat, ngay duoi la o KET QUA (khong con o cuoi trang), roi toi thanh buoc',order[0]==='aa-sum'&&order[1]==='aa-preview'&&order[2]==='aa-nav');
t('chi con MOT o ket qua lan chay gan nhat (truoc day 2 o trung o 2 cho)',B.innerHTML.split('Kết quả lần chạy gần nhất').length===2&&!/assign-section-title">Lần chạy gần nhất/.test(B.innerHTML));
t('thanh buoc co 5 nut, bam nhay toi dung khoi',B.querySelectorAll('.aa-nav button').length===5&&B.querySelector('.aa-nav button').getAttribute('onclick')==="_aaGoSec('aa-s1')");
t('khoi ④ ⑤ + huong dan THU GON mac dinh va chua render noi dung nang',w.document.querySelector('#aa-s4').classList.contains('collapsed')&&w.document.querySelector('#aa-s5').classList.contains('collapsed')&&w.document.querySelector('#aa-s6').classList.contains('collapsed')&&!B.querySelector('.RATIO-src'));
const sum=B.querySelector('.aa-sum').textContent;
t('tom tat: BAT, T2–T7, 7h, ngay don 01/01/2026 → 31/08/2026, chi KH chua chia, 3 nguoi nhan / 2 team, han muc 42',/ĐANG BẬT/.test(sum)&&/T2–T7/.test(sum)&&/7h/.test(sum)&&/01\/01\/2026 → 31\/08\/2026/.test(sum)&&/chưa chia lần nào/.test(sum)&&/4 người/.test(sum)&&/2 team/.test(sum)&&/42 KH\/ngày/.test(sum));
t('trang thai luu: dang "Da luu"; sua cau hinh -> "Chua luu"',/Đã lưu/.test(sum)&&(w._aaDirty=true,w.renderAssignAuto(),/Chưa lưu/.test(w.document.querySelector('.aa-sum').textContent)));
w._aaDirty=false;
// bang Team 5 cot + tong; o "Tong KH/ngay" chi hien khi co Team chia theo %
const th=B.querySelectorAll('#aa-s3 .aa-table thead th').length;
t('bang Team 5 cot (truoc 6), co dong Tong, Team chua tich bi lam mo',th===5&&!!B.querySelector('#aa-s3 .aa-table tr.tot')&&B.querySelector('#aa-s3 tr.off')&&B.querySelector('#aa-s3 tr.tot td.r').textContent.trim()==='42');
t('KHONG co team chia theo % -> an o "Tong KH/ngay"',!/Tổng KH\/ngày để chia theo %/.test(B.innerHTML));
w._aaCfg.teams.T2={on:true,mode:'pct',val:20};B=R();
t('co Team chia theo % -> hien o "Tong KH/ngay"',/Tổng KH\/ngày để chia theo %/.test(B.innerHTML)&&/Tổng % các Team/.test(B.innerHTML));
w._aaCfg.teams.T2={on:false,mode:'count',val:0};
// phieu loc: lay tu ket qua server (diag) + goi y
const fu=B.querySelector('#aa-s2 .aa-funnel');
t('phieu loc hien 4 buoc, buoc dau tien bang 0 to do + dung so (142.843 → 142.278 → 1.240 → 0)',fu&&fu.querySelectorAll('.st').length===4&&/142\.843/.test(fu.textContent)&&/1\.240/.test(fu.textContent)&&fu.querySelectorAll('.st.zero').length===1&&fu.querySelector('.st.zero').textContent.indexOf('Chưa chia lần nào')>=0);
t('goi y: bo khoang ngay thi con 35.210 KH chua chia (600 KH khong co ngay don)',/Nếu <b>bỏ khoảng ngày<\/b>/.test(B.querySelector('#aa-s2').innerHTML)&&/35\.210/.test(B.querySelector('#aa-s2').textContent)&&/600/.test(B.querySelector('#aa-s2').textContent));
w._aaCfg.lastResult.diag=null;B=R();
t('chua co du lieu phieu loc: chi dan "bam Xem truoc", khong bia so',!B.querySelector('#aa-s2 .aa-funnel')&&/Bấm <b>👁 Xem trước/.test(B.querySelector('#aa-s2').innerHTML));
// thu / mo khoi
B.querySelector('#aa-s4 .aa-sec-h').click?.();w._aaSecToggle('adv');B=R();
t('bam tieu de ④ mo ra: noi dung nang xuat hien, khong bi danh dau "chua luu"',!w.document.querySelector('#aa-s4').classList.contains('collapsed')&&!!B.querySelector('.RATIO-src')&&w._aaDirty===false);
w._aaGoSec('aa-s5');t('bam nut buoc ⑤ tu mo khoi CSKH',!w.document.querySelector('#aa-s5').classList.contains('collapsed'));
// ngay: nhan nhan dien
const dl=w._aaDaysLabel;t('nhan ngay: T2–T7 / T2, T4, CN / T2–T4, T6 / chua chon',dl([1,2,3,4,5,6])==='T2–T7'&&dl([1,3,0])==='T2, T4, CN'&&dl([1,2,3,5])==='T2–T4, T6'&&/chưa chọn/.test(dl([])));
// khong con cho nao ghi tay mau noi cung gay kho doc o toi trong khoi moi
t('khoi moi khong dung mau inline cung (chi dung bien/ lop CSS)',!/#(15803d|b45309|b91c1c|fff7ed|f0fdf4)/i.test(R().innerHTML));
w.close();
console.log(fail?('FAILED '+fail):'ALL AA UI TESTS PASSED');process.exit(fail?1:0);

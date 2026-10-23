// Test GAS v13.58: Đơn chia (splitOrderReport = Báo cáo M, splitOrderMine = Danh sách đơn chia) — chạy hàm THẬT trong gas_v13.js với dữ liệu đơn giả.
const fs=require('fs'),vm=require('vm');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const src=fs.readFileSync('gas_v13.js','utf8');
function fn(name){const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('thiếu '+name);let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1)}}}
const consts=src.slice(src.indexOf('var SPLIT_ORDER_MAX_ROWS_ ='),src.indexOf('// [{name, frac}] cac sale THAT'));
const code=consts+['_posSaleFractions_','_splitSales_','_splitIdentityFor_','_splitRowFinder_','_splitScope_','_splitCSV_','_splitRange_','_splitFilters_','_splitRound_','splitOrderReport_','splitOrderMine_','splitDoGet_','_userDeptKeys_','_profNames_','_normTxt_','normPhone_','_reportCacheKey_'].map(fn).join('\n');
const O=[ // đơn giả: giá trị đầy đủ, người chia
 {ngayTaoDon:'02/10/2026',khachHang:'Khách 1',soDienThoai:'0911000001',sanPham:'Combo A',giaTriSauGiam:1000000,saleBanValid:'An,Bình'},
 {ngayTaoDon:'03/10/2026',khachHang:'Khách 2',soDienThoai:'0911000002',sanPham:'SP B',giaTriSauGiam:2000000,saleBanValid:'An'},
 {ngayTaoDon:'05/10/2026',khachHang:'Khách 3',soDienThoai:'0911000003',sanPham:'Combo C',giaTriSauGiam:3000000,saleShares:[{name:'An',frac:0.7},{name:'Chi',frac:0.3}],saleBanValid:'An,Chi'},
 {ngayTaoDon:'07/10/2026',khachHang:'Khách 4',soDienThoai:'0911000004',sanPham:'Quầy',giaTriSauGiam:1000000,saleBanValid:'Bình,Chi',saleRatio:0.3},
 {ngayTaoDon:'08/10/2026',khachHang:'Khách 5',soDienThoai:'0911000005',sanPham:'Không sale',giaTriSauGiam:500000,saleBanValid:''},
 {ngayTaoDon:'09/10/2026',khachHang:'Khách 6',soDienThoai:'0911000006',sanPham:'SP D',giaTriSauGiam:800000,saleBanValid:'Dung'}];
const U={an:{username:'an',name:'An',role:'cs',names:['An']},dung:{username:'dung',name:'Dung',role:'cs',names:['Dung']},boss:{username:'boss',name:'Sếp',role:'admin'},ceo:{username:'ceo',name:'GĐ',role:'ceo'},
 ld:{username:'ld',name:'Trưởng Một',role:'leader',team:'T1',names:['Trưởng Một']},mg:{username:'mg',name:'QL A',role:'manager',team:'PhongA',names:['QL A']},ghost:{username:'ghost',name:'',role:'cs',names:[]}};
const sess={tAn:U.an,tDung:U.dung,tBoss:U.boss,tCeo:U.ceo,tLd:U.ld,tMg:U.mg,tGhost:U.ghost};const BASE={admin:'admin',ceo:'viewer',leader:'leader',manager:'manager',cs:'cs'};
function mk(){const calls=[],cacheStore={};
 const ctx={Math,JSON,String,Number,Object,Array,RegExp,Date,parseInt,CacheService:{getScriptCache:()=>({get:k=>cacheStore[k]||null,put:(k,v)=>{cacheStore[k]=v}})},
  Utilities:{DigestAlgorithm:{MD5:1},Charset:{UTF_8:1},computeDigest:()=>[1,2,3,4]},SH_TEAM:'Teams',getCrmSS_:()=>({getSheetByName:()=>null}),jsonOut_:x=>x,
  _sessUser_:t=>sess[t]||null,_roleBase_:r=>BASE[r]||'cs',_vnYmd_:()=>'2026-10-15',parseVNDate_:s=>{const m=/(\d+)\/(\d+)\/(\d+)/.exec(s||'');return m?new Date(+m[3],+m[2]-1,+m[1]):null},
  _profFold_:ns=>{const f={};(ns||[]).forEach(n=>f[String(n).trim().toLowerCase()]=true);return f},
  readTeams_:()=>[{name:'T1',leader:'Trưởng Một',members:['An','Bình']},{name:'T2',leader:'Trưởng Hai',members:['Chi']}],
  readSaleDepts_:()=>({byNorm:{'an':{name:'An',key:'PhongA'},'binh':{name:'Bình',key:'PhongA'},'chi':{name:'Chi',key:'PhongB'}}}),
  _normTxt_:s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim(),
  buildSalesReportB_:f=>{calls.push(f);const want=(f.sale||[]).map(n=>ctx._normTxt_(n));
   const sales=o=>ctx._posSaleFractions_(o).map(x=>x);const matched=O.filter(o=>{const ss=ctx._posSaleFractions_(o);if(!want.length)return true;return ss.some(x=>want.indexOf(ctx._normTxt_(x.name))>=0)});
   const bySale={};let tg=0;matched.forEach(o=>{tg+=o.giaTriSauGiam;const ss=ctx._posSaleFractions_(o);const list=ss.length?ss:[{name:'(chưa gán sale)',frac:1}];list.forEach(s=>{if(want.length&&want.indexOf(ctx._normTxt_(s.name))<0)return;const b=bySale[s.name]||(bySale[s.name]={orders:0,giaTri:0});b.orders+=1;b.giaTri+=o.giaTriSauGiam*s.frac})});
   return {totalOrders:matched.length,totalGiaTri:tg,bySale:Object.keys(bySale).filter(k=>k!=='(chưa gán sale)').map(k=>({name:k,orders:bySale[k].orders,giaTri:bySale[k].giaTri})),orders:matched}},
  _salePersonIdentity_:obs=>({key:n=>ctx._normTxt_(n),primary:n=>String(n).trim(),members:n=>[n]}),_userDeptKeys_:null,_profNames_:null,normPhone_:null,_posSaleFractions_:null,_reportCacheKey_:null};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 // _profNames_ thật phụ thuộc alias Pancake → dùng bản đơn giản cho test (tên + names)
 vm.runInContext("_profNames_=function(u){var a=[u.name].concat(u.names||[]);var o=[],s={};a.forEach(function(n){var k=_normTxt_(n);if(n&&k&&!s[k]){s[k]=1;o.push(n)}});return o};",ctx);
 return {ctx,calls}}
let m=mk(),c=m.ctx;const get=(tok,act,p)=>c.splitDoGet_(act,Object.assign({token:tok},p||{}));
// _splitSales_
ok(c._splitSales_(O[0]).length===2&&c._splitSales_(O[1]).length===1&&c._splitSales_(O[4]).length===0,'đơn chia = ≥2 sale thật; đơn 1 sale / không sale thì không');
ok(Math.abs(c._splitSales_(O[3])[0].frac-0.15)<1e-9,'đơn quầy 30/70 có 2 sale: mỗi người 15% giá trị (frac đã nhân saleRatio)');
// báo cáo M — Admin
let r=get('tBoss','splitOrderReport',{dateFrom:'2026-10-01',dateTo:'2026-10-31'});
ok(r.ok&&r.scope==='all'&&r.total.orders===6&&r.total.revenue===8300000&&r.total.aov===1383333,'M·Admin: tổng đơn thực tế 6, doanh thu 8.300.000, TB/đơn 1.383.333 (khớp Báo cáo B)');
ok(r.total.splitOrders===3&&r.total.splitValue===5000000&&r.total.splitRevenue===4300000&&r.total.splitPctOrders===50,'M·Admin: 3 đơn chia (50% số đơn), giá trị gốc 5.000.000, doanh thu chia 4.300.000');
const row=n=>r.bySale.find(x=>x.name===n);
ok(row('An').orders===3&&row('An').revenue===4600000&&row('An').splitOrders===2&&row('An').splitRevenue===2600000&&row('An').splitAov===1300000&&row('An').splitPct===56.5,'M·An: 3 đơn, 4.6tr; 2 đơn chia, DT chia 2.6tr (500k + 2.1tr), TB 1.3tr, 56.5%');
ok(row('Bình').splitOrders===2&&row('Bình').splitRevenue===650000&&row('Bình').splitAov===325000&&row('Bình').splitPct===100,'M·Bình: đơn chia gồm đơn quầy 30/70 (chỉ 150k phần sale) → 650.000');
ok(row('Chi').splitRevenue===1050000&&row('Dung').splitOrders===0&&row('Dung').splitAov===0&&row('Dung').splitPct===0,'M·Chi 1.05tr; Dung không có đơn chia → 0, không chia cho 0');
ok(r.bySale[0].name==='An'&&r.bySale[1].name==='Chi'&&r.bySale[2].name==='Bình','M: xếp theo doanh thu từ đơn chia giảm dần (An 2.6tr → Chi 1.05tr → Bình 650k)');
ok(r.bySale.reduce((s,x)=>s+x.splitRevenue,0)===r.total.splitRevenue,'M: tổng các dòng sale = tổng doanh thu đơn chia ở trên cùng (không lệch)');
// phân quyền
r=get('tAn','splitOrderReport',{});ok(r.scope==='scoped'&&r.total.orders===3&&r.bySale.length===1&&r.bySale[0].name==='An','M·nhân viên: chỉ thấy phần của mình (3 đơn của An)');
r=get('tAn','splitOrderReport',{sale:'Dung,Chi'});ok(r.bySale.length===0&&r.total.orders===0&&r.warnings[0].includes('khong co quyen'),'M·nhân viên gửi sale=Dung,Chi (ngoài phạm vi) → KHÔNG xem được, trả rỗng + cảnh báo');
r=get('tLd','splitOrderReport',{});ok(r.bySale.map(x=>x.name).sort().join()==='An,Bình'&&r.scope==='scoped','M·Trưởng team T1: thấy An + Bình (team mình), không thấy Chi/Dung');
r=get('tMg','splitOrderReport',{});ok(r.bySale.map(x=>x.name).sort().join()==='An,Bình','M·Quản lý PhongA: thấy An + Bình (phòng mình phụ trách)');
r=get('tCeo','splitOrderReport',{});ok(r.scope==='all'&&r.bySale.length===4,'M·CEO: thấy tất cả');
r=get('tGhost','splitOrderReport',{});ok(r.total.orders===0&&r.warnings[0].includes('chua gan ten'),'M·tài khoản chưa gán tên sale: rỗng + báo rõ');
ok(get('','splitOrderReport',{}).code==='AUTH'&&get('xxx','splitOrderMine',{}).code==='AUTH','không token / token sai → AUTH (không lộ số liệu)');
// danh sách đơn chia của tôi
r=get('tAn','splitOrderMine',{dateFrom:'2026-10-01',dateTo:'2026-10-31'});
ok(r.ok&&r.all===false&&r.summary.orders===2&&r.summary.revenue===2600000&&r.summary.value===4000000&&r.summary.customers===2,'Mine·An: 2 đơn chia, DT từ đơn chia 2.600.000, giá trị gốc 4.000.000, 2 khách');
ok(r.items.map(x=>x.phone).join()==='0911000003,0911000001'&&r.items[0].share===2100000&&r.items[0].frac===0.7&&r.items[0].withSales.join()==='Chi'&&r.items[1].withSales.join()==='Bình','Mine·An: danh sách mới→cũ, có khách, phần của mình, ai chia cùng (Chi / Bình)');
ok(!r.items.some(x=>x.phone==='0911000002'),'Mine·An: đơn 1 mình An (khách 2) KHÔNG nằm trong danh sách đơn chia');
r=get('tDung','splitOrderMine',{});ok(r.summary.orders===0&&r.items.length===0,'Mine·Dung không có đơn chia: rỗng, summary 0');
r=get('tBoss','splitOrderMine',{});ok(r.all===true&&r.summary.orders===3&&r.items.every(x=>x.withSales.length>=2),'Mine·Admin: thấy cả 3 đơn chia (kèm danh sách sale trên đơn)');
r=get('tGhost','splitOrderMine',{});ok(r.summary.orders===0&&r.note.includes('chua gan'),'Mine·tài khoản chưa gán tên: rỗng + ghi chú');
// mặc định kỳ = tháng này; cache
m=mk();c=m.ctx;get('tAn','splitOrderMine',{});ok(m.calls[0].dateFrom==='2026-10-01'&&m.calls[0].dateTo==='2026-10-15','không gửi ngày → mặc định THÁNG NÀY (01 → hôm nay)');
m.calls.length=0;get('tAn','splitOrderMine',{});get('tAn','splitOrderMine',{});ok(m.calls.length===0,'cache 120s: lần 2-3 không tính lại');
m=mk();c=m.ctx;get('tAn','splitOrderReport',{});get('tDung','splitOrderReport',{});ok(m.calls.length===2,'cache theo phạm vi: người khác nhau không dùng chung kết quả');
// nối dây
ok(/SPLIT_GET_ACTIONS_\[action\] === 1\) return splitDoGet_\(action, p\)/.test(src)&&/splitOrderReport:'salesreport'/.test(src),'doGet có route; splitOrderReport gắn hạng mục "salesreport" (Admin chặn theo Phân quyền)');
ok(fs.existsSync('gas/31_SplitOrders.gs')&&fs.readFileSync('gas/31_SplitOrders.gs','utf8').includes('function splitOrderReport_('),'gas/31_SplitOrders.gs đã sinh');
process.exit(bad?1:0);

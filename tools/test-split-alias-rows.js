// Test (2026-10-23): Bao cao M khong cong don chia cho sale khi TEN CHINH (don.saleShares/saleBanValid) khac TEN GOC tren Pos (rb.bySale).
// Ca that: don 749T10/2026 the "thuydinh95, ninhLTK1984" (13.622.000). Chay ham THAT trong gas_v13.js.
const fs=require('fs'),vm=require('vm');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const src=fs.readFileSync('gas_v13.js','utf8');
function fn(name){const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('thieu '+name);let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1)}}}
const code=['_posSaleFractions_','_splitSales_','_splitIdentityFor_','_splitRowFinder_'].map(fn).join('\n');
const ALIAS={thuydinh95:'thuydinh1995',thuydinh1995:'thuydinh1995',ninhltk1984:'ninhLTK',ninhltk:'ninhLTK'}; // ten goc -> ten chinh; ten khac = chinh no
const ctx={Object,String,Math,_normTxt_:s=>String(s==null?'':s).trim().toLowerCase(),
 _salePersonIdentity_:()=>({key:n=>(ALIAS[String(n).trim().toLowerCase()]||String(n).trim()).toLowerCase(),primary:n=>ALIAS[String(n).trim().toLowerCase()]||String(n).trim()}),SPLIT_UNASSIGNED_:'(chưa gán sale)'};
vm.createContext(ctx);vm.runInContext(code,ctx);
// Don that: build tra ten CHINH trong saleShares/saleBanValid
const order={giaTriSauGiam:13622000,saleBanValid:'thuydinh1995,ninhLTK'};
const by={thuydinh95:{name:'thuydinh95',orders:19,splitOrders:0,splitRevenue:0},ninhLTK1984:{name:'ninhLTK1984',orders:17,splitOrders:0,splitRevenue:0},ninhnga99:{name:'ninhnga99',orders:151,splitOrders:0,splitRevenue:0}};
const rowOf=ctx._splitRowFinder_(by,[order]);
const ss=ctx._splitSales_(order);
ok(ss.length===2,'don co 2 NGUOI khac nhau => don chia');
// hanh vi CU (so khop chuoi ten) -> khong tim thay dong
ok(ss.every(s=>!by[s.name]),'[tai hien loi] so khop chuoi: ten chinh khong trung ten goc => khong dong nao duoc cong');
ss.forEach(s=>{const r=rowOf(s.name);if(r){r.splitOrders+=1;r.splitRevenue+=order.giaTriSauGiam*s.frac}});
ok(by.thuydinh95.splitOrders===1&&by.ninhLTK1984.splitOrders===1,'SAU SUA: ca 2 dong goc (thuydinh95, ninhLTK1984) deu duoc dem 1 don chia');
ok(Math.round(by.thuydinh95.splitRevenue+by.ninhLTK1984.splitRevenue)===13622000,'tong phan chia = gia tri don (13.622.000), khong that thoat');
ok(by.ninhnga99.splitOrders===0,'sale khong lien quan khong bi cong');
// ten chinh trung ten goc: van cong dung dong
const r2=ctx._splitRowFinder_({An:{name:'An',orders:1}},[{saleBanValid:'An,Bình'}]);ok(r2('An').name==='An'&&r2('Zed')===null,'ten trung -> dong do; nguoi la -> null');
// 2 ten cua CUNG 1 nguoi tren don => 1 nguoi => KHONG phai don chia
ok(ctx._splitSales_({giaTriSauGiam:1,saleBanValid:'thuydinh1995'}).length===1,'1 nguoi (2 ten da gop thanh 1 ten chinh) khong phai don chia');
// 2 dong goc cung 1 nguoi -> cong vao dong co nhieu don nhat, khong cong 2 lan
const by2={thuydinh95:{name:'thuydinh95',orders:5},thuydinh1995:{name:'thuydinh1995',orders:30}};
ok(ctx._splitRowFinder_(by2,[])('ninhLTK')===null&&ctx._splitRowFinder_(by2,[])('thuydinh1995').orders===30,'trung ten chinh uu tien dong trung ten');
const by3={thuydinh95:{name:'thuydinh95',orders:5},thuydinh1995x:{name:'thuydinh1995x',orders:30}};
ok(ctx._splitRowFinder_(by3,[])('thuydinh1995').orders===5,'khong co dong trung ten -> dong cung nguoi');
console.log(bad?('FAILED '+bad):'ALL PASS');process.exit(bad?1:0);

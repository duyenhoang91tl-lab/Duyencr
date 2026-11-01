// Test luật hoa hồng kênh NGUỒN theo chất liệu vàng (Duyên yêu cầu 2026-10): Nguồn + vàng 10k = 1,5%, vàng 14k = 1%, KHÔNG phụ thuộc giá trị đơn.
// Phần 1 = backend GAS (hàm thật trong gas_v13.js). Phần 2 = web (js/01-fn-splitmulti.js: _computeCommissionData_ của Báo cáo E).
const fs=require('fs'),vm=require('vm');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
function fn(src,name){const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('thiếu '+name);let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1)}}}
const gas=fs.readFileSync('gas_v13.js','utf8');
const gctx={String,RegExp,Array,Object,Number};vm.createContext(gctx);
vm.runInContext(gas.match(/var GOLD_RULE_CHANNELS_ = [^\n]*/)[0]+'\n'+gas.match(/var GOLD_RULE_MATERIALS_ = [^\n]*/)[0]+'\n'+['_bcFold_','_goldChannelRule_','_csChannelCommissionOf_'].map(n=>fn(gas,n)).join('\n'),gctx);
const R=(k,sp)=>gctx._goldChannelRule_(k,sp);
ok(R('Nguồn','Nhẫn vàng 10k')&&R('Nguồn','Nhẫn vàng 10k').rate===1.5&&R('Nguồn','Nhẫn vàng 10k').label==='vàng 10k','GAS: kênh Nguồn + vàng 10k → 1,5%');
ok(R('Nguồn','Dây chuyền vàng 14K').rate===1&&R('nguon','Lắc tay vàng 14k').rate===1,'GAS: kênh Nguồn + vàng 14k → 1% (không phân biệt hoa/thường, có dấu/không dấu)');
ok(R('Nguồn','Nhẫn 10 K')&&R('Nguồn','Nhẫn 10 K').rate===1.5&&R('NGUỒN','nhan 10K cz')&&R('NGUỒN','nhan 10K cz').rate===1.5,'GAS: viết "10 K" có cách, "10K" hoa → vẫn nhận');
const mx=R('Nguồn','Nhẫn 10k + Vòng 14k');ok(mx&&mx.rate===1&&mx.mixed===true,'GAS: đơn có CẢ 10k và 14k → lấy mức THẤP (1%) và đánh dấu mixed để đối chiếu');
ok(R('Nguồn','Nhẫn bạc S925')===null&&R('Nguồn','')===null&&R('Nguồn',null)===null,'GAS: kênh Nguồn nhưng không có 10k/14k (hoặc không có sản phẩm) → null (tính như cũ, theo mốc 15tr)');
ok(R('Facebook','Nhẫn vàng 10k')===null&&R('Zalo','vàng 14k')===null&&R('Quầy Hảo Nam','vàng 10k')===null&&R('','vàng 10k')===null,'GAS: kênh KHÁC (Facebook/Zalo/Quầy…) không bị ảnh hưởng dù có vàng 10k/14k');
ok(R('Nguồn hàng','vàng 14k')&&R('Nguồn hàng','vàng 14k').rate===1&&R('Nguồn Facebook','10k')&&R('Nguồn Facebook','10k').rate===1.5,'GAS: tên kênh bắt đầu bằng "Nguồn " (vd "Nguồn hàng") cũng áp dụng');
ok(R('Nguồnxx','10k')===null&&R('Mua Nguồn','10k')===null,'GAS: không nhận nhầm kênh chỉ chứa chữ "nguon" ở giữa/dính liền');
ok(R('Nguồn','Combo 110k')===null&&R('Nguồn','Nhẫn 10kg')===null&&R('Nguồn','S10kx')===null&&R('Nguồn','Tặng voucher 100k')===null,'GAS: không nhận nhầm 110k / 10kg / 10kx / 100k');
ok(R('Nguồn','vang10k')&&R('Nguồn','vang10k').rate===1.5,'GAS: "vang10k" dính liền chữ vẫn nhận');
// _csChannelCommissionOf_: luật vàng đứng TRƯỚC % kênh admin cài; kênh khác dùng % admin; null → mốc 15tr
const chRate=k=>String(k).toLowerCase()==='facebook'?1:(String(k).toLowerCase()==='nguồn'?3:null);
let c=gctx._csChannelCommissionOf_({nguonDon:'Nguồn',sanPham:'Nhẫn vàng 10k'},chRate);ok(c.rate===1.5&&c.key==='Nguồn · vàng 10k','GAS: luật vàng ĐÈ % kênh admin đã cài cho "Nguồn" (3% → 1,5%); khoá thống kê "Nguồn · vàng 10k"');
c=gctx._csChannelCommissionOf_({nguonDon:'Nguồn',sanPham:'Nhẫn bạc'},chRate);ok(c.rate===3&&c.key==='Nguồn','GAS: đơn Nguồn không vàng 10k/14k → vẫn theo % kênh admin cài (3%)');
c=gctx._csChannelCommissionOf_({nguonDon:'Facebook',sanPham:'vàng 10k'},chRate);ok(c.rate===1&&c.key==='Facebook','GAS: Facebook giữ nguyên 1%');
ok(gctx._csChannelCommissionOf_({nguonDon:'Zalo',sanPham:'vàng 14k'},chRate)===null,'GAS: kênh không có % riêng → null (tính theo mốc 15tr)');
c=gctx._csChannelCommissionOf_({nguonDon:'Nguồn',sanPham:'10k + 14k'},chRate);ok(c.rate===1&&c.key.includes('mức thấp'),'GAS: đơn lẫn 10k+14k: khoá thống kê ghi rõ "mức thấp"');
// KHÔNG phụ thuộc giá trị đơn: hàm không nhận giá trị; vòng lặp đã gọi trước nhánh "giaTri >= T"
const loop=gas.slice(gas.indexOf('var chC = _csChannelCommissionOf_(o, channelRate);'));
ok(loop.indexOf('if (chC !== null)')<loop.indexOf('else if (giaTri >= T)')&&loop.indexOf('if (chC !== null)')>0,'GAS: vòng lặp xét luật kênh/vàng TRƯỚC mốc 15tr → không phụ thuộc giá trị đơn');
ok(!/var chR = channelRate\(o\.nguonDon\);/.test(gas),'GAS: không còn đường tính % kênh cũ bỏ qua luật vàng');
ok(/ver: 'v13\.\d+-[a-z0-9-]+'/.test(gas),'có ver để đối chiếu action=count');

// ── Phần 2: WEB (js/01-fn-splitmulti.js) — _goldChannelRule_ + _computeCommissionData_ (Báo cáo E) với đơn mẫu ──
const js=fs.readFileSync('js/01-fn-splitmulti.js','utf8');
const wctx={String,RegExp,Array,Object,Number,Math,isNaN,
  COMMISSION_THRESHOLD:15000000,CHANNEL_COMMISSION_RATES:{},
  _resolveCommissionRate_:()=>({above15:2,below15:1,sourceAbove15:'mac dinh',sourceBelow15:'mac dinh'})};
vm.createContext(wctx);
vm.runInContext(js.match(/var GOLD_RULE_CHANNELS = [^\n]*/)[0]+'\n'+js.match(/var GOLD_RULE_MATERIALS = [^\n]*/)[0]+'\n'+['splitMulti_','isNumTagSale_','_goldFold_','_goldChannelRule_','_channelCommissionRate_','_computeCommissionData_'].map(n=>fn(js,n)).join('\n'),wctx);
const W=(k,sp)=>wctx._goldChannelRule_(k,sp);
// cùng bộ ca với backend → web và GAS PHẢI cho kết quả giống nhau
const cases=[['Nguồn','Nhẫn vàng 10k'],['Nguồn','Dây chuyền vàng 14K'],['nguon','Lắc tay vàng 14k'],['Nguồn','Nhẫn 10 K'],['NGUỒN','nhan 10K cz'],['Nguồn','Nhẫn 10k + Vòng 14k'],['Nguồn','Nhẫn bạc S925'],['Nguồn',''],['Nguồn',null],['Facebook','Nhẫn vàng 10k'],['Zalo','vàng 14k'],['Quầy Hảo Nam','vàng 10k'],['','vàng 10k'],['Nguồn hàng','vàng 14k'],['Nguồn Facebook','10k'],['Nguồnxx','10k'],['Mua Nguồn','10k'],['Nguồn','Combo 110k'],['Nguồn','Nhẫn 10kg'],['Nguồn','S10kx'],['Nguồn','Tặng voucher 100k'],['Nguồn','vang10k']];
const same=cases.every(([k,sp])=>JSON.stringify(W(k,sp))===JSON.stringify(R(k,sp)));
ok(same,'WEB = GAS: cùng '+cases.length+' ca (kênh/sản phẩm) cho CÙNG kết quả luật vàng — không lệch giữa Báo cáo E và thống kê backend');
ok(W('Nguồn','Nhẫn vàng 10k').rate===1.5&&W('Nguồn','Dây chuyền vàng 14K').rate===1&&W('Facebook','vàng 10k')===null,'WEB: Nguồn+10k=1,5% ; Nguồn+14k=1% ; kênh khác không ảnh hưởng');
// Báo cáo E: đơn mẫu — KHÔNG phụ thuộc giá trị đơn (2tr, 20tr, 100tr đều cùng %)
const mk=(sale,val,nguon,sp,extra)=>Object.assign({saleBan:sale,giaTriDon:val,nguonDon:nguon,sanPham:sp},extra||{});
let d=wctx._computeCommissionData_([mk('An',2000000,'Nguồn','Nhẫn vàng 10k'),mk('An',20000000,'Nguồn','Nhẫn vàng 10k'),mk('An',100000000,'Nguồn','Nhẫn vàng 10k')]);
let r=d.bySale[0];ok(Math.round(r.channelCommission)===1830000&&r.channelRevenue===122000000&&r.ordersAbove15===0&&r.ordersBelow15===0,'E·Nguồn+vàng 10k: 2tr / 20tr / 100tr đều 1,5% → 122tr × 1,5% = 1.830.000đ; KHÔNG vào nhóm ≥15tr / <15tr');
d=wctx._computeCommissionData_([mk('An',2000000,'Nguồn','Dây chuyền vàng 14k'),mk('An',50000000,'Nguồn','Lắc vàng 14K')]);r=d.bySale[0];ok(Math.round(r.channelCommission)===520000&&r.channelRevenue===52000000,'E·Nguồn+vàng 14k: 2tr và 50tr đều 1% → 52tr × 1% = 520.000đ');
d=wctx._computeCommissionData_([mk('An',3000000,'Nguồn','Nhẫn bạc'),mk('An',30000000,'Nguồn','Nhẫn bạc')]);r=d.bySale[0];
ok(r.channelRevenue===0&&r.ordersBelow15===1&&r.ordersAbove15===1&&Math.round(r.revenueAbove15*0.02+r.revenueBelow15*0.01)===Math.round(r.commission),'E·đơn Nguồn KHÔNG có vàng 10k/14k: tính như cũ theo mốc 15tr (30tr ×2% + 3tr ×1%)');
d=wctx._computeCommissionData_([mk('An',20000000,'Zalo','Nhẫn vàng 10k'),mk('An',2000000,'Facebook','Nhẫn vàng 10k')]);r=d.bySale[0];
ok(r.ordersAbove15===1&&r.channelRevenue===2000000&&Math.round(r.channelCommission)===20000,'E·kênh khác Nguồn giữ nguyên: Zalo+10k vẫn theo mốc 15tr; Facebook vẫn 1% mặc định');
wctx.CHANNEL_COMMISSION_RATES={'nguồn':3};
d=wctx._computeCommissionData_([mk('An',10000000,'Nguồn','Nhẫn vàng 10k'),mk('An',10000000,'Nguồn','Nhẫn bạc')]);r=d.bySale[0];
ok(Math.round(r.channelCommission)===450000&&Object.keys(r.channelBreakdown).sort().join('|')==='Nguồn|Nguồn · vàng 10k','E·Admin đã cài % riêng "Nguồn" = 3%: đơn vàng 10k vẫn 1,5% (150.000đ, luật vàng đè), đơn bạc theo 3% (300.000đ)');
wctx.CHANNEL_COMMISSION_RATES={};
d=wctx._computeCommissionData_([mk('An',10000000,'Nguồn','Nhẫn vàng 10k'),mk('An',10000000,'Nguồn','Nhẫn vàng 14k'),mk('An',10000000,'Nguồn','Nhẫn 10k + vòng 14k')]);r=d.bySale[0];
const bk=r.channelBreakdown;ok(bk['Nguồn · vàng 10k'].rate===1.5&&bk['Nguồn · vàng 14k'].rate===1&&Object.keys(bk).some(k=>k.includes('mức thấp'))&&Math.round(r.channelCommission)===350000,'E·chi tiết theo kênh tách riêng "Nguồn · vàng 10k" 1,5% / "Nguồn · vàng 14k" 1% / đơn lẫn 10k+14k ghi "mức thấp" → tổng 150k+100k+100k = 350.000đ');
d=wctx._computeCommissionData_([mk('An,Bình',10000000,'Nguồn','Nhẫn vàng 10k')]);ok(d.bySale.length===2&&d.bySale.every(x=>Math.round(x.channelCommission)===75000),'E·đơn chia 2 sale (An, Bình): mỗi người nửa doanh thu 5tr × 1,5% = 75.000đ');
d=wctx._computeCommissionData_([mk('An',10000000,'Nguồn','Nhẫn vàng 10k',{saleRatio:0.3})]);ok(Math.round(d.bySale[0].channelCommission)===45000,'E·đơn quầy 30/70 (saleRatio 0,3): 10tr × 30% × 1,5% = 45.000đ');
d=wctx._computeCommissionData_([mk('An',10000000,'Nguồn','Nhẫn vàng 10k'),mk('An',5000000,'Zalo','x')]);ok(d.totalOrdersChannel===1&&d.totalRevenueChannel===10000000&&d.totalOrdersBelow15===1,'E·các thẻ TỔNG: đơn Nguồn vàng tính vào nhóm "kênh có % riêng", không lẫn nhóm <15tr');

process.exit(bad?1:0);

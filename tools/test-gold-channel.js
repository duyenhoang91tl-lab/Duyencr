// Test luật hoa hồng kênh NGUỒN theo chất liệu vàng (Duyên yêu cầu 2026-10): Nguồn + vàng 10k = 1,5%, vàng 14k = 1%, KHÔNG phụ thuộc giá trị đơn.
// Phần 1 = backend GAS (hàm thật trong gas_v13.js). Phần 2 = web (js/01-fn-splitmulti.js) — thêm ở bước 2.
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
process.exit(bad?1:0);

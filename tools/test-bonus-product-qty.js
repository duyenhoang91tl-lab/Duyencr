// Test _bonusProductQty_ (js/12): đếm theo dòng SP, không đếm đôi, đọc Số lượng, TOUR/AQUA/MOON, loại chất liệu ngọc.
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(__dirname+'/../js/12-fn-rendersalesreporttabe.js','utf8');
const i=src.indexOf('\nfunction _bonusProductQty_('),fn=src.slice(i+1,src.indexOf('\n}\n',i)+3);
const c={};vm.createContext(c);vm.runInContext(fn,c);
const q=(s,k,n,e)=>c._bonusProductQty_(s,k,n,e);
const MOON='tỳ hưu thiên lộc+moon, thmoon',TOUR='tỳ hưu thiên lộc+tour',AQUA='tỳ hưu thiên lộc+aqua',EX='ngọc bích, cẩm thạch, lam thủy, ruby, saphire';
let bad=0;const ok=(n,a,b)=>{if(a!==b){bad++;console.log('FAIL',n,a,'!=',b);}else console.log('ok  ',n);};
ok('Moon 1 nhẫn = 1 (không đếm đôi)',q('TRANG SỨC NHẪN TỲ HƯU THIÊN LỘC MOON SIZE 1',MOON,'',EX).qty,1);
ok('Tour mặt cổ + dây chuyền = 1',q('TRANG SỨC MẶT CỔ TỲ HƯU THIÊN LỘC TOUR SIZE 1 ,TRANG SỨC DÂY CHUYỀN MẪU V SIZE 1',TOUR,'1 ,1',EX).qty,1);
ok('Nhẫn + lắc (TOUR/MIX BI) = 2',q('TRANG SỨC NHẪN TỲ HƯU THIÊN LỘC TOUR SIZE 1 ,TRANG SỨC LẮC TỲ HƯU THIÊN LỘC (TOUR/MIX BI) ,QUÀ HỘP',TOUR,'1 ,1 ,1',EX).qty,2);
ok('Aqua mặt cổ = 1',q('TRANG SỨC MẶT CỔ TỲ HƯU THIÊN LỘC AQUA SIZE 1',AQUA,'',EX).qty,1);
ok('Aqua túi tiền (không phải Tỳ hưu) = không khớp',q('TRANG SỨC NHẪN TÚI TIỀN (AQUA)',AQUA,'',EX).matched,false);
ok('Ngọc Bích không khớp Tour',q('TRANG SỨC NHẪN TỲ HƯU THIÊN LỘC NGỌC BÍCH SIZE 1',TOUR,'',EX).matched,false);
ok('Đọc cột Số lượng (2)',q('CHARM TỲ HƯU THIÊN LỘC TOUR SIZE 1 ,COMBO',TOUR,'2 ,1',EX).qty,2);
ok('Loại chất liệu bị trừ',q('NHẪN TỲ HƯU THIÊN LỘC TOUR RUBY',TOUR,'',EX).matched,false);
ok('Tự do x2 = 2',q('Tỳ hưu x2, Vòng tay x1','tỳ hưu','','').qty,2);
process.exit(bad?1:0);

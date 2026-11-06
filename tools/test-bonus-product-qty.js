// Test _bonusProductQty_ (js/12): đếm theo từng dòng SP, không đếm đôi Moon, TOUR/AQUA trên Pos, loại chất liệu Ngọc, SL theo cột Số lượng. Chạy: node tools/test-bonus-product-qty.js
const fs = require('fs'), s = fs.readFileSync(__dirname + '/../js/12-fn-rendersalesreporttabe.js', 'utf8');
const f = new Function(s.match(/function _bonusProductQty_[\s\S]*?\n}\n/)[0] + ';return _bonusProductQty_')();
const MOON = 'Tỳ hưu thiên lộc Moon, Thiên Lộc Moon, THMoon', TOUR = 'Tourmaline Hồng, Tourmaline Xanh, Tỳ hưu thiên lộc+tour', AQUA = 'Aquamarine, Tỳ hưu thiên lộc+aqua';
let fail = 0; const eq = (n, a, e) => { const ok = JSON.stringify(a) === JSON.stringify(e); if (!ok) fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok ? '' : ' → ' + JSON.stringify(a))); };
eq('1 nhẫn Moon = 1 (trước đây đếm đôi = 2)', f('TRANG SỨC NHẪN TỲ HƯU THIÊN LỘC MOON SIZE 1', MOON, '1'), {matched:true, qty:1});
eq('SL theo cột Số lượng: lắc TOUR x1 + charm TOUR x2 = 3', f('A ,TRANG SỨC LẮC TỲ HƯU THIÊN LỘC (TOUR/MIX BI) ,CHARM RƠI TỲ HƯU THIÊN LỘC MIX ĐỒNG TIỀN TOUR SIZE 1 ,B', TOUR, '1 ,1 ,2 ,1'), {matched:true, qty:3});
eq('loại chất liệu Ngọc (Lam Thủy / Ngọc Bích)', f('CHARM TỲ HƯU THIÊN LỘC LAM THỦY ,NHẪN TỲ HƯU THIÊN LỘC NGỌC BÍCH TOUR', TOUR, '1 ,1'), {matched:false, qty:0});
eq('AQUA khớp, "Nhẫn tour trơn cao cấp" KHÔNG tính Tỳ hưu', f('MẶT CỔ TỲ HƯU THIÊN LỘC AQUA ,NHẪN TOUR TRƠN CAO CẤP', AQUA, '1 ,1'), {matched:true, qty:1});
eq('không khớp thì matched=false', f('NHẪN KIM 2027', MOON, '1'), {matched:false, qty:0});
eq('lệch số dòng/SL → mỗi dòng 1', f('NHẪN TỲ HƯU THIÊN LỘC MOON ,LẮC TỲ HƯU THIÊN LỘC MOON', MOON, '5'), {matched:true, qty:2});
process.exit(fail ? 1 : 0);

// Test: Báo cáo G (thưởng) lấy dữ liệu theo NGÀY LÊN ĐƠN TRÊN BASE của đơn gốc (có đơn trên Pos) — Duyên yêu cầu 2026-11-02.
// Hàm thật từ js/12 (cửa sổ ngày) + kiểm tra nối dây trong js/11. Chạy: node tools/test-bonus-base-window.js
const fs=require('fs'),vm=require('vm');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
function fn(src,name){const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('thiếu '+name);let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1)}}}
const j12=fs.readFileSync('js/12-fn-rendersalesreporttabe.js','utf8'),j01=fs.readFileSync('js/01-fn-splitmulti.js','utf8'),j11=fs.readFileSync('js/11-fn-srload.js','utf8');
const ctx={String,Date,Math,Object,Array,RegExp,Number};vm.createContext(ctx);
vm.runInContext(j12.match(/var BONUS_POS_LAG_DAYS = [^\n]*/)[0]+'\n'+['_srGAddDays_','_srGPosTo_','_srGFilterByBaseDate_','_ddmmyyyyToYmd_','_bonusNamesOfOrder_'].map(n=>fn(j12,n)).join('\n')+'\n'+['splitMulti_','isNumTagSale_'].map(n=>fn(j01,n)).join('\n'),ctx);
// — ngày —
ok(ctx._srGAddDays_('2026-10-16',30)==='2026-11-15'&&ctx._srGAddDays_('2026-12-20',30)==='2027-01-19'&&ctx._srGAddDays_('2026-02-10',30)==='2026-03-12'&&ctx._srGAddDays_('2026-10-16',-6)==='2026-10-10','cộng ngày qua tháng/năm/tháng 2 đúng (30 ngày sau 16/10 = 15/11; 20/12 → 19/01/2027)');
ok(ctx._srGPosTo_('2026-10-16')==='2026-11-15'&&ctx._srGPosTo_('')===''&&ctx._srGPosTo_(undefined)===undefined,'kéo khung Pos thêm 30 ngày; không có ngày kết thúc thì giữ nguyên (không lọc)');
ok(ctx.BONUS_POS_LAG_DAYS===30,'độ trễ Pos tối đa mặc định 30 ngày');
// — lọc theo ngày Base —
const FROM='2026-10-10',TO='2026-10-16';
const mk=(id,base,pos,extra)=>Object.assign({id,saleBan:'haPTN',baseNgayTao:base,ngayTao:pos,donGoc:!!base},extra||{});
const O=[mk('A','2026-10-12','12/10/2026 09:00'),mk('B','2026-10-15','20/10/2026 10:30'),mk('C','2026-10-08','11/10/2026 08:00'),mk('D','2026-10-17','17/10/2026 08:00'),mk('E','','13/10/2026 08:00'),mk('F','','20/10/2026 08:00'),mk('G','2026-10-16','16/10/2026 23:00'),mk('H','2026-10-10','10/10/2026 00:10')];
let r=ctx._srGFilterByBaseDate_(O,FROM,TO),ids=r.orders.map(o=>o.id).sort().join('');
ok(ids==='ABEGH','giữ: A (Base 12/10), B (Base 15/10 nhưng Pos nhập MUỘN 20/10), E (chưa ghép Base, Pos 13/10), G+H (đúng biên 16/10 và 10/10)');
ok(r.info.basis==='base'&&r.info.total===8&&r.info.kept===5&&r.info.dropBefore===1&&r.info.dropAfter===2&&r.info.extra===1,'thống kê: 8 đơn → giữ 5; loại 1 đơn Base trước kỳ (C) + 2 sau kỳ (D Base 17/10, F Pos 20/10 chưa có Base); kéo thêm 1 đơn Pos nhập muộn (B)');
ok(!ids.includes('C')&&!ids.includes('D')&&!ids.includes('F'),'đơn lên Base 08/10 (dù Pos nhập 11/10 trong kỳ) bị loại khỏi kỳ này — thuộc kỳ trước theo ngày Base');
// không đổi hành vi khi không có thông tin Base / không lọc ngày
const noBase=[mk('X','','12/10/2026'),mk('Y','','30/10/2026')];r=ctx._srGFilterByBaseDate_(noBase,FROM,TO);ok(r.orders.length===2&&r.info.basis==='pos','backend cũ / không có đơn nào ghép Base → GIỮ NGUYÊN cách cũ (theo ngày Pos), không lọc');
r=ctx._srGFilterByBaseDate_(O,'','');ok(r.orders.length===8&&r.info.basis==='pos','không chọn khoảng ngày → không lọc');
r=ctx._srGFilterByBaseDate_(O,FROM,'');ok(r.orders.map(o=>o.id).sort().join('')==='ABDEFGH','chỉ có ngày bắt đầu: loại đơn Base trước kỳ (C), các đơn còn lại giữ');
ok(ctx._srGFilterByBaseDate_(null,FROM,TO).orders.length===0&&ctx._srGFilterByBaseDate_(undefined,FROM,TO).info.total===0,'danh sách rỗng/null không lỗi');
// — ca thực tế trong ảnh: Sale thử việc haPTN, ngày bắt đầu 10/10, lọc 10/10 → 16/10 —
const pos=O.filter(o=>o.id!=='X');                         // Pos đã kéo đến 15/11
const before=pos.filter(o=>ctx._ddmmyyyyToYmd_(o.ngayTao)>=FROM&&ctx._ddmmyyyyToYmd_(o.ngayTao)<=TO);   // cách CŨ: chỉ đơn Pos có ngày Pos trong kỳ
const after=ctx._srGFilterByBaseDate_(pos,FROM,TO).orders;
const has=(list,id)=>list.some(o=>o.id===id&&Object.keys(ctx._bonusNamesOfOrder_(o)).indexOf('haPTN')>=0);
ok(!has(before,'B')&&has(after,'B'),'CA TRONG ẢNH: đơn gốc haPTN lên Base 15/10, Pos nhập 20/10 — CÁCH CŨ bị sót (báo "không thấy đơn Pos nào mang tên Sale này"), CÁCH MỚI có trong khung tính thưởng');
ok(has(before,'C')&&!has(after,'C'),'đơn Base 08/10 (trước ngày bắt đầu 10/10) mà Pos nhập 11/10: cách cũ lọt vào kỳ, cách mới đúng là loại');
// — nối dây —
ok(/dateTo: _srGPosTo_\(_srState\.gDateTo\)/.test(j11)&&/_srGFilterByBaseDate_\(dPosG\.orders, _srState\.gDateFrom, _srState\.gDateTo\)/.test(j11)&&/dPosG\.baseBasis = flG\.info/.test(j11),'js/11 nhánh G: tải Pos với dateTo kéo thêm, rồi lọc theo ngày Base và lưu baseBasis để hiện ghi chú');
ok(j11.indexOf('_srGPosTo_(')<j11.indexOf('_srGFilterByBaseDate_(dPosG.orders')&&j11.indexOf('_srGFilterByBaseDate_(dPosG.orders')<j11.indexOf('_srState.dataG = dPosG'),'thứ tự: tải → lọc theo ngày Base → mới gán dataG (các báo cáo con G/K dùng chung dữ liệu đã lọc)');
process.exit(bad?1:0);

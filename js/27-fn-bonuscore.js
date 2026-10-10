// ════════════════════════════════════════════════════════════════════
//  LÕI ĐẾM SẢN PHẨM + VÒNG/CHARM MIX CHO THƯỞNG THEO ĐƠN (yêu cầu Duyên 2026-10-10)
//  !! BẢN SAO NGUYÊN VĂN nằm trong gas_v13.js (khối "BONUS CORE") — sửa 1 nơi PHẢI sửa cả 2 nơi.
//  Quy tắc:
//   • Vòng chuỗi cùng charm mix = 1 SẢN PHẨM (kể cả khi vòng có nhiều dây/charm). Charm mix chỉ tính là charm mix khi đơn CÓ vòng;
//     charm đứng riêng (vd charm mặt cổ) = sản phẩm riêng. Charm bi vàng KHÔNG tính là sản phẩm. Quà / dịch vụ / nguyên vật liệu không tính.
//   • Đơn có vòng (kể cả "HẠT NG...") = đơn vòng: thưởng vòng CHỈ khi doanh thu PHẦN VÒNG + CHARM MIX đạt mốc (15tr/20tr);
//     vòng dưới mốc không có thưởng vòng, nhưng vẫn là 1 sản phẩm khi đếm combo 2/3/4 sản phẩm (vòng 14tr + mặt cổ 1tr = 2 SP, đơn 15tr).
//   • Mỗi MÃ sản phẩm lưu 1 lần (BONUS_PRODUCT_MAP) → áp cho mọi đơn sau. Tinh chỉnh riêng từng đơn: BONUS_ORDER_OVR (slot SP, doanh thu dòng).
//  map[codeLower] = {vong:bool, charm:bool, skip:bool, gift:bool}  — có entry = Duyên đã xác nhận; không tích gì = sản phẩm thường.
//  ovr[COUNTER|codeLower] = {slot:'1'..'9'|'skip'|'gift', rev:number}
// ════════════════════════════════════════════════════════════════════
var BONUS_PRODUCT_MAP = (function(){ try { var v = loadLS('ome_bonus_prodmap'); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; } catch(e){ return {}; } })();
var BONUS_ORDER_OVR = (function(){ try { var v = loadLS('ome_bonus_orderovr'); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; } catch(e){ return {}; } })();

function _bcFold_(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'d').toLowerCase().replace(/\s+/g,' ').trim(); }
// Mã bộ đếm sạch từ dòng đầu ghi chú Pos (vd "17T10/2026") — rỗng nếu không phải dạng đơn gốc.
function _bcCounterOf_(ghiChu){
  var first = String(ghiChu == null ? '' : ghiChu).split(/[\r\n]/)[0].trim();
  var m = /^([A-Za-z]{0,3}\d{1,6}[A-Za-z]{0,3}T\d{1,2}\/\d{2,4})$/.exec(first);
  return m ? m[1].replace(/\s+/g,'').toUpperCase() : '';
}
// Đoán loại dòng khi CHƯA có trong map. Trả {cls:'vong'|'charm'|'skip'|'gift'|'prod'}.
function _bcGuess_(code, name){
  var c = _bcFold_(code), n = _bcFold_(name), t = n + ' ' + c;
  if (/bi vang|(^|[-\s])bv($|[-\s])|cv10k-bv/.test(t)) return 'skip';
  if (/^qua |^qhts|^la bo de|^la-bd|^cb-|combo|qua tang|hop qua|bao hanh|chi phi/.test(t)) return 'gift';
  if (/^(vong tay|vong ngoc|hat( |$))|^hd-|^hdd|^vt|vtnl/.test(n || c) || (!n && /^(hd|vt)/.test(c))) return 'vong';
  if (/^day thep|^dich vu|^nguyen vat lieu|^ttv |^them tien|^ship|^phi |^pkd/.test(n || c) || (!n && /^(dtcd|ttv|nvl-|pkd)/.test(c))) return 'skip';
  if (/cuon |ngu dieu/.test(t)) return 'vong';
  if (/^charm|^c[a-z]{1,4}-/.test(n === '' ? c : n)) return 'charm';
  return 'prod';
}
function _bcLineCls_(code, name, map){
  var e = map && map[String(code||'').toLowerCase()];
  if (e){
    if (e.skip) return {cls:'skip', auto:false};
    if (e.gift) return {cls:'gift', auto:false};
    if (e.vong) return {cls:'vong', auto:false};
    if (e.charm) return {cls:'charm', auto:false};
    return {cls:'prod', auto:false};
  }
  return {cls:_bcGuess_(code, name), auto:true};
}
// Tách dòng sản phẩm của 1 đơn Pos: mã ';' ghép vị trí với SL ',' (tên ',' chỉ dùng khi số tên = số mã).
function _bcOrderLines_(o){
  var codes = String(o.maSanPham||'').split(';').map(function(x){ return x.trim(); });
  var qtys = String(o.soLuong||'').split(',').map(function(x){ return x.trim(); });
  var names = String(o.sanPham||'').split(',').map(function(x){ return x.trim(); });
  var aligned = names.length === codes.length;
  var out = [];
  codes.forEach(function(c, i){
    if (!c) return;
    var q = Number(String(qtys[i]||'1').replace(',', '.'));
    if (!isFinite(q) || q <= 0) q = 1;
    if (q > 50) q = 1;   // dữ liệu lệch cột (vd "2001") → coi là 1, đơn nằm trong danh sách "cần kiểm tra"
    out.push({ code:c, name: aligned ? names[i] : '', qty:q, qtyOdd: Number(String(qtys[i]||'1').replace(',', '.')) > 50 });
  });
  return out;
}
// Thông tin đếm của 1 đơn. map/ovr mặc định lấy từ biến toàn cục.
function _bcOrderInfo_(o, map, ovr){
  map = map || BONUS_PRODUCT_MAP; ovr = ovr || BONUS_ORDER_OVR;
  var counter = _bcCounterOf_(o.ghiChu);
  var total = Number(o.giaTriDon != null ? o.giaTriDon : o.giaTriSauGiam) || 0;
  var lines = _bcOrderLines_(o), reasons = [];
  lines.forEach(function(l){
    var k = (counter ? counter + '|' : '') + l.code.toLowerCase();
    var ov = (counter && ovr && ovr[k]) || {};
    var cl = _bcLineCls_(l.code, l.name, map);
    l.cls = cl.cls; l.auto = cl.auto; l.slot = ov.slot || '';
    if (l.slot === 'skip') l.cls = 'skip'; else if (l.slot === 'gift') l.cls = 'gift';
    l.rev = (ov.rev !== undefined && ov.rev !== '' && ov.rev !== null) ? Number(ov.rev) : null;
  });
  var hasVong = lines.some(function(l){ return l.cls === 'vong'; });
  lines.forEach(function(l){ if (l.cls === 'charm' && !hasVong) l.cls = 'prod'; });   // charm đứng riêng = sản phẩm riêng
  var vongLines = lines.filter(function(l){ return l.cls === 'vong' || l.cls === 'charm'; });
  var prodLines = lines.filter(function(l){ return l.cls === 'prod'; });
  var slots = {}, nProd = 0;
  prodLines.forEach(function(l){
    if (/^[0-9]+$/.test(String(l.slot||''))){ if (!slots[l.slot]){ slots[l.slot] = true; nProd += 1; } }
    else nProd += l.qty;
  });
  var nProducts = (hasVong ? 1 : 0) + nProd;
  var vongRev = null;
  if (hasVong){
    if (!prodLines.length) vongRev = total;
    else if (prodLines.every(function(l){ return l.rev !== null; })) vongRev = total - prodLines.reduce(function(s,l){ return s + l.rev; }, 0);
    else if (total >= 15000000) reasons.push('Đơn vòng ≥15tr có sản phẩm khác — nhập doanh thu từng dòng ở tab "Chi tiết thưởng" để tính mốc 15tr phần vòng + charm mix.');
  }
  var unconfirmed = lines.filter(function(l){ return l.auto; }).length;   // số dòng còn ĐOÁN TỰ ĐỘNG (chưa lưu trong BONUS_PRODUCT_MAP) — chỉ để hiển thị ở tab, không chặn tính thưởng
  if (lines.some(function(l){ return l.qtyOdd; })) reasons.push('Số lượng bất thường (lệch cột) — kiểm tra lại.');
  if (!lines.length) reasons.push('Đơn không có mã sản phẩm.');
  return { counter:counter, total:total, lines:lines, hasVong:hasVong, nProducts:nProducts, vongRev:vongRev, needReview:reasons.length>0, reasons:reasons, unconfirmed:unconfirmed };
}
// Số sản phẩm tối thiểu của CT "Đơn từ Xtr (combo N sản phẩm)" — field p.minProducts, thiếu thì đọc từ TÊN CT.
function _bcMinProducts_(p){
  if (p.minProducts !== undefined && p.minProducts !== null && p.minProducts !== '') return Number(p.minProducts) || 0;
  var m = /combo\s*(\d+)\s*s[aả]n\s*ph[aẩ]m/i.exec(String(p.name||'').normalize('NFC'));
  return m ? Number(m[1]) : 0;
}
// CT "Bill vòng mix charm": tính trên PHẦN VÒNG + CHARM MIX (không phải cả đơn).
function _bcIsVongProgram_(p){
  if (p.vongScope !== undefined && p.vongScope !== null) return !!p.vongScope;
  return /v[oò]ng\s*mix\s*charm/i.test(String(p.name||'').normalize('NFC'));
}
// CT "Tourmaline cao cấp": đơn phải CÓ nhẫn Tourmaline (Duyên 2026-10-10). Field p.requireProduct (nếu đã đặt) thắng.
function _bcRequireKw_(p){
  if (p.requireProduct !== undefined && p.requireProduct !== null) return String(p.requireProduct).trim();
  var nm = String(p.name||'').normalize('NFC');
  if (/tourmaline cao cấp/i.test(nm)) return 'nhẫn tour';
  return /vòng/i.test(nm) ? 'vòng' : '';
}

// ═══════════════════════════════════════════════════════
//  U3 — ENGINE KHUYẾN MÃI (docs/ROADMAP-CRM-UPDATE.md, quyết định Duyên 2026-10-16)
//  - Cấu hình lưu Settings 'promoConfig' (JSON {v:1, promos:[...]}), admin sửa ở menu ⚙ "🎁 Cấu hình khuyến mãi".
//  - Hàm TÍNH GIÁ là hàm THUẦN (không DOM, không mạng): calcPromo_(items, promos, opts). Cố tình độc lập để
//    (1) test bằng Node (tools/test-promo-engine.js), (2) sao nguyên văn sang backend/extension khi làm U2/U3d.
//  - Làm đủ 5 loại: combo giá sốc / giảm % / giảm số tiền cố định / tặng quà / voucher mã.
//  - Mỗi CT có cờ do admin cài: stackable=true "áp đồng thời được"; stackable=false "KHÔNG áp cùng CT khác";
//    thêm excludes=[id…] để loại trừ riêng một số CT cụ thể.
//  Mô hình 1 CT: { id, name, type:'combo'|'percent'|'amount'|'gift'|'voucher', active, start:'YYYY-MM-DD'|'', end:'YYYY-MM-DD'|'',
//    products:[chữ khớp tên SP, rỗng = mọi SP], minQty, minAmount, value (percent: 0-100; amount: VND; voucher: theo vkind),
//    comboQty, comboPrice (combo: mua comboQty món với giá comboPrice), gift:'tên quà', giftQty,
//    code (voucher), vkind:'percent'|'amount', stackable:bool, excludes:[id], priority:number }
// ═══════════════════════════════════════════════════════
var PROMO_TYPES_ = [
  { key:'combo',   label:'Combo giá sốc' },
  { key:'percent', label:'Giảm theo %' },
  { key:'amount',  label:'Giảm số tiền cố định' },
  { key:'gift',    label:'Tặng quà kèm theo' },
  { key:'voucher', label:'Voucher theo mã' }
];
function promoFold_(s){
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
}
function _promoNum_(x, d){ var n = Number(x); return isFinite(n) ? n : (d || 0); }
// Chuẩn hoá 1 CT từ dữ liệu người nhập; trả null nếu không hợp lệ (thiếu tên/loại sai/giá trị vô lý).
function promoNormalizeOne_(p){
  if (!p || typeof p !== 'object') return null;
  var type = String(p.type || '');
  if (!PROMO_TYPES_.some(function(t){ return t.key === type; })) return null;
  var name = String(p.name || '').trim().slice(0, 80);
  if (!name) return null;
  var o = {
    id: String(p.id || '').trim() || ('p' + Date.now().toString(36) + Math.floor(Math.random() * 1000)),
    name: name, type: type, active: p.active !== false,
    start: /^\d{4}-\d{2}-\d{2}$/.test(String(p.start || '')) ? String(p.start) : '',
    end: /^\d{4}-\d{2}-\d{2}$/.test(String(p.end || '')) ? String(p.end) : '',
    products: (Array.isArray(p.products) ? p.products : String(p.products || '').split(/[,;\n]/)).map(function(x){ return promoFold_(x); }).filter(Boolean),
    minQty: Math.max(0, Math.floor(_promoNum_(p.minQty))), minAmount: Math.max(0, _promoNum_(p.minAmount)),
    value: _promoNum_(p.value), comboQty: Math.floor(_promoNum_(p.comboQty)), comboPrice: _promoNum_(p.comboPrice),
    gift: String(p.gift || '').trim().slice(0, 80), giftQty: Math.max(1, Math.floor(_promoNum_(p.giftQty, 1)) || 1),
    code: String(p.code || '').trim().toUpperCase().slice(0, 30), vkind: p.vkind === 'amount' ? 'amount' : 'percent',
    stackable: p.stackable === true || p.stackable === 'true',
    excludes: (Array.isArray(p.excludes) ? p.excludes : String(p.excludes || '').split(/[,;\s]+/)).map(String).filter(Boolean),
    priority: _promoNum_(p.priority)
  };
  if (type === 'percent' && !(o.value > 0 && o.value <= 100)) return null;
  if (type === 'amount' && !(o.value > 0)) return null;
  if (type === 'combo' && !(o.comboQty >= 2 && o.comboPrice > 0)) return null;
  if (type === 'gift' && !o.gift) return null;
  if (type === 'voucher') {
    if (!o.code) return null;
    if (o.vkind === 'percent' ? !(o.value > 0 && o.value <= 100) : !(o.value > 0)) return null;
  }
  return o;
}
function promoNormalize_(raw){
  var cfg = raw;
  if (typeof raw === 'string') { try { cfg = JSON.parse(raw); } catch (e) { return []; } }
  var arr = Array.isArray(cfg) ? cfg : (cfg && Array.isArray(cfg.promos) ? cfg.promos : []);
  var seen = {}, out = [];
  arr.forEach(function(p){ var n = promoNormalizeOne_(p); if (n && !seen[n.id]) { seen[n.id] = 1; out.push(n); } });
  return out;
}
function _promoToday_(){ var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
// 2 CT áp cùng lúc được không? (đối xứng: một bên cấm là cấm)
function promoCompatible_(a, b){
  if (!a.stackable || !b.stackable) return false;
  if (a.excludes.indexOf(b.id) > -1 || b.excludes.indexOf(a.id) > -1) return false;
  return true;
}
// Tính giảm giá/quà của 1 CT trên giỏ; trả null nếu CT không đủ điều kiện (kèm lý do cho màn thử).
function _promoEval_(p, items, opts){
  var today = opts.date || _promoToday_();
  if (!p.active) return { why: 'đang tắt' };
  if (p.start && today < p.start) return { why: 'chưa đến ngày bắt đầu' };
  if (p.end && today > p.end) return { why: 'đã hết hạn' };
  if (p.type === 'voucher') {
    var codes = (opts.vouchers || []).map(function(c){ return String(c || '').trim().toUpperCase(); });
    if (codes.indexOf(p.code) < 0) return { why: 'chưa nhập mã' };
  }
  var matched = items.filter(function(it){
    if (!p.products.length) return true;
    var n = promoFold_(it.name); return p.products.some(function(k){ return n.indexOf(k) > -1; });
  });
  var qty = 0, amt = 0;
  matched.forEach(function(it){ qty += it.qty; amt += it.qty * it.price; });
  if (!matched.length || qty <= 0) return { why: 'không có sản phẩm áp dụng' };
  if (p.minQty && qty < p.minQty) return { why: 'chưa đủ số lượng tối thiểu (' + p.minQty + ')' };
  if (p.minAmount && amt < p.minAmount) return { why: 'chưa đủ giá trị tối thiểu' };
  var discount = 0, gifts = [];
  if (p.type === 'percent' || (p.type === 'voucher' && p.vkind === 'percent')) discount = amt * p.value / 100;
  else if (p.type === 'amount' || (p.type === 'voucher' && p.vkind === 'amount')) discount = Math.min(p.value, amt);
  else if (p.type === 'combo') {
    // Mỗi combo = comboQty món với giá comboPrice. Lấy các món GIÁ CAO trước để ghép combo (có lợi cho khách).
    var units = [];
    matched.forEach(function(it){ for (var i = 0; i < it.qty; i++) units.push(it.price); });
    units.sort(function(a, b){ return b - a; });
    var groups = Math.floor(units.length / p.comboQty), used = 0;
    for (var g = 0; g < groups * p.comboQty; g++) used += units[g];
    discount = Math.max(0, used - groups * p.comboPrice);
    if (groups < 1) return { why: 'chưa đủ ' + p.comboQty + ' món cho combo' };
  } else if (p.type === 'gift') gifts.push({ name: p.gift, qty: p.giftQty });
  if (p.type !== 'gift' && discount <= 0) return { why: 'không giảm được' };
  return { discount: Math.round(discount), gifts: gifts };
}
// HÀM CHÍNH. items: [{name, qty, price}] (price = đơn giá). promos: mảng đã chuẩn hoá. opts: {vouchers:[mã], date:'YYYY-MM-DD'}
// Trả: { subtotal, discount, total, applied:[{id,name,type,discount,gifts}], gifts:[{name,qty}], skipped:[{id,name,why}] }
// Chọn TẬP CT áp dụng: duyệt mọi tập con tương thích (≤14 CT đủ điều kiện) lấy tập GIẢM NHIỀU NHẤT; hoà thì nhiều quà hơn,
// rồi tổng ưu tiên cao hơn. Nhiều hơn 14 CT đủ điều kiện → tham lam theo ưu tiên (không xảy ra với cấu hình thường).
function calcPromo_(items, promos, opts){
  opts = opts || {};
  var its = (items || []).map(function(it){
    return { name: String(it && it.name || ''), qty: Math.max(0, Math.floor(_promoNum_(it && it.qty))), price: Math.max(0, _promoNum_(it && it.price)) };
  }).filter(function(it){ return it.qty > 0; });
  var subtotal = 0; its.forEach(function(it){ subtotal += it.qty * it.price; });
  var skipped = [], elig = [];
  (promos || []).forEach(function(p){
    var r = _promoEval_(p, its, opts);
    if (r.why) skipped.push({ id: p.id, name: p.name, why: r.why }); else elig.push({ p: p, r: r });
  });
  var best = [], bestKey = null;
  function keyOf(set){
    var d = 0, g = 0, pr = 0; set.forEach(function(e){ d += e.r.discount; g += e.r.gifts.length; pr += e.p.priority; });
    return [Math.min(d, subtotal), g, pr];
  }
  function better(a, b){ for (var i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; } return false; }
  if (elig.length && elig.length <= 14) {
    var n = elig.length, total = 1 << n;
    for (var mask = 1; mask < total; mask++) {
      var set = [], ok = true;
      for (var i = 0; i < n && ok; i++) if (mask & (1 << i)) {
        for (var j = 0; j < set.length; j++) if (!promoCompatible_(elig[i].p, set[j].p)) { ok = false; break; }
        if (ok) set.push(elig[i]);
      }
      if (!ok) continue;
      var k = keyOf(set);
      if (bestKey === null || better(k, bestKey)) { best = set; bestKey = k; }
    }
  } else if (elig.length) {
    elig.slice().sort(function(a, b){ return b.p.priority - a.p.priority || b.r.discount - a.r.discount; }).forEach(function(e){
      if (best.every(function(x){ return promoCompatible_(e.p, x.p); })) best.push(e);
    });
  }
  var applied = [], gifts = [], discount = 0, chosen = {};
  best.forEach(function(e){ chosen[e.p.id] = 1; discount += e.r.discount; });
  elig.forEach(function(e){
    if (!chosen[e.p.id]) skipped.push({ id: e.p.id, name: e.p.name, why: 'không áp cùng chương trình đã chọn (giảm nhiều hơn)' });
  });
  best.forEach(function(e){
    applied.push({ id: e.p.id, name: e.p.name, type: e.p.type, discount: e.r.discount, gifts: e.r.gifts });
    e.r.gifts.forEach(function(g){ gifts.push({ name: g.name, qty: g.qty }); });
  });
  discount = Math.min(discount, subtotal);
  return { subtotal: Math.round(subtotal), discount: discount, total: Math.round(subtotal - discount), applied: applied, gifts: gifts, skipped: skipped };
}

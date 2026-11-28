// ════════════════════════════════════════════════════════════════════
//  QUYỀN LỢI THẺ trong màn ➕ Tạo đơn — mục 9 bước 9c-2. Server chỉ BÁO GIÁ (GAS loyaltyBenefitQuote, chỉ đọc); màn này tự điền.
//  Thẻ VIP (khách mua từ lần 2): giảm 5%; Super VIP (lịch sử ≥ 50tr): giảm 10%; miễn ship đơn từ 1tr; mã KHÔNG GIẢM / TỐI ĐA 5% do server xử lý.
//  "Áp dụng" ĐIỀN giảm % vào từng dòng (thay giảm giá dòng đang nhập) + tick Miễn ship; crmOrderSave vẫn tính tiền như cũ (không đổi).
//  Không sửa js/99-d-crm-order.js: chỉ bọc _coRender (gắn khối cạnh #co-loy) và _coSummary (gọi lại báo giá khi SĐT/sản phẩm đổi, debounce 0,5s).
//  Gỡ = xoá file này + thẻ <script> trong index.html.
// ════════════════════════════════════════════════════════════════════
var _cbn = { sig:'', q:null, err:'', seq:0, timer:0 };
function _cbnItems(co){ return (co.items || []).map(function(it){ return { name: String(it.name || ''), qty: Number(it.qty) || 0, price: Number(it.price) || 0 }; }); }
// Chữ ký = SĐT + (tên, SL, giá) từng dòng. KHÔNG gồm giảm giá/ship → bấm "Áp dụng" không kích hoạt báo giá lại.
function _cbnSig(co){ return String(co.phone || '').replace(/\D/g, '') + '|' + _cbnItems(co).map(function(i){ return i.name + '~' + i.qty + '~' + i.price; }).join('|'); }
function _cbnVndS(n){ return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
function _cbnApplied(q, co){
  if (!q || !q.lines) return false;
  var wantShip = !!q.freeShip, okLines = q.lines.every(function(l, i){ var it = co.items[i]; return it && (l.pct > 0 ? (it.discType === 'pct' && Number(it.discValue) === l.pct) : !(Number(it.discValue) > 0)); });
  return okLines && (!wantShip || !!co.freeShip);
}
function _cbnHtml(q, err, co){
  var E = (typeof _coEsc === 'function') ? _coEsc : function(s){ return String(s); };
  if (err) return '<span style="font-size:12px;color:var(--muted)" title="' + E(err) + '">Chưa tải được quyền lợi thẻ</span>';
  if (!q || q.level === 'none') return '';
  var pcts = {}; q.lines.forEach(function(l){ if (l.pct > 0) pcts[l.pct] = 1; });
  var ps = Object.keys(pcts).map(function(p){ return p + '%'; }).join(' / ') || '0%';
  var bits = ['<b>' + E(q.label) + '</b>', 'giảm ' + ps + (q.discount > 0 ? ' (−' + _cbnVndS(q.discount) + ')' : '')];
  if (q.freeShip) bits.push('miễn ship');
  var done = _cbnApplied(q, co);
  return '<span style="font-size:13px">🏷 ' + bits.join(' · ') + '</span> ' + (done ? '<span style="font-size:12px;color:#1e8449">✓ Đã áp dụng</span>' : '<button class="btn sm primary" onclick="_cbnApply()">Áp dụng</button>');
}
// Điền giảm % từng dòng theo báo giá + tick Miễn ship (nếu được). Trả về co (đã sửa).
function _cbnApplyTo(q, co){
  if (!q || !q.lines) return co;
  q.lines.forEach(function(l, i){ var it = co.items[i]; if (!it) return; it.discType = 'pct'; it.discValue = l.pct > 0 ? l.pct : 0; });
  if (q.freeShip) co.freeShip = true;
  return co;
}
function _cbnApply(){ _cbnApplyTo(_cbn.q, _co); if (typeof _coRender === 'function') _coRender(true); _cbnRender(); }
function _cbnHost(){
  var h = document.getElementById('co-card-benefit'); if (h) return h;
  var loy = document.getElementById('co-loy'); if (!loy || !loy.parentNode) return null;
  h = document.createElement('div'); h.id = 'co-card-benefit'; h.style.cssText = 'margin-bottom:6px;min-height:0';
  loy.parentNode.insertBefore(h, loy); return h;
}
function _cbnRender(){ var h = _cbnHost(); if (h) h.innerHTML = _cbnHtml(_cbn.q, _cbn.err, _co); }
async function _cbnLoad(){
  var sig = _cbnSig(_co), items = _cbnItems(_co), ph = String(_co.phone || '').replace(/\D/g, '');
  if (sig === _cbn.sig) return;
  _cbn.sig = sig;
  var valid = items.filter(function(i){ return i.name && i.qty >= 1 && i.price >= 0; });
  if (ph.length < 9 || !valid.length || typeof gsUrl === 'undefined' || !gsUrl){ _cbn.q = null; _cbn.err = ''; _cbnRender(); return; }
  var my = ++_cbn.seq;
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'loyaltyBenefitQuote', phone: _co.phone, items: items }) }), d = await r.json();
    if (my !== _cbn.seq) return;   // đã có thay đổi mới hơn
    if (d && d.ok){ _cbn.q = d; _cbn.err = ''; } else { _cbn.q = null; _cbn.err = (d && d.error) || 'GAS chưa có action loyaltyBenefitQuote — cần deploy lại GAS.'; }
  } catch(e){ if (my !== _cbn.seq) return; _cbn.q = null; _cbn.err = 'Không tải được: ' + (e && e.message || e); }
  _cbnRender();
}
function _cbnSchedule(){ clearTimeout(_cbn.timer); _cbn.timer = setTimeout(_cbnLoad, 500); }
(function(){
  if (typeof _coRender === 'function'){ var _r = _coRender; _coRender = function(){ var r = _r.apply(this, arguments); try { _cbnRender(); _cbnSchedule(); } catch(e){ console.warn('[card-benefit]', e); } return r; }; }
  if (typeof _coSummary === 'function'){ var _s = _coSummary; _coSummary = function(){ var r = _s.apply(this, arguments); try { _cbnSchedule(); var h = document.getElementById('co-card-benefit'); if (h) h.innerHTML = _cbnHtml(_cbn.q, _cbn.err, _co); } catch(e){ console.warn('[card-benefit]', e); } return r; }; }
})();
if (typeof module !== 'undefined') module.exports = { _cbnSig, _cbnHtml, _cbnApplyTo, _cbnApplied };

// ════════════════════════════════════════════════════════════════════
//  LÊN ĐƠN TRÊN CRM — bước 2/4 (web): tab "➕ Tạo đơn" theo clip màn Tạo đơn Pancake POS.
//  Backend (bước 1/4, gas/35_CrmOrder.gs): POST crmOrderSave {refKey, order} ghi vào sheet RIÊNG "Đơn CRM" (đang TEST — KHÔNG đụng DT Tổng/OrderData/Pos).
//  SERVER TỰ TÍNH TIỀN (không tin số client); module này tính LẠI cùng công thức chỉ để hiện trực tiếp "Cần thu / Còn thiếu" khi gõ.
//  Công thức (khớp server _crmOrderNormalize_): dòng = SL×giá − giảm dòng (%|đ, ≤ thành tiền); thuế dòng = làm tròn(dòng × thuế% do người lên đơn TỰ NHẬP, 0–100) CỘNG vào cần thu;
//  đơn = Σdòng + Σthuế − giảm đơn (%|đ) + phí ship (0 nếu miễn) + phụ thu; còn thiếu = max(0, cần thu − đã chuyển khoản).
//  Sản phẩm: GAS priceCatalogFlat (bảng giá DANH_MUC, giá NGHÌN đồng → ×1000 nếu <100000). Khách: tự điền theo SĐT (dữ liệu đã có trên máy, nếu chưa thì GAS lookup).
//  Chống bấm Lưu 2 lần: refKey sinh 1 lần/đơn, GIỮ NGUYÊN khi lỗi/thử lại, chỉ đổi sau khi lưu thành công (server trả duplicate:true nếu trùng).
//  Dùng điểm tích luỹ (bước 4b-2): ô "🎖️ Dùng điểm" (số dư từ GAS loyaltyGet theo SĐT khách; 1 điểm = pointValue đ, TRỪ THẲNG vào cần thu). Gửi `pointsUse` Ở CẤP NGOÀI order (server tự tính + từ chối nếu quá mức, code POINTS). Quá mức → báo lỗi, KHÔNG âm thầm cắt.
//  F2 = Lưu (khi đang ở tab này). Danh sách đơn đã tạo = bước 3/4. Gỡ: xoá file này + thẻ <script> trong index.html + (không còn gì khác).
// ════════════════════════════════════════════════════════════════════
function _coBlank(){
  var who = '';
  try { who = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? String(currentUser.name) : ''; } catch(e){}
  return { phone:'', custName:'', gender:'', birthday:'', recvName:'', recvPhone:'', province:'', district:'', ward:'', address:'', expectedDate:'', carrier:'',
    source:'', saleName:who, careName:'', marketer:'', tags:'', note:'', printNote:'', items:[], discType:'amt', discValue:0, freeShip:false, shipFee:0, surcharge:0, paid:0,
    pointsUse:0, refKey:'', busy:false, msg:'', msgOk:false, saved:null };
}
var _co = _coBlank();
var _coLoy = { phone:'', loading:false, data:null, err:'', seq:0 };   // điểm tích luỹ của khách đang nhập SĐT (loyaltyGet)
var _coCat = { items:[], loaded:false, loading:false, err:'' };
var _coPick = { q:'', list:[] };
function _coNum(v){ var n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
function _coVnd(n){ n = Math.round(Number(n) || 0); return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
function _coKToVnd(n){ n = Math.round(Number(n) || 0); return n > 0 && n < 100000 ? n * 1000 : n; }   // bảng giá ghi nghìn; ≥100000 coi là đồng đầy đủ
function _coFold(s){ try { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ​-‍﻿]/g, '').replace(/[đĐðÐ]/g, 'd').toLowerCase(); } catch(e){ return String(s == null ? '' : s).toLowerCase(); } }
function _coWords(s){ return ' ' + _coFold(s).replace(/[^a-z0-9]+/g, ' ').trim() + ' '; }
function _coEsc(s){ return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _coDisc(base, type, value){
  var v = Math.max(0, _coNum(value)); base = Math.max(0, base);
  var d = type === 'pct' ? Math.round(base * Math.min(v, 100) / 100) : Math.round(v);
  return Math.min(d, base);
}
// Hàm thuần: tính tiền từ state (cùng công thức server). Trả { lines:[{gross,discount,tax,amount}], gross, itemDiscount, tax, orderDiscount, shipFee, surcharge, total, paid, due, qty }.
function _coCalc(o){
  var lines = [], gross = 0, itemDiscount = 0, qty = 0, tax = 0;
  (o.items || []).forEach(function(it){
    var q = Math.max(0, Math.floor(_coNum(it.qty))), price = Math.max(0, Math.round(_coNum(it.price))), line = q * price;
    var dis = _coDisc(line, it.discType === 'pct' ? 'pct' : 'amt', it.discValue);
    var tx = Math.round((line - dis) * Math.min(100, Math.max(0, _coNum(it.taxPct))) / 100);
    lines.push({ gross: line, discount: dis, tax: tx, amount: line - dis }); gross += line; itemDiscount += dis; qty += q; tax += tx;
  });
  var after = gross - itemDiscount, orderDiscount = _coDisc(after, o.discType === 'pct' ? 'pct' : 'amt', o.discValue);
  var shipFee = o.freeShip ? 0 : Math.max(0, Math.round(_coNum(o.shipFee))), surcharge = Math.max(0, Math.round(_coNum(o.surcharge)));
  var total = after + tax - orderDiscount + shipFee + surcharge, paid = Math.max(0, Math.round(_coNum(o.paid)));
  // Điểm tích luỹ (cùng luật server _loyaltyRedeem_): ≤ điểm muốn dùng, ≤ số dư, ≤ tổng đơn (trước khi trừ điểm) ÷ giá trị 1 điểm. Số dư/giá trị điểm do nơi gọi đưa vào (o.pointsBalance, o.pointValue).
  var pv = _coNum(o.pointValue) > 0 ? _coNum(o.pointValue) : 1000, want = Math.max(0, Math.floor(_coNum(o.pointsUse)));
  var pMax = Math.max(0, Math.min(Math.max(0, Math.floor(_coNum(o.pointsBalance))), Math.floor(Math.max(0, total) / pv))), pUsed = Math.min(want, pMax), pDisc = pUsed * pv;
  var totalBefore = total; total -= pDisc;
  return { lines: lines, gross: gross, itemDiscount: itemDiscount, tax: tax, orderDiscount: orderDiscount, shipFee: shipFee, surcharge: surcharge, totalBeforePoints: totalBefore, pointsWant: want, pointsMax: pMax, pointsUsed: pUsed, pointsDiscount: pDisc, total: total, paid: paid, due: Math.max(0, total - paid), qty: qty };
}
// State đang soạn + số dư điểm của khách (đúng SĐT đang nhập; chưa tải được thì số dư 0).
function _coNow(){
  var d = _coLoy.data && _coLoy.phone === _coPhoneKey(_co.phone) ? _coLoy.data : null;
  return Object.assign({}, _co, { pointsBalance: d ? ((d.points || {}).balance || 0) : 0, pointValue: d ? ((d.config || {}).pointValue || 1000) : 1000, pointsLoaded: !!d });
}
function _coPhoneKey(v){ var p = String(v || '').replace(/\D/g, ''); return p.length >= 9 ? p : ''; }
// Kiểm tra nhanh trước khi gửi (server vẫn kiểm lại). Trả chuỗi lỗi hoặc ''.
function _coValidate(o){
  var ph = String(o.phone || '').replace(/\D/g, '');
  if (ph.length < 9) return 'Nhập số điện thoại khách (ít nhất 9 số).';
  if (!(o.items || []).length) return 'Đơn chưa có sản phẩm — tìm và bấm vào sản phẩm để thêm.';
  for (var i = 0; i < o.items.length; i++){
    var it = o.items[i];
    if (!String(it.name || '').trim()) return 'Dòng sản phẩm ' + (i + 1) + ' thiếu tên.';
    if (!(Math.floor(_coNum(it.qty)) >= 1)) return 'Dòng sản phẩm ' + (i + 1) + ': số lượng phải từ 1.';
    if (_coNum(it.price) < 0) return 'Dòng sản phẩm ' + (i + 1) + ': đơn giá không được âm.';
  }
  var want = Math.max(0, Math.floor(_coNum(o.pointsUse)));
  if (want > 0){
    if (o.pointsLoaded === false) return 'Chưa tải được điểm của khách — bấm "Thử lại" ở ô Dùng điểm, hoặc xoá số điểm đang nhập.';
    var c = _coCalc(o);
    if (want > c.pointsMax) return 'Chỉ dùng được tối đa ' + c.pointsMax + ' điểm cho đơn này (số dư ' + Math.max(0, Math.floor(_coNum(o.pointsBalance))) + ' điểm, đơn ' + _coVnd(c.totalBeforePoints) + ').';
  }
  return '';
}
// Hàm thuần: state → object gửi lên crmOrderSave (items bỏ field phụ; server tự tính lại số tiền).
function _coPayload(o){
  var P = {};
  ['phone','custName','gender','birthday','recvName','recvPhone','province','district','ward','address','expectedDate','carrier','source','saleName','careName','marketer','tags','note','printNote','discType']
    .forEach(function(k){ P[k] = String(o[k] == null ? '' : o[k]).trim(); });
  P.discValue = Math.max(0, _coNum(o.discValue)); P.freeShip = !!o.freeShip; P.shipFee = Math.max(0, _coNum(o.shipFee));
  P.surcharge = Math.max(0, _coNum(o.surcharge)); P.paid = Math.max(0, _coNum(o.paid));
  P.items = (o.items || []).map(function(it){
    return { code: String(it.code || ''), name: String(it.name || '').trim(), qty: Math.floor(_coNum(it.qty)), price: Math.round(_coNum(it.price)),
      discType: it.discType === 'pct' ? 'pct' : 'amt', discValue: Math.max(0, _coNum(it.discValue)), taxPct: Math.max(0, _coNum(it.taxPct)), note: String(it.note || '').trim() };
  });
  return P;
}
function _coPointsUse(o){ return Math.max(0, Math.floor(_coNum(o.pointsUse))); }   // gửi Ở CẤP NGOÀI order (server bỏ qua pointsUsed/pointsDiscount trong order)
function _coNewRef(){ return 'co' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
async function _coPost(action, body){
  if (typeof gsUrl === 'undefined' || !gsUrl) return { ok:false, error:'Chưa kết nối Google Sheets.' };
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify(Object.assign({ action: action }, body || {})) });
    return await r.json();
  } catch(e){ return { ok:false, error:'Mất kết nối máy chủ: ' + (e && e.message || e) }; }
}
// ── Bảng giá (tải 1 lần, tìm không dấu: mọi từ gõ phải có trong tên/chất liệu/size/nhóm) ──
async function _coCatLoad(){
  if (_coCat.loaded || _coCat.loading) return;
  if (typeof gsUrl === 'undefined' || !gsUrl){ _coCat.err = 'Chưa kết nối Google Sheets.'; return; }
  _coCat.loading = true; _coCat.err = ''; _coPickRender();
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=priceCatalogFlat', { redirect:'follow' }), d = await r.json();
    if (d && d.ok && Array.isArray(d.items)){ _coCat.items = d.items.map(function(x){ x._w = _coWords([x.t, x.m, x.n, x.c, x.s, x.mau].join(' ')); return x; }); _coCat.loaded = true; }
    else _coCat.err = (d && d.error) || 'Chưa tải được bảng giá.';
  } catch(e){ _coCat.err = 'Không tải được bảng giá: ' + (e && e.message || e); }
  _coCat.loading = false; _coPickRender();
}
function _coSearch(q){
  var toks = _coWords(q).trim().split(' ').filter(Boolean), out = [];
  if (!toks.length) return out;
  for (var i = 0; i < _coCat.items.length && out.length < 12; i++){
    var x = _coCat.items[i], ok = true;
    for (var k = 0; k < toks.length; k++) if (x._w.indexOf(toks[k]) < 0){ ok = false; break; }
    if (ok) out.push(x);
  }
  return out;
}
function _coPickRender(){
  var box = document.getElementById('co-pick-res'); if (!box) return;
  if (_coCat.loading){ box.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:6px">Đang tải bảng giá…</div>'; return; }
  if (_coCat.err){ box.innerHTML = '<div style="font-size:12px;color:#c0392b;padding:6px">' + _coEsc(_coCat.err) + ' <button class="btn sm" onclick="_coCat.err=\'\';_coCatLoad()">Thử lại</button></div>'; return; }
  var out = _coSearch(_coPick.q); _coPick.list = out;
  box.innerHTML = !String(_coPick.q).trim() ? '' : !out.length ? '<div style="font-size:12px;color:var(--muted);padding:6px">Không có sản phẩm khớp — có thể bấm "Thêm dòng tay".</div>' :
    out.map(function(x, i){
      var sub = [x.c, x.s, x.mau].filter(function(v){ return v && String(v).trim(); }).join(' · '), pr = _coKToVnd(x.p);
      return '<div onclick="_coPickAdd(' + i + ')" style="cursor:pointer;display:flex;gap:8px;justify-content:space-between;align-items:center;padding:7px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:4px">' +
        '<span style="font-size:13px"><b>' + _coEsc(x.t || x.m) + '</b>' + (sub ? ' <span style="color:var(--muted)">· ' + _coEsc(sub) + '</span>' : '') + '</span>' +
        '<span style="font-size:12px;font-weight:700;color:#c03960;white-space:nowrap">' + (pr ? _coVnd(pr) : 'chưa có giá') + '</span></div>';
    }).join('');
}
function _coPickQ(v){ _coPick.q = v; _coPickRender(); }
function _coAddItem(it){
  _co.items.push(Object.assign({ code:'', name:'', note:'', qty:1, price:0, discType:'amt', discValue:0, taxPct:0 }, it || {}));
  _coRender();
}
function _coPickAdd(i){
  var x = _coPick.list[i]; if (!x) return;
  // cùng sản phẩm đã có trong đơn → tăng số lượng thay vì thêm dòng trùng
  var nm = String(x.t || x.m || ''), nt = [x.c, x.s, x.mau].filter(function(v){ return v && String(v).trim(); }).join(' · ');
  for (var k = 0; k < _co.items.length; k++){ var e = _co.items[k]; if (e.name === nm && e.note === nt){ e.qty = Math.floor(_coNum(e.qty)) + 1; _coPick.q = ''; _coRender(); return; } }
  _coPick.q = '';
  _coAddItem({ name: nm, note: nt, price: _coKToVnd(x.p) });
}
function _coDelItem(i){ _co.items.splice(i, 1); _coRender(); }
function _coItemSet(i, k, v){
  var it = _co.items[i]; if (!it) return;
  if (k === 'qty' || k === 'price' || k === 'discValue' || k === 'taxPct') it[k] = _coNum(v); else it[k] = v;
  _coSummary();
}
function _coItemDiscType(i, v){ var it = _co.items[i]; if (!it) return; it.discType = v === 'pct' ? 'pct' : 'amt'; if (it.discType === 'pct' && _coNum(it.discValue) > 100) it.discValue = 100; _coRender(); }
function _coSet(k, v){ _co[k] = v; _coSummary(); }
function _coSetNum(k, v){ _co[k] = _coNum(v); _coSummary(); }
function _coSetBool(k, v){ _co[k] = !!v; _coSummary(); }
// ── Khách: tự điền theo SĐT ──
async function _coFillCustomer(){
  var ph = String(_co.phone || '').replace(/\D/g, ''); if (ph.length < 9) return;
  var name = '', addr = '';
  try {
    var c = (typeof customerMap !== 'undefined' && customerMap) ? customerMap[ph] : null;
    if (c && c.name && String(c.name) !== ph) name = String(c.name);
    var cd = (typeof careData !== 'undefined' && careData) ? careData[ph] : null;
    if (!name && cd && cd.name) name = String(cd.name);
  } catch(e){}
  if (!name && typeof gsUrl !== 'undefined' && gsUrl){
    try {
      var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=lookup&via=search&phone=' + encodeURIComponent(ph), { redirect:'follow' }), j = await r.json();
      if (j && !j.error){
        name = String((j.care && j.care.name) || ((j.orders || []).find(function(x){ return x && x.name; }) || {}).name || ((j.cskh || []).find(function(x){ return x && x.name; }) || {}).name || '');
      }
    } catch(e){}
  }
  if (String(_co.phone || '').replace(/\D/g, '') !== ph) return;   // đã đổi SĐT khác trong lúc chờ
  var changed = false;
  if (name && !_co.custName){ _co.custName = name; changed = true; }
  if (_co.custName && !_co.recvName){ _co.recvName = _co.custName; changed = true; }
  if (!_co.recvPhone){ _co.recvPhone = _co.phone; changed = true; }
  if (changed) _coRender(true);
}
// ── Điểm tích luỹ của khách (loyaltyGet) ──
function _coLoySync(){ var k = _coPhoneKey(_co.phone); if (_coLoy.phone !== k){ _coLoy.phone = k; _coLoy.data = null; _coLoy.err = ''; _coLoy.loading = false; _coLoy.seq++; if (_co.pointsUse) _co.pointsUse = 0; } return k; }
async function _coLoyLoad(){
  var ph = _coLoySync(); _coLoyRender(); _coSummary();
  if (!ph || typeof gsUrl === 'undefined' || !gsUrl) return;
  var my = ++_coLoy.seq; _coLoy.loading = true; _coLoy.err = ''; _coLoyRender();
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=loyaltyGet&phone=' + encodeURIComponent(ph), { redirect:'follow' }), d = await r.json();
    if (my !== _coLoy.seq) return;   // đã đổi SĐT / có lần tải mới hơn
    if (d && d.ok) _coLoy.data = d; else _coLoy.err = (d && d.error) || 'GAS chưa có action loyaltyGet — cần deploy lại GAS.';
  } catch(e){ if (my !== _coLoy.seq) return; _coLoy.err = 'Không tải được điểm: ' + (e && e.message || e); }
  _coLoy.loading = false; _coLoyRender(); _coSummary();
}
function _coLoyHtml(){
  var k = _coLoySync(), E = _coEsc;
  var box = function(t){ return '<div style="font-size:12px;color:var(--muted)">' + t + '</div>'; };
  if (!k) return box('🎖️ Nhập số điện thoại khách để xem điểm tích luỹ.');
  if (_coLoy.loading) return box('🎖️ Đang tải điểm của khách…');
  if (_coLoy.err) return '<div style="font-size:12px;color:#c0392b">🎖️ ' + E(_coLoy.err) + ' <button class="btn sm" onclick="_coLoyLoad()">Thử lại</button></div>';
  if (!_coLoy.data) return box('🎖️ Chưa tải điểm.');
  var d = _coLoy.data, bal = (d.points || {}).balance || 0, pv = (d.config || {}).pointValue || 1000, c = _coCalc(_coNow());
  if (bal <= 0) return box('🎖️ ' + E(d.tierLabel || '') + ' · khách chưa có điểm để dùng.');
  return '<div style="font-size:12px;margin-bottom:4px">🎖️ <b>' + E(d.tierLabel || '') + '</b> · điểm dùng được: <b style="color:#c0392b">' + bal + '</b> <span style="color:var(--muted)">(1 điểm = ' + _coVnd(pv) + ')</span></div>' +
    '<div style="display:flex;gap:6px;align-items:center"><input id="co-pts" type="number" min="0" max="' + c.pointsMax + '" value="' + (_co.pointsUse ? E(_co.pointsUse) : '') + '" placeholder="Số điểm dùng" oninput="_coPtsSet(this.value)" style="' + _coInp + '">' +
    '<button class="btn sm" style="white-space:nowrap" onclick="_coPtsMax()">Dùng tối đa</button></div><div id="co-pts-hint" style="font-size:11px;margin-top:3px"></div>';
}
function _coLoyHint(){
  var h = document.getElementById('co-pts-hint'); if (!h) return;
  var c = _coCalc(_coNow()), want = c.pointsWant;
  if (!want){ h.style.color = 'var(--muted)'; h.textContent = 'Tối đa ' + c.pointsMax + ' điểm cho đơn này.'; }
  else if (want > c.pointsMax){ h.style.color = '#c0392b'; h.textContent = '⚠ Vượt mức: tối đa ' + c.pointsMax + ' điểm (số dư hoặc giá trị đơn). Sửa lại trước khi lưu.'; }
  else { h.style.color = '#1e8449'; h.textContent = 'Trừ ' + c.pointsUsed + ' điểm = giảm ' + _coVnd(c.pointsDiscount) + '.'; }
}
function _coLoyRender(){ var b = document.getElementById('co-loy'); if (b){ b.innerHTML = _coLoyHtml(); _coLoyHint(); } }
function _coPtsSet(v){ _co.pointsUse = Math.max(0, Math.floor(_coNum(v))); _coSummary(); _coLoyHint(); }
function _coPtsMax(){ var c = _coCalc(Object.assign(_coNow(), { pointsUse: 1e9 })); _co.pointsUse = c.pointsMax; _coLoyRender(); _coSummary(); }
// ── Lưu ──
async function _coSave(){
  if (_co.busy) return;
  var err = _coValidate(_coNow());
  if (err){ _co.msg = err; _co.msgOk = false; _coMsgRender(); return; }
  if (!_co.refKey) _co.refKey = _coNewRef();   // giữ nguyên khi lỗi/thử lại → server không tạo đơn thứ 2
  _co.busy = true; _co.msg = 'Đang lưu đơn…'; _co.msgOk = true; _coMsgRender();
  var d = await _coPost('crmOrderSave', { refKey: _co.refKey, pointsUse: _coPointsUse(_co), order: _coPayload(_co) });
  _co.busy = false;
  if (d && d.ok && d.order){
    _co.saved = d.order; _co.refKey = ''; _co.msg = ''; _co.msgOk = true;
    if (typeof toast === 'function') toast((d.duplicate ? 'Đơn đã lưu trước đó: ' : '✓ Đã lưu đơn ') + d.order.orderId);
    _coRender();
  } else {
    _co.msg = (d && d.error) || 'Lưu đơn thất bại.'; _co.msgOk = false; _coMsgRender();
    if (d && d.code === 'POINTS') _coLoyLoad();   // số dư đã đổi (máy khác vừa dùng điểm) → tải lại để hiện mức tối đa đúng
  }
}
function _coNew(){ _coLoy.phone = ''; _coLoy.data = null; _coLoy.err = ''; _coLoy.seq++; var keep = { saleName:_co.saleName, careName:_co.careName, marketer:_co.marketer, source:_co.source, carrier:_co.carrier }; _co = Object.assign(_coBlank(), keep); _coPick.q = ''; _coRender(); }
// ── Giao diện ──
var _coInp = 'width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;background:var(--card,#fff);color:inherit';
function _coField(label, key, opt){
  opt = opt || {};
  return '<label style="display:block;font-size:12px;color:var(--muted);' + (opt.style || '') + '">' + label +
    '<input id="co-f-' + key + '" type="' + (opt.type || 'text') + '" value="' + _coEsc(_co[key]) + '" placeholder="' + _coEsc(opt.ph || '') + '" ' +
    'oninput="_coSet(\'' + key + '\',this.value)"' + (opt.onchange ? ' onchange="' + opt.onchange + '"' : '') + ' style="' + _coInp + '"></label>';
}
function _coMoneyField(label, key, ph){
  return '<label style="display:block;font-size:12px;color:var(--muted)">' + label + '<input id="co-f-' + key + '" type="number" min="0" value="' + (_co[key] ? _coEsc(_co[key]) : '') + '" placeholder="' + (ph || '0') + '" oninput="_coSetNum(\'' + key + '\',this.value)" style="' + _coInp + '"></label>';
}
// Nút chọn kiểu giảm: [đ | %] (thay hộp chọn nhỏ cũ — chỉ hiện chữ "đ" nên dễ bỏ sót lựa chọn %). fnAmt/fnPct = chuỗi onclick.
function _coSeg(isPct, fnAmt, fnPct){
  var b = function(on, t, f){ return '<button type="button" onclick="' + f + '" style="padding:5px 11px;border:1px solid ' + (on ? '#b5305a' : 'var(--border)') + ';font-size:13px;font-weight:700;cursor:pointer;' + (on ? 'background:#b5305a;color:#fff' : 'background:var(--card,#fff);color:inherit') + '">' + t + '</button>'; };
  return '<span style="display:inline-flex;border-radius:6px;overflow:hidden;flex:none" role="group" aria-label="Kiểu giảm giá">' + b(!isPct, 'đ', fnAmt) + b(isPct, '%', fnPct) + '</span>';
}
function _coDiscType(v){ _co.discType = v === 'pct' ? 'pct' : 'amt'; if (_co.discType === 'pct' && _coNum(_co.discValue) > 100) _co.discValue = 100; _coRender(); }
function _coDiscInput(v){ _co.discValue = _coNum(v); _coSummary(); }
function _coItemRow(it, i){
  var pct = it.discType === 'pct';
  return '<div style="border:1px solid var(--border);border-radius:8px;padding:8px;margin-bottom:6px">' +
    '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input value="' + _coEsc(it.name) + '" placeholder="Tên sản phẩm" oninput="_coItemSet(' + i + ',\'name\',this.value)" style="' + _coInp + ';font-weight:700">' +
    '<button class="btn sm" title="Xoá dòng" onclick="_coDelItem(' + i + ')">🗑</button></div>' +
    '<input value="' + _coEsc(it.note) + '" placeholder="Chất liệu · size · màu / ghi chú dòng" oninput="_coItemSet(' + i + ',\'note\',this.value)" style="' + _coInp + ';margin-bottom:6px">' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;align-items:end">' +
      '<label style="font-size:11px;color:var(--muted)">Số lượng<input type="number" min="1" value="' + _coEsc(it.qty) + '" oninput="_coItemSet(' + i + ',\'qty\',this.value)" style="' + _coInp + '"></label>' +
      '<label style="font-size:11px;color:var(--muted)">Đơn giá (đ)<input type="number" min="0" value="' + _coEsc(it.price) + '" oninput="_coItemSet(' + i + ',\'price\',this.value)" style="' + _coInp + '"></label>' +
      '<label style="font-size:11px;color:var(--muted)">Giảm giá dòng<span style="display:flex;gap:4px"><input type="number" min="0" value="' + (it.discValue ? _coEsc(it.discValue) : '') + '" oninput="_coItemSet(' + i + ',\'discValue\',this.value)" style="' + _coInp + '">' +
        _coSeg(pct, '_coItemDiscType(' + i + ',\'amt\')', '_coItemDiscType(' + i + ',\'pct\')') + '</span></label>' +
      '<label style="font-size:11px;color:var(--muted)">Thuế (%)<input type="number" min="0" max="100" value="' + (it.taxPct ? _coEsc(it.taxPct) : '') + '" placeholder="0" oninput="_coItemSet(' + i + ',\'taxPct\',this.value)" style="' + _coInp + '"></label>' +
      '<div style="font-size:11px;color:var(--muted)">Thành tiền<div id="co-line-' + i + '" style="font-size:14px;font-weight:700;color:var(--text,inherit)"></div></div>' +
    '</div></div>';
}
function _coSummaryHtml(c){
  var row = function(l, v, b){ return '<div style="display:flex;justify-content:space-between;font-size:13px;' + (b ? 'font-weight:800;font-size:15px;' : '') + '"><span>' + l + '</span><span>' + v + '</span></div>'; };
  return row('Tạm tính (' + c.qty + ' sp)', _coVnd(c.gross)) + (c.itemDiscount ? row('Giảm giá dòng', '-' + _coVnd(c.itemDiscount)) : '') + (c.tax ? row('Thuế', _coVnd(c.tax)) : '') + (c.orderDiscount ? row('Giảm giá đơn', '-' + _coVnd(c.orderDiscount)) : '') + (c.pointsUsed ? row('Dùng ' + c.pointsUsed + ' điểm', '-' + _coVnd(c.pointsDiscount)) : '') +
    (c.shipFee ? row('Phí vận chuyển', _coVnd(c.shipFee)) : '') + (c.surcharge ? row('Phụ thu', _coVnd(c.surcharge)) : '') +
    '<div style="border-top:1px dashed var(--border);margin:6px 0"></div>' + row('Cần thu', _coVnd(c.total), true) + (c.paid ? row('Đã chuyển khoản', '-' + _coVnd(c.paid)) : '') + row('Còn thiếu', '<span style="color:' + (c.due > 0 ? '#c0392b' : '#1e8449') + '">' + _coVnd(c.due) + '</span>', true);
}
function _coSummary(){   // cập nhật số tiền KHÔNG dựng lại form (giữ nguyên ô đang gõ)
  var c = _coCalc(_coNow()), box = document.getElementById('co-sum'); if (box) box.innerHTML = _coSummaryHtml(c);
  c.lines.forEach(function(l, i){ var el = document.getElementById('co-line-' + i); if (el) el.textContent = _coVnd(l.amount); });
  var h = document.getElementById('co-disc-hint');
  if (h) h.textContent = _coNum(_co.discValue) > 0 ? (_co.discType === 'pct' ? Math.min(100, _coNum(_co.discValue)) + '% = giảm ' + _coVnd(c.orderDiscount) : 'Giảm ' + _coVnd(c.orderDiscount) + (c.gross - c.itemDiscount > 0 ? ' (' + (Math.round(c.orderDiscount / (c.gross - c.itemDiscount) * 1000) / 10) + '%)' : '')) : '';
}
function _coMsgRender(){
  var m = document.getElementById('co-msg'); if (!m) return;
  m.style.display = _co.msg ? 'block' : 'none'; m.style.background = _co.msgOk ? '#eaf7ee' : '#fdecea'; m.style.color = _co.msgOk ? '#1e6b3a' : '#c0392b'; m.textContent = _co.msg || '';
  var b = document.getElementById('co-save'); if (b){ b.disabled = !!_co.busy; b.textContent = _co.busy ? '⏳ Đang lưu…' : '💾 Lưu đơn (F2)'; }
}
function _coRender(keepFocus){
  var w = document.getElementById('xt-wrap-taodon'); if (!w) return;
  if (_co.saved){
    var s = _co.saved;
    w.innerHTML = '<div style="max-width:560px;margin:20px auto;padding:20px;border:1px solid var(--border);border-radius:12px;text-align:center">' +
      '<div style="font-size:34px">✅</div><div style="font-size:18px;font-weight:800;margin:6px 0">Đã lưu đơn ' + _coEsc(s.orderId) + '</div>' +
      '<div style="font-size:13px;color:var(--muted);margin-bottom:10px">' + _coEsc(s.custName || '') + ' · ' + _coEsc(s.phone) + ' · ' + (s.itemCount || 0) + ' dòng / ' + (s.qty || 0) + ' sp</div>' +
      '<div style="font-size:13px">Cần thu <b>' + _coVnd(s.total) + '</b> · Còn thiếu <b style="color:' + (s.due > 0 ? '#c0392b' : '#1e8449') + '">' + _coVnd(s.due) + '</b></div>' +
      (s.pointsUsed > 0 ? '<div style="font-size:12px;margin-top:4px">🎖️ Đã dùng <b>' + s.pointsUsed + '</b> điểm (−' + _coVnd(s.pointsDiscount) + ')</div>' : '') +
      '<div style="font-size:11px;color:var(--muted);margin:10px 0">Đơn nằm ở sheet "Đơn CRM" (đang chạy thử — chưa đẩy sang Pancake POS / DT Tổng / trừ kho).</div>' +
      '<button class="btn primary" onclick="_coNew()">➕ Tạo đơn mới</button></div>';
    return;
  }
  var sec = function(t){ return '<div style="font-size:14px;font-weight:700;margin:14px 0 6px">' + t + '</div>'; };
  var grid = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px';
  w.innerHTML = '<div style="max-width:1100px;margin:0 auto;padding:4px 2px 80px;width:100%">' +
    '<div style="font-size:18px;font-weight:700">➕ Tạo đơn trên CRM</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">Đơn được ghi vào sheet riêng "Đơn CRM" (đang chạy thử). Tiền (kể cả thuế % mỗi dòng, tự nhập) do máy chủ tính lại khi lưu.</div>' +
    '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start"><div style="flex:2;min-width:300px">' +
    sec('👤 Khách hàng') + '<div style="' + grid + '">' + _coField('Số điện thoại *', 'phone', { type:'tel', ph:'09…', onchange:'_coFillCustomer();_coLoyLoad()' }) + _coField('Tên khách', 'custName') + _coField('Giới tính', 'gender') + _coField('Sinh nhật', 'birthday', { ph:'dd/mm/yyyy' }) + '</div>' +
    sec('🛍 Sản phẩm') +
    '<input id="co-pick-q" type="text" placeholder="🔍 Tìm sản phẩm trong bảng giá (không cần dấu)…" value="' + _coEsc(_coPick.q) + '" oninput="_coPickQ(this.value)" onfocus="_coCatLoad()" style="' + _coInp + ';margin-bottom:6px">' +
    '<div id="co-pick-res"></div>' +
    '<div id="co-items">' + (_co.items.length ? _co.items.map(_coItemRow).join('') : '<div style="font-size:12px;color:var(--muted);padding:8px;border:1px dashed var(--border);border-radius:8px;text-align:center">Chưa có sản phẩm — tìm ở trên và bấm vào sản phẩm để thêm.</div>') + '</div>' +
    '<button class="btn sm" onclick="_coAddItem()">＋ Thêm dòng tay</button>' +
    sec('📦 Nhận hàng') + '<div style="' + grid + '">' + _coField('Người nhận', 'recvName') + _coField('SĐT nhận', 'recvPhone', { type:'tel' }) + _coField('Tỉnh / Thành', 'province') + _coField('Quận / Huyện', 'district') + _coField('Phường / Xã', 'ward') + _coField('Địa chỉ cụ thể', 'address') + _coField('Ngày giao dự kiến', 'expectedDate', { type:'date' }) + _coField('Đơn vị vận chuyển', 'carrier') + '</div>' +
    sec('🏷 Thông tin đơn') + '<div style="' + grid + '">' + _coField('Nguồn đơn', 'source') + _coField('Sale', 'saleName') + _coField('NV chăm sóc', 'careName') + _coField('Marketer', 'marketer') + _coField('Thẻ (cách nhau dấu phẩy)', 'tags') + '</div>' +
    '<div style="' + grid + ';margin-top:8px">' + _coField('Ghi chú nội bộ', 'note') + _coField('Ghi chú in trên đơn', 'printNote') + '</div>' +
    '</div><div style="flex:1;min-width:260px;position:sticky;top:8px">' +
    sec('💰 Thanh toán') + '<div style="border:1px solid var(--border);border-radius:10px;padding:10px">' +
    '<div style="margin-bottom:8px"><div style="display:flex;gap:6px;align-items:flex-end"><div style="flex:1"><label style="display:block;font-size:12px;color:var(--muted)">Giảm giá đơn (chọn giảm tiền hoặc giảm %)<input id="co-f-discValue" type="number" min="0"' + (_co.discType === 'pct' ? ' max="100"' : '') + ' value="' + (_co.discValue ? _coEsc(_co.discValue) : '') + '" placeholder="' + (_co.discType === 'pct' ? '% giảm, vd 10' : 'số tiền giảm, vd 50000') + '" oninput="_coDiscInput(this.value)" style="' + _coInp + '"></label></div>' +
    _coSeg(_co.discType === 'pct', '_coDiscType(\'amt\')', '_coDiscType(\'pct\')') + '</div><div id="co-disc-hint" style="font-size:11px;color:var(--muted);margin-top:3px;min-height:14px"></div></div>' +
    '<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:8px"><div style="flex:1">' + _coMoneyField('Phí vận chuyển', 'shipFee') + '</div>' +
    '<label style="font-size:12px;white-space:nowrap;padding-bottom:7px"><input type="checkbox"' + (_co.freeShip ? ' checked' : '') + ' onchange="_coSetBool(\'freeShip\',this.checked)"> Miễn phí giao</label></div>' +
    '<div style="margin-bottom:8px">' + _coMoneyField('Phụ thu', 'surcharge') + '</div>' +
    '<div id="co-loy" style="margin-bottom:8px;padding:8px;border:1px dashed var(--border);border-radius:8px"></div><div style="margin-bottom:10px">' + _coMoneyField('Đã chuyển khoản', 'paid') + '</div>' +
    '<div id="co-sum"></div></div>' +
    '<div id="co-msg" style="display:none;font-size:12px;font-weight:600;border-radius:6px;padding:8px;margin-top:8px"></div>' +
    '<button id="co-save" class="btn primary" onclick="_coSave()" style="width:100%;margin-top:8px;padding:10px;font-size:14px">💾 Lưu đơn (F2)</button>' +
    '<button class="btn sm" onclick="if(confirm(\'Xoá hết nội dung đơn đang soạn?\'))_coNew()" style="width:100%;margin-top:6px">Làm lại từ đầu</button>' +
    '</div></div></div>';
  _coSummary(); _coMsgRender(); _coPickRender(); _coLoyRender();
}
document.addEventListener('keydown', function(e){
  if (e.key !== 'F2') return;
  var p = document.getElementById('tab-taodon');
  if (!p || p.style.display === 'none' || !document.getElementById('co-save')) return;
  e.preventDefault(); _coSave();
});
registerExtraTab('taodon', '➕ Tạo đơn', function(){ _coRender(); _coCatLoad(); });

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
  return { phone:'', custName:'', gender:'', birthday:'', recvName:'', recvPhone:'', province:'', district:'', ward:'', address:'', addrOld:false, expectedDate:'', carrier:'',
    source:'', saleName:who, careName:'', marketer:'', tags:'', note:'', printNote:'', items:[], discType:'amt', discValue:0, freeShip:false, shipFee:0, surcharge:0, paid:0,
    pointsUse:0, promoApplied:null, promoCodes:'', refKey:'', busy:false, msg:'', msgOk:false, saved:null };
}
var _co = _coBlank();
var _coLoy = { phone:'', loading:false, data:null, err:'', seq:0 };   // điểm tích luỹ của khách đang nhập SĐT (loyaltyGet)
var _coCat = { items:[], loaded:false, loading:false, err:'' };
var _coPick = { q:'', list:[] };
function _coNum(v){ var n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
function _coVnd(n){ n = Math.round(Number(n) || 0); return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
// Ô nhập TIỀN hiện dấu chấm ngăn hàng nghìn khi gõ (100000 → 100.000). Ô là type=text inputmode=numeric; dữ liệu giữ NGUYÊN là số thuần
// (chỉ chữ số → _coNum không hiểu nhầm dấu chấm thành dấu thập phân). Ô giảm % KHÔNG dùng (cần số lẻ như 7.5).
function _coFmtMoney(n){ if (n === '' || n == null) return ''; var d = String(Math.round(Number(n) || 0)); return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function _coMoneyIn(el, fn){
  var raw = String(el.value || ''), pos = el.selectionStart == null ? raw.length : el.selectionStart;
  var before = raw.slice(0, pos).replace(/\D/g, '').length;                    // số chữ số nằm bên trái con trỏ
  var d = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');                     // chỉ giữ chữ số, bỏ số 0 đầu thừa
  var out = d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (out !== raw){
    el.value = out;
    var p = 0, c = 0; while (p < out.length && c < before){ if (out.charAt(p) !== '.') c++; p++; }   // đặt lại con trỏ sau đúng chừng ấy chữ số
    try { el.setSelectionRange(p, p); } catch (e) {}
  }
  fn(d);
}
function _coMoneyItem(el, i, k){ _coMoneyIn(el, function(v){ _coItemSet(i, k, v); }); }
function _coMoneyNum(el, key){ _coMoneyIn(el, function(v){ _coSetNum(key, v); }); }
function _coMoneyDisc(el){ _coMoneyIn(el, _coDiscInput); }
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
  var tag = [];
  if (o.promoApplied && o.promoApplied.names && o.promoApplied.names.length) tag.push('CTKM: ' + o.promoApplied.names.join(', '));
  var cmb = []; (o.items || []).forEach(function(it){ if (it.comboName && cmb.indexOf(it.comboName) < 0) cmb.push(it.comboName); });
  if (cmb.length) tag.push('Combo: ' + cmb.join(', '));
  if (tag.length) P.note = (P.note ? P.note + ' | ' : '') + '[' + tag.join(' · ') + ']';
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
// ── Địa chỉ nhận hàng: MỚI (từ 01/07/2025: 34 tỉnh → phường/xã, KHÔNG còn quận/huyện) hoặc CŨ (63 tỉnh → quận/huyện → phường/xã) ──
// Danh mục ở data/vn-address-{new,old}.json (sinh bởi tools/gen-vn-address.js), tải lười khi mở màn / khi tích địa chỉ cũ; tải lỗi → quay về ô gõ tay như trước.
// Backend KHÔNG đổi: đơn vẫn lưu chữ vào province/district/ward ('district' rỗng khi địa chỉ mới). Ô <select> được js/99-e-select-search.js tự thêm khung gõ tìm không dấu.
var _coAddr = { data: { 'new': null, old: null }, loading: {}, err: {} };
function _coAddrKey(){ return _co.addrOld ? 'old' : 'new'; }
// Hàm thuần: danh mục + lựa chọn hiện tại → { provs, dists, wards } (mảng tên). Địa chỉ mới không có quận/huyện.
function _coAddrLists(data, old, prov, dist){
  var out = { provs: [], dists: [], wards: [] };
  if (!data || !data.p) return out;
  data.p.forEach(function(p){ out.provs.push(p[0]); });
  var pr = data.p.filter(function(p){ return p[0] === prov; })[0];
  if (!pr) return out;
  if (!old){ out.wards = pr[1].slice(); return out; }
  pr[1].forEach(function(d){ out.dists.push(d[0]); });
  var di = pr[1].filter(function(d){ return d[0] === dist; })[0];
  if (di) out.wards = di[1].slice();
  return out;
}
async function _coAddrLoad(which){
  if (_coAddr.data[which] || _coAddr.loading[which]) return;
  _coAddr.loading[which] = true; _coAddr.err[which] = ''; _coAddrRender();
  try {
    var r = await fetch('data/vn-address-' + which + '.json?v=20261128a');
    if (r.ok === false) throw new Error('HTTP ' + r.status);
    var d = await r.json();
    if (d && Array.isArray(d.p) && d.p.length) _coAddr.data[which] = d; else _coAddr.err[which] = 'Danh mục địa chỉ rỗng.';
  } catch(e){ _coAddr.err[which] = 'Không tải được danh mục địa chỉ (' + (e && e.message || e) + ').'; }
  _coAddr.loading[which] = false; _coAddrRender();
}
function _coAddrSelect(label, key, list, ph){
  var cur = String(_co[key] || ''), has = !cur || list.indexOf(cur) >= 0;
  return '<label style="display:block;font-size:12px;color:var(--muted)">' + label +
    '<select id="co-f-' + key + '" onchange="_coAddrPick(\'' + key + '\',this.value)" style="' + _coInp + '">' +
    '<option value="">' + _coEsc(ph) + '</option>' +
    (has ? '' : '<option value="' + _coEsc(cur) + '" selected>' + _coEsc(cur) + ' (nhập tay)</option>') +
    list.map(function(n){ return '<option value="' + _coEsc(n) + '"' + (n === cur ? ' selected' : '') + '>' + _coEsc(n) + '</option>'; }).join('') +
    '</select></label>';
}
function _coAddrHtml(){
  var which = _coAddrKey(), d = _coAddr.data[which], old = !!_co.addrOld;
  if (!d){   // chưa có danh mục (đang tải / lỗi) → ô gõ tay như trước để vẫn nhập được địa chỉ
    var msg = _coAddr.loading[which] ? 'Đang tải danh mục địa chỉ… (đang tải xong sẽ chuyển sang ô chọn; có thể gõ tay trước)' : (_coAddr.err[which] || '');
    return _coField('Tỉnh / Thành', 'province') + (old ? _coField('Quận / Huyện', 'district') : '') + _coField('Phường / Xã', 'ward') +
      (msg ? '<div style="grid-column:1/-1;font-size:11px;color:var(--muted)">' + _coEsc(msg) +
        (_coAddr.err[which] ? ' <a href="#" onclick="_coAddr.err[_coAddrKey()]=\'\';_coAddrLoad(_coAddrKey());return false">Thử lại</a>' : '') + '</div>' : '');
  }
  var L = _coAddrLists(d, old, _co.province, _co.district);
  var wardPh = !_co.province ? '— Chọn tỉnh trước —' : (old && !_co.district ? '— Chọn quận/huyện trước —' : (L.wards.length ? '— Chọn —' : '(không có phường/xã)'));
  return _coAddrSelect('Tỉnh / Thành', 'province', L.provs, '— Chọn —') +
    (old ? _coAddrSelect('Quận / Huyện', 'district', L.dists, _co.province ? '— Chọn —' : '— Chọn tỉnh trước —') : '') +
    _coAddrSelect('Phường / Xã', 'ward', L.wards, wardPh);
}
function _coAddrRender(){
  var el = null; try { el = document.getElementById('co-addr'); } catch(e){}
  if (el) el.innerHTML = _coAddrHtml();
}
function _coAddrPick(key, v){
  _co[key] = v;
  if (key === 'province'){ _co.district = ''; _co.ward = ''; } else if (key === 'district'){ _co.ward = ''; }
  _coAddrRender();
}
// Tích / bỏ tích "địa chỉ cũ": xoá quận/huyện + phường/xã (khác hệ nên không dùng lại được); giữ Tỉnh nếu tên vẫn có trong hệ mới chọn.
function _coAddrToggle(on){
  _co.addrOld = !!on; _co.district = ''; _co.ward = '';
  var which = _coAddrKey();
  _coRender();
  Promise.resolve(_coAddrLoad(which)).then(function(){
    if (_coAddrKey() !== which) return;   // đã bấm đổi lại trong lúc tải
    var d = _coAddr.data[which];
    if (d && _co.province && _coAddrLists(d, _co.addrOld, '', '').provs.indexOf(_co.province) < 0) _co.province = '';
    _coAddrRender();
  });
}
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
// Điểm đơn này sẽ tích: cùng công thức server (_loyaltyEarnPoints_) = floor(Cần thu SAU khi trừ điểm × rate ÷ giá trị 1 điểm). Chưa có cấu hình từ server thì 0 (không đoán).
function _coEarnPoints(total, cfg){
  var rate = Number(cfg && cfg.rate), pv = Number(cfg && cfg.pointValue);
  if (!(rate > 0 && rate <= 1 && pv >= 1 && total > 0)) return 0;
  return Math.floor(Math.round(total * rate * 1000000) / 1000000 / pv);
}
function _coYmdVn(ymd){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
function _coEarnRow(total){   // dòng "Sẽ tích" trong ô tóm tắt; chỉ khi đã tải điểm của đúng SĐT đang nhập
  var d = _coLoy.data; if (!d || _coLoy.phone !== _coPhoneKey(_co.phone)) return '';
  var p = _coEarnPoints(total, d.config); if (!p) return '';
  var exp = _coYmdVn((d.points || {}).expiresOn);
  return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#1e8449;margin-top:4px"><span>🎖️ Sẽ tích</span><span>+' + p + ' điểm' + (exp ? ' (hạn ' + exp + ')' : '') + '</span></div>';
}
function _coEarnSavedHtml(){   // màn "Đã lưu đơn": điểm server vừa tích (GAS cũ không trả → không hiện gì)
  var e = _co.earned; if (!e) return '';
  if (e.points > 0) return '<div style="font-size:12px;margin-top:4px;color:#1e8449">🎖️ Khách được tích <b>+' + e.points + '</b> điểm' + (_coYmdVn(e.expiresOn) ? ' (hạn ' + _coYmdVn(e.expiresOn) + ')' : '') + '</div>';
  if (!e.error) return '';
  return '<div style="font-size:12px;margin-top:4px;color:#c0392b">⚠ Đơn đã lưu nhưng chưa tích được điểm. <button class="btn sm" onclick="_coEarnRetry()"' + (e.busy ? ' disabled' : '') + '>' + (e.busy ? 'Đang tích…' : 'Tích lại điểm') + '</button></div>';
}
// Gửi lại đúng refKey của đơn vừa lưu: server không tạo đơn thứ 2, chỉ tích bù (khoá điểm cố định nên không tích 2 lần).
async function _coEarnRetry(){
  var e = _co.earned; if (!e || e.busy || !e.retry) return;
  e.busy = true; _coRender();
  var d = await _coPost('crmOrderSave', e.retry);
  if (_co.earned !== e) return;
  e.busy = false;
  if (d && d.ok && d.pointsEarned > 0){ e.points = d.pointsEarned; e.expiresOn = d.pointsExpireOn; e.error = ''; }
  else if (typeof toast === 'function') toast('Chưa tích được điểm, thử lại sau.');
  _coRender();
}
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
  return '<div style="font-size:12px;margin-bottom:4px">🎖️ <b>' + E(d.tierLabel || '') + '</b> · điểm dùng được: <b style="color:#c0392b">' + bal + '</b> <span style="color:var(--muted)">(1 điểm = ' + _coVnd(pv) + (_coYmdVn((d.points || {}).expiresOn) ? ', hạn ' + _coYmdVn(d.points.expiresOn) : '') + ')</span></div>' +
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
// ── Áp dụng CTKM (engine có sẵn calcPromo_ js/53 + cấu hình admin Settings 'promoConfig' ở ⚙ Cấu hình khuyến mãi) ──
// Tính trên GIÁ DÒNG SAU giảm giá dòng (không giảm 2 lần). Áp dụng = điền Giảm giá đơn (đ) + thêm dòng quà tặng 0đ; ghi tên CTKM vào ghi chú đơn.
// Đã áp thì số giảm TỰ cập nhật khi đổi sản phẩm/SL/giá/mã voucher; sửa tay ô Giảm giá đơn → thôi theo CTKM.
var _coPromo = { list:null, loading:false, err:'' };
async function _coPromoLoad(){
  if (_coPromo.list || _coPromo.loading) return;
  if (typeof gsUrl === 'undefined' || !gsUrl){ _coPromo.err = 'Chưa kết nối Google Sheets.'; _coPromoRender(); return; }
  if (typeof promoNormalize_ !== 'function' || typeof calcPromo_ !== 'function'){ _coPromo.err = 'Thiếu engine khuyến mãi (js/53).'; _coPromoRender(); return; }
  _coPromo.loading = true; _coPromo.err = ''; _coPromoRender();
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=getSettings&keys=promoConfig', { redirect:'follow' }), d = await r.json();
    _coPromo.list = promoNormalize_(((d || {}).values || {}).promoConfig || '[]');
  } catch(e){ _coPromo.err = 'Không tải được CTKM: ' + (e && e.message || e); }
  _coPromo.loading = false; _coPromoRender(); _coSummary();
}
function _coPromoEval(){
  if (!_coPromo.list || typeof calcPromo_ !== 'function') return null;
  var c = _coCalc(_coNow()), items = [];
  _co.items.forEach(function(it, i){
    if (it.promoGift) return;
    var q = Math.max(0, Math.floor(_coNum(it.qty))); if (!q) return;
    items.push({ name: it.name, qty: q, price: ((c.lines[i] || {}).amount || 0) / q });
  });
  return calcPromo_(items, _coPromo.list, { vouchers: String(_co.promoCodes || '').split(/[,;\s]+/).filter(Boolean) });
}
function _coPromoSync(){   // đã áp CTKM → giữ ô Giảm giá đơn đúng theo giỏ hiện tại (KHÔNG gọi _coSummary)
  var a = _co.promoApplied; if (!a) return;
  var ev = _coPromoEval(); if (!ev) return;
  a.names = ev.applied.map(function(x){ return x.name; });
  if (!a.discountOn) return;
  if (_co.discType !== 'amt' || _co.discValue !== ev.discount){ _co.discType = 'amt'; _co.discValue = ev.discount; var el = document.getElementById('co-f-discValue'); if (el) el.value = ev.discount ? ev.discount : ''; }
}
function _coPromoApply(){
  var ev = _coPromoEval(); if (!ev || !ev.applied.length) return;
  var on = ev.discount > 0;
  if (on){ _co.discType = 'amt'; _co.discValue = ev.discount; }
  _co.items = _co.items.filter(function(it){ return !it.promoGift; });
  ev.gifts.forEach(function(g){ _co.items.push({ code:'', name:g.name, note:'Quà tặng CTKM', qty:g.qty, price:0, discType:'amt', discValue:0, taxPct:0, promoGift:true }); });
  _co.promoApplied = { names: ev.applied.map(function(x){ return x.name; }), discountOn: on };
  _coRender();
}
function _coPromoClear(){
  var a = _co.promoApplied; if (!a) return;
  if (a.discountOn) _co.discValue = 0;
  _co.items = _co.items.filter(function(it){ return !it.promoGift; });
  _co.promoApplied = null; _coRender();
}
function _coPromoCodes(v){ _co.promoCodes = v; _coSummary(); }
function _coPromoRender(){
  var box = document.getElementById('co-promo'); if (!box) return;
  var muted = function(t){ return '<div style="font-size:12px;color:var(--muted)">' + t + '</div>'; };
  var h = '<div style="font-size:13px;font-weight:700;margin-bottom:4px">🎁 Áp dụng CTKM</div>';
  if (_coPromo.loading) h += muted('Đang tải CTKM…');
  else if (_coPromo.err) h += '<div style="font-size:12px;color:#c0392b">' + _coEsc(_coPromo.err) + ' <button class="btn sm" onclick="_coPromo.err=\'\';_coPromoLoad()">Thử lại</button></div>';
  else if (!_coPromo.list || !_coPromo.list.length) h += muted('Chưa có CTKM nào được cài (admin cài ở ⚙ Cấu hình khuyến mãi).');
  else {
    if (_coPromo.list.some(function(p){ return p.type === 'voucher' && p.active; }))
      h += '<input type="text" value="' + _coEsc(_co.promoCodes) + '" placeholder="Mã voucher (nếu có, cách nhau dấu phẩy)" oninput="_coPromoCodes(this.value)" style="' + _coInp + ';margin-bottom:6px">';
    h += '<div id="co-promo-res"></div>';
  }
  box.innerHTML = h; _coPromoResRender();
}
function _coPromoResRender(){
  var box = document.getElementById('co-promo-res'); if (!box) return;
  var E = _coEsc, a = _co.promoApplied, h = '';
  var muted = function(t){ return '<div style="font-size:12px;color:var(--muted)">' + t + '</div>'; };
  var ev = _coPromoEval(), hasItems = _co.items.some(function(it){ return !it.promoGift; });
  if (!ev || !hasItems){ box.innerHTML = muted('Thêm sản phẩm để xem CTKM áp dụng được.'); return; }
  if (ev.applied.length){
    ev.applied.forEach(function(x){
      h += '<div style="font-size:12px;margin-bottom:2px">✅ <b>' + E(x.name) + '</b>' + (x.discount ? ' <span style="color:#c0392b">−' + _coVnd(x.discount) + '</span>' : '') +
        (x.gifts.length ? ' · tặng ' + x.gifts.map(function(g){ return g.qty + ' ' + E(g.name); }).join(', ') : '') + '</div>';
    });
  } else h += muted('Chưa có CTKM nào phù hợp với đơn này.');
  var codes = String(_co.promoCodes || '').split(/[,;\s]+/).filter(Boolean);
  codes.forEach(function(cd){
    var up = cd.toUpperCase(), p = (_coPromo.list || []).filter(function(x){ return x.type === 'voucher' && x.code === up; })[0];
    if (!p) h += '<div style="font-size:11px;color:#c0392b">Mã ' + E(up) + ': không có trong cấu hình.</div>';
    else { var sk = (ev.skipped || []).filter(function(x){ return x.id === p.id; })[0]; if (sk) h += '<div style="font-size:11px;color:#c0392b">Mã ' + E(up) + ': ' + E(sk.why) + '.</div>'; }
  });
  if (a) h += '<div style="display:flex;gap:6px;margin-top:6px"><button class="btn sm" onclick="_coPromoApply()">Cập nhật CTKM</button><button class="btn sm" onclick="_coPromoClear()">Bỏ CTKM</button></div>' +
    '<div style="font-size:11px;color:#1e8449;margin-top:3px">Đã áp CTKM — số giảm tự cập nhật khi đổi sản phẩm. Sửa tay ô Giảm giá đơn thì thôi theo CTKM.</div>';
  else if (ev.applied.length) h += '<button class="btn sm" style="margin-top:6px;width:100%" onclick="_coPromoApply()">Áp dụng CTKM' + (ev.discount ? ' (−' + _coVnd(ev.discount) + ')' : '') + '</button>';
  box.innerHTML = h;
}
// ── Combo có sẵn (GAS comboList = sheet COMBO, tab "🎁 Combo") ──
// Thêm combo = thêm các món vào đơn với GIÁ ĐÃ CHIA theo giá combo (finalPrice, đã trừ CTKM của combo) theo tỉ lệ giá niêm yết từng món —
// KHÔNG dùng ô Giảm giá đơn / giảm dòng nên không đụng CTKM, thẻ VIP. Món quà trong combo = dòng 0đ. Combo miễn ship → tick Miễn phí giao.
// Combo chưa có đơn giá từng món → gán cả giá combo vào món đầu. Tên combo ghi vào ghi chú đơn "[Combo: …]".
var _coCmb = { open:false, q:'', rows:[], loading:false, err:'', msg:'', seq:0, timer:0 };
async function _coCmbLoad(){
  if (typeof gsUrl === 'undefined' || !gsUrl){ _coCmb.err = 'Chưa kết nối Google Sheets.'; _coCmbResRender(); return; }
  var my = ++_coCmb.seq; _coCmb.loading = true; _coCmb.err = ''; _coCmbResRender();
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=comboList&q=' + encodeURIComponent(_coCmb.q), { redirect:'follow' }), d = await r.json();
    if (my !== _coCmb.seq) return;
    if (d && d.ok) _coCmb.rows = d.rows || []; else _coCmb.err = (d && d.error) || 'GAS chưa có action comboList — cần deploy lại GAS.';
  } catch(e){ if (my !== _coCmb.seq) return; _coCmb.err = 'Không tải được combo: ' + (e && e.message || e); }
  _coCmb.loading = false; _coCmbResRender();
}
function _coCmbVisible(){ return (_coCmb.rows || []).filter(function(c){ return c && c.usable; }).slice(0, 8); }
function _coCmbQ(v){ _coCmb.q = v || ''; clearTimeout(_coCmb.timer); _coCmb.timer = setTimeout(_coCmbLoad, 400); }
function _coCmbToggle(){ _coCmb.open = !_coCmb.open; _coCmbRender(); if (_coCmb.open && !_coCmb.loading) _coCmbLoad(); }
// Hàm thuần: combo → { lines:[dòng đơn], freeShip, ship, warn }.
function _coCmbLines(c){
  var its = (c && c.items) || [], paid = its.filter(function(it){ return !it.gift; }), gifts = its.filter(function(it){ return it.gift; });
  var fin = Math.max(0, Math.round(Number(c.finalPrice != null ? c.finalPrice : (Number(c.priceVnd) || 0) - (Number(c.discount) || 0)) || 0)), list = 0, warn = '';
  paid.forEach(function(it){ list += Math.max(0, Number(it.price) || 0) * Math.max(1, Math.floor(Number(it.qty) || 1)); });
  // Giá món nhập theo NGHÌN đồng (1550 = 1.550.000đ, giống ô Giá bán DANH_MUC) trong khi giá combo là đồng đầy đủ → nhân 1000, nếu không sẽ chia ra vài trăm đồng.
  if (list > 0 && list < 100000 && fin >= 100000){ paid = paid.map(function(it){ return Object.assign({}, it, { price: (Number(it.price) || 0) * 1000 }); }); list *= 1000; }
  var mk = function(it, price, extra){ return Object.assign({ code:'', name:String(it.name || ''), note:[it.chatLieu, it.size, it.vang].filter(function(v){ return v && String(v).trim(); }).join(' · '), qty:Math.max(1, Math.floor(Number(it.qty) || 1)), price:price, discType:'amt', discValue:0, taxPct:0, comboName:String(c.name || c.code || 'Combo') }, extra || {}); };
  var lines = [];
  if (list > 0){
    if (fin > list) warn = 'Giá combo cao hơn tổng giá niêm yết các món — đã giữ giá niêm yết, kiểm tra lại giá.';
    var target = Math.min(fin, list), sum = 0;
    paid.forEach(function(it, i){
      var q = Math.max(1, Math.floor(Number(it.qty) || 1)), g = Math.max(0, Number(it.price) || 0) * q, pr;
      if (i === paid.length - 1 && q === 1) pr = Math.max(0, target - sum); else pr = Math.round(target * g / list / q);
      sum += pr * q; lines.push(mk(it, pr));
    });
  } else {
    paid.forEach(function(it, i){ lines.push(mk(it, i === 0 ? Math.round(fin / Math.max(1, Math.floor(Number(it.qty) || 1))) : 0)); });
    if (!fin) warn = 'Combo chưa có giá — nhập giá từng món tay.';
  }
  gifts.forEach(function(it){ lines.push(mk(it, 0, { note: 'Quà tặng combo' })); });
  (c.gifts || []).forEach(function(g){ var nm = g && (g.gift || g.name); if (nm) lines.push({ code:'', name:String(nm), note:'Quà tặng combo', qty:1, price:0, discType:'amt', discValue:0, taxPct:0, comboName:String(c.name || c.code || 'Combo') }); });
  return { lines: lines, freeShip: !!c.freeship, ship: Math.max(0, Math.round(Number(c.ship) || 0)), warn: warn };
}
// Combo chưa lưu đơn giá từng món (món có giá ≤ 0) → tra giá POS gần nhất (GAS posPrice) để chia đúng tỉ lệ; không tra được thì giữ nguyên (cách cũ: cả giá combo vào món đầu).
// Đọc món từ chuỗi itemsText của sheet COMBO (cùng định dạng GAS _comboParseItems_: [SL x ]Tên | Chất liệu | Size | SL | Vàng | Đơn giá | quà).
// Dùng khi GAS đang deploy là bản CŨ nên mảng items không kèm đơn giá (tab 🎁 Combo vẫn thấy giá vì tự đọc itemsText).
function _coCmbParseText(text){
  var out = [];
  String(text == null ? '' : text).split(/\r?\n/).forEach(function(line){
    line = String(line).trim(); if (!line) return;
    var qty = 1, m = line.match(/^(\d{1,3})\s*[xX×]\s*(.+)$/); if (m){ qty = parseInt(m[1], 10); line = m[2]; }
    var p = line.split('|').map(function(x){ return String(x).trim(); }); if (!p[0]) return;
    if (p.length >= 4 && /^\d{1,3}$/.test(p[3])) qty = parseInt(p[3], 10); if (qty < 1) qty = 1;
    var vg = String(p[4] || '').match(/^(\d{1,2})\s*k$/i);
    out.push({ name: p[0], chatLieu: p[1] || '', size: p[2] || '', qty: qty, vang: vg ? parseInt(vg[1], 10) + 'k' : '', price: p[5] ? parseInt(String(p[5]).replace(/[^\d]/g, ''), 10) || 0 : 0, gift: /^(1|true|qua|quà)$/i.test(String(p[6] || '').trim()) });
  });
  return out;
}
function _coCmbWithText(c){
  if (!c || !c.itemsText || (c.items || []).some(function(it){ return !it.gift && Number(it.price) > 0; })) return c;
  var t = _coCmbParseText(c.itemsText);
  return t.some(function(it){ return !it.gift && it.price > 0; }) ? Object.assign({}, c, { items: t }) : c;
}
async function _coCmbFresh(c){
  try {
    if (typeof gsUrl === 'undefined' || !gsUrl || !c || !c.code) return c;
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=comboList&q=' + encodeURIComponent(c.code) + '&_=' + Date.now(), { redirect:'follow' }), d = await r.json();
    var f = d && d.ok && (d.rows || []).filter(function(x){ return x && String(x.code).toUpperCase() === String(c.code).toUpperCase(); })[0];
    if (f){ var k = (_coCmb.rows || []).findIndex(function(x){ return x && x.code === f.code; }); if (k >= 0) _coCmb.rows[k] = f; return f; }
  } catch (e) {}
  return c;
}
async function _coCmbFillPrices(c){
  var its = ((c && c.items) || []).map(function(it){ return Object.assign({}, it); }), idx = [];
  its.forEach(function(it, k){ if (!it.gift && !(Number(it.price) > 0)) idx.push(k); });
  if (!idx.length) return c;
  try {
    var q = idx.map(function(k){ return { t: its[k].name || '', c: its[k].chatLieu || '', s: its[k].size || '' }; });
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=posPrice&q=' + encodeURIComponent(JSON.stringify(q)), { redirect:'follow' }), d = await r.json();
    if (d && d.ok && Array.isArray(d.results)) idx.forEach(function(k, j){ var x = d.results[j]; if (x && x.found && Number(x.price) > 0) its[k].price = Math.round(Number(x.price)); });
  } catch (e) {}
  return Object.assign({}, c, { items: its });
}
async function _coCmbAdd(i){
  var c = _coCmbVisible()[i]; if (!c) return;
  c = _coCmbWithText(await _coCmbFresh(c));   // luôn lấy bản combo MỚI NHẤT từ sheet: danh sách ở màn này chỉ tải 1 lần, sửa combo xong mà chưa tải lại trang sẽ còn giá cũ
  if ((c.items || []).some(function(it){ return !it.gift && !(Number(it.price) > 0); })){ _coCmb.msg = 'Đang tra giá từng món…'; _coCmbResRender(); c = await _coCmbFillPrices(c); }
  var r = _coCmbLines(c);
  if (!(c.items || []).some(function(it){ return !it.gift && Number(it.price) > 0; }) && !r.warn && r.lines.length) r.warn = 'Combo chưa có đơn giá từng món nên cả giá combo đang nằm ở món đầu — mở tab 🎁 Combo điền đơn giá từng món và bấm LƯU combo rồi thêm lại. (Sheet đang lưu: «' + String(c.itemsText || '(trống)').replace(/\\s*\\n\\s*/g, ' ⏎ ').slice(0, 140) + '»)';
  if (!r.lines.length){ _coCmb.msg = 'Combo này chưa có món nào.'; _coCmbResRender(); return; }
  r.lines.forEach(function(l){ _co.items.push(l); });
  if (r.freeShip) _co.freeShip = true; else if (r.ship > 0 && !_coNum(_co.shipFee)) _co.shipFee = r.ship;
  _coCmb.msg = r.warn || ('✓ Đã thêm combo "' + (c.name || c.code) + '" vào đơn.');
  _coRender();
}
function _coCmbRender(){
  var box = document.getElementById('co-cmb'); if (!box) return;
  var h = '<button type="button" class="btn sm" onclick="_coCmbToggle()">🎁 Combo có sẵn ' + (_coCmb.open ? '▴' : '▾') + '</button>';
  if (_coCmb.open) h += '<div style="margin-top:6px;padding:8px;border:1px dashed var(--border);border-radius:8px"><input type="text" value="' + _coEsc(_coCmb.q) + '" placeholder="🔍 Tìm combo (tên, mã, từ khoá, sản phẩm…)" oninput="_coCmbQ(this.value)" style="' + _coInp + ';margin-bottom:6px"><div id="co-cmb-res"></div></div>';
  box.innerHTML = h; _coCmbResRender();
}
function _coCmbResRender(){
  var box = document.getElementById('co-cmb-res'); if (!box) return;
  var E = _coEsc, muted = function(t){ return '<div style="font-size:12px;color:var(--muted);padding:4px">' + t + '</div>'; };
  var msg = _coCmb.msg ? '<div style="font-size:12px;font-weight:600;color:' + (/^✓/.test(_coCmb.msg) ? '#1e8449' : '#c0392b') + ';padding:2px 4px 6px">' + E(_coCmb.msg) + '</div>' : '';
  if (_coCmb.loading){ box.innerHTML = msg + muted('Đang tải combo…'); return; }
  if (_coCmb.err){ box.innerHTML = msg + '<div style="font-size:12px;color:#c0392b;padding:4px">' + E(_coCmb.err) + ' <button class="btn sm" onclick="_coCmbLoad()">Thử lại</button></div>'; return; }
  var rows = _coCmbVisible();
  box.innerHTML = msg + (!rows.length ? muted('Không có combo đang áp dụng' + (String(_coCmb.q).trim() ? ' khớp "' + E(_coCmb.q) + '"' : '') + '.') : rows.map(function(c, i){
    var n = (c.items || []).filter(function(it){ return !it.gift; }).length, fin = Number(c.finalPrice != null ? c.finalPrice : c.priceVnd) || 0;
    return '<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;padding:7px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:4px">' +
      '<span style="font-size:13px"><b>' + E(c.name || c.code) + '</b>' + (c.code ? ' <span style="color:var(--muted)">(' + E(c.code) + ')</span>' : '') + '<br><span style="font-size:11px;color:var(--muted)">' + n + ' món' + ((c.gifts || []).length || (c.items || []).some(function(it){ return it.gift; }) ? ' + quà' : '') + (c.freeship ? ' · miễn ship' : '') + '</span></span>' +
      '<span style="display:flex;gap:8px;align-items:center"><b style="font-size:12px;color:#c03960;white-space:nowrap">' + (fin ? _coVnd(fin) : 'chưa có giá') + '</b><button type="button" class="btn sm" onclick="_coCmbAdd(' + i + ')">＋ Thêm</button></span></div>';
  }).join(''));
}
// ── Lưu ──
async function _coSave(){
  if (_co.busy) return;
  var err = _coValidate(_coNow());
  if (err){ _co.msg = err; _co.msgOk = false; _coMsgRender(); return; }
  if (!_co.refKey) _co.refKey = _coNewRef();   // giữ nguyên khi lỗi/thử lại → server không tạo đơn thứ 2
  _co.busy = true; _co.msg = 'Đang lưu đơn…'; _co.msgOk = true; _coMsgRender();
  var body = { refKey: _co.refKey, pointsUse: _coPointsUse(_co), order: _coPayload(_co) };
  var d = await _coPost('crmOrderSave', body);
  _co.busy = false;
  if (d && d.ok && d.order){
    _co.saved = d.order; _co.refKey = ''; _co.msg = ''; _co.msgOk = true;
    _co.earned = { points: Number(d.pointsEarned) || 0, expiresOn: d.pointsExpireOn || '', error: d.pointsEarnError || '', retry: body };
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
  return '<label style="display:block;font-size:12px;color:var(--muted)">' + label + '<input id="co-f-' + key + '" type="text" inputmode="numeric" autocomplete="off" value="' + (_co[key] ? _coFmtMoney(_co[key]) : '') + '" placeholder="' + (ph || '0') + '" oninput="_coMoneyNum(this,\'' + key + '\')" style="' + _coInp + '"></label>';
}
// Nút chọn kiểu giảm: [đ | %] (thay hộp chọn nhỏ cũ — chỉ hiện chữ "đ" nên dễ bỏ sót lựa chọn %). fnAmt/fnPct = chuỗi onclick.
function _coSeg(isPct, fnAmt, fnPct){
  var b = function(on, t, f){ return '<button type="button" onclick="' + f + '" style="padding:5px 11px;border:1px solid ' + (on ? '#b5305a' : 'var(--border)') + ';font-size:13px;font-weight:700;cursor:pointer;' + (on ? 'background:#b5305a;color:#fff' : 'background:var(--card,#fff);color:inherit') + '">' + t + '</button>'; };
  return '<span style="display:inline-flex;border-radius:6px;overflow:hidden;flex:none" role="group" aria-label="Kiểu giảm giá">' + b(!isPct, 'đ', fnAmt) + b(isPct, '%', fnPct) + '</span>';
}
function _coDiscType(v){ _co.promoApplied = null; _co.discType = v === 'pct' ? 'pct' : 'amt'; if (_co.discType === 'pct' && _coNum(_co.discValue) > 100) _co.discValue = 100; _coRender(); }
function _coDiscInput(v){ _co.promoApplied = null; _co.discValue = _coNum(v); _coSummary(); }
function _coItemRow(it, i){
  var pct = it.discType === 'pct';
  return '<div style="border:1px solid var(--border);border-radius:8px;padding:8px;margin-bottom:6px">' +
    '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input value="' + _coEsc(it.name) + '" placeholder="Tên sản phẩm" oninput="_coItemSet(' + i + ',\'name\',this.value)" style="' + _coInp + ';font-weight:700">' +
    '<button class="btn sm" title="Xoá dòng" onclick="_coDelItem(' + i + ')">🗑</button></div>' +
    (it.comboName ? '<div style="font-size:11px;color:#b5305a;margin:-2px 0 4px">🎁 Combo: ' + _coEsc(it.comboName) + ' — giá đã chia theo giá combo</div>' : '') + '<input value="' + _coEsc(it.note) + '" placeholder="Chất liệu · size · màu / ghi chú dòng" oninput="_coItemSet(' + i + ',\'note\',this.value)" style="' + _coInp + ';margin-bottom:6px">' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;align-items:end">' +
      '<label style="font-size:11px;color:var(--muted)">Số lượng<input type="number" min="1" value="' + _coEsc(it.qty) + '" oninput="_coItemSet(' + i + ',\'qty\',this.value)" style="' + _coInp + '"></label>' +
      '<label style="font-size:11px;color:var(--muted)">Đơn giá (đ)<input type="text" inputmode="numeric" autocomplete="off" value="' + _coFmtMoney(it.price) + '" oninput="_coMoneyItem(this,' + i + ',\'price\')" style="' + _coInp + '"></label>' +
      '<label style="font-size:11px;color:var(--muted)">Giảm giá dòng<span style="display:flex;gap:4px">' + (pct ? '<input type="number" min="0" max="100" value="' + (it.discValue ? _coEsc(it.discValue) : '') + '" oninput="_coItemSet(' + i + ',\'discValue\',this.value)" style="' + _coInp + '">' : '<input type="text" inputmode="numeric" autocomplete="off" value="' + (it.discValue ? _coFmtMoney(it.discValue) : '') + '" oninput="_coMoneyItem(this,' + i + ',\'discValue\')" style="' + _coInp + '">') +
        _coSeg(pct, '_coItemDiscType(' + i + ',\'amt\')', '_coItemDiscType(' + i + ',\'pct\')') + '</span></label>' +
      '<label style="font-size:11px;color:var(--muted)">Thuế (%)<input type="number" min="0" max="100" value="' + (it.taxPct ? _coEsc(it.taxPct) : '') + '" placeholder="0" oninput="_coItemSet(' + i + ',\'taxPct\',this.value)" style="' + _coInp + '"></label>' +
      '<div style="font-size:11px;color:var(--muted)">Thành tiền<div id="co-line-' + i + '" style="font-size:14px;font-weight:700;color:var(--text,inherit)"></div></div>' +
    '</div></div>';
}
function _coSummaryHtml(c){
  var row = function(l, v, b){ return '<div style="display:flex;justify-content:space-between;font-size:13px;' + (b ? 'font-weight:800;font-size:15px;' : '') + '"><span>' + l + '</span><span>' + v + '</span></div>'; };
  return row('Tạm tính (' + c.qty + ' sp)', _coVnd(c.gross)) + (c.itemDiscount ? row('Giảm giá dòng', '-' + _coVnd(c.itemDiscount)) : '') + (c.tax ? row('Thuế', _coVnd(c.tax)) : '') + (c.orderDiscount ? row('Giảm giá đơn', '-' + _coVnd(c.orderDiscount)) : '') + (c.pointsUsed ? row('Dùng ' + c.pointsUsed + ' điểm', '-' + _coVnd(c.pointsDiscount)) : '') +
    (c.shipFee ? row('Phí vận chuyển', _coVnd(c.shipFee)) : '') + (c.surcharge ? row('Phụ thu', _coVnd(c.surcharge)) : '') +
    '<div style="border-top:1px dashed var(--border);margin:6px 0"></div>' + row('Cần thu', _coVnd(c.total), true) + (c.paid ? row('Đã chuyển khoản', '-' + _coVnd(c.paid)) : '') + row('Còn thiếu', '<span style="color:' + (c.due > 0 ? '#c0392b' : '#1e8449') + '">' + _coVnd(c.due) + '</span>', true) + _coEarnRow(c.total);
}
function _coSummary(){   // cập nhật số tiền KHÔNG dựng lại form (giữ nguyên ô đang gõ)
  _coPromoSync();
  var c = _coCalc(_coNow()), box = document.getElementById('co-sum'); if (box) box.innerHTML = _coSummaryHtml(c);
  c.lines.forEach(function(l, i){ var el = document.getElementById('co-line-' + i); if (el) el.textContent = _coVnd(l.amount); });
  _coPromoResRender();
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
      (s.pointsUsed > 0 ? '<div style="font-size:12px;margin-top:4px">🎖️ Đã dùng <b>' + s.pointsUsed + '</b> điểm (−' + _coVnd(s.pointsDiscount) + ')</div>' : '') + _coEarnSavedHtml() +
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
    '<div id="co-pick-res"></div><div id="co-cmb" style="margin-bottom:6px"></div>' +
    '<div id="co-items">' + (_co.items.length ? _co.items.map(_coItemRow).join('') : '<div style="font-size:12px;color:var(--muted);padding:8px;border:1px dashed var(--border);border-radius:8px;text-align:center">Chưa có sản phẩm — tìm ở trên và bấm vào sản phẩm để thêm.</div>') + '</div>' +
    '<button class="btn sm" onclick="_coAddItem()">＋ Thêm dòng tay</button>' +
    '<div style="display:flex;align-items:center;gap:6px 14px;flex-wrap:wrap;margin:14px 0 2px"><span style="font-size:14px;font-weight:700">📦 Nhận hàng</span>' +
    '<label style="font-size:12px;display:flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" id="co-addr-old"' + (_co.addrOld ? ' checked' : '') + ' onchange="_coAddrToggle(this.checked)"> Dùng địa chỉ cũ (có Quận/Huyện — trước 01/07/2025)</label></div>' +
    '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">' + (_co.addrOld ? 'Địa chỉ CŨ: Tỉnh/Thành → Quận/Huyện → Phường/Xã (63 tỉnh).' : 'Địa chỉ MỚI (từ 01/07/2025): Tỉnh/Thành → Phường/Xã, không còn Quận/Huyện (34 tỉnh).') + ' Bấm vào ô rồi gõ để tìm.</div>' +
    '<div style="' + grid + '">' + _coField('Người nhận', 'recvName') + _coField('SĐT nhận', 'recvPhone', { type:'tel' }) + '<div id="co-addr" style="display:contents">' + _coAddrHtml() + '</div>' + _coField('Địa chỉ cụ thể', 'address') + _coField('Ngày giao dự kiến', 'expectedDate', { type:'date' }) + _coField('Đơn vị vận chuyển', 'carrier') + '</div>' +
    sec('🏷 Thông tin đơn') + '<div style="' + grid + '">' + _coField('Nguồn đơn', 'source') + _coField('Sale', 'saleName') + _coField('NV chăm sóc', 'careName') + _coField('Marketer', 'marketer') + _coField('Thẻ (cách nhau dấu phẩy)', 'tags') + '</div>' +
    '<div style="' + grid + ';margin-top:8px">' + _coField('Ghi chú nội bộ', 'note') + _coField('Ghi chú in trên đơn', 'printNote') + '</div>' +
    '</div><div style="flex:1;min-width:260px;position:sticky;top:8px">' +
    sec('💰 Thanh toán') + '<div style="border:1px solid var(--border);border-radius:10px;padding:10px">' +
    '<div style="margin-bottom:8px"><div style="display:flex;gap:6px;align-items:flex-end"><div style="flex:1"><label style="display:block;font-size:12px;color:var(--muted)">Giảm giá đơn (chọn giảm tiền hoặc giảm %)<input id="co-f-discValue" ' + (_co.discType === 'pct' ? 'type="number" min="0" max="100" value="' + (_co.discValue ? _coEsc(_co.discValue) : '') + '" oninput="_coDiscInput(this.value)"' : 'type="text" inputmode="numeric" autocomplete="off" value="' + (_co.discValue ? _coFmtMoney(_co.discValue) : '') + '" oninput="_coMoneyDisc(this)"') + ' placeholder="' + (_co.discType === 'pct' ? '% giảm, vd 10' : 'số tiền giảm, vd 50.000') + '" style="' + _coInp + '"></label></div>' +
    _coSeg(_co.discType === 'pct', '_coDiscType(\'amt\')', '_coDiscType(\'pct\')') + '</div><div id="co-disc-hint" style="font-size:11px;color:var(--muted);margin-top:3px;min-height:14px"></div></div>' +
    '<div id="co-promo" style="margin-bottom:8px;padding:8px;border:1px dashed var(--border);border-radius:8px"></div>' +
    '<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:8px"><div style="flex:1">' + _coMoneyField('Phí vận chuyển', 'shipFee') + '</div>' +
    '<label style="font-size:12px;white-space:nowrap;padding-bottom:7px"><input type="checkbox"' + (_co.freeShip ? ' checked' : '') + ' onchange="_coSetBool(\'freeShip\',this.checked)"> Miễn phí giao</label></div>' +
    '<div style="margin-bottom:8px">' + _coMoneyField('Phụ thu', 'surcharge') + '</div>' +
    '<div id="co-loy" style="margin-bottom:8px;padding:8px;border:1px dashed var(--border);border-radius:8px"></div><div style="margin-bottom:10px">' + _coMoneyField('Đã chuyển khoản', 'paid') + '</div>' +
    '<div id="co-sum"></div></div>' +
    '<div id="co-msg" style="display:none;font-size:12px;font-weight:600;border-radius:6px;padding:8px;margin-top:8px"></div>' +
    '<button id="co-save" class="btn primary" onclick="_coSave()" style="width:100%;margin-top:8px;padding:10px;font-size:14px">💾 Lưu đơn (F2)</button>' +
    '<button class="btn sm" onclick="if(confirm(\'Xoá hết nội dung đơn đang soạn?\'))_coNew()" style="width:100%;margin-top:6px">Làm lại từ đầu</button>' +
    '</div></div></div>';
  _coSummary(); _coMsgRender(); _coPickRender(); _coLoyRender(); _coPromoRender(); _coCmbRender();
}
document.addEventListener('keydown', function(e){
  if (e.key !== 'F2') return;
  var p = document.getElementById('tab-taodon');
  if (!p || p.style.display === 'none' || !document.getElementById('co-save')) return;
  e.preventDefault(); _coSave();
});
registerExtraTab('taodon', '➕ Tạo đơn', function(){ _coRender(); _coCatLoad(); _coPromoLoad(); _coAddrLoad(_coAddrKey()); });

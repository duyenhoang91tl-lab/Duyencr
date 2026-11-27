// ════════════════════════════════════════════════════════════════════
//  LÊN ĐƠN TRÊN CRM — bước 2/4 (web): tab "➕ Tạo đơn" theo clip màn Tạo đơn Pancake POS.
//  Backend (bước 1/4, gas/35_CrmOrder.gs): POST crmOrderSave {refKey, order} ghi vào sheet RIÊNG "Đơn CRM" (đang TEST — KHÔNG đụng DT Tổng/OrderData/Pos).
//  SERVER TỰ TÍNH TIỀN (không tin số client); module này tính LẠI cùng công thức chỉ để hiện trực tiếp "Cần thu / Còn thiếu" khi gõ.
//  Công thức (khớp server _crmOrderNormalize_): dòng = SL×giá − giảm dòng (%|đ, ≤ thành tiền); đơn = Σdòng − giảm đơn (%|đ) + phí ship (0 nếu miễn) + phụ thu;
//  còn thiếu = max(0, cần thu − đã chuyển khoản). Thuế % của dòng chỉ LƯU, chưa cộng (chờ Duyên xác nhận).
//  Sản phẩm: GAS priceCatalogFlat (bảng giá DANH_MUC, giá NGHÌN đồng → ×1000 nếu <100000). Khách: tự điền theo SĐT (dữ liệu đã có trên máy, nếu chưa thì GAS lookup).
//  Chống bấm Lưu 2 lần: refKey sinh 1 lần/đơn, GIỮ NGUYÊN khi lỗi/thử lại, chỉ đổi sau khi lưu thành công (server trả duplicate:true nếu trùng).
//  F2 = Lưu (khi đang ở tab này). Danh sách đơn đã tạo = bước 3/4. Gỡ: xoá file này + thẻ <script> trong index.html + (không còn gì khác).
// ════════════════════════════════════════════════════════════════════
function _coBlank(){
  var who = '';
  try { who = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? String(currentUser.name) : ''; } catch(e){}
  return { phone:'', custName:'', gender:'', birthday:'', recvName:'', recvPhone:'', province:'', district:'', ward:'', address:'', expectedDate:'', carrier:'',
    source:'', saleName:who, careName:'', marketer:'', tags:'', note:'', printNote:'', items:[], discType:'amt', discValue:0, freeShip:false, shipFee:0, surcharge:0, paid:0,
    refKey:'', busy:false, msg:'', msgOk:false, saved:null };
}
var _co = _coBlank();
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
// Hàm thuần: tính tiền từ state (cùng công thức server). Trả { lines:[{gross,discount,amount}], gross, itemDiscount, orderDiscount, shipFee, surcharge, total, paid, due, qty }.
function _coCalc(o){
  var lines = [], gross = 0, itemDiscount = 0, qty = 0;
  (o.items || []).forEach(function(it){
    var q = Math.max(0, Math.floor(_coNum(it.qty))), price = Math.max(0, Math.round(_coNum(it.price))), line = q * price;
    var dis = _coDisc(line, it.discType === 'pct' ? 'pct' : 'amt', it.discValue);
    lines.push({ gross: line, discount: dis, amount: line - dis }); gross += line; itemDiscount += dis; qty += q;
  });
  var after = gross - itemDiscount, orderDiscount = _coDisc(after, o.discType === 'pct' ? 'pct' : 'amt', o.discValue);
  var shipFee = o.freeShip ? 0 : Math.max(0, Math.round(_coNum(o.shipFee))), surcharge = Math.max(0, Math.round(_coNum(o.surcharge)));
  var total = after - orderDiscount + shipFee + surcharge, paid = Math.max(0, Math.round(_coNum(o.paid)));
  return { lines: lines, gross: gross, itemDiscount: itemDiscount, orderDiscount: orderDiscount, shipFee: shipFee, surcharge: surcharge, total: total, paid: paid, due: Math.max(0, total - paid), qty: qty };
}
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
function _coItemDiscType(i, v){ var it = _co.items[i]; if (!it) return; it.discType = v === 'pct' ? 'pct' : 'amt'; _coSummary(); }
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
// ── Lưu ──
async function _coSave(){
  if (_co.busy) return;
  var err = _coValidate(_co);
  if (err){ _co.msg = err; _co.msgOk = false; _coMsgRender(); return; }
  if (!_co.refKey) _co.refKey = _coNewRef();   // giữ nguyên khi lỗi/thử lại → server không tạo đơn thứ 2
  _co.busy = true; _co.msg = 'Đang lưu đơn…'; _co.msgOk = true; _coMsgRender();
  var d = await _coPost('crmOrderSave', { refKey: _co.refKey, order: _coPayload(_co) });
  _co.busy = false;
  if (d && d.ok && d.order){
    _co.saved = d.order; _co.refKey = ''; _co.msg = ''; _co.msgOk = true;
    if (typeof toast === 'function') toast((d.duplicate ? 'Đơn đã lưu trước đó: ' : '✓ Đã lưu đơn ') + d.order.orderId);
    _coRender();
  } else { _co.msg = (d && d.error) || 'Lưu đơn thất bại.'; _co.msgOk = false; _coMsgRender(); }
}
function _coNew(){ var keep = { saleName:_co.saleName, careName:_co.careName, marketer:_co.marketer, source:_co.source, carrier:_co.carrier }; _co = Object.assign(_coBlank(), keep); _coPick.q = ''; _coRender(); }
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
        '<select onchange="_coItemDiscType(' + i + ',this.value)" style="padding:4px;border:1px solid var(--border);border-radius:6px"><option value="amt"' + (pct ? '' : ' selected') + '>đ</option><option value="pct"' + (pct ? ' selected' : '') + '>%</option></select></span></label>' +
      '<div style="font-size:11px;color:var(--muted)">Thành tiền<div id="co-line-' + i + '" style="font-size:14px;font-weight:700;color:var(--text,inherit)"></div></div>' +
    '</div></div>';
}
function _coSummaryHtml(c){
  var row = function(l, v, b){ return '<div style="display:flex;justify-content:space-between;font-size:13px;' + (b ? 'font-weight:800;font-size:15px;' : '') + '"><span>' + l + '</span><span>' + v + '</span></div>'; };
  return row('Tạm tính (' + c.qty + ' sp)', _coVnd(c.gross)) + (c.itemDiscount ? row('Giảm giá dòng', '-' + _coVnd(c.itemDiscount)) : '') + (c.orderDiscount ? row('Giảm giá đơn', '-' + _coVnd(c.orderDiscount)) : '') +
    (c.shipFee ? row('Phí vận chuyển', _coVnd(c.shipFee)) : '') + (c.surcharge ? row('Phụ thu', _coVnd(c.surcharge)) : '') +
    '<div style="border-top:1px dashed var(--border);margin:6px 0"></div>' + row('Cần thu', _coVnd(c.total), true) + (c.paid ? row('Đã chuyển khoản', '-' + _coVnd(c.paid)) : '') + row('Còn thiếu', '<span style="color:' + (c.due > 0 ? '#c0392b' : '#1e8449') + '">' + _coVnd(c.due) + '</span>', true);
}
function _coSummary(){   // cập nhật số tiền KHÔNG dựng lại form (giữ nguyên ô đang gõ)
  var c = _coCalc(_co), box = document.getElementById('co-sum'); if (box) box.innerHTML = _coSummaryHtml(c);
  c.lines.forEach(function(l, i){ var el = document.getElementById('co-line-' + i); if (el) el.textContent = _coVnd(l.amount); });
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
      '<div style="font-size:11px;color:var(--muted);margin:10px 0">Đơn nằm ở sheet "Đơn CRM" (đang chạy thử — chưa đẩy sang Pancake POS / DT Tổng / trừ kho).</div>' +
      '<button class="btn primary" onclick="_coNew()">➕ Tạo đơn mới</button></div>';
    return;
  }
  var sec = function(t){ return '<div style="font-size:14px;font-weight:700;margin:14px 0 6px">' + t + '</div>'; };
  var grid = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px';
  w.innerHTML = '<div style="max-width:1100px;margin:0 auto;padding:4px 2px 80px;width:100%">' +
    '<div style="font-size:18px;font-weight:700">➕ Tạo đơn trên CRM</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">Đơn được ghi vào sheet riêng "Đơn CRM" (đang chạy thử). Tiền do máy chủ tính lại khi lưu.</div>' +
    '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start"><div style="flex:2;min-width:300px">' +
    sec('👤 Khách hàng') + '<div style="' + grid + '">' + _coField('Số điện thoại *', 'phone', { type:'tel', ph:'09…', onchange:'_coFillCustomer()' }) + _coField('Tên khách', 'custName') + _coField('Giới tính', 'gender') + _coField('Sinh nhật', 'birthday', { ph:'dd/mm/yyyy' }) + '</div>' +
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
    '<div style="display:flex;gap:6px;align-items:flex-end;margin-bottom:8px"><div style="flex:1">' + _coMoneyField('Giảm giá đơn', 'discValue') + '</div>' +
    '<select onchange="_coSet(\'discType\',this.value)" style="padding:6px;border:1px solid var(--border);border-radius:6px"><option value="amt"' + (_co.discType === 'pct' ? '' : ' selected') + '>đ</option><option value="pct"' + (_co.discType === 'pct' ? ' selected' : '') + '>%</option></select></div>' +
    '<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:8px"><div style="flex:1">' + _coMoneyField('Phí vận chuyển', 'shipFee') + '</div>' +
    '<label style="font-size:12px;white-space:nowrap;padding-bottom:7px"><input type="checkbox"' + (_co.freeShip ? ' checked' : '') + ' onchange="_coSetBool(\'freeShip\',this.checked)"> Miễn phí giao</label></div>' +
    '<div style="margin-bottom:8px">' + _coMoneyField('Phụ thu', 'surcharge') + '</div><div style="margin-bottom:10px">' + _coMoneyField('Đã chuyển khoản', 'paid') + '</div>' +
    '<div id="co-sum"></div></div>' +
    '<div id="co-msg" style="display:none;font-size:12px;font-weight:600;border-radius:6px;padding:8px;margin-top:8px"></div>' +
    '<button id="co-save" class="btn primary" onclick="_coSave()" style="width:100%;margin-top:8px;padding:10px;font-size:14px">💾 Lưu đơn (F2)</button>' +
    '<button class="btn sm" onclick="if(confirm(\'Xoá hết nội dung đơn đang soạn?\'))_coNew()" style="width:100%;margin-top:6px">Làm lại từ đầu</button>' +
    '</div></div></div>';
  _coSummary(); _coMsgRender(); _coPickRender();
}
document.addEventListener('keydown', function(e){
  if (e.key !== 'F2') return;
  var p = document.getElementById('tab-taodon');
  if (!p || p.style.display === 'none' || !document.getElementById('co-save')) return;
  e.preventDefault(); _coSave();
});
registerExtraTab('taodon', '➕ Tạo đơn', function(){ _coRender(); _coCatLoad(); });

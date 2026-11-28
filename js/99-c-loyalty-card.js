// ════════════════════════════════════════════════════════════════════
//  ĐIỂM TÍCH LUỸ + LỊCH SỬ HẠNG — bước 2c/… (mục 9): khối "🎖️ Hạng & điểm" trong HỒ SƠ KHÁCH (#dp).
//  Backend: GAS loyaltyGet (xem; tự đồng bộ sổ điểm từ đơn POS) + loyaltyRedeem (trừ điểm vào đơn) — gas/34_Loyalty.gs.
//  TẢI LƯỜI: loyaltyGet có ghi sheet + quét sổ điểm nên CHỈ gọi khi bấm mở khối (không gọi mỗi lần mở hồ sơ). Cache 60s / SĐT.
//  Quy tắc: 1 điểm = 1.000đ (cấu hình ở server), điểm hết hạn 31/12 cuối năm tích, hạng giữ trọn đời.
//  Dùng điểm: nhập giá trị đơn + số điểm → xem trước giảm bao nhiêu → "Trừ điểm". Sale tự nhập số tiền giảm vào đơn.
//  Gỡ: xoá file này + thẻ <script> trong index.html (khối tự biến mất, không ảnh hưởng chỗ khác).
// ════════════════════════════════════════════════════════════════════
var _loy = { phone:'', data:null, at:0, loading:false, err:'', open:false, msg:'', busy:false, refKey:'' };
function _loyVnd(n){ n = Math.round(Number(n) || 0); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
function _loyDmy(ymd){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(ymd || ''); }
function _loyNewRef(){ return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
// Xem trước giảm giá — CÙNG luật với server (_loyaltyRedeem_): ≤ điểm muốn dùng, ≤ số dư, ≤ giá trị đơn ÷ giá trị 1 điểm.
function _loyPreview(orderValue, wantPoints, balance, pointValue){
  var pv = Number(pointValue) > 0 ? Number(pointValue) : 1000, v = Math.max(0, Number(orderValue) || 0);
  var pts = Math.max(0, Math.min(Math.floor(Number(wantPoints) || 0), Math.floor(Number(balance) || 0), Math.floor(v / pv)));
  return { points: pts, discount: pts * pv, payable: v - pts * pv };
}
function _loyLedgerLabel(r){
  var t = r.type === 'earn' ? '＋ Tích' : r.type === 'refund' ? '－ Hoàn đơn' : r.type === 'undo' ? '＋ Hoàn tác dùng điểm' : '－ Dùng';
  return _loyDmy(r.date) + ' · ' + t + ' ' + r.points + ' điểm' + (r.amount ? ' (đơn ' + _loyVnd(r.amount) + ')' : '') + (r.note ? ' · ' + r.note : '');
}
function _loyIsAdmin(){ return typeof currentUser !== 'undefined' && !!currentUser && currentUser.role === 'admin'; }
function _loyBodyHtml(L){
  var p = L.points || {}, cfg = L.config || {}, pv = cfg.pointValue || 1000, E = (typeof esc === 'function') ? esc : function(s){ return String(s); };
  var h = '<div style="font-size:13px;margin-bottom:6px"><b>' + E(L.tierLabel || '') + '</b>' + (L.tierHistory && L.tierHistory.length ? '' : ' <span style="color:var(--muted)">(chưa có đơn đủ điều kiện lên hạng)</span>') + '</div>';
  h += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px"><div><div style="font-size:11px;color:var(--muted)">Điểm dùng được</div><div style="font-size:20px;font-weight:800;color:#c0392b">' + (p.balance || 0) + '</div>' +
       '<div style="font-size:11px;color:var(--muted)">= ' + _loyVnd((p.balance || 0) * pv) + (p.balance ? ' · hết hạn ' + _loyDmy(p.expiresOn) : '') + '</div></div>' +
       '<div style="font-size:12px;color:var(--muted);align-self:flex-end">Năm ' + E(p.year || '') + ': tích ' + (p.earned || 0) + ' · hoàn ' + (p.refunded || 0) + ' · đã dùng ' + (p.redeemed || 0) + (p.expired ? ' · hết hạn năm trước ' + p.expired : '') + '</div></div>';
  if (p.deficit) h += '<div style="font-size:12px;color:#c0392b;background:#fdecea;border-radius:6px;padding:6px 8px;margin-bottom:6px">⚠ Thiếu ' + p.deficit + ' điểm: đơn đã hoàn nhưng điểm của đơn đó khách đã dùng rồi.</div>';
  if (L.tierHistory && L.tierHistory.length){
    h += '<div style="font-size:12px;font-weight:600;margin:6px 0 2px">Lịch sử lên hạng</div><ul style="margin:0 0 6px 16px;padding:0;font-size:12px">' +
      L.tierHistory.map(function(t){ return '<li>' + E(_loyDmy(t.date)) + ' · ' + E(t.fromLabel || t.from) + ' → <b>' + E(t.toLabel || t.to) + '</b> (tổng ' + _loyVnd(t.cumulative) + ')</li>'; }).join('') + '</ul>';
  }
  h += '<div style="border-top:1px dashed var(--border);margin-top:6px;padding-top:8px"><div style="font-size:12px;font-weight:600;margin-bottom:4px">Dùng điểm cho đơn</div>' +
       '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><input id="loy-ov" type="number" min="0" placeholder="Giá trị đơn (đ)" oninput="_loyPrev()" style="width:150px;padding:5px 8px;border:1px solid var(--border);border-radius:6px">' +
       '<input id="loy-pt" type="number" min="0" placeholder="Số điểm dùng" oninput="_loyPrev()" style="width:120px;padding:5px 8px;border:1px solid var(--border);border-radius:6px">' +
       '<button class="btn sm primary" id="loy-go" onclick="_loyRedeem()"' + (p.balance ? '' : ' disabled') + '>Trừ điểm</button></div>' +
       '<div id="loy-prev" style="font-size:12px;margin-top:4px;color:var(--muted)">' + (p.balance ? '1 điểm = ' + _loyVnd(pv) + '. Nhập giá trị đơn và số điểm để xem giảm bao nhiêu.' : 'Khách chưa có điểm để dùng.') + '</div>' +
       (_loy.msg ? '<div style="font-size:12px;margin-top:4px;font-weight:600">' + E(_loy.msg) + '</div>' : '') + '</div>';
  if (L.ledger && L.ledger.length){
    h += '<details style="margin-top:8px"><summary style="font-size:12px;cursor:pointer;color:var(--muted)">Sổ điểm gần đây (' + Math.min(L.ledger.length, 20) + ')</summary><ul style="margin:4px 0 0 16px;padding:0;font-size:12px">' +
      L.ledger.slice(0, 20).map(function(r, i){
        var t = E(_loyLedgerLabel(r));
        if (r.type === 'redeem' && r.undone) return '<li><s style="color:var(--muted)">' + t + '</s> <i style="color:var(--muted)">(đã hoàn tác)</i></li>';
        return '<li>' + t + (r.type === 'redeem' && _loyIsAdmin() ? ' <button class="btn sm" title="Hoàn tác lần dùng điểm này (admin)" onclick="_loyUndo(' + i + ')">↩ Hoàn tác</button>' : '') + '</li>';
      }).join('') + '</ul></details>';
  }
  return h;
}
function _loyHtml(){
  var inner = _loy.loading ? '<div style="color:var(--muted);font-size:12px;padding:6px 0">Đang tải…</div>'
    : _loy.err ? '<div style="color:#c0392b;font-size:12px;padding:6px 0">' + ((typeof esc === 'function') ? esc(_loy.err) : _loy.err) + ' <button class="btn sm" onclick="_loyLoad(true)">Thử lại</button></div>'
    : _loy.data ? _loyBodyHtml(_loy.data) : '';
  return '<details id="dp-loy-d"' + (_loy.open ? ' open' : '') + ' ontoggle="_loyToggle(this)"><summary style="cursor:pointer;font-weight:700;font-size:13px">🎖️ Hạng &amp; điểm tích luỹ' +
    (_loy.data ? ' · ' + ((typeof esc === 'function') ? esc(_loy.data.tierLabel || '') : '') + ' · ' + ((_loy.data.points || {}).balance || 0) + ' điểm' : '') + '</summary>' + inner + '</details>';
}
function _loyHost(){
  var host = document.getElementById('dp-loy');
  if (!host){
    var tabs = document.querySelector('#dp .dp-tabs'); if (!tabs) return null;
    host = document.createElement('div'); host.id = 'dp-loy';
    host.style.cssText = 'margin:8px 12px;padding:8px 10px;border:1px solid var(--border);border-radius:10px';
    tabs.parentNode.insertBefore(host, tabs);
  }
  return host;
}
// Đổi sang khách khác → bỏ sạch dữ liệu/thông báo của khách cũ NGAY (không để số điểm khách trước hiện ở hồ sơ khách sau).
function _loySync(){
  var ph = (typeof currentPhone !== 'undefined') ? currentPhone : '';
  if (_loy.phone !== ph){ _loy.phone = ph; _loy.data = null; _loy.err = ''; _loy.msg = ''; _loy.at = 0; _loy.refKey = ''; _loy.loading = false; }
}
function _loyRender(){
  _loySync();
  var host = _loyHost(); if (!host) return;
  host.innerHTML = _loyHtml();
}
function _loyToggle(el){ _loy.open = !!el.open; if (_loy.open) _loyLoad(false); }
async function _loyLoad(force){
  var ph = (typeof currentPhone !== 'undefined') ? currentPhone : ''; if (!ph || typeof gsUrl === 'undefined' || !gsUrl) return;
  _loySync();
  if (!force && _loy.data && Date.now() - _loy.at < 60000){ _loyRender(); return; }
  _loy.loading = true; _loy.err = ''; _loyRender();
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=loyaltyGet&phone=' + encodeURIComponent(ph), { redirect:'follow' }), d = await r.json();
    if (_loy.phone !== ph || (typeof currentPhone !== 'undefined' && currentPhone !== ph)) return;   // đã đổi sang khách khác
    if (d && d.ok){ _loy.data = d; _loy.at = Date.now(); } else _loy.err = (d && d.error) || 'GAS chưa có action loyaltyGet — cần deploy lại GAS.';
  } catch(e){ if (_loy.phone !== ph || (typeof currentPhone !== 'undefined' && currentPhone !== ph)) return; _loy.err = 'Không tải được: ' + (e && e.message || e); }
  _loy.loading = false; _loyRender();
}
function _loyPrev(){
  var ov = document.getElementById('loy-ov'), pt = document.getElementById('loy-pt'), pr = document.getElementById('loy-prev'); if (!ov || !pt || !pr || !_loy.data) return;
  var p = _loy.data.points || {}, x = _loyPreview(ov.value, pt.value, p.balance, (_loy.data.config || {}).pointValue);
  pr.textContent = x.points > 0 ? 'Trừ ' + x.points + ' điểm = giảm ' + _loyVnd(x.discount) + ' → khách trả ' + _loyVnd(x.payable) : 'Nhập giá trị đơn và số điểm (tối đa ' + (p.balance || 0) + ' điểm).';
}
async function _loyRedeem(){
  if (_loy.busy || !_loy.data) return;
  var ov = document.getElementById('loy-ov'), pt = document.getElementById('loy-pt');
  var x = _loyPreview(ov && ov.value, pt && pt.value, (_loy.data.points || {}).balance, (_loy.data.config || {}).pointValue);
  if (x.points <= 0){ _loy.msg = 'Nhập giá trị đơn > 0 và số điểm > 0 (trong số dư).'; _loyRender(); return; }
  if (!confirm('Trừ ' + x.points + ' điểm của khách này, giảm ' + _loyVnd(x.discount) + ' cho đơn ' + _loyVnd(Number(ov.value)) + '?\nĐiểm đã trừ không tự hoàn lại.')) return;
  _loy.busy = true; var ph = _loy.phone; if (!_loy.refKey) _loy.refKey = _loyNewRef();
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'loyaltyRedeem', phone: ph, orderValue: Number(ov.value), points: x.points, refKey: _loy.refKey }) }), d = await r.json();
    if (d && d.ok){
      _loy.msg = '✅ Đã trừ ' + d.redeemed.points + ' điểm = ' + _loyVnd(d.redeemed.discount) + '. Nhập giảm ' + _loyVnd(d.redeemed.discount) + ' vào đơn (khách trả ' + _loyVnd(d.redeemed.payable) + ').';
      _loy.refKey = ''; if (typeof toast === 'function') toast('Đã trừ ' + d.redeemed.points + ' điểm');
    } else if (d && d.code === 'DUPLICATE'){ _loy.msg = 'Lần trừ này đã được ghi trước đó — không trừ lại.'; _loy.refKey = ''; }
    else _loy.msg = '❌ ' + ((d && d.error) || 'Không trừ được điểm (GAS chưa deploy loyaltyRedeem?).');
  } catch(e){ _loy.msg = '❌ Không trừ được: ' + (e && e.message || e); }
  _loy.busy = false; _loyLoad(true);
}
async function _loyUndo(i){
  var r = _loy.data && _loy.data.ledger && _loy.data.ledger[i]; if (_loy.busy || !r || r.type !== 'redeem' || r.undone || !_loyIsAdmin()) return;
  if (!confirm('Hoàn tác lần dùng ' + r.points + ' điểm (' + _loyDmy(r.date) + ')?\n' + r.points + ' điểm sẽ quay lại số dư của năm đó (nếu năm đó đã qua thì điểm đã hết hạn). Có ghi nhật ký.')) return;
  _loy.busy = true; var ph = _loy.phone;
  try {
    var res = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'loyaltyUndo', phone: ph, key: r.key }) }), d = await res.json();
    if (d && d.ok){ _loy.msg = '✅ Đã hoàn tác ' + d.undone.points + ' điểm.'; if (typeof toast === 'function') toast('Đã hoàn tác ' + d.undone.points + ' điểm'); }
    else if (d && d.code === 'DUPLICATE') _loy.msg = 'Lần dùng này đã được hoàn tác trước đó.';
    else _loy.msg = '❌ ' + ((d && d.error) || 'Không hoàn tác được (GAS chưa deploy loyaltyUndo?).');
  } catch(e){ _loy.msg = '❌ Không hoàn tác được: ' + (e && e.message || e); }
  _loy.busy = false; _loyLoad(true);
}
(function(){
  if (typeof openDp === 'function'){ var _o = openDp; openDp = function(p){ var r = _o.apply(this, arguments); try { _loy.msg = ''; _loyRender(); if (_loy.open) _loyLoad(false); } catch(e){ console.warn('[loyalty]', e); } return r; }; }
  if (typeof renderDpTab === 'function'){ var _r = renderDpTab; renderDpTab = function(t){ var r = _r.apply(this, arguments); try { _loyRender(); } catch(e){ console.warn('[loyalty]', e); } return r; }; }
})();
if (typeof module !== 'undefined') module.exports = { _loyUndo, _loyVnd, _loyDmy, _loyPreview, _loyLedgerLabel, _loyBodyHtml };

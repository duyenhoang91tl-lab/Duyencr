// ════════════════════════════════════════════════════════════════════
//  TẠO ĐƠN: gắn THẺ POS cho ô "NV chăm sóc" và "Marketer" (28/11/2026).
//  Gõ để tìm (không dấu) → bấm / Enter để gắn, gắn được nhiều thẻ, ✕ để gỡ. Không có trong danh sách thì gõ tay rồi Enter / dấu phẩy / rời ô.
//  Giá trị vẫn là CHUỖI "thẻ1, thẻ2" trong _co.careName / _co.marketer → backend giữ nguyên (tối đa 80 ký tự, xem gas/35_CrmOrder.gs).
//  Nguồn thẻ: GAS salesReportOptions (saleB = cột Thẻ Pos, marketer) + Thẻ nhân viên (SALE_PERSON_TAGS) + tên CS đã có trên máy.
//  Nạp SAU js/99-d-crm-order. Gỡ = xoá file này + thẻ <script> trong index.html (ô quay về gõ tay).
// ════════════════════════════════════════════════════════════════════
var _COT_KEYS = { careName: 1, marketer: 1 };
var _COT_MAX = 80;
var _cot = { sale: [], mkt: [], loaded: false, loading: false, f: {} };
function _cotParse(s){
  var seen = {}, out = [];
  String(s == null ? '' : s).split(',').forEach(function(x){ x = x.trim(); var k = x.toLowerCase(); if (x && !seen[k]){ seen[k] = 1; out.push(x); } });
  return out;
}
function _cotJoin(chips, draft){ return chips.concat(String(draft || '').trim() ? [String(draft).trim()] : []).join(', '); }
// Trạng thái từng ô; giá trị đơn bị đổi từ nơi khác (đơn mới, giữ lại sau khi lưu…) thì đọc lại từ _co.
function _cotState(key){
  var s = _cot.f[key];
  if (!s || _cotJoin(s.chips, s.draft) !== String(_co[key] || '')) s = _cot.f[key] = { chips: _cotParse(_co[key]), draft: '', open: false, list: [] };
  return s;
}
// Danh sách gợi ý: ô Marketer đưa tên marketer lên trước rồi tới thẻ Pos; ô NV chăm sóc chỉ thẻ Pos/nhân viên. Bỏ thẻ đã gắn.
function _cotOptions(key, q, chips){
  var fold = function(v){ return _coFold(v).replace(/[^a-z0-9]/g, ''); };
  var words = _coFold(q).split(/\s+/).map(fold).filter(Boolean), seen = {};
  (chips || []).forEach(function(c){ seen[c.toLowerCase()] = 1; });
  return (key === 'marketer' ? _cot.mkt.concat(_cot.sale) : _cot.sale).filter(function(n){
    var k = n.toLowerCase(), f = fold(n);
    if (seen[k] || !words.every(function(w){ return f.indexOf(w) >= 0; })) return false;
    seen[k] = 1; return true;
  }).slice(0, 50);
}
function _cotNames(list){
  var seen = {}, out = [];
  (list || []).forEach(function(n){ n = String(n == null ? '' : n).trim(); var k = n.toLowerCase(); if (n && n.indexOf(',') < 0 && !seen[k]){ seen[k] = 1; out.push(n); } });
  return out.sort(function(a, b){ return a.localeCompare(b, 'vi'); });
}
async function _cotLoad(){
  if (_cot.loaded || _cot.loading) return;
  _cot.loading = true;
  var o = null;
  try {
    if (typeof gsUrl !== 'undefined' && gsUrl){
      var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=salesReportOptions', { redirect: 'follow' }), d = await r.json();
      if (d && !d.error) o = d;
    }
  } catch (e) {}
  var local = [];
  try { Object.keys(SALE_PERSON_TAGS).forEach(function(k){ local = local.concat(k, SALE_PERSON_TAGS[k] || []); }); } catch (e) {}
  try { local = local.concat(_allCSNames()); } catch (e) {}
  _cot.sale = _cotNames(((o && o.saleB) || []).concat(local));
  _cot.mkt = _cotNames((o && o.marketer) || []);
  _cot.loaded = !!o; _cot.loading = false;   // lỗi/không có quyền → lần mở sau thử lại
  Object.keys(_COT_KEYS).forEach(_cotListRender);
}
function _cotHtml(label, key){
  var a = '\'' + key + '\'';
  return '<div style="display:block;font-size:12px;color:var(--muted);position:relative;align-self:start">' + label +
    '<div onclick="document.getElementById(\'co-f-' + key + '\').focus()" style="' + _coInp + ';display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:3px 6px;min-height:31px;cursor:text">' +
      '<span id="co-tags-' + key + '" style="display:contents">' + _cotChipsHtml(key) + '</span>' +
      '<input id="co-f-' + key + '" type="text" autocomplete="off" aria-label="' + label + '" value="' + _coEsc(_cotState(key).draft) + '" placeholder="Gắn thẻ Pos…" ' +
        'onfocus="_cotOpen(' + a + ')" oninput="_cotInput(' + a + ',this)" onkeydown="_cotKey(event,' + a + ')" onblur="_cotBlur(' + a + ')" ' +
        'style="flex:1;min-width:80px;border:0;outline:0;background:transparent;color:inherit;font-size:13px;padding:2px 0">' +
    '</div><div id="co-taglist-' + key + '" style="display:none;position:absolute;left:0;right:0;top:100%;z-index:30;max-height:220px;overflow:auto;background:var(--card,#fff);color:var(--text,#222);border:1px solid var(--border);border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18)"></div></div>';
}
function _cotChipsHtml(key){
  return _cotState(key).chips.map(function(t, i){
    return '<span style="display:inline-flex;align-items:center;gap:4px;background:#fde7ef;color:#8e1f45;border-radius:10px;padding:1px 8px;font-size:12px;font-weight:600">' + _coEsc(t) +
      '<button type="button" aria-label="Gỡ thẻ ' + _coEsc(t) + '" onmousedown="event.preventDefault()" onclick="event.stopPropagation();_cotRemove(\'' + key + '\',' + i + ')" style="border:0;background:none;color:inherit;cursor:pointer;padding:0;font-size:12px">✕</button></span>';
  }).join('');
}
function _cotChipsRender(key){ var el = document.getElementById('co-tags-' + key); if (el) el.innerHTML = _cotChipsHtml(key); }
function _cotListRender(key){
  var box = document.getElementById('co-taglist-' + key); if (!box) return;
  var s = _cotState(key);
  if (!s.open){ box.style.display = 'none'; return; }
  s.list = _cotOptions(key, s.draft, s.chips);
  box.style.display = 'block';
  box.innerHTML = s.list.length ? s.list.map(function(n, i){
    return '<div onmousedown="event.preventDefault();_cotPick(\'' + key + '\',' + i + ')" style="padding:7px 10px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border)' + (i === 0 && s.draft ? ';font-weight:700' : '') + '">' + _coEsc(n) + '</div>';
  }).join('') : '<div style="padding:7px 10px;font-size:12px;color:var(--muted)">' + (_cot.loading ? 'Đang tải thẻ…' : s.draft ? 'Không có thẻ khớp — Enter để gắn đúng chữ đang gõ.' : 'Chưa có thẻ để gợi ý — gõ tay rồi Enter.') + '</div>';
}
function _cotSync(key){ var s = _cot.f[key]; _co[key] = _cotJoin(s.chips, s.draft); }
function _cotAdd(key, name){
  var s = _cotState(key), add = _cotParse(name), next = _cotParse(s.chips.concat(add).join(','));
  if (next.join(', ').length > _COT_MAX){ if (typeof toast === 'function') toast('Ô này chỉ lưu được ' + _COT_MAX + ' ký tự — gỡ bớt thẻ.'); return false; }
  s.chips = next; s.draft = ''; _cotSync(key);
  var inp = document.getElementById('co-f-' + key); if (inp) inp.value = '';
  _cotChipsRender(key); _cotListRender(key);
  return true;
}
function _cotRemove(key, i){ var s = _cotState(key); s.chips.splice(i, 1); _cotSync(key); _cotChipsRender(key); _cotListRender(key); }
function _cotPick(key, i){ var n = _cotState(key).list[i]; if (n) _cotAdd(key, n); }
function _cotOpen(key){ _cotState(key).open = true; _cotLoad(); _cotListRender(key); }
function _cotInput(key, el){
  var s = _cotState(key), v = String(el.value || '');
  if (v.indexOf(',') >= 0){ if (_cotAdd(key, v)) return; v = v.replace(/,/g, ''); el.value = v; }
  // chữ đang gõ cũng nằm trong giá trị đơn (bấm F2 lưu ngay vẫn không mất)
  var room = _COT_MAX - (s.chips.length ? s.chips.join(', ').length + 2 : 0);
  if (v.length > room){ v = v.slice(0, Math.max(0, room)); el.value = v; }
  s.draft = v; s.open = true; _cotSync(key); _cotListRender(key);
}
function _cotKey(e, key){
  var s = _cotState(key);
  if (e.isComposing) return;
  if (e.key === 'Enter'){ e.preventDefault(); if (s.draft.trim()) _cotAdd(key, s.list[0] || s.draft); }
  else if (e.key === 'Escape'){ s.open = false; _cotListRender(key); }
  else if (e.key === 'Backspace' && !s.draft && s.chips.length) _cotRemove(key, s.chips.length - 1);
}
// Rời ô: chữ gõ dở thành thẻ; gõ đúng tên (khác hoa/thường) thì lấy đúng cách viết của thẻ.
function _cotBlur(key){
  var s = _cotState(key), d = s.draft.trim();
  s.open = false;
  if (d) _cotAdd(key, _cotOptions(key, d, s.chips).filter(function(n){ return n.toLowerCase() === d.toLowerCase(); })[0] || d);
  _cotListRender(key);
}
var _cotBaseField = _coField;
_coField = function(label, key, opt){ return _COT_KEYS[key] ? _cotHtml(label, key) : _cotBaseField(label, key, opt); };

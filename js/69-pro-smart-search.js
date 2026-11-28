// ═══════════════════════════════════════════════════════════════════════════
//  R5c — TÌM KIẾM THÔNG MINH ở ô tìm khách chính (#search-input) — 2026-11-15
//  NGUYÊN NHÂN GỐC: ô tìm chỉ so chữ thường có dấu (gõ "nguyen van" không ra "Nguyễn Văn"), SĐT chỉ nhận chuỗi số liền
//  ("0912 345 678", "0912.345.678", "+84 912 345 678" bị coi là tên → ra 0 khách) và không có gợi ý khi gõ (phải đoán rồi chờ lọc bảng).
//  File này: (1) ssNormQuery_/ssMatchText_ — chuẩn hoá ô tìm (bỏ dấu, tách từ, SĐT đủ kiểu) cho applyFilters/exportCSV dùng chung;
//  (2) hộp gợi ý #cust-suggest dưới ô tìm: tối đa 8 khách khớp nhất, ↑/↓ + Enter hoặc bấm → mở hồ sơ khách (openDp).
//  Mã đơn: GIỮ nguyên cơ chế cũ (_ordSearchSoon → GAS searchOrder, js/29) — hộp gợi ý khách tự ẩn khi ô có cả chữ lẫn số.
//  Không đổi GAS. Gỡ = xoá thẻ <script> js/69 trong index.html (ô tìm quay về kiểu cũ nếu cũng gỡ 2 lời gọi ssMatchText_ ở js/02, js/05).
// ═══════════════════════════════════════════════════════════════════════════
function ssFold_(t){ return String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim(); }
// Chuẩn hoá chuỗi gõ vào ô tìm. kind: 'empty' | 'phone' (chỉ số + dấu cách . - ( ) , có thể bắt đầu bằng +; ≥4 số) | 'mixed' (có cả chữ lẫn số → có thể là mã đơn) | 'text'.
// q = chuỗi dùng để so SĐT / (kiểu cũ): với kind 'phone' là DÃY SỐ đã đưa về dạng 0xxxxxxxxx (+84/84 → 0); còn lại là chữ thường như cũ.
function ssNormQuery_(raw){
  var r = String(raw == null ? '' : raw).trim();
  var o = { raw: r, q: r.toLowerCase(), fold: ssFold_(r), tokens: [], phone: '', kind: 'empty' };
  if (!r) return o;
  o.tokens = o.fold ? o.fold.split(' ') : [];
  if (/^\+?[\d\s.\-()]+$/.test(r)) {
    var d = r.replace(/\D/g, '');
    if (/^\+/.test(r) && d.indexOf('84') === 0) d = '0' + d.slice(2);
    else if (d.length >= 11 && d.indexOf('84') === 0) d = '0' + d.slice(2);
    if (d.length >= 4 && d.length <= 12) { o.phone = d; o.q = d; o.kind = 'phone'; return o; }
  }
  o.kind = (/\d/.test(r) && /[^\d\s.\-()+]/.test(r)) ? 'mixed' : 'text';
  return o;
}
function _ssAllIn_(hay, tokens){ if (!tokens.length) return false; for (var i = 0; i < tokens.length; i++) if (hay.indexOf(tokens[i]) < 0) return false; return true; }
// Cache tên đã bỏ dấu trên chính khách (khoá theo nameLower → đổi tên thì tự tính lại; 136k khách chỉ tính 1 lần).
function _ssNameFold_(c){ var src = c.nameLower != null ? c.nameLower : c.name; if (c._ssNS !== src) { c._ssNS = src; c._ssNF = ssFold_(src); } return c._ssNF; }
function _ssCskhFold_(c){ var src = c.cskhNameLower || ''; if (c._ssCS !== src) { c._ssCS = src; c._ssCF = ssFold_(src); } return c._ssCF; }
// Khách có khớp ô tìm không? SĐT: chứa dãy số; Tên: MỌI từ gõ đều có trong tên (bỏ dấu, không phân biệt hoa thường, thứ tự tuỳ ý); tên CSKH khác: như tên.
function ssMatchText_(c, n){
  if (!n || !n.raw) return true;
  var ph = String(c.phone || '');
  if (n.kind === 'phone') return ph.indexOf(n.phone) >= 0;
  if (n.q && ph.indexOf(n.q) >= 0) return true;
  if (_ssAllIn_(_ssNameFold_(c), n.tokens)) return true;
  var cf = _ssCskhFold_(c); return !!cf && _ssAllIn_(cf, n.tokens);
}
// Điểm xếp hạng gợi ý (0 = không khớp): SĐT trùng 100 / bắt đầu 70 / chứa 40; tên trùng 100 / bắt đầu 85 / mọi từ đều mở đầu 1 từ trong tên 60 / chứa 45; tên CSKH 20.
function ssScore_(c, n){
  var ph = String(c.phone || ''), best = 0;
  if (n.kind === 'phone') { var i0 = ph.indexOf(n.phone); return i0 < 0 ? 0 : (ph === n.phone ? 100 : (i0 === 0 ? 70 : 40)); }
  if (n.q && /\d/.test(n.q)) { var i1 = ph.indexOf(n.q); if (i1 >= 0) best = i1 === 0 ? 70 : 40; }
  var nf = _ssNameFold_(c);
  if (n.fold && nf === n.fold) return 100;
  if (n.fold && nf.indexOf(n.fold) === 0) return Math.max(best, 85);
  if (_ssAllIn_(nf, n.tokens)) {
    var wordStart = true, hay = ' ' + nf;
    for (var i = 0; i < n.tokens.length; i++) if (hay.indexOf(' ' + n.tokens[i]) < 0) { wordStart = false; break; }
    return Math.max(best, wordStart ? 60 : 45);
  }
  var cf = _ssCskhFold_(c);
  if (cf && _ssAllIn_(cf, n.tokens)) return Math.max(best, 20);
  return best;
}
// Chỉ gợi ý khi đủ dài và KHÔNG giống mã đơn: phone (≥4 số) | chỉ số ≥3 | chữ không số ≥2 ký tự.
function ssCanSuggest_(n){
  if (!n || n.kind === 'empty' || n.kind === 'mixed') return false;
  if (n.kind === 'phone') return true;
  if (/^\d+$/.test(n.q)) return n.q.length >= 3;
  return n.fold.length >= 2 && !/\d/.test(n.raw);
}
// Top `limit` khách khớp nhất (1 lượt quét, giữ danh sách nhỏ có thứ tự — không sắp xếp cả 136k). Hoà điểm: nhiều đơn hơn trước.
function ssSuggest_(list, n, limit, inScope){
  limit = limit || 8; var top = [];
  if (!ssCanSuggest_(n) || !list) return top;
  for (var i = 0; i < list.length; i++) {
    var c = list[i]; if (!c) continue;
    var sc = ssScore_(c, n); if (!sc) continue;
    if (inScope && !inScope(c)) continue;
    var ord = Number(c.totalOrders) || 0;
    if (top.length >= limit) { var w = top[top.length - 1]; if (sc < w.sc || (sc === w.sc && ord <= w.ord)) continue; }
    var k = top.length; while (k > 0 && (top[k - 1].sc < sc || (top[k - 1].sc === sc && top[k - 1].ord < ord))) k--;
    top.splice(k, 0, { c: c, sc: sc, ord: ord }); if (top.length > limit) top.pop();
  }
  return top;
}
function _ssEsc_(t){ return typeof esc === 'function' ? esc(t) : String(t == null ? '' : t).replace(/[&<>"']/g, function(m){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
function ssSuggestHtml_(items){
  if (!items || !items.length) return '';
  return '<div class="css-h">' + items.length + ' khách khớp — ↑↓ Enter hoặc bấm để mở hồ sơ</div>' + items.map(function(it, i){
    var c = it.c, ord = Number(c.totalOrders) || 0;
    return '<div class="css-i' + (i === 0 ? ' on' : '') + '" data-ph="' + _ssEsc_(c.phone) + '"><b>' + _ssEsc_(c.name || '(chưa có tên)') + '</b> <span class="css-p">' + _ssEsc_(c.phone) + '</span>' + (ord ? '<span class="css-s">' + ord + ' đơn</span>' : '') + '</div>';
  }).join('');
}
// 18/11/2026 (Thư viện sản phẩm): ô tìm khách còn gợi ý thêm SẢN PHẨM / COMBO (và tìm cả trong phần Thông tin sản phẩm) — bấm = mở thẳng thư mục trong 🛍️ Thư viện sản phẩm.
// Dữ liệu từ js/94 (plibSearch/plibPreload/plibOpen); thiếu js/94 hoặc chưa tải xong danh mục → không hiện gì, khối khách chạy y như cũ. Chỉ khi gõ chữ (không phải SĐT/mã đơn).
function ssProdSuggest_(n){
  if (!n || n.kind !== 'text' || n.fold.length < 2 || typeof plibSearch !== 'function') return [];
  try { return plibSearch(n.raw, 5) || []; } catch (e) { return []; }
}
function ssProdHtml_(prods, offset){
  if (!prods || !prods.length) return '';
  return '<div class="css-h">🛍️ ' + prods.length + ' sản phẩm / combo — bấm để mở Thư viện sản phẩm</div>' + prods.map(function(p, i){
    var meta = (p.n ? p.n + ' ảnh' : 'chưa có ảnh') + (p.hasInfo ? ' · 📝' : '') + (p.viaInfo ? ' · khớp trong thông tin' : '');
    return '<div class="css-i css-pl' + (!offset && i === 0 ? ' on' : '') + '" data-pn="' + _ssEsc_(p.name) + '" data-pg="' + _ssEsc_(p.group || '') + '"><b>' + (p.combo ? '🎁 ' : '🛍️ ') + _ssEsc_(p.name) + '</b>' + (p.group ? ' <span class="css-p">' + _ssEsc_(p.group) + '</span>' : '') + '<span class="css-s">' + _ssEsc_(meta) + '</span></div>';
  }).join('');
}
// ── Gắn vào giao diện ──
var _ssState = { items: [], idx: 0, timer: null };
function ssRender_(){
  var inp = document.getElementById('search-input'), box = document.getElementById('cust-suggest'); if (!inp || !box) return;
  var n = ssNormQuery_(inp.value);
  var items = (typeof allCustomers !== 'undefined') ? ssSuggest_(allCustomers, n, 8, typeof _inUserScope === 'function' ? _inUserScope : null) : [];
  if (n && n.kind === 'text' && typeof plibPreload === 'function') plibPreload(ssRender_);   // tải ngầm danh mục SP/combo lần đầu rồi vẽ lại
  var prods = ssProdSuggest_(n);
  _ssState.items = items.concat(prods.map(function(p){ return { pl: p }; })); _ssState.idx = 0;   // thứ tự = thứ tự trong hộp (khách trước, sản phẩm sau) để ↑↓/Enter khớp
  if (!_ssState.items.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
  var ors = document.getElementById('ord-search-res'); if (ors) ors.style.display = 'none';
  box.innerHTML = ssSuggestHtml_(items) + ssProdHtml_(prods, items.length); box.style.display = 'block';
}
function ssHide_(){ var box = document.getElementById('cust-suggest'); if (box) box.style.display = 'none'; }
function ssPick_(phone){ ssHide_(); if (phone && typeof openDp === 'function') openDp(phone); }
function ssPickPl_(name, group){ ssHide_(); if (name && typeof plibOpen === 'function') plibOpen(name, group); }
function ssPickItem_(it){ if (!it) return; if (it.pl) ssPickPl_(it.pl.name, it.pl.group); else ssPick_(it.c.phone); }
function ssMove_(d){
  var box = document.getElementById('cust-suggest'); if (!box || box.style.display === 'none' || !_ssState.items.length) return false;
  _ssState.idx = (_ssState.idx + d + _ssState.items.length) % _ssState.items.length;
  var els = box.querySelectorAll('.css-i'); for (var i = 0; i < els.length; i++) els[i].classList.toggle('on', i === _ssState.idx);
  return true;
}
function ssInit_(){
  var inp = document.getElementById('search-input'); if (!inp || inp._ssInit) return; inp._ssInit = true;
  var box = document.createElement('div'); box.id = 'cust-suggest'; box.style.display = 'none';
  var ref = document.getElementById('ord-search-res'); (ref && ref.parentNode ? ref.parentNode : inp.parentNode).appendChild(box);
  inp.addEventListener('input', function(){ clearTimeout(_ssState.timer); _ssState.timer = setTimeout(ssRender_, 150); });
  inp.addEventListener('focus', function(){ if (inp.value) ssRender_(); });
  inp.addEventListener('keydown', function(e){
    if (e.key === 'ArrowDown') { if (ssMove_(1)) e.preventDefault(); }
    else if (e.key === 'ArrowUp') { if (ssMove_(-1)) e.preventDefault(); }
    else if (e.key === 'Escape') ssHide_();
    else if (e.key === 'Enter' && box.style.display !== 'none' && _ssState.items.length) { e.preventDefault(); ssPickItem_(_ssState.items[_ssState.idx]); }
  });
  box.addEventListener('mousedown', function(e){ e.preventDefault(); });   // giữ focus ô tìm, bấm không làm ô mất focus trước khi chọn
  box.addEventListener('click', function(e){ var it = e.target.closest ? e.target.closest('.css-i') : null; if (!it) return; if (it.hasAttribute('data-pn')) ssPickPl_(it.getAttribute('data-pn'), it.getAttribute('data-pg')); else ssPick_(it.getAttribute('data-ph')); });
  document.addEventListener('click', function(e){ if (e.target !== inp && !(box.contains && box.contains(e.target))) ssHide_(); });
}
if (typeof document !== 'undefined' && document.addEventListener) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ssInit_); else ssInit_(); }
if (typeof module !== 'undefined') module.exports = { ssProdSuggest_, ssProdHtml_, ssFold_, ssNormQuery_, ssMatchText_, ssScore_, ssCanSuggest_, ssSuggest_, ssSuggestHtml_ };

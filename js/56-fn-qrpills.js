// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  L2 — Thanh chọn nhanh khoảng ngày dạng viên thuốc `Hôm nay | Tuần này | Tháng này | Khác ▾` (theo ảnh mẫu Duyên chọn 14/10/2026).
//  Dùng ĐÚNG bộ mốc _PK_QUICK_RANGES (js/16) và hàm áp dụng sẵn của từng màn (vd _ovQuick, _taQuick): biểu thức truyền vào là chuỗi JS dùng `this.value`,
//  y hệt _quickRangeSelectHtml — nên đổi chỗ gọi là xong, KHÔNG đổi logic ngày. KHÔNG sửa _quickRangeSelectHtml (js/47-staff-profile.js chỉnh chuỗi <select> của nó + test kiểm).
//  qrPick_ tô nút đang chọn (nút bấm hoặc ô "Khác"). Test: node tools/test-qr-pills.js
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var QR_MAIN_ = ['today', 'thisWeek', 'thisMonth'];
var QR_DEFAULT_ = [{ v:'today', l:'Hôm nay' }, { v:'yesterday', l:'Hôm qua' }, { v:'thisWeek', l:'Tuần này' }, { v:'lastWeek', l:'Tuần trước' }, { v:'thisMonth', l:'Tháng này' }, { v:'lastMonth', l:'Tháng trước' },
  { v:'thisQuarter', l:'Quý này' }, { v:'lastQuarter', l:'Quý trước' }, { v:'thisYear', l:'Năm này' }, { v:'lastYear', l:'Năm trước' }, { v:'custom', l:'Tuỳ chỉnh…' }];
function qrAttr_(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
// selectedKey: mốc đang chọn ('custom' = không mốc nào sáng). expr: đoạn JS dùng this.value, vd "_ovQuick(this.value)". opts.style: style thêm cho khung.
function qrPillsHtml_(selectedKey, expr, opts){
  var all = (typeof _PK_QUICK_RANGES !== 'undefined' && _PK_QUICK_RANGES) || QR_DEFAULT_, k = selectedKey || 'custom', e = qrAttr_(expr);
  var label = {}; all.forEach(function(o){ label[o.v] = o.l; });
  var h = '<span class="qr-pills" role="group" aria-label="Chọn nhanh khoảng ngày"' + (opts && opts.style ? ' style="' + qrAttr_(opts.style) + '"' : '') + '>';
  QR_MAIN_.forEach(function(key){ if (label[key]) h += '<button type="button" class="qr-b' + (k === key ? ' on' : '') + '" value="' + key + '" onclick="qrPick_(this);' + e + '">' + qrAttr_(label[key]) + '</button>'; });
  var others = all.filter(function(o){ return QR_MAIN_.indexOf(o.v) === -1; }), otherSel = others.some(function(o){ return o.v === k && k !== 'custom'; });
  h += '<select class="qr-more' + (otherSel ? ' on' : '') + '" aria-label="Mốc khác" onchange="if(!this.value)return;qrPick_(this);' + e + '"><option value=""' + (otherSel ? '' : ' selected') + '>Khác</option>' +
    others.map(function(o){ return '<option value="' + o.v + '"' + (otherSel && o.v === k ? ' selected' : '') + '>' + qrAttr_(o.l) + '</option>'; }).join('') + '</select></span>';
  return h;
}
function qrPick_(el){
  var g = el && el.closest ? el.closest('.qr-pills') : null; if (!g) return;
  Array.prototype.forEach.call(g.querySelectorAll('button'), function(b){ b.classList.toggle('on', b === el); });
  var s = g.querySelector('select');
  if (s) { if (el.tagName === 'SELECT') s.classList.add('on'); else { s.value = ''; s.classList.remove('on'); } }
}
if (typeof module !== 'undefined' && module.exports) module.exports = { qrPillsHtml_: qrPillsHtml_, qrPick_: qrPick_, QR_MAIN_: QR_MAIN_ };

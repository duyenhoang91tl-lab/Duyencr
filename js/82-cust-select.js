// R5a bước 1 — CHỌN NHIỀU KHÁCH ở Danh sách KH (chưa có thao tác hàng loạt; bước 2/3 đăng ký thao tác qua csSelAddAction_).
// NGUYÊN NHÂN GỐC (R5a): Danh sách KH chỉ mở được từng khách; đổi CS/tình trạng/trạng thái cho nhiều khách phải mở hồ sơ từng người.
// Thiết kế: KHÔNG sửa js/02. Bọc _rowHtml (hàm vẽ 1 dòng của bảng ảo) để chèn ô tích vào đầu ô Tên; bảng ảo chỉ vẽ ~vài chục dòng
// nên trạng thái chọn nằm trong 1 Set SĐT (không theo DOM) → 136k khách vẫn không giật. Thiếu js/82 → bảng y như cũ.
// Hàm thuần (test được trong Node): csSelToggle_, csSelSetAll_, csSelClear_, csSelCount_, csSelList_, csSelHas_, csSelState_.
var _csSel = { set: Object.create(null), n: 0, actions: [] };
function csSelHas_(phone) { return _csSel.set[String(phone)] === 1; }
function csSelCount_() { return _csSel.n; }
function csSelList_() { return Object.keys(_csSel.set); }
function csSelToggle_(phone, on) {
  var k = String(phone || ''); if (!k) return false;
  var has = _csSel.set[k] === 1, want = (on === undefined) ? !has : !!on;
  if (want && !has) { _csSel.set[k] = 1; _csSel.n++; }
  else if (!want && has) { delete _csSel.set[k]; _csSel.n--; }
  return want;
}
// Chọn / bỏ chọn cả danh sách `list` (mảng khách có .phone) — dùng cho "chọn tất cả đang lọc".
function csSelSetAll_(list, on) {
  (list || []).forEach(function (c) { if (c && c.phone) csSelToggle_(c.phone, on); });
}
function csSelClear_() { _csSel.set = Object.create(null); _csSel.n = 0; }
// 'none' | 'some' | 'all' so với danh sách đang lọc
function csSelState_(list) {
  var L = list || [], n = 0;
  for (var i = 0; i < L.length; i++) if (L[i] && csSelHas_(L[i].phone)) n++;
  return n === 0 ? 'none' : (n === L.length ? 'all' : 'some');
}
// Thao tác hàng loạt do các bước sau đăng ký: { id, label, run(phones[]), visible()? } (visible trả false → ẩn nút, vd CS thường không được gán CS)
function csSelAddAction_(a) {
  if (!a || !a.id || typeof a.run !== 'function') return;
  _csSel.actions = _csSel.actions.filter(function (x) { return x.id !== a.id; });
  _csSel.actions.push(a);
  if (typeof document !== 'undefined') csSelSync_();
}
function csSelInject_(html, phone) {
  var on = csSelHas_(phone);
  var box = '<input type="checkbox" class="cs-sel-box" data-cs-sel="' + String(phone).replace(/[^0-9+]/g, '') + '" title="Chọn khách này"' + (on ? ' checked' : '') + '>';
  var out = String(html).replace('<td class="col-name">', '<td class="col-name">' + box);
  if (on) out = out.replace('<tr ', '<tr class="cs-sel-on" ');
  return out;
}
// ── Phần giao diện (chỉ chạy trong trình duyệt) ──
function csSelBar_() {
  var bar = document.getElementById('cs-selbar');
  if (!bar) { bar = document.createElement('div'); bar.id = 'cs-selbar'; document.body.appendChild(bar); }
  return bar;
}
function csSelList2_() { return (typeof _vt !== 'undefined' && _vt && _vt.list) ? _vt.list : []; }
function csSelSync_() {
  var n = csSelCount_(), bar = csSelBar_(), list = csSelList2_();
  var th = document.getElementById('cs-sel-all');
  if (th) { var st = csSelState_(list); th.checked = (st === 'all'); th.indeterminate = (st === 'some'); }
  if (!n) { bar.className = ''; bar.innerHTML = ''; return; }
  var h = '<span class="cs-sel-n">' + n + ' khách đã chọn</span>';
  if (list.length && n < list.length) h += '<button type="button" class="btn sm secondary" data-cs-act="all">Chọn tất cả ' + list.length + ' đang lọc</button>';
  var acts = _csSel.actions.filter(function (a) { try { return !a.visible || a.visible(); } catch (e) { return false; } });
  acts.forEach(function (a) { h += '<button type="button" class="btn sm" data-cs-act="run:' + a.id + '">' + a.label + '</button>'; });
  if (!acts.length) h += '<span class="cs-sel-hint">(thao tác hàng loạt sẽ có ở bước sau)</span>';
  h += '<button type="button" class="btn sm secondary" data-cs-act="clear">Bỏ chọn</button>';
  bar.innerHTML = h; bar.className = 'is-open';
}
function csSelRepaint_() { if (typeof _renderVirtualWindow === 'function') _renderVirtualWindow(true); csSelSync_(); }
function csSelInit_() {
  if (typeof document === 'undefined' || csSelInit_.done) return; csSelInit_.done = true;
  var tbody = document.getElementById('table-body');
  if (tbody) tbody.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.classList || !t.classList.contains('cs-sel-box')) return;
    e.stopPropagation();   // không mở hồ sơ khách (onclick của dòng)
    var tr = t.closest('tr'), phone = tr && tr.dataset ? tr.dataset.phone : '';
    csSelToggle_(phone, t.checked);
    if (tr) tr.classList.toggle('cs-sel-on', t.checked);
    csSelSync_();
  }, true);
  var thName = document.getElementById('th-name');
  if (thName && !document.getElementById('cs-sel-all')) {
    var cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'cs-sel-all'; cb.className = 'cs-sel-th'; cb.title = 'Chọn / bỏ chọn tất cả khách đang lọc';
    cb.addEventListener('click', function (e) { e.stopPropagation(); csSelSetAll_(csSelList2_(), cb.checked); csSelRepaint_(); });
    var inner = thName.querySelector('.th-inner') || thName; inner.insertBefore(cb, inner.firstChild);
  }
  csSelBar_().addEventListener('click', function (e) {
    var a = e.target && e.target.getAttribute && e.target.getAttribute('data-cs-act'); if (!a) return;
    if (a === 'clear') { csSelClear_(); csSelRepaint_(); }
    else if (a === 'all') { csSelSetAll_(csSelList2_(), true); csSelRepaint_(); }
    else if (a.indexOf('run:') === 0) { var id = a.slice(4); var act = _csSel.actions.filter(function (x) { return x.id === id; })[0]; if (act) act.run(csSelList_()); }
  });
}
// Bọc _rowHtml + renderTable (không sửa js/02). Bọc trong try để thiếu hàm gốc thì không làm hỏng trang.
(function () {
  if (typeof window === 'undefined' || typeof window._rowHtml !== 'function' || window._rowHtml.__csSel) return;
  var orig = window._rowHtml;
  var wrapped = function (c) { var h = orig(c); try { return csSelInject_(h, c && c.phone); } catch (e) { return h; } };
  wrapped.__csSel = true; window._rowHtml = wrapped;
  if (typeof window.renderTable === 'function') {
    var origRT = window.renderTable;
    window.renderTable = function (list) { var r = origRT.apply(this, arguments); try { csSelInit_(); csSelSync_(); } catch (e) {} return r; };
  }
})();
if (typeof module !== 'undefined') module.exports = { csSelToggle_: csSelToggle_, csSelSetAll_: csSelSetAll_, csSelClear_: csSelClear_, csSelCount_: csSelCount_, csSelList_: csSelList_, csSelHas_: csSelHas_, csSelState_: csSelState_, csSelInject_: csSelInject_, csSelAddAction_: csSelAddAction_ };

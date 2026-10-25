// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  TỰ ĐỘNG BIẾN SĐT + MÃ ĐƠN THÀNH CHỮ BẤM ĐƯỢC → MỞ HỒ SƠ KHÁCH, ở MỌI màn (2026-10-25, Duyên yêu cầu:
//  "màn hình nào có SĐT khách hoặc mã đơn thì bấm vào sẽ hiện thông tin khách hàng")
//  LÝ DO GỐC làm kiểu tự động: trước đó phải bọc _custLinkHtml_ (js/29) vào TỪNG bảng (mới phủ ~7 chỗ), còn hàng chục bảng/danh sách/popup khác
//  hiện SĐT dạng chữ thường -> bấm không ra gì. Nay 1 MutationObserver quét chữ mới xuất hiện trên trang, bọc SĐT / mã bộ đếm thành
//  <span class="cust-link alk"> rồi mở hồ sơ qua _openCustomerByPhone_ (js/29: nạp riêng khách ngoài danh sách đang tải rồi openDp).
//  - SĐT: 0xxxxxxxxx (10-11 số) hoặc +84/84xxxxxxxxx liền nhau. Mã đơn: mã bộ đếm dạng 1011T09/2026 -> hỏi GAS searchOrder lấy SĐT rồi mở khách
//    (mã DT TỔNG / ghi chú Pos tra được ở ô tìm nhanh, KHÔNG tự nhận diện ở đây vì không có dạng cố định).
//  - KHÔNG bọc: ô nhập (input/textarea/select/contenteditable), <a>/<button>, chữ đã bấm được (.cust-link, [data-cust-phone]), ngăn hồ sơ khách (#dp-overlay),
//    khung tìm nhanh (#qs-res), chỗ gắn data-no-autolink. Mã bộ đếm nằm trong dòng có data-counter (bấm mở popup đơn riêng) thì để nguyên.
//  - Bấm khi đang bôi đen chữ (để copy) thì KHÔNG mở. Tắt khẩn cấp: localStorage ome_autolink = 'off' (rồi F5).
//  Test: node tools/test-auto-cust-link.js (jsdom).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
(function(){
  if (typeof window === 'undefined' || window._alkInit) return;
  window._alkInit = true;
  var SKIP_SEL = 'input,textarea,select,option,script,style,noscript,a,button,[contenteditable],[data-no-autolink],.cust-link,[data-cust-phone],#dp-overlay,#qs-res';
  var CAND_RE = /\d{9}|\d{1,6}T\d{1,2}\/\d{4}/i;
  var TOKEN_RE = /(?:\+?84\d{9}|0\d{9,10})(?!\d)|\d{1,6}T\d{1,2}\/\d{4}(?!\d)/gi;

  // Tách 1 đoạn chữ thành các phần [{k:'t'|'p'|'o', v}] — null nếu không có SĐT/mã đơn nào. (Xuất ra window để test.)
  function split(text){
    var out = [], last = 0, m, any = false;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(text)) !== null) {
      var prev = m.index > 0 ? text.charAt(m.index - 1) : '';
      var isOrder = /T/i.test(m[0]) && m[0].indexOf('/') !== -1;
      if (/\d/.test(prev) || (isOrder && /[A-Za-z_]/.test(prev)) || (!isOrder && prev === '+' && m[0].charAt(0) !== '+')) continue;
      if (m.index > last) out.push({ k: 't', v: text.slice(last, m.index) });
      out.push({ k: isOrder ? 'o' : 'p', v: m[0] });
      last = m.index + m[0].length; any = true;
    }
    if (!any) return null;
    if (last < text.length) out.push({ k: 't', v: text.slice(last) });
    return out;
  }
  function skipEl(el){ try { return !el || (el.closest && !!el.closest(SKIP_SEL)); } catch (e) { return true; } }

  function transform(node){
    var parent = node.parentNode; if (!parent || skipEl(parent)) return 0;
    var parts = split(node.nodeValue); if (!parts) return 0;
    var inCounterRow = !!(parent.closest && parent.closest('[data-counter]'));
    var frag = document.createDocumentFragment(), n = 0;
    parts.forEach(function(p){
      if (p.k === 't' || (p.k === 'o' && inCounterRow)) { frag.appendChild(document.createTextNode(p.v)); return; }
      var s = document.createElement('span');
      s.className = 'cust-link alk';
      s.textContent = p.v;
      if (p.k === 'p') { s.setAttribute('data-alk-phone', p.v); s.title = 'Bấm để mở hồ sơ khách'; }
      else { s.setAttribute('data-alk-order', p.v); s.title = 'Bấm để mở hồ sơ khách của đơn này'; }
      frag.appendChild(s); n++;
    });
    if (!n) return 0;
    parent.replaceChild(frag, node);
    return n;
  }

  // Quét 1 phần tử: gom text node có ứng viên TRƯỚC rồi mới thay (không sửa DOM khi đang duyệt). Trả về số text node còn dư (budget hết).
  function scan(root, budget){
    if (!root || root.nodeType !== 1 || !root.isConnected || skipEl(root)) return 0;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function(t){
      var v = t.nodeValue;
      if (!v || v.length < 9 || !CAND_RE.test(v)) return NodeFilter.FILTER_REJECT;
      return skipEl(t.parentNode) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    } });
    var nodes = [], t;
    while ((t = walker.nextNode())) { nodes.push(t); if (nodes.length >= budget) break; }
    nodes.forEach(transform);
    return nodes.length;
  }

  var queue = [], timer = null, mo = null;
  function enqueue(el){ if (el && el.nodeType === 1) queue.push(el); if (!timer) timer = setTimeout(flush, 200); }
  function flush(){
    timer = null;
    var seen = [], list = queue; queue = [];
    list.forEach(function(el){ if (seen.indexOf(el) === -1) seen.push(el); });
    var budget = 2500, i = 0, rest = [];
    for (; i < seen.length && budget > 0; i++) {
      var used = scan(seen[i], budget);
      if (used >= budget) rest.push(seen[i]);   // hết ngân sách giữa chừng: phần tử này còn chữ chưa quét -> quét tiếp lượt sau (phần đã bọc không khớp lại)
      budget -= used || 1;
    }
    if (mo) { try { mo.takeRecords(); } catch (e) {} }   // bỏ các thay đổi do chính mình vừa tạo (tránh quét lại / vòng lặp)
    rest = rest.concat(seen.slice(i));
    if (rest.length) { queue = rest.concat(queue); timer = setTimeout(flush, 30); }
  }

  // ── Bấm ──
  var _ord = {};   // mã đơn (chữ thường) -> SĐT, nhớ trong phiên
  async function openByOrder(code){
    var k = String(code || '').trim().toLowerCase(); if (!k) return;
    if (typeof _openCustomerByPhone_ !== 'function') return;
    var ph = _ord[k];
    if (!ph) {
      if (document.body.classList.contains('demo-mode')) { if (typeof toast === 'function') toast('Tài khoản test không tra được mã đơn ngoài danh sách'); return; }
      if (typeof gsUrl === 'undefined' || !gsUrl) return;
      if (typeof toast === 'function') toast('Đang tra mã đơn…');
      try {
        var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
        var r = await fetch(gsUrl + sep + 'action=searchOrder&q=' + encodeURIComponent(code), { redirect: 'follow' });
        var j = await r.json();
        var res = (j && j.results) || [], hit = null, i;
        for (i = 0; i < res.length; i++) if (res[i].phone && String(res[i].code || '').toLowerCase() === k) { hit = res[i]; break; }
        if (!hit) for (i = 0; i < res.length; i++) if (res[i].phone) { hit = res[i]; break; }
        ph = hit ? hit.phone : '';
      } catch (e) { if (typeof toast === 'function') toast('Lỗi tra mã đơn: ' + (e && e.message || e)); return; }
      if (!ph) { if (typeof toast === 'function') toast('Không tìm thấy khách của mã đơn ' + code); return; }
      _ord[k] = ph;
    }
    return _openCustomerByPhone_(ph);
  }
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest && e.target.closest('[data-alk-phone],[data-alk-order]');
    if (!t) return;
    var sel = ''; try { sel = String(window.getSelection ? window.getSelection() : ''); } catch (e1) {}
    if (sel && !/^\s*$/.test(sel)) return;   // đang bôi đen để copy -> không mở
    e.stopPropagation(); e.preventDefault();   // capture: không kích hoạt onclick của dòng/ô cha
    if (t.hasAttribute('data-alk-phone')) { if (typeof _openCustomerByPhone_ === 'function') _openCustomerByPhone_(t.getAttribute('data-alk-phone')); }
    else openByOrder(t.getAttribute('data-alk-order'));
  }, true);

  function start(){
    try { if (localStorage.getItem('ome_autolink') === 'off') return; } catch (e) {}
    if (typeof MutationObserver === 'undefined' || !document.body) return;
    mo = new MutationObserver(function(muts){
      for (var i = 0; i < muts.length; i++) {
        var add = muts[i].addedNodes;
        for (var j = 0; j < add.length; j++) {
          var n = add[j];
          if (n.nodeType === 1) { if (!(n.classList && n.classList.contains('alk'))) enqueue(n); }
          else if (n.nodeType === 3 && n.parentNode && CAND_RE.test(n.nodeValue || '')) enqueue(n.parentNode);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    enqueue(document.body);
  }
  window._alkSplit_ = split; window._alkScan_ = function(root){ return scan(root || document.body, 1e9); }; window._alkOpenOrder_ = openByOrder;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

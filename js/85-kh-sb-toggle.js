// Ẩn/hiện CỘT LỌC bên trái của Danh sách KH (ô tìm, Lọc theo CS, Loại KH, Phân loại KH, Tình trạng CS) — như menu chính.
// NGUYÊN NHÂN GỐC: cột lọc `.sidebar` chỉ ẩn được CÙNG LÚC với menu chính (#sh-edge js/55 → shell-collapsed) hoặc là ngăn kéo ở điện thoại;
// không có nút ẩn/hiện RIÊNG nên muốn bảng rộng hơn phải thu gọn cả menu chính. KHÔNG sửa js/55: dùng class riêng html.kh-sb-off (css/29).
// Nút `#kh-sb-edge`: mũi tên ở mép phải cột lọc (‹ ẩn); khi đang ẩn nằm ở mép trái vùng nội dung (› hiện). Lưu localStorage `ome_kh_sb` ('0' = ẩn).
// Chỉ hiện ở tab Danh sách KH, màn rộng (>768px), không rpt-mode, không shell-collapsed (khi đó cột lọc đã ẩn theo menu chính).
// Hàm thuần (test được trong Node): khSbPlan_(st). Gỡ hẳn: xoá thẻ script/link js/85 + css/29 trong index.html.
var KH_SB_KEY = 'ome_kh_sb';
function khSbPlan_(st) {
  st = st || {};
  var wide = (st.width || 0) > 768;
  var show = !!(wide && st.listTab && !st.rptMode && !st.shellCollapsed && st.loggedIn !== false);
  var hidden = !!st.hidden;
  var left = hidden ? (st.appLeft || 0) : (st.sbRight || 0);
  return {
    show: show,
    hide: show && hidden,                       // true → áp class kh-sb-off (ẩn cột lọc)
    left: Math.max(0, Math.round(left)),
    label: hidden ? '›' : '‹',
    title: hidden ? 'Hiện bộ lọc khách hàng' : 'Ẩn bộ lọc khách hàng'
  };
}
function khSbIsHidden_() { try { return localStorage.getItem(KH_SB_KEY) === '0'; } catch (e) { return false; } }
function khSbToggle_(force) {
  var want = (typeof force === 'boolean') ? force : !khSbIsHidden_();   // want = ẩn?
  try { localStorage.setItem(KH_SB_KEY, want ? '0' : '1'); } catch (e) {}
  khSbApply_();
  return want;
}
function khSbApply_() {
  if (typeof document === 'undefined') return null;
  var b = document.getElementById('kh-sb-edge'), de = document.documentElement, body = document.body;
  if (!b) {
    b = document.createElement('button'); b.id = 'kh-sb-edge'; b.type = 'button';
    b.addEventListener('click', function () { khSbToggle_(); });
    body.appendChild(b);
  }
  var sb = document.querySelector('.app .sidebar'), app = document.querySelector('.app');
  var hidden = khSbIsHidden_();
  var dv = document.getElementById('data-view');
  var st = {
    width: window.innerWidth, hidden: hidden,
    listTab: !body.classList.contains('no-kh-sidebar'), rptMode: body.classList.contains('rpt-mode'),
    shellCollapsed: de.classList.contains('shell-collapsed'),
    loggedIn: dv ? (dv.style.display !== 'none') : true,
    sbRight: (!hidden && sb) ? sb.getBoundingClientRect().right : 0,
    appLeft: app ? app.getBoundingClientRect().left : 0
  };
  var p = khSbPlan_(st);
  de.classList.toggle('kh-sb-off', p.hide);
  b.classList.toggle('is-on', p.show);
  b.textContent = p.label; b.title = p.title; b.setAttribute('aria-label', p.title);
  b.style.left = p.left + 'px';
  return p;
}
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.__khSbLoaded) return; window.__khSbLoaded = true;
  var raf = 0;
  function soon() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; try { khSbApply_(); } catch (e) {} }); }
  function init() {
    soon();
    window.addEventListener('resize', soon);
    if (window.MutationObserver) {
      var mo = new MutationObserver(soon);
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });                                   // no-kh-sidebar / rpt-mode đổi theo tab
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });                       // shell-collapsed
      var dv = document.getElementById('data-view'); if (dv) mo.observe(dv, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    setTimeout(soon, 1500);   // sau khi đăng nhập/dựng bố cục xong, đo lại vị trí mép cột lọc
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
if (typeof window !== 'undefined') { window.khSbToggle = khSbToggle_; window.khSbIsHidden = khSbIsHidden_; }
if (typeof module !== 'undefined') module.exports = { khSbPlan_: khSbPlan_ };

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  L1 — KHUNG XANH NAVY (xem css/13-shell.css, docs/UI-LAYOUT-PLAN.md). Chỉ bật/tắt class trên <html> và thêm chân menu; KHÔNG đổi logic tab/quyền/menu (js/29-sidenav.js giữ nguyên).
//  Bật (html.ui-shell) khi: màn dữ liệu chính (#data-view) đang hiện + cửa sổ >= 1100px + chưa chọn "Giao diện cũ" + không phải dashboard/báo cáo độc lập.
//  Thu gọn (html.shell-collapsed): menu về ngăn kéo ẩn như cũ. Lưu lựa chọn: localStorage ome_shell ('off' = giao diện cũ), ome_shell_col ('1' = thu gọn).
//  Hàm thuần shellDecide_ tách riêng để test: node tools/test-shell.js
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SHELL_MIN_W = 1100;
function shellDecide_(st){
  // st = { pref:'on'|'off', width, dataViewShown, blocked, collapsed } -> { on, collapsed }
  var on = st.pref !== 'off' && st.width >= SHELL_MIN_W && !!st.dataViewShown && !st.blocked;
  return { on: on, collapsed: on && !!st.collapsed };
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') (function(){
  var KEY = 'ome_shell', KCOL = 'ome_shell_col';
  function ls(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
  function state(){
    var dv = document.getElementById('data-view'), h = document.documentElement;
    return { pref: ls(KEY) === 'off' ? 'off' : 'on', width: window.innerWidth || 0, dataViewShown: !!(dv && dv.style.display !== 'none'),
      blocked: h.classList.contains('db-standalone') || document.body.classList.contains('rpt-mode'), collapsed: ls(KCOL) === '1' };
  }
  function foot(d, st){
    var t = document.querySelector('#data-view .tabs'); if (!t) return;
    var f = t.querySelector('.sh-foot');
    if (!f) {
      f = document.createElement('div'); f.className = 'sh-foot';
      f.innerHTML = '<button type="button" class="sh-col"></button><button type="button" class="sh-old"></button>';
      f.querySelector('.sh-col').addEventListener('click', function(e){ e.stopPropagation(); shellToggleCollapse(); });
      f.querySelector('.sh-old').addEventListener('click', function(e){
        e.stopPropagation();
        if (document.documentElement.classList.contains('ui-shell')) {
          if (confirm('Quay về giao diện cũ (menu ẩn, bấm ☰ Menu để mở)? Bạn có thể bật lại bằng nút "✨ Giao diện mới" trong menu.')) { lsSet(KEY, 'off'); shellApply(); }
        } else { lsSet(KEY, 'on'); shellApply(); }
      });
      t.appendChild(f);
    }
    var wideOk = st.width >= SHELL_MIN_W && !st.blocked;
    f.querySelector('.sh-col').style.display = d.on ? '' : 'none';
    f.querySelector('.sh-col').textContent = d.collapsed ? '📌 Ghim menu' : '⟨ Thu gọn';
    var old = f.querySelector('.sh-old'); old.style.display = (d.on || (wideOk && st.pref === 'off')) ? '' : 'none';
    old.textContent = d.on ? '⇄ Giao diện cũ' : '✨ Giao diện mới';
  }
  window.shellApply = function(){
    var st = state(), d = shellDecide_(st), h = document.documentElement;
    h.classList.toggle('ui-shell', d.on); h.classList.toggle('shell-collapsed', d.collapsed);
    foot(d, st);
    return d;
  };
  window.shellToggleCollapse = function(){ lsSet(KCOL, ls(KCOL) === '1' ? '0' : '1'); return window.shellApply(); };
  function init(){
    window.shellApply();
    window.addEventListener('resize', window.shellApply);
    var dv = document.getElementById('data-view');
    if (dv && window.MutationObserver) new MutationObserver(window.shellApply).observe(dv, { attributes: true, attributeFilter: ['style'] });
    var t = document.querySelector('#data-view .tabs');   // sidenav tạo nhóm/mục sau khi đăng nhập: bảo đảm chân menu luôn nằm cuối
    if (t && window.MutationObserver) new MutationObserver(function(){ var f = t.querySelector('.sh-foot'); if (f && f.parentNode === t && t.lastElementChild !== f) t.appendChild(f); }).observe(t, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { shellDecide_: shellDecide_, SHELL_MIN_W: SHELL_MIN_W };

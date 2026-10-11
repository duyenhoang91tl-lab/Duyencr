// ═══════════════════════════════════════════════════════
//  F5 KHÔNG MẤT CHỖ (yêu cầu Duyên 2026-10-11)
//  NGUYÊN NHÂN GỐC: app chỉ nhớ tài khoản đăng nhập; mục menu đang mở / khách đang xem không được lưu ở đâu → F5 là về trang mặc định,
//  và trong lúc chờ đăng nhập + tải dữ liệu thì chỉ thấy khung trắng ("Tải file Excel để bắt đầu").
//  Cách làm: (1) ghi vị trí vào địa chỉ trang (#v=<mục menu>&c=<SĐT khách đang mở>) + sessionStorage mỗi khi đổi mục/mở-đóng hồ sơ khách;
//  (2) sau F5, đợi đăng nhập xong + dữ liệu hiện ra rồi bấm lại đúng mục menu và mở lại đúng hồ sơ khách;
//  (3) màn hình "Đang mở lại CRM…" (#boot-splash trong index.html) che khung trắng cho tới khi có form đăng nhập hoặc có dữ liệu.
//  Không đụng luồng đăng nhập. Mục không còn quyền xem (tab bị ẩn) thì bỏ qua, không báo lỗi.
// ═══════════════════════════════════════════════════════
(function () {
  var KEY = 'ome_nav_v1';
  var st = { v: '', c: '' };
  function ss(op, v) { try { return op === 'get' ? sessionStorage.getItem(KEY) : (op === 'set' ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY)); } catch (e) { return null; } }
  function parseHash() {
    var o = { v: '', c: '' }, h = String(location.hash || '').replace(/^#/, '');
    h.split('&').forEach(function (p) { var kv = p.split('='); if (kv[0] === 'v' || kv[0] === 'c') { try { o[kv[0]] = decodeURIComponent(kv[1] || ''); } catch (e) {} } });
    return o;
  }
  function readWanted() {
    var h = parseHash();
    if (h.v || h.c) return h;
    try { var o = JSON.parse(ss('get') || '{}'); return { v: String(o.v || ''), c: String(o.c || '') }; } catch (e) { return { v: '', c: '' }; }
  }
  var restoring = true;   // đang khôi phục thì chưa ghi đè vị trí đã lưu bằng mục mặc định
  function save() {
    if (restoring) return;
    ss('set', JSON.stringify(st));
    var h = (st.v ? 'v=' + encodeURIComponent(st.v) : '') + (st.c ? (st.v ? '&' : '') + 'c=' + encodeURIComponent(st.c) : '');
    try { history.replaceState(null, '', location.pathname + location.search + (h ? '#' + h : '')); } catch (e) {}
  }
  function activeBarId() { var a = document.querySelector('#data-view .tabs .tab.active[data-bar-id]'); return a ? a.getAttribute('data-bar-id') : ''; }
  function esc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }
  function visible(el) { return !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0; }

  // ── ghi vị trí: đổi mục menu ──
  function watchTabs() {
    var tabs = document.querySelector('#data-view .tabs'); if (!tabs || tabs._navWatched) return; tabs._navWatched = true;
    new MutationObserver(function () { var id = activeBarId(); if (id && id !== st.v) { st.v = id; save(); } })
      .observe(tabs, { attributes: true, attributeFilter: ['class'], subtree: true });
  }
  // ── ghi vị trí: mở/đóng hồ sơ khách ──
  function wrapDp() {
    if (typeof window.openDp === 'function' && !window.openDp._nav) {
      var o = window.openDp; window.openDp = function (p) { var r = o.apply(this, arguments); if (restoring === false) { st.c = String(p || ''); save(); } return r; }; window.openDp._nav = true;
    }
    if (typeof window.closeDp === 'function' && !window.closeDp._nav) {
      var cd = window.closeDp; window.closeDp = function () {
        var r = cd.apply(this, arguments);
        var ov = document.getElementById('dp-overlay'); if (ov && !ov.classList.contains('open') && st.c) { st.c = ''; save(); }
        return r;
      }; window.closeDp._nav = true;
    }
    if (typeof window.doLogout === 'function' && !window.doLogout._nav) {
      var lo = window.doLogout; window.doLogout = function () { ss('del'); try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} st = { v: '', c: '' }; return lo.apply(this, arguments); }; window.doLogout._nav = true;
    }
  }

  // ── khung "Đang mở lại CRM…": gỡ khi có form đăng nhập hoặc có dữ liệu ──
  function dropSplash() {
    var s = document.getElementById('boot-splash'); if (!s) return;
    s.style.opacity = '0'; setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 250);
  }
  function splashReady() {
    var dv = document.getElementById('data-view'); if (dv && dv.style.display !== 'none') return true;
    var ov = document.getElementById('login-overlay'), f = document.getElementById('login-form');
    return !!(ov && ov.classList.contains('show') && f && f.style.display !== 'none');
  }

  // ── khôi phục sau F5 ──
  var want = readWanted(), doneV = !want.v, doneC = !want.c, tries = 0, dataSeenAt = 0;
  function step() {
    tries++;
    wrapDp(); watchTabs();
    if (document.getElementById('boot-splash') && splashReady()) dropSplash();
    var dv = document.getElementById('data-view');
    var shown = dv && dv.style.display !== 'none';
    if (shown) {
      if (!dataSeenAt) dataSeenAt = Date.now();
      if (Date.now() - dataSeenAt > 700) {   // chờ xong phân quyền/tab
        if (!doneV) {
          doneV = true;
          var el = document.querySelector('#data-view .tabs .tab[data-bar-id="' + esc(want.v) + '"]');
          if (el && visible(el) && !el.classList.contains('active')) { try { el.click(); } catch (e) { console.warn('khôi phục mục lỗi', e); } }
        }
        if (doneV && !doneC && typeof allCustomers !== 'undefined' && allCustomers.length) {
          doneC = true;
          if (allCustomers.some(function (c) { return c.phone === want.c; }) && typeof window.openDp === 'function') { try { window.openDp(want.c); } catch (e) { console.warn('khôi phục hồ sơ lỗi', e); } }
        }
      }
    }
    var restoreDone = doneV && doneC && (shown || !(want.v || want.c));
    if (restoreDone && restoring) {
      restoring = false;
      st.v = activeBarId() || st.v;
      var ov2 = document.getElementById('dp-overlay');
      st.c = (ov2 && ov2.classList.contains('open')) ? (want.c || st.c) : '';
      if (shown) save();
    }
    var splashGone = !document.getElementById('boot-splash');
    if ((restoreDone && splashGone) || tries > 240) {   // 240 × 250ms = 60s thì thôi
      clearInterval(timer); restoring = false; dropSplash();
    }
  }
  var timer = setInterval(step, 250);
})();

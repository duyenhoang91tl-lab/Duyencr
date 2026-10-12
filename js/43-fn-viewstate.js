// ═══════════════════════════════════════════════════════
//  F5 GIỮ NGUYÊN BỘ LỌC + VỊ TRÍ CUỘN + TAB HỒ SƠ KHÁCH (yêu cầu Duyên 2026-10-11) — bổ sung cho js/40-main-restorenav.js
//  js/40 đã nhớ MỤC MENU + KHÁCH ĐANG MỞ; module này nhớ phần còn lại để F5 không về "từ đầu":
//    • ô tìm kiếm, sắp xếp, nguồn dữ liệu, năm/tháng/giờ/ngày, chiến dịch, "chưa tác động", lọc CS (chọn nhiều)
//    • chip Hạng / Tình trạng CS / Zalo ở thanh bên (bấm lại đúng chip nên các nút sáng đúng)
//    • vị trí cuộn của danh sách khách (bảng ảo: đặt scrollTop SAU khi lọc xong) và tab đang xem trong hồ sơ khách (chăm sóc/lịch sử/lịch hẹn…)
//  Lưu ở sessionStorage 'ome_view_v1' (riêng từng tab trình duyệt, hết khi đóng tab). Đang khôi phục thì KHÔNG ghi đè trạng thái đã lưu.
//  Nếu người dùng đã tự đổi bộ lọc trước khi kịp khôi phục thì bỏ qua (không giành quyền với người dùng).
// ═══════════════════════════════════════════════════════
(function () {
  var KEY = 'ome_view_v1';
  var IDS = ['search-input', 'datasrc-filter', 'ymf-year', 'ymf-month', 'ymf-hour-from', 'ymf-hour-to', 'ymf-date-from', 'ymf-date-to', 'campaign-filter'];
  function ssGet() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function ssSet(o) { try { sessionStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  var want = ssGet(), restoring = true, touched = false, last = want || { f: {}, t: 'all', c: 'all', z: 'all', cs: [], sc: 0, dp: '' };
  function wrap() { try { return (typeof _vtWrap === 'function') ? _vtWrap() : document.querySelector('.table-wrap'); } catch (e) { return null; } }
  function listVisible() { var l = document.getElementById('tab-list'); return !!l && getComputedStyle(l).display !== 'none' && l.getClientRects().length > 0; }
  function dpOpen() { var o = document.getElementById('dp-overlay'); return !!(o && o.classList.contains('open')); }

  function snapshot() {
    var o = { ts: Date.now(), f: {}, t: (typeof currentTier !== 'undefined' ? currentTier : 'all'), c: (typeof currentCare !== 'undefined' ? currentCare : 'all'), z: (typeof currentZalo !== 'undefined' ? currentZalo : 'all') };
    IDS.forEach(function (id) { var e = document.getElementById(id); if (e) o.f[id] = e.value; });
    var s = document.querySelector('.srt'); if (s) o.sort = s.value;
    var na = document.getElementById('no-action-filter'); if (na) o.na = !!na.checked;
    try { o.cs = (typeof _csFilterList === 'function') ? _csFilterList() : []; } catch (e) { o.cs = []; }
    var w = wrap(); o.sc = (w && listVisible()) ? Math.round(w.scrollTop) : (last.sc || 0);   // danh sách đang ẩn → scrollTop báo 0, giữ giá trị cũ
    o.dp = dpOpen() && typeof currentDpTab !== 'undefined' ? currentDpTab : '';
    return o;
  }
  var deb = null;
  function save(now) {
    if (restoring) return;
    if (deb) { clearTimeout(deb); deb = null; }
    var run = function () { last = snapshot(); ssSet(last); };
    if (now) run(); else deb = setTimeout(run, 350);
  }
  function mine(t) { return !!t && (IDS.indexOf(t.id) !== -1 || (t.classList && t.classList.contains('srt')) || t.id === 'no-action-filter' || t.id === 'cs-staff-filter'); }
  ['input', 'change'].forEach(function (ev) { document.addEventListener(ev, function (e) { if (restoring && e.isTrusted && mine(e.target)) touched = true; save(); }, true); });
  document.addEventListener('click', function (e) {
    var t = e.target; if (restoring && e.isTrusted && t && t.closest && t.closest('.fi,#care-filters,#zalo-filters')) touched = true;
    save();
  }, true);
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(true); });
  window.addEventListener('pagehide', function () { save(true); });
  var scrollBound = false;
  function bindScroll() { var w = wrap(); if (!w || scrollBound) return; scrollBound = true; w.addEventListener('scroll', function () { save(); }, { passive: true }); }

  // ── khôi phục ──
  function chipArg(btn, fn) { var m = (btn.getAttribute('onclick') || '').match(new RegExp(fn + "\\('((?:[^'\\\\]|\\\\.)*)'")); return m ? m[1].replace(/\\'/g, "'") : null; }
  function clickChip(sel, fn, val) {
    if (!val || val === 'all') return;
    var btns = document.querySelectorAll(sel);
    for (var i = 0; i < btns.length; i++) if (chipArg(btns[i], fn) === val) { btns[i].click(); return; }
  }
  function applyWanted() {
    var w = want;
    if (typeof setTier === 'function' || document.querySelector('.fi')) clickChip('.fi', 'setTier', w.t);   // bấm hạng TRƯỚC (nó đặt lại care/zalo)
    clickChip('#care-filters .section-btn', 'setCareFilter', w.c);
    clickChip('#zalo-filters .section-btn', 'setZaloFilter', w.z);
    IDS.forEach(function (id) { var e = document.getElementById(id); if (e && w.f && w.f[id] !== undefined) e.value = w.f[id]; });
    var s = document.querySelector('.srt'); if (s && w.sort !== undefined) s.value = w.sort;
    var na = document.getElementById('no-action-filter'); if (na && w.na !== undefined) na.checked = !!w.na;
    if (w.cs && w.cs.length && typeof _csSetFilterSelection === 'function') { try { _csSetFilterSelection(w.cs); } catch (e) {} }
    if (typeof applyFilters === 'function') applyFilters();
  }
  function restoreScroll(tries) {
    var w = wrap(); if (!w) return;
    w.scrollTop = want.sc || 0;
    try { if (typeof _renderVirtualWindow === 'function') _renderVirtualWindow(true); } catch (e) {}
    if (tries > 0 && Math.abs(w.scrollTop - (want.sc || 0)) > 3) setTimeout(function () { restoreScroll(tries - 1); }, 150);   // bảng ảo có thể chưa đủ chiều cao ngay
  }
  function restoreDpTab(tries) {
    if (!want.dp) return;
    if (dpOpen()) {
      if (typeof currentDpTab !== 'undefined' && currentDpTab !== want.dp) {
        var b = document.querySelector('[onclick*="switchDpTab(\'' + want.dp + '\'"]');
        if (b) { try { b.click(); } catch (e) {} }
      }
      return;
    }
    if (tries > 0) setTimeout(function () { restoreDpTab(tries - 1); }, 500);   // chờ js/40 mở lại hồ sơ khách (tối đa ~10 giây)
  }
  function finish() { restoring = false; last = snapshot(); if (want) ssSet(last); }

  var seenAt = 0, tries = 0;
  var timer = setInterval(function () {
    tries++;
    bindScroll();
    var dv = document.getElementById('data-view');
    var ready = dv && dv.style.display !== 'none' && typeof allCustomers !== 'undefined' && allCustomers.length > 0 && wrap();
    if (!want) { if (ready) { clearInterval(timer); finish(); } else if (tries > 240) { clearInterval(timer); restoring = false; } return; }
    if (!ready) { if (tries > 240) { clearInterval(timer); restoring = false; } return; }   // 240 × 250ms = 60 giây thì thôi
    if (!seenAt) seenAt = Date.now();
    if (Date.now() - seenAt < 1500) return;   // để js/40 + phân quyền/tab xong trước
    clearInterval(timer);
    try {
      if (!touched) { applyWanted(); restoreScroll(6); }
      restoreDpTab(20);
    } catch (e) { console.warn('khôi phục bộ lọc lỗi', e); }
    setTimeout(finish, 1200);
  }, 250);
})();

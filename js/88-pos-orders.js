// js/88-pos-orders.js — DANH SACH KH KHOP DON POS, BUOC 2/7 (HANDOFF 2026-11-16/17): client TAI + GIU don POS THEO TUNG DON (action GAS donDaily, buoc 1).
// NGUYEN NHAN GOC can file nay: donPhones chi cho client tap SDT + sale "tung co" + 1 ngay moi nhat/SDT + doanh thu CA DOI nen client khong co ngay/sale/doanh thu
// cua TUNG don POS -> khong loc Danh sach KH theo ngay/CS cua don POS duoc. File nay chi NAP + GIU du lieu (khong doi hanh vi nao); buoc 3 (js/89) them khach chi co o POS,
// buoc 4+ loc/doanh thu dung posOrdersByPhone.
// - window.posOrders = { byPhone, days, from, to, n, skipped, loadedAt, err }; window.posOrdersByPhone = posOrders.byPhone
//   byPhone[phone] = [ { ds:'YYYY-MM-DD', name, sales:[ten sale], rev:doanhThuCaDon, shares:[[sale, phanChia]] } ... ]  (moi nhat truoc).
//   sales/shares/rev DUNG theo quy tac Bao cao B (tach the, loai Huy/Hoan, chia doanh thu — xem GAS buildDonDaily_). skipped = don B co nhung khong gan duoc khach (khong SDT).
// - CHI RAM (khong localStorage: ~vai nghin don x 90 ngay, nap lai moi lan dong bo nang). Chi xu ly khi noi dung doi (giong _lastDonText).
// - Nap cung nhip donPhones: boc syncFromGS (kieu js/06, js/16) — bat dau tai SONG SONG voi dong bo nang, bao listener SAU KHI dong bo xong (khong chen giua luc dang build).
// - posOrdersEnsureDays_(days): khi nguoi dung loc ngay xa hon cua so dang tai (mac dinh 90) -> tai them (toi da 400) — Duyen chot 17/11: "tu chon khoang ngay rong hon".
// - posOrdersOnChange_(fn): dang ky ham goi khi du lieu POS doi (buoc 3 dung de them khach).
(function () {
  var G = (typeof window !== 'undefined') ? window : globalThis;
  var DEFAULT_DAYS = 90, MAX_DAYS = 400, RETRY_MS = 60000;
  var st = G.posOrders = { byPhone: {}, days: 0, from: '', to: '', n: 0, skipped: null, loadedAt: 0, err: '' };
  G.posOrdersByPhone = st.byPhone;
  var _lastText = '', _lastTextDays = 0, _lastTry = 0, _inflight = {}, _listeners = [];

  function clampDays_(d) { d = Math.floor(Number(d)); if (!(d >= 1)) d = DEFAULT_DAYS; return d > MAX_DAYS ? MAX_DAYS : d; }

  // HAM THUAN: JSON cua donDaily -> { byPhone, n, days, from, to, skipped } (null neu khong phai ket qua hop le)
  function posOrdersParse_(j) {
    if (!j || !Array.isArray(j.rows)) return null;
    var by = {}, n = 0;
    for (var i = 0; i < j.rows.length; i++) {
      var r = j.rows[i];
      if (!r || r.length < 5 || !r[0] || !r[1]) continue;
      var rs = Array.isArray(r[5]) ? r[5] : [], sh = [];
      for (var k = 0; k < rs.length; k++) if (rs[k] && rs[k][0]) sh.push([String(rs[k][0]), Number(rs[k][1]) || 0]);
      (by[r[0]] || (by[r[0]] = [])).push({ ds: String(r[1]), name: String(r[2] || ''), sales: Array.isArray(r[3]) ? r[3].slice() : [], rev: Number(r[4]) || 0, shares: sh });
      n++;
    }
    Object.keys(by).forEach(function (ph) { by[ph].sort(function (a, b) { return a.ds < b.ds ? 1 : a.ds > b.ds ? -1 : 0; }); });
    return { byPhone: by, n: n, days: Number(j.days) || 0, from: j.from || '', to: j.to || '', skipped: j.skipped || null };
  }

  // Tai donDaily (days) -> Promise<boolean doi>. Khong nem loi (loi ghi vao posOrders.err, giu du lieu cu).
  function posOrdersFetch_(days) {
    days = clampDays_(days);
    if (_inflight[days]) return _inflight[days];
    if (typeof gsUrl === 'undefined' || !gsUrl) return Promise.resolve(false);
    _lastTry = Date.now();
    var url = gsUrl + (gsUrl.indexOf('?') > -1 ? '&' : '?') + 'action=donDaily&days=' + days;
    var get = (typeof _gsFetchTO_ === 'function') ? function (u) { return _gsFetchTO_(u, 60000); } : function (u) { return fetch(u, { redirect: 'follow' }); };
    var p = Promise.resolve().then(function () { return get(url); }).then(function (r) { return r.text(); }).then(function (text) {
      if (text === _lastText && days === _lastTextDays) { st.err = ''; return false; }   // y het lan truoc: khong parse lai
      var j; try { j = JSON.parse(text); } catch (e) { st.err = 'GAS trả không phải JSON'; return false; }
      var parsed = posOrdersParse_(j);
      if (!parsed) { st.err = (j && j.error) ? String(j.error) : 'GAS chưa có action donDaily — deploy lại bản GAS mới nhất.'; return false; }
      if (st.loadedAt && parsed.days < st.days) return false;   // da tai cua so rong hon (nguoi dung chon xem xa) — khong thu hep lai
      st.byPhone = parsed.byPhone; G.posOrdersByPhone = st.byPhone;
      st.days = parsed.days; st.from = parsed.from; st.to = parsed.to; st.n = parsed.n; st.skipped = parsed.skipped; st.loadedAt = Date.now(); st.err = '';
      _lastText = text; _lastTextDays = days;
      return true;
    }).catch(function (e) { st.err = String((e && e.message) || e); return false; }).then(function (ch) { delete _inflight[days]; return ch; });
    _inflight[days] = p;
    return p;
  }

  function notify_() { _listeners.slice().forEach(function (fn) { try { fn(st); } catch (e) { try { console.warn('posOrders listener:', e); } catch (e2) {} } }); }

  G.posOrdersParse_ = posOrdersParse_;
  G.posOrdersFetch_ = posOrdersFetch_;
  G.posOrdersOnChange_ = function (fn) { if (typeof fn === 'function') _listeners.push(fn); };
  G.posOrdersEnsureDays_ = function (days) {
    days = clampDays_(days);
    if (st.loadedAt && st.days >= days) return Promise.resolve(false);
    return posOrdersFetch_(days).then(function (ch) { if (ch) notify_(); return ch; });
  };

  // Boc syncFromGS: dong bo NANG (manual/pullOrders) -> tai donDaily SONG SONG, bao listener sau khi dong bo xong. Nhip nhe 3s: chi thu lai (>=60s) neu chua tai duoc lan nao.
  if (typeof syncFromGS === 'function') {
    var _prev = syncFromGS;
    syncFromGS = async function (opts) {
      var o = opts || {}, heavy = !!(o.manual || o.pullOrders);
      var due = heavy || (!st.loadedAt && Date.now() - _lastTry > RETRY_MS);
      var p = due ? posOrdersFetch_(Math.max(DEFAULT_DAYS, st.days)) : null, changed = false;
      try { return await _prev.apply(this, arguments); }
      finally { if (p) { try { changed = await p; } catch (e) {} if (changed) notify_(); } }
    };
  }
})();

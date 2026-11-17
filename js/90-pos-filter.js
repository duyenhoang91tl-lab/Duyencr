// js/90-pos-filter.js — DANH SACH KH KHOP DON POS, BUOC 4/7 (HANDOFF 2026-11-16/17): LOC NGAY + LOC CS THEO DON POS CUNG LUC.
// NGUYEN NHAN GOC: bo loc "Tu ngay-Den ngay" (js/02 applyFilters) chi doc c.ymList = ngay don Base (DT tong), con loc CS doc c.csSet = MOI sale tung co o POS (khong gan voi ngay).
// Hai nguon lech nhau nen "CS + ngay" ra giao cua 2 nguon -> khach POS cua sale trong ngay do bi mat (Duyen 16/11: POS >= 9 khach, CRM chi 3).
// Cach lam (KHONG sua js/02): boc applyFilters. Khi co khoang ngay, voi MOI khach co don POS (js/88 posOrdersByPhone) TAM THOI:
//   (1) c.ymList = ymList goc + ngay cac don POS (loc ngay thay ca don POS);
//   (2) c.csSet  = chi cac CS cua don CO TRONG KHOANG NGAY (don Base trong khoang + don POS trong khoang, ke ca the chung nhieu sale) + CS tu them so moi (careLeads)
//       -> khach khop khi CO IT NHAT 1 don trong khoang ma the chua CS dang loc.
//   Chay applyFilters goc, roi TRA NGUYEN ymList/csSet trong finally (khong de lai trang thai sua).
// Khong co khoang ngay / chua tai don POS -> goi applyFilters goc y nguyen. Khach chi co o POS (khong co trong allCustomers) se do buoc 3 (js/89) them — buoc nay khong tao khach.
// Loc ngay xa hon cua so POS dang giu (mac dinh 90 ngay) -> tu goi posOrdersEnsureDays_ (js/88) roi loc lai (Duyen chot 17/11: "tu chon khoang ngay rong hon").
(function () {
  var G = (typeof window !== 'undefined') ? window : globalThis;

  function inRange_(ds, from, to) { return !!ds && !(from && ds < from) && !(to && ds > to); }
  function splitCs_(s) { var out = []; String(s || '').split(',').forEach(function (n) { n = n.trim(); if (n) out.push(n); }); return out; }

  // HAM THUAN. c: khach (orders, ymList, csSet); rows: don POS cua SDT (js/88); extraCs: CS tu them so moi (careLeads).
  // Tra null neu khong can doi (khach khong co don POS); nguoc lai { ymList, csSet }.
  function posFilterView_(c, rows, from, to, extraCs) {
    if (!c || !rows || !rows.length) return null;
    var base = c.ymList || [], seen = {}, i;
    base.forEach(function (o) { if (o && o.ds) seen[o.ds] = 1; });
    var yl = base.slice();
    rows.forEach(function (r) {
      if (!r || !r.ds || seen[r.ds]) return;
      seen[r.ds] = 1;
      var p = r.ds.split('-');
      yl.push({ ds: r.ds, yr: parseInt(p[0], 10) || null, mo: parseInt(p[1], 10) || null, hr: null, pos: 1 });
    });
    if (!from && !to) return { ymList: yl, csSet: null };   // khong loc ngay: giu nguyen csSet, chi bo sung ngay POS
    var cs = new Set();
    var orders = c.orders || [];
    for (i = 0; i < orders.length; i++) {
      var y = base[i];
      if (y && inRange_(y.ds, from, to)) splitCs_(orders[i] && orders[i].cs).forEach(function (n) { cs.add(n); });
    }
    rows.forEach(function (r) { if (r && inRange_(r.ds, from, to)) (r.sales || []).forEach(function (n) { if (n) cs.add(n); }); });
    (extraCs || []).forEach(function (n) { if (n) cs.add(n); });
    if (typeof G._csCanonSet_ === 'function') G._csCanonSet_(cs);
    return { ymList: yl, csSet: cs };
  }
  G.posFilterView_ = posFilterView_;

  var _ensuring = {};
  function daysNeeded_(from) {   // so ngay tu `from` toi hom nay (+1 cho an toan)
    var t = new Date(from + 'T00:00:00').getTime();
    if (!isFinite(t)) return 0;
    return Math.ceil((Date.now() - t) / 86400000) + 1;
  }

  function dom_(id) { try { var e = document.getElementById(id); return (e && e.value) || ''; } catch (e) { return ''; } }

  if (typeof applyFilters === 'function') {
    var _prev = applyFilters;
    applyFilters = function () {
      var P = G.posOrders, by = G.posOrdersByPhone, list = (typeof allCustomers !== 'undefined') ? allCustomers : null;
      if (!P || !P.loadedAt || !by || !list) return _prev.apply(this, arguments);
      var from = dom_('ymf-date-from'), to = dom_('ymf-date-to');
      // Khoang ngay xa hon cua so dang giu -> tai them roi loc lai 1 lan (moi so ngay chi thu 1 lan/lan nap trang)
      if (from && P.from && from < P.from && typeof G.posOrdersEnsureDays_ === 'function') {
        var need = daysNeeded_(from);
        if (need > P.days && !_ensuring[need]) {
          _ensuring[need] = 1;
          G.posOrdersEnsureDays_(need).then(function (ch) { if (ch) { try { applyFilters(); } catch (e) {} } }, function () {});
        }
      }
      var saved = [], i, c, v, rows;
      try {
        for (i = 0; i < list.length; i++) {
          c = list[i]; rows = c && by[c.phone];
          if (!rows) continue;
          var extra = (typeof careLeads !== 'undefined' && careLeads && careLeads[c.phone]) ? splitCs_(careLeads[c.phone].cs) : [];
          v = posFilterView_(c, rows, from, to, extra);
          if (!v) continue;
          saved.push([c, c.ymList, c.csSet]);
          c.ymList = v.ymList;
          if (v.csSet) c.csSet = v.csSet;
        }
        return _prev.apply(this, arguments);
      } finally {
        for (i = 0; i < saved.length; i++) { saved[i][0].ymList = saved[i][1]; saved[i][0].csSet = saved[i][2]; }
      }
    };
    // Don POS moi tai xong (dong bo / tai them) -> loc lai neu dang loc theo ngay
    if (typeof G.posOrdersOnChange_ === 'function') {
      G.posOrdersOnChange_(function () { if (dom_('ymf-date-from') || dom_('ymf-date-to')) { try { applyFilters(); } catch (e) {} } });
    }
  }
})();

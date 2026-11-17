// js/91-pos-revenue.js — DANH SACH KH KHOP DON POS, BUOC 5/7 (HANDOFF 2026-11-17): DOANH THU + SO DON THEO DON POS DANG LOC.
// NGUYEN NHAN GOC: cot "Don / DT" (js/02) = _custRev_/_custOrderCount_ (js/05) = POS CA DOI cua SDT (donStatsByPhone), khong theo ngay va khong theo phan chia cua CS dang loc
// -> khong khop tong POS cua ngay/sale (Duyen 16/11). Duyen chot 17/11: hien 2 MUC: (1) tong khach da mua (ca doi, POS) ; (2) phan cua SALE DANG LOC (phan chia the chung, quy tac Bao cao B).
// Cach lam (KHONG viet lai logic loc): boc applyFilters (ngoai js/90). TRUOC khi chay ham goc, voi moi khach co du lieu POS:
//   - dang loc ngay va/hoac CS: c.posLife = {n,rev} (ca doi), c.posView = {n,rev,cs:[...],from,to}; c.totalOrders/c.totalRevenue = so cua (2) -> sap xep "Doanh thu cao" + KPI dau trang
//     cong dung so dang loc (khop thanh doi soat buoc 6). (2) = cac don POS trong khoang ngay; co loc CS thi chi phan chia cua CS do (the chung chia theo shares, khong co shares chia deu).
//   - khong loc: tra c.totalOrders/c.totalRevenue ve ca doi (_custRev_) va xoa posLife/posView.
// js/02 chi doi 1 dong o cot "Don / DT": goi posRevCellHtml_(c) (guard typeof; khong co js/91 thi in nhu cu).
// Chua tai don POS (posOrders.loadedAt=0) -> khong dong gi. Loc ngay xa hon cua so POS dang giu: phan (2) chi gom don da tai (js/90 se tu tai them roi loc lai).
(function () {
  var G = (typeof window !== 'undefined') ? window : globalThis;
  function inRange_(ds, from, to) { return !!ds && !(from && ds < from) && !(to && ds > to); }
  function dom_(id) { try { var e = document.getElementById(id); return (e && e.value) || ''; } catch (e) { return ''; } }
  function fold_(s) { return String(s || '').trim().toLowerCase(); }

  // HAM THUAN. rows: don POS cua 1 SDT (js/88); csList: ten CS dang loc (da gom ten khac cung nguoi) hoac []. Tra { n, rev }.
  function posRevView_(rows, from, to, csList) {
    var want = {}, hasCs = !!(csList && csList.length), n = 0, rev = 0;
    (csList || []).forEach(function (x) { want[fold_(x)] = 1; });
    (rows || []).forEach(function (r) {
      if (!r || !inRange_(r.ds, from, to)) return;
      var amt = Number(r.rev) || 0;
      if (!hasCs) { n++; rev += amt; return; }
      var part = 0, hit = false, sh = r.shares || [];
      if (sh.length) {
        sh.forEach(function (p) { if (want[fold_(p[0])]) { hit = true; part += Number(p[1]) || 0; } });   // shares = [sale, TIEN cua sale] (GAS _donDailyRows_ lay tu bsx cua Bao cao B)
      } else {
        var ss = r.sales || [], k = ss.filter(function (x) { return want[fold_(x)]; }).length;
        if (k) { hit = true; part = amt * k / ss.length; }
      }
      if (hit) { n++; rev += part; }
    });
    return { n: n, rev: Math.round(rev) };
  }
  G.posRevView_ = posRevView_;

  function life_(c) { return { n: (typeof _custOrderCount_ === 'function') ? _custOrderCount_(c) : (c.totalOrders || 0), rev: (typeof _custRev_ === 'function') ? _custRev_(c) : (c.totalRevenue || 0) }; }

  // Ap so lieu cho tung khach truoc khi loc/sap xep/ve bang.
  function posRevApply_(list, by, from, to, csList) {
    var active = !!(from || to || (csList && csList.length)), i, c, v, l;
    for (i = 0; i < list.length; i++) {
      c = list[i]; if (!c) continue;
      if (!active) {
        if (c.posView) { l = life_(c); c.totalOrders = l.n; c.totalRevenue = l.rev; delete c.posView; delete c.posLife; }
        continue;
      }
      v = posRevView_(by[c.phone] || [], from, to, csList);
      if (!c.posLife) c.posLife = life_(c);
      else c.posLife = life_(c);
      c.posView = { n: v.n, rev: v.rev, cs: (csList || []).slice(0, 3), from: from, to: to };
      c.totalOrders = v.n; c.totalRevenue = v.rev;
    }
  }
  G.posRevApply_ = posRevApply_;

  function money_(v) { return (typeof fmtVND === 'function') ? fmtVND(v) : String(v); }
  // Noi dung cot "Don / DT": dong 1 = ca doi (muc 1); dong 2 (khi dang loc) = muc 2.
  G.posRevCellHtml_ = function (c) {
    if (!c || !c.posView || !c.posLife) return '';
    var L = c.posLife, V = c.posView;
    var lab = V.cs.length ? ('của ' + V.cs.join(', ') + (V.from || V.to ? ' trong kỳ' : '')) : 'trong kỳ';
    var tip = 'Dòng 1: tổng khách đã mua (cả đời, theo POS). Dòng 2: ' + lab + ' (theo POS, đã chia thẻ chung).';
    return '<span style="font-weight:600">' + L.n + '</span><span style="color:var(--muted);font-size:11px"> / ' + money_(L.rev) + '</span>' +
      '<br><span title="' + String(tip).replace(/"/g, '&quot;') + '" style="color:var(--accent,#0a7);font-size:11px;font-weight:600">' + V.n + ' đơn / ' + money_(V.rev) + '</span>';
  };

  if (typeof applyFilters === 'function') {
    var _prev = applyFilters;
    applyFilters = function () {
      var P = G.posOrders, by = G.posOrdersByPhone, list = (typeof allCustomers !== 'undefined') ? allCustomers : null;
      if (P && P.loadedAt && by && list) {
        try {
          var csl = (typeof _csFilterListMatch === 'function') ? _csFilterListMatch() : [];
          posRevApply_(list, by, dom_('ymf-date-from'), dom_('ymf-date-to'), csl || []);
        } catch (e) { try { console.warn('posRevApply_', e); } catch (e2) {} }
      }
      return _prev.apply(this, arguments);
    };
    if (typeof G.posOrdersOnChange_ === 'function') {
      G.posOrdersOnChange_(function () { try { applyFilters(); } catch (e) {} });
    }
  }
})();

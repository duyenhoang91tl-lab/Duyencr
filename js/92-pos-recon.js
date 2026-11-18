// js/92-pos-recon.js — DANH SACH KH KHOP DON POS, BUOC 6/7 (HANDOFF 2026-11-17): THANH DOI SOAT "Khop POS".
// NGUYEN NHAN GOC can file nay: truoc day khong co cach nao thay danh sach co du khach POS cua sale/ngay do hay khong (Duyen 16/11: POS >= 9 khach, CRM chi 3) — phai tu mo Bao cao B so tay.
// Khi dang loc ngay va/hoac CS (va da tai don POS), duoi thanh cong cu hien 1 dong:
//   ✓ "Khop POS: N khach / X d" khi MOI khach co don POS khop bo loc (theo dung quy tac js/91: ngay + phan chia cua CS) deu co trong danh sach;
//   ⚠ "Lech POS: thieu K khach / Y d" + nut Xem (liet ke SDT, ten, so don, tien, ly do: chua co khach / bi bo loc khac).
// + ghi chu so don POS khong gan duoc khach (khong SDT / khong ngay — `posOrders.skipped`, tinh ca cua so tai).
// Chi DOC, khong sua danh sach/loc. Boc applyFilters NGOAI CUNG (sau js/91) — chay sau khi danh sach da ve. Khong loc ngay/CS hoac chua tai POS -> an dong nay.
(function () {
  var G = (typeof window !== 'undefined') ? window : globalThis;
  function dom_(id) { try { var e = document.getElementById(id); return (e && e.value) || ''; } catch (e) { return ''; } }
  function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  function money_(v) { return (typeof fmtVND === 'function') ? fmtVND(v) : String(v); }

  // HAM THUAN. by: posOrdersByPhone; shown: mang khach dang hien (co .phone); allPhones: tap SDT co trong allCustomers (de phan biet ly do thieu).
  // Tra { cust, rev, inCust, inRev, missing:[{phone,name,n,rev,why}], missRev }.
  function posReconCompute_(by, shown, allPhones, from, to, csList, viewFn) {
    var inList = {}, r = { cust: 0, rev: 0, inCust: 0, inRev: 0, missing: [], missRev: 0 };
    (shown || []).forEach(function (c) { if (c && c.phone) inList[c.phone] = 1; });
    Object.keys(by || {}).forEach(function (ph) {
      var rows = by[ph], v = viewFn(rows, from, to, csList || []);
      if (!v || !v.n) return;
      r.cust++; r.rev += v.rev;
      if (inList[ph]) { r.inCust++; r.inRev += v.rev; return; }
      var nm = ''; for (var i = 0; i < rows.length && !nm; i++) if (rows[i] && rows[i].name) nm = rows[i].name;
      r.missing.push({ phone: ph, name: nm, n: v.n, rev: v.rev, why: (allPhones && allPhones[ph]) ? 'bị bộ lọc khác' : 'chưa có khách' });
      r.missRev += v.rev;
    });
    r.missing.sort(function (a, b) { return b.rev - a.rev; });
    return r;
  }
  G.posReconCompute_ = posReconCompute_;

  function barHtml_(r, skipped, open) {
    var ok = !r.missing.length;
    var h = ok
      ? '<span style="color:#16a34a;font-weight:700">✓ Khớp POS:</span> ' + r.inCust + ' khách / ' + money_(r.inRev)
      : '<span style="color:#d97706;font-weight:700">⚠ Lệch POS:</span> thiếu ' + r.missing.length + ' / ' + r.cust + ' khách POS (' + money_(r.missRev) + ') <a href="#" id="pos-recon-toggle" style="margin-left:6px">' + (open ? 'Ẩn' : 'Xem') + '</a>';
    if (skipped && (skipped.noPhone || skipped.noDate)) {
      h += ' <span style="color:var(--muted)" title="Đơn có ở Báo cáo B nhưng không gắn được vào khách nào (cả cửa sổ POS đang tải, không theo bộ lọc)">· ngoài danh sách: ' +
        ((skipped.noPhone || 0) + (skipped.noDate || 0)) + ' đơn không có SĐT/ngày (' + money_((skipped.noPhoneRev || 0) + (skipped.noDateRev || 0)) + ')</span>';
    }
    if (!ok && open) {
      h += '<div style="margin-top:4px;max-height:160px;overflow:auto;border:1px solid var(--border,#ddd);border-radius:6px;padding:4px 8px;background:var(--card,#fff)">' +
        r.missing.slice(0, 200).map(function (m) {
          return '<div>' + esc_(m.phone) + ' · ' + esc_(m.name || '—') + ' · ' + m.n + ' đơn / ' + money_(m.rev) + ' · <i>' + esc_(m.why) + '</i></div>';
        }).join('') + '</div>';
    }
    return h;
  }

  var _open = false, _last = null;
  function render_() {
    var bar = null;
    try { bar = document.getElementById('pos-recon-bar'); } catch (e) { return; }
    var P = G.posOrders, by = G.posOrdersByPhone, from = dom_('ymf-date-from'), to = dom_('ymf-date-to');
    var csl = (typeof _csFilterListMatch === 'function') ? (_csFilterListMatch() || []) : [];
    var active = !!(P && P.loadedAt && by && typeof G.posRevView_ === 'function' && (from || to || csl.length));
    if (!bar) {
      if (!active) return;
      var tb = document.querySelector('#tab-list .toolbar');
      if (!tb || !tb.parentNode) return;
      bar = document.createElement('div'); bar.id = 'pos-recon-bar';
      bar.style.cssText = 'font-size:12px;padding:4px 12px';
      tb.parentNode.insertBefore(bar, tb.nextSibling);
      bar.addEventListener('click', function (ev) { var t = ev.target; if (t && t.id === 'pos-recon-toggle') { ev.preventDefault(); _open = !_open; if (_last) bar.innerHTML = barHtml_(_last.r, _last.sk, _open); } });
    }
    if (!active) { bar.style.display = 'none'; return; }
    var all = {}; (typeof allCustomers !== 'undefined' ? allCustomers : []).forEach(function (c) { if (c && c.phone) all[c.phone] = 1; });
    var shown = (typeof window !== 'undefined' && Array.isArray(G.__omeFiltered)) ? G.__omeFiltered : ((typeof _lastFilteredObjs !== 'undefined' && _lastFilteredObjs) || []);
    var r = posReconCompute_(by, shown, all, from, to, csl, G.posRevView_);
    _last = { r: r, sk: P.skipped };
    bar.style.display = '';
    bar.innerHTML = barHtml_(r, P.skipped, _open);
  }
  G.posReconRender_ = render_;

  if (typeof applyFilters === 'function') {
    var _prev = applyFilters;
    applyFilters = function () {
      var out = _prev.apply(this, arguments);
      try { render_(); } catch (e) { try { console.warn('posRecon', e); } catch (e2) {} }
      return out;
    };
    if (typeof G.posOrdersOnChange_ === 'function') G.posOrdersOnChange_(function () { try { applyFilters(); } catch (e) {} });
  }
})();

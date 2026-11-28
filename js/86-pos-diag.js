// js/86-pos-diag.js — DANH SACH KH KHOP DON POS, BUOC 8 (= buoc 0b cu trong ke hoach, Duyen chon lam 17/11): NUT ADMIN "🔍 Doi soat POS".
// NGUYEN NHAN GOC can file nay: thanh doi soat buoc 6 chi bao THIEU khach, con muon biet 1 SDT cu the vi sao khong hien (khong co khach? khong co ngay don? CS khong nam trong csSet? bi bo loc khac?)
// thi phai doc code/DevTools. Nut nay goi GAS donDayDiag (chi doc) cho 1 ngay (+ 1 sale), doi chieu TUNG SDT voi allCustomers/ymList/csSet/danh sach dang loc, ra ket luan + nut Copy de gui lai.
// Chi admin (hoac chua dang nhap) thay nut. Chi doc, khong sua du lieu. khDiagClassify_ la ham thuan (test bang Node).
(function () {
  var G = (typeof window !== 'undefined') ? window : globalThis;
  function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  function fmt_(v) { return (typeof fmtVND === 'function') ? fmtVND(v) : String(v); }
  function lc_(s) { return String(s || '').trim().toLowerCase(); }

  var WHY = { OK: '✓ Có trong danh sách', NO_CUST: 'A — chưa có khách (SĐT không có trong allCustomers)', NO_DAY: 'B — khách không có ngày đơn này ở đơn Base lẫn đơn POS client đang giữ (đơn POS ngoài cửa sổ đã tải? thử chọn khoảng ngày rộng hơn)',
    NO_CS: 'C — CS không nằm trong csSet của khách', HIDDEN: 'D — có khách + CS + ngày (kể cả ngày đơn POS) nhưng KHÔNG hiện: bị BỘ LỌC KHÁC loại, hoặc danh sách chưa làm mới (thử Ctrl+F5)', EXCL: '— đơn bị loại (Hủy/Hoàn), không tính',
    FILTERED: 'E — ĐÚNG THEO BỘ LỌC bạn đang bật (không phải lỗi danh sách): khách bị loại bởi điều kiện ghi trong {…}; tắt/đổi bộ lọc đó sẽ thấy' };

  // HAM THUAN. diag: ket qua donDayDiag; customers: allCustomers; shown: mang khach dang hien; sale: ten CS (co the rong); aliasFn(sale) -> mang ten cung nguoi.
  function khDiagClassify_(diag, customers, shown, sale, aliasFn, probeFn) {
    var by = {}, inList = {}, names = {}, out = [];
    (customers || []).forEach(function (c) { if (c && c.phone) by[c.phone] = c; });
    (shown || []).forEach(function (c) { if (c && c.phone) inList[c.phone] = 1; });
    var want = {}; if (sale) { want[lc_(sale)] = 1; ((aliasFn && aliasFn(sale)) || []).forEach(function (a) { want[lc_(a)] = 1; }); }
    var agg = {};
    ((diag && diag.items) || []).forEach(function (it) {
      var ph = it.phone || ('?' + it.rawPhone);
      var a = agg[ph] || (agg[ph] = { phone: it.phone, rawPhone: it.rawPhone, name: it.name, orders: 0, rev: 0, exclOnly: true });
      a.orders++; if (!it.excluded) { a.rev += Number(it.rev) || 0; a.exclOnly = false; }
    });
    Object.keys(agg).forEach(function (k) {
      var a = agg[k], c = a.phone ? by[a.phone] : null, why;
      if (a.exclOnly) why = 'EXCL';
      else if (!a.phone) why = 'NO_CUST';
      else if (!c) why = 'NO_CUST';
      else if (inList[a.phone]) why = 'OK';
      else {
        // Tinh ngay GIONG bo loc that (js/90): ngay don Base (ymList) HOAC ngay don POS client dang giu (posOrdersByPhone). Neu chi doc ymList (da tra lai nguyen sau khi loc) thi khach co don POS dung ngay van bi bao nham la "khong co ngay".
        var pr = (G.posOrdersByPhone && G.posOrdersByPhone[a.phone]) || [];
        var hasDay = (c.ymList || []).some(function (o) { return o && o.ds === diag.date; }) || pr.some(function (r) { return r && r.ds === diag.date; });
        var csOk = !sale || Array.from(c.csSet || []).some(function (n) { return want[lc_(n)]; });
        why = !csOk ? 'NO_CS' : (!hasDay ? 'NO_DAY' : 'HIDDEN');
        a.posRows = pr.length;
        if (why === 'HIDDEN' && probeFn) {
          try { a.probe = probeFn(c); } catch (e) { a.probe = 'probe lỗi: ' + e.message; }
          // NGUYEN NHAN GOC them (Duyen 18/11: bao cao doi soat ra HIDDEN=68/76 SDT du "bo loc dang bat" chi co taiKhoan=admin): probe cu KHONG kiem bo loc CS (cs-staff-filter), khoang ngay, o tim
          // nen khach cua CS KHAC (dung la khong duoc hien khi dang loc 1 CS) bi gan nham "D = co the la loi". Nay probe kiem du cac bo loc do; probe tim ra dieu kien loai -> E (dung theo bo loc), con lai moi la D (nghi loi that).
          if (/^LOẠI BỞI:/.test(a.probe || '')) why = 'FILTERED';
        }
      }
      out.push({ phone: a.phone || a.rawPhone, name: a.name, orders: a.orders, rev: a.rev, why: why, text: WHY[why], posRows: a.posRows || 0, probe: a.probe || '' });
    });
    var sum = {}; out.forEach(function (o) { sum[o.why] = (sum[o.why] || 0) + 1; });
    out.sort(function (x, y) { return (x.why === 'OK') - (y.why === 'OK') || y.rev - x.rev; });
    return { date: diag && diag.date, sale: sale || '', posOrders: diag && diag.orders, posPhones: diag && diag.phones, posRevenue: diag && diag.revenue, rows: out, summary: sum };
  }
  G.khDiagClassify_ = khDiagClassify_;

  function khDiagText_(r) {
    var L = ['ĐỐI SOÁT POS ' + r.date + (r.sale ? ' · ' + r.sale : ''), 'POS: ' + r.posOrders + ' đơn / ' + r.posPhones + ' SĐT / ' + fmt_(r.posRevenue) + ' (đơn không bị loại)',
      'Kết quả: ' + Object.keys(r.summary).map(function (k) { return k + '=' + r.summary[k]; }).join(', ')];
    r.rows.forEach(function (o) { L.push(o.phone + ' | ' + (o.name || '') + ' | ' + o.orders + ' đơn | ' + fmt_(o.rev) + ' | ' + o.text + (o.why !== 'OK' && o.why !== 'EXCL' && o.why !== 'NO_CUST' ? ' [client giữ ' + (o.posRows || 0) + ' đơn POS của SĐT này]' : '') + (o.probe ? ' {' + o.probe + '}' : '')); });
    if (r.filters) L.splice(3, 0, 'Bộ lọc đang bật: ' + r.filters);
    return L.join('\n');
  }
  G.khDiagText_ = khDiagText_;

  // NGUYEN NHAN GOC them (Duyen 17/11: doi soat 63 OK + 13 nhan D "bi bo loc khac" nhung KHONG biet bo loc nao): moi dong D kem [{dieu kien don gian KHONG dat theo applyFilters (js/02)}]
  // + dong "Bo loc dang bat". Chi doc cac bien toan cuc bo loc (guard typeof), khong goi applyFilters.
  function khDiagFilters_() {
    var f = [];
    try {
      if (typeof currentTier !== 'undefined' && currentTier !== 'all') f.push('tier=' + currentTier);
      if (typeof currentBuy !== 'undefined' && currentBuy !== 'all') f.push('loạiKhách=' + currentBuy);
      if (typeof currentCare !== 'undefined' && currentCare !== 'all') f.push('careStatus=' + currentCare);
      if (typeof currentZalo !== 'undefined' && currentZalo !== 'all') f.push('zalo=' + currentZalo);
      if (typeof currentCF === 'object' && currentCF && Object.keys(currentCF).length) f.push('trườngTựTạo=' + Object.keys(currentCF).length);
      var el = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
      var ds = el('datasrc-filter'); if (ds && ds !== 'all') f.push('nguồnDL=' + ds);
      if (el('campaign-filter')) f.push('chiếnDịch');
      var na = document.getElementById('no-action-filter'); if (na && na.checked) f.push('chưaTácĐộng');
      ['ymf-year', 'ymf-month', 'ymf-hour-from', 'ymf-hour-to'].forEach(function (id) { var v = el(id); if (v !== '' && v != null) f.push(id.replace('ymf-', '') + '=' + v); });
      if (typeof colFilters === 'object' && colFilters) Object.keys(colFilters).forEach(function (k) { var s = colFilters[k]; if (s && s.size > 0) f.push('cột.' + k + '(' + s.size + ')'); });
      if (typeof advFilters === 'object' && advFilters) Object.keys(advFilters).forEach(function (k) { var s = advFilters[k]; if (s && s.size > 0) f.push('nângCao.' + k + '(' + s.size + ')'); });
      if (typeof _lsListFilter !== 'undefined' && _lsListFilter) f.push('mứcNóng=' + _lsListFilter);
      // Bo loc CS (cs-staff-filter) + che do + khoang ngay + o tim: truoc day KHONG liet ke nen "Bo loc dang bat" nhin nhu trong (Duyen 18/11)
      var csRaw = (typeof _csFilterList === 'function') ? _csFilterList() : [];
      if (csRaw.length) f.push('CS=' + csRaw.join('/') + (typeof _csFilterMode !== 'undefined' ? '(' + _csFilterMode + ')' : ''));
      var d1 = el('ymf-date-from'), d2 = el('ymf-date-to'); if (d1 || d2) f.push('ngày=' + (d1 || '…') + '→' + (d2 || '…'));
      var qs = el('search-input'); if (qs) f.push('ôTìm="' + qs + '"');
      if (typeof currentUser !== 'undefined' && currentUser) f.push('tàiKhoản=' + currentUser.role);
    } catch (e) {}
    return f.length ? f.join(', ') : '(không có bộ lọc nào ngoài ngày/CS)';
  }
  function khDiagProbe_(c) {
    var bad = [], at = [];
    try { if (typeof _inUserScope === 'function' && !_inUserScope(c)) bad.push('NGOÀI PHẠM VI TÀI KHOẢN'); } catch (e) {}
    if (typeof currentTier !== 'undefined' && currentTier !== 'all' && c.tier !== currentTier) bad.push('tier');
    try { if (typeof currentBuy !== 'undefined' && currentBuy !== 'all' && (currentBuy === 'bought') !== _isBoughtCustomer(c)) bad.push('loạiKhách'); } catch (e) {}
    if (typeof currentCare !== 'undefined' && currentCare !== 'all' && c.careStatus !== currentCare) bad.push('careStatus');
    if (typeof currentZalo !== 'undefined' && currentZalo !== 'all' && c.zaloStatus !== currentZalo && !(currentZalo === 'block' && ['Chặn', 'Hủy kết bạn'].indexOf(c.zaloStatus) > -1)) bad.push('zalo');
    // CS dang loc: giong applyFilters — csSet (+ CS cua don POS trong khoang ngay) / careCSSet / _assignAllIndex theo che do _csFilterMode
    try {
      var csF = (typeof _csFilterListMatch === 'function') ? _csFilterListMatch() : [];
      if (csF.length && typeof _csModeMatch === 'function') {
        var d1 = (document.getElementById('ymf-date-from') || {}).value || '', d2 = (document.getElementById('ymf-date-to') || {}).value || '';
        var prs = (G.posOrdersByPhone && G.posOrdersByPhone[c.phone]) || [], posCs = {};
        prs.forEach(function (r) { if (r && r.ds && !(d1 && r.ds < d1) && !(d2 && r.ds > d2)) (r.sales || []).forEach(function (n) { if (n) posCs[n] = 1; }); });
        var ah = (typeof _assignAllIndex !== 'undefined' && _assignAllIndex) ? _assignAllIndex[c.phone] : null;
        var hitCs = csF.some(function (n) { return _csModeMatch(!!((c.csSet && c.csSet.has(n)) || posCs[n]), !!(c.careCSSet && c.careCSSet.has(n)), ah ? ah.has(n) : false); });
        if (!hitCs) bad.push('CS đang lọc (' + csF.join('/') + ')');
      }
    } catch (e) {}
    try {   // khoang ngay: ngay don Base HOAC ngay don POS client giu (giong js/90)
      var f1 = (document.getElementById('ymf-date-from') || {}).value || '', f2 = (document.getElementById('ymf-date-to') || {}).value || '';
      if (f1 || f2) {
        var inR = function (ds) { return !!ds && !(f1 && ds < f1) && !(f2 && ds > f2); };
        var pr2 = (G.posOrdersByPhone && G.posOrdersByPhone[c.phone]) || [];
        if (!(c.ymList || []).some(function (o) { return o && inR(o.ds); }) && !pr2.some(function (r) { return r && inR(r.ds); })) bad.push('khoảng ngày');
      }
    } catch (e) {}
    try {   // o tim + nguon du lieu
      var qv = (document.getElementById('search-input') || {}).value || '';
      if (qv && String(qv).trim()) {
        var ql = String(qv).trim().toLowerCase();
        if (!(String(c.nameLower || c.name || '').toLowerCase().indexOf(ql) > -1 || String(c.phone || '').indexOf(ql) > -1)) bad.push('ô tìm');
      }
      var dsf = (document.getElementById('datasrc-filter') || {}).value || 'all', dsrc = c.dataSrc || {};
      if (dsf !== 'all' && ['dt', 'cs', 'don', 'cskh'].indexOf(dsf) > -1 && !dsrc[dsf]) bad.push('nguồnDL=' + dsf);
    } catch (e) {}
    try {
      if (typeof colFilters === 'object' && colFilters) {
        if (colFilters.tier && colFilters.tier.size && !colFilters.tier.has(c.tier)) bad.push('cột.tier');
        if (colFilters.hang && colFilters.hang.size && !colFilters.hang.has(c.hang)) bad.push('cột.hang');
        if (colFilters.care && colFilters.care.size && !colFilters.care.has(c.careStatus || '')) bad.push('cột.care');
        if (colFilters.zalo && colFilters.zalo.size && !colFilters.zalo.has(c.zaloStatus || '')) bad.push('cột.zalo');
        if (colFilters.cs && colFilters.cs.size && !Array.from(colFilters.cs).some(function (n) { return c.csSet && c.csSet.has(n); })) bad.push('cột.cs');
      }
    } catch (e) {}
    var el = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
    try {
      var hf = el('ymf-hour-from'), ht = el('ymf-hour-to');
      if ((hf !== '' || ht !== '') && (c.ymList || []).every(function (o) { return o && o.hr != null && ((hf !== '' && o.hr < +hf) || (ht !== '' && o.hr > +ht)); })) bad.push('giờ');
    } catch (e) {}
    at.push('tier=' + c.tier, 'care=' + (c.careStatus || ''), 'zalo=' + (c.zaloStatus || ''), 'dataSrc=' + Object.keys(c.dataSrc || {}).filter(function (k) { return c.dataSrc[k]; }).join('+'));
    return (bad.length ? 'LOẠI BỞI: ' + bad.join(',') + ' · ' : 'không thấy bộ lọc đơn giản nào loại · ') + at.join(' ');
  }
  G.khDiagProbe_ = khDiagProbe_; G.khDiagFilters_ = khDiagFilters_;

  function khDiagDay_(date, sale) {
    if (typeof gsUrl === 'undefined' || !gsUrl) return Promise.reject(new Error('Chưa có URL GAS'));
    var url = gsUrl + (gsUrl.indexOf('?') > -1 ? '&' : '?') + 'action=donDayDiag&date=' + encodeURIComponent(date) + '&sale=' + encodeURIComponent(sale || '');
    var get = (typeof _gsFetchTO_ === 'function') ? function (u) { return _gsFetchTO_(u, 60000); } : function (u) { return fetch(u, { redirect: 'follow' }); };
    return Promise.resolve().then(function () { return get(url); }).then(function (r) { return r.text(); }).then(function (t) {
      var j; try { j = JSON.parse(t); } catch (e) { throw new Error('GAS trả không phải JSON (chưa deploy action donDayDiag?)'); }
      if (!j || !j.ok) throw new Error((j && j.error) || 'GAS chưa có action donDayDiag — chờ workflow Deploy GAS xanh');
      return khDiagClassify_(j, (typeof allCustomers !== 'undefined' ? allCustomers : []), G.__omeFiltered || (typeof _lastFilteredObjs !== 'undefined' ? _lastFilteredObjs : []), sale,
        (typeof _personAliases === 'function') ? _personAliases : null, khDiagProbe_);
    }).then(function (r) { r.filters = khDiagFilters_(); return r; });
  }
  G.khDiagDay_ = khDiagDay_;

  function isAdmin_() { try { return (typeof currentUser === 'undefined' || !currentUser || currentUser.role === 'admin'); } catch (e) { return false; } }

  function open_() {
    var box = document.getElementById('pos-diag-box');
    if (box) { box.style.display = box.style.display === 'none' ? '' : 'none'; return; }
    box = document.createElement('div'); box.id = 'pos-diag-box';
    box.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9999;width:min(560px,94vw);max-height:calc(var(--vh,1vh)*80);overflow:auto;background:var(--card,#fff);color:var(--text,#111);border:1px solid var(--border,#ccc);border-radius:10px;padding:10px;box-shadow:0 6px 24px rgba(0,0,0,.25);font-size:12px';
    var d0 = (document.getElementById('ymf-date-from') || {}).value || new Date().toISOString().slice(0, 10);
    var cs0 = ''; try { cs0 = (typeof _csFilterList === 'function' && _csFilterList()[0]) || ''; } catch (e) {}
    box.innerHTML = '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b>🔍 Đối soát POS</b><input type="date" id="pd-date" value="' + esc_(d0) + '"><input id="pd-sale" placeholder="CS (trống = mọi sale)" value="' + esc_(cs0) + '" style="min-width:140px">' +
      '<button id="pd-run">Chạy</button><button id="pd-copy">Copy</button><button id="pd-close" style="margin-left:auto">✕</button></div><div id="pd-out" style="margin-top:6px;white-space:pre-wrap"></div>';
    document.body.appendChild(box);
    var out = box.querySelector('#pd-out'), last = null;
    box.querySelector('#pd-close').onclick = function () { box.style.display = 'none'; };
    box.querySelector('#pd-copy').onclick = function () { if (last && navigator.clipboard) navigator.clipboard.writeText(khDiagText_(last)); };
    box.querySelector('#pd-run').onclick = function () {
      out.textContent = 'Đang đối soát…';
      khDiagDay_(box.querySelector('#pd-date').value, box.querySelector('#pd-sale').value.trim()).then(function (r) {
        last = r;
        out.innerHTML = '<div style="color:var(--muted)">Bộ lọc đang bật: ' + esc_(r.filters || '') + '</div><div>POS: <b>' + r.posOrders + '</b> đơn / <b>' + r.posPhones + '</b> SĐT / ' + esc_(fmt_(r.posRevenue)) + ' · ' + Object.keys(r.summary).map(function (k) { return esc_(WHY[k] ? k : k) + ' ' + r.summary[k]; }).join(' · ') + '</div>' +
          r.rows.map(function (o) { return '<div style="padding:2px 0;border-top:1px solid var(--border,#eee)">' + esc_(o.phone) + ' · ' + esc_(o.name || '—') + ' · ' + o.orders + ' đơn / ' + esc_(fmt_(o.rev)) + '<br><i>' + esc_(o.text) + '</i>' + (o.probe ? '<br><small>' + esc_(o.probe) + '</small>' : '') + '</div>'; }).join('');
      }, function (e) { out.textContent = '⚠ ' + ((e && e.message) || e); });
    };
  }
  G.khDiagOpen_ = open_;

  function mount_() {
    try {
      if (!isAdmin_() || document.getElementById('pos-diag-btn')) return;
      var host = document.querySelector('#tab-list .toolbar .tl-l'); if (!host) return;
      var b = document.createElement('button'); b.id = 'pos-diag-btn'; b.type = 'button'; b.textContent = '🔍 Đối soát POS'; b.title = 'Admin: đối chiếu đơn POS 1 ngày/1 sale với Danh sách KH';
      b.style.cssText = 'font-size:12px;margin-left:6px'; b.onclick = open_; host.appendChild(b);
    } catch (e) {}
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount_); else mount_();
    setTimeout(mount_, 1500); setTimeout(mount_, 5000);   // admin nhan dien sau khi dang nhap xong
  }
})();

// js/86-pos-diag.js — DANH SACH KH KHOP DON POS, BUOC 8 (= buoc 0b cu trong ke hoach, Duyen chon lam 17/11): NUT ADMIN "🔍 Doi soat POS".
// NGUYEN NHAN GOC can file nay: thanh doi soat buoc 6 chi bao THIEU khach, con muon biet 1 SDT cu the vi sao khong hien (khong co khach? khong co ngay don? CS khong nam trong csSet? bi bo loc khac?)
// thi phai doc code/DevTools. Nut nay goi GAS donDayDiag (chi doc) cho 1 ngay (+ 1 sale), doi chieu TUNG SDT voi allCustomers/ymList/csSet/danh sach dang loc, ra ket luan + nut Copy de gui lai.
// Chi admin (hoac chua dang nhap) thay nut. Chi doc, khong sua du lieu. khDiagClassify_ la ham thuan (test bang Node).
(function () {
  var G = (typeof window !== 'undefined') ? window : globalThis;
  function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  function fmt_(v) { return (typeof fmtVND === 'function') ? fmtVND(v) : String(v); }
  function lc_(s) { return String(s || '').trim().toLowerCase(); }

  var WHY = { OK: '✓ Có trong danh sách', NO_CUST: 'A — chưa có khách (SĐT không có trong allCustomers)', NO_DAY: 'B — khách không có ngày đơn này trong ymList (lọc ngày gốc bỏ; js/90 bù bằng đơn POS)',
    NO_CS: 'C — CS không nằm trong csSet của khách', HIDDEN: 'D — có khách + CS + ngày nhưng bị BỘ LỌC KHÁC loại', EXCL: '— đơn bị loại (Hủy/Hoàn), không tính' };

  // HAM THUAN. diag: ket qua donDayDiag; customers: allCustomers; shown: mang khach dang hien; sale: ten CS (co the rong); aliasFn(sale) -> mang ten cung nguoi.
  function khDiagClassify_(diag, customers, shown, sale, aliasFn) {
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
        var hasDay = (c.ymList || []).some(function (o) { return o && o.ds === diag.date; });
        var csOk = !sale || Array.from(c.csSet || []).some(function (n) { return want[lc_(n)]; });
        why = !csOk ? 'NO_CS' : (!hasDay ? 'NO_DAY' : 'HIDDEN');
      }
      out.push({ phone: a.phone || a.rawPhone, name: a.name, orders: a.orders, rev: a.rev, why: why, text: WHY[why] });
    });
    var sum = {}; out.forEach(function (o) { sum[o.why] = (sum[o.why] || 0) + 1; });
    out.sort(function (x, y) { return (x.why === 'OK') - (y.why === 'OK') || y.rev - x.rev; });
    return { date: diag && diag.date, sale: sale || '', posOrders: diag && diag.orders, posPhones: diag && diag.phones, posRevenue: diag && diag.revenue, rows: out, summary: sum };
  }
  G.khDiagClassify_ = khDiagClassify_;

  function khDiagText_(r) {
    var L = ['ĐỐI SOÁT POS ' + r.date + (r.sale ? ' · ' + r.sale : ''), 'POS: ' + r.posOrders + ' đơn / ' + r.posPhones + ' SĐT / ' + fmt_(r.posRevenue) + ' (đơn không bị loại)',
      'Kết quả: ' + Object.keys(r.summary).map(function (k) { return k + '=' + r.summary[k]; }).join(', ')];
    r.rows.forEach(function (o) { L.push(o.phone + ' | ' + (o.name || '') + ' | ' + o.orders + ' đơn | ' + fmt_(o.rev) + ' | ' + o.text); });
    return L.join('\n');
  }
  G.khDiagText_ = khDiagText_;

  function khDiagDay_(date, sale) {
    if (typeof gsUrl === 'undefined' || !gsUrl) return Promise.reject(new Error('Chưa có URL GAS'));
    var url = gsUrl + (gsUrl.indexOf('?') > -1 ? '&' : '?') + 'action=donDayDiag&date=' + encodeURIComponent(date) + '&sale=' + encodeURIComponent(sale || '');
    var get = (typeof _gsFetchTO_ === 'function') ? function (u) { return _gsFetchTO_(u, 60000); } : function (u) { return fetch(u, { redirect: 'follow' }); };
    return Promise.resolve().then(function () { return get(url); }).then(function (r) { return r.text(); }).then(function (t) {
      var j; try { j = JSON.parse(t); } catch (e) { throw new Error('GAS trả không phải JSON (chưa deploy action donDayDiag?)'); }
      if (!j || !j.ok) throw new Error((j && j.error) || 'GAS chưa có action donDayDiag — chờ workflow Deploy GAS xanh');
      return khDiagClassify_(j, (typeof allCustomers !== 'undefined' ? allCustomers : []), G.__omeFiltered || (typeof _lastFilteredObjs !== 'undefined' ? _lastFilteredObjs : []), sale,
        (typeof _personAliases === 'function') ? _personAliases : null);
    });
  }
  G.khDiagDay_ = khDiagDay_;

  function isAdmin_() { try { return (typeof currentUser === 'undefined' || !currentUser || currentUser.role === 'admin'); } catch (e) { return false; } }

  function open_() {
    var box = document.getElementById('pos-diag-box');
    if (box) { box.style.display = box.style.display === 'none' ? '' : 'none'; return; }
    box = document.createElement('div'); box.id = 'pos-diag-box';
    box.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9999;width:min(560px,94vw);max-height:80vh;overflow:auto;background:var(--card,#fff);color:var(--text,#111);border:1px solid var(--border,#ccc);border-radius:10px;padding:10px;box-shadow:0 6px 24px rgba(0,0,0,.25);font-size:12px';
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
        out.innerHTML = '<div>POS: <b>' + r.posOrders + '</b> đơn / <b>' + r.posPhones + '</b> SĐT / ' + esc_(fmt_(r.posRevenue)) + ' · ' + Object.keys(r.summary).map(function (k) { return esc_(WHY[k] ? k : k) + ' ' + r.summary[k]; }).join(' · ') + '</div>' +
          r.rows.map(function (o) { return '<div style="padding:2px 0;border-top:1px solid var(--border,#eee)">' + esc_(o.phone) + ' · ' + esc_(o.name || '—') + ' · ' + o.orders + ' đơn / ' + esc_(fmt_(o.rev)) + '<br><i>' + esc_(o.text) + '</i></div>'; }).join('');
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

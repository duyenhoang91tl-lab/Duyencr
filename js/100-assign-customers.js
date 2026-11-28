// js/100-assign-customers.js — SĐT ĐƯỢC CHIA LUÔN CÓ TRONG "DANH SÁCH KH" (2026-11-26).
// NGUYÊN NHÂN GỐC "đã chia data nhưng sale vào không hiện khách": buildCustomers (js/02) chỉ tạo khách từ dữ liệu MÁY ĐÓ tải được (DT tổng, CareData, Chăm sóc,
// CSKH, đơn POS 90 ngày). Máy admin (lúc chia) và máy sale không có cùng dữ liệu (POS admin xem xa hơn, server lọc phạm vi theo sale, tải lỗi...), nên SĐT
// trong đợt chia mà máy sale không có nguồn nào thì không thành khách -> bộ lọc phân quyền đúng cũng không có dòng nào để hiện.
// Cách sửa: mọi SĐT trong đợt chia mà chưa có khách thì tạo khách tạm (assignOnly, tên = SĐT nếu chưa biết). Ai được XEM vẫn do _inUserScope (js/08) quyết định.
// Không ghi vào careData / Sheet. Nạp SAU js/07 và js/89. Gỡ = xoá thẻ script trong index.html.
(function () {
  var G = (typeof window !== 'undefined') ? window : globalThis;

  function batches_() { return (typeof assignHistory !== 'undefined' && assignHistory) ? assignHistory : []; }

  // HÀM THUẦN: SĐT nằm trong đợt chia mà exists(ph) = false (không trùng).
  function assignMissingPhones_(history, exists) {
    var seen = {}, out = [];
    (history || []).forEach(function (h) {
      ((h && h.phones) || []).forEach(function (p) {
        var ph = String(p == null ? '' : p).trim();
        if (ph.replace(/\D/g, '').length < 8 || seen[ph]) return;
        seen[ph] = 1;
        if (!exists(ph)) out.push(ph);
      });
    });
    return out;
  }
  G.assignMissingPhones_ = assignMissingPhones_;

  // Bỏ khách tạm của lần dựng trước để nguồn thật (nếu vừa về) tạo lại đúng tên, và đợt chia đã xoá không còn sót.
  function dropStubs_(map) {
    Object.keys(map).forEach(function (ph) {
      var c = map[ph];
      if (!c || !c.assignOnly) return;
      if (!c.orders || !c.orders.length) { delete map[ph]; return; }
      delete c.assignOnly;   // đã có đơn thật gộp vào: giữ lại, lấy tên từ đơn
      if (c.name === ph) { for (var i = 0; i < c.orders.length; i++) { if (c.orders[i].name) { c.name = c.orders[i].name; break; } } }
    });
  }

  function inject_(map) {
    var n = 0;
    assignMissingPhones_(batches_(), function (ph) { return !!map[ph]; }).forEach(function (ph) {
      var lead = (typeof careLeads !== 'undefined' && careLeads && careLeads[ph]) || {};
      map[ph] = { phone: ph, name: lead.name || ph, orders: [], sources: new Set(), brands: new Set(), _keys: new Set(), _rawStatus: '', _rawZalo: '', _rawNote: '', assignOnly: true };
      n++;
    });
    return n;
  }

  // js/02 buildCustomers gọi posCustomersInject_ ngay trước khi dựng allCustomers -> bọc: bỏ khách tạm cũ, thêm khách POS, rồi thêm SĐT được chia còn thiếu.
  var prevInject = G.posCustomersInject_;
  G.posCustomersInject_ = function (map) {
    if (!map) return 0;
    dropStubs_(map);
    var n = prevInject ? prevInject(map) : 0;
    return n + inject_(map);
  };

  // Đợt chia mới kéo về SAU khi danh sách đã dựng -> dựng lại. Chỉ kiểm tra khi đợt chia đổi (không quét lại mỗi 15 giây).
  var lastSig = '';
  function assignRefreshCustomers_() {
    if (typeof allCustomers === 'undefined' || typeof buildCustomers !== 'function') return false;
    var sig = batches_().map(function (h) { return h.id + ':' + ((h.phones && h.phones.length) || 0); }).join(',');
    if (sig === lastSig) return false;
    lastSig = sig;
    var have = {};
    (allCustomers || []).forEach(function (c) { have[c.phone] = 1; });
    if (!assignMissingPhones_(batches_(), function (ph) { return !!have[ph]; }).length) return false;
    buildCustomers();
    if (typeof applyFilters === 'function') applyFilters();
    return true;
  }
  G.assignRefreshCustomers_ = assignRefreshCustomers_;

  if (typeof pullAssignHistory === 'function') {
    var prevPull = pullAssignHistory;
    G.pullAssignHistory = async function () {
      var r = await prevPull.apply(this, arguments);
      try { assignRefreshCustomers_(); } catch (e) { console.warn('assignCustomers:', e); }
      return r;
    };
  }
})();

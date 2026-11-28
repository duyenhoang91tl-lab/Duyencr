// js/89-pos-customers.js — DANH SACH KH KHOP DON POS, BUOC 3/7 (HANDOFF 2026-11-16/17): TAO KHACH cho SDT chi co o POS ("du lieu don").
// NGUYEN NHAN GOC: buildCustomers (js/02) chi tao khach tu DT tong / careData / careLeads / cskhData; SDT chi co trong POS KHONG thanh khach (donPhoneSet chi gan co dataSrc.don)
// -> khach POS cua sale (vd 9 khach 16/11 cua biichnguyen1993) khong co trong danh sach du loc dung cung khong thay. Duyen chot 17/11: "khach chi co POS: CO tu them vao danh sach".
// Cach lam: js/02 buildCustomers co 1 dong goi `posCustomersInject_(customerMap)` (guard typeof) NGAY TRUOC khi dung allCustomers — sau cac nhanh tao khach cu, nen SDT da co khach tu
// bat ky nguon nao (DT tong/careData/Chăm sóc/CSKH) duoc GIU NGUYEN (khong ghi de ten, khong tao trung: 1 khach/1 SDT). Chi them SDT co don POS (js/88 posOrdersByPhone) ma chua co khach.
// Khach moi: { phone, name (ten o don POS moi nhat khac SDT, khong co thi SDT), orders:[], sources/brands/_keys rong, posOnly:true } — di qua phan con lai cua buildCustomers nhu khach khac
// (c.posOnly duoc giu nho ...c). KHONG ghi vao careData/careLeads that (khong dong bo len GAS, khong luu may).
// Khi don POS moi ve (js/88 posOrdersOnChange_) ma co SDT POS chua co khach -> chay lai buildCustomers 1 lan (khong lap: SDT da co khach thi khong chay lai).
(function () {
  var G = (typeof window !== 'undefined') ? window : globalThis;

  // HAM THUAN: { phone: ten } cho SDT co don POS ma exists(phone) = false. Ten = ten o don POS moi nhat khac SDT, khong co thi SDT.
  function posOnlyPhones_(byPhone, exists) {
    var out = {};
    Object.keys(byPhone || {}).forEach(function (ph) {
      var rows = byPhone[ph];
      if (!ph || !rows || !rows.length || exists(ph)) return;
      var nm = '';
      for (var i = 0; i < rows.length; i++) { var t = String((rows[i] && rows[i].name) || '').trim(); if (t && t !== ph) { nm = t; break; } }
      out[ph] = nm || ph;
    });
    return out;
  }
  G.posOnlyPhones_ = posOnlyPhones_;

  // Goi tu js/02 buildCustomers: them khach POS-only vao customerMap. Tra so khach them (de chan doan).
  G.posCustomersInject_ = function (customerMap) {
    var by = G.posOrdersByPhone;
    if (!by || !customerMap) return 0;
    var want = posOnlyPhones_(by, function (ph) { return !!customerMap[ph]; }), n = 0;
    Object.keys(want).forEach(function (ph) {
      customerMap[ph] = { phone: ph, name: want[ph], orders: [], sources: new Set(), brands: new Set(), _keys: new Set(), _rawStatus: '', _rawZalo: '', _rawNote: '', posOnly: true };
      n++;
    });
    return n;
  };

  // Don POS moi ve: co SDT POS chua co khach -> dung lai danh sach 1 lan
  if (typeof G.posOrdersOnChange_ === 'function') {
    G.posOrdersOnChange_(function () {
      try {
        if (typeof allCustomers === 'undefined' || !allCustomers || !allCustomers.length || !G.posOrdersByPhone || typeof buildCustomers !== 'function') return;
        var idx = {};
        for (var i = 0; i < allCustomers.length; i++) if (!allCustomers[i].assignOnly) idx[allCustomers[i].phone] = 1;   // khach tam do chia data (js/100): don POS ve thi dung lai de lay ten
        if (Object.keys(posOnlyPhones_(G.posOrdersByPhone, function (ph) { return !!idx[ph]; })).length) buildCustomers();
      } catch (e) { try { console.warn('posCustomers:', e); } catch (e2) {} }
    });
  }
})();

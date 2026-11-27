function buildKpiReport_(from, to, saleFilter) {
  var saleFilterArr = Array.isArray(saleFilter) ? saleFilter.filter(function(s){return s;}) : [];
  var saleFilterSetKpi = saleFilterArr.length ? _saleFilterNameSet_(saleFilterArr) : null;   // ten da khop = cung 1 nguoi
  // Thieu khoang ngay -> KHONG im lang tinh toan bo lich su (so don/doanh thu ca nam ghep voi
  // tuong tac ca nam cho ra ty le vo nghia). Mac dinh 7 ngay gan nhat va bao ro cho giao dien.
  var warnings = [];
  // KHONG dung Session.getScriptTimeZone() de tinh "hom nay" — neu cau hinh Time Zone cua du an
  // Apps Script khong phai gio VN (vd bi de mac dinh khac), "hom nay" se tinh sai ngay. Dung
  // thang offset co dinh +7 (_vnYmd_) — chac chan dung du du an cau hinh Time Zone la gi.
  if (!from || !to) {
    var now = new Date();
    if (!to)   to   = _vnYmd_(now);
    if (!from) from = _vnYmd_(new Date(now.getTime() - 6 * 86400000));
    warnings.push('Chưa chọn đủ khoảng ngày — đang tạm tính cho 7 ngày gần nhất (' + from + ' → ' + to + ').');
  }
  if (from && to && from > to) {
    warnings.push('Khoảng ngày bị ngược (từ ' + from + ' sau đến ' + to + ') nên không có dữ liệu nào lọt vào. Hãy đổi lại 2 ô ngày.');
  }

  // 1) DT TONG: gom doanh thu/so don theo Page (kenhBan) va theo Sale (saleBan, co the nhieu
  // Sale/don, cach lam giong het buildSalesReportA_: so don KHONG chia, tien CHIA DEU cho N Sale)
  //
  // LUU Y quan trong ve moc ngay dung de loc: bao cao nay PHAI khop voi "Report Page" cua
  // chinh Base (widget bao cao co san tren workflow "ĐƠN CÁC KÊNH") va voi file Base xuat ra
  // (Export -> "Ngày tạo"), vi CS doi chieu 2 ben voi nhau. Ca 2 cho do deu gom don theo
  // NGAY TAO don (Ngay tao), KHONG theo ngay hoan thanh. Truoc day cho nay dung o.date, ma
  // o.date lai UU TIEN "Thoi gian hoan thanh" (xem dtRowToOrder_) — nen 1 don duoc TAO tu
  // hom truoc nhung moi duoc CHUYEN GIAI DOAN/hoan thanh vao dung ngay dang xem se bi tinh
  // GOP THEM vao ngay do, lam doanh thu bao cao nay CAO HON han so voi Base that (da gap:
  // vi du ngay 19/09/2026 Base tinh 222.327.000d nhung bao cao nay ra toi 244.572.000d).
  // Sua: dung dung o.orderDate (= cot "Ngày tạo" that su, khong doi theo trang thai) cho
  // rieng bao cao KPI nay. Cac bao cao doanh so A/B/C khac VAN giu nguyen o.date nhu cu,
  // khong dong cham toi (do la quyet dinh rieng, xem chu thich o dtRowToOrder_ dong ~994).
  var orders = readAllOrders_();
  _dtApplyBoDem_(orders);   // cột U mã bộ đếm → nhận đơn BH không doanh thu
  var byPageOrders = {}, bySaleOrders = {};
  // MOI: gom them theo (kenh|sale) x NGAY — dung rieng cho tu so "Ty le chot", de chi cong don
  // trong dung nhung ngay Page/Sale do THUC SU co du lieu tuong tac Pancake (xem
  // _pkTrackedDatesByPageAndSale_). "donHang"/"doanhThu"/"trungBinhDon" hien thi tren bang
  // VAN giu nguyen tinh tren CA khoang ngay nhu truoc (khong doi theo yeu cau Duyen).
  var ordersByKenhDate = {}, ordersBySaleDate = {};
  var ordersDetail = []; // danh sach tung don khop khoang ngay -> xuat Excel de doi chieu tay voi Base
  // Kenh nay KHONG co du lieu tren Pancake (khong xuat hien trong file "Thong ke tuong tac" /
  // "Thong ke nhan vien" ma Duyen nap vao) nen mau so "tongTT" cua Sale phu trach kenh nay
  // KHONG he tang len du don van ve. Neu van cong don cua kenh nay vao tu so (donHang) thi
  // "Ty le chot" bi thoi phong ao (tu so tang, mau so dung yen). Quy uoc: loai don cua kenh
  // nay khoi CA so don LAN doanh thu dung de tinh bySale/tyLeChot (khong dung lam mau so ty
  // le chua co du lieu doi chieu). Bang theo Page (byPage) khong bi anh huong gi vi von di
  // da chi liet ke cac Page CO trong Pancake (xem pageInfo o duoi), khong lien quan kenh nay.
  var KPI_TYLECHOT_EXCLUDED_KENH_ = 'Fb Phạm Thu Hiền';
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    var d = parseVNDate_(o.orderDate);
    if (!d) continue;
    if (!dateInRange_(d, from, to)) continue;
    // SUA 2026-10-03: thieu dieu kien loai don Huy/Da hoan/Dang hoan (_isExcludedOrderStatus_)
    // nhu buildSalesReportA_/C da lam — khien "Báo cáo ngày" (tab Daily brief) cong CA doanh
    // thu cua don da huy/hoan vao kpi.totalDoanhThu va bySale/byPage, cao hon han so voi Bao
    // cao A that (Duyen bao "doanh thu Base dang bi gap doi" — don Huy/Hoan o cua hang nay rat
    // nhieu nen doanh thu gop gan gap doi doanh thu that da tru hoan/huy).
    if (_isExcludedOrderStatus_(o.status)) continue;
    // Loc theo pham vi Sale (CS thuong: chi don cua chinh minh; Leader: don cua ca team) —
    // ap dung TU PHIA SERVER, khong chi an bot o giao dien, de khong the xem duoc doanh thu
    // cua nguoi khac du co sua duoc request phia client.
    if (saleFilterArr.length) {
      var salesOnOrderKpi = splitMulti_(o.cs, ',');
      if (!salesOnOrderKpi.some(function(s){ return saleFilterSetKpi[_normTxt_(s)]; })) continue;
    }
    var page = o.source || '(chưa có kênh)';
    var dKeyOrder = normOrderDate_(o.orderDate);
    if (!byPageOrders[page]) byPageOrders[page] = { orders: 0, revenue: 0 };
    byPageOrders[page].orders += 1;
    byPageOrders[page].revenue += Number(o.revenue) || 0;
    if (!o.bhZero) {   // đơn BH không doanh thu không tính vào tỷ lệ chốt
      if (!ordersByKenhDate[page]) ordersByKenhDate[page] = {};
      if (!ordersByKenhDate[page][dKeyOrder]) ordersByKenhDate[page][dKeyOrder] = { orders: 0, revenue: 0 };
      ordersByKenhDate[page][dKeyOrder].orders += 1;
      ordersByKenhDate[page][dKeyOrder].revenue += Number(o.revenue) || 0;
    }
    ordersDetail.push({
      id: o.id || '', ngayTao: normOrderDate_(o.orderDate), kenhBan: page,
      sale: o.cs || '', giaTriDon: Number(o.revenue) || 0, sanPham: o.product || '', phone: o.phone || ''
    });

    if (_normTxt_(page) === _normTxt_(KPI_TYLECHOT_EXCLUDED_KENH_)) continue; // bo qua kenh khong co tren Pancake — khong tinh vao bySale/tyLeChot

    var salesList = splitMulti_(o.cs, ',');
    if (!salesList.length) salesList = ['(chưa gán sale)'];
    var w = 1 / salesList.length;
    for (var si = 0; si < salesList.length; si++) {
      var sName = salesList[si];
      if (!bySaleOrders[sName]) bySaleOrders[sName] = { orders: 0, revenue: 0 };
      bySaleOrders[sName].orders += 1; // so don: khong chia
      bySaleOrders[sName].revenue += (Number(o.revenue) || 0) * w; // tien: chia deu
      if (!o.bhZero) {
        if (!ordersBySaleDate[sName]) ordersBySaleDate[sName] = {};
        if (!ordersBySaleDate[sName][dKeyOrder]) ordersBySaleDate[sName][dKeyOrder] = { orders: 0, revenue: 0 };
        ordersBySaleDate[sName][dKeyOrder].orders += 1;
        ordersBySaleDate[sName][dKeyOrder].revenue += (Number(o.revenue) || 0) * w;
      }
    }
  }
  var _trackedDates = _pkTrackedDatesByPageAndSale_(from, to);
  var datesByPage = _trackedDates.datesByPage, datesBySale = _trackedDates.datesBySale;

  // 2) Bao cao Pancake (tuong tac + SDT) — dung lai 2 ham da co, split='equal'
  var pInt = buildPancakeReport_(from, to, 'equal');
  var pSdt = buildPancakeSdtReport_(from, to, 'equal');
  var pageMap = readPancakePageMap_(); // pageId -> kenhBan
  var pTag = buildPancakeTagReport_(from, to); // tong hop tag L1-L7 theo Page (tu sheet PancakeTagStats)

  // 3) Ghep theo Page: hop cac pageId tung xuat hien o ca 2 bao cao Pancake
  var pageInfo = {}; // pageId -> {pageName}
  pInt.byPage.forEach(function(r) { pageInfo[r.pageId] = { pageName: r.pageName, tongTT: r.tongTT, tongDH_pancake: r.tongDH }; });
  pSdt.byPage.forEach(function(r) {
    if (!pageInfo[r.pageId]) pageInfo[r.pageId] = { pageName: r.pageName, tongTT: 0, tongDH_pancake: 0 };
    pageInfo[r.pageId].sdtMangVe = r.sdtMangVe;
  });
  var byPage = Object.keys(pageInfo).map(function(pid) {
    var info = pageInfo[pid];
    var kenhBan = pageMap[pid] || '';
    var dt = kenhBan && byPageOrders[kenhBan] ? byPageOrders[kenhBan] : { orders: 0, revenue: 0 };
    // Ty le chot: CHI dem don trong dung nhung ngay Page nay THUC SU co du lieu tuong tac
    // Pancake (datesByPage[pid]) — khong dung ca khoang ngay nhu donHang/doanhThu hien thi.
    var trackedDatesPage = datesByPage[pid] || {};
    var dtRate = kenhBan ? _sumOrdersOnDates_(ordersByKenhDate, kenhBan, trackedDatesPage) : { orders: 0, revenue: 0 };
    var tongTT = info.tongTT || 0;
    var sdtMangVe = info.sdtMangVe || 0;
    var tagInfo = pTag.byPage[pid];
    var tagFunnel = _tagFunnelRates_(tagInfo || {}, tongTT, sdtMangVe, dt.orders);
    return {
      pageId: pid, pageName: info.pageName || pid, kenhBan: kenhBan,
      mapped: !!kenhBan,
      tongTT: tongTT, sdtMangVe: sdtMangVe,
      donHang: dt.orders, doanhThu: dt.revenue, // giu nguyen tren CA khoang ngay (khong doi)
      donHangForRate: dtRate.orders, // chi dung noi bo cho tu so Ty le chot (cascade sang MKT/tong)
      tyLeChot: tongTT ? Math.round(dtRate.orders / tongTT * 1000) / 10 : 0, // % — CHI tinh tren ngay co Pancake
      trungBinhDon: dt.orders ? Math.round(dt.revenue / dt.orders) : 0,
      tag: tagFunnel // { counts:{L1..L7}, rates:{L1..L7} } — xem cong thuc o _tagFunnelRates_
    };
  });
  byPage.sort(function(a, b) { return b.tongTT - a.tongTT; });

  // 4) Ghep theo Sale: pInt.byCS da o dang ten Sale chuan (qua PancakeNameMap) -> khop thang
  // voi bySaleOrders (cung la ten Sale chuan tu cot saleBan DT TONG).
  // Gop tu CA 2 bao cao: mot Sale chi co trong file "Thong ke nhan vien" (SDT) ma khong co
  // trong file "Thong ke tuong tac" truoc day bi mat hut khoi bang nay.
  var saleAgg = {}, saleCanon = {}; // ci-key -> ten hien thi dau tien gap (gop bien the hoa/thuong giua 2 file)
  function _saleKey(name) {
    var ck = _normTxt_(name);
    if (!saleCanon[ck]) saleCanon[ck] = name;
    return ck;
  }
  pInt.byCS.forEach(function(r) {
    var k = _saleKey(r.name);
    saleAgg[k] = { name: saleCanon[k], mapped: r.mapped, tongTT: r.tongTT || 0, sdtMangVe: 0 };
  });
  pSdt.byCS.forEach(function(r) {
    var k = _saleKey(r.name);
    if (!saleAgg[k]) saleAgg[k] = { name: saleCanon[k], mapped: r.mapped, tongTT: 0, sdtMangVe: 0 };
    saleAgg[k].sdtMangVe = r.sdtMangVe || 0;
    if (r.mapped) saleAgg[k].mapped = true;
  });
  var bySale = Object.keys(saleAgg).map(function(k) {
    var r = saleAgg[k];
    var dt = bySaleOrders[r.name] || { orders: 0, revenue: 0 };
    var trackedDatesSale = datesBySale[r.name] || {};
    var dtRateSale = _sumOrdersOnDates_(ordersBySaleDate, r.name, trackedDatesSale);
    return {
      name: r.name, mapped: r.mapped,
      tongTT: r.tongTT, sdtMangVe: r.sdtMangVe,
      donHang: dt.orders, doanhThu: Math.round(dt.revenue), // giu nguyen tren ca khoang ngay
      donHangForRate: dtRateSale.orders, // chi dung noi bo cho tu so Ty le chot (cascade sang saleGroups)
      trungBinhDon: dt.orders ? Math.round(dt.revenue / dt.orders) : 0,
      tyLeChot: r.tongTT ? Math.round(dtRateSale.orders / r.tongTT * 1000) / 10 : 0 // CHI tinh tren ngay Sale co Pancake
    };
  });
  // Gan nhom Van phong (S) / Online (O) theo danh sach Sale chuan o sheet SaleDirectory.
  var saleDir = readSaleDirectory_();
  bySale.forEach(function(r) {
    var rec = saleDir.byName[_normTxt_(r.name)];
    r.nhom = rec ? rec.nhom : '';
    r.maSale = rec ? rec.code : '';
    r.inDirectory = !!rec;
  });
  // 2026-11-26: gan co kd:true/false (CUNG nguon voi Bao cao A/B: Online + Van phong + Thu viec + phong ban Sale, khop NGUOI) de tab KPI Pancake loc "phong kinh doanh"
  // dung nhu A/B. NGUYEN NHAN GOC: client chi tra SALE_CHANNELS/nhom S-O nen ban moi (ngocNM thuoc phong ban Sale, hoac Thu viec) bi xep vao "ngoai phong KD".
  _srKdMark_(bySale, { dateTo: to });
  bySale.sort(function(a, b) {
    // Thu tu nhom: Van phong (S) -> Online (O) -> ngoai danh sach, dung theo yeu cau; trong
    // tung nhom sap theo Ty le chot (tyLeChot) giam dan — Sale chot tot nhat len dau.
    var rank = { 'Văn phòng': 0, 'Online': 1, 'Thử việc': 2 };
    var ra = rank.hasOwnProperty(a.nhom) ? rank[a.nhom] : 3;
    var rb = rank.hasOwnProperty(b.nhom) ? rank[b.nhom] : 3;
    if (ra !== rb) return ra - rb;
    return b.tyLeChot - a.tyLeChot;
  });

  // Tong theo nhom: don KHONG chia (1 don co the co nhieu Sale) nen chi cong doanh thu da chia
  // deu o tren -> cong lai theo nhom van dung tong the.
  var byGroup = {};
  ['Văn phòng', 'Online', 'Thử việc', ''].forEach(function(g) {
    byGroup[g || '(ngoài danh sách)'] = { nhom: g || '(ngoài danh sách)', soSale: 0, tongTT: 0, sdtMangVe: 0, donHang: 0, doanhThu: 0, donHangForRate: 0 };
  });
  bySale.forEach(function(r) {
    var g = byGroup[r.nhom || '(ngoài danh sách)'];
    g.soSale++; g.tongTT += r.tongTT; g.sdtMangVe += r.sdtMangVe;
    g.donHang += r.donHang; g.doanhThu += r.doanhThu; g.donHangForRate += r.donHangForRate;
  });
  var saleGroups = Object.keys(byGroup).map(function(k) { return byGroup[k]; })
    .filter(function(g) { return g.soSale > 0; });
  saleGroups.forEach(function(g) {
    g.tyLeChot = g.tongTT ? Math.round(g.donHangForRate / g.tongTT * 1000) / 10 : 0;
    g.trungBinhDon = g.donHang ? Math.round(g.doanhThu / g.donHang) : 0;
  });

  var totalTongTT = byPage.reduce(function(s, r) { return s + r.tongTT; }, 0);
  var totalSdtMangVe = byPage.reduce(function(s, r) { return s + r.sdtMangVe; }, 0);

  // Theo MKT: gom cac dong Page theo MktTeams (page chay chung -> chia theo ty le 'share').
  // Don/doanh thu cua 1 Kenh chi tinh 1 lan (cho dong Page dau tien tro ve kenh do) de khong nhan doi.
  var mktTeamsK = readMktTeams_();
  var pwK = _mktPageWeights_(mktTeamsK);
  var mktAgg = {};
  mktTeamsK.forEach(function(t) { mktAgg[t.id] = { id: t.id, name: t.name, color: t.color, pages: [], tongTT: 0, sdtMangVe: 0, donHang: 0, doanhThu: 0, donHangForRate: 0 }; });
  var seenKenhM = {};
  byPage.forEach(function(r) {
    var ws = pwK[r.pageId] || [{ id: '_none', name: '(chưa gán MKT)', w: 1 }];
    var countKenh = r.mapped && !seenKenhM[r.kenhBan];
    if (r.mapped) seenKenhM[r.kenhBan] = true;
    ws.forEach(function(x) {
      if (!mktAgg[x.id]) mktAgg[x.id] = { id: x.id, name: x.name, color: '', pages: [], tongTT: 0, sdtMangVe: 0, donHang: 0, doanhThu: 0, donHangForRate: 0 };
      var g = mktAgg[x.id];
      g.pages.push(r.pageName + (x.w < 1 ? ' (' + Math.round(x.w * 100) + '%)' : ''));
      g.tongTT += r.tongTT * x.w; g.sdtMangVe += r.sdtMangVe * x.w;
      if (countKenh) { g.donHang += r.donHang * x.w; g.doanhThu += r.doanhThu * x.w; g.donHangForRate += r.donHangForRate * x.w; }
    });
  });
  var byMkt = Object.keys(mktAgg).map(function(k) {
    var g = mktAgg[k];
    g.tongTT = Math.round(g.tongTT * 100) / 100; g.sdtMangVe = Math.round(g.sdtMangVe * 100) / 100;
    g.tyLeChot = g.tongTT ? Math.round(g.donHangForRate / g.tongTT * 1000) / 10 : 0; // CHI tinh tren ngay co Pancake (theo tung page cong lai)
    g.trungBinhDon = g.donHang ? Math.round(g.doanhThu / g.donHang) : 0;
    g.donHang = Math.round(g.donHang * 100) / 100; g.doanhThu = Math.round(g.doanhThu);
    delete g.donHangForRate;
    return g;
  }).filter(function(g) { return g.id !== '_none' || g.pages.length; })
    .sort(function(a, b) { return b.doanhThu - a.doanhThu; });

  // Don/doanh thu: cong theo KENH BAN DUY NHAT, khong cong theo dong Page. Neu 2 Page cung tro
  // ve 1 Kenh ban thi moi dong Page deu hien tron so cua kenh do (dung khi xem tung dong),
  // nhung cong lai se bi nhan doi -> tong phai gom theo kenh.
  var seenKenh = {}, dupKenh = {};
  var totalDonHang = 0, totalDoanhThu = 0, totalDonHangForRate = 0;
  byPage.forEach(function(r) {
    if (!r.mapped) return;
    if (seenKenh[r.kenhBan]) { dupKenh[r.kenhBan] = true; return; }
    seenKenh[r.kenhBan] = true;
    totalDonHang += r.donHang; totalDoanhThu += r.doanhThu; totalDonHangForRate += r.donHangForRate;
  });
  var duplicateChannels = Object.keys(dupKenh);
  if (duplicateChannels.length) {
    warnings.push('Có nhiều Page cùng khớp về 1 Kênh bán (' + duplicateChannels.join(', ') +
      '). Mỗi dòng Page bên dưới hiển thị trọn số đơn/doanh thu của kênh đó, nên cộng các dòng lại sẽ ra nhiều hơn tổng thật — tổng phía trên đã gom theo kênh nên không bị nhân đôi.');
  }
  var unmappedPages = byPage.filter(function(r) { return !r.mapped; }).map(function(r) { return { pageId: r.pageId, pageName: r.pageName }; });
  var unmappedSales = bySale.filter(function(r) { return !r.mapped; }).map(function(r) { return r.name; });

  // Chan doan nguon du lieu: bao ro "chua nap bao gio" vs "co du lieu nhung ngoai khoang ngay".
  var dataAvail = {
    tuongTac: _pkSheetDateSpan_(SH_PK_STATS, PK_STATS_HEADERS, from, to),
    sdt:      _pkSheetDateSpan_(SH_PK_SDT,   PK_SDT_STATS_HEADERS, from, to),
    tag:      _pkSheetDateSpan_(SH_PK_TAG,   PK_TAG_STATS_HEADERS, from, to)
  };
  var LBL_ = { tuongTac: 'Thống kê tương tác', sdt: 'Thống kê nhân viên (SĐT)', tag: 'Thống kê tag' };
  Object.keys(dataAvail).forEach(function(k) {
    var a = dataAvail[k];
    if (a.rows === 0) {
      warnings.push('Chưa có dữ liệu "' + LBL_[k] + '" nào trên CRM — vào tab "📥 Báo cáo Pancake", nạp file rồi bấm "💾 Lưu lên CRM".');
    } else if (a.rowsInRange === 0) {
      warnings.push('Không có dòng "' + LBL_[k] + '" nào trong khoảng ngày đang chọn (dữ liệu hiện có từ ' + a.minDate + ' đến ' + a.maxDate + ').');
    }
  });
  // Phe do L1-L7 toan he thong: dung tong tag da gom san o buildPancakeTagReport_ (pTag.totals),
  // mau so tongTT/sdtMangVe la tong cong tat ca Page trong ky (khong phai cong ty le tung Page).
  var tagFunnelTotal = _tagFunnelRates_(pTag.totals, totalTongTT, totalSdtMangVe, totalDonHang);

  return {
    byPage: byPage, bySale: bySale, byMkt: byMkt,
    totalTongTT: totalTongTT, totalDonHang: totalDonHang, totalDoanhThu: totalDoanhThu, totalSdtMangVe: totalSdtMangVe,
    tyLeChotChung: totalTongTT ? Math.round(totalDonHangForRate / totalTongTT * 1000) / 10 : 0, // CHI tinh tren ngay co Pancake (xem donHangForRate)
    tagFunnelTotal: tagFunnelTotal,
    unmappedPages: unmappedPages,
    unmappedSales: unmappedSales,
    saleGroups: saleGroups,
    saleDirectoryCount: saleDir.list.length,
    duplicateChannels: duplicateChannels,
    dataAvail: dataAvail,
    ordersDetail: ordersDetail, // danh sach tung don DT TONG khop khoang ngay -> doi chieu voi Base
    from: from, to: to,
    warnings: warnings
  };
}

function saveUsers_(users) {
  users = users || [];
  var adminCount = 0;
  for (var a = 0; a < users.length; a++) { if (users[a] && users[a].role === 'admin') adminCount++; }
  if (users.length > 0 && adminCount === 0) return jsonOut_({ error: 'TU_CHOI: Phai con it nhat 1 tai khoan Admin.' });
  var sh = getSheet_(SH_USER, USER_HEADERS);
  // Hash KHONG con den tu client (action=users khong tra passHash nua): giu hash dang luu theo username; chi doi khi co setPassword (server tu bam).
  var oldHash = {};
  var _oldUsers = readUsers_(sh), _oUM = {}, _nUM = {};
  var oldMonths = {}, oldRec = {};
  _oldUsers.forEach(function(x) { var k = String(x.username || '').trim().toLowerCase(); oldRec[k] = x; oldHash[k] = x.passHash || ''; oldMonths[k] = x.viewMonths || []; _oUM[String(x.username)] = _auditUserSig_(x); });
  // 2026-11-27: truong client KHONG gui (undefined) -> giu gia tri dang luu. NGUYEN NHAN GOC: ghi lai ca sheet voi '' cho truong thieu, nen web ban cu (sua tai khoan lam roi
  // 4 truong nay) hoac danh sach rut gon xoa mat quyen tab rieng / loai sale / ngay nhan tin / ngay vao. Muon XOA thi gui gia tri rong (perms: null, ngay: '') — web dang lam vay.
  users.forEach(function(x) {
    var old = x && oldRec[String(x.username || '').trim().toLowerCase()];
    if (old) ['perms', 'saleType', 'startDate', 'joinDate'].forEach(function(f) { if (x[f] === undefined) x[f] = old[f]; });
  });
  // Web ban cu (chua Ctrl+F5) khong gui viewMonths -> giu gia tri dang luu, tranh xoa mat gioi han thang admin da cai.
  users.forEach(function(x) { if (x) x.viewMonths = _viewMonthsNorm_(x.viewMonths === undefined ? oldMonths[String(x.username || '').trim().toLowerCase()] : x.viewMonths); });
  users.forEach(function(x) { if (x && x.username) { var sg = _auditUserSig_(x); if (x.setPassword) sg += ', ĐỔI MẬT KHẨU'; _nUM[String(x.username)] = sg; } });
  var _uAudit = _auditDiffRows_('users', _oUM, _nUM);
  sh.clearContents();
  var matrix = [USER_HEADERS];
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var uk = String(u.username || '').trim().toLowerCase();
    var ph = oldHash[uk] || '';
    if (u.setPassword) ph = _pwHash_(String(u.setPassword), _PW_SALT_);
    else if (!ph && /^[0-9a-f]{64}$/.test(String(u.passHash || ''))) ph = String(u.passHash);   // tuong thich: tai khoan MOI tu client cu da bam san
    var namesArr = (u.names && u.names.length) ? u.names : (u.name ? [u.name] : []);
    matrix.push([String(u.username||''), ph, u.role||'cs',
                 namesArr[0]||u.name||'', u.team||'', (u.active===false?false:true),
                 JSON.stringify(namesArr),
                 (Array.isArray(u.perms) ? JSON.stringify(u.perms) : ''),
                 u.saleType||'', u.startDate||'', u.joinDate||'',
                 (u.viewMonths && u.viewMonths.length) ? JSON.stringify(u.viewMonths) : '']);
  }
  sh.getRange(1, 1, matrix.length, USER_HEADERS.length).setValues(matrix);
  _auditCfg_(_uAudit);
  return jsonOut_({ ok: true, written: users.length });
}

function saveAudit_(rows) {
  var sh = getSheet_(SH_AUDIT, AUDIT_HEADERS);
  if (!rows || !rows.length) return jsonOut_({ ok: true, written: 0 });
  var matrix = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    matrix.push([r.timestamp||new Date().toISOString(), r.user||'', r.action||'', r.phone||'', r.oldValue||'', r.newValue||'']);
  }
  sh.getRange(sh.getLastRow()+1, 1, matrix.length, AUDIT_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: matrix.length });
}

// ─── CARE STATUS / ASSIGN ──────────────────────────────────────
function saveCareStatus_(list) {
  if (!Array.isArray(list)) return jsonOut_({ error: 'careStatus phai la mang.' });
  return setSetting_('careStatus', JSON.stringify(list));
}

function readAssign_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var vals = sh.getDataRange().getValues();
  // Gop cac dong cung id (dot chia lon bi tach nhieu dong theo cot 'part' — xem assignRowsOf_)
  var byId = {}, order = [];
  for (var i = 1; i < vals.length; i++) {
    if (!vals[i][0]) continue;
    var id = String(vals[i][0]);
    var phones = [], donePhones = [];
    try { phones = JSON.parse(vals[i][4]||'[]'); } catch(e) { phones = []; }
    try { donePhones = JSON.parse(vals[i][5]||'[]'); } catch(e) { donePhones = []; }
    if (!byId[id]) {
      byId[id] = { id: id, date: String(vals[i][1]||''), csName: String(vals[i][2]||''),
                   label: String(vals[i][3]||''), parts: [] };
      order.push(id);
    }
    byId[id].parts.push({ part: Number(vals[i][6]) || 0, phones: phones, donePhones: donePhones });
  }
  for (var k = 0; k < order.length; k++) {
    var e = byId[order[k]];
    e.parts.sort(function(a, b) { return a.part - b.part; });
    var ph = [], dn = [];
    for (var p = 0; p < e.parts.length; p++) { ph = ph.concat(e.parts[p].phones); dn = dn.concat(e.parts[p].donePhones); }
    out.push({ id: e.id, date: e.date, csName: e.csName, label: e.label, phones: ph, donePhones: dn });
  }
  return out;
}

// 1 dot chia -> 1..n dong (moi dong <= ASSIGN_CHUNK SDT) de khong vuot 50.000 ky tu/o cua Google Sheets.
function assignRowsOf_(h) {
  var phones = h.phones || [], done = h.donePhones || [];
  var n = Math.max(1, Math.ceil(phones.length / ASSIGN_CHUNK), Math.ceil(done.length / ASSIGN_CHUNK));
  var rows = [];
  for (var k = 0; k < n; k++) {
    rows.push([h.id||'', h.date||'', h.csName||'', h.label||'',
               JSON.stringify(phones.slice(k * ASSIGN_CHUNK, (k + 1) * ASSIGN_CHUNK)),
               JSON.stringify(done.slice(k * ASSIGN_CHUNK, (k + 1) * ASSIGN_CHUNK)), k]);
  }
  return rows;
}

function saveAssignEntry_(entry) {
  if (!entry || !entry.id) return jsonOut_({ error: 'no entry.id' });
  var sh = getSheet_(SH_ASSIGN, ASSIGN_HEADERS);
  var last = sh.getLastRow(); var found = [];
  if (last >= 2) {
    var cells = sh.getRange(2, 1, last-1, 1).createTextFinder(String(entry.id)).matchEntireCell(true).findAll();
    for (var c = 0; c < cells.length; c++) found.push(cells[c].getRow());
    found.sort(function(a, b) { return a - b; });
  }
  var rows = assignRowsOf_(entry);
  if (found.length === rows.length) {
    // cung so dong (vd chi cap nhat donePhones): ghi de tai cho, giu nguyen vi tri
    for (var k = 0; k < rows.length; k++) sh.getRange(found[k], 1, 1, ASSIGN_HEADERS.length).setValues([rows[k]]);
  } else {
    for (var d = found.length - 1; d >= 0; d--) sh.deleteRow(found[d]);   // xoa tu duoi len de khong lech chi so
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, ASSIGN_HEADERS.length).setValues(rows);
  }
  return jsonOut_({ ok: true, rows: rows.length });
}

// Danh dau 1 SDT la "da goi xong"/"chua goi" trong TAT CA cac dot chia cua dung 1 CS — dung cho
// Pancake AI (muc "Data duoc chia", xem renderAssignTab_/toggleAssignPhoneDone_ trong
// pancake-content.js) de CS tich xong ngay tai Pancake, khong can mo CRM. CHI ghi de dung (cac)
// dong cua (cac) dot chia bi doi qua saveAssignEntry_ (an toan hon saveAssignHistory_ — khong xoa
// trang roi ghi lai CA sheet, tranh dam vao CS khac dang luu cung luc). Dung LockService vi 1 CS co
// the tich lien tuc nhieu SDT gan nhau (2 request ghi cung 1 dot chia de dam vao nhau neu khong khoa).
function toggleAssignDone_(csName, phone, done) {
  csName = String(csName || '').trim();
  phone = String(phone || '').trim();
  if (!csName || !phone) return jsonOut_({ error: 'Thiếu csName hoặc phone.' });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return jsonOut_({ error: 'Đang có thao tác khác ghi dữ liệu chia, thử lại sau vài giây.' });
  try {
    var sh = getSheet_(SH_ASSIGN, ASSIGN_HEADERS);
    var history = readAssign_(sh);
    var touched = [];
    var csSetT = _saleFilterNameSet_([csName]);   // KHOP SALE: dot chia ghi bang ten khac cua cung 1 CS van danh dau duoc
    for (var i = 0; i < history.length; i++) {
      var h = history[i];
      if (!csSetT[_normTxt_(h.csName)] || (h.phones || []).indexOf(phone) === -1) continue;
      h.donePhones = h.donePhones || [];
      var idx = h.donePhones.indexOf(phone);
      if (done && idx === -1) { h.donePhones.push(phone); touched.push(h); }
      else if (!done && idx !== -1) { h.donePhones.splice(idx, 1); touched.push(h); }
    }
    for (var k = 0; k < touched.length; k++) saveAssignEntry_(touched[k]); // ghi tung dot bi doi, giu nguyen cac dot khac
    return jsonOut_({ ok: true, changed: touched.length });
  } finally {
    lock.releaseLock();
  }
}

function saveAssignHistory_(history) {
  if (!history) return jsonOut_({ error: 'no history' });
  var sh = getSheet_(SH_ASSIGN, ASSIGN_HEADERS);
  // DUNG MA TRAN TRUOC, chi clearContents() khi da san sang ghi — truoc day clear xong moi stringify, neu setValues loi
  // (o > 50.000 ky tu) thi sheet bi xoa trang va MAT lich su chia tren server.
  var matrix = [ASSIGN_HEADERS];
  for (var i = 0; i < history.length; i++) {
    var rs = assignRowsOf_(history[i]);
    for (var r = 0; r < rs.length; r++) matrix.push(rs[r]);
  }
  sh.clearContents();
  sh.getRange(1, 1, matrix.length, ASSIGN_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: history.length });
}

// ═══════════════════════════════════════════════════════════════
//  TRUONG NHOM (LEAD): NHAN DATA — CHIA LAI CHO TEAM — XEM TIEN DO — GIOI HAN THANG (2026-11-26)
//  Nguyen nhan goc: truoc day chi admin chia data; Truong nhom chi XEM data team (moi thang), khong chia lai duoc va admin khong
//  gioi han duoc thang du lieu. Ngoai ra saveAssignHistory ghi de CA sheet AssignData voi bat ky tai khoan nao nen ban lich su cu
//  tren may 1 nhan vien co the xoa mat dot chia moi.
//  - Users.viewMonths (JSON ['2026-04',...]): chi ap cho vai tro goc leader. Rong = khong gioi han.
//    Khach xem duoc = khach duoc chia cho CHINH Truong nhom (moi thang) + khach cua team co don trong cac thang do.
//    KHONG ap cho cac bao cao doanh so (van theo pham vi team nhu cu).
//  - GET leadAssignInfo&token: team, thanh vien, thang duoc xem, cac dot chia cua minh + thanh vien (ban moi nhat tren sheet).
//  - POST leadAssign {token, label, entries:[{csName, phones}]}: chi chia SDT da duoc chia cho minh, chi cho thanh vien team minh.
// ═══════════════════════════════════════════════════════════════
var LEAD_ASSIGN_MAX_ = 20000;
function _viewMonthsNorm_(a) {
  if (!Array.isArray(a)) return [];
  var seen = {}, out = [];
  a.forEach(function (x) { x = String(x || '').trim(); if (/^\d{4}-(0[1-9]|1[0-2])$/.test(x) && !seen[x]) { seen[x] = 1; out.push(x); } });
  return out.sort().slice(-36);
}
function _leadMonths_(user) {
  if (!user || !user.viewMonths || !user.viewMonths.length) return [];
  return _roleBase_(user.role) === 'leader' ? user.viewMonths : [];
}
// Ten cua chinh tai khoan: {ten chuan hoa: ten goc}
function _leadOwnNames_(user) {
  var o = {};
  ((user.names && user.names.length) ? user.names : [user.name]).forEach(function (n) { n = String(n || '').trim(); if (n) o[_normTxt_(n)] = n; });
  // + ten dang nhap (cung ly do voi _scopeAllowedNames_: client coi username la 1 ten cua tai khoan; data admin chia ghi theo ten dang nhap van phai thay)
  [user.name, user.username].forEach(function (n) { n = String(n || '').trim(); if (n && !o[_normTxt_(n)]) o[_normTxt_(n)] = n; });
  return o;
}
// Team minh lam truong (ten minh = teams.leader, hoac team trung user.team). members KHONG gom chinh minh.
function _leadTeam_(user, teams) {
  var own = _leadOwnNames_(user), teamNames = [], members = [], seen = {};
  (teams || readTeams_(getCrmSS_().getSheetByName(SH_TEAM))).forEach(function (t) {
    if (!(own[_normTxt_(t.leader || '')] || (user.team && String(t.name || '') === String(user.team)))) return;
    teamNames.push(String(t.name || ''));
    [t.leader].concat(t.members || []).forEach(function (m) {
      m = String(m || '').trim(); var k = _normTxt_(m);
      if (m && !own[k] && !seen[k]) { seen[k] = 1; members.push(m); }
    });
  });
  return { own: own, teamNames: teamNames, members: members };
}
function _ymOfOrderDate_(s) {
  var d = parseVNDate_(s);
  if (!d) return '';
  var p = _vnYmdParts_(d);
  return p ? p.y + '-' + ('0' + p.mo).slice(-2) : '';
}
function _phoneHasOrderInMonths_(phone, months) {
  var want = {}; months.forEach(function (m) { want[m] = 1; });
  try { if (readOrdersByPhone_(phone).some(function (o) { return want[_ymOfOrderDate_(o.date)]; })) return true; } catch (e1) {}
  try { if (findDonRowsByPhone_(phone).some(function (r) { return want[_ymOfOrderDate_(r.ngayTaoDon || r.date)]; })) return true; } catch (e2) {}
  return false;
}
// Thu hep tap SDT cua team: giu SDT duoc chia cho chinh Truong nhom + SDT co don (DT tong hoac du lieu don) trong cac thang duoc cap.
function _leadMonthFilterSet_(user, set, months) {
  var want = {}, out = {}, ownK = _leadOwnKeys_(user);
  months.forEach(function (m) { want[m] = 1; });
  var ai = _scopeAssignIndex_();
  Object.keys(ai).forEach(function (ph) { if (ai[ph].some(function (n) { return ownK[_normTxt_(n)] || ownK[_scopeNameKey_(n)]; })) out[ph] = 1; });
  function add(ph, date) { var k = normPhone_(String(ph || '')); if (k && set[k] && !out[k] && want[_ymOfOrderDate_(date)]) out[k] = 1; }
  try {
    var oc = _cacheGetBig_('orders_v1'), ords = null;
    if (oc) { try { ords = (JSON.parse(oc) || {}).orders; } catch (e0) {} }
    (ords || readAllOrders_() || []).forEach(function (o) { if (o) add(o.phone, o.date); });
  } catch (e1) { Logger.log('_leadMonthFilterSet_ orders: ' + e1); }
  try { readDonChiTiet_().forEach(function (r) { add(r.soDienThoai, r.ngayTaoDon); }); } catch (e2) { Logger.log('_leadMonthFilterSet_ don: ' + e2); }
  return out;
}
function _leadUser_(token) {
  var u = _sessUser_(token);
  if (!u) return { error: 'Phien dang nhap het han — dang nhap lai.', code: 'AUTH' };
  if (_roleBase_(u.role) !== 'leader') return { error: 'Chi tai khoan Truong nhom moi dung duoc muc nay.', code: 'FORBIDDEN' };
  return { user: u };
}
// Dot chia ghi ten khac cach viet (hoa/thuong, dau, khoang trang) hoac ten cung nguoi (the Khop sale / names tai khoan Sale) -> tra ve ten tuong ung trong `names`; khong khop -> ''.
// Cung tieu chi voi pham vi xem (_scopeSameNameKeys_), neu khong thi Truong nhom thay khach o Danh sach KH ma man "Data cua team" lai trong. Khop dung ten duoc xet truoc.
function _leadNameResolver_(names) {
  var map = {}, groups = {};
  function put(k, n) { if (k && !map[k]) map[k] = n; }
  names.forEach(function (n) { put(_normTxt_(n), n); });
  names.forEach(function (n) { put(_scopeNameKey_(n), n); });
  try { groups = _userAliasGroups_(); } catch (e) { Logger.log('_leadNameResolver_: ' + e); }
  names.forEach(function (n) { (groups[_normTxt_(n)] || []).forEach(function (x) { put(_normTxt_(x), n); put(_scopeNameKey_(x), n); }); });
  return function (cs) { return map[_normTxt_(cs)] || map[_scopeNameKey_(cs)] || ''; };
}
// Ten cua chinh Truong nhom, moi cach viet -> tra theo _normTxt_ / _scopeNameKey_.
function _leadOwnKeys_(user) {
  var own = _leadOwnNames_(user), o = {};
  Object.keys(own).forEach(function (k) { o[own[k]] = 1; });
  return _scopeSameNameKeys_(o);
}
function leadAssignInfo_(e) {
  var a = _leadUser_(e && e.parameter && e.parameter.token);
  if (a.error) return jsonOut_(a);
  var t = _leadTeam_(a.user);
  var own = Object.keys(t.own).map(function (k) { return t.own[k]; });
  var resolve = _leadNameResolver_(own.concat(t.members)), hist = [];
  readAssign_(getCrmSS_().getSheetByName(SH_ASSIGN)).forEach(function (h) {
    var n = resolve(h.csName);
    if (n) { h.csName = n; hist.push(h); }   // web so ten dot chia voi own/members -> tra ten da quy ve team
  });
  return jsonOut_({ ok: true, own: own, teams: t.teamNames, members: t.members, viewMonths: _leadMonths_(a.user), assignHistory: hist });
}
function leadAssign_(data) {
  var a = _leadUser_(data && data.token);
  if (a.error) return jsonOut_(a);
  var req = (data && Array.isArray(data.entries)) ? data.entries : [];
  if (!req.length) return jsonOut_({ error: 'Chua co data nao de chia.' });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return jsonOut_({ error: 'Dang co thao tac khac ghi du lieu chia, thu lai sau vai giay.' });
  try {
    var t = _leadTeam_(a.user), memberByKey = {};
    t.members.forEach(function (m) { memberByKey[_normTxt_(m)] = m; });
    var sh = getSheet_(SH_ASSIGN, ASSIGN_HEADERS), pool = {};
    var resolve = _leadNameResolver_(Object.keys(t.own).map(function (k) { return t.own[k]; }).concat(t.members));
    readAssign_(sh).forEach(function (h) {
      if (!t.own[_normTxt_(resolve(h.csName))]) return;
      (h.phones || []).forEach(function (p) { var k = normPhone_(String(p)); if (k) pool[k] = String(p); });
    });
    var used = {}, entries = [], total = 0;
    var date = Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd HH:mm');   // cung quy uoc UTC voi web (toISOString) de thu tu "moi nhat" dung
    var who = String(a.user.name || a.user.username || '');
    var label = String(data.label || '').trim().slice(0, 120);
    for (var i = 0; i < req.length; i++) {
      var name = memberByKey[_normTxt_((req[i] && req[i].csName) || '')];
      if (!name) return jsonOut_({ error: 'Nguoi nhan "' + String((req[i] && req[i].csName) || '') + '" khong thuoc team cua ban.', code: 'FORBIDDEN' });
      var phones = [];
      var list = Array.isArray(req[i].phones) ? req[i].phones : [];
      for (var j = 0; j < list.length; j++) {
        var k = normPhone_(String(list[j]));
        if (!k || !pool[k]) return jsonOut_({ error: 'Co SDT chua duoc chia cho ban nen khong chia lai duoc. Tai lai trang roi thu lai.', code: 'FORBIDDEN' });
        if (!used[k]) { used[k] = 1; phones.push(pool[k]); }
      }
      if (!phones.length) continue;
      total += phones.length;
      if (total > LEAD_ASSIGN_MAX_) return jsonOut_({ error: 'Moi lan chia toi da ' + LEAD_ASSIGN_MAX_ + ' khach.' });
      entries.push({ id: Date.now() + '_L' + i + Math.random().toString(36).slice(2, 6), date: date, csName: name, phones: phones,
                     label: 'Lead ' + who + ': ' + (label || 'Chia ' + phones.length + ' KH'), donePhones: [] });
    }
    if (!entries.length) return jsonOut_({ error: 'Chua co data nao de chia.' });
    var rows = [];
    entries.forEach(function (en) { rows = rows.concat(assignRowsOf_(en)); });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, ASSIGN_HEADERS.length).setValues(rows);
    return jsonOut_({ ok: true, entries: entries, total: total });
  } finally {
    lock.releaseLock();
  }
}
// Ghi de ca sheet AssignData chi danh cho admin. Tai khoan khac (web ban cu gui ca lich su khi bam "xong"): chi cap nhat
// donePhones cua cac dot chia dung ten minh, khong them/xoa dot nao. Khong co token: giu hanh vi cu.
// 2026-11-27: xoa DUNG cac dot chia theo id. NGUYEN NHAN GOC: web xoa 1 dot bang cach ghi de CA sheet AssignData bang ban tren may admin (saveAssignHistory),
// ban nay khong co dot Truong nhom vua chia lai / dot chia tu dong moi va giu tien do "da xong" cu -> mat du lieu cua nguoi khac. Quyen giong saveAssignHistory.
function deleteAssign_(data) {
  var u = (data && data.token) ? _sessUser_(data.token) : null;
  if (u && _roleBase_(u.role) !== 'admin') return jsonOut_({ error: 'Chi admin duoc xoa dot chia.', code: 'FORBIDDEN' });
  var ids = {}, n = 0;
  ((data && Array.isArray(data.ids)) ? data.ids : []).forEach(function (id) { id = String(id || '').trim(); if (id) { ids[id] = 1; n++; } });
  if (!n) return jsonOut_({ error: 'Thieu id dot chia can xoa.' });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return jsonOut_({ error: 'Dang co thao tac khac ghi du lieu chia, thu lai sau vai giay.' });
  try {
    var sh = getSheet_(SH_ASSIGN, ASSIGN_HEADERS), last = sh.getLastRow(), rows = [];
    if (last >= 2) sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r, i) { if (ids[String(r[0])]) rows.push(i + 2); });
    if (rows.length && sh.getMaxRows() - rows.length < 2) sh.insertRowsAfter(sh.getMaxRows(), 1);   // Sheets khong cho xoa het cac dong duoi tieu de
    // Xoa tu duoi len, gom cac dong lien nhau thanh 1 lan goi (dot chia lon nam tren nhieu dong).
    for (var e = rows.length - 1; e >= 0; ) {
      var s = e;
      while (s > 0 && rows[s - 1] === rows[s] - 1) s--;
      sh.deleteRows(rows[s], e - s + 1);
      e = s - 1;
    }
    return jsonOut_({ ok: true, deleted: rows.length });
  } finally {
    lock.releaseLock();
  }
}
function saveAssignHistoryGuarded_(data) {
  var u = (data && data.token) ? _sessUser_(data.token) : null;
  if (!u || _roleBase_(u.role) === 'admin') return saveAssignHistory_(data && data.history);
  var own = _leadOwnNames_(u), incoming = {};
  ((data && data.history) || []).forEach(function (h) { if (h && h.id && own[_normTxt_(h.csName)]) incoming[String(h.id)] = h; });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return jsonOut_({ error: 'Dang co thao tac khac ghi du lieu chia, thu lai sau vai giay.' });
  try {
    var changed = 0;
    readAssign_(getSheet_(SH_ASSIGN, ASSIGN_HEADERS)).forEach(function (h) {
      var n = incoming[String(h.id)];
      if (!n || !own[_normTxt_(h.csName)]) return;
      var done = n.donePhones || [];
      if (JSON.stringify(done.slice().sort()) === JSON.stringify((h.donePhones || []).slice().sort())) return;
      h.donePhones = done; saveAssignEntry_(h); changed++;
    });
    return jsonOut_({ ok: true, written: changed, doneOnly: true });
  } finally {
    lock.releaseLock();
  }
}

// ═══════════════════════════════════════════════════════════════
//  AI — Groq + AIContext
// ═══════════════════════════════════════════════════════════════
function readAIContext_() {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_CONTEXT);
  var result = {
    systemPrompt: '', careProcess: '', callbackScript: '',
    salesScriptCu: '', salesScriptMoi: '',
    products: [], faqs: [], combos: []
  };
  if (!sh || sh.getLastRow() < 2) return result;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    var type    = String(vals[i][0]||'').trim();
    var content = String(vals[i][1]||'').trim();
    if (!content) continue;
    if      (type === 'system_prompt')         result.systemPrompt   = content;
    else if (type === 'care_process')          result.careProcess    = content;
    else if (type === 'callback_script')       result.callbackScript = content;
    else if (type === 'sales_script_cu')       result.salesScriptCu  = content;
    else if (type === 'sales_script_moi')      result.salesScriptMoi = content;
    else if (type === 'product')               result.products.push(content);
    else if (type === 'faq')                   result.faqs.push(content);
    else if (type === 'combo_template')        result.combos.push(content);
  }
  return result;
}

// ─── XAC THUC TAI KHOAN (dung cho Pancake AI khi CS doi sang ten nguoi khac) ───────────
// Cung thuat toan voi _hashPass trong index.html: SHA-256(salt + matkhau) dang hex, salt moi
// 'CRM-CS-Portal::v9::salt' (co salt cu 'OME-...' de khong khoa tai khoan chua nang cap).
// Kiem tra o SERVER de extension khong can tai passHash ve may. Chong do mat khau: sai 5 lan
// trong 10 phut thi khoa tam tai khoan do (CacheService).
var _PW_SALT_ = 'CRM-CS-Portal::v9::salt';
var _PW_SALT_OLD_ = 'OME-CS-Portal::v9::salt';
function _pwHash_(pw, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + String(pw == null ? '' : pw), Utilities.Charset.UTF_8);
  return bytes.map(function(b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length < 2 ? '0' + v : v; }).join('');
}
function verifyLogin_(username, password) {
  var r = _checkLogin_(username, password);
  if (r.error) return jsonOut_({ ok: false, error: r.error });
  return jsonOut_({ ok: true, username: r.acct.username, role: r.acct.role || 'cs', name: r.acct.name || '' });
}

function saveAIContext_(type, content, context) {
  if (!type || !content) return jsonOut_({ error: 'Thieu type hoac content' });
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_CONTEXT);
  if (!sh) { sh = ss.insertSheet(SH_CONTEXT); sh.appendRow(['type','content','context','created']); }
  sh.appendRow([type, content, context||'', new Date().toISOString()]);
  return jsonOut_({ ok: true });
}


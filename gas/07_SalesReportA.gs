function getSalesReportOptions_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('srptOptions_v3');
  if (cached) { try { return JSON.parse(cached); } catch(ec) {} }
  var rows0 = readDTTong_();
  var saleSet = {}, kenhSet = {};
  for (var i0 = 0; i0 < rows0.length; i0++) {
    var salesList0 = splitMulti_(rows0[i0].saleBan, ',');
    for (var j0 = 0; j0 < salesList0.length; j0++) saleSet[salesList0[j0]] = true;
    if (rows0[i0].kenhBan) kenhSet[rows0[i0].kenhBan] = true;
  }
  var rowsB0 = readDonChiTiet_();
  var nguonSet = {}, marketerSet = {}, saleBSet = {};
  for (var iB0 = 0; iB0 < rowsB0.length; iB0++) {
    if (rowsB0[iB0].nguonDon) nguonSet[rowsB0[iB0].nguonDon] = true;
    if (rowsB0[iB0].marketer) marketerSet[rowsB0[iB0].marketer] = true;
    var saleBList0 = _donSaleNamesFromThe_(rowsB0[iB0].theSale);
    for (var jB0 = 0; jB0 < saleBList0.length; jB0++) saleBSet[saleBList0[jB0]] = true;
  }
  var srptOpt = {
    sale: Object.keys(saleSet).sort(), kenh: Object.keys(kenhSet).sort(),
    nguon: Object.keys(nguonSet).sort(), marketer: Object.keys(marketerSet).sort(),
    saleB: Object.keys(saleBSet).sort() // Sale rieng cua Bao cao B (cot "Thẻ" trong dữ liệu đơn)
  };
  try { cache.put('srptOptions_v3', JSON.stringify(srptOpt), 1800); } catch(ec) {}
  return srptOpt;
}

// "Đơn đổi" (doi hang) — giaTriDon van tinh doanh thu nhu binh thuong ("khong ship" — dung
// y voi nhan san co tren UI Bao cao A). Rieng cot "Gia tri chenh lech" (giaTriChenh, cot S)
// truoc gio CHUA duoc cong vao doanh thu o dau ca — sua: CONG THEM (khong thay the giaTriDon)
// phan chenh lech nay cho cac dong duoc phan loai la "doi hang", dung yeu cau "doanh thu =
// tong gia tri don khong ship + gia tri chenh lech cua don doi". Nhan dien don doi theo cot
// "Phan loai" chua tu "doi" (khong dau, khong phan biet hoa/thuong) — vd "Đơn đổi", "Đổi
// hàng"... deu khop; neu sheet dung 1 cum tu khac (khong chua "doi") thi dong do se khong
// duoc cong THEM phan chenh lech (van an toan, khong bi tru nham doanh thu that).
function _dtIsExchangeOrder_(phanLoai) {
  return _psheetNoAccent_(phanLoai).indexOf('doi') !== -1;
}
function _dtOrderRevenue_(m) {
  var extra = _dtIsExchangeOrder_(m.phanLoai) ? (m.giaTriChenh || 0) : 0;
  return m.giaTriDon + extra;
}

// ── Tỷ lệ chốt theo Sale / theo Kênh / theo Page — TACH DUNG CHUNG cho Bao cao A va B (2026-09).
// normRows: mang cac don DA CHUAN HOA ve 1 hinh dang chung {kenhBan, dateStr, saleBanRaw}, bat
// ke du lieu goc tu DT TONG (A) hay "du lieu don" (B). Noi dung ham nay la COPY NGUYEN VAN logic
// cu cua buildSalesReportA_ (chi doi ten bien mc[dateField]/mc.saleBan -> mc.dateStr/mc.saleBanRaw
// cho tong quat), KHONG duoc doi cong thuc khi sua — neu can doi cong thuc tinh ty le chot thi
// sua o day se anh huong CA Bao cao A lan B.
function _srCloseRateSections_(normRows, filters) {
  var UNASSIGNED = '(chưa gán sale)';
  var fFromYmd = _dateStrToVnYmd_(filters.dateFrom), fToYmd = _dateStrToVnYmd_(filters.dateTo);
  var pageCoveredDates = _pkTrackedDatesByPageAndSale_(fFromYmd, fToYmd).datesByPage;
  var hasAnyPkData = Object.keys(pageCoveredDates).length > 0;
  var pkPageMap = readPancakePageMap_(); // pageId -> kenhBan
  var kenhToPageIds = {};
  Object.keys(pkPageMap).forEach(function(pid) {
    var kn = pkPageMap[pid]; if (!kn) return;
    if (!kenhToPageIds[kn]) kenhToPageIds[kn] = [];
    kenhToPageIds[kn].push(pid);
  });
  function _srOrderCovered_(kenhBan, ymd){
    var pids = kenhToPageIds[kenhBan] || [];
    return pids.some(function(pid){ return pageCoveredDates[pid] && pageCoveredDates[pid][ymd]; });
  }

  var saleCloseRate = [];
  var closeFrom = '';
  if (hasAnyPkData) {
    var closeOrdersBySale = {};
    for (var ci = 0; ci < normRows.length; ci++) {
      var mc = normRows[ci];
      var mcDt = parseVNDate_(mc.dateStr);
      if (!mcDt) continue;
      var mcYmd = _vnYmd_(mcDt);
      if (!_srOrderCovered_(mc.kenhBan, mcYmd)) continue;
      if (!closeFrom || mcYmd < closeFrom) closeFrom = mcYmd;
      var salesOnOrderC = splitMulti_(mc.saleBanRaw, ',');
      if (!salesOnOrderC.length) salesOnOrderC = [UNASSIGNED];
      salesOnOrderC.forEach(function(sn) { closeOrdersBySale[sn] = (closeOrdersBySale[sn] || 0) + 1; });
    }
    var pInt2 = buildPancakeReport_(filters.dateFrom, filters.dateTo, 'equal');
    var closeCanon = {};
    var closeKey = function(n) { var ck = _normTxt_(n); if (!closeCanon[ck]) closeCanon[ck] = n; return ck; };
    var closeAgg = {};
    pInt2.byCS.forEach(function(r) { var k = closeKey(r.name); closeAgg[k] = { name: closeCanon[k], tongTT: r.tongTT || 0, orders: 0 }; });
    Object.keys(closeOrdersBySale).forEach(function(sn) {
      var k = closeKey(sn);
      if (!closeAgg[k]) closeAgg[k] = { name: closeCanon[k], tongTT: 0, orders: 0 };
      closeAgg[k].orders += closeOrdersBySale[sn];
    });
    saleCloseRate = Object.keys(closeAgg).map(function(k) {
      var r = closeAgg[k];
      return { name: r.name, held: Math.round(r.tongTT * 100) / 100, closed: r.orders,
               closeRate: r.tongTT ? Math.round(r.orders / r.tongTT * 1000) / 10 : 0 };
    });
  }

  var kenhCloseRate = [];
  if (hasAnyPkData) {
    var closeOrdersByKenh = {};
    for (var cki = 0; cki < normRows.length; cki++) {
      var mck = normRows[cki];
      var mckDt = parseVNDate_(mck.dateStr);
      if (!mckDt) continue;
      var mckYmd = _vnYmd_(mckDt);
      var kn = mck.kenhBan || '(chưa có kênh)';
      if (!_srOrderCovered_(kn, mckYmd)) continue;
      closeOrdersByKenh[kn] = (closeOrdersByKenh[kn] || 0) + 1;
    }
    var pInt3 = buildPancakeReport_(filters.dateFrom, filters.dateTo, 'equal');
    var tongTTByKenh = {};
    pInt3.byPage.forEach(function(p) {
      var kn2 = pkPageMap[p.pageId] || '';
      if (!kn2) return;
      tongTTByKenh[kn2] = (tongTTByKenh[kn2] || 0) + (p.tongTT || 0);
    });
    var allKenhKeys = {};
    Object.keys(closeOrdersByKenh).forEach(function(k){ allKenhKeys[k]=1; });
    Object.keys(tongTTByKenh).forEach(function(k){ allKenhKeys[k]=1; });
    kenhCloseRate = Object.keys(allKenhKeys).map(function(kn3) {
      var tongTTk = tongTTByKenh[kn3] || 0;
      var closedK = closeOrdersByKenh[kn3] || 0;
      return { name: kn3, held: Math.round(tongTTk * 100) / 100, closed: closedK,
               closeRate: tongTTk ? Math.round(closedK / tongTTk * 1000) / 10 : 0 };
    });
  }

  var saleCloseByPage = { pages: [], rows: [] };
  if (hasAnyPkData) {
    var mapSaleK = readPancakeMap_();
    var pageInfoByKenh = {};
    var ttBySaleKenh = {};
    var vPk = _pkStatsRowsMemo_();
    if (vPk.length) {
      for (var pki = 0; pki < vPk.length; pki++) {
        var dPk = normOrderDate_(vPk[pki][0]);
        if (fFromYmd && dPk < fFromYmd) continue;
        if (fToYmd && dPk > fToYmd) continue;
        var pageIdPk = String(vPk[pki][1]), pageNamePk = String(vPk[pki][2]), nhanVienPk = String(vPk[pki][3]), ttPk = +vPk[pki][6] || 0;
        if (!ttPk) continue;
        var kenhPk = pkPageMap[pageIdPk] || '';
        if (!kenhPk) continue;
        if (!pageInfoByKenh[kenhPk]) pageInfoByKenh[kenhPk] = { pageId: pageIdPk, pageName: pageNamePk, kenhBan: kenhPk };
        var salesPk = String(mapSaleK[nhanVienPk] || '').split('|').map(function(x){return x.trim();}).filter(function(x){return x;});
        if (!salesPk.length) salesPk = [nhanVienPk];
        salesPk.forEach(function(spn) {
          var key = spn + '|||' + kenhPk;
          ttBySaleKenh[key] = (ttBySaleKenh[key] || 0) + ttPk;
        });
      }
    }
    var closedBySaleKenh = {};
    for (var cpi = 0; cpi < normRows.length; cpi++) {
      var mcp = normRows[cpi];
      var mcpDt = parseVNDate_(mcp.dateStr);
      if (!mcpDt) continue;
      var mcpYmd = _vnYmd_(mcpDt);
      var kenhP = mcp.kenhBan || '(chưa có kênh)';
      if (!_srOrderCovered_(kenhP, mcpYmd)) continue;
      var salesOnP = splitMulti_(mcp.saleBanRaw, ',');
      if (!salesOnP.length) salesOnP = [UNASSIGNED];
      salesOnP.forEach(function(spn2) {
        var key2 = spn2 + '|||' + kenhP;
        closedBySaleKenh[key2] = (closedBySaleKenh[key2] || 0) + 1;
      });
    }
    var pagesList = Object.keys(pageInfoByKenh).map(function(k){ return pageInfoByKenh[k]; })
      .sort(function(a,b){ return a.pageName.localeCompare(b.pageName,'vi'); });
    var byPageSaleCanon = {}, byPageSaleKey = function(n){ var ck=_normTxt_(n); if(!byPageSaleCanon[ck]) byPageSaleCanon[ck]=n; return ck; };
    var rowsMap = {};
    function ensureRow(sn) {
      var k = byPageSaleKey(sn);
      if (!rowsMap[k]) rowsMap[k] = { name: byPageSaleCanon[k], perPage: {}, totalHeld: 0, totalClosed: 0 };
      return rowsMap[k];
    }
    Object.keys(ttBySaleKenh).forEach(function(key) {
      var parts = key.split('|||'), sn = parts[0], kn = parts[1];
      var r = ensureRow(sn);
      var held = ttBySaleKenh[key] || 0, closed = closedBySaleKenh[key] || 0;
      r.perPage[kn] = { held: Math.round(held*100)/100, closed: closed, rate: held ? Math.round(closed/held*1000)/10 : 0 };
      r.totalHeld += held; r.totalClosed += closed;
    });
    Object.keys(closedBySaleKenh).forEach(function(key) {
      var parts = key.split('|||'), sn = parts[0], kn = parts[1];
      var r = ensureRow(sn);
      if (!r.perPage[kn]) { r.perPage[kn] = { held: 0, closed: closedBySaleKenh[key], rate: 0 }; r.totalClosed += closedBySaleKenh[key]; }
    });
    saleCloseByPage.pages = pagesList;
    saleCloseByPage.rows = Object.keys(rowsMap).map(function(k) {
      var r = rowsMap[k];
      return { name: r.name, perPage: r.perPage,
        total: { held: Math.round(r.totalHeld*100)/100, closed: r.totalClosed,
                 rate: r.totalHeld ? Math.round(r.totalClosed/r.totalHeld*1000)/10 : 0 } };
    });
  }

  return { saleCloseRate: saleCloseRate, kenhCloseRate: kenhCloseRate, saleCloseByPage: saleCloseByPage, closeFrom: closeFrom || null };
}

// Trich pageId (so cuoi trong ngoac don o cuoi chuoi) tu cot "Nguồn đơn" cua Bao cao B, vd
// "Facebook / Hiền Phạm Tourmaline (862972056891669)" -> "862972056891669". Dong khong co ID
// dang nay (vd "Bảo hành", "Quầy Hào Nam", "Fb Phạm Thu Hiền" go tay khong theo chuan) tra ve
// chuoi rong — cac don nay se duoc thu khop tiep theo TEN Page qua _extractPageNameFromNguonDon_
// (xem buildSalesReportB_), chi thuc su bi bo qua neu CA 2 cach deu khong khop duoc Page nao.
function _extractPageIdFromNguonDon_(nguonDon) {
  var m = String(nguonDon || '').match(/\((\d+)\)\s*$/);
  return m ? m[1] : '';
}

// Trich TEN Page tu cot "Nguồn đơn" (du phong khi khong co ID kem theo, theo yeu cau Duyen
// 2026-10: khop "theo ten Page HOAC Id Page"). Bo tien to "Nen tang / " (neu co dau "/") va hau
// to "(ID)" o cuoi (neu co) — vd "Facebook / Hiền Tour Shop (678324468689325)" -> "Hiền Tour
// Shop"; "Quầy Hào Nam" (khong co "/" , khong co ID) -> giu nguyen "Quầy Hào Nam"; "Fb Phạm Thu
// Hiền" (khong co "/") -> giu nguyen ca chuoi. Dung ket hop voi readPancakePageMapByName_ de
// khop cac Page KHONG co ID Pancake thuc (vd quay ban truc tiep/kenh thu cong) MA admin da tu
// dien ten + "Kênh bán" tuong ung thang vao sheet PancakePageMap (pageId co the la gia tri tu
// dat, khong can trung voi ID Pancake thuc vi cot nay chi dung lam khoa duy nhat cua dong).
function _extractPageNameFromNguonDon_(nguonDon) {
  var t = String(nguonDon || '').trim();
  if (!t) return '';
  var nameOnly = t.replace(/\(\d+\)\s*$/, '').trim();
  var slashIdx = nameOnly.indexOf('/');
  if (slashIdx !== -1) nameOnly = nameOnly.slice(slashIdx + 1).trim();
  return nameOnly;
}

function buildSalesReportA_(filters) {
  filters = filters || {};
  var dateField = filters.dateField === 'thoiGianHT' ? 'thoiGianHT' : 'ngayTao';
  var saleFilterArr = Array.isArray(filters.sale) ? filters.sale.filter(function(s){return s;})
    : (filters.sale ? [String(filters.sale).trim()] : []);
  var kenhFilterArr = Array.isArray(filters.kenh) ? filters.kenh.filter(function(s){return s;})
    : (filters.kenh ? [String(filters.kenh).trim()] : []);
  var sanPhamTerms = _foldTermsCSV_(filters.sanPham);
  // Tich UI "Tinh theo nguoi tao don": KHONG chia deu doanh thu/so don cho tung sale tren don
  // nua, ma tinh TRON VEN cho DUNG 1 nguoi — lay tu cot "Người tạo" that su cua DT TONG (khac
  // voi "Sale bán", co the co nhieu ten). Bo tich (mac dinh): giu nguyen cach chia deu cu.
  var byCreator = !!filters.byCreator;

  var rows = readDTTong_();
  var matched = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var dt = parseVNDate_(row[dateField]);
    if (!dateInRange_(dt, filters.dateFrom, filters.dateTo)) continue;
    if (_isExcludedOrderStatus_(row.trangThai)) continue; // bo don Huy/Tra lai/Hoan tien/Thai bai/Khieu nai (Quy che thu lao Sale)
    if (kenhFilterArr.length && kenhFilterArr.indexOf(row.kenhBan) === -1) continue;
    var salesOnOrder = splitMulti_(row.saleBan, ',');
    if (saleFilterArr.length && !salesOnOrder.some(function(s){ return saleFilterArr.indexOf(s) !== -1; })) continue;
    if (!_pMatchAny_(row.sanPham, sanPhamTerms)) continue;
    matched.push(row);
  }

  // Tong chung: tinh du gia tri 1 lan, KHONG chia theo sale
  var totalCoc = 0, totalGiaTri = 0, totalGiaTriChenh = 0;
  var bySale = {}; // ten sale -> { orders, coc, giaTri }
  var byKenh = {}; // ten kenh -> { orders, coc, giaTri }
  var UNASSIGNED = '(chưa gán sale)';

  // Team Sale: sale -> ten team (readTeams_ dung chung voi tab "Quan ly Team")
  var saleTeamMap = {}; // ten sale (username) -> ten team
  readTeams_(getCrmSS_().getSheetByName(SH_TEAM)).forEach(function(t) {
    (t.members || []).forEach(function(u) { saleTeamMap[u] = t.name; });
  });
  var UNASSIGNED_TEAM = '(chưa có Team)';
  var byTeamSale = {};

  for (var j = 0; j < matched.length; j++) {
    var m = matched[j];
    var revenue = _dtOrderRevenue_(m);
    if (_dtIsExchangeOrder_(m.phanLoai)) totalGiaTriChenh += (m.giaTriChenh || 0);
    totalCoc += m.giaTriCoc;
    totalGiaTri += revenue;

    // breakdown theo kenh: kenh la single-value, khong chia
    var kName = m.kenhBan || '(chưa có kênh)';
    if (!byKenh[kName]) byKenh[kName] = { orders: 0, coc: 0, giaTri: 0 };
    byKenh[kName].orders += 1;
    byKenh[kName].coc += m.giaTriCoc;
    byKenh[kName].giaTri += revenue;

    // breakdown theo sale:
    // - Mac dinh: so don GIU NGUYEN (khong chia), phan tien CHIA DEU cho N sale tren don.
    // - byCreator: ca so don LAN tien tinh TRON VEN cho DUNG 1 nguoi — nguoi duoc ghi trong cot
    //   "Người tạo" that su cua DT TONG (KHONG phai ten dau tien trong "Sale bán").
    if (byCreator) {
      var creatorName = m.nguoiTao || UNASSIGNED;
      if (!bySale[creatorName]) bySale[creatorName] = { orders: 0, coc: 0, giaTri: 0 };
      bySale[creatorName].orders += 1;
      bySale[creatorName].coc += m.giaTriCoc;
      bySale[creatorName].giaTri += revenue;

      var creatorTeam = saleTeamMap[creatorName] || UNASSIGNED_TEAM;
      if (!byTeamSale[creatorTeam]) byTeamSale[creatorTeam] = { orders: 0, coc: 0, giaTri: 0 };
      byTeamSale[creatorTeam].orders += 1;
      byTeamSale[creatorTeam].coc += m.giaTriCoc;
      byTeamSale[creatorTeam].giaTri += revenue;
    } else {
      var salesList = splitMulti_(m.saleBan, ',');
      if (salesList.length === 0) salesList = [UNASSIGNED];
      var n = salesList.length;
      // So don theo Team: dem 1 lan cho moi TEAM KHAC NHAU xuat hien tren don (tranh 1 don co
      // 2 sale CUNG team bi dem 2 lan); tien van chia deu theo tung sale nhu bySale.
      var teamsOnOrder = {};
      for (var k = 0; k < salesList.length; k++) {
        var sName = salesList[k];
        if (!bySale[sName]) bySale[sName] = { orders: 0, coc: 0, giaTri: 0 };
        bySale[sName].orders += 1;                 // so don: khong chia
        bySale[sName].coc += m.giaTriCoc / n;       // tien: chia deu cho N sale
        bySale[sName].giaTri += revenue / n;

        var tName = saleTeamMap[sName] || UNASSIGNED_TEAM;
        if (!byTeamSale[tName]) byTeamSale[tName] = { orders: 0, coc: 0, giaTri: 0 };
        byTeamSale[tName].coc += m.giaTriCoc / n;
        byTeamSale[tName].giaTri += revenue / n;
        teamsOnOrder[tName] = true;
      }
      Object.keys(teamsOnOrder).forEach(function(tName2) { byTeamSale[tName2].orders += 1; });
    }
  }

  function toArr(obj) {
    var arr = [];
    for (var key in obj) {
      arr.push({ name: key, orders: obj[key].orders, coc: obj[key].coc, giaTri: obj[key].giaTri,
                 trungBinhDon: obj[key].orders ? Math.round(obj[key].giaTri / obj[key].orders) : 0 });
    }
    arr.sort(function(a, b){ return b.giaTri - a.giaTri; });
    return arr;
  }

  // Theo MKT: kenh ban -> Page (PancakePageMap) -> nhom MKT (MktTeams). Kenh chua gan MKT -> "(chưa gán MKT)".
  // Page chay chung nhieu MKT: so don/tien chia theo ty le 'share' da chuan hoa.
  var kenhW = _mktKenhWeights_(readMktTeams_(), readPancakePageMap_());
  var byMktObj = {};
  Object.keys(byKenh).forEach(function(kn) {
    var ws = kenhW[kn] || [{ id: '_none', name: '(chưa gán MKT)', w: 1 }];
    ws.forEach(function(x) {
      if (!byMktObj[x.name]) byMktObj[x.name] = { orders: 0, coc: 0, giaTri: 0 };
      byMktObj[x.name].orders += byKenh[kn].orders * x.w;
      byMktObj[x.name].coc += byKenh[kn].coc * x.w;
      byMktObj[x.name].giaTri += byKenh[kn].giaTri * x.w;
    });
  });
  var byMktArr = Object.keys(byMktObj).map(function(k) {
    var o = byMktObj[k];
    return { name: k, orders: Math.round(o.orders * 100) / 100, coc: Math.round(o.coc), giaTri: Math.round(o.giaTri),
             trungBinhDon: o.orders ? Math.round(o.giaTri / o.orders) : 0 };
  }).sort(function(a, b){ return b.giaTri - a.giaTri; });

  // ── Tỷ lệ chốt theo Sale / theo Kênh / theo Page — dùng hàm chung _srCloseRateSections_
  // (tách 2026-09 để Báo cáo B dùng lại cùng công thức). Chuẩn hoá "matched" (DT TỔNG) về hình
  // dạng chung {kenhBan, dateStr, saleBanRaw} rồi gọi — nội dung/công thức giữ NGUYÊN VẸN như cũ.
  var normRowsA_ = matched.map(function(mc) {
    return { kenhBan: mc.kenhBan, dateStr: mc[dateField], saleBanRaw: mc.saleBan };
  });
  var closeSectionsA_ = _srCloseRateSections_(normRowsA_, filters);
  var saleCloseRate = closeSectionsA_.saleCloseRate;
  var kenhCloseRate = closeSectionsA_.kenhCloseRate;
  var saleCloseByPage = closeSectionsA_.saleCloseByPage;
  var closeFrom = closeSectionsA_.closeFrom;

  return {
    totalOrders: matched.length,
    totalCoc: totalCoc,
    totalGiaTri: totalGiaTri,
    totalGiaTriChenh: totalGiaTriChenh,
    bySale: toArr(bySale),
    byKenh: toArr(byKenh),
    byTeamSale: toArr(byTeamSale),
    byMkt: byMktArr,
    saleCloseRate: saleCloseRate,
    saleCloseRateFrom: closeFrom || null,
    kenhCloseRate: kenhCloseRate,
    kenhCloseRateFrom: closeFrom || null,
    saleCloseByPage: saleCloseByPage,
    trungBinhDon: matched.length ? Math.round(totalGiaTri / matched.length) : 0,
    orders: matched.map(function(m){
      return {
        ngayTao: m.ngayTao, thoiGianHT: m.thoiGianHT, kenhBan: m.kenhBan,
        saleBan: m.saleBan, sanPham: m.sanPham, phanLoai: m.phanLoai,
        giaTriCoc: m.giaTriCoc, giaTriDon: m.giaTriDon, giaTriChenh: m.giaTriChenh,
        giaiDoan: m.giaiDoan, trangThai: m.trangThai, id: m.id
      };
    })
  };
}


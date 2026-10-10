function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = p.action || '';
  if (action === 'getSetting' && _isSensitiveSettingKey_(p.key)) return jsonOut_({ value: null });
  if (action === 'getGasSource' && !_adminKeyOk_(p.adminKey)) return jsonOut_({ error: 'Can khoa quan tri (adminKey) de lay ma nguon GAS.' });
  if (p.demo) {
    if (!_demoTokenOk_(p.demo)) return jsonOut_({ error: 'Phien tai khoan test khong hop le — dang nhap lai.' });
    if (DEMO_ALLOWED_GET_[action] !== 1) return jsonOut_({ error: 'Tai khoan test khong duoc phep thao tac nay.' });
    return _demoClip_(doGetCore_(e), action);
  }
  return doGetCore_(e);
}

// ═══════════════════════════════════════════════════════════════
//  doGet
// ═══════════════════════════════════════════════════════════════
function doGetCore_(e) {
  try {
    var ss = getCrmSS_();
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';

    // ── lookup theo phone (ZaloAI extension) ──
    // donOrdersByPhone: cac don POS (sheet 'du lieu don') cua 1 SDT -- Sasum dung cho muc "Lich su dat hang": KH da co don Pos thi
    // chi hien don Pos (Pos la chuan; don len Base cung da co tren Pos), BO QUA don Base. Moi don: ngay ISO, san pham, doanh thu sau giam, nguon...
    if (action === 'donOrdersByPhone') {
      var phDo = (e && e.parameter && e.parameter.phone) ? String(e.parameter.phone) : '';
      if (!phDo) return jsonOut_({ ok: false, error: 'Thieu phone' });
      return jsonOut_({ ok: true, orders: getDonOrdersByPhone_(phDo) });
    }
    // cskhDetail: CHI chi tiet CSKH-Duyen cua 1 SDT (Sasum tab Tong quan, lazy khi CS mo ho so).
    // Nhe hon 'lookup' rat nhieu: KHONG doc CareData/Orders, chi findCskhRowsByPhone_ (index SDT + vai dong). Cache 60s theo SDT.
    if (action === 'cskhDetail') {
      var phCk = (e && e.parameter && e.parameter.phone) ? String(e.parameter.phone) : '';
      if (!phCk) return jsonOut_({ ok: false, error: 'Thieu phone' });
      var cacheCk = CacheService.getScriptCache();
      var cKeyCk = 'ckd_' + normPhone_(phCk);
      var hitCk = cacheCk.get(cKeyCk);
      if (hitCk) { try { return jsonOut_(JSON.parse(hitCk)); } catch (eh) {} }
      var resCk = { ok: true, cskh: findCskhRowsByPhone_(phCk) };
      try { cacheCk.put(cKeyCk, JSON.stringify(resCk), 60); } catch (ep) {}
      return jsonOut_(resCk);
    }
    if (action === 'lookup') {
      var phone = (e && e.parameter && e.parameter.phone) ? String(e.parameter.phone) : '';
      if (!phone) return jsonOut_({ error: 'Thieu phone' });
      var cache = CacheService.getScriptCache();
      var cKey = 'lk_' + normPhone_(phone);
      var cached = cache.get(cKey);
      if (cached) { try { return jsonOut_(JSON.parse(cached)); } catch(ec) {} }
      var res = { ok: true, care: findCareByPhone_(phone), orders: readOrdersByPhone_(phone), cskh: findCskhRowsCached_(phone), don: findDonRowsByPhone_(phone) };
      try { cache.put(cKey, JSON.stringify(res), 15); } catch(ec) {}
      return jsonOut_(res);
    }

    // ── danh sach KH + trang thai CS (appweb + extension) ──
    if (action === 'customers') {
      var sinceC = (e && e.parameter && e.parameter.since) ? String(e.parameter.since) : '';
      if (sinceC) {
        var sbDlt = sbReadCareDelta_(sinceC);   // Supabase buoc 4e-1; undefined = doc Sheets nhu cu, null = qua nhieu thay doi -> keo FULL
        var dlt = sbDlt !== undefined ? sbDlt : readCareDelta_(ss.getSheetByName(SH_CARE), sinceC);
        if (dlt) return jsonOut_(dlt);   // chi cac dong doi (khong kem careStatus — client lay o lan keo FULL)
      }
      var cache2 = CacheService.getScriptCache();
      var cKey2  = 'customers_v12';
      var cached2 = cache2.get(cKey2);
      if (cached2) { try { return jsonOut_(JSON.parse(cached2)); } catch(ec) {} }
      var sbAllRows = sbReadCareAll_();   // Supabase buoc 4e-2; undefined = doc Sheets nhu cu
      var res2 = { rows: sbAllRows !== undefined ? sbAllRows : readCare_(ss.getSheetByName(SH_CARE)), careStatus: readCareStatus_(ss) };
      try { cache2.put(cKey2, JSON.stringify(res2), 300); } catch(ec) {}
      return jsonOut_(res2);
    }

    if (action === 'orders') {
      // TOI UU (v13.20): NGUYEN NHAN GOC cham — action nay doc NGUYEN sheet DT TONG moi lan, khong cache, ma moi tab CRM dang mo
      // keo no dinh ky -> N CS = N lan doc toan sheet moi chu ky. Nay cache 45s (_cachePutBig_ chia manh, vuot gioi han 100KB/key);
      // xoa ngay khi CRM ghi DT TONG (patchOrder_/deleteOrder_/deleteDuplicateOrders_/dedup/import). Sua tay tren Sheet: toi da 45s.
      // KHONG cache khi co dong loi doc (de lan sau thu lai + app tiep tuc canh bao).
      var _ordCached = _cacheGetBig_('orders_v1');
      if (_ordCached) { try { return jsonOut_(JSON.parse(_ordCached)); } catch (ecOrd) {} }
      var _ordersOut = readAllOrders_();
      var _ordersResp = { orders: _ordersOut };
      // Neu co dong bi loi khi doc, bao ve ngoai response (khong chi nam trong Logger.log noi
      // bo) de app hien canh bao ro rang thay vi am tham coi so dong doc duoc la toan bo su that.
      if (readAllOrders_.lastErrorCount) {
        _ordersResp.errorCount = readAllOrders_.lastErrorCount;
        _ordersResp.errorSample = readAllOrders_.lastErrorSample;
      } else {
        try { _cachePutBig_('orders_v1', JSON.stringify(_ordersResp), 45); } catch (ecOrd2) {}
      }
      return jsonOut_(_ordersResp);
    }
    if (action === 'teams')     return jsonOut_({ teams: readTeams_(ss.getSheetByName(SH_TEAM)) });
    if (action === 'mktTeams')  return jsonOut_({ teams: readMktTeams_() });
    if (action === 'users')     return jsonOut_({ users: readUsers_(ss.getSheetByName(SH_USER)) });
    // ── Bao cao Pancake (nhap tu file Excel "Thong ke tuong tac") ──
    if (action === 'pancakeNameMap') return jsonOut_({ map: readPancakeMap_(), allNames: pancakeAllNames_() });
    if (action === 'pancakeReport')  return jsonOut_(buildPancakeReport_(e.parameter.from, e.parameter.to, e.parameter.split));
    // ── Bao cao SDT mang ve/don chot Pancake (nhap tu file "Thong ke nhan vien") ──
    if (action === 'pancakeSdtReport') return jsonOut_(buildPancakeSdtReport_(e.parameter.from, e.parameter.to, e.parameter.split));
    // ── Khop Page Pancake (pageId) <-> Kenh ban chuan trong DT TONG ──
    if (action === 'pancakePageMap') return jsonOut_({ map: readPancakePageMap_(), allPages: pancakeAllPages_() });
    // ── Bao cao KPI tong hop (DT TONG + Pancake tuong tac + SDT) ──
    if (action === 'kpiReport') {
      var pKpiSale = (e.parameter.sale || '').split(',').map(function(s){return s.trim();}).filter(function(s){return s;});
      return jsonOut_(buildKpiReport_(e.parameter.from, e.parameter.to, pKpiSale));
    }
    if (action === 'saleDirectory') return jsonOut_(readSaleDirectory_());
    if (action === 'saleGroups') return jsonOut_({ ok: true, groups: readSaleGroups_() });
    // ── Nguon "Cham soc" (KH them nhanh, sheet rieng) — khong gop CareData/bao cao A-B-C ──
    if (action === 'careLeads') return jsonOut_({ rows: readCareLeads_() });
    // ── Nguon "CSKH-Duyên" (sheet thu 3, cung file DT TONG) — CRM gop vao khach theo SDT, xem readCskhDuyen_ ──
    if (action === 'cskhDuyen') { var rowsCk = readCskhDuyen_(); return jsonOut_({ ok: true, found: rowsCk.found, rows: rowsCk.rows, total: rowsCk.total, noPhone: rowsCk.noPhone, noPhoneSample: rowsCk.noPhoneSample, cols: rowsCk.cols }); }
    // Ban NHE cho FE keo hang loat (xem readCskhDuyenLite_) — FE da goi action nay tu truoc
    // nhung backend truoc day CHUA CO handler, khien danh sach CSKH-Duyên khong len duoc tren CRM.
    if (action === 'cskhDuyenLite') {
      var liteCk = readCskhDuyenLite_();
      return jsonOut_({ ok: true, found: liteCk.found, rows: liteCk.rows, total: liteCk.total, noPhone: liteCk.noPhone, noPhoneSample: liteCk.noPhoneSample });
    }
    // ── Tap SDT co trong "dữ liệu đơn" — chi de loc nguon o man hinh chinh (cache 10') ──
    // Danh sach san pham (ma + ten) trong "du lieu don" cho o tim/tick san pham cua Chuong trinh thuong (cache 10').
    if (action === 'donProducts') {
      var cachedDPr = _cacheGetBig_('don_products_v1');
      if (cachedDPr) { try { return jsonOut_(JSON.parse(cachedDPr)); } catch (ecP) {} }
      var resDPr = { ok: true, products: buildDonProducts_() };
      try { _cachePutBig_('don_products_v1', JSON.stringify(resDPr), 600); } catch (ecP2) {}
      return jsonOut_(resDPr);
    }
    if (action === 'donPhones') {
      // TOI UU (v13.20): NGUYEN NHAN GOC cham — (1) goi readDonChiTiet_() NAM LAN (moi ham getDon*_ tu doc lai, tuc 5 lan
      // JSON.parse mang don lon, hoac 5 lan doc sheet khi cache 'donChiTiet_v4' het han); (2) cache.put 1 key duy nhat bi gioi han
      // 100KB nen payload nay (5 map theo SDT) gan nhu chac chan THAT BAI AM THAM -> khong bao gio duoc cache. Nay doc 1 LAN roi
      // truyen rows vao 5 ham, va cache qua _cachePutBig_ (chia manh) TTL 90s bang dung TTL cua 'donChiTiet_v4' (xoa cung luc, xem 'don_phones_v6_n').
      var cachedDP = _cacheGetBig_('don_phones_v6');
      if (cachedDP) { try { return jsonOut_(JSON.parse(cachedDP)); } catch(ec) {} }
      var rowsDP = readDonChiTiet_();
      var resDP = { phones: readDonPhones_(rowsDP), saleByPhone: getDonSaleByPhone_(rowsDP), orderCountByPhone: getDonOrderCountByPhone_(rowsDP), lastDateByPhone: getDonLastDateByPhone_(rowsDP), statsByPhone: getDonStatsByPhone_(rowsDP) };
      try { _cachePutBig_('don_phones_v6', JSON.stringify(resDP), 90); } catch(ec) {}
      return jsonOut_(resDP);
    }

    // ── Tra cuu bang gia (Sheet DANH_MUC, file rieng PRICE_SS_ID) — dung chung cho
    // portal/Sasum/Pancake. Tim khong dau, khop tren MOI cot dang text cua sheet, khong
    // can biet truoc ten cot (tu doc dong tieu de dong 1). ──
    if (action === 'priceSearch') {
      var q = (e && e.parameter && e.parameter.q) ? String(e.parameter.q) : '';
      var cachePS = CacheService.getScriptCache();
      var cKeyPS = 'price_catalog_v4';
      var cachedPS = cachePS.get(cKeyPS);
      var rowsPS;
      if (cachedPS) { try { rowsPS = JSON.parse(cachedPS); } catch(ec) {} }
      if (!rowsPS) {
        rowsPS = readPriceCatalog_();
        try { cachePS.put(cKeyPS, JSON.stringify(rowsPS), 600); } catch(ec) {} // cache 10 phut, sheet gia it doi
      }
      var matched = q ? searchPriceCatalog_(rowsPS, q) : rowsPS.slice(0, 50);
      return jsonOut_({ ok: true, total: rowsPS.length, count: matched.length, rows: matched });
    }

    // ── Tra cuu CHUONG TRINH KHUYEN MAI (Sheet CTKM, cung file PRICE_SS_ID voi DANH_MUC) —
    // tra cuu TRUC TIEP theo tu khoa (giong het co che priceSearch o tren, dung lai
    // searchPriceCatalog_ vi ham do khong hardcode ten cot/sheet), KHONG qua AI — de dung duoc
    // ngay ca khi cac API AI (Groq/Cerebras/Gemini/OpenRouter) dang loi (yeu cau Duyen 26/09/2026).
    if (action === 'ctkmSearch') {
      var qCT = (e && e.parameter && e.parameter.q) ? String(e.parameter.q) : '';
      var cacheCT = CacheService.getScriptCache();
      var cKeyCT = 'ctkm_search_catalog_v1'; // key rieng, KHONG trung voi 'ctkm_catalog_v1' cua action ctkmCatalog (dung _cacheGetBig_/_cachePutBig_ khac co che)
      var cachedCT = cacheCT.get(cKeyCT);
      var rowsCT;
      if (cachedCT) { try { rowsCT = JSON.parse(cachedCT); } catch(ec) {} }
      if (!rowsCT) {
        rowsCT = readCTKMCatalog_();
        try { cacheCT.put(cKeyCT, JSON.stringify(rowsCT), 600); } catch(ec) {} // cache 10 phut, CTKM it doi
      }
      var matchedCT = qCT ? searchPriceCatalog_(rowsCT, qCT) : rowsCT.slice(0, 50);
      return jsonOut_({ ok: true, total: rowsCT.length, count: matchedCT.length, rows: matchedCT });
    }

    // ── TIM ANH SAN PHAM (cot "Link ảnh sản phẩm" CS da dien san trong DANH_MUC, chua link
    // Google Drive) — theo yeu cau Duyen 30/09/2026: thu hep dan giong "Soan don" (Nhom SP ->
    // Ten SP -> Kieu/Size -> Chat lieu, deu co the bo trong) de tim dung bien the, thay vi chi
    // go ten tu do roi doan dai nhat (de nham khi 1 ten co nhieu Size/Chat lieu khac anh nhau).
    if (action === 'productImageFlat') {
      var cacheKeyPIF = 'product_img_flat_v1';
      var cachePIF = CacheService.getScriptCache();
      var cachedPIF = cachePIF.get(cacheKeyPIF);
      if (cachedPIF) { try { return jsonOut_(JSON.parse(cachedPIF)); } catch (ecPIF) {} }
      var resultPIF = buildProductImageFlat_();
      try { if (resultPIF.ok) cachePIF.put(cacheKeyPIF, JSON.stringify(resultPIF), 600); } catch (ecPIF2) {} // cache 10 phut
      return jsonOut_(resultPIF);
    }
    if (action === 'driveImageFromLink') {
      var linkParam = (e && e.parameter && e.parameter.link) ? String(e.parameter.link) : '';
      return jsonOut_(driveImageFromLinkAction_(linkParam));
    }

    // ── CHECKLIST CHAT LUONG TIN NHAN MKT (tab "Checklist MKT" tren index.html) ──
    if (action === 'mktChecklist') return jsonOut_(buildMktChecklistReport_(e.parameter.from, e.parameter.to));

    // ─── Danh muc PHANG cho "Soan don" (Pancake AI): tra cuu theo ten -> dropdown thu hep dan ───
    if (action === 'priceCatalogFlat') {
      var flatJson = _cacheGetBig_('price_flat_v3');
      if (!flatJson) {
        flatJson = JSON.stringify(buildPriceCatalogFlat_());
        _cachePutBig_('price_flat_v3', flatJson, 600); // cache 10 phut, sheet gia it doi
      }
      return ContentService.createTextOutput(flatJson).setMimeType(ContentService.MimeType.JSON);
    }
    // ─── CTKM (Sheet CTKM, cung file PRICE_SS_ID, nam canh sheet DANH_MUC) cho "Soan don" cua
    // Pancake AI: tra ve NGUYEN VAN toan bo dong (khong loc theo tu khoa nhu readCTKMPromotions_,
    // vi o day CS can XEM DUOC het cac CTKM dang co de tu doi chieu, khong phai dang hoi AI).
    // Cache 10 phut, giong het cach lam voi bang gia — CTKM cung it doi trong ngay. ──
    if (action === 'ctkmCatalog') {
      var ctkmJson = _cacheGetBig_('ctkm_catalog_v1');
      if (!ctkmJson) {
        ctkmJson = JSON.stringify({ ok: true, rows: readCTKMCatalog_() });
        _cachePutBig_('ctkm_catalog_v1', ctkmJson, 600);
      }
      return ContentService.createTextOutput(ctkmJson).setMimeType(ContentService.MimeType.JSON);
    }
    // ─── Cay Nhom SP → Ten SP → Kieu/Size (ban cu, giu tuong thich) ───
    if (action === 'priceCatalogTree') {
      var treeJson = _cacheGetBig_('price_tree_v4');
      if (!treeJson) {
        treeJson = JSON.stringify(buildPriceCatalogTree_());
        _cachePutBig_('price_tree_v4', treeJson, 600);
      }
      return ContentService.createTextOutput(treeJson).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'audit') {
      var shA = ss.getSheetByName(SH_AUDIT); var auditRows = [];
      if (shA && shA.getLastRow() > 1) {
        var lastA = shA.getLastRow();
        var nA = Math.min(200, lastA - 1);
        var vA = shA.getRange(lastA - nA + 1, 1, nA, 6).getValues();
        for (var ai = vA.length - 1; ai >= 0; ai--) {
          auditRows.push({ timestamp: vA[ai][0], user: vA[ai][1], action: vA[ai][2],
            phone: vA[ai][3], oldValue: vA[ai][4], newValue: vA[ai][5] });
        }
      }
      return jsonOut_({ audit: auditRows });
    }

    if (action === 'dashboard') return jsonOut_(buildDashboard_());

    // ── Bao cao doanh so CRM moi (nguon: Google Sheet "DT tong" goc) ──
    if (action === 'salesReportA') {
      var pA = e.parameter || {};
      var fA = { dateFrom: pA.dateFrom || '', dateTo: pA.dateTo || '',
                 dateField: pA.dateField || 'ngayTao',
                 sale: pA.sale ? pA.sale.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
                 kenh: pA.kenh ? pA.kenh.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
                 sanPham: pA.sanPham || '',
                 byCreator: pA.byCreator === '1' || pA.byCreator === 'true' };
      var cacheA = CacheService.getScriptCache();
      var cKeyA = 'salesA_' + JSON.stringify(fA);
      var cachedA = cacheA.get(cKeyA);
      if (cachedA) { try { return jsonOut_(JSON.parse(cachedA)); } catch(ec) {} }
      var resA = buildSalesReportA_(fA);
      try { cacheA.put(cKeyA, JSON.stringify(resA), 120); } catch(ec) {}
      return jsonOut_(resA);
    }
    if (action === 'teamAnalysis') return teamAnalysis_(e.parameter || {});
    if (action === 'saleKpiReport') {
      var pF = e.parameter || {};
      var fF = { dateFrom: pF.dateFrom || '', dateTo: pF.dateTo || '',
                 dateField: pF.dateField || 'ngayTao',
                 sale: pF.sale ? pF.sale.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
                 kenh: pF.kenh ? pF.kenh.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
                 sanPham: pF.sanPham || '', byCreator: false };
      return jsonOut_(buildSaleKpiReport_(fF));
    }
    // ── BAO CAO G: Don bi loai (Huy/Da hoan/Dang hoan/Hoan tien...) — NGUON POS ("dữ liệu đơn"), cung bo loc voi B ──
    // SUA 2026-10-03 theo yeu cau Duyen: G truoc doc "DT TỔNG " (Base) nen so don bi loai lech voi E/F (da Pos).
    if (action === 'failedOrderReport') {
      var pG = e.parameter || {};
      var splitG_ = function(s){ return s ? s.split(',').map(function(x){return x.trim();}).filter(function(x){return x;}) : []; };
      var fG = { dateFrom: pG.dateFrom || '', dateTo: pG.dateTo || '',
                 sale: splitG_(pG.sale), nguon: splitG_(pG.nguon), marketer: splitG_(pG.marketer),
                 sanPham: pG.sanPham || '' };
      var cacheG = CacheService.getScriptCache();
      var cKeyG = 'salesG_pos3_' + JSON.stringify(fG);
      var cachedG = cacheG.get(cKeyG);
      if (cachedG) { try { return jsonOut_(JSON.parse(cachedG)); } catch(ec) {} }
      var resG = buildFailedOrderReport_(fG);
      try { cacheG.put(cKeyG, JSON.stringify(resG), 120); } catch(ec) {}
      return jsonOut_(resG);
    }
    if (action === 'salesReportB') {
      var pB = e.parameter || {};
      var splitCSV_ = function(s){ return s ? s.split(',').map(function(x){return x.trim();}).filter(function(x){return x;}) : []; };
      var fB = { dateFrom: pB.dateFrom || '', dateTo: pB.dateTo || '',
                 sale: splitCSV_(pB.sale), nguon: splitCSV_(pB.nguon), marketer: splitCSV_(pB.marketer),
                 sanPham: pB.sanPham || '',
                 careStatus: splitCSV_(pB.careStatus), khStatus: splitCSV_(pB.khStatus),
                 zaloStatus: splitCSV_(pB.zaloStatus), nickZalo: pB.nickZalo || '' };
      var cacheB = CacheService.getScriptCache();
      var cKeyB = 'salesB4_' + JSON.stringify(fB);
      var cachedB = cacheB.get(cKeyB);
      if (cachedB) { try { return jsonOut_(JSON.parse(cachedB)); } catch(ec) {} }
      var resB = buildSalesReportB_(fB);
      try { cacheB.put(cKeyB, JSON.stringify(resB), 120); } catch(ec) {}
      return jsonOut_(resB);
    }
    // So lieu ca nhan cua 1 CS cho extension Pancake AI (chi doc) — xem buildCsStats_.
    if (action === 'csStats') {
      var pCs = e.parameter || {};
      var cacheCs = CacheService.getScriptCache();
      var cKeyCs = 'csStats1_' + (pCs.cs || '') + '|' + (pCs.dateFrom || '') + '|' + (pCs.dateTo || '');
      try { var cachedCs = cacheCs.get(cKeyCs); if (cachedCs) return jsonOut_(JSON.parse(cachedCs)); } catch(ecs) {}
      var resCs = buildCsStats_(pCs.cs, pCs.dateFrom, pCs.dateTo);
      if (resCs && resCs.ok) { try { cacheCs.put(cKeyCs, JSON.stringify(resCs), 90); } catch(ecs2) {} }
      return jsonOut_(resCs);
    }
    if (action === 'salesReportOptions') return jsonOut_(getSalesReportOptions_());
    // ── TACH TEN KH: xem truoc danh sach ten doan duoc tu don hang (chua ghi gi) ──
    if (action === 'previewCustomerNameGuesses') return jsonOut_(previewCustomerNameGuesses_());
    if (action === 'salesReportC') {
      var pC = e.parameter || {};
      var fC = { dateField: pC.dateField || 'ngayTao', periodType: pC.periodType || 'week',
                 weekOffset: pC.weekOffset || 0, monthOffset: pC.monthOffset || 0, quarterOffset: pC.quarterOffset || 0, yearOffset: pC.yearOffset || 0,
                 customCurFrom: pC.customCurFrom || '', customCurTo: pC.customCurTo || '',
                 customPrevFrom: pC.customPrevFrom || '', customPrevTo: pC.customPrevTo || '',
                 sale: pC.sale ? pC.sale.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
                 kenh: pC.kenh ? pC.kenh.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
                 sanPham: pC.sanPham || '',
                 byCreator: pC.byCreator === '1' || pC.byCreator === 'true' };
      var cacheC = CacheService.getScriptCache();
      var cKeyC = 'salesC_' + JSON.stringify(fC);
      var cachedC = cacheC.get(cKeyC);
      if (cachedC) { try { return jsonOut_(JSON.parse(cachedC)); } catch(ec) {} }
      var resC = buildSalesReportC_(fC);
      try { cacheC.put(cKeyC, JSON.stringify(resC), 120); } catch(ec) {}
      return jsonOut_(resC);
    }

    // ── BAO CAO D: KH "Chăm sóc" thêm nhanh (sheet riêng, KHÔNG gộp báo cáo A/B/C) ──
    if (action === 'careLeadReport') {
      var pD = e.parameter || {};
      var fD = { dateFrom: pD.dateFrom || '', dateTo: pD.dateTo || '',
                 cs: pD.cs ? pD.cs.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [] };
      return jsonOut_(buildCareLeadReport_(fD));
    }

    // SUA 2026-10-08: them loc tuy chon theo ?csName= — dung cho Pancake AI (muc "Data duoc chia",
    // xem renderAssignTab_ trong pancake-content.js) de CHI tai ve cac dot chia CUA DUNG 1 CS thay
    // vi toan bo assignHistory (co the rat nang khi nhieu CS/nhieu dot chia cong lai). Khong truyen
    // csName (CRM van goi nhu cu) -> tra ve DAY DU nhu truoc, khong doi hanh vi cu.
    if (action === 'assign') {
      var allAssignH_ = readAssign_(ss.getSheetByName(SH_ASSIGN));
      var csFilterA_ = (e.parameter && e.parameter.csName) ? String(e.parameter.csName).trim() : '';
      if (csFilterA_) allAssignH_ = allAssignH_.filter(function(h) { return h.csName === csFilterA_; });
      return jsonOut_({ assignHistory: allAssignH_ });
    }
    if (action === 'tasks')     return jsonOut_({ tasks: readTasks_(ss.getSheetByName(SH_TASK)) });

    // ── Danh sach binh luan cua 1 cong viec (tab "Thao luan") ──
    if (action === 'taskComments') {
      var taskIdQ = (e && e.parameter && e.parameter.taskId) ? String(e.parameter.taskId) : '';
      if (!taskIdQ) return jsonOut_({ error: 'Thieu taskId' });
      return jsonOut_({ comments: readTaskComments_(ss.getSheetByName(SH_TASK_COMMENT), taskIdQ) });
    }

    if (action === 'count') {
      var shC = ss.getSheetByName(SH_CARE);
      var shDT = getDTSS_().getSheetByName(DT_TONG_SHEET);
      var totalOrders = shDT ? Math.max(0, shDT.getLastRow() - 1) : 0;
      return jsonOut_({ orderRows: totalOrders, careRows: shC ? Math.max(0, shC.getLastRow()-1) : 0, ver: 'v13.23-supabase-dualwrite' });
    }

    // ── lich hen hom nay / qua han (ZaloAI extension) ──
    if (action === 'reminders') {
      var csFilter = (e && e.parameter && e.parameter.cs) ? String(e.parameter.cs) : '';
      return jsonOut_({ reminders: readRemindersToday_(csFilter) });
    }

    // ── lay 1 setting (ZaloAI extension: careStatus, nickZaloList) ──
    if (action === 'getSettings') {   // nhieu key 1 lan: ?keys=a,b,c  -> { values: {a:..., b:...} }
      var skeys = (e && e.parameter && e.parameter.keys) ? String(e.parameter.keys).split(',') : [];
      return jsonOut_({ values: getSettingsMulti_(skeys.slice(0, 30)) });
    }
    if (action === 'getSetting') {
      var skey = (e && e.parameter && e.parameter.key) ? String(e.parameter.key) : '';
      return jsonOut_({ value: getSetting_(skey) });
    }

    // ── lay ma nguon gas_v13.js (nut "Copy Apps Script Code" trong index.html) — luu cac
    // manh (chunk) qua getSetting_/setSetting_ (key gasSourceChunk_0, _1, ...) vi 1 o tinh Sheet
    // gioi han 50.000 ky tu, code hien ~330k ky tu nen phai chia manh. Xem setGasSource (doPost)
    // — moi lan Duyen sua xong gas_v13.js VA da Deploy lai thu cong, phai vao CRM > nut Google
    // Sheets > dan lai code moi + bam "Dong bo" 1 lan de nut Copy luon dua dung ban moi nhat.
    if (action === 'getGasSource') {
      var gsChunks = parseInt(getSetting_('gasSourceChunkCount') || '0', 10) || 0;
      var gsCode = '';
      for (var gci = 0; gci < gsChunks; gci++) gsCode += (getSetting_('gasSourceChunk_' + gci) || '');
      return jsonOut_({ code: gsCode, chunks: gsChunks, updatedAt: getSetting_('gasSourceUpdatedAt') || null });
    }

    // ── BROADCAST: hang doi tin gui hang loat cho 1 CS (ZaloAI extension) ──
    if (action === 'broadcastQueue') {
      var bcCs = (e && e.parameter && e.parameter.cs) ? String(e.parameter.cs) : '';
      return jsonOut_({ broadcasts: broadcastQueueForCS_(bcCs) });
    }
    // ── BROADCAST: danh sach toan bo chien dich (Sasum quan ly) ──
    if (action === 'broadcastList') {
      return jsonOut_({ broadcasts: readBroadcasts_() });
    }

    // ── HOI THAM TU DONG: xem mau tin hien co (de kiem tra da cau hinh chua) ──
    if (action === 'followUpTemplates') {
      var fuTpls = readFollowUpTemplates_();
      var fuDays = {};
      Object.keys(fuTpls).forEach(function (k) { var dd = parseInt(k.split('|')[1], 10); if (dd > 0) fuDays[dd] = true; });
      var fuDayList = Object.keys(fuDays).map(Number).sort(function(a,b){return a-b;});
      return jsonOut_({ templates: fuTpls, list: listFollowUpTemplates_(), checkpoints: fuDayList.length ? fuDayList : FU_CHECKPOINTS });
    }
    // ── HOI THAM TU DONG: bang ma san pham (doc dong tu sheet "Mã Zalo", ZaloAI extension dung de doc ten Zalo) ──
    if (action === 'productCodeMap') {
      return jsonOut_({ map: getProductCodeMap_() });
    }
    // ── HOI THAM TU DONG: kich hoat thu cong ngay (thay vi cho Time-driven trigger) ──
    if (action === 'runFollowUpScan') {
      return jsonOut_(runFollowUpScan_());
    }
    // ── XOA DON TRUNG: quet don trung (cung SDT+nam+thang+doanh thu). Truyen &phone= de chi quet 1 khach (ZaloAI extension) ──
    if (action === 'findDuplicateOrders') {
      var fdoPhone = (e && e.parameter && e.parameter.phone) ? String(e.parameter.phone) : '';
      return jsonOut_(findDuplicateOrders_(fdoPhone));
    }
    if (action === 'dedupeCare') return dedupeCare_();
    // ── LUU TRU DON CU: xem truoc (dry-run) so dong se chuyen. Can adminKey. &months=6..12 &which=base|pos|both ──
    if (action === 'archivePreview') {
      if (!_adminKeyOk_(e && e.parameter ? e.parameter.adminKey : '')) return jsonOut_({ error: 'Can khoa quan tri (adminKey) de xem truoc luu tru don cu.' });
      return jsonOut_(archiveOldOrders_({ months: e.parameter.months, which: e.parameter.which, dryRun: true }));
    }
    // ── SUPABASE (buoc 2b): kiem tra ket noi. Can adminKey ──
    if (action === 'sbPing') {
      if (!_adminKeyOk_(e && e.parameter ? e.parameter.adminKey : '')) return jsonOut_({ error: 'Can khoa quan tri (adminKey) cho thao tac Supabase.' });
      return jsonOut_(sbPing_());
    }
    // ── SUPABASE (buoc 3a): xem che do / STALE / danh sach dirty. Can adminKey ──
    if (action === 'sbStatus') {
      if (!_adminKeyOk_(e && e.parameter ? e.parameter.adminKey : '')) return jsonOut_({ error: 'Can khoa quan tri (adminKey) cho thao tac Supabase.' });
      return jsonOut_(sbStatus_());
    }
    // ── SUPABASE (buoc 2d): doi chieu CareData Sheet vs Supabase (&sample=1..300). Can adminKey ──
    if (action === 'sbCompareCare') {
      if (!_adminKeyOk_(e && e.parameter ? e.parameter.adminKey : '')) return jsonOut_({ error: 'Can khoa quan tri (adminKey) cho thao tac Supabase.' });
      return jsonOut_(sbCompareCare_({ sample: e.parameter.sample }));
    }

    // ── MAU TIN NHAN TU VAN KHACH: danh sach mau (CRM tab ZALO AI va extension Pancake AI dung chung) ──
    if (action === 'messageTemplates') {
      return jsonOut_({ templates: readMessageTemplates_() });
    }

    // ── MAU AI DA HOC (sheet AIContext, type combo_template): CRM xem/sua/xoa ──
    if (action === 'aiExamples') {
      return jsonOut_({ examples: readAIExamples_() });
    }

    // default — backward compat voi appweb v10
    var resD = { rows: readCare_(ss.getSheetByName(SH_CARE)), orders: [] };
    if (!(e && e.parameter && e.parameter.noOrders)) resD.orders = readAllOrders_();
    resD.careStatus = readCareStatus_(ss);
    return jsonOut_(resD);

  } catch(err) {
    return jsonOut_({ error: err.message });
  }
}


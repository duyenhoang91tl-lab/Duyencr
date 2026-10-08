// ═══════════════════════════════════════════════════════════════
//  XUAT BAO CAO DOANH SO RA 1 TAB MOI TRONG GOOGLE SHEET (CRM)
//  Dung lai dung buildSalesReportA_/B_ nen so lieu luon khop UI dang loc.
//  Moi lan xuat tao 1 tab moi (co timestamp) — khong ghi de, giu lich su cac lan xuat.
// ═══════════════════════════════════════════════════════════════
function exportSalesReportToSheet_(reportType, filters) {
  reportType = (reportType === 'B' || reportType === 'C' || reportType === 'D' || reportType === 'G') ? reportType : 'A';
  var data = reportType === 'B' ? buildSalesReportB_(filters || {})
    : (reportType === 'C' ? buildSalesReportC_(filters || {})
    : (reportType === 'D' ? buildCareLeadReport_(filters || {})
    : (reportType === 'G' ? buildFailedOrderReport_(filters || {})
    : buildSalesReportA_(filters || {}))));
  // Bao cao Base (A): ghi vao FILE GOOGLE SHEET RIENG (EXPORT_BASE_SS_ID, dung tab theo
  // EXPORT_BASE_GID) — file nay PHAI duoc chia se (Editor) cho tai khoan dang chay Apps Script.
  // CHI 1 tab CO DINH, moi lan xuat GHI DE lai noi dung cu, KHONG tao tab moi — theo yeu cau
  // Duyen 2026-09 ("chi ra 1 trang tinh thoi, khong bi moi lan xuat lai 1 trang moi", va sau do
  // "xuat cho minh vao link nay" — doi sang file rieng thay vi file CRM).
  // Cac loai bao cao khac (B/C/D) VAN giu nguyen: ghi vao file CRM, moi lan xuat tao 1 tab moi
  // co timestamp, de giu lai lich su cac lan xuat truoc do.
  var ss, tabName, sh, fixedTab = (reportType === 'A');
  if (fixedTab) {
    try {
      ss = SpreadsheetApp.openById(EXPORT_BASE_SS_ID);
    } catch (eExt) {
      return jsonOut_({ error: 'Không mở được file Google Sheet đích (EXPORT_BASE_SS_ID) — kiểm tra lại ID/quyền chia sẻ (Editor) cho tài khoản đang chạy Apps Script. Chi tiết: ' + eExt.message });
    }
    sh = _sheetByGid_(ss, EXPORT_BASE_GID);
    if (!sh) return jsonOut_({ error: 'File đích chưa có tab nào (rỗng) — mở file, tạo ít nhất 1 tab rồi thử lại.' });
    sh.clear(); // ghi de: xoa sach noi dung/dinh dang cu truoc khi ghi lai
    tabName = sh.getName();
  } else {
    ss = getCrmSS_();
    var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Etc/GMT-7', 'yyyyMMdd_HHmmss');
    tabName = 'BC_' + reportType + '_' + ts;
    sh = ss.insertSheet(tabName);
  }

  // Ten bao cao (quy uoc moi): A = Base (DT tong), B = Pos (du lieu don), C = So sanh ky Base,
  // D = Sale tu them (KH Cham soc moi, data rieng khong gop A/B/C).
  var reportTitles = {
    A: 'BÁO CÁO BASE — Theo DT tổng',
    B: 'BÁO CÁO POS — Theo dữ liệu đơn',
    C: 'BÁO CÁO SO SÁNH KỲ BASE',
    D: 'BÁO CÁO SALE TỰ THÊM — KH Chăm sóc mới (data riêng, KHÔNG gộp Base/Pos)',
    E: 'BÁO CÁO HOA HỒNG NHÂN VIÊN POS',
    G: 'BÁO CÁO ĐƠN BỊ LOẠI — POS (Hủy/Đã hoàn/Đang hoàn/Hoàn tiền... đã trừ khỏi doanh số Pos)'
  };
  var rows = [];
  rows.push([reportTitles[reportType] || ('BÁO CÁO ' + reportType)]);
  rows.push(['Xuất lúc', Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Etc/GMT-7', 'dd/MM/yyyy HH:mm:ss')]);

  var f = filters || {};
  var filterDesc = [];
  if (reportType === 'A') {
    if (f.dateFrom || f.dateTo) filterDesc.push('Khoảng ngày: ' + (f.dateFrom || '...') + ' → ' + (f.dateTo || '...'));
    filterDesc.push('Lọc theo: ' + (f.dateField === 'thoiGianHT' ? 'Thời gian hoàn thành' : 'Ngày tạo'));
    var saleArrA = Array.isArray(f.sale) ? f.sale : (f.sale ? [f.sale] : []);
    if (saleArrA.length) filterDesc.push('Sale: ' + saleArrA.join(', '));
    var kenhArrA = Array.isArray(f.kenh) ? f.kenh : (f.kenh ? [f.kenh] : []);
    if (kenhArrA.length) filterDesc.push('Kênh: ' + kenhArrA.join(', '));
    if (f.byCreator) filterDesc.push('Tính theo người tạo đơn (không chia đều theo sale)');
  } else if (reportType === 'B') {
    if (f.dateFrom || f.dateTo) filterDesc.push('Khoảng ngày: ' + (f.dateFrom || '...') + ' → ' + (f.dateTo || '...'));
    filterDesc.push('Sale: ' + (Array.isArray(f.sale) ? (f.sale.join(', ') || '(tất cả)') : (f.sale || '(tất cả)')));
    filterDesc.push('Nguồn đơn: ' + (Array.isArray(f.nguon) ? (f.nguon.join(', ') || '(tất cả)') : (f.nguon || '(tất cả)')));
    filterDesc.push('Marketer: ' + (Array.isArray(f.marketer) ? (f.marketer.join(', ') || '(tất cả)') : (f.marketer || '(tất cả)')));
  } else if (reportType === 'D') {
    if (f.dateFrom || f.dateTo) filterDesc.push('Khoảng ngày thêm: ' + (f.dateFrom || '...') + ' → ' + (f.dateTo || '...'));
    if (f.cs) filterDesc.push('CS: ' + f.cs);
  } else if (reportType === 'G') {
    if (f.dateFrom || f.dateTo) filterDesc.push('Khoảng ngày (Ngày tạo đơn Pos): ' + (f.dateFrom || '...') + ' → ' + (f.dateTo || '...'));
    var saleArrG = Array.isArray(f.sale) ? f.sale : (f.sale ? [f.sale] : []);
    if (saleArrG.length) filterDesc.push('Sale: ' + saleArrG.join(', '));
    var nguonArrG = Array.isArray(f.nguon) ? f.nguon : (f.nguon ? [f.nguon] : []);
    if (nguonArrG.length) filterDesc.push('Kênh bán (Nguồn đơn): ' + nguonArrG.join(', '));
    var mktArrG = Array.isArray(f.marketer) ? f.marketer : (f.marketer ? [f.marketer] : []);
    if (mktArrG.length) filterDesc.push('Marketer: ' + mktArrG.join(', '));
  } else {
    if (data.period) filterDesc.push('Kỳ này: ' + data.period.curLabel + ' | Kỳ trước: ' + data.period.prevLabel);
    filterDesc.push('Lọc theo: ' + (f.dateField === 'thoiGianHT' ? 'Thời gian hoàn thành' : 'Ngày tạo'));
    var saleArrC = Array.isArray(f.sale) ? f.sale : (f.sale ? [f.sale] : []);
    if (saleArrC.length) filterDesc.push('Sale: ' + saleArrC.join(', '));
    var kenhArrC = Array.isArray(f.kenh) ? f.kenh : (f.kenh ? [f.kenh] : []);
    if (kenhArrC.length) filterDesc.push('Kênh bán: ' + kenhArrC.join(', '));
    if (f.byCreator) filterDesc.push('Tính theo người tạo đơn (không chia đều theo sale)');
  }
  rows.push(['Bộ lọc', filterDesc.join(' | ') || '(không lọc)']);
  rows.push([]);

  if (reportType === 'A') {
    rows.push(['TỔNG QUAN']);
    rows.push(['Số lượng đơn', data.totalOrders]);
    rows.push(['Tổng tiền đã cọc/CK (tham khảo)', data.totalCoc]);
    rows.push(['Tổng đơn (doanh thu, ko ship)', data.totalGiaTri]);
    rows.push(['Trung bình đơn', data.trungBinhDon]);
    rows.push([]);
    rows.push(['THEO SALE BÁN', f.byCreator ? '(tính trọn vẹn cho người tạo đơn — không chia đều)' : '(số đơn giữ nguyên — tiền chia đều cho số sale/đơn)']);
    rows.push(['Sale', 'Số đơn', 'Cọc', 'Tổng đơn', 'TB đơn']);
    (data.bySale || []).forEach(function(s) { rows.push([s.name, s.orders, s.coc, s.giaTri, s.trungBinhDon]); });
    rows.push([]);
    rows.push(['THEO KÊNH BÁN (PAGE)']);
    rows.push(['Kênh', 'Số đơn', 'Cọc', 'Tổng đơn', 'TB đơn']);
    (data.byKenh || []).forEach(function(k) { rows.push([k.name, k.orders, k.coc, k.giaTri, k.trungBinhDon]); });
    rows.push([]);
    rows.push(['THEO MKT']);
    rows.push(['MKT', 'Số đơn', 'Cọc', 'Tổng đơn', 'TB đơn']);
    (data.byMkt || []).forEach(function(k) { rows.push([k.name, k.orders, k.coc, k.giaTri, k.trungBinhDon]); });
    rows.push([]);
    rows.push(['CHI TIẾT ĐƠN']);
    rows.push(['Ngày tạo', 'Thời gian HT', 'Kênh bán', 'Sale bán', 'Sản phẩm', 'Phân loại', 'Giá trị cọc', 'Giá trị đơn', 'Giai đoạn', 'Trạng thái', 'ID']);
    (data.orders || []).forEach(function(o) {
      rows.push([o.ngayTao, o.thoiGianHT, o.kenhBan, o.saleBan, o.sanPham, o.phanLoai, o.giaTriCoc, o.giaTriDon, o.giaiDoan, o.trangThai, o.id]);
    });
  } else if (reportType === 'B') {
    rows.push(['TỔNG QUAN']);
    rows.push(['Số lượng đơn', data.totalOrders]);
    rows.push(['Tổng giá trị sau giảm giá', data.totalGiaTri]);
    rows.push(['Tổng COD', data.totalCod]);
    if (data.mismatchRows) rows.push(['⚠ Số dòng lệch cột (cần kiểm tra tay)', data.mismatchRows]);
    rows.push([]);
    rows.push(['THEO SALE', '(số đơn giữ nguyên — tiền chia đều cho số sale/đơn)']);
    rows.push(['Sale', 'Số đơn', 'Giá trị sau giảm giá', 'COD']);
    (data.bySale || []).forEach(function(s) { rows.push([s.name, s.orders, s.giaTri, s.cod]); });
    rows.push([]);
    rows.push(['THEO TEAM SALE']);
    rows.push(['Team Sale', 'Số đơn', 'Giá trị sau giảm giá', 'TB đơn', 'COD']);
    (data.byTeamSale || []).forEach(function(t) { rows.push([t.name, t.orders, t.giaTri, t.trungBinhDon, t.cod]); });
    rows.push([]);
    rows.push(['THEO NGUỒN ĐƠN']);
    rows.push(['Nguồn đơn', 'Số đơn', 'Giá trị sau giảm giá', 'TB đơn', 'COD']);
    (data.byNguon || []).forEach(function(k) { rows.push([k.name, k.orders, k.giaTri, k.trungBinhDon, k.cod]); });
    rows.push([]);
    rows.push(['THEO MKT']);
    rows.push(['MKT', 'Số đơn', 'Giá trị sau giảm giá', 'TB đơn', 'COD']);
    (data.byMkt || []).forEach(function(k) { rows.push([k.name, k.orders, k.giaTri, k.trungBinhDon, k.cod]); });
    rows.push([]);
    rows.push(['BÁO CÁO SẢN PHẨM']);
    rows.push(['Mã sản phẩm', 'Tên sản phẩm', 'Tổng số lượng']);
    (data.products || []).forEach(function(p) { rows.push([p.code, p.name, p.soLuong]); });
    rows.push([]);
    rows.push(['CHI TIẾT ĐƠN']);
    rows.push(['Ngày tạo đơn', 'Khách hàng', 'SĐT', 'Nguồn đơn', 'Sale', 'Sản phẩm', 'Mã sản phẩm', 'Số lượng', 'Giá trị sau giảm giá', 'COD', 'Marketer']);
    (data.orders || []).forEach(function(o) {
      rows.push([o.ngayTaoDon, o.khachHang, o.soDienThoai, o.nguonDon, o.theSale, o.sanPham, o.maSanPham, o.soLuong, o.giaTriSauGiam, o.cod, o.marketer]);
    });
  } else if (reportType === 'D') {
    rows.push(['TỔNG QUAN']);
    rows.push(['Số KH thêm mới (nguồn Chăm sóc)', data.total]);
    rows.push([]);
    rows.push(['THEO CS THÊM']);
    rows.push(['CS', 'Số KH thêm']);
    (data.byCS || []).forEach(function(x) { rows.push([x.name, x.count]); });
    rows.push([]);
    rows.push(['CHI TIẾT']);
    rows.push(['SĐT', 'Tên khách', 'Ghi chú mới nhất', 'CS thêm', 'Ngày thêm']);
    (data.rows || []).forEach(function(r) {
      var latestNote = r.note || '';
      try {
        var arr = JSON.parse(r.note || '[]');
        if (Array.isArray(arr) && arr.length) latestNote = arr[0].text || '';
      } catch (eN) {}
      rows.push([r.phone, r.name, latestNote, r.cs, r.createdAt]);
    });
  } else if (reportType === 'G') {
    rows.push(['TỔNG QUAN (nguồn Pos — "dữ liệu đơn")']);
    rows.push(['Số đơn bị loại', data.totalOrders]);
    rows.push(['Tổng COD (tham khảo)', data.totalCod]);
    rows.push(['Tổng giá trị sau giảm (tham khảo — KHÔNG tính vào doanh thu)', data.totalGiaTri]);
    rows.push([]);
    rows.push(['THEO LÝ DO (trạng thái đơn)']);
    rows.push(['Trạng thái', 'Số đơn', 'COD', 'Giá trị']);
    (data.byLyDo || []).forEach(function(x) { rows.push([x.name, x.orders, x.cod, x.giaTri]); });
    rows.push([]);
    rows.push(['THEO SALE (mỗi sale trên đơn đều tính 1 đơn, không chia đều)']);
    rows.push(['Sale', 'Số đơn', 'COD', 'Giá trị']);
    (data.bySale || []).forEach(function(s) { rows.push([s.name, s.orders, s.cod, s.giaTri]); });
    rows.push([]);
    rows.push(['THEO KÊNH BÁN (Nguồn đơn)']);
    rows.push(['Kênh bán', 'Số đơn', 'COD', 'Giá trị']);
    (data.byNguon || []).forEach(function(k) { rows.push([k.name, k.orders, k.cod, k.giaTri]); });
    rows.push([]);
    rows.push(['THEO MKT (Marketer trên đơn)']);
    rows.push(['MKT', 'Số đơn', 'COD', 'Giá trị']);
    (data.byMkt || []).forEach(function(k) { rows.push([k.name, k.orders, k.cod, k.giaTri]); });
    rows.push([]);
    rows.push(['CHI TIẾT']);
    rows.push(['Ngày tạo', 'Kênh bán', 'Marketer', 'Sale', 'Sản phẩm', 'Giá trị sau giảm', 'COD', 'Trạng thái']);
    (data.orders || []).forEach(function(o) {
      rows.push([o.ngayTao, o.nguonDon, o.marketer, o.saleBan, o.sanPham, o.giaTriDon, o.cod, o.trangThai]);
    });
  } else {
    var hdrC = ['Tên', 'KPI kỳ trước', 'Kết quả kỳ trước', '%HT KPI kỳ trước', 'KPI kỳ này', 'Kết quả kỳ này', '%HT KPI kỳ này', '% Tăng trưởng'];
    rows.push(['THEO NHÂN VIÊN (SALE)']);
    rows.push(hdrC);
    (data.byEmployee || []).forEach(function(r) {
      rows.push([r.name, r.kpiPrev, r.resultPrev, r.pctKpiPrev, r.kpiCur, r.resultCur, r.pctKpiCur, r.growthPct]);
    });
    rows.push([]);
    rows.push(['THEO KÊNH BÁN']);
    rows.push(hdrC.slice().map(function(h,i){ return i===0 ? 'Kênh bán' : h; }));
    (data.byKenh || []).forEach(function(r) {
      rows.push([r.name, r.kpiPrev, r.resultPrev, r.pctKpiPrev, r.kpiCur, r.resultCur, r.pctKpiCur, r.growthPct]);
    });
  }

  var maxCols = rows.reduce(function(m, r) { return Math.max(m, r.length); }, 1);
  var padded = rows.map(function(r) {
    var rr = r.slice();
    while (rr.length < maxCols) rr.push('');
    return rr;
  });
  if (padded.length > 0) sh.getRange(1, 1, padded.length, maxCols).setValues(padded);
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  try { sh.autoResizeColumns(1, maxCols); } catch (ecw) {}

  return { tabName: tabName, fixedTab: fixedTab, sheetId: ss.getId(), gid: sh.getSheetId(),
           sheetUrl: ss.getUrl() + '#gid=' + sh.getSheetId() };
}

function doPost(e) {
  if (!e || !e.postData) return jsonOut_({ error: 'No postData' });
  var d0 = null;
  try { d0 = JSON.parse(e.postData.contents); } catch (e0) { d0 = null; }
  if (d0 && typeof d0 === 'object') {
    if (d0.action === 'demoLogin') return demoLogin_(d0);
    if (d0.demo) return jsonOut_({ error: 'Tai khoan test chi duoc xem, khong duoc ghi du lieu.' });
    if (d0.action === 'setGasSource' && !_adminKeyOk_(d0.adminKey)) return jsonOut_({ error: 'Can khoa quan tri (adminKey) de dong bo ma nguon GAS.' });
    if (d0.action === 'setSetting' && _isSensitiveWriteKey_(d0.key) && !_adminKeyOk_(d0.adminKey)) return jsonOut_({ error: 'Khong duoc ghi key nay.' });
  }
  return doPostCore_(e);
}

// ═══════════════════════════════════════════════════════════════
//  doPost
// ═══════════════════════════════════════════════════════════════
function doPostCore_(e) {
  if (!e || !e.postData) return jsonOut_({ error: 'No postData' });
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    if (action === 'save')                return saveAllCare_(data.rows);
    if (action === 'saveSingle')          return saveSingleCare_(data.row);
    if (action === 'saveBatch')           return saveBatchCare_(data.rows);
    if (action === 'saveOrders')          return saveOrders_(data.orders);
    if (action === 'addCareLead')         return addCareLead_(data);
    // ── TACH TEN KH: ghi that danh sach ten da duoc nguoi dung xac nhan tren UI ──
    if (action === 'applyCustomerNameGuesses') return applyCustomerNameGuesses_(data.items);    if (action === 'patchOrder')          return patchOrder_(data);
    if (action === 'deleteOrder')         return deleteOrder_(data);
    // ── Xuat bao cao doanh so (dang loc tren UI) ra 1 tab moi trong Google Sheet CRM ──
    if (action === 'exportSalesReportSheet') return jsonOut_(exportSalesReportToSheet_(data.reportType, data.filters));
    // ── XOA DON TRUNG: xoa cac dong trung da duoc CS/admin xac nhan (danh sach items tra ve tu findDuplicateOrders) ──
    if (action === 'deleteDuplicateOrders') return deleteDuplicateOrders_(data.items);
    // ── LUU TRU DON CU: chuyen don cu sang sheet *_LƯU TRỮ. Can adminKey; dryRun mac dinh true (xem archiveOldOrders_) ──
    if (action === 'archiveOrders') {
      if (!_adminKeyOk_(data.adminKey)) return jsonOut_({ error: 'Can khoa quan tri (adminKey) de luu tru don cu.' });
      return jsonOut_(archiveOldOrders_({ months: data.months, which: data.which, dryRun: data.dryRun !== false }));
    }
    // ── SUPABASE (buoc 2c): day CareData len Supabase theo lo (dryRun mac dinh true, resume bang con tro). Can adminKey ──
    if (action === 'sbBackfillCare') {
      if (!_adminKeyOk_(data.adminKey)) return jsonOut_({ error: 'Can khoa quan tri (adminKey) cho thao tac Supabase.' });
      return jsonOut_(sbBackfillCare_({ dryRun: data.dryRun, reset: data.reset }));
    }
    if (action === 'replaceOrders')       return replaceOrders_(data.orders, data);
    if (action === 'setOrderCareCS')      return setOrderCareCS_(data.phone, data.careCS);
    if (action === 'setOrderCareCSBatch') return setOrderCareCSBatch_(data.updates);
    if (action === 'saveTeams')           return saveTeams_(data.teams);
    if (action === 'saveMktTeams')        return saveMktTeams_(data.teams);
    if (action === 'saveUsers')           return saveUsers_(data.users);
    if (action === 'saveAudit')           return saveAudit_(data.rows);
    // ── Nhap du lieu Base/Pos tu file export (thay copy tay vao Google Sheet) ──
    if (action === 'importSheetRows')     return doImportSheetRows_(data.sheet, data.rows);
    // ── Bao cao Pancake ──
    if (action === 'savePancakeStats')    return savePancakeStats_(data.rows);
    if (action === 'savePancakeNameMap')  return savePancakeNameMap_(data.pancakeName, data.saleName);
    if (action === 'savePancakeSdtStats') return savePancakeSdtStats_(data.rows);
    if (action === 'savePancakeTagStats') return savePancakeTagStats_(data.rows);
    if (action === 'saveSaleDirectory')   return saveSaleDirectory_(data.rows);
    if (action === 'savePancakePageMap')  return savePancakePageMap_(data.pageId, data.pageName, data.kenhBan);
    if (action === 'setSetting')          return setSetting_(data.key, data.value);
    if (action === 'saveSaleGroups')      return saveSaleGroups_(data.groups);
    // ── Dong bo lai ma nguon gas_v13.js cho nut "Copy Apps Script Code" (xem getGasSource, doGet)
    // — chia thanh cac manh <=45.000 ky tu (o tinh Sheet gioi han 50.000), xoa manh cu thua neu
    // ban moi it manh hon ban truoc, roi ghi "gasSourceUpdatedAt" de UI hien luc dong bo gan nhat.
    if (action === 'setGasSource')        return setGasSource_(data.code);
    // Them 1 nick Zalo vao danh sach chung (MERGE tren server -> khong ghi de mat nick cu)
    if (action === 'addZaloNick')         return addZaloNick_(data.nick);
    if (action === 'saveAssign')          return saveAssignEntry_(data.entry);
    if (action === 'saveAssignHistory')   return saveAssignHistory_(data.history);
    // Pancake AI tich "Da goi xong" cho 1 SDT trong muc "Data duoc chia" — xem toggleAssignDone_.
    if (action === 'toggleAssignDone')    return toggleAssignDone_(data.csName, data.phone, !!data.done);
    if (action === 'saveTask')  return saveTaskEntry_(data.task);
    if (action === 'deleteTask') return deleteTask_(data.id);
    // ── Binh luan/thao luan trong 1 cong viec (Task) — tab "Thao luan" tren UI ──
    if (action === 'saveTaskComment') return saveTaskComment_(data.comment);
    if (action === 'saveCareStatus')      return saveCareStatus_(data.careStatus);
    if (action === 'saveAIContext')        return saveAIContext_(data.type, data.content, data.context);
    // Xac thuc tai khoan (Pancake AI doi CS) — kiem tra mat khau PHIA SERVER, khong tra passHash ve client
    if (action === 'verifyLogin')          return verifyLogin_(data.username, data.password);
    if (action === 'ai')                  return callGroqAI_(data);
    // ── BROADCAST: tao/cap nhat 1 chien dich gui tin hang loat ──
    if (action === 'saveBroadcast')        return saveBroadcast_(data.broadcast || data);
    // ── BROADCAST: danh dau 1 SDT da gui/loi/bo qua trong 1 chien dich ──
    if (action === 'broadcastMark')        return broadcastMark_(data.id, data.phone, data.status);
    // ── BROADCAST: upload 1 anh (base64) len Drive, tra ve link xem truc tiep ──
    if (action === 'uploadBroadcastImg')   return uploadBroadcastImage_(data.base64, data.filename, data.mimeType);
    // ── BROADCAST: huy 1 chien dich (dung gui tiep) ──
    if (action === 'broadcastCancel')      return broadcastCancel_(data.id);
    // ── BROADCAST: bat/tat (kich hoat/tam tat) 1 chien dich ──
    if (action === 'broadcastSetStatus')   return broadcastSetStatus_(data.id, data.status);
    // ── HOI THAM TU DONG: nhan ket qua quet ten Zalo tu extension (du phong khi thieu OrderData) ──
    if (action === 'saveZaloScan')         return saveZaloScan_(data.rows);
    // ── ZALO AI: dong bo trang thai ket ban (Da ket ban/Chan/...) tu nut "Quet man hinh" trong extension.
    //     dryRun=true -> CHI kiem tra xung dot (SDT nao dang duoc CS/Nick khac ghi nhan khac trang thai),
    //     khong ghi gi ca; extension se hoi CS xac nhan roi moi goi lai voi dryRun=false (that su ghi). ──
    if (action === 'syncZaloFriendStatus') return syncZaloFriendStatus_(data.rows, !!data.dryRun);
    // Dọn dòng CareData bị nhân bản (giữ dòng đầy đủ nhất cho mỗi SĐT)
    if (action === 'dedupeCare')           return dedupeCare_();
    // ── HOI THAM TU DONG: luu bang mau tin (UI Sasum) ──
    if (action === 'saveFollowUpTemplates') return saveFollowUpTemplates_(data.templates);
    // ── MESSENGER/PHONG THUY AI: doc bang tra menh + mau canned response (Sheet Menh/CannedResponses,
    //    tu tao voi du lieu mac dinh neu chua co). Them 2026-09, KHONG dung chung sheet/cot voi CareData. ──
    if (action === 'getKnowledge') return jsonOut_(getMessengerKnowledge_());
    // ── MAU TIN NHAN TU VAN KHACH: them/sua (form tren CRM tab ZALO AI) / xoa 1 mau ──
    if (action === 'saveMessageTemplate')   return saveMessageTemplate_(data.template || data);
    if (action === 'deleteMessageTemplate') return deleteMessageTemplate_(data.id);
    if (action === 'saveCannedResponse')    return saveCannedResponse_(data.canned || data);
    if (action === 'saveAIExample')         return saveAIExample_(data.id, data.content);
    if (action === 'deleteAIExample')       return deleteAIExample_(data.id);
    if (action === 'deleteCannedResponse')  return deleteCannedResponse_(data.id);
    // ── CHECKLIST MKT: nhap tay theo ngay + muc tieu L1-L4 ──
    if (action === 'saveMktChecklistConfig')  return saveMktChecklistConfig_(data.month, data.config);
    // ── NHAT KY BAO CAO HANG NGAY (Sale/Kenh/MKT/Tag) -> Google Sheet rieng ──
    if (action === 'exportDailyReportLogs') return exportDailyReportLogs_(data.from, data.to);
    return jsonOut_({ error: 'Unknown action: ' + action });
  } catch(err) {
    return jsonOut_({ error: err.message });
  }
}


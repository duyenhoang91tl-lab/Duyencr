# Lưu trữ đơn cũ (yêu cầu Duyên 2026-10-08)

Mục tiêu: chuyển đơn cũ hơn 6–12 tháng khỏi `DT TỔNG ` và `dữ liệu đơn` (spreadsheet `DT_SS_ID`) sang sheet
`DT TỔNG_LƯU TRỮ` / `dữ liệu đơn_LƯU TRỮ` (cùng file) để báo cáo hằng ngày đọc ít dòng. Code: cuối `gas_v13.js`
(`archiveOldOrders_`, file `gas/21_ArchiveOldOrders.gs`).

## Đã xong
- [x] Bước 1: engine lưu trữ + dry-run. Action `archivePreview` (GET) và `archiveOrders` (POST, dryRun mặc định true), cần `adminKey`.
  Quy tắc chọn dòng: Base = cả ngày tạo (A) và thời gian HT (K) đều < mốc; không đọc được ngày → GIỮ. Pos = ngày cột B, dòng thiếu ngày
  kế thừa dòng trên (giống `readDonChiTiet_`) nên dòng nối tiếp đi cùng dòng cha. Copy → đối chiếu từng ô → kiểm tra gốc không đổi → mới xoá.
  Mỗi lần chạy tối đa 20.000 dòng / 300 khối xoá. Log vào sheet `_ARCHIVE_LOG`. Mốc cắt lưu setting `archiveBoundaryYmd`.
- Chạy thật đang BỊ KHOÁ bởi `ARCHIVE_APPLY_ENABLED_ = false` (xem bước 2 vì sao).

## Việc cần làm tiếp (phiên sau làm theo thứ tự)
- [ ] Bước 2 (BẮT BUỘC trước khi bật chạy thật): các hàm cần LỊCH SỬ ĐẦY ĐỦ phải đọc thêm sheet lưu trữ, nếu không số đơn / ngày mua gần nhất /
  KH mới-cũ của khách sẽ sai: `readAllOrders_` (allCustomers), `readOrdersByPhone_`, `findDonRowsByPhone_`, và action `donPhones`
  (`readDonChiTiet_` → `getDonStatsByPhone_`, `getDonSaleByPhone_`, `getDonOrderCountByPhone_`, `getDonLastDateByPhone_`).
  Gợi ý: thêm tham số `includeArchive` cho `readDTTong_` / `readDonChiTiet_` / `readAllOrders_` (cache key riêng, ví dụ `donChiTiet_v4_all`).
- [ ] Bước 3: báo cáo A/B/C, KPI, báo cáo thất bại, checklist MKT (`buildSalesReportA_`, `buildSalesReportB_`, `buildSalesReportC_`,
  `buildFailedOrderReport_`, `buildSaleKpiReport_`, `buildMktChecklistReport_`): chỉ đọc sheet lưu trữ khi khoảng ngày lọc bắt đầu trước
  `archiveBoundaryYmd`. Ghép đơn Pos↔Base (`_readBaseRowsByCounterCodes_`) cũng phải tìm cả trong sheet lưu trữ Base.
- [ ] Bước 4: `patchOrder_` / `deleteOrder_` / `findDuplicateOrders_` / `doImportSheetRows_` / dedup trigger mới chỉ làm việc trên sheet sống;
  quyết định có cho sửa đơn đã lưu trữ không (đề xuất: không, báo rõ).
- [ ] Bước 5: nút trong CRM (js/…): xem trước (dry-run) → xác nhận → chạy; cho chọn 6/9/12 tháng. Sau đó bật `ARCHIVE_APPLY_ENABLED_ = true`.
- [ ] Trước lần chạy thật đầu tiên: Duyên tự "Tạo bản sao" file DT tổng gốc (backup), vì nguồn này còn có nhập/đồng bộ ngoài code.
- Hỏi lại Duyên: nguồn `DT TỔNG ` / `dữ liệu đơn` có công thức hay tự động đồng bộ nào bên ngoài (import, IMPORTRANGE, script khác) trỏ vào số dòng không?

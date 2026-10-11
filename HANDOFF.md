# HANDOFF — Giao diện PRO (kiểu Creatio)

Bật thử: mở web với `?ui=pro` (tắt: `?ui=classic`; nhớ trong localStorage `ui_mode`). Mặc định vẫn là bản cũ.
Mọi CSS mới nằm trong `css/06-pro.css`, mọi selector bắt đầu `html.ui-pro` (test: `node tools/test-ui-pro.js`).

## Tiến độ
- [x] **P0 — Nền thiết kế**: `css/06-pro.css` (pro-card, pro-kpi, pro-chip, pro-stage, pro-tl, pro-next, pro-gauge) + công tắc `?ui=pro`. Chưa đổi chức năng.
- [ ] **P1 — Trang chủ**: đồng hồ doanh số/tỷ lệ chốt (dùng csStats), phễu theo tình trạng CS, thẻ Khuyến nghị (luật gợi ý từ Pancake). Chỉ vẽ SỐ TỔNG HỢP (~136k khách, không vẽ danh sách). Cần thêm ô cài mục tiêu doanh số (chưa có nơi lưu → dùng setSetting/getSetting).
- [x] **P2 — Hồ sơ khách 360°** (file `js/33-pro-profile.js`, test `node tools/test-ui-pro-profile.js`):
  - [x] 2a: thanh giai đoạn (cây Tình trạng CS, CHỈ tô giai đoạn hiện tại, không tô "đã qua" vì cây CS không phải phễu tuyến tính) + 3 ô số (ngày từ đơn cuối / số đơn / doanh thu). Chèn khối `#dp-pro` giữa `.dp-hdr` và `.dp-tabs` bằng cách bọc `openDp` + `renderDpTab` (không sửa hàm gốc).
  - [x] 2b: khung "Việc tiếp theo" = tối đa 3 lịch CHƯA xong của khách (quá hạn → hôm nay → sắp tới), nút "Xem/+ Đặt lịch" chuyển sang tab Lịch hẹn. Nguồn: biến toàn cục `schedules` (không dùng cột schedGoi/SP/CS/Hen của careData).
  - [x] 2c: timeline (thẻ `<details>` thu gọn) gộp ghi chú (`_parseNotes`, giờ dạng `HH:MM dd/mm/yyyy`) + lịch hẹn + đơn (ưu tiên `_posOrdersCache` nếu đã tải, không thì `c.orders`), tối đa 30 mục.
  - [ ] Còn lại (tuỳ chọn): gợi ý hành động từ luật Pancake (vd "khách quá hạn hẹn → lên lịch") chưa đưa vào khung Việc tiếp theo; cần xem extension-pancake/pancake-content.js phần gợi ý. Chưa test trên trình duyệt thật.
  Lưu ý: `o.month` là 1–12, `o.year` có thể 2 chữ số (<100 → +2000).
- [~] **P3 — Báo cáo A–L**: đồng bộ thanh lọc (nhớ đủ preset Hôm nay/Hôm qua/Tuần này/Tuần trước/Tháng này/Tháng trước/quý/năm), ô số, biểu đồ SVG (không thêm thư viện).
  - [x] 3a: kiểm kê lọc ngày. Báo cáo A–L, KPI Pancake, Dashboard ĐÃ đủ preset (dùng `_quickRangeSelectHtml` + `_PK_QUICK_RANGES` ở js/16, hàm tính `_pkQuickRange` ở js/10). THIẾU 2 chỗ → đã bổ sung: "AI phân tích team" (`_taQuick`) và "Tổng quan" (`_ovQuick`, tự tải lại). Giữ nút "7 ngày". Test: `node tools/test-quick-range-presets.js` (trích hàm thật, giả ngày CN 11/10/2026 và 15/01/2026). Không đụng được `_dbRender` (xem 1 ngày) và `_fuResultAsk` (chọn ngày hẹn, không phải bộ lọc).
  - [ ] 3b: ô số màu (`pro-kpi`) cho các báo cáo A–L — thay dải KPI trong `_srChartSvg` (tham số ordersKey) khi `html.ui-pro`; nhớ grep TOÀN BỘ nơi gọi `_srChartSvg` trước khi sửa.
  - [ ] 3c: biểu đồ SVG đồng bộ phong cách pro (donut/cột), không thêm thư viện.
- [ ] **P4 — Dock phải + trợ lý AI**: hỏi đáp về khách/doanh số; thanh tab hồ sơ đang mở.

## Ràng buộc
Phân quyền (admin/quản lý/leader/CS) quyết định tab hiển thị. Chưa lưu: mục tiêu doanh số, số cuộc gọi (chờ phần kết quả cuộc gọi của phiên khác). Không sửa `extension/`. Không đổi thứ tự thẻ `<script>`.

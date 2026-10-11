# HANDOFF — Giao diện PRO (kiểu Creatio)

Bật thử: mở web với `?ui=pro` (tắt: `?ui=classic`; nhớ trong localStorage `ui_mode`). Mặc định vẫn là bản cũ.
Mọi CSS mới nằm trong `css/06-pro.css`, mọi selector bắt đầu `html.ui-pro` (test: `node tools/test-ui-pro.js`).

## Tiến độ
- [x] **P0 — Nền thiết kế**: `css/06-pro.css` (pro-card, pro-kpi, pro-chip, pro-stage, pro-tl, pro-next, pro-gauge) + công tắc `?ui=pro`. Chưa đổi chức năng.
- [ ] **P1 — Trang chủ**: đồng hồ doanh số/tỷ lệ chốt (dùng csStats), phễu theo tình trạng CS, thẻ Khuyến nghị (luật gợi ý từ Pancake). Chỉ vẽ SỐ TỔNG HỢP (~136k khách, không vẽ danh sách). Cần thêm ô cài mục tiêu doanh số (chưa có nơi lưu → dùng setSetting/getSetting).
- [ ] **P2 — Hồ sơ khách 360°**: nâng modal khách: thanh giai đoạn (cây Tình trạng CS), ô số (ngày từ đơn cuối, số đơn, doanh thu), khung Việc tiếp theo, timeline gộp ghi chú+lịch hẹn+đơn.
- [ ] **P3 — Báo cáo A–L**: đồng bộ thanh lọc (nhớ đủ preset Hôm nay/Hôm qua/Tuần này/Tuần trước/Tháng này/Tháng trước/quý/năm), ô số, biểu đồ SVG (không thêm thư viện).
- [ ] **P4 — Dock phải + trợ lý AI**: hỏi đáp về khách/doanh số; thanh tab hồ sơ đang mở.

## Ràng buộc
Phân quyền (admin/quản lý/leader/CS) quyết định tab hiển thị. Chưa lưu: mục tiêu doanh số, số cuộc gọi (chờ phần kết quả cuộc gọi của phiên khác). Không sửa `extension/`. Không đổi thứ tự thẻ `<script>`.

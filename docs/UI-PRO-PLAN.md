# Kế hoạch giao diện CRM "chuyên nghiệp" (tham chiếu Creatio)

Quy ước chung: `<html class="ui-pro">` gắn cứng (không có công tắc); MỌI selector trong `css/06-pro.css` phải bắt đầu bằng `html.ui-pro` (test: `tools/test-ui-pro.js`).
Hàm thuần đặt tên `proXxx_`, xuất qua `module.exports` để test bằng Node; bọc hàm gốc thay vì sửa. Màn nặng (~136k khách) chỉ vẽ SỐ TỔNG HỢP.
CRM ĐÃ có mục tiêu doanh số (`target`/`pct` trong `orgOverview`) nên đồng hồ KPI dùng số có sẵn.

| Bước | Nội dung | Trạng thái |
|---|---|---|
| P0 / P0b | Nền thiết kế `css/06-pro.css` (pro-card, pro-kpi, pro-chip, pro-stage, pro-tl, pro-next, pro-gauge) + da header + menu tím | ✅ |
| P1 | Trang chủ: đồng hồ KPI/tỷ lệ chốt, 4 ô số, Khuyến nghị, phân bố tình trạng CS — `js/36-pro-home.js` | ✅ |
| P2a–c | Hồ sơ khách 360°: thanh giai đoạn, ô số, Việc tiếp theo, dòng thời gian — `js/33-pro-profile.js` | ✅ |
| P3 | Báo cáo A–L: đồng bộ thanh lọc, ô số, biểu đồ SVG cùng bộ `pro-*` | chưa làm |
| P4 | Dock bên phải (chat/lịch) + trợ lý AI (action `ai`) + thanh tab hồ sơ đang mở | chưa làm |

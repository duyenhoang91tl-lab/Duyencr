# Kế hoạch giao diện CRM "chuyên nghiệp" (tham chiếu Creatio)

Quy ước chung: `<html class="ui-pro">` gắn cứng (không có công tắc); MỌI selector trong `css/06-pro.css` phải bắt đầu bằng `html.ui-pro` (test: `tools/test-ui-pro.js`).
Hàm thuần đặt tên `proXxx_`, xuất qua `module.exports` để test bằng Node; bọc hàm gốc thay vì sửa. Màn nặng (~136k khách) chỉ vẽ SỐ TỔNG HỢP.
CRM ĐÃ có mục tiêu doanh số (`target`/`pct` trong `orgOverview`) nên đồng hồ KPI dùng số có sẵn.

| Bước | Nội dung | Trạng thái |
|---|---|---|
| P0 / P0b | Nền thiết kế `css/06-pro.css` (pro-card, pro-kpi, pro-chip, pro-stage, pro-tl, pro-next, pro-gauge) + da header + menu tím | ✅ |
| P1 | Trang chủ: đồng hồ KPI/tỷ lệ chốt, 4 ô số, Khuyến nghị, phân bố tình trạng CS — `js/36-pro-home.js` | ✅ |
| P2a–c | Hồ sơ khách 360°: thanh giai đoạn, ô số, Việc tiếp theo, dòng thời gian — `js/33-pro-profile.js` | ✅ |
| P3 | Báo cáo A–L: ô số màu + biểu đồ SVG cùng bộ `pro-*` — `js/34-pro-charts.js` (P3b/P3c); gom ~11 nút báo cáo vào 1 ô chọn | ✅ |
| P4 / P4b | Thanh tab hồ sơ đang mở + dock phải + Trợ lý hỏi đáp khách/doanh số (trả lời THÔ theo quy tắc, không cần key AI) — `js/38-pro-dock.js`, GAS `crmAsk` | ✅ |

Chưa làm (đã đề xuất, chưa được chọn): chấm điểm & xếp ưu tiên khách cần gọi; cảnh báo khách nguội / sắp mất. Kiểm thử bản nén: `npm i --no-save terser@5 clean-css@5 jsdom@24 && node tools/build-dist.js && node tools/test-dist-equivalence.js` (CI deploy-web.yml triển khai bản nén).

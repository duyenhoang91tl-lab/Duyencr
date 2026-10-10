# 05 — Web app Sasum: Báo cáo doanh số A–F (client ở `js/*.js` + `css/*.css`, tra hàm: `js/INDEX.md`)

Phần server của báo cáo nằm ở `gas_v13.js` (xem `02-backend-gas.md`). Sửa client: tìm hàm bằng `grep -n "function tenHam" js/*.js` (hoặc `js/INDEX.md`), syntax-check `node -c` từng file `js/*.js`. (Trước 2026-10-08 code này nằm inline trong `index.html`; các chỗ KB cũ nhắc "index.html" cho code client nay hiểu là `js/`.)

## Quy ước bảng
Mọi bảng breakdown (Theo Sale/Kênh/MKT/Sản phẩm/CS thêm/Nhân viên...) kết thúc bằng 1 dòng "Tổng" in đậm, kẻ trên, dùng chung `_srTotalRowHtml_(cells)`. Cột % (VD %HT KPI báo cáo C) cho dòng tổng tính tỷ lệ có trọng số (Σkết quả ÷ ΣKPI) — KHÔNG cộng dồn % từng dòng.

## Biểu đồ — hàm chung `_srChartSvg(rows, nameKey, valueKey, type, moneyFmt, ordersKey)`
- Chế độ tròn vẽ donut (khoét vòng tròn màu nền đè giữa hình tròn đặc), hiện tổng ở giữa.
- Tham số thứ 6 `ordersKey` (field đếm đơn theo dòng) → thêm dải KPI phía trên: 📦 Tổng số đơn | 💰 Tổng doanh thu | 📊 Trung bình/đơn. Đang gắn cho: Theo Sale/Kênh/MKT (A), Theo Sale (B), doanh thu theo mức đơn hàng (E). Các mục khác (SP theo số lượng, CS thêm KH mới, Hoa hồng theo cột hoa hồng, C theo %HT KPI) cố tình không gắn vì không có khái niệm "1 đơn" rõ ràng.
- Sửa hàm này → grep TOÀN BỘ nơi gọi.

## Báo cáo B — bộ lọc
- 3 bộ lọc CRM (Tình trạng CS, Trạng thái KH, Kết bạn Zalo) dùng combo gõ-tìm/tick-nhiều/chip như Sale/Nguồn đơn/Marketer (đã bỏ `<select multiple>`). Config dùng chung `_SRB_COMBO_CFG`: mỗi mục khai `label`/`optKey` tĩnh (đọc từ `_srState`, như 3 filter gốc) hoặc `getLabel()`/`getOptions()` dạng hàm (cs/kh/zalo — vì danh sách Tình trạng CS và tên trường có thể bị admin đổi, phải đọc lại mỗi lần vẽ).
- Bộ lọc multi-select mới cho báo cáo B → mở rộng `_SRB_COMBO_CFG`, KHÔNG dựng listbox/widget riêng.
- `exportSalesReportToSheet()` PHẢI gửi đúng y hệt bộ filter như lúc xem (dateFrom/dateTo/sale/nguon/marketer/careStatus/khStatus/zaloStatus/nickZalo). Từng lệch ở B (thiếu 3 filter CRM khi xuất, đã fix). Số liệu "Xuất ra Sheet" không khớp màn hình → soi chỗ này đầu tiên.

## Báo cáo C
Dùng chung `_srRenderCTable` (client). Xem thêm quy ước dòng Tổng ở trên.

## UI chung
Design token `:root`, wrapper cuộn ngang bảng rộng, dropdown "⚙ Cài đặt" admin: xem cuối `01-rules-and-deploy.md`.

## AI phân tích team (v13.23) — `js/30-fn-teamanalysis.js` + `teamAnalysis_` (gas_v13.js)
- Menu trái → 📊 Báo cáo → "🤖 AI phân tích team" (chỉ admin). Chọn khoảng ngày → bảng xếp loại từng người + tổng quan/điểm tốt/rủi ro.
- Server gom 4 báo cáo có sẵn theo tên chuẩn hoá (`_normTxt_`): `buildSaleKpiReport_` (doanh thu, đơn, %KPI), `buildKpiReport_` (tin nhắn, tỷ lệ chốt Pancake), `buildFailedOrderReport_` (đơn thất bại), `buildCareLeadReport_` (CS thêm KH).
- Điểm 0–100 do QUY TẮC (`scoreTeam_`): %KPI 45 + doanh thu so với team 20 + tỷ lệ chốt so với mức giữa team 20 + chất lượng đơn 15; thành phần thiếu số liệu bị bỏ qua (không trừ điểm). ≥70 Làm tốt, 45–69 Trung bình, <45 Cần cải thiện, <2 thành phần = Chưa đủ dữ liệu. AI (`_taCallAI_`: Groq→Cerebras→Gemini) CHỈ viết nhận xét/việc cần làm, KHÔNG đổi xếp loại; AI lỗi/thiếu key vẫn ra bảng đầy đủ (nhận xét theo quy tắc). Không gửi SĐT khách cho AI.
- Kết quả có AI cache 10 phút theo khoảng ngày (`teamAI_v1_*`); nút "↻ Làm mới" = `&refresh=1`. Đổi trọng số/ngưỡng → sửa `scoreTeam_` rồi đổi key cache (`v1`→`v2`).
- Chưa rõ: "đơn thất bại" có nằm trong "số đơn" của KPI Sale không — hiện tính tỷ lệ thất bại = thất bại ÷ (đơn + thất bại).

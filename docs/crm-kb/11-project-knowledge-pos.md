# Project knowledge "Crm" — bản cập nhật cho Danh sách KH khớp đơn POS (2026-11-17)

> File này là BẢN DÁN SẴN vào Project knowledge "Crm" (Duyên tự dán). Nội dung đã đối chiếu với `gas_v13.js` và `docs/crm-kb/05`, `07`.
> Chi tiết kỹ thuật đầy đủ nằm ở `05-sasum-reports-ui.md` mục "Tab Danh sách KH — khớp đơn POS" và `07-reference-tables.md`.

## 1. Thêm 2 dòng vào bảng action GAS
| Action | Method | Mục đích |
|---|---|---|
| donDaily | GET | Đơn POS THEO TỪNG ĐƠN (`?days=90`, 1..400; chỉ cache bản 90 ngày, key `don_daily_v1`). Trả `rows` = [sđt, ngày, tên khách, [sale…], doanh thu, [[sale, tiền phần chia]…]] và `skipped` {noPhone,noPhoneRev,noDate,noDateRev} (đơn có trong Báo cáo B nhưng không gắn được vào khách). Cùng quy tắc với Báo cáo B. |
| donDayDiag | GET | CHỈ ĐỌC, chẩn đoán: `?date=YYYY-MM-DD&sale=<tên, trống = mọi sale>` trả đơn POS của 1 ngày để đối chiếu Danh sách KH. Client: `js/86-pos-diag.js` (nút admin "🔍 Đối soát POS"). |

## 2. Quy ước "Danh sách KH khớp đơn POS"
- Danh sách KH = nguồn **đơn POS + đơn Base**, **1 khách / 1 SĐT**. SĐT chỉ có ở POS được thêm vào danh sách (cờ `posOnly`) và **KHÔNG ghi vào careData**. Chỉ nhận SĐT dạng chuẩn `0xxxxxxxxx`.
- Khi lọc ngày và/hoặc CS, cột Đơn/DT hiện 2 dòng: dòng 1 = cả đời; dòng 2 (xanh) = phần của CS đang lọc trong khoảng ngày (chia theo `shares` của Báo cáo B). Hạng/tier khách vẫn theo cả đời.
- Thanh `#pos-recon-bar`: "✓ Khớp POS" khi đủ khách, "⚠ Lệch POS" kèm danh sách khách thiếu + lý do. Muốn đổi cách chia: `js/91-pos-revenue.js` (`posRevView_`).
- Dò 1 SĐT vì sao không hiện: nút "🔍 Đối soát POS" → ✓ / A chưa có khách / B khách không có ngày đơn / C CS không trong `csSet` / D bị bộ lọc khác / đơn Hủy-Hoàn bị loại.

## 3. Cấu trúc repo — nhóm file mới
`js/86-pos-diag.js` (nút Đối soát) · `js/88-pos-orders.js` (tải + giữ đơn POS) · `js/89-pos-customers.js` (khách chỉ có POS) · `js/90-pos-filter.js` (lọc ngày/CS theo đơn POS) · `js/91-pos-revenue.js` (Đơn/DT theo đơn đang lọc) · `js/92-pos-recon.js` (thanh đối soát).
Thứ tự nạp trong `index.html`: 88 → 89 → 90 → 91 → 92; `js/86` nạp giữa js/85 và js/88. Test: `tools/test-pos-*.js`.

## 4. Quy ước Báo cáo B (đã gặp khi làm phần này)
- Đơn POS 1 mã mà đơn gốc Base Thất bại/Hủy thì bị loại (trừ ghi chú lên lại / đổi / BH).
- Đơn NG và đơn đổi/lên lại T10 VẪN được tính.
- Bảng "Theo Sale" cộng thêm phần Sale 30% đơn quầy nên có thể lệch thẻ tổng.

## 5. Thêm vào "Câu hỏi nên tự hỏi trước khi báo đã xong"
6. Wrapper mới có đọc biến toàn cục của app (`customerMap`, `careData`, `careLeads`, `cskhData`) phải dùng TÊN TRẦN kèm `typeof`, KHÔNG dùng `window.<tên>`: các biến này khai báo bằng `let` ở js/06 nên không nằm trong `window` (test bằng `vm` không bắt được vì biến được gán lên context).

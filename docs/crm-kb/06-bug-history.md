# 06 — Lịch sử lỗi đã sửa (dò nhanh khi có báo lỗi mới)

Thêm mục mới ở CUỐI, mỗi mục: triệu chứng → nguyên nhân gốc → cách sửa → file/hàm.

1. **Panel/nút Zalo AI vô hình** — extension gốc không có CSS nào, thiếu `position: fixed`. Sửa: thêm `zalo-content.css` + khai báo trong manifest; đổi icon riêng cho từng extension (trước dùng chung 1 PNG). → `03-extension-zalo.md`
2. **Groq + Gemini cùng lỗi 1 lượt** — model ID hardcode trong `callAI_` đã bị hãng khai tử, không phải sai key. → `02-backend-gas.md` (mục AI)
3. **Selector Pancake đoán sai** (`.mdl-js`, `.message-text-field`) — sửa 2 lần qua xác minh DevTools cùng người dùng → `#message-col-list` / `.body-conver-item`. → `04-extension-pancake.md`
4. **Báo cáo B chia doanh thu sai** — cột "Thẻ" lẫn trạng thái đơn bị tính nhầm thành 1 sale. Sửa bằng `_donSaleNamesFromThe_`. → `02-backend-gas.md`
5. **Giỏ hàng Pancake nhét cả cụm chất liệu vào 1 ô** — sửa bằng `_parseNumberedList_` + checkbox tick-nhiều. → `04-extension-pancake.md`
6. **Xuất Sheet Báo cáo B lệch màn hình** — thiếu 3 filter CRM khi xuất; đã fix trong `exportSalesReportToSheet()`. → `05-sasum-reports-ui.md`
7. **Trang index.html nặng/lag** (2026-09-27) — khối `gas-code-v9` (~330KB) nhúng inline; đã gỡ, nút Copy mã GAS chuyển sang `getGasSource`. → `01-rules-and-deploy.md`
8. **Token GitHub bị dán dạng chữ thường nhiều lần qua các phiên** — đã nhắc revoke/tạo mới; chưa xác nhận người dùng đã làm. KHÔNG lưu token vào bất kỳ đâu.
9. **Tài khoản test (demo) lộ dữ liệu nguồn CSKH-Duyên** (2026-10-10) — server cắt `rows` còn 5 nhưng `cskhDuyenLite` vẫn trả `total/noPhone` thật và `noPhoneSample` (≤20 tên khách thật); client còn đọc cache máy (IndexedDB `cskh_lite_v1`/`orders_v1`, localStorage `ome_cskh_duyen*`) do admin/CS đăng nhập trước đó trên cùng trình duyệt. Sửa: `_demoClip_` ép total=5/noPhone=0/noPhoneSample=[] cho cskhDuyen*; client `_isDemoSession_()` bỏ đọc/ghi cache + xoá cache khi đăng nhập demo. → `02-backend-gas.md`

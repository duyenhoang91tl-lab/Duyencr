# teamduyen
team Duyên

## Cấu trúc repo
- `extension-zalo/` — Chrome extension "Duyên AI" cho chat.zalo.me.
- `extension-pancake/` — Chrome extension cho pos.pancake.vn/pages.fm và Messenger (bao gồm tính
  năng tư vấn phong thủy Thu Hiền: tra mệnh tức thì + mẫu canned response, chỉ hiện trên nền tảng
  Messenger — xem `extension-pancake/README.md`).
- `gas_v13.js`, `index.html` — backend Google Apps Script + giao diện web portal CRM.


---

## Quy ước làm việc (áp dụng cho mọi thay đổi sau này)

1. **Sửa `gas_v13.js` xong phải "Đồng bộ mã GAS" TRÊN APP ĐANG CHẠY THẬT, không phải trong repo.** Từ ~28/09/2026, `index.html` KHÔNG còn nhúng sẵn nội dung GAS nữa (đã bỏ khối `<script type="text/plain" id="gas-code-v9">` để trang nhẹ hơn — file `sync_gas_to_index.py` cũ đã xoá, không dùng nữa). Cơ chế mới: nút "📋 Copy Apps Script Code" lấy mã từ server qua `action=getGasSource`, mã đó được nạp bằng cách vào ⚙ Google Sheets → mở mục "🔄 Đồng bộ mã GAS mới nhất (Admin)" → dán TOÀN BỘ nội dung `gas_v13.js` mới nhất vào ô đó → bấm "🔄 Đồng bộ" (gọi `action=setGasSource`, lưu chunk qua Settings). Vì bước này cần app đang chạy thật (không phải thao tác trên repo), Claude/Codex sửa xong `gas_v13.js` trong repo thì phải NHẮC Duyên tự làm bước dán-và-Đồng bộ này — không có cách nào làm thay từ phía repo. Sau khi Đồng bộ xong mới bấm "📋 Copy Apps Script Code", dán vào Apps Script Editor và **Triển khai phiên bản mới**.
2. **Mọi báo cáo/tab có lọc theo ngày PHẢI có bộ lọc nhanh cố định**: Hôm nay · Hôm qua · Tuần này · Tuần trước · Tháng này · Tháng trước · Quý này · Quý trước · Năm này · Năm trước · Tuỳ chỉnh. Dùng chung `_PK_QUICK_RANGES` + `_pkQuickRange(key)` + `_quickRangeSelectHtml(...)` trong `index.html` — không tự viết bộ lọc mới.
3. **Tên báo cáo doanh số hiển thị:** A = **Base** (DT tổng) · B = **Pos** · C = **So sánh kỳ Base** · D = **Sale tự thêm** · E = **Hoa hồng nhân viên Pos**.
4. **Checklist MKT** tự tính từ Báo cáo Pancake + Base (không nhập tay theo ngày); mục tiêu/mẫu số từng tag điền **1 lần cho cả tháng** (Settings key `mktChecklistConfig`).

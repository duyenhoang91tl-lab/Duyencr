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

1. **Sửa `gas_v13.js` xong phải chạy `python3 sync_gas_to_index.py`.** Nút "Copy code" trong modal ⚙ Google Sheets của `index.html` lấy mã GAS từ khối `<script type="text/plain" id="gas-code-v9">` — không đọc `gas_v13.js`. Quên đồng bộ thì bản copy ra là bản cũ. Sau đó dán vào Apps Script và **Triển khai phiên bản mới**.
2. **Mọi báo cáo/tab có lọc theo ngày PHẢI có bộ lọc nhanh cố định**: Hôm nay · Hôm qua · Tuần này · Tuần trước · Tháng này · Tháng trước · Quý này · Quý trước · Năm này · Năm trước · Tuỳ chỉnh. Dùng chung `_PK_QUICK_RANGES` + `_pkQuickRange(key)` + `_quickRangeSelectHtml(...)` trong `index.html` — không tự viết bộ lọc mới.
3. **Tên báo cáo doanh số hiển thị:** A = **Base** (DT tổng) · B = **Pos** · C = **So sánh kỳ Base** · D = **Sale tự thêm** · E = **Hoa hồng nhân viên Base**.
4. **Checklist MKT** tự tính từ Báo cáo Pancake + Base (không nhập tay theo ngày); mục tiêu/mẫu số từng tag điền **1 lần cho cả tháng** (Settings key `mktChecklistConfig`).

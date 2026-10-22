# Chế độ tối & font toàn CRM (2026-10-16)

## Font
**Be Vietnam Pro** (Google Fonts, thiết kế riêng cho tiếng Việt) cho toàn bộ giao diện. `index.html` nạp `wght@400;500;600;700` với `display=swap` (đã có sẵn từ trước cho trang Phân quyền); `css/01-base.css` đặt `--font` và `body{font-family:var(--font)}`; `button,input,select,textarea{font-family:inherit}` để ô nhập/nút không dùng font hệ thống riêng của trình duyệt; số trong bảng dùng `tabular-nums` (cột tiền/đơn thẳng hàng). Chưa tải xong/offline → font hệ thống thay thế, không vỡ bố cục. Đo bằng Chrome thật: không có chữ bị cắt ở danh sách khách, chat, hồ sơ khách.

## Chế độ tối — vì sao trước đây "bị nền đen / chữ vô hình"
`css/10-dark.css` chỉ đổi các biến (`--bg`, `--surface`, `--text`…). Nhưng CSS/HTML có ~870 chỗ dùng MÀU CỨNG (`#fff`, `#f3f4f6`, `#fef3c7`, chữ `#9a3412`…) và giao diện "pro" (`css/06-pro.css`) có biến riêng `--pro-*`. Hậu quả: nền vẫn sáng + chữ đã sáng (chữ vô hình: tên khách, bong bóng chat, hồ sơ khách), hoặc nền tối + chữ tối.

## Cách sửa: lớp tối TỰ SINH
`node tools/gen-dark-theme.js` đọc mọi màu cứng trong `css/*.css`, khối `<style>` và `style="…"` inline (index.html + js/*.js) rồi ghi `css/99-dark-auto.css` (nạp SAU CÙNG; mọi quy tắc đều có tiền tố `html[data-theme="dark"]` nên **chế độ sáng không đổi**; `tools/test-dark-theme.js` kiểm điều này).
- **Nền** sáng → `--surface/--surface2/--surface3` (trung tính) hoặc màu pha tối cùng sắc (vàng nhạt → vàng tối…). Nền đặc/đậm (nút xanh, badge) giữ nguyên. Gradient có điểm sáng thì đổi cả các điểm trung bình.
- **Chữ** tối trung tính → `--text/--muted/--hint`; chữ màu tối → cùng sắc nhưng sáng hơn (tương phản ≥ 4.5:1, test kiểm). Chữ trên nền KHÔNG đổi thì giữ nguyên (tránh chữ sáng trên nền sáng vừa).
- **Viền** sáng → `--border-md`.
- **Biến** (`--pro-line/soft/grey`) đổi theo vai trò đoán từ tên; biến thương hiệu dùng vừa làm nền vừa làm chữ (`--pro-ink`, `--pro-purple`, `--pro-blue`…) giữ giá trị, chỉ đổi chỗ dùng làm màu chữ.
- **Tự động mỗi lần build:** `tools/build-dist.js` sinh lại trước khi nén, nên bản phát hành không bao giờ dùng bản cũ. Sau khi đổi màu cứng trong CSS/JS, chạy `node tools/gen-dark-theme.js` và commit file sinh (hoặc `--check` để kiểm).
- **Ngoại lệ thủ công:** phần tử gán style bằng JS `el.style.cssText='background:#…'` (trình duyệt chuẩn hoá thành `rgb()` nên không khớp theo hex) → thêm id + quy tắc ở cuối `css/10-dark.css` (hiện: `#sync-err-banner`, `#row-err-banner`, `#dp-refresh-hint`, `#deploy-guide-banner`). Test cảnh báo nếu có chỗ mới.

## Kiểm tra bằng mắt
`tools/shot-chat-ui.mjs` (Chrome thật, xem đầu file). Biến thể chụp nhiều màn hình + bật `THEME=dark` dùng cùng cách: đặt `localStorage.ome_theme='dark'` trước khi nạp trang.

## Chưa làm / lưu ý
- Màu đặt bằng JS lúc chạy (`el.style.color='#…'`, vài chỗ trong `js/22`) và `rgba(255,255,255,…)` không được tự đổi; ảnh/biểu đồ canvas giữ nguyên.
- Pill ngày trong chat (`16/10/2026`) còn nền xám nhạt — đọc được, chưa đổi.
- Test: `node tools/test-dark-theme.js` (anh xạ màu, ngữ cảnh chữ/nền, parser CSS, mọi quy tắc có tiền tố tối, thứ tự nạp, font).

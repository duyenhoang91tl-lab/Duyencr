# 10 — Ghi chú thiết kế lại giao diện R0–R12 (cập nhật 2026-11-15)

Kế hoạch gốc + nhật ký từng bước nằm ở `HANDOFF.md` (mục "KẾ HOẠCH THIẾT KẾ LẠI TOÀN BỘ CRM" và các mục R4–R11). File này chỉ giữ QUY ƯỚC cần nhớ khi sửa giao diện.

## Quy ước
- **Mã thiết kế:** `css/00-tokens.css` (biến `--ui-*`). Màu là BÍ DANH của `--bg/--surface/...` nên tự theo chế độ tối + theme Hoàng hôn. `--green` cũ thực ra là màu chính thương hiệu → dùng `--ui-brand`; xanh lá thật = `--ui-success`.
- **File CSS mới** (`css/20-kit … 27-settings-hub`) phải TOKEN-ONLY: không viết mã màu cứng; thêm tên file vào `TOKEN_ONLY` trong `tools/test-tokens.js`; sau đó `node tools/gen-dark-theme.js` (kiểm: `--check`). Viết CSS cũ/inline có mã hex thì bản tối tự sinh ở `css/99-dark-auto.css`.
- **Bộ thành phần** `js/68-ui-kit.js` (`uiStat_, uiChip_, uiBadge_…`) + khuôn `js/76-report-frame.js` (`uiReportFrame_`). Cách bọc an toàn đã dùng cho Nhật ký/Cấu hình/Tài khoản/Phòng ban: hàm cũ giữ nguyên, hàm mới chỉ đổi HIỂN THỊ, thiếu js/68 hoặc 76 thì HTML y hệt bản cũ từng ký tự; test so với commit cũ (`git show <commit>:js/...`). KHÔNG đụng hàm lưu/xoá khi đổi giao diện hộp thoại (test so thân hàm với HEAD).
- **Đo hiệu năng:** `node tools/test-budget.js` (trần dung lượng trang: JS/CSS/index/gzip/số script/`!important`). Bản nén: `tools/build-dist.js` (cần `npm i --no-save terser@5 clean-css@5`; `dist/` bị gitignore).
- **PWA:** `sw.js` ưu tiên mạng, rơi về bản lưu khi chậm >4 giây/mất mạng, chỉ GET cùng miền (test `tools/test-crm-sw.js`). Đổi tên `V` trong sw.js khi muốn xoá sạch cache cũ.
- **Test cần jsdom** (nhiều test giao diện): `npm i --no-save jsdom@24` ở thư mục tạm rồi `NODE_PATH=<thư mục>/node_modules node tools/test-xxx.js`. Chạy cả bộ (15/11, sau R8f): 324/324 đạt khi đã cài `jsdom@24 terser clean-css` CHUNG 1 lần + `node tools/build-dist.js` (cài lẻ từng gói sẽ gỡ gói kia). Thiếu jsdom thì ~35 test giao diện đỏ giả.

## Đã chốt KHÔNG làm (Duyên 16/11) — phiên sau KHÔNG đề xuất lại
R10a (rà 380px), R11a (gộp CSS/bỏ `!important`), R11b (nạp JS theo tab), R12a (checklist ảnh 8 màn). Còn mở: R0b ảnh "trước" (không cần nữa nếu Duyên không gửi); cột "Mức" nóng/ấm/nguội ở Danh sách KH; Tài khoản/Phòng ban/Nhật ký mới chỉ đổi hiển thị, chưa có ảnh xác nhận.

# 10 — Ghi chú thiết kế lại giao diện R0–R12 (cập nhật 2026-11-15)

Kế hoạch gốc + nhật ký từng bước nằm ở `HANDOFF.md` (mục "KẾ HOẠCH THIẾT KẾ LẠI TOÀN BỘ CRM" và các mục R4–R11). File này chỉ giữ QUY ƯỚC cần nhớ khi sửa giao diện.

## Quy ước
- **Mã thiết kế:** `css/00-tokens.css` (biến `--ui-*`). Màu là BÍ DANH của `--bg/--surface/...` nên tự theo chế độ tối + theme Hoàng hôn. `--green` cũ thực ra là màu chính thương hiệu → dùng `--ui-brand`; xanh lá thật = `--ui-success`.
- **File CSS mới** (`css/20-kit … 27-settings-hub`) phải TOKEN-ONLY: không viết mã màu cứng; thêm tên file vào `TOKEN_ONLY` trong `tools/test-tokens.js`; sau đó `node tools/gen-dark-theme.js` (kiểm: `--check`). Viết CSS cũ/inline có mã hex thì bản tối tự sinh ở `css/99-dark-auto.css`.
- **Bộ thành phần** `js/68-ui-kit.js` (`uiStat_, uiChip_, uiBadge_…`) + khuôn `js/76-report-frame.js` (`uiReportFrame_`). Cách bọc an toàn đã dùng cho Nhật ký/Cấu hình/Tài khoản/Phòng ban: hàm cũ giữ nguyên, hàm mới chỉ đổi HIỂN THỊ, thiếu js/68 hoặc 76 thì HTML y hệt bản cũ từng ký tự; test so với commit cũ (`git show <commit>:js/...`). KHÔNG đụng hàm lưu/xoá khi đổi giao diện hộp thoại (test so thân hàm với HEAD).
- **Đo hiệu năng:** `node tools/test-budget.js` (trần dung lượng trang: JS/CSS/index/gzip/số script/`!important`). Bản nén: `tools/build-dist.js` (cần `npm i --no-save terser@5 clean-css@5`; `dist/` bị gitignore).
- **PWA:** `sw.js` ưu tiên mạng, rơi về bản lưu khi chậm >4 giây/mất mạng, chỉ GET cùng miền (test `tools/test-crm-sw.js`). Đổi tên `V` trong sw.js khi muốn xoá sạch cache cũ.
- **Test cần jsdom** (nhiều test giao diện): `npm i --no-save jsdom@24` ở thư mục tạm rồi `NODE_PATH=<thư mục>/node_modules node tools/test-xxx.js`. Chạy cả bộ (15/11, sau R8f): 324/324 đạt khi đã cài `jsdom@24 terser clean-css` CHUNG 1 lần + `node tools/build-dist.js` (cài lẻ từng gói sẽ gỡ gói kia). Thiếu jsdom thì ~35 test giao diện đỏ giả.

## Việc còn mở (cần ảnh/quyết định của Duyên)
R0b ảnh "trước"; R10a rà 380px (cần ảnh điện thoại); R11a gộp CSS/bỏ `!important` và R11b nạp JS theo tab (quy tắc 14 + đổi cấu trúc: cần Duyên cho phép); R12a checklist 8 màn có ảnh; Tài khoản/Phòng ban/Nhật ký mới chỉ đổi hiển thị, chưa có ảnh xác nhận.

## Chấm điểm khách (js/77) — quy ước cần nhớ
- Điểm/mức/lý do/ngưỡng CHỈ tính ở `js/77` (`lsScore_`); cột "Mức" (R8e), hồ sơ 360° (R8c), trợ lý quy tắc (R8d) và AI thật (R8f, `lsAiBlock_`) đều đọc cùng 1 nguồn để không bao giờ lệch nhau. Đổi ngưỡng ở hằng đầu `js/77`, không sao chép số sang chỗ khác.
- AI thật (`PRO_AI_ENGINE='ai'`, js/38) nhận điểm khách như DỮ LIỆU trong NGỮ CẢNH (prompt hệ thống GAS vốn đã ép "chỉ dùng số liệu trong NGỮ CẢNH") nên KHÔNG cần đổi GAS. Mặc định vẫn là `'rule'`.
- Mọi bộ lọc/kiểu xếp mới của Danh sách KH phải thêm vào `_filterSignature` (js/08).

## Chiều cao hộp/modal — dùng `--vh`, KHÔNG dùng `NNvh` trần (R13)
- WebView app Android có lúc kẹt đơn vị `vh` = 0 → hộp `max-height:NNvh` thành dải trắng mỏng. `js/59-fn-mobilefit.js` đặt biến CSS `--vh` (= innerHeight/100 px; hàm thuần `mobileFitVhPx_`, cập nhật mỗi `mobileFitApply`). Viết `max-height:calc(var(--vh,1vh)*NN)` (chưa đo được thì rơi về 1vh như cũ); modal toàn màn đổi cả `height:100vh`.
- `tools/test-vh-var.js` quét js/css/index.html (trừ `css/99` tự sinh) và ĐỎ nếu còn `max-height:NNvh` trần. Cố ý không đổi: `padding-top:Nvh`, `min-height`, `calc(100vh - Npx)` (vh=0 thì vô hại), `.app` (js/59 đã ép px), hộp chip Tổng quan (`hmModalMaxH_`, js/36).

## Thanh giai đoạn bấm được (R14)
- `proStageHtml_(model,{phone})` (js/33) vẽ ô bấm được; không truyền `phone` thì chỉ xem (HTML như cũ). Bộ bắt sự kiện đặt 1 lần ở `document` (`window._proStageBound_`), dùng chung hồ sơ khách + panel Chat (js/48).
- Đổi tình trạng đi 2 đường: có `#cs-status` → `saveCare` (đường chuẩn); không có form → `proStageSet_` ghi thẳng `careData` theo đúng các bước `saveCare`. **Đổi `saveCare` (js/03) thì phải sửa nhánh ghi thẳng trong `proStageSet_` cho khớp.** Test: `tools/test-stage-click.js`.


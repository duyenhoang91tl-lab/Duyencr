# Trang web "Viết tắt" cho điện thoại (iPhone + Android)

Mở bằng trình duyệt (Safari trên iPhone, Chrome trên Android): **https://duyenhoang91tl-lab.github.io/Duyencr/viettat.html**
Dùng chung kho với CRM (tab Zalo AI → ⌨️ Viết tắt): mục CHUNG của team + mục RIÊNG của bạn. Chỉ ĐỌC; sửa trên CRM rồi bấm 🔄 trong trang.

## Cài lên màn hình chính (như một app) — bản iOS chính thức là PWA
Trang là PWA đầy đủ (`viettat.webmanifest`, `viettat-sw.js`, biểu tượng `viettat-icon-*.png`): có biểu tượng riêng "VT", mở toàn màn hình, xem được khi mất mạng; lần đầu mở trang hiện khung hướng dẫn cài (iPhone: Chia sẻ → Thêm vào MH chính; Android/Chrome: nút Cài ngay). **Vì sao không có file .ipa:** iPhone chỉ cài app ngoài App Store khi có Mac + tài khoản Apple Developer (99$/năm) để ký; PWA là cách tải về dùng được ngay. Test: `node tools/test-viettat-pwa.js`.

- **iPhone (Safari):** nút Chia sẻ → *Thêm vào MH chính*.
- **Android (Chrome):** menu ⋮ → *Thêm vào màn hình chính*.

## Cách dùng (giao diện bám app Android, viết lại 2026-11-17)
1. Lần đầu nhập **Tên CS** (giống tên trong CRM) → *Lưu & tải dữ liệu*. Đổi tên: ⋮ → *Đổi tên CS*.
2. Trên cùng: thẻ trạng thái (số mục, tên CS, giờ cập nhật) + ⋮ (☁ Cập nhật từ CRM / Đổi tên CS). Ô tìm bo tròn (gõ viết tắt, từ khoá, nội dung, tên ảnh/ghi âm — viết tắt gõ đúng nằm trên cùng), chip 📁 thư mục (cây mẹ/con), ô **Tên khách** cho `{tên}`.
3. Danh sách là các **thẻ mục** như app: viết tắt đậm + ☁ CRM / 👤 Của tôi, từ khoá, xem trước 2 dòng, "N nội dung · 🖼 · 🎤". Mục chỉ có 1 tin chữ có nút **📋 Chép** chép ngay.
4. **Chạm thẻ** → bảng chọn phía dưới (như Picker của app): chạm để chọn nhiều tin chữ + ô hình (🔍 xem to) + ghi âm (▶ Nghe). Thanh dưới: ✕ đóng · "Đã chọn n" · **Chia sẻ** · **Sao chép** (chữ nối bằng xuống dòng; chọn đúng 1 hình thì chép hình).
5. Tự đổi sáng/tối theo hệ thống.

## Lỗi riêng của Safari đã xử lý (2026-11-17)
- **Chia sẻ hình/ghi âm bị Safari chặn**: Safari chỉ cho mở bảng chia sẻ khi gọi NGAY trong cú chạm, bản cũ tải hình xong rồi mới gọi → `NotAllowedError`. Nay hình/ghi âm được tải sẵn khi chọn; chưa tải xong thì báo "bấm Chia sẻ lần nữa" (lần sau mở ngay).
- **Sao chép chữ dự phòng**: iOS cần `setSelectionRange` thì `execCommand('copy')` mới chép được.
- **Bấm ra ngoài không đóng menu/cây thư mục**: iOS không phát sự kiện bấm lên nền không "bấm được" → dùng lớp nền riêng (`#nback`, `#mback`) + `cursor:pointer`.
- Ô nhập `-webkit-appearance:none` + cỡ chữ 16px (không bị phóng to khi chạm); `100dvh`; gọi GAS có hạn giờ 25s (không treo mãi "Đang tải").
- Hình bấm 1 lần = chọn ngay (bỏ chờ 300ms bấm đúp; phóng to bằng nút 🔍).

## Khác app Android
Trang web **không tự bung khi gõ viết tắt** trong Zalo/Messenger: iPhone không cho app/trang web nào đọc ô gõ của app khác (muốn làm được phải có bàn phím tuỳ chỉnh bản gốc, cần Mac + Apple Developer). Cách gần nhất: mở trang → gõ viết tắt vào ô tìm → **📋 Chép** (hoặc chạm mục → chọn → Sao chép/Chia sẻ) → dán vào ô chat.
Hình tải từ Drive khi cuộn tới (hình > 3MB hoặc chưa chia sẻ cho tài khoản chạy GAS sẽ báo lỗi).

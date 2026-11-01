# Trang web "Viết tắt" cho điện thoại (iPhone + Android)

Mở bằng trình duyệt (Safari trên iPhone, Chrome trên Android): **https://duyenhoang91tl-lab.github.io/Duyencr/viettat.html**
Dùng chung kho với CRM (tab Zalo AI → ⌨️ Viết tắt): mục CHUNG của team + mục RIÊNG của bạn. Chỉ ĐỌC; sửa trên CRM rồi bấm 🔄 trong trang.

## Cài lên màn hình chính (như một app) — bản iOS chính thức là PWA
Trang là PWA đầy đủ (`viettat.webmanifest`, `viettat-sw.js`, biểu tượng `viettat-icon-*.png`): có biểu tượng riêng "VT", mở toàn màn hình, xem được khi mất mạng; lần đầu mở trang hiện khung hướng dẫn cài (iPhone: Chia sẻ → Thêm vào MH chính; Android/Chrome: nút Cài ngay). **Vì sao không có file .ipa:** iPhone chỉ cài app ngoài App Store khi có Mac + tài khoản Apple Developer (99$/năm) để ký; PWA là cách tải về dùng được ngay. Test: `node tools/test-viettat-pwa.js`.

- **iPhone (Safari):** nút Chia sẻ → *Thêm vào MH chính*.
- **Android (Chrome):** menu ⋮ → *Thêm vào màn hình chính*.

## Cách dùng
1. Lần đầu nhập **Tên CS** (giống tên trong CRM) → *Lưu & tải dữ liệu*.
2. Gõ viết tắt / từ khoá ở ô trên (hoặc chọn thư mục). Điền **Tên khách** nếu nội dung có `{tên}`.
3. **Bấm 1 lần = chọn / bỏ chọn** (chọn nhiều cái cùng lúc, cuộn thoải mái). **Bấm đúp vào hình = phóng to xem full, bấm đúp lần nữa = thu nhỏ.**
4. Cuối trang: **Sao chép** (chữ nối bằng xuống dòng; chọn đúng 1 hình thì chép hình) hoặc **Chia sẻ** (chữ + nhiều hình qua bảng chia sẻ của điện thoại → chọn Zalo/Messenger…). Máy không chia sẻ được file thì chép chữ và tải hình về máy.

## Khác app Android
Trang web **không tự hiện khi gõ** trong Zalo/Messenger (iPhone không cho phép). Mở trang → chọn → Sao chép/Chia sẻ → dán vào ô chat.
Hình tải từ Drive khi cuộn tới (hình > 3MB hoặc chưa chia sẻ cho tài khoản chạy GAS sẽ báo lỗi).

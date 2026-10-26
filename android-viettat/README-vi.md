# Duyên CRM (Android) — CRM + gõ tắt trên điện thoại

App gồm 2 tab:
- **CRM**: chạy web CRM ngay trong app (đăng nhập giữ nguyên, nút Back quay lại, chọn file để nhập, xuất Excel qua bảng chia sẻ của Android). Mọi tính năng mới của CRM có ngay, không cần cài lại app.
- **Viết tắt**: gõ tắt trong mọi ô chat (mô tả bên dưới).

Gõ từ viết tắt/từ khoá trong bất kỳ ô chat nào (Zalo, Messenger, Pancake…) → hiện popup chọn nội dung → chèn. Dữ liệu **lấy từ CRM**
(tab Zalo AI → ⌨️ Viết tắt): mục CHUNG của team + mục RIÊNG của bạn. App chỉ ĐỌC; muốn thêm/sửa thì sửa trên CRM rồi bấm **☁ CRM** trong app để cập nhật.

## Cài đặt
1. Tải **VietTat.apk** (tên file giữ nguyên, app hiện tên **Duyên CRM**) ở trang Release `viettat-latest` của repo (hoặc mục Artifacts của lần chạy "Build Android VietTat") → mở file trên điện thoại → cho phép "Cài từ nguồn không rõ".
2. Mở app, nhập **Tên CS** (giống tên trong CRM) → *Lưu & cập nhật*.
3. Bấm **Bật dịch vụ "Viết Tắt" trong Trợ năng** → bật dịch vụ. (Android sẽ cảnh báo vì dịch vụ Trợ năng đọc được ô gõ — app chỉ dùng để nhận diện từ viết tắt.)
4. Mở ô chat, gõ viết tắt → hiện **màn chọn to**: cuộn xem hết chữ + hình; **bấm 1 lần = chọn/bỏ chọn** (chọn được nhiều cái 1 lúc), **bấm đúp vào hình = phóng to xem full, bấm đúp lần nữa = thu nhỏ**; cuối màn có ✕ Đóng · Chia sẻ · Chèn. *Chèn*: chữ nối bằng xuống dòng vào ô chat; 1 hình thì dán thẳng, nhiều hình/ghi âm thì mở bảng chia sẻ của Android (Android không dán được nhiều hình cùng lúc). *Chia sẻ*: luôn mở bảng chia sẻ. Biến: `{ngày} {ngày mai} {giờ} {thứ} {tên} {tên khách}`.

## Mục tự tạo trên máy
Vẫn tạo được (nút **+**), lưu riêng trong điện thoại, KHÔNG lên CRM. Mục lấy từ CRM có thư mục tên "CRM · …" và bị ghi đè mỗi lần cập nhật.
Thư mục con trên CRM (vd `Túi tiền/Cổ`, `Túi tiền/Lắc`) hiện thành các thư mục riêng "CRM · Túi tiền › Cổ", "CRM · Túi tiền › Lắc"… xếp cạnh nhau. Ảnh kèm của mục CRM được tải về khi bấm **☁ CRM** (lần đầu có thể lâu tuỳ số hình) và hiện cùng các lựa chọn chữ.

## Build
Tự động bằng GitHub Actions (`.github/workflows/build-android.yml`). Tự build trên máy: Android Studio mở thư mục này (hoặc `gradle assembleDebug` với Gradle 8.7 + JDK 17).

## Dùng trên iPhone / không muốn cài APK
Mở web CRM bằng Chrome (Android) hoặc Safari (iPhone) → menu → **Thêm vào màn hình chính / Cài đặt ứng dụng**. CRM đã có manifest + biểu tượng nên mở như app (không thanh địa chỉ).

## Cập nhật app
Từ bản có khóa ký cố định (versionCode 3 trở đi), tải VietTat.apk mới và cài ĐÈ lên bản cũ (giữ nguyên dữ liệu). Nếu đang dùng bản cũ hơn (ký bằng khóa tạm), phải **gỡ app cũ một lần** rồi cài bản mới — Android không cho cài đè khác chữ ký. Khóa ký nằm trong repo (`app/keystore/`), chỉ để cài thủ công; muốn lên Play Store thì đổi sang keystore riêng đặt trong GitHub Secrets.

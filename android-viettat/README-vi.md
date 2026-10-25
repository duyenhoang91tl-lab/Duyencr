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
4. Mở ô chat, gõ viết tắt → chọn nội dung trong popup. Biến: `{ngày} {ngày mai} {giờ} {thứ} {tên} {tên khách}`.

## Mục tự tạo trên máy
Vẫn tạo được (nút **+**), lưu riêng trong điện thoại, KHÔNG lên CRM. Mục lấy từ CRM có thư mục tên "CRM · …" và bị ghi đè mỗi lần cập nhật.

## Build
Tự động bằng GitHub Actions (`.github/workflows/build-android.yml`). Tự build trên máy: Android Studio mở thư mục này (hoặc `gradle assembleDebug` với Gradle 8.7 + JDK 17).

## Dùng trên iPhone / không muốn cài APK
Mở web CRM bằng Chrome (Android) hoặc Safari (iPhone) → menu → **Thêm vào màn hình chính / Cài đặt ứng dụng**. CRM đã có manifest + biểu tượng nên mở như app (không thanh địa chỉ).

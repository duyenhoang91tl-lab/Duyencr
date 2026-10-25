# Viết Tắt (Android) — gõ tắt trên điện thoại, dùng chung kho với CRM

Gõ từ viết tắt/từ khoá trong bất kỳ ô chat nào (Zalo, Messenger, Pancake…) → hiện popup chọn nội dung → chèn. Dữ liệu **lấy từ CRM**
(tab Zalo AI → ⌨️ Viết tắt): mục CHUNG của team + mục RIÊNG của bạn. App chỉ ĐỌC; muốn thêm/sửa thì sửa trên CRM rồi bấm **☁ CRM** trong app để cập nhật.

## Cài đặt
1. Tải **VietTat.apk** ở trang Release `viettat-latest` của repo (hoặc mục Artifacts của lần chạy "Build Android VietTat") → mở file trên điện thoại → cho phép "Cài từ nguồn không rõ".
2. Mở app, nhập **Tên CS** (giống tên trong CRM) → *Lưu & cập nhật*.
3. Bấm **Bật dịch vụ "Viết Tắt" trong Trợ năng** → bật dịch vụ. (Android sẽ cảnh báo vì dịch vụ Trợ năng đọc được ô gõ — app chỉ dùng để nhận diện từ viết tắt.)
4. Mở ô chat, gõ viết tắt → chọn nội dung trong popup. Biến: `{ngày} {ngày mai} {giờ} {thứ} {tên} {tên khách}`.

## Mục tự tạo trên máy
Vẫn tạo được (nút **+**), lưu riêng trong điện thoại, KHÔNG lên CRM. Mục lấy từ CRM có thư mục tên "CRM · …" và bị ghi đè mỗi lần cập nhật.
Thư mục con trên CRM (vd `Túi tiền/Cổ`, `Túi tiền/Lắc`) hiện thành các thư mục riêng "CRM · Túi tiền › Cổ", "CRM · Túi tiền › Lắc"… xếp cạnh nhau. Ảnh kèm của mục CRM chưa dùng trên Android (chỉ chèn chữ).

## Build
Tự động bằng GitHub Actions (`.github/workflows/build-android.yml`). Tự build trên máy: Android Studio mở thư mục này (hoặc `gradle assembleDebug` với Gradle 8.7 + JDK 17).

# Duyên AI - Pancake

Extension riêng cho **Pancake (POS/Chat, pancake.vn / pages.fm)** và **Messenger (messenger.com)** —
tách ra từ extension gộp "Duyên AI" trước đây.

## Cài đặt (load unpacked)
1. Mở `chrome://extensions`
2. Bật "Developer mode" (góc trên phải)
3. Bấm "Load unpacked" → chọn thư mục `extension-pancake/`

## Cấu hình
Bấm icon extension → "Mở cài đặt chi tiết" → trang Options có:
- URL backend GAS (dùng chung với extension "Duyên AI - Zalo")
- Bật/tắt cho từng nền tảng (Pancake / Messenger)
- Selector CSS cho từng nền tảng (messageList, messageItem, replyBox, v.v.)

## Ghi chú kỹ thuật
- `pancake-background.js` là service worker, tự gọi thẳng GAS backend — cùng payload shape với `zalo-content.js`
  bên extension Zalo (action `ai`, `lookup`, `saveSingle`, `users`...), nhưng đây là 2 extension độc lập,
  không share code hay share `chrome.storage` với nhau.
- Cấu hình lưu ở `chrome.storage.sync`.

## Giao diện/chức năng đồng bộ với Zalo AI

Panel Pancake AI đi theo đúng bố cục và các tính năng của Zalo AI:
- Chọn CS đang dùng (sticky), quét SĐT, form sửa Tên/Trạng thái CS/Trạng thái Zalo/Trạng thái KH/Sinh nhật/Lịch hẹn/Ghi chú, đồng bộ về CareData
- Bộ chọn **giọng văn** (Thân thiện/Chuyên nghiệp/Ngắn gọn/Nhiệt tình) + ô **Ngữ cảnh** tự do + checkbox **Tra cứu sản phẩm** ngay trong panel (không cần vào Options)
- Nút **"💬 Tạo 3 câu mở đầu"** — soạn sẵn 3 hướng chủ động nhắn khách (hỏi thăm trải nghiệm / gợi ý sản phẩm liên quan / khơi gợi trò chuyện), y hệt nội dung 3 hướng bên Zalo AI
- Prompt AI được ghép thêm hồ sơ khách (tên, SĐT, số đơn đã mua, sản phẩm đã mua, tình trạng CS, ghi chú gần nhất) — cùng cấu trúc `buildCustLines()` bên Zalo AI, để 2 kênh tư vấn nhất quán

### 2 khác biệt cố ý (không port 1:1)

1. **Quét trạng thái kết bạn Zalo tự động** — tính năng này CHỈ có bên Zalo AI vì nó quét số điện thoại đang hiển thị trên chính giao diện Zalo Web để đoán trạng thái kết bạn. Pancake không chạy trên nền Zalo nên không có tín hiệu này — trạng thái Zalo bên Pancake AI vẫn luôn là **điền tay** qua dropdown (đúng như yêu cầu).
2. **Nút tự động Gửi** — bên Zalo AI, 3 câu mở đầu có nút "📤 Gởi Zalo" tự điền + bấm gửi luôn. Bên Pancake AI, nút tương ứng chỉ là **"📥 Chèn vào ô trả lời"** — CS vẫn phải tự kiểm tra và bấm Gửi. Lý do: Messenger/Pancake không có API gửi tin công khai ổn định, và để tránh gửi nhầm tin không qua kiểm duyệt của người — giữ đúng nguyên tắc an toàn đã áp dụng cho tính năng gửi ảnh sản phẩm.

Các tính năng khác của Zalo AI **chưa port** vì cần xác nhận thêm trước khi làm (tránh đoán sai kiến trúc rồi phải sửa lại): **Gửi hàng loạt** (broadcast — cần biết cách Pancake cho phép tự động mở từng hội thoại + gửi), **quản lý nhiều Nick Zalo** (khái niệm nhiều tài khoản không rõ tương ứng gì bên Pancake), **"🔗 Liên kết đoạn chat"** (link thủ công 1 hội thoại với 1 khách khi tên hiển thị không phải SĐT).

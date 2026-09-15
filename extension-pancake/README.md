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

Các tính năng khác của Zalo AI **chưa port** vì cần xác nhận thêm trước khi làm (tránh đoán sai kiến trúc rồi phải sửa lại): **Gửi hàng loạt** (broadcast — cần biết cách Pancake cho phép tự động mở từng hội thoại + gửi).

## Nick Zalo/kênh + Liên kết đoạn chat (đã thêm)

- **💬 Nick**: dropdown chọn nick Zalo/kênh CS đang dùng, dùng CHUNG 1 danh sách với Zalo AI (setting `nickZaloList` trên GAS — thêm nick mới ở bên nào cũng thấy ở bên kia). Lựa chọn hiện tại tự nhớ theo máy (sticky), và được ghi kèm vào cột `nickZalos` của khách mỗi khi Lưu — giữ lại lịch sử nick nào đã từng tiếp xúc khách này, giống hệt cách Zalo AI ghi nhận.
- **🔗 Liên kết đoạn chat**: sau khi tra cứu đúng khách (dù là tự nhận diện SĐT hay gõ tay), bấm nút này 1 lần để "học" — extension ghi nhớ hội thoại đang mở (theo URL trang) tương ứng với SĐT đó. Lần sau mở lại ĐÚNG hội thoại này, dù không tự đọc được SĐT/khung "Sản phẩm order" (VD khách đổi tên hiển thị), Pancake AI vẫn tự nhận ra đúng khách — nhờ vậy **ghi chú/trạng thái CS/lịch hẹn nhập trong Pancake luôn cập nhật đúng khách trên CRM**, không bị lạc mất vì lỗi nhận diện.
  - Lưu cục bộ trên máy (`chrome.storage.local`), không đồng bộ giữa các máy CS khác nhau — mỗi máy cần liên kết riêng 1 lần cho mỗi hội thoại.
  - Khoá nhận diện dùng đường dẫn URL của hội thoại (ổn định hơn dùng tên hiển thị như bên Zalo AI, vì URL thường không đổi ngay cả khi khách đổi tên/biệt danh).

## Tư vấn phong thủy Thu Hiền (chỉ hiện trên Messenger, không ảnh hưởng Pancake)

Vì trang Messenger "Thu Hiền phong thủy" dùng chung extension này nhưng là **business khác** với
sản phẩm sức khỏe bên Pancake, các mục dưới đây chỉ bật khi `PLATFORM === 'messenger'`, không đổi
gì hành vi/danh sách trạng thái bên Pancake:

- **Trạng thái CS** đổi sang danh sách riêng phong thủy (Chờ gọi tư vấn / Đã gọi - đang theo dõi /
  Hẹn gọi lại / Không nghe máy / Đã chốt / Từ chối / Đang khiếu nại / Tạm ngừng chăm sóc) thay vì
  danh sách sản phẩm sức khỏe.
- **"Tình trạng KH"** đổi nhãn + danh sách thành **"Phân loại khách"** (Mới/Cũ/VIP/Tiềm năng) —
  dùng lại đúng cột `khStatus` sẵn có, không thêm cột mới vào CareData.
- **"Trạng thái Zalo"** ẩn đi (không áp dụng cho khách Messenger).
- **Sinh nhật → Mệnh**: gõ ngày sinh, panel tự tính mệnh Ngũ hành nạp âm ngay bên cạnh (tra bảng
  cục bộ, không gọi AI). ⚠ Đây là bảng CS cung cấp, chỉ khớp năm 1954–2013 — nên nhờ người có
  chuyên môn phong thủy trong công ty kiểm tra/bổ sung trước khi dùng chính thức rộng rãi hơn.
- **📋 Mẫu có sẵn**: panel mới liệt kê 11 mẫu canned response (5 mẫu theo mệnh + 6 mẫu giá/chính
  sách, từ file mẫu Beeftext CS cung cấp) — bấm 1 mẫu để **chèn thẳng vào ô trả lời** (dùng lại hàm
  `insertReply` có sẵn, tự xử lý cả contenteditable của Messenger).
- Dữ liệu mệnh + mẫu canned response đọc từ 2 sheet mới `Menh`/`CannedResponses` (tự tạo trong file
  CRM dùng chung) qua action `getKnowledge` mới thêm ở `gas_v13.js` — cache 20 phút trên máy CS
  (`chrome.storage.local`), không gọi Sheet mỗi tin nhắn. CS sửa trực tiếp 2 sheet này trên Google
  Sheets (không cần sửa code) để cập nhật mẫu/mệnh mới nhất.

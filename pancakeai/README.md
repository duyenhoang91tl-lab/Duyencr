# Trợ lý AI Pancake

Extension Chrome gợi ý trả lời khách hàng bằng AI, hoạt động trên **Pancake** (`pancake.vn`, `pages.fm`) và **Messenger** (`messenger.com`).

## Về kiến trúc (đã sửa lại sau khi đọc code thật của Duyên AI / Sasum)

Ban đầu mình đoán nhầm là backend dùng Flask + RAG server riêng — **sai**. Sau khi đọc `gas_v13.js` và `content.js` thật trong repo `Duyencr`, kiến trúc thật là:

- **Không có server riêng.** Toàn bộ backend là **1 Google Apps Script Web App** (`GAS_URL`) — cùng URL mà extension "Duyên AI" (Zalo) đang dùng.
- Khi cần gợi ý trả lời, extension chỉ cần `POST` tới `GAS_URL` với body `{ action: "ai", prompt, withProducts }` — y hệt cách `content.js` của Zalo AI gọi qua hàm `_aiCall_`.
- Phía GAS, hàm `callAI_` tự thử lần lượt 3 nhà cung cấp AI: **Groq → Cerebras → Gemini** (dùng cái nào có API key đã lưu và trả lời được). Key của cả 3 provider được lưu **1 lần trong Google Sheet** qua panel cài đặt của extension Zalo AI, dùng chung cho cả team — **extension Pancake này không cần tự lưu API key nào cả.**
- Prompt AI được ghép thêm ngữ cảnh từ sheet "AIContext" (system_prompt, quy trình CSKH, kịch bản bán hàng...) và tuỳ chọn tra cứu sản phẩm/FAQ theo từ khoá (`withProducts: true`).

➡️ **Vì vậy extension Pancake này không cần thêm bất kỳ dòng backend nào** — chỉ cần trỏ đúng vào `GAS_URL` sẵn có.

## Cài đặt (chế độ Developer)

1. Mở Chrome → `chrome://extensions`
2. Bật **Developer mode**
3. Bấm **Load unpacked** → chọn thư mục `pancakeai`

## Cấu hình bắt buộc

### 1. Lấy URL Web App GAS (chỉ 1 lần, dùng lại URL đã có)

Mở extension **Duyên AI** trên `chat.zalo.me` → bấm ⚙ → copy nguyên URL trong ô "URL Web App GAS" (dạng `https://script.google.com/macros/s/.../exec`).

Vào extension Pancake này → icon extension → "Mở cài đặt chi tiết" → dán vào ô **URL Web App GAS** → Lưu.

### 2. Selector đọc tin nhắn Pancake/Messenger

Vì mình không đăng nhập được vào Pancake thật của bạn, phần đọc hội thoại và ô trả lời cần bạn tự trỏ selector (làm 1 lần, ~5 phút):

1. Mở Pancake, mở 1 hội thoại khách
2. `F12` → tab **Elements** → bấm Inspect → click vào:
   - **Vùng chứa toàn bộ tin nhắn** → chuột phải → *Copy → Copy selector* → dán vào ô **messageList**
   - **Một dòng tin nhắn** → làm tương tự → dán vào **messageItem**
   - **Ô nhập trả lời** → làm tương tự → dán vào **replyBox**
3. Lưu lại trong Options. Lặp lại cho Messenger nếu dùng.

## Cấu trúc file

```
manifest.json  — khai báo extension (MV3), match domain pancake.vn / pages.fm / messenger.com
background.js  — gọi GAS_URL với action:'ai', tự retry khi gặp lỗi 429 (Groq rate limit)
content.js     — panel nổi, đọc hội thoại theo selector, chèn gợi ý vào ô trả lời
content.css    — giao diện panel
options.html/js — cấu hình GAS URL + selector
popup.html/js  — bật/tắt nhanh
```

## Tra cứu lịch sử khách hàng (đã thêm)

Extension tự động tra cứu khách hàng khi mở hội thoại, dùng chung `action:'lookup'` với Zalo AI:

- Tự động tìm số điện thoại VN (`0xxxxxxxxx`) xuất hiện trong vùng tin nhắn đang mở
- Nếu Pancake hiển thị SĐT khách ở 1 khu vực cố định (thường là sidebar thông tin khách), bạn có thể trỏ chính xác vào đó qua ô **phoneSelector** trong Options (F12 → Copy selector, giống cách lấy `messageList`) — chính xác hơn quét toàn trang
- Nếu để trống, extension tự quét toàn bộ vùng `messageList` tìm số điện thoại
- Panel hiện thẻ khách hàng: tên, số đơn, tổng doanh thu, sản phẩm đã mua, trạng thái CS, ghi chú gần nhất — lấy từ đúng Google Sheet CRM mà Zalo AI đang dùng
- **Tên khách hiển thị trên thẻ**: ưu tiên lấy từ dòng đầu tiên của khối trên cùng trong khung **"Sản phẩm order"** (ghi chú đơn hàng CS tự nhập tay khi chốt đơn — dạng "Chị : Tên", "Anh Tên", hoặc "Tên +sđt"), tự động bỏ số điện thoại và xưng hô (Anh/Chị) đi kèm. Nếu không tìm thấy khung này mới rơi về tên trong lịch sử đơn hàng, rồi mới đến số điện thoại. Extension tự dò khung có tiêu đề "Sản phẩm order" — nếu dò sai/không tìm thấy, trỏ chính xác qua ô **orderPanelSelector** trong Options (F12 → Copy selector vào đúng khung này)
- Tên phát hiện được sẽ được **lưu vào CareData** (cột `name` mới, dùng chung với Zalo AI/Sasum) mỗi khi bấm "💾 Lưu vào Sasum" hoặc "✓ Xong hẹn" — nên khách mới (chưa có đơn hàng nào) vẫn hiện đúng tên trên **CRM Sasum**, thay vì chỉ hiện số điện thoại trong danh sách khách hàng

## Messenger — khác biệt so với Pancake

- Đã điền sẵn selector khởi điểm cho Messenger dựa trên `role`/`aria-label` (ổn định hơn class CSS ngẫu nhiên của Facebook): `messageList = [role='main']`, `messageItem = [role='row']`, `replyBox = div[contenteditable='true'][role='textbox']`. Nếu Facebook đổi giao diện, sửa lại trong Options theo đúng cách lấy selector ở trên.
- **Tra cứu khách theo SĐT khó ăn hơn trên Messenger** vì khung chat Messenger thường không hiển thị số điện thoại khách (khác Pancake là hệ thống bán hàng). Vì vậy panel có thêm **ô nhập SĐT thủ công** (phía trên khung gợi ý) — CS gõ tay SĐT khách rồi bấm "Tra cứu" khi tự động không tìm ra.
- `[role='row']` trên Messenger có thể lẫn cả text không phải tin nhắn (tên người gửi, "Đã xem", giờ gửi...) — nếu gợi ý AI bị nhiễu, thử thu hẹp `messageItem` bằng selector cụ thể hơn qua F12.

## Sửa thông tin khách hàng (đã thêm — giống Zalo AI)

Panel giờ có đầy đủ form chỉnh sửa, dùng chung 19 cột CareData với Zalo AI/Sasum:

- **CS đang dùng**: chọn 1 lần ở đầu panel (load danh sách từ GAS `action:'users'`), lưu sticky theo máy — tự điền vào cột `cs` khi lưu.
- **Trạng thái CS / Trạng thái Zalo / Tình trạng KH**: 3 dropdown, cùng danh sách giá trị với Zalo AI.
- **Sinh nhật**.
- **Lịch hẹn**: chọn ngày hẹn + ghi chú lịch hẹn. Nút "✓ Xong hẹn" xoá lịch hẹn (gửi kèm toàn bộ dữ liệu hiện tại để không ghi đè trống các cột khác — tránh đúng lỗi từng gặp bên Zalo AI).
- **Ghi chú CS**: thêm/xoá từng dòng ghi chú, cùng định dạng JSON `[{text,user,time}]` với Sasum — ghi chú thêm ở đây hiển thị được cả bên Zalo AI và ngược lại.
- **Lưu vào Sasum**: 1 nút lưu tất cả field cùng lúc (`action:'saveSingle'`).
- **Đồng bộ gần-tức-thời**: cứ 6 giây kiểm tra lại dữ liệu mới nhất từ Sasum (so sánh từng trường, không chỉ dựa vào cột `updated` — kể cả khi ai đó sửa trực tiếp trên Google Sheet vẫn phát hiện được) và tự cập nhật các trường CS chưa sửa dở trên form.

Panel Pancake tự điền đủ mọi trường không có UI riêng (schedules, schedGoi*, schedSP*, schedCS*, nickZalos...) từ dữ liệu khách hiện tại trước khi lưu, để không vô tình xoá trắng các cột đó — vì backend GAS không tự merge các trường này.

## Kiến thức từ Drive (Sheet/Doc/PDF) — đã thêm, tự áp dụng luôn

Backend (`gas_v13.js`, dùng chung với Zalo AI) giờ đọc được cả 1 **thư mục** Google Drive làm kiến thức bổ sung khi trả lời khách — không cần sửa gì bên Pancake AI, chỉ cần:

1. Bật checkbox **"Tra cứu sản phẩm"** trong Cài đặt Pancake AI (`options.html`) — đúng cờ `useProducts` sẽ gửi kèm `withProducts:true`.
2. Cấu hình link thư mục Drive **1 lần duy nhất** bên extension **Zalo AI** (Cài đặt ⚙ → "Link thư mục Drive kiến thức") — vì đây là cài đặt dùng chung cả team, lưu trong Google Sheet Settings, Pancake AI tự đọc lại qua GAS.

Hỗ trợ đọc trực tiếp: **Google Sheet** (dạng bảng, mỗi hàng 1 sản phẩm/mục — giống hệt sheet sản phẩm hiện có) và **Google Doc**. Riêng **file ảnh trong thư mục** không được nạp làm ngữ cảnh văn bản ở bước này, nhưng được dùng ở bước "Gửi ảnh sản phẩm thật cho khách" ngay dưới đây.

**File PDF**: script thử tự nhận diện chữ (OCR) qua Drive Advanced Service — nếu chưa bật service này trong Apps Script, PDF sẽ tự động bị bỏ qua (không lỗi, không ảnh hưởng các file khác). Cách đơn giản không cần cấu hình gì thêm: trong Drive, chuột phải file PDF → **Mở bằng → Google Tài liệu** — Drive tự OCR ra 1 bản Google Doc cùng thư mục, AI đọc được bản Doc đó ngay.

AI chỉ lấy đúng vài đoạn khớp với câu hỏi của khách (không nhét cả thư mục vào 1 lần hỏi) — giống hệt cách xử lý sheet sản phẩm đang dùng.

## Gửi ảnh sản phẩm thật cho khách (đã thêm)

Pancake không có API công khai để gửi ảnh qua tin nhắn (Facebook chặn gửi ảnh qua API ở tầng Messenger để tránh spam), nên cách khả thi là copy ảnh vào clipboard rồi CS tự bấm Ctrl+V dán — đúng cách Pancake hỗ trợ dán ảnh qua extension của họ:

- Dùng **chung 1 thư mục Drive** với "Kiến thức từ Drive" ở trên (`driveKnowledgeFolderUrl`) — không cấu hình thêm link nào khác. Backend chỉ lọc riêng các **file ảnh** trong thư mục đó và so **tên file** với từ khoá câu hỏi khách (không đọc nội dung ảnh) — nên đặt tên ảnh rõ ràng, VD `Serum AHA 30ml.jpg` thay vì `IMG_2049.jpg`.
- Khi CS bật **"Tra cứu sản phẩm"** và có ảnh khớp, GAS đọc ảnh đó (base64, giới hạn 3MB/ảnh) và gửi kèm luôn trong response gợi ý trả lời (`image: {name, base64, mimeType}`).
- Panel hiện thêm nút **"📷 Copy ảnh: <tên file>"** dưới danh sách gợi ý. CS bấm → ảnh được chuyển sang PNG và ghi vào clipboard trình duyệt → CS tự bấm **Ctrl+V** vào khung chat Pancake, kiểm tra lại rồi mới bấm **Gửi**.
- Cố tình **không tự động dán/gửi** — CS luôn là người xác nhận cuối cùng trước khi ảnh đến tay khách, tránh gửi nhầm và tránh phụ thuộc vào giao diện Pancake (dễ gãy nếu Pancake đổi UI).

## Phân biệt tin nhắn khách / nhân viên (đã thêm)

Trước đây extension gửi nguyên văn hội thoại cho AI, để AI tự đoán ai nói gì — hoạt động ổn nhưng có thể nhầm nếu hội thoại phức tạp. Giờ có thể khai báo thêm (tuỳ chọn) trong Options:

- **customerMsgSelector**: CSS selector khớp đúng các dòng tin nhắn **của khách** (ví dụ `.message-in`)
- **agentMsgSelector**: CSS selector khớp các dòng tin nhắn **của nhân viên** (ví dụ `.message-out`)

Cách lấy: F12 → Elements → bấm vào 1 tin nhắn của khách, xem class riêng nó có mà tin nhân viên không có (thường Pancake/Messenger dùng class kiểu `message-in`/`message-out` hoặc căn trái/phải khác nhau) → Copy → Copy selector.

Nếu để trống cả 2 (mặc định), extension vẫn hoạt động như cũ — gửi nguyên văn cho AI tự suy luận. Nếu điền, prompt gửi cho AI sẽ gắn nhãn rõ ràng `Khách: ...` / `CS: ...` từng dòng, giúp gợi ý trả lời chính xác hơn với hội thoại dài hoặc có nhiều lượt qua lại.

## Giới hạn hiện tại

- Phân biệt tin khách/nhân viên cần tự cấu hình 2 selector ở trên — nếu để trống, AI vẫn tự suy luận được nhưng độ chính xác thấp hơn với hội thoại phức tạp
- Tra cứu khách tự động chỉ hoạt động khi tìm được số điện thoại VN trong vùng tin nhắn — nếu không tìm ra, dùng ô nhập SĐT thủ công
- Selector Pancake cần bạn tự điền vì mình không truy cập được giao diện thật; selector Messenger đã điền sẵn giá trị khởi điểm nhưng vẫn nên kiểm tra lại bằng dữ liệu thật

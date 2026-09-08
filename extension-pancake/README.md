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

# Duyên AI - Zalo

Extension riêng cho **chat.zalo.me** — tách ra từ extension gộp "Duyên AI" trước đây.

## Cài đặt (load unpacked)
1. Mở `chrome://extensions`
2. Bật "Developer mode" (góc trên phải)
3. Bấm "Load unpacked" → chọn thư mục `extension-zalo/`

## Cấu hình
- **URL backend GAS**: bấm icon extension → "Mở cài đặt" → dán URL Web App GAS (dùng chung với extension "Duyên AI - Pancake").
- **API key (Groq/Cerebras/Gemini), tên CS, tự động trả lời theo khách**: mở trực tiếp trên `chat.zalo.me`, bấm nút ⚙ trong bảng nổi của extension (panel này tự chèn vào trang, không nằm ở trang Options của Chrome) — các key này lưu chung trên backend GAS cho cả team.

## Ghi chú kỹ thuật
- `zalo-content.js` hoàn toàn tự chủ: không có `background.js`, tự gọi thẳng GAS backend.
- Cấu hình lưu ở `chrome.storage.local` với các key `ome_gas_url`, `ome_current_cs`, `ome_current_nz`, `ome_auto_ai_reply`, `ome_auto_ai_per_phone`, `ome_chat_name_map`, `ome_bc_*`.

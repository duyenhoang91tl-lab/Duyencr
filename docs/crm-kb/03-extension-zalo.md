# 03 — Extension Zalo AI (`extension-zalo/`)

Chạy trên `chat.zalo.me`. File: `zalo-content.js` (~2800 dòng), `zalo-content.css`, `zalo-options.html/js`, `zalo-popup.html/js`, `manifest.json`, `icons/`. Sửa xong → reload extension trong `chrome://extensions`. Không có background service worker.

## Giao diện
- Nút tròn nổi `#ome-zai-toggle` (góc dưới phải, fixed) mở/đóng panel `#ome-zai-panel` qua class `.open`/`.shifted`. Toàn bộ style ở `zalo-content.css` (lỗi đầu tiên từng gặp: ban đầu KHÔNG có CSS nào → thiếu `position: fixed` nên panel vô hình).
- Tiền tố class `zai-`; id chính giữ tiền tố `ome` lịch sử (không đổi). z-index 2147483647.
- Panel từ trên xuống: header (tiêu đề + ⚙) → khối cấu hình (URL GAS + 3 API key + 3 link Drive/Sheet + checkbox tự soạn khi mở chat) → thanh CS dính (tên CS + nick Zalo, lưu storage, tự gắn vào mọi lần lưu) → dropdown gộp `#zai-menu-sel` (📢 Gửi hàng loạt / 🔍 Quét trạng thái kết bạn / 🔔 Lịch hẹn) → khu làm việc: tra cứu SĐT, chọn giọng văn + "3 câu mở đầu" + "Tạo gợi ý phản hồi", form cập nhật CS (status/zalo/khStatus/ngày hẹn+ghi chú/sinh nhật/ghi chú CS có lịch sử; luôn hiện kể cả khách mới — ô `#zai-name-input` BẮT BUỘC cho khách mới), thẻ thông tin khách (đơn, chip trạng thái, dò đơn trùng).

## Logic chính
- `doLookup()`: check cache cục bộ 5 phút, luôn hiện cache ngay rồi âm thầm đối chiếu server (`_revalidateFromServer_`). `pollCareTick_()` tự tra lại mỗi 6 giây khi panel mở+hiện, gộp thay đổi từ CS khác/Sasum mà không ghi đè field đang gõ dở (so với baseline `_lastServerCare`).
- `_syncZaloStatusForOpenChat_` / `detectZaloFriendStatus_` đọc DOM chat để đoán trạng thái kết bạn: tên có NHD→"Zalo ngừng hd", có CTN→"Chặn", có nút "Gửi kết bạn"→"Chưa kết bạn", có "Đã gửi/hủy yêu cầu"→"Chưa đồng ý", còn lại→"Đã kết bạn". Ghi qua action hẹp `syncZaloFriendStatus` (KHÔNG dùng `saveSingle` ở đây, tránh ghi đè field khác bằng cache cũ).
- Gửi hàng loạt (`startBroadcast_`...): giới hạn 200 khách/ngày/máy; bật/tắt riêng từng máy; tuỳ chọn khớp đúng nick Zalo khách trước khi gửi; tối đa 4 kịch bản luân phiên (1 bản gốc sửa tay + tối đa 3 bản AI viết lại, CS duyệt trước); tự dò+đồng bộ kết bạn từng khách; giãn cách ngẫu nhiên + nghỉ dài định kỳ chống spam.
- Quét trạng thái kết bạn (`scanZaloFriendStatus_`): phương án dự phòng cho khách chưa có lịch sử đơn — quét regex SĐT trên màn hình (loại khung chat và ô soạn tin), đoán theo chữ xung quanh, CS xem lại/sửa trước khi đồng bộ.

## Storage & quyền
Xem `07-reference-tables.md` (key `ome_*` trong storage.local; quyền manifest).

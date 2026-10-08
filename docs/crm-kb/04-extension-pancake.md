# 04 — Extension Pancake AI (`extension-pancake/`)

Chạy trên pancake.vn, pages.fm, messenger.com. File: `pancake-content.js` (~2400 dòng), `pancake-background.js` (service worker MV3 + `DEFAULT_SETTINGS`), `pancake-content.css`, `pancake-options.html/js`, `pancake-popup.html/js`, `manifest.json`, `icons/`. Sửa xong → reload extension trong `chrome://extensions`.

## Background (`pancake-background.js`)
Giữ `DEFAULT_SETTINGS` (URL GAS + selector DOM theo nền tảng); chuyển tiếp message `GET_SETTINGS`/`RESET_TO_DEFAULT`/`FETCH_SUGGESTION`/`LOOKUP_CUSTOMER`/`GET_PRICE`/lưu-care từ content script sang fetch GAS thật (giữ URL GAS/bí mật tách khỏi ngữ cảnh JS của trang).

## Selector `DEFAULT_SETTINGS.selectors.pancake` (xác minh DevTools + người dùng xác nhận, 9/2026)
- `messageList: "#message-col-list"` — cột tin nhắn của hội thoại đang mở (cố tình thu hẹp; `.mdl-js` đoán trước đây thực ra trúng `<html>` khiến dò SĐT quét nhầm cả trang).
- `messageItem: ".body-conver-item"` — 1 dòng tin nhắn hoàn chỉnh; chính phần tử này mang class `client-message`/`page-message` (KHÔNG phải con) nên `el.matches(customerMsgSelector)` khớp ngay trên item.
- `replyBox: "#replyBoxComposer"`, `customerMsgSelector: ".body-conver-item.client-message"`, `agentMsgSelector: ".body-conver-item.page-message"`.
- `phoneSelector` và `orderPanelSelector` còn TRỐNG → SĐT/tên khách đoán bằng quét chữ trong vùng tin nhắn (điểm mong manh nhất còn lại). Đã ngỏ ý nhờ người dùng lấy 2 selector này qua DevTools nhưng chưa gửi.

## Panel (tiền tố `pk-`, builder `pkb-`, z-index 2147483647)
Header (tiêu đề + thu gọn) → dòng tra cứu SĐT → thẻ thông tin khách → form cập nhật trạng thái/ghi chú CS (`#pk-name-input` bắt buộc cho khách mới, cùng quy ước Zalo AI) → dropdown gộp `#pk-menu-sel` (⏰ Nhắc hẹn hôm nay / 💰 Tra cứu bảng giá) → `#pk-cart-section` (giỏ hàng/soạn đơn nhiều dòng; cố tình KHÔNG gộp vào dropdown vì là tính năng thao tác trực tiếp).

## Giỏ hàng
- Lưu theo từng SĐT trong `chrome.storage.local`, key từ `_cartKey_(phone)`. Mỗi dòng: id, name, note, qty, price, chatLieu, chatLieuOptions (có thể null), mauSac, size, promoType (none/amount/percent/gift), promoValue, checked.
- 2 đường thêm dòng: (1) nút "+ Thêm" nhanh dưới kết quả 💰 tra giá — tự điền Chất liệu/Màu/Size bằng dò tên cột gần đúng trong dòng DANH_MUC (`chatLieuKey`/`mauKey`/`sizeKey`, khớp lỏng theo header, VD chứa "chat lieu"); (2) "Soạn đơn" từng bước (state `_bld`, id `pkb-`): Tên → Nhóm SP/Kiểu-Size/Chất liệu → Màu/ghi chú → số lượng/giá/CTKM; dropdown lấy option từ TẬP GIÁ TRỊ THẬT khác nhau trong các dòng DANH_MUC khớp (không lấy nguyên text 1 dòng).
- `_parseNumberedList_(str)`: nhận 1 ô DANH_MUC nhét nhiều lựa chọn thành chuỗi đánh số tăng dần liên tục ("1. Aqua xanh biển 2. Citrin: vàng mỡ gà 3. Thạch anh...") → mảng sạch; trả null mọi trường hợp khác (kể cả chuỗi có số nhưng không phải thứ tự, VD "BẠC 925 CÓ XỈ TRẮNG"). `addToCart_` gọi hàm này với chatLieu đường (1); nếu ra mảng → dòng giỏ có `chatLieuOptions` và `chatLieu` rỗng ban đầu; `renderCart_` đổi ô chữ thành nhóm checkbox tick-nhiều CHỈ cho dòng đó; lựa chọn nối lại thành chuỗi `chatLieu` phân cách phẩy nên chỗ khác (sinh nội dung sao chép đơn…) không cần sửa.

## Storage & quyền
Xem `07-reference-tables.md` (storage.sync cho DEFAULT_SETTINGS; giỏ hàng ở storage.local; host_permissions).

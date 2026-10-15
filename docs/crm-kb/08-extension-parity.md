# 08 — QUY TẮC SONG SONG: Zalo AI ⇄ Pancake AI (chốt 2026-10-13, Duyên yêu cầu)

## Quy tắc
**Tính năng nào có ở Pancake AI thì Zalo AI cũng phải có, và ngược lại.** Khi thêm/sửa 1 tính năng cho 1 extension (nút, tab, cách hiển thị, câu chữ, cách xử lý lỗi), PHẢI làm luôn cho extension còn lại trong CÙNG lần làm (cùng commit hoặc commit liền kề), dùng cùng backend (GAS), cùng câu chữ người dùng thấy.

Ngoại lệ DUY NHẤT: tính năng gắn chặt với 1 nền tảng (vd gửi hàng loạt qua bạn bè Zalo; câu trả lời nhanh/canned của Pancake). Khi đó phải GHI LÝ DO vào `tools/ext-parity-allow.json` (`status: "platform"`) — không được lặng lẽ để lệch.

## Khác nhau về kỹ thuật (không ảnh hưởng quy tắc — chỉ là CÁCH làm)
| | Zalo AI | Pancake AI |
|---|---|---|
| Gọi GAS | trực tiếp từ content script (`fetch(GAS_URL…)`, wrapper tự thêm `src`/`ek`) | qua `pancake-background.js` (message `chrome.runtime.sendMessage`, service worker) |
| Dựng giao diện | `addEl(...)` + class `zai-*` | HTML template + class `pk-*` |
| Escape HTML | `escHtml` (KHÔNG escape dấu nháy → tên đi vào thuộc tính phải dựng bằng DOM, không nối chuỗi) | `escapeHtml` (có escape `"` `'`) |

## Công cụ kiểm tra (chạy trước khi báo xong)
- `node tools/check-ext-parity.js` — quét mọi action GAS mà mỗi extension gọi; action CHỈ có ở 1 bên mà chưa ghi trong `tools/ext-parity-allow.json` → LỖI (exit 1). Cũng báo lỗi nếu allow-list còn mục đã hết lệch (nhắc dọn). Thêm `--list` để xem các mục `gap` còn thiếu.
- Ví dụ tính năng đã làm đủ 2 bên + test chung: **🤖 Hỏi AI về giá** (`askPriceAiZai_` ⇄ `askPriceAi_`, GAS `priceQa`) → `node tools/test-price-ai-ui.js` chạy CÙNG bộ ca kiểm thử cho cả 2 và so khớp câu chữ.
- Script chỉ thấy lệch ở mức ACTION GAS. Lệch thuần giao diện (nút/câu chữ không gọi action mới) vẫn phải tự soát theo checklist.

## Danh sách còn lệch (trạng thái 2026-10-13) — cần Duyên chốt có làm bù không
`status: "platform"` = đặc thù nền tảng, hợp lệ. `status: "gap"` = bên kia CHƯA có (chi tiết từng mục: `node tools/check-ext-parity.js --list`).

**Zalo có, Pancake thiếu (gap):** đối chiếu phiên bản backend (`count`), công cụ dò/xoá đơn trùng (`findDuplicateOrders`/`deleteDuplicateOrders`).
**Pancake có, Zalo thiếu (gap):** nạp CTKM cho Soạn đơn (`ctkmCatalog`), kiến thức sản phẩm (`getKnowledge`), cây/phẳng bảng giá cho Soạn đơn (`priceCatalogTree`/`Flat`), ảnh sản phẩm (`productImageFlat`/`driveImageFromLink`), tra đơn theo SĐT (`donOrdersByPhone`), lưu/xoá mẫu tin nhắn (`saveMessageTemplate`/`deleteMessageTemplate`), giao/nhận việc + thống kê CS (`assign`/`toggleAssignDone`/`csStats`), đăng nhập xác minh (`verifyLogin`).
**Đặc thù nền tảng (hợp lệ):** Zalo — gửi hàng loạt (`broadcastQueue`/`broadcastMark`), trạng thái kết bạn (`syncZaloFriendStatus`); Pancake — câu trả lời nhanh (`saveCannedResponse`/`deleteCannedResponse`).
> Các mục `gap` do máy phát hiện từ tên action, CHƯA xác minh từng cái có thật sự cần ở bên kia hay không. Làm bù theo thứ tự Duyên chọn; xong mục nào thì xoá mục đó khỏi allow-list (script sẽ nhắc).

## Đã làm bù (nhật ký)
- 2026-10-14: **🎁 Tra cứu khuyến mãi (`ctkmSearch`)** — Zalo AI có mục menu giống Pancake AI; `node tools/test-ctkm-ui.js` chạy CÙNG dữ liệu qua hàm render của cả 2 bên và so khớp HTML.

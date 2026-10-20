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

**Zalo có, Pancake thiếu (gap):** không còn mục nào. (`count` — đối chiếu phiên bản backend — chỉ để chẩn đoán lỗi cho chức năng quét kết bạn riêng của Zalo nên đã chuyển sang `platform`.)
**KHÔNG làm bù (quyết định bảo mật):** dò/xoá đơn trùng (`findDuplicateOrders`/`deleteDuplicateOrders`) — Bảo mật 4c-3 (2026-10-14) đã GỠ khỏi Zalo AI (chỉ admin xoá đơn trên web CRM), nên Pancake AI cũng KHÔNG được có. Nguyên tắc chung: tính năng đã bị gỡ vì bảo mật thì gỡ ở cả 2 bên, không "bù" ngược.
**Pancake có, Zalo thiếu (gap):** nạp CTKM cho Soạn đơn (`ctkmCatalog`), kiến thức sản phẩm (`getKnowledge`), cây/phẳng bảng giá cho Soạn đơn (`priceCatalogTree`/`Flat`), tra đơn theo SĐT (`donOrdersByPhone`), giao/nhận việc (`assign`/`toggleAssignDone`), đăng nhập xác minh (`verifyLogin`).
**Đặc thù nền tảng (hợp lệ):** Zalo — gửi hàng loạt (`broadcastQueue`/`broadcastMark`), trạng thái kết bạn (`syncZaloFriendStatus`); Pancake — câu trả lời nhanh (`saveCannedResponse`/`deleteCannedResponse`).
> Các mục `gap` do máy phát hiện từ tên action, CHƯA xác minh từng cái có thật sự cần ở bên kia hay không. Làm bù theo thứ tự Duyên chọn; xong mục nào thì xoá mục đó khỏi allow-list (script sẽ nhắc).

## Đã làm bù (nhật ký)
- 2026-10-14: **🎁 Tra cứu khuyến mãi (`ctkmSearch`)** — Zalo AI có mục menu giống Pancake AI; `node tools/test-ctkm-ui.js` chạy CÙNG dữ liệu qua hàm render của cả 2 bên và so khớp HTML.
- 2026-10-14: **📊 Doanh số & hoa hồng của tôi (`csStats`)** — Zalo AI có mục menu giống Pancake AI (bộ lọc ngày nhanh, thẻ tổng, bảng hoa hồng, thưởng); mã Zalo được dẫn xuất cơ học từ mã Pancake. `node tools/test-stats-ui.js` so khớp HTML + bộ lọc ngày + kịch bản thao tác (đổi kỳ, thiếu CS, lỗi, phản hồi cũ đến trễ).
- 2026-10-14: **📚 Mẫu tin nhắn tư vấn (`messageTemplates` + `saveMessageTemplate`/`deleteMessageTemplate`)** — Zalo AI có mục menu giống Pancake AI: tìm/xếp hạng, Copy, dán vào ô chat (không tự gửi), đề xuất/sửa/xoá mẫu CỦA MÌNH (chờ quản lý duyệt; server vẫn kiểm tra quyền). Mã Zalo dẫn xuất cơ học từ Pancake; thuộc tính HTML dùng `escAttrZai_` vì `escHtml` của Zalo không escape dấu nháy. `node tools/test-tpl-ui.js` so khớp xếp hạng + HTML + thao tác + payload.
- 2026-10-14: **🖼 Tìm ảnh sản phẩm (`productImageFlat` + `driveImageFromLink`)** — Zalo AI có mục menu giống Pancake AI (chọn nhóm/tên/size/chất liệu 2 cấp/màu → tối đa 6 ảnh + link mở Drive). Mã Zalo dẫn xuất cơ học từ Pancake, kèm các hàm hỗ trợ dùng chung với Soạn đơn (`_zaiItemFold_`, `_zaiVnSort_`, `_zaiItemNames_`, `_zaiParseMaterialTree_`...). `node tools/test-img-ui.js` so khớp HTML qua chuỗi thao tác chọn + tách chất liệu + các ca lỗi.

## Lệch không đo được bằng script (theo dõi tay)
- **Pancake AI hiện ảnh sản phẩm kèm gợi ý trả lời** (nút "📷 Copy ảnh: …" → clipboard → Ctrl+V vào khung chat; `renderImageSuggestion`/`copyProductImage_`, ảnh nằm trong phần phản hồi của gợi ý AI). Zalo AI chưa có. Cần làm bù khi Duyên chốt (cần xác minh server trả `image` cho luồng Zalo và Zalo cho phép dán ảnh từ clipboard vào ô chat).

## Kế hoạch làm bù tiếp theo: 🧩 Soạn đơn (lớn nhất — làm theo giai đoạn)
Soạn đơn của Pancake = bộ chọn sản phẩm (từng bước/Gõ tìm trực tiếp) + giỏ hàng LƯU THEO TỪNG SĐT (`chrome.storage.local`) + giảm giá từng dòng/tổng + quà tặng + freeship + thêm vàng (đơn giá `goldUnitAmount` từ GAS) + nút "Tính CT" tự động + sao chép tin nhắn tổng kết đơn + thông tin KH. Khoảng 1.000 dòng, chạm nhiều chỗ của giao diện (thêm vùng giỏ hàng dưới panel, chọn loại đá SAPHIA/RUBY dùng chung). Đề xuất 3 giai đoạn, mỗi giai đoạn 1 commit + test so khớp 2 bên: **S1** giỏ hàng cốt lõi (thêm dòng thủ công, sửa dòng, tổng tiền, giảm giá/vàng/freeship, lưu theo SĐT, sao chép tổng kết); **S2** bộ chọn sản phẩm (từng bước + Gõ tìm) thêm vào giỏ; **S3** CTKM theo sản phẩm + "Tính CT" tự động. Phần riêng của Pancake (đọc khung đơn hàng của Pancake `_findOrderPanelContainer_`, `_pkLatestOrderHtml_`...) KHÔNG port — là đặc thù nền tảng.
- 2026-10-14: **🧾 Soạn đơn — S1: giỏ hàng cốt lõi** — Zalo AI có vùng "Đơn hàng đang tính" giống Pancake AI: dòng sản phẩm (tên/SL/giá/chất liệu tick nhiều/màu/size/CTKM riêng/ghi chú), thông tin KH, quà tặng, giảm giá tổng, thêm vàng (đơn giá `goldUnitAmount` từ GAS `getSetting`), freeship (+40k), tổng đơn, giỏ LƯU THEO TỪNG SĐT (`chrome.storage.local`, khoá `zaiCart_<sđt>`), nút Sao chép tin nhắn tổng kết / Xoá hết. Mã dẫn xuất cơ học từ Pancake; `node tools/test-cart-ui.js` so khớp HTML + tổng tiền + **tin nhắn tổng kết (so sánh chuỗi chính xác)** + lưu/nạp theo SĐT + Copy/Xoá + giá vàng. `node tools/test-zalo-smoke.js` nạp NGUYÊN `zalo-content.js` trong jsdom để bắt lỗi "biến không tồn tại lúc chạy".
  - **Khác biệt CÓ CHỦ Ý:** (1) từ cấm "Lưu ý từ cấm" (`getKnowledge`) chỉ áp dụng nền tảng Messenger/Facebook (`IS_PHONGTHUY = PLATFORM === 'messenger'`) nên Zalo để danh sách rỗng, còn 3 quy tắc đổi tên sản phẩm (`túi tiền`→`túi`, `Lộc phúc tình`→`lpt`, `thiên lộc`→`TL`) vẫn áp dụng như Pancake; (2) đơn giá vàng chỉ chỉnh được ở CRM (Pancake còn chỉnh được ở trang Options của extension — Zalo Options chưa có); (3) vùng giỏ hàng của Zalo tạm LUÔN HIỆN (Pancake ẩn cho tới khi thêm sản phẩm) vì chưa có bộ chọn sản phẩm (S2) để mở giỏ; (4) nút "Tính CT" tự động chưa có (S3); (5) Zalo dùng bộ đếm 1 giây để nhận biết đổi SĐT/hội thoại (không có sự kiện riêng).

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

## Form chăm sóc ↔ CRM (2026-10-10) — Pancake phải khớp form CRM (README #9)
- Dữ liệu "mềm" nằm trong cột `custom` (JSON), KHÔNG có cột riêng: `custom.zaloReply` (ô 💬 Phản hồi Zalo, tick=true / bỏ tick=xoá khoá) và `custom.tag` (🏷 Nhãn phân loại; client gửi field `tag`, GAS `careRow_` ghi vào `custom.tag`, `careObjFromRow_` lộ ra `tag`; `tag` undefined = không đổi, chuỗi rỗng = xoá nhãn).
- 📅 Lịch nhắc hẹn nhanh: `addQuickRemind_` đọc lại bản mới nhất từ server rồi NỐI object `{id,phone,type,customLabel,date,note,done,owner,ownerUser}` vào mảng JSON cột `schedules` (cùng cấu trúc `addCustomRemind` của CRM). GAS `_remindersFromRows_` đọc cả `schedules` (hôm nay, chưa xong, không phải birthday) vào "Nhắc hẹn hôm nay"; đường Supabase `sbReadRemindersRows_` (SB_MODE=read) cũng kèm `schedules` bằng query thứ 2 `schedules=ilike.*YYYY-MM-DD*` rồi gộp theo SĐT (gas v13.30).
- 📋 Data được chia: mỗi dòng tra lười `LOOKUP_CUSTOMER` (tối đa 40 SĐT, 3 luồng) để hiện tên/trạng thái/ngày hẹn/nhãn; khách hẹn hôm nay/quá hạn xếp đầu tab "Chưa gọi"; Lưu khách thuộc đợt chia → tự `TOGGLE_ASSIGN_DONE`.
- 💡 Gợi ý tiếp theo (Pancake AI, 2026-10): `_pkComputeNba_` + bảng `_NBA_RULES_` (đầu khối "GỢI Ý HÀNH ĐỘNG TIẾP THEO") quyết định hành động + số ngày hẹn theo TRẠNG THÁI CS (khớp chữ không dấu, nên cũng chạy với trạng thái phong thủy/cây động; trạng thái lạ → mặc định "Gọi và cập nhật trạng thái", +1 ngày). Muốn đổi nhịp chăm sóc chỉ sửa `days`/`PK_NBA_REBUY_DAYS` (30 ngày). Chỉ ĐỀ XUẤT: chip "📅 Đặt hẹn" chỉ điền ô Ngày hẹn, sale tự bấm Lưu. "✍️ Soạn tin gợi ý" dùng lại `FETCH_OPENER` với `angleInstr` riêng từng luật (không đổi GAS). Cập nhật trực tiếp khi đổi trạng thái/ngày hẹn/Zalo trên form.

## 💰 Tra cứu giá & tin nhắn gợi ý (2026-10-13) — dùng được KHÔNG cần API key
Menu "💰 Tra cứu giá & tin nhắn gợi ý" (`#pk-price-body`, ô `#pk-price-q`, nút **Tìm** `#pk-price-btn`): `doPriceSearch_` gửi SONG SONG `GET_PRICE` và (nếu cache > 60 giây) `GET_MESSAGE_TEMPLATES` (`_ensureTplsForSearch_`, cache `_msgTemplates`/`_msgTplTs` dùng chung với tab "📚 Mẫu tin nhắn tư vấn"). `renderPriceRows_` hiện sản phẩm + giá + nút "+ Thêm" như cũ, kèm TỐI ĐA 3 mẫu ĐÃ DUYỆT gắn với sản phẩm (`_tplsForRow_`: một "sản phẩm áp dụng" ≥3 ký tự của mẫu xuất hiện trong chữ dòng DANH_MUC, so không dấu); mẫu khớp từ khoá nhưng chưa gắn sản phẩm nào hiện ở mục "💬 Tin nhắn gợi ý" (xếp hạng `rankMsgTemplates_`, y hệt CRM `tplSearch`). Mỗi mẫu: **↳ Chèn vào ô trả lời** (`insertReply`, KHÔNG tự gửi) và **📋 Copy**. Lỗi tải mẫu không làm hỏng danh sách sản phẩm; đổi loại đá render lại vẫn giữ mẫu. Khi `requestSuggestion` (AI) lỗi → `showAiFallbackHint_` hiện nhắc + nút nhảy sang tab này (điền sẵn từ ô ngữ cảnh rồi tìm luôn). Test: `node tools/test-pancake-tpl-suggest.js` (cần jsdom).

## Giám sát chat — từ cấm (2026-10-17)
Quét tin nhân viên gửi trong `pk_messages` theo sheet "Lưu ý từ cấm", cảnh báo admin `duyenht` (chuông + sheet `ChatViolations`). Giai đoạn 1 (server) xong; giai đoạn 2 (cảnh báo ngay trên extension Pancake AI) chưa làm. Xem docs/GIAM-SAT-CHAT.md.

### 🚫 Nút "Quét từ cấm" trong panel Pancake AI (2026-10-21, Duyên yêu cầu)
Sale gõ tin trong ô trả lời → bấm **🚫 Quét từ cấm** (`#pk-ban-btn`, ngay trên dòng trạng thái `#pk-ai-status`) → nếu có từ cấm hiện khung đỏ `Từ cấm “X” không được phép sử dụng nhé!` (nhiều từ: “A”, “B”; kèm gợi ý thay nếu sheet có cột thay thế); sạch → khung xanh; ô trống/không thấy ô soạn/lỗi mạng → khung xám (KHÔNG bao giờ báo "sạch" khi quét lỗi). Chỉ báo, không sửa/không gửi tin.
- **Luồng:** `scanBannedDraft_` (pancake-content.js) → `SCAN_BANNED` (pancake-background.js, `_postGas_`) → GAS `scanBanned` (doPost) → `scanBannedText_` = `cvDetect_(text, _cvBannedCompiled_())` — CÙNG danh sách ("Lưu ý từ cấm") + danh sách bỏ qua (`chatAuditIgnore`) + cách khớp không phân biệt hoa/thường/dấu với giám sát chat → nút báo sạch thì giám sát chat cũng không bắt.
- **Nguyên nhân chọn quét ở server:** `_bannedWords` phía extension chỉ nạp cho Messenger (`IS_PHONGTHUY`) và `handleGetKnowledge` (background) không trả `bannedWords` nên danh sách đó thực tế luôn rỗng — không dùng được.
- Ô đọc tin: `_slashGetChatBox_()` (selector `replyBox`) → dự phòng ô soạn tin focus gần nhất (`_lastEditableEl_`), vì bấm nút trong panel làm ô chat mất focus.
- **Zalo AI chưa có** (ghi `gap` trong `tools/ext-parity-allow.json`; chờ Duyên chốt). Test: `node tools/test-pancake-banned-scan.js` (phần giao diện cần jsdom).
- **Việc cần làm tiếp:** Duyên kiểm tra sheet "Lưu ý từ cấm" đã có từ "Thỉnh" chưa (nút chỉ bắt từ có trong sheet); nếu sale gõ không dấu thì "thinh" cũng bị bắt (theo quy tắc chung của giám sát chat).

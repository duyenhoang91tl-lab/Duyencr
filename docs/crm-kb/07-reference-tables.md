# 07 — Bảng tham khảo nhanh

## Quyền hạn extension (manifest.json)
- Zalo AI: permissions `["storage","clipboardWrite","activeTab","scripting"]`; host_permissions `chat.zalo.me/*`, `script.google.com/*`, `script.googleusercontent.com/*`. KHÔNG có background service worker.
- Pancake AI: cùng permissions; host_permissions thêm `*.pancake.vn/*`, `pancake.vn/*`, `*.pages.fm/*`, `*.messenger.com/*`; CÓ background service worker (`pancake-background.js`).

## Key lưu trong chrome.storage
- Zalo AI (storage.local): `ome_gas_url`, `ome_current_cs`, `ome_current_nz`, `ome_auto_ai_reply`, `ome_auto_ai_per_phone`, `ome_chat_name_map` (danh bạ ngược tên chat↔SĐT học cục bộ), `ome_bc_hidden`/`ome_bc_active`/`ome_bc_daily`/`ome_bc_variants` (trạng thái gửi hàng loạt, riêng từng máy).
- Pancake AI (storage.sync): toàn bộ `DEFAULT_SETTINGS` (gasUrl + selectors theo platform). Giỏ hàng ở storage.local theo key `_cartKey_(phone)` — mỗi SĐT 1 giỏ độc lập.

## Quy ước tên class/id CSS
- Zalo AI: tiền tố `zai-` (zai-btn, zai-card, zai-note-*...); id chính `ome-zai-panel` / `ome-zai-toggle` (giữ tiền tố `ome`, không đổi).
- Pancake AI: `pk-` cho panel/giỏ hàng, `pkb-` cho luồng "Soạn đơn" (builder).
- Cả 2: z-index 2147483647 cho panel nổi.

## Action GAS (doGet/doPost)
| Action | Method | Mục đích |
|---|---|---|
| lookup | GET | Tra cứu 1 KH theo SĐT (care + orders) |
| saveSingle | POST | Lưu/cập nhật 1 dòng CareData (tạo mới nếu SĐT chưa có) |
| syncZaloFriendStatus | POST | Ghi RIÊNG cột zalo (có dryRun báo xung đột trước khi ghi) |
| addCareLead | POST | Ghi log KH mới vào sheet "KH Chăm sóc mới" |
| reminders | GET | Lịch hẹn hôm nay/quá hạn theo CS |
| priceSearch | GET | Tìm trong DANH_MUC (Bảng giá) |
| ai | POST | Gọi AI qua `callAI_` (kèm CTKM nếu khách hỏi khuyến mãi) |
| users | GET | Danh sách CS đang active |
| customers | GET | Trả (trong đó có) careStatus tree dự phòng |
| broadcastQueue / broadcastMark | GET/POST | Danh sách & đánh dấu tiến độ chiến dịch gửi hàng loạt |
| findDuplicateOrders / deleteDuplicateOrders | GET/POST | Dò & xoá đơn trùng (thiếu 3 số 0 hoặc trùng hệt) |
| setSetting / getSetting | POST/GET | Đọc/ghi sheet Settings |
| saveAIContext | POST | Lưu mẫu câu AI đã sửa để học thêm |
| addZaloNick | POST | Thêm nick Zalo mới vào danh sách chung |
| count | GET | Trả field `ver` — đối chiếu bản backend đang chạy thật với code |
| getGasSource / setGasSource | GET/POST | Đọc/ghi mã GAS (chunk trong Settings) cho nút Copy mã GAS |

## 20 cột CareData (đúng thứ tự, `CARE_HEADERS`)
phone, status, zalo, cs, note, schedules, schedGoi, schedGoiNote, schedSP, schedSPNote, schedCS, schedCSNote, schedHen, schedHenNote, updated, khStatus, nickZalos, birthday, zaloSetBy, name

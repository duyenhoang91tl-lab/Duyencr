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
| sbPing / sbCompareCare | GET | Supabase (cần adminKey): kiểm tra kết nối / đối chiếu CareData Sheet vs Supabase (`&sample=1..300`). Code ở cuối `gas_v13.js` = `gas/22_Supabase.gs`; kế hoạch + trạng thái: `docs/SUPABASE-PLAN.md` |
| sbBackfillCare | POST | Supabase (cần adminKey): đẩy CareData lên theo lô 500, resume bằng con trỏ; `dryRun` mặc định true, `reset:true` chạy lại từ đầu |
| (chạy tay) sbDonHang* | — | Supabase bước 4a, KHÔNG phải action web: chạy trong Apps Script Editor. `sbDonHangThuDT`/`DayDT`/`DayLaiTuDauDT`/`DoiChieuDT` cho `DT TỔNG ` → `dt_tong`; `...Don` cho `dữ liệu đơn` → `don_chi_tiet`. Chi tiết: `docs/SUPABASE-PLAN.md` |
| (chạy tay) sbDonHangDongBo / DongBoLai / CaiTrigger / GoTrigger / TrangThai | — | Supabase bước 4b, KHÔNG phải action web: đồng bộ định kỳ 2 sheet đơn hàng sang `dt_tong` / `don_chi_tiet` bằng dấu vân tay khối 200 dòng; trigger `sbOrdersTick_` mỗi 10 phút. Chi tiết: `docs/SUPABASE-PLAN.md` |
| (chạy tay) sbDonHangBatDoc / sbDonHangTatDoc | — | Supabase bước 4c, KHÔNG phải action web: bật/tắt đọc đơn hàng (`readOrdersByPhone_`, `findDonRowsByPhone_`, `readDTTong_`) từ Supabase qua Script Property `SB_ORD_READ` (mặc định TẮT; tự fallback Sheets khi dirty / dữ liệu cũ >30 phút / đang đồng bộ / lỗi). `reminders` dùng công tắc `SB_MODE=read`. Chi tiết: `docs/SUPABASE-PLAN.md` |
| (chạy tay) sbKHDeltaBat / sbKHDeltaTat / sbKHFullBat / sbKHFullTat | — | Supabase bước 4e, KHÔNG phải action web: bật/tắt đọc danh sách khách của action `customers` (delta `since` và FULL) từ Supabase qua `SB_CARE_DELTA_READ` / `SB_CARE_FULL_READ` (mặc định TẮT, cần `SB_MODE=read`; tự fallback Sheets khi STALE/dirty/lỗi). Chi tiết: `docs/SUPABASE-PLAN.md` |
| (chạy tay) sbSanSangBuoc5 | — | Supabase bước 5a, KHÔNG phải action web, CHỈ ĐỌC: kiểm 13 điều kiện tự động trước khi bỏ dual-write (mode read, STALE/dirty, đối chiếu, đồng bộ đơn hàng + trigger, 3 công tắc đọc đã bật ≥ 7 ngày qua mốc `<tên>_AT`) và luôn in kèm danh sách việc thủ công. Không đổi gì. Thiết kế bước 5: `docs/SUPABASE-PLAN.md` |
| (chạy tay trong Editor) | — | Supabase, không cần adminKey: `sbKiemTraKetNoi`, `sbBatGhiSongSong`, `sbBackfillThu`/`sbBackfillThat`/`sbBackfillTuDau`, `sbDoiChieu`, `sbBatDocSupabase`, `sbTatSupabase`, `sbSuaSDTLoi`, `sbXemTrangThai` (xem `docs/SUPABASE-PLAN.md`) |
| ntlReport | GET | Bảo mật bước 3 (cần adminKey): đếm request dữ liệu theo ngày/action/nguồn (`src`)/có-không token để biết ai còn gọi trần trước khi bắt buộc token. Cũng chạy tay `xemLogKhongToken` trong Editor. Chi tiết: `docs/SECURITY-PLAN.md` |
| sbStatus | GET | Supabase (cần adminKey): chế độ `SB_MODE` (off/write/read), cờ STALE, số SĐT dirty |
| sbSetMode / sbResyncCare | POST | Supabase (cần adminKey): đổi chế độ off/write/read (`read` bị từ chối khi STALE trừ `clearStale:true`) / sửa các SĐT dirty (mirror lỗi) |

## 22 cột CareData (đúng thứ tự, `CARE_HEADERS`; 2 cột cuối `custom`, `zaloPhones` thêm sau — khớp `supabase/schema.sql`)
phone, status, zalo, cs, note, schedules, schedGoi, schedGoiNote, schedSP, schedSPNote, schedCS, schedCSNote, schedHen, schedHenNote, updated, khStatus, nickZalos, birthday, zaloSetBy, name, custom, zaloPhones

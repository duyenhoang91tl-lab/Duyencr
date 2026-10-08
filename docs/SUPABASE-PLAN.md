# Chuyển dữ liệu sang Supabase (Postgres) — kế hoạch & trạng thái

Lý do (Duyên 2026-10-08): Google Sheets giới hạn 10 triệu ô; `lookup`/`saveSingle`/báo cáo đang quét cả sheet nên chậm tăng tuyến tính theo số dòng
(xem log PERF `readDTTong_`). Hướng này **bổ sung / thay thế dần** hướng lưu trữ đơn cũ trong `docs/ARCHIVE-PLAN.md` (bước 1 của plan đó đã có,
chạy thật đang khoá). KHÔNG bật archive chạy thật khi chưa quyết định hướng nào — xoá dòng khỏi Sheet rồi chuyển Supabase sẽ chồng chéo.

## Nguyên tắc an toàn
- Sheets vẫn là nguồn thật cho tới khi đối chiếu khớp 100%. Ghi song song (dual-write) → đọc từ Supabase có cờ bật/tắt (Settings `useSupabase`) → rollback = tắt cờ.
- Giữ nguyên format JSON response của các action để KHÔNG phải sửa 2 extension / index.html.
- `service_role` key chỉ nằm ở Script Properties của Apps Script. Không commit, không đưa vào client.

## Lộ trình
- [x] Bước 1 (phiên này): `supabase/schema.sql` (care_data, dt_tong, don_chi_tiet + index + RLS). CHƯA đụng gas_v13.js.
- [ ] Bước 1b (Duyên làm tay): tạo project Supabase (free) → SQL Editor → dán `supabase/schema.sql` → Run. Lưu `SUPABASE_URL` và `service_role` key vào Apps Script → Project Settings → Script Properties (`SUPABASE_URL`, `SUPABASE_KEY`). Không gửi key vào chat.
- [x] Bước 2 (xong phần code; còn việc tay của Duyên bên dưới, chia mục nhỏ — mỗi mục push riêng; code nằm cuối `gas_v13.js` = file `gas/22_Supabase.gs`):
  - [x] 2a: helper `sbCfg_`/`sb_`/`sbCareRowToRec_` + mốc `22_Supabase` trong `tools/split-gas.js`.
  - [x] 2b: `sbPing_` + `sbPingTick_`/`installSbPingTrigger_`/`caiTriggerSbPing` + action `sbPing` (doGet, cần adminKey; tài khoản demo bị chặn bởi `DEMO_ALLOWED_GET_`). Cài trigger: chạy hàm `caiTriggerSbPing` 1 lần trong Apps Script Editor.
  - [x] 2c: `sbBackfillCare_` (lô 500, upsert theo phone, con trỏ `SB_CARE_CURSOR`, dryRun mặc định, SĐT trùng → chỉ đẩy dòng ĐẦU TIÊN) + action POST `sbBackfillCare` (cần adminKey). Cách dùng: POST `{action:'sbBackfillCare', adminKey, dryRun:true}` xem số liệu → `dryRun:false` gọi lặp đến khi `done:true` → `reset:true` để chạy lại từ đầu.
  - [x] 2d: `sbCompareCare_` + action GET `sbCompareCare` (cần adminKey, `&sample=1..300`): so SĐT khác nhau trên Sheet == số dòng Supabase + so TỪNG TRƯỜNG trên mẫu rải đều (đối chiếu theo mẫu, KHÔNG phải checksum toàn bảng). `ok:true` mới được coi là khớp.
  - [x] 2e: `tools/test-supabase.js` (fetch giả; chạy `node tools/test-supabase.js` → `ALL TESTS PASSED`) phủ 2a–2d; ghi 3 action vào `docs/crm-kb/07-reference-tables.md`.
  - Người dùng làm tay sau khi các mục push: dán đè `gas/04_doGet.gs` + `gas/11_ExportSheet_doPost.gs` + `gas/21_ArchiveOldOrders.gs` (chỉ thêm 1 dòng trống cuối file) và tạo file MỚI `22_Supabase` trong Editor từ `gas/22_Supabase.gs` (hoặc dán đè toàn bộ `gas_v13.js`); Deploy bản mới; Đồng bộ mã GAS mới nhất; đặt Script Properties; chạy `sbPing`.
- [ ] Bước 3: `lookup` + `saveSingleCare_`/`saveBatchCare_` ghi song song; đọc `findCareByPhone_` từ Supabase khi cờ bật. Test bằng Node với fetch giả.
- [ ] Bước 4: backfill `dt_tong` + `don_chi_tiet`; chuyển `readOrdersByPhone_`, `findDonRowsByPhone_`, `reminders`, `readDTTong_` (lọc theo ngày bằng SQL).
- [ ] Bước 5: bỏ dual-write khi ổn; Sheets chỉ còn bản xem/backup.

## Lưu ý kỹ thuật
- Supabase REST giới hạn kích thước request; backfill theo lô ≤ 500 dòng, `Prefer: resolution=merge-duplicates` (upsert theo khoá chính).
- Apps Script giới hạn 6 phút/lần chạy → backfill phải có con trỏ resume (Script Properties) và gọi lặp.
- `phone` phải qua `normPhone_` trước khi ghi (giữ số 0 đầu; không để Sheets/JSON đổi thành số).
- Sau mỗi lần sửa gas_v13.js: `node tools/split-gas.js` + `--check`; CI deploy-gas.yml tự deploy nếu đã cài secret (xem `docs/GAS-AUTO-DEPLOY.md`), nếu chưa thì dán đè thủ công các file `gas/*.gs` đổi.

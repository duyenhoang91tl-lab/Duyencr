# Kế hoạch chuyển HẲN sang Supabase (lập 2026-10-11)

Quyết định của Duyên (2026-10-11, trong chat): chuyển CRM sang Supabase (Postgres) làm NGUỒN THẬT, thay Google Sheets. Duyên đã đồng ý đưa DT TỔNG ra khỏi Sheets (đổi quy tắc "DT Tổng quản lý trên Sheets"). Đây là điều kiện (5) của cổng bước 5 trong `docs/SUPABASE-PLAN.md`; các điều kiện (1)–(4) VẪN PHẢI đạt trước khi đảo chiều ghi.
Nguyên tắc: mỗi giai đoạn có công tắc riêng, mặc định TẮT; rollback = tắt công tắc; push riêng từng mục; giữ nguyên JSON response để KHÔNG sửa 2 extension; không xoá dữ liệu Sheets cho tới khi đã thử khôi phục từ backup Supabase.

## Giới hạn Supabase (kiểm tra lại supabase.com/pricing trước khi quyết)
Free: 500 MB DB/project, 5 GB egress, 2 project, tự tạm dừng sau 1 tuần không hoạt động, KHÔNG có sao lưu hằng ngày. Pro $25/tháng: 8 GB DB, sao lưu hằng ngày giữ 7 ngày, không tạm dừng → dùng Pro khi chạy thật. Dữ liệu tải về bất cứ lúc nào (pg_dump / xuất CSV / REST).

## Giai đoạn 0 — Chuẩn bị
- [ ] Lên gói Pro. Chạy `sbStatus` xem dung lượng thật (bảng `dt_tong` nặng nhất).
- [ ] Bật trigger `sbPing` (`caiTriggerSbPing`) và CI `deploy-supabase.yml`.
## Giai đoạn 1 — Dữ liệu khớp 100%
- [ ] Backfill lại, `sbCompareCare` / `sbDonHangDoiChieu*` đều `ok:true`.
- [ ] Thêm index theo `phone`, `cs`, ngày đơn (qua `supabase/schema.sql`, idempotent).
- [ ] Bước B: đồng bộ định kỳ Sheet → Supabase cho CareData (khung giống 4b).
- [ ] Bật 3 công tắc đọc; `sbSanSangBuoc5` `autoOk:true` liên tục ≥ 7 ngày.
## Giai đoạn 2 — Worker làm cổng bảo mật
- [ ] Worker kiểm token HMAC và chặn request không token (xem `ntlReport` để biết khi nào chặn được). Token chuyển sang header; thêm rate-limit.
- [ ] Worker đọc thẳng Supabase cho `lookup`/`customers`/`orders`; GAS là đường dự phòng.
## Giai đoạn 3 — Đảo chiều ghi (bước C)
- [ ] Thử ROLLBACK thật (`sbTatSupabase`) + thử khôi phục từ backup.
- [ ] CareData trước: `saveSingle`, `syncZaloFriendStatus`, `addCareLead` ghi Supabase TRƯỚC, Sheets ghi sau.
- [ ] Đơn hàng SAU CÙNG: tool Base/Pos đổi đường đẩy đơn vào Supabase (hoặc tạm giữ tick 4b Sheet → Supabase).
## Giai đoạn 4 — Báo cáo + realtime
- [ ] Báo cáo A–L sang SQL view/RPC (hết timeout 55s; xem `buildSalesReportB_`, `_readBaseRowsByCounterCodes_`).
- [ ] Supabase Realtime thay vòng polling `autoSyncLoop` (~3 giây/máy).
## Giai đoạn 5 — Gỡ dual-write (sau ≥ 2–4 tuần ổn định)
- [ ] Bước D: gỡ dual-write; Sheets thành bản xem/backup xuất định kỳ từ Supabase. GAS chỉ còn AI, trigger, import/export.
- [ ] Trigger xuất bản sao định kỳ Supabase → Sheets/Drive (trả lời "ai chịu trách nhiệm sao lưu").

## Rủi ro cần nhớ
SĐT luôn qua `normPhone_`; backfill lô ≤500 dòng, GAS giới hạn 6 phút/lần; nhiều phiên cùng sửa repo → rebase, không force-push; sửa `gas_v13.js` → `node tools/split-gas.js` + `--check`, báo đúng các `gas/*.gs` đổi để dán/deploy; sửa index.html/js → reload; sửa extension → reload trong chrome://extensions.

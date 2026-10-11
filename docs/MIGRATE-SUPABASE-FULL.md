# Kế hoạch chuyển HẲN sang Supabase + nâng cấp kiến trúc — bản 2, 100% MIỄN PHÍ (lập lại 2026-10-11)

Thay bản đầu (8fde15e, có giả định gói Pro $25). Quyết định của Duyên (2026-10-11, chat): (1) chuyển CRM sang Supabase làm NGUỒN THẬT, DT TỔNG ra khỏi Sheets (= điều kiện 5 cổng bước 5 của `docs/SUPABASE-PLAN.md`; điều kiện 1–4 vẫn phải đạt); (2) CHỈ dùng gói miễn phí.
Nguyên tắc: mỗi giai đoạn có công tắc riêng, mặc định TẮT; rollback = tắt công tắc; push riêng từng mục; giữ nguyên JSON response để KHÔNG sửa 2 extension; không xoá dữ liệu Sheets cho tới khi đã thử khôi phục từ bản sao.

## Chọn công nghệ (đã so sánh, 2026-10-11)
- Frontend: **Vite + Svelte 5, SPA tĩnh** (không SSR). Lý do: CRM nằm sau đăng nhập → không cần SEO/SSR; bundle nhỏ, ít code, dễ chuyển dần từ ~23k dòng JS thuần; có thư viện bảng/danh sách ảo cho ~136k khách. Hiệu năng thật nằm ở phân trang phía server + danh sách ảo, không phải ở framework. React là phương án thay thế nếu sau này thuê dev ngoài (dễ tìm người hơn). Vue không có lợi thế riêng ở đây.
- KHÔNG chọn Next.js: lợi thế SSR không dùng tới; chạy trên Cloudflare cần adapter (dễ lỗi); host tốt nhất là Vercel nhưng gói Hobby CẤM dùng thương mại (Pro $20/người/tháng).
- Host frontend: **Cloudflare Pages** (băng thông không giới hạn, 500 build/tháng, cho phép thương mại ở gói free). GitHub Pages hiện dùng KHÔNG cho phép host doanh nghiệp bán hàng/SaaS thương mại → chuyển đi.
- Cổng/API: Cloudflare Workers free = 100.000 request/ngày. Database: Supabase Free.

## Giới hạn gói free phải sống chung (kiểm tra lại supabase.com/pricing & Cloudflare trước khi quyết)
- Supabase Free: 500 MB DB/project, 5 GB egress, Realtime 2 triệu tin/tháng, tự tạm dừng sau 1 tuần không hoạt động, KHÔNG có sao lưu hằng ngày. → giữ trigger `sbPing`; tự sao lưu ra Google Drive (15 GB free) bằng trigger GAS; nếu gần 500 MB thì lưu trữ đơn cũ (`docs/ARCHIVE-PLAN.md`) rồi xoá khỏi Supabase.
- Workers 100k request/ngày: app polling ~3 giây/máy ≈ 9.600 request/máy/8 giờ → 10 máy gần chạm trần. Realtime thay polling là BẮT BUỘC, không phải tuỳ chọn.
- Dữ liệu tải về bất cứ lúc nào: pg_dump / xuất CSV / REST.

## Giai đoạn 0 — Đo trước khi làm
- [ ] Chạy `sbStatus` xem dung lượng thật (`dt_tong` nặng nhất); quyết định có cần archive để dưới ~400 MB.
- [ ] Bật `caiTriggerSbPing`, CI `deploy-supabase.yml`.
## Giai đoạn 1 — Dữ liệu khớp 100%
- [ ] Backfill lại; `sbCompareCare` / `sbDonHangDoiChieu*` đều `ok:true`.
- [ ] Index theo `phone`, `cs`, ngày đơn (qua `supabase/schema.sql`, idempotent).
- [ ] Bước B: đồng bộ định kỳ Sheet → Supabase cho CareData.
- [ ] Bật 3 công tắc đọc; `sbSanSangBuoc5` `autoOk:true` liên tục ≥ 7 ngày.
## Giai đoạn 2 — Worker làm cổng + sao lưu miễn phí
- [ ] Worker kiểm token HMAC, chặn request không token (xem `ntlReport`), token sang header, rate-limit.
- [ ] Worker đọc thẳng Supabase cho `lookup`/`customers`/`orders`; GAS là đường dự phòng.
- [ ] Trigger GAS xuất bản sao định kỳ Supabase → Google Drive (KHÔNG để file sao lưu trong repo public). Thử khôi phục thật 1 lần.
## Giai đoạn 3 — Frontend mới (làm dần, không viết lại một lần)
- [ ] Thêm Vite (build) vào repo; giữ `js/*.js` cũ chạy song song; KHÔNG đổi thứ tự thẻ `<script>` của bản cũ cho tới khi cắt hẳn.
- [ ] Chuyển host sang Cloudflare Pages (preview deploy theo nhánh).
- [ ] Màn MỚI viết bằng Svelte: Hồ sơ khách 360° (P2), Trang chủ (P1); màn cũ chuyển dần khi phải sửa tới. Danh sách khách dùng phân trang server + danh sách ảo.
## Giai đoạn 4 — Realtime + báo cáo
- [ ] Supabase Realtime thay vòng polling `autoSyncLoop` (lead mới, đổi CS, lịch hẹn).
- [ ] Báo cáo A–L sang SQL view/RPC (hết timeout 55s; xem `buildSalesReportB_`, `_readBaseRowsByCounterCodes_`).
## Giai đoạn 5 — Đảo chiều ghi (bước C) rồi gỡ dual-write (bước D)
- [ ] Thử ROLLBACK thật (`sbTatSupabase`) + khôi phục từ bản sao Drive.
- [ ] CareData trước (`saveSingle`, `syncZaloFriendStatus`, `addCareLead`): ghi Supabase TRƯỚC, Sheets ghi sau. Đơn hàng SAU CÙNG (tool Base/Pos đổi đường đẩy đơn, hoặc tạm giữ tick 4b).
- [ ] Sau ≥ 2–4 tuần ổn: gỡ dual-write; Sheets thành bản xem/backup; GAS chỉ còn AI, trigger, import/export.

## Rủi ro cần nhớ
SĐT luôn qua `normPhone_`; backfill lô ≤500, GAS 6 phút/lần; nhiều phiên cùng sửa repo → rebase, không force-push; sửa `gas_v13.js` → `node tools/split-gas.js` + `--check`, deploy GAS lại, báo đúng các `gas/*.gs` đổi; sửa web → reload; sửa extension → reload ở chrome://extensions.
Việc tiếp theo (cho phiên sau): Giai đoạn 0 — Duyên gửi kết quả `sbStatus`.

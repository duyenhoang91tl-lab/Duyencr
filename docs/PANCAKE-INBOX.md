# Hộp thư Pancake trong CRM — hướng dẫn từng bước (lập 2026-10-12)

Mục tiêu (ROADMAP-YEU-CAU P7): kéo TOÀN BỘ tin nhắn Pancake về CRM, gắn khách theo SĐT.
Kiến trúc: **Pancake → (webhook) → Cloudflare Worker → Supabase**, và một job kéo lịch sử cũ qua API.
Apps Script không nhận realtime tốt nên không đứng giữa luồng này.

## Trạng thái
- [x] **Bước 1 (code xong, 2026-10-12):** bảng `pk_webhook_raw` (supabase/schema.sql mục 7) + route `/pancake-webhook` trong `cloudflare/worker.mjs` (test: `node tools/test-cloudflare-worker.js`). Ghi NGUYÊN payload thô, chưa tách tin nhắn.
- [ ] **Bước 1b (Duyên làm tay, xem dưới):** đặt 3 biến trên Cloudflare, dán URL webhook vào Pancake, gửi thử 1 tin, xem dòng đầu tiên trong bảng.
- [x] **Bước 2 (code xong 2026-10-12, CHỜ XÁC NHẬN bằng payload thật):** `supabase/schema.sql` mục 8: `pk_conversations`, `pk_messages` (khoá = `message.mid`, không trùng), hàm `pk_ingest_raw` + trigger tự tách mỗi dòng `pk_webhook_raw` mới. Lỗi tách KHÔNG làm hỏng ghi thô (ghi vào cột `process_error`). Hiện tách theo dạng Messenger `entry[].messaging[]`; payload dạng khác (vd event `conversation`) vẫn lưu thô, chưa ra tin → xem mẫu thật rồi mở rộng hàm. Id hội thoại tạm = `<page_id>_<id khách>`. SĐT khách (`customer_phone`) chưa điền. Test: `python3 tools/test-pk-ingest.py` (cần `pip install pgserver`).
- Bảo mật: mục 8 gỡ policy `using (true)` từng tạo tay (cho anon key đọc/ghi hết tin + SĐT). Bảng bật RLS KHÔNG policy.
- [x] **Bước 2b (code xong 2026-10-12, đã đối chiếu payload THẬT):** `supabase/schema.sql` mục 9. Dạng thật: `{data:{message,conversation,post}, page_id, event_type, timestamp}`. `messaging` → ghi tin + hội thoại; `conversation` → cập nhật thẻ (`tags` jsonb), người phụ trách (`assignee_ids` uuid Pancake, chưa ra tên), đã đọc/đã trả lời; `post` → bỏ qua (chưa làm bình luận). Hướng tin: `from.id = page_id` → `out` (gồm cả tin hệ thống kiểu "X đã trả lời một quảng cáo"), còn lại `in`. Giờ `inserted_at` của Pancake là UTC không kèm múi giờ → đã đổi sang timestamptz UTC. SĐT khách chỉ lấy từ tin KHÁCH nhắn (`phone_info` hoặc số gõ trong tin), chuẩn hoá về 0xxxxxxxxx, không ghi đè SĐT đã có. Sự kiện `conversation` cũ đến trễ (version nhỏ hơn) không làm lùi dữ liệu. Tách lại dòng thô đã có: `select pk_reprocess_raw();`. Test: `python3 tools/test-pk-ingest-pancake.py`.
  - CHƯA biết: phần tử trong `tags[]` và `phone_info[]` trông thế nào khi KHÔNG rỗng (mẫu thật đều rỗng) — cần 1 mẫu có thẻ/có SĐT; tên nhân viên từ `assignee_ids` (cần API users, bước 3).
- [ ] **Bước 3:** job kéo lịch sử cũ qua API (chia lô, có con trỏ để chạy tiếp khi bị ngắt, giãn cách để không dính giới hạn tốc độ).
- [ ] **Bước 4:** khung chat trong CRM (đọc từ Supabase qua GAS/Worker, hiện trong hồ sơ khách 360°).
- [ ] **Bước 5 (sau):** gửi tin từ CRM (Pancake có API gửi inbox).

## Bước 1b — cài đặt, làm 1 lần

### A. Đợi Supabase có bảng mới
Push lên `main` có đổi `supabase/**` thì workflow **Deploy Supabase schema** tự chạy (Actions → xem xanh). Chưa cài workflow này thì dán đoạn mục 7 của `supabase/schema.sql` vào Supabase → SQL Editor → Run.
Kiểm tra: Supabase → Table Editor thấy bảng `pk_webhook_raw`.

### B. Lấy 2 giá trị Supabase
- `SUPABASE_URL`: Project Settings → API → Project URL (dạng `https://xxxx.supabase.co`).
- `SUPABASE_SERVICE_KEY`: cùng trang, khoá **service_role** (KHÔNG phải anon). Đây là cùng khoá GAS đang dùng trong Script Properties (`SUPABASE_KEY`). Không dán vào repo, chat hay extension.

### C. Tạo khoá bí mật cho webhook
Tự đặt 1 chuỗi dài ngẫu nhiên, chỉ gồm chữ và số, ví dụ 32 ký tự. Đây là `PANCAKE_WEBHOOK_KEY`. Ai biết khoá này mới ghi được vào bảng, nên đừng để lộ.

### D. Đặt 3 biến trên Cloudflare
Cloudflare Dashboard → Workers & Pages → Worker `duyen-crm-cache` → Settings → Variables and Secrets → Add, loại **Secret**:
`PANCAKE_WEBHOOK_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` → Deploy.
(Workflow deploy dùng `--keep-vars` nên các biến này không bị xoá ở lần deploy sau.)

### E. Kiểm tra Worker (trước khi dán sang Pancake)
Mở trình duyệt: `https://<worker>.workers.dev/pancake-webhook?key=<PANCAKE_WEBHOOK_KEY>`
- Ra `{"ok":true,"service":"pancake-webhook","ready":true}` là đúng.
- `401 Sai khoa` → sai khoá. `503 Chua cau hinh...` → thiếu biến ở bước D (thông báo nêu đúng tên biến thiếu).

### F. Lấy `page_access_token` và khai webhook trong Pancake
- Tài liệu: https://docs.pancake.vn/vi/developers/api-reference (tài liệu KHÔNG mô tả webhook, nên chỗ khai webhook có thể khác tên; nếu không thấy thì chụp màn hình mục Cài đặt → Công cụ / Webhook gửi lại).
- Pancake → chọn page → Cài đặt → Công cụ (Tools) → tạo `page_access_token` và mục Webhook.
- URL webhook điền: `https://<worker>.workers.dev/pancake-webhook?key=<PANCAKE_WEBHOOK_KEY>`
- Làm cho từng page.

### G. Gửi thử
Nhắn 1 tin vào page từ tài khoản cá nhân, đợi vài giây, vào Supabase → Table Editor → `pk_webhook_raw` phải có dòng mới. **Copy 1–2 dòng cột `payload` gửi lại** để làm bước 2 (xoá SĐT/tên thật nếu muốn).

## Lưu ý
- Gói free Cloudflare giới hạn 100.000 request/ngày, tính cả webhook. Nhiều page + tin dồn dập có thể chạm; theo dõi ở Metrics. Vượt hạn thì Worker báo lỗi cả với CRM, khi đó lên gói Paid.
- Lỗi ghi Supabase trả 502 (không phải 200) để Pancake (nếu có cơ chế gửi lại) không mất tin.
- Không đụng `gas_v13.js` ở bước này nên KHÔNG cần deploy lại GAS. Worker tự deploy khi push `main` đổi `cloudflare/**` (workflow `deploy-worker.yml`); chưa có workflow thì dán tay `cloudflare/worker.mjs` vào Edit code.
- `page_access_token` chưa dùng ở bước 1 (chỉ cần cho bước 3 kéo lịch sử); cất sẵn, không dán vào chat/repo.

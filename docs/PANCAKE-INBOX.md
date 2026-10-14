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
- [x] **Bước 3 (code xong 2026-10-12, GAS `v13.40-pkhist`, `gas/27_PancakeHistory.gs`; CHƯA thử với Pancake thật):** kéo tin cũ qua API (webhook chỉ có tin mới từ lúc cài). Danh sách hội thoại `GET /api/public_api/v2/pages/{page}/conversations` (60/lần, con trỏ `last_conversation_id`), tin nhắn `GET /api/public_api/v1/.../messages?customer_id=&current_count=` (30/lần). Chạy theo lô 270 giây, con trỏ lưu ở Script property `PK_HIST_STATE` nên bị ngắt thì chạy tiếp; **chỉ THÊM cái chưa có** (`ignore-duplicates`), không ghi đè dữ liệu webhook hay hội thoại bạn đã gắn tay; SĐT chỉ lấy từ tin KHÁCH nhắn (như webhook). Mặc định chỉ hội thoại cập nhật trong 90 ngày (`PK_HIST_DAYS`), tối đa 150 tin/hội thoại (`PK_HIST_MAX_MSGS`). Dùng token `PANCAKE_PAGE_TOKENS` như phần chat. Chạy từ Apps Script Editor (chọn hàm → Run): **`pkLichSuThu`** (chạy thử 2 hội thoại, KHÔNG ghi, xem Log), rồi **`pkLichSuChay`** (1 lô thật) hoặc **`pkLichSuCaiTrigger`** (tự chạy mỗi 10 phút, tự gỡ khi xong); `pkLichSuXemTrangThai`, `pkLichSuLamLai` (kéo lại từ đầu, không tạo trùng). Test: `node tools/test-pk-hist-gas.js` (20 ca).
- [x] **Bước 4a/5a (code xong 2026-10-12, backend GAS `v13.34-pkchat`, phần `gas/25_PancakeChat.gs`):** 4 action có xác thực phiên (`_sessUser_`, tài khoản test bị chặn): `pkChat` (GET: theo SĐT → hội thoại + tin, có `after=<ISO>` để poll nhẹ), `pkChatFind` (GET: tìm hội thoại theo tên/SĐT để gắn tay), `pkChatLink` (POST: gắn/bỏ gắn hội thoại với SĐT), `pkChatSend` (POST: gửi tin `reply_inbox` qua API Pancake). Đọc Supabase bằng khoá service_role sẵn có trong GAS. **Cần deploy lại GAS.** Token Pancake đặt ở Apps Script → Project Settings → Script properties (KHÔNG dán vào chat/repo): `PANCAKE_PAGE_TOKENS` = `{"<page_id>":"<page_access_token>"}` (hoặc `PANCAKE_PAGE_TOKEN_<page_id>` / `PANCAKE_PAGE_TOKEN` nếu 1 page); tuỳ chọn `PANCAKE_USER_TOKEN` (token tài khoản Pancake — tài liệu chính thức chỉ mô tả gửi tin bằng token này qua `/api/v1/...?access_token=`; nếu có thì gửi bằng endpoint đó, nếu không thì thử `/api/public_api/v1/...?page_access_token=`). CHƯA xác nhận được với Pancake thật việc gửi bằng page token: lần gửi thử đầu nếu báo lỗi, thông báo của Pancake hiện nguyên văn để sửa. Chỉ gửi được hội thoại INBOX (bình luận chưa hỗ trợ). Test: `node tools/test-pk-chat-gas.js`.
- [x] **Bước 4b/5b (code xong 2026-10-12):** tab **💬 Chat** trong panel chi tiết khách (`js/41-fn-pkchat.js` + khối `.pkc-*` ở `css/01-base.css`, tab thêm ở `index.html`, nhánh `chat` trong `renderDpTab/switchDpTab` ở `js/03`). Hiện hội thoại Pancake gắn với SĐT khách (nhiều hội thoại → chip chọn), bong bóng khách/page theo giờ, ảnh đính kèm; ô soạn + nút Gửi (Ctrl+Enter), tin tạm hiện ngay rồi được thay bằng tin thật khi webhook vọng lại; tự cập nhật mỗi 6 giây khi tab mở (poll nhẹ bằng `after`, 10 lần thì tải đầy đủ 1 lần). Mục "🔗 Gắn hội thoại Pancake khác" tìm theo tên/SĐT rồi gắn tay (cho khách webhook chưa bắt được SĐT; hội thoại đang gắn SĐT khác thì hỏi xác nhận). Tài khoản test không thấy tab. Test: `NODE_PATH=<nơi cài jsdom> node tools/test-pk-chat-ui.js` (18 ca).
  - CHƯA làm: bình luận (COMMENT), gắn/gỡ thẻ và phân công từ CRM (chỉ HIỆN thẻ + người xử lý, xem mục "Người gửi · giờ · thẻ" dưới), đánh dấu đã đọc trên Pancake, tải đính kèm khi gửi, phân quyền theo CS phụ trách (hiện mọi tài khoản đăng nhập, trừ test, đều xem/gửi được nếu mở được hồ sơ khách).

## Người gửi · giờ · thẻ · người xử lý (2026-10-12, GAS `v13.41-pkmeta`) — giống Pancake
- **Dưới mỗi tin**: `TÊN NGƯỜI GỬI · HH:MM` (rê chuột/nhấn giữ xem đủ `dd/mm/yyyy hh:mm:ss`). Tin khách = tên khách. Tin nhân viên = (1) tên nhân viên CRM nếu gửi từ CRM (kèm nhãn `CRM`), (2) tên nhân viên trên Pancake lấy từ `raw.from.admin_name` của tin (cùng tên trường Pancake dùng ở `conversation.last_sent_by`), (3) không có thì tên page. **CHƯA xác nhận được** với payload thật của webhook việc `message.from` có `admin_name` cho tin nhân viên gửi từ app Pancake (mẫu thật mới chỉ có tin khách/hệ thống): nếu tin nhân viên vẫn hiện tên page, mở Supabase → `pk_messages` → cột `raw` của 1 tin nhân viên và gửi trường chứa tên nhân viên để sửa `_pkMsgOut_`.
- **Tin gửi từ CRM**: Pancake chỉ biết token page nên GAS ghi tên nhân viên CRM vào cột mới `pk_messages.crm_user` ngay sau khi gửi (`_pkMarkCrmSender_`: PATCH nếu webhook đã vọng lại, chưa thì chèn dòng `ignore-duplicates`; lỗi thì bỏ qua, không làm hỏng việc gửi). Webhook vọng lại KHÔNG ghi đè cột này. **Cần để workflow Deploy Supabase schema chạy** (cột `crm_user`); chưa có cột thì GAS tự đọc lại không có nó (tin CRM tạm hiện tên Pancake/page).
- **Thẻ + người xử lý**: webhook chỉ lưu MÃ SỐ thẻ (`tags`) và uuid nhân viên (`assignee_ids`). GAS đổi sang tên + màu bằng API chính thức `GET /api/public_api/v1/pages/{page}/tags` và `/pages/{page}/users` (cần `PANCAKE_PAGE_TOKENS`), cache 6 giờ/page (`pkTags_<page>`, `pkUsers_<page>`; lỗi/chưa có token thì nhớ rỗng 10 phút, hội thoại vẫn hiện, chỉ thiếu thẻ). Mã không có trong danh sách thẻ (vd `-99`) bị bỏ. Màu chỉ nhận `#hex` (chống chèn CSS). Hiện ở: danh sách hội thoại (tối đa 3 thẻ + `+n`), đầu khung chat (đủ thẻ + 👤 người xử lý), tab Chat trong hồ sơ khách.
- Tin gửi từ CRM tạm (chưa vọng lại) hiện tên người đang đăng nhập + `CRM ✓`.
- Test: `node tools/test-pk-chat-gas.js` (40 ca), `NODE_PATH=<jsdom> node tools/test-pk-chat-meta.js` (16 ca), `test-pk-chat-ui.js` (18 ca).

## Gắn/gỡ thẻ từ CRM + "Ai đã chat" (2026-10-13, GAS `v13.53-pk-tags`) — giống Pancake
**Thẻ (tag).** Hướng Pancake → CRM đã có từ trước (webhook sự kiện `conversation` cập nhật cột `tags`). Mới thêm hướng CRM → Pancake bằng API chính thức (đã đối chiếu tài liệu `docs.pancake.vn/vi/developers/api-reference`): `POST /api/public_api/v1/pages/{page}/conversations/{conv}/tags?page_access_token=…` body `{action:'add'|'remove', tag_id:'<mã>'}` → `{success, data:[mã thẻ sau khi cập nhật]}`.
- **Thanh thẻ** nằm ngay trên ô soạn tin, ở cả **Social > Chat** (`#sc-tags`) và tab **Chat trong hồ sơ khách** (`#pkc-tags`): thẻ đang gắn (bấm để gỡ) + nút "＋ Gắn thẻ" mở bảng chọn thẻ của page (tên + màu lấy từ Pancake, có ô tìm không dấu, nút 🔄 tải lại khi vừa tạo thẻ mới trên Pancake). Bấm 1 thẻ = gắn/gỡ.
- **Hiện ngay** (lạc quan), lỗi thì trả lại thẻ cũ và báo; bấm đôi bị bỏ qua. Sau khi Pancake nhận, GAS ghi luôn `tags` mới vào Supabase; kết quả vừa gắn được giữ 20 giây (`_pkTagOv`) để lần poll 6–8 giây không làm thẻ nhảy lại thẻ cũ.
- **GAS:** `GET pkChatTags?pageId=|conv=[&refresh=1]` (danh sách thẻ của page, cache 6 giờ như cũ), `POST pkChatTag {convId, tagId, op}` (cần đăng nhập, trừ tài khoản test; mọi vai trò đăng nhập gắn/gỡ được, giống xem/gửi tin hiện nay; Pancake tự lưu lịch sử gắn/gỡ). Mã thẻ không nằm trong danh sách thẻ của page bị từ chối trước khi gọi Pancake; lỗi Pancake trả về không lộ token.
**Ai đã chat.**
- Dưới mỗi tin vẫn là `TÊN NGƯỜI GỬI · GIỜ` (đã có). Mới: dòng **"✍️ Đã chat: Le Ninh 2 · Lan 1"** dưới tiêu đề khung chat (nhân viên đã trả lời + số tin, tính từ các tin đang tải: tên nhân viên CRM hoặc nhân viên Pancake `raw.from.admin_name`; tin chỉ có tên page không tính là người). Tính ở trình duyệt từ dữ liệu đã tải, không tốn thêm lượt gọi server.
- **KHÔNG làm** dòng "↩ nhân viên trả lời gần nhất" ở danh sách hội thoại: cần thêm 1 truy vấn Supabase mỗi lần poll, vi phạm trần UrlFetch 20.000/ngày (sự cố "urlfetch quá nhiều lần/ngày", cache 15 giây của hộp thư, `tools/test-pk-staff-gas.js` canh đúng việc này). Muốn có: thêm cột `last_staff` vào `pk_conversations` và ghi khi nhận tin `out` (trigger `pk_ingest_raw` + `_pkMarkCrmSender_`) để danh sách chỉ đọc cột, không tốn truy vấn.
- **CHƯA xác nhận với dữ liệu thật:** webhook có gửi tên nhân viên cho tin trả lời từ app Pancake hay không. Nếu tin nhân viên vẫn hiện tên page: chạy hàm **`pkXemNguoiChat`** trong Apps Script Editor, xem Execution log để thấy trường chứa tên nhân viên, rồi gửi lại để sửa `_pkMsgOut_`.
**Cần làm tay:** deploy lại GAS; đã đặt `PANCAKE_PAGE_TOKENS` (chung với gửi tin) — token page cần quyền gắn thẻ; Ctrl+F5 CRM.
**Chưa làm:** dòng "↩ trả lời gần nhất" ở danh sách (xem trên), phân công nhân viên (`/assign`) từ CRM, tạo/xoá thẻ mới (chỉ gắn/gỡ thẻ có sẵn), thông báo thẻ đổi tức thì khi người khác gắn trên Pancake (phụ thuộc webhook `conversation`).
**Test:** `node tools/test-pk-chat-tags.js` (GAS), `NODE_PATH=<jsdom> node tools/test-pk-chat-tagbar.js` (giao diện, 35 ca).

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

## Hồ sơ khách cạnh khung chat (Social > Chat) — 2026-10-12
Chọn 1 hội thoại → bên phải hiện hồ sơ khách (cùng SĐT) như cột "Thông tin" của Pancake, **dùng lại đúng ngăn hồ sơ của Danh sách KH** (`#dp`: tab Chăm sóc / Lịch hẹn / Lịch sử đơn / Tổng quan, tự lưu) bằng cách chuyển `#dp` vào cột `#sc-dock` (`js/42-fn-socialchat.js`: `scDockSync`, `_scUndock`). Chat đã ở giữa nên tab "💬 Chat" của hồ sơ bị ẩn trong chế độ này.
- Hội thoại không có SĐT / khách chưa có trong CRM / màn hình <1000px → không gắn; nút "👤 Mở hồ sơ" quay về cách cũ (nhảy sang Danh sách KH, tìm theo SĐT).
- Nút ✕ của hồ sơ = lưu nốt rồi gỡ cột, chat chiếm lại toàn bộ chiều rộng; bấm "👤 Mở hồ sơ" để hiện lại.
- Mở hồ sơ từ Danh sách KH thì ngăn tự trả về dạng trượt từ phải như cũ (`openDp` gọi `_scUndock`).
- Hồ sơ gắn cạnh chat tự cập nhật khi dữ liệu thay đổi (`_maybeRefreshOpenDp` tính cả `_scDocked`).
- Test: jsdom, dùng `openDp`/`closeDp`/code gắn thật (18 ca). Chưa kiểm trên trình duyệt thật.

- [x] **Bước 6a — tên nhân viên (code xong 2026-10-13, CHƯA kiểm với API thật):** `supabase/schema.sql` mục 10 (`pk_staff`), GAS `pkNhanVienThu` (chạy thử, KHÔNG ghi, in mẫu `users`) và `pkNhanVienDongBo` (ghi `pk_staff`); `pkChat/pkChatInbox/pkChatFind` trả thêm `assignees` (tên) + `assigneeIds`. Dạng JSON của `GET /api/public_api/v1/pages/{page}/users` CHƯA xác nhận → code đọc khoan dung (mảng ở `users`/`data`/chính nó; id = `id|user_id`; tên = `name|full_name|fb_name`). Việc cần làm: deploy GAS (`ver` = `v13.41-pkstaff`), chạy `pkNhanVienThu`, đối chiếu Log; đúng thì chạy `pkNhanVienDongBo`. Giao diện CHƯA hiện tên sale (chỉ backend trả sẵn) — làm sau khi tên về đúng. Test: `node tools/test-pk-staff-gas.js`.

- [x] **Mẫu thật 2026-10-13 đã đối chiếu:** `phone_info` = mảng object `{captured, phone_number, status, offset, length, m_id}` (hàm tách đọc `phone_number`); `tags` = mảng MÃ SỐ nguyên (vd `[109]`), KHÔNG phải object có tên → tên/màu thẻ lấy từ API `GET /pages/{page}/tags` (GAS `_pkTagMap_`). Test khoá lại bằng mẫu này: `python3 tools/test-pk-ingest-pancake.py`.

- [x] **Bước 7 — đọc hộp thư qua Cloudflare Worker (code xong 2026-10-14, MẶC ĐỊNH TẮT):** nguyên nhân gốc lỗi "urlfetch quá nhiều lần/ngày": mỗi lần poll tab Chat đi qua Apps Script tốn ≥2 lượt UrlFetch. Worker nay tự đọc Supabase cho 4 action chỉ-đọc `pkChatInbox/pkChat/pkChatConv/pkChatFind` (không tính hạn mức GAS). Bật bằng biến Cloudflare **`PK_NATIVE=1`**; cần sẵn `SESS_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`. **`PK_DENY_USERS`** = tên đăng nhập tài khoản test/demo cách nhau dấu phẩy (Worker không biết vai trò nên các tài khoản này vẫn đi qua GAS để bị từ chối). Thiếu điều kiện / Supabase lỗi → tự chuyển GAS như cũ. Tên thẻ lấy từ bảng `pk_tags`, tên nhân viên từ `pk_staff`: chạy `pkDanhMucDongBo` 1 lần (rồi `pkDanhMucCaiTrigger` để tự chạy 6 giờ/lần). Kiểm tra: DevTools → Network → request `action=pkChatInbox` có header `x-crm-cache: NATIVE`. Test: `node tools/test-cloudflare-worker.js`, `node tools/test-pk-staff-gas.js`.
  - Chưa có ở Worker (so với GAS): tên nhân viên chưa có trong `pk_staff` thì để trống (GAS còn hỏi API users). Gửi tin từ CRM (`pkChatSend`) vẫn đi qua GAS.

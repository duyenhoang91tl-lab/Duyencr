# Giám sát chat Pancake — phát hiện sale dùng TỪ CẤM, cảnh báo admin (lập 2026-10-17)

Yêu cầu Duyên: Pancake AI kiểm soát được việc nhắn tin của nhân viên; sheet **"Lưu ý từ cấm"** (cột "Từ cấm", file Report Sale) là từ sale KHÔNG được dùng; phát hiện sale chat sai và **cảnh báo admin `duyenht`**.

## Trạng thái
- [x] **Giai đoạn 1 — quét phía server (code xong, test `tools/test-chat-audit.js`, CHƯA chạy với dữ liệu Pancake thật).** Không phụ thuộc máy sale có cài extension hay không.
- [ ] **Giai đoạn 2 — cảnh báo NGAY TRÊN Pancake cho chính sale (extension Pancake AI):** khi sale gõ/gửi tin có từ cấm hiện cảnh báo + gợi ý "từ được dùng" trước khi gửi, đồng thời báo về GAS. **Chưa làm** (cần xem DOM ô soạn tin của Pancake thật; xem "Việc tiếp").

## Cách hoạt động
1. Webhook Pancake đã ghi mọi tin vào Supabase `pk_messages` (docs/PANCAKE-INBOX.md). Tin **gửi ra** có `direction='out'`.
2. Trigger 5 phút/lần gọi `chatAuditScan` → `cvScanOnce_`: đọc tin `out` mới từ mốc `cvCursor` (≤5 trang × 500 tin/lượt), so với danh sách từ cấm.
3. Danh sách từ cấm = `readBannedWords_()` (đọc **trực tiếp** tab "Lưu ý từ cấm", cache 30 phút; đổi sheet là tự cập nhật; mất quyền đọc thì dùng bản chép `BANNED_WORDS_FALLBACK`).
4. **Cách khớp** (`cvDetect_`): không phân biệt hoa/thường; theo **từ/cụm** (không bắt chuỗi con: "lọc" ≠ "lộc", "block" không dính); tin gõ **không dấu** thì so với bản bỏ dấu ("em cam ket" vẫn bắt "cam kết"); cụm dài nuốt cụm ngắn ("Lộc phúc tình" không báo thêm "Lộc").
5. Vi phạm → ghi sheet **`ChatViolations`** (id tin, thời gian, Page/kênh, hội thoại, SĐT, tên khách, nhân viên, từ cấm, trích đoạn ≤300 ký tự; không ghi trùng) + **thông báo trong CRM (chuông 🔔)** cho admin: **gộp theo nhân viên mỗi lượt quét** ("⚠️ Lan dùng từ cấm trong 3 tin: "cam kết" ×2, …"), bấm vào mở hồ sơ khách (tab Chat xem hội thoại). Tuỳ chọn gửi email.
6. Xem danh sách: sheet `ChatViolations`, hoặc `GET ?action=chatViolations&token=...` (CHỈ admin, trả 200 mục mới nhất + tổng hợp theo nhân viên/từ).

## Bật lên (làm 1 lần, trong Apps Script Editor)
1. Chờ GitHub Actions deploy GAS xanh.
2. `xemTuCamGiamSat` → xem log: số từ/cụm cấm đang dùng. **Nếu thấy từ quá phổ biến (vd "Tiền", "Lộc", "Mua bán") thì nên bỏ qua** vì sale nói "chuyển tiền cọc" là bình thường và sẽ báo ngập: `datChatAuditBoQua("tiền, lộc")`.
3. (tuỳ chọn) `datChatAuditAdmin("duyenht")` (mặc định đã là `duyenht`; nhiều người: `"duyenht, abc"`). Email: đặt Settings `chatAuditEmail`.
4. `batGiamSatChat(24)` — tạo trigger 5 phút/lần và quét lùi 24 giờ (tối đa 72). Chạy thử ngay: `chayGiamSatChat`, rồi xem sheet `ChatViolations` + chuông thông báo của `duyenht`.
5. Tắt: `tatGiamSatChat`.

## Giới hạn đã biết (đọc kỹ)
- **Ai là người gửi:** Pancake KHÔNG trả tên nhân viên cho từng tin gửi từ app Pancake (docs/PANCAKE-INBOX.md). Tên lấy theo thứ tự `crm_user` > `staff_name` > `raw.from.admin_name`; không có thì ghi **"(chưa rõ nhân viên)"** kèm Page + hội thoại để tra. Chạy `pkXemNguoiChat` nếu muốn xác nhận trường tên thật.
- **Không chặn trước khi gửi** (giai đoạn 1 chỉ phát hiện sau khi tin đã gửi, trễ ≤ 5 phút). Chặn/cảnh báo trước khi gửi là giai đoạn 2.
- **Tin của bot/AI tự trả lời** cũng nằm trong `direction='out'` và cũng bị quét (từ cấm áp cho mọi tin gửi khách).
- **Hạn mức UrlFetch 20.000/ngày:** trigger 5 phút ≈ 300 lượt/ngày × 1–2 truy vấn — chấp nhận được; đừng hạ xuống 1 phút.
- Mốc quét theo `sent_at`; 2 tin trùng đúng mili-giây nằm ở ranh giới 500 tin có thể bị bỏ sót (hiếm; ghi nhận).
- Chỉ **tin chữ** (không quét ảnh/âm thanh). Sai chính tả/biến thể (vd "cam kêt") không bắt được.

## Việc tiếp (giai đoạn 2)
- [ ] Extension Pancake AI: bắt ô soạn tin (`pancake-content.js`) → highlight từ cấm + gợi ý thay thế trước khi gửi; gọi `chatViolationReport` (cần thêm vào `EXT_ALLOWED_.pancake` + ghi tên nhân viên thật theo tài khoản đăng nhập Pancake). Cần Duyên chụp/mô tả ô soạn tin Pancake để chọn đúng selector.
- [ ] Tab/Màn hình "⚠️ Cảnh báo chat" trong CRM (dùng `chatViolations`), nút "Đã xử lý"/bỏ qua từ.
- [ ] Mở rộng sang **"Tiêu chí check tin"** (tab khác trong Report Sale): kiểm tra thêm chất lượng tin nhắn (chào/hỏi nhu cầu/chốt...) — cần xem nội dung tab đó.
- Test: `node tools/test-chat-audit.js`.

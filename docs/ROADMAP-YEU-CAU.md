# Lộ trình thực hiện "Yêu cầu CRM Thu Hiền" (lập 2026-10-11)

Nguồn: file `yêu_cầu_crm.docx` của Duyên (8 mục). Tài liệu này = kết quả đối chiếu yêu cầu với code hiện có + thứ tự làm.
Mỗi phiên làm xong 1 mục nhỏ thì push ngay, tick `[x]` ở đây và ghi "việc cần làm tiếp" (quy tắc 12).

## A. Phát hiện khi đối chiếu code (đã grep, không đoán)
1. **Phân quyền CHƯA chặn ở backend.** `verifyLogin_` chỉ trả `role/name`, không phát token; `doGetCore_` các action `lookup`, `customers`, `tasks`... không kiểm người gọi. Lọc phạm vi (`_inUserScope`, `_inCSScope`) nằm ở client. Yêu cầu mục 2.2/8 ("chặn ở backend") chưa đạt → việc nền số 1.
2. **Vai trò:** yêu cầu 5 vai trò (admin, CEO, trưởng phòng, leader, sale). Code thấy rõ admin / cs / leader / demo; `ceo`, `tp` chưa có xử lý riêng. `USER_HEADERS` đã có `saleType`, `startDate` (dùng được cho hồ sơ sale).
3. **Hạng:** 2 hệ ghi cứng ở 3 nơi: backend `_AA_TIER`/`_AA_HANG_LABEL` + khối ~dòng 10348–10369 (`gas_v13.js`), client `_hangKeyOf_` (`js/05-fn-saveeditphone.js`), `tierBadge`. Comment dòng ~10349 ghi "15–30tr = Thân thiết" nhưng nhãn là "Ưu tiên" → lệch tên, cần chốt khi gộp.
4. **Mốc sau mua:** `FU_CHECKPOINTS=[7,14,30,60]`, `FU_START=5/2026` và `fuSourceAllowed_` (landipage/messenger/web) ghi cứng; `runFollowUpScan_` chỉ tạo broadcast chờ duyệt, KHÔNG tạo việc trong Lịch chăm sóc. Đã có: log chống trùng (`FollowUpLog` khoá `sđt|ngày|mốc`), 1 khách 1 tin/lần quét, chia theo CS.
5. **Công việc (tasks):** `TASK_HEADERS` chỉ có title/description/csAssigned/deadline/status/... — chưa có quy trình 8 bước, chưa có quyền theo bước, xác nhận kế toán, thông báo. Có bình luận kèm ảnh (`TASK_COMMENT_HEADERS`).
6. **AI tóm tắt:** đã có nền `teamAnalysis_`/`scoreTeam_`/`orgOverview_` (v13.23–24) + modal `js/30-fn-teamanalysis.js`. Cần nâng cấp, không làm từ đầu.
7. **Chiến dịch:** có `broadcast` (4 kịch bản, 200/ngày/máy), `bct` (theo sản phẩm), thống kê gửi. Chưa có thực thể "chiến dịch resale" (thời điểm, ưu đãi, đo doanh thu).
8. **Hộp thư chung:** Pancake có API công khai (conversations, messages, webhook, call logs — docs.pancake.vn/developers). Zalo cá nhân KHÔNG có API chính thức (chỉ Zalo OA có). Extension hiện chỉ đọc DOM.
9. **Dữ liệu chưa có** (mục 7): tin SALE gõ tay, cuộc gọi, tỷ lệ chốt tự động → cần ghi nhận mới trước.
10. Lệch tài liệu cũ: "20 cột CareData" → thực tế 22 (`custom`, `zaloPhones`); "khối `gas-code-v9`" đã xoá (KB `01-rules-and-deploy.md`). Mỗi lần sửa `gas_v13.js`: chạy `node tools/split-gas.js` + `--check`, báo ĐÚNG các file `gas/*.gs` đổi để Duyên dán.

## B. Quy tắc xuyên suốt cho mọi màn mới
- Bộ lọc ngày LUÔN có: Hôm nay, Hôm qua, Tuần này, Tuần trước, Tháng này, Tháng trước (+ quý, năm).
- Một chỉ số = một hàm tính backend (tái dùng `buildSalesReportB_`, `_mergeTachDon_`, `_donSaleNamesFromThe_`); báo cáo, hồ sơ sale, AI tóm tắt dùng chung.
- Tính ở backend, không kéo toàn bộ đơn về trình duyệt. Chỉ số chưa có dữ liệu hiện "chưa có dữ liệu", không hiện 0.
- Mọi thay đổi cấu hình (hạng, mốc, chiến dịch, ngưỡng) ghi AuditLog (giờ, người, giá trị cũ/mới).
- Key AI/token chỉ ở phía server.

## C0. Quyết định Duyên đã chốt (2026-10-11)
- **Q1:** dữ liệu mới → **Supabase** (bảng mới tạo trong Supabase; bước 5 Supabase vẫn chờ Duyên đồng ý riêng).
- **Q2:** hạng **giữ trọn đời**; "điểm tiêu" cài đặt **theo từng năm** — *cần Duyên giải thích rõ "điểm tiêu" là gì (điểm tích luỹ theo năm? ngưỡng chi tiêu từng năm?) trước khi làm P1a*.
- **Q5:** trạng thái thất bại trên Base = **hủy/hoàn**. **Q6:** **renew = bán lại** (một định nghĩa, một hàm).
- **Q8:** tin Zalo lấy từ **extension Zalo AI hiện tại**; Zalo đang tích hợp trực tiếp vào Pancake; tổng đài **ccall có API** (cần xin tài liệu API/khoá).
- Còn mở: Q3 (mốc khi mua lại giữa chừng), Q4 (nguồn đơn áp mốc), Q7 (mục tiêu KPI theo công ty/team/sale), Q9 (kênh gửi tóm tắt).

## C. Quyết định cần Duyên chốt TRƯỚC khi làm phần tương ứng
| # | Câu hỏi | Chặn phần |
|---|---|---|
| Q1 | Bảng mới (việc, lịch sử hạng, chiến dịch, nhật ký tin/gọi) lưu ở Sheets hay Supabase? (liên quan Supabase bước 5: Supabase có thành nguồn thật không) | P2–P7 |
| Q2 | Gộp 2 hệ hạng thành 1, hay giữ cả hai? Kỳ tính hạng: trọn đời hay cửa sổ (vd 12 tháng) + quy tắc xuống hạng? | P1 |
| Q3 | Khách mua lại giữa chừng: mốc kế tiếp tính theo đơn nào (mới nhất hay đơn đang chăm)? | P2 |
| Q4 | Nguồn đơn được áp dụng mốc (hiện landipage/messenger/web) — danh sách mong muốn? | P2 |
| Q5 | "Hủy/hoàn" gồm trạng thái nào (Đã hoàn, Đang hoàn, Giao không thành?) | P4, P5 |
| Q6 | "Renew" vs "bán lại" khác nhau thế nào? (renew theo nguồn đơn hay theo khách đã có đơn trước) | P4, P5 |
| Q7 | Mục tiêu KPI đặt theo công ty / team / từng sale? | P4, P5 |
| Q8 | Hộp thư chung: cách lấy tin Zalo (extension đẩy tin về / Zalo OA / chỉ hiển thị Pancake + giữ Zalo web)? Tổng đài ccall dùng hãng nào, có API? | P7 |
| Q9 | Gửi bản tóm tắt cuối ngày/tuần: kênh (email/Zalo) và người nhận | P4 (tuỳ chọn) |

## D. Các giai đoạn (mỗi mục nhỏ push riêng, có công tắc/rollback)
### P0 — Nền tảng (làm trước, chặn phần còn lại)
- [~] 0a (phiên khác đã làm bước 1+2 = webLogin + token HMAC, xem `docs/SECURITY-PLAN.md`; bước 3 log không token đã xong; CÒN bước 3b gắn `src`/token ở client+extension và bước 4 bắt buộc token + lọc theo vai trò) Phát token phiên khi đăng nhập (HMAC, hết hạn), mọi request dữ liệu kèm token; backend tính `role` + phạm vi (admin/ceo/tp: tất cả hoặc theo cấu hình; leader: theo team; sale: khách mình phụ trách/chăm sóc). Bật bằng cờ, mặc định chế độ "ghi log không chặn" 1 tuần → rồi mới chặn. Extension gửi token (cả Zalo AI và Pancake AI).
- [ ] 0b Thêm vai trò `ceo`, `tp`; admin bật/tắt tab theo người đã có (`perms`) → thêm kiểm ở backend.
- [ ] 0c `scopeOf_(user)` dùng chung cho mọi action mới (báo cáo, hồ sơ sale, chiến dịch, AI tóm tắt).
- [ ] 0d Hàm chỉ số dùng chung (`metrics`): doanh thu Pos, số đơn, hủy/hoàn, renew, bán lại; có test Node đối chiếu 1 tuần mẫu (sai lệch 0).
- [ ] 0e Mở rộng AuditLog cho thay đổi cấu hình.

### P1 — Hạng thành viên (mục 5)
- [ ] 1a Cấu hình hạng trong Settings (`tierConfig`: tên, màu, ngưỡng doanh thu/số đơn, kỳ tính) + modal admin.
- [ ] 1b Một hàm `tierOf_` backend; thay 3 chỗ ghi cứng (grep toàn bộ nơi gọi trước, quy tắc 7); client đọc cấu hình.
- [ ] 1c Lịch sử đổi hạng (ngày, từ→đến, đơn nào) + việc chúc mừng cho SALE khi lên hạng (dùng cơ chế việc ở P2).
- [ ] 1d Huy hiệu ở Danh sách KH/hồ sơ/bộ lọc/báo cáo; thống kê theo hạng; "sắp lên/sắp rớt hạng".
- [ ] 1e Quyền lợi theo hạng (admin khai) → chiến dịch chọn đối tượng theo hạng.

### P2 — Việc chăm sóc theo mốc (mục 3)
- [ ] 2a Bảng cấu hình mốc (D, D3, D7, D14, 30, 60, 90 ngày): nội dung, kênh, theo sản phẩm/nhóm, theo SALE; admin sửa không cần code. Bỏ ghi cứng `FU_CHECKPOINTS`/`FU_START`/`fuSourceAllowed_`.
- [ ] 2b Sinh VIỆC trong Lịch chăm sóc (loại gọi/sản phẩm/chăm sóc/hẹn) cho SALE đang chăm sóc; chống trùng khoá `sđt|đơn|mốc`; bỏ qua đơn hoàn/hủy, khách chặn, Zalo ngừng hoạt động; mỗi lần quét 1 việc/khách.
- [ ] 2c Kết quả khi đánh dấu xong: đã liên hệ / không nghe máy / từ chối / hẹn lại; quá hạn sang tab Quá hạn.
- [ ] 2d Tin soạn sẵn từ mẫu, SALE duyệt rồi gửi qua Zalo AI/Pancake AI (không tự gửi).
- [ ] 2e Báo cáo theo mốc: đúng hạn / trễ / bỏ qua, theo SALE và ngày. Test chạy 2 lần liên tiếp không tạo trùng.

### P3 — Chiến dịch resale (mục 4)
- [ ] 3a Thực thể chiến dịch (tên, ngày, trạng thái nháp/đang chạy/tạm dừng/kết thúc, đối tượng lưu thành điều kiện, ưu đãi gắn CTKM, kênh Zalo/Messenger/gọi).
- [ ] 3b Thời điểm: khoảng cách từ đơn gần nhất (60/90/180/365), lịch cố định, sinh nhật, theo hạng, chạy 1 lần hoặc tự động.
- [ ] 3c Chống chồng lấn (1 khách 1 chiến dịch đang chạy, trần số tin/khoảng thời gian — cấu hình được; loại khách chặn/vừa mua/đang quá hạn). GIỮ giới hạn gửi hàng loạt hiện có (200/ngày/máy, giãn cách, SALE duyệt).
- [ ] 3d Kênh gọi → sinh việc trong Lịch chăm sóc (dùng cơ chế P2).
- [ ] 3e Đo kết quả theo chiến dịch/kịch bản: vào, liên hệ, phản hồi, mua lại, doanh thu bán lại (đơn Pos sau khi liên hệ trong N ngày), tỷ lệ chuyển đổi; đẩy sang báo cáo + hồ sơ sale.

### P4 — AI tóm tắt kết quả (mục 6) — nâng cấp từ `orgOverview_`
- [ ] 4a Màn tổng quan: chọn kỳ + kỳ so sánh, thẻ chỉ số (doanh thu, đơn, hủy/hoàn, renew) có mũi tên/%/đỏ-xanh + ký hiệu; biểu đồ theo ngày; top sản phẩm; top sale. (Tính backend.)
- [ ] 4b Đoạn tóm tắt AI 3–5 ý: AI chỉ viết lời từ số do code đưa vào; lưu bản đã tạo; AI lỗi vẫn hiện đủ số.
- [ ] 4c Bảng sản phẩm tồn (cần nguồn tồn kho — hiện chưa có, hỏi Duyên); phân quyền theo phạm vi.
- [ ] 4d (tuỳ chọn) gửi tóm tắt cuối ngày/tuần (Q9).

### P5 — Hồ sơ sale (mục 7)
- [ ] 5a GĐ1: trang hồ sơ (thông tin sale, hiệu suất theo kỳ so kỳ trước và trung bình nhóm, xu hướng, sản phẩm/khách) chỉ từ chỉ số Pos đã có; mở từ top sale; xuất Sheet.
- [ ] 5b GĐ2: số khách tiếp cận (AuditLog/CareData) + việc theo mốc (P2) + kết quả chiến dịch (P3).
- [ ] 5c GĐ3: tin nhắn và cuộc gọi (phụ thuộc P7 + tổng đài); "Một ngày của sale" bấm vào tin nhắn mở khung chat.

### P6 — Quy trình đơn / Công việc 8 bước (mục 2.2) — độc lập, làm song song sau P0
- [ ] 6a Mô hình dữ liệu: đơn công việc + 8 bước (chốt đơn → tạo đơn → phân loại → sản xuất → kho thành phẩm → đóng hàng → EMS → hoàn thành/thất bại), người được phép theo từng bước (admin cấu hình).
- [ ] 6b Tạo công việc ngay tại màn chat Pancake (extension): nội dung đơn đầy đủ + file đính kèm.
- [ ] 6c Xác nhận chéo (vd SALE up ảnh CK → kế toán xác nhận kèm ảnh đối soát → thông báo bộ phận tạo đơn sửa COD); request cần TP/leader xác nhận kèm thông báo người được nhắc.
- [ ] 6d Chat trong từng đơn (tag người, ảnh, yêu cầu xác nhận) + thông báo.
- [ ] 6e Đồng bộ trạng thái ngược từ EMS (cần API EMS — hỏi Duyên).

### P7 — Hộp thư chung Zalo + Pancake (mục 2) — dự án lớn, cần Q8
- [ ] 7a Khảo sát khả thi + chọn kiến trúc (Apps Script không làm realtime được → cần Cloudflare Worker `cloudflare/` + Supabase). Pancake: API + webhook chính thức. Zalo: chọn đường (extension đẩy tin về — mong manh, rủi ro điều khoản; Zalo OA — chỉ khách của OA).
- [ ] 7b Pancake trước: danh sách hội thoại + khung chat + gửi tin trong CRM, gắn khách theo SĐT.
- [ ] 7c Zalo theo đường đã chọn; 7d nhật ký tin/cuộc gọi cho hồ sơ sale.

## E. Thứ tự đề xuất
P0 → P1 → P2 → P3 → P4 → P5(GĐ1–2) ; P6 chạy song song sau P0 ; P7 sau khi chốt Q8 ; P5(GĐ3) sau P7.
Lý do: P0 (token/phạm vi + hàm chỉ số) là nền cho mọi màn mới; P1 nhỏ, rõ và P2/P3 dùng lại; P4/P5 cần số liệu nhất quán từ P0d.

## F. Mỗi lần giao việc, nhắc Duyên (theo quy tắc project)
1. `gas_v13.js` đổi → `node tools/split-gas.js` → báo ĐÚNG các file `gas/*.gs` cần dán đè (file mới thì tạo thêm trong Editor) → Deploy → Manage deployments → New version.
2. Admin: "🔄 Đồng bộ mã GAS mới nhất" trong modal Google Sheets (không còn khối `gas-code-v9`).
3. Extension đổi → reload ở `chrome://extensions`.

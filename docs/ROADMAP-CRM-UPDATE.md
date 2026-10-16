# Kế hoạch bổ sung CRM (cập nhật 2026-10-16) — dùng để phân công

Nguồn: bản `yeu_cau_crm_cap_nhat.docx` (mục 9–14 tô vàng). **Phần API (mục 9: Pancake/Zalo OA/ZNS, POS, Base, vận chuyển) TẠM BỎ QUA theo yêu cầu Duyên 2026-10-16.**
Tài liệu này bổ sung cho `docs/ROADMAP-YEU-CAU.md` (P0–P7, lập 2026-10-11) — không thay thế. Mỗi hạng mục có 1 issue GitHub tương ứng (nhãn `crm-update`) để gán người.

Cách làm cho mọi người nhận việc: đọc `docs/crm-kb/00-READ-FIRST.md` + `01-rules-and-deploy.md` trước; push từng mục nhỏ bằng `TK=<token> bash tools/safe-push.sh` (MERGE-ONLY, cấm rebase/force); tick `[x]` ở đây + ghi "việc cần làm tiếp" trong commit; chỉ sửa theo yêu cầu (quy tắc 14).

## Đối chiếu nhanh yêu cầu mới ↔ code hiện có (đã grep)
| Yêu cầu | Hiện trạng trong repo | Kết luận |
|---|---|---|
| Phân quyền theo bộ phận (mục 10) | Đã có vai trò + bộ phận: `roleConfig`/`deptPerms`, `_featureAllowed_`, `_featureGate_`, màn 🛡 Phân quyền (`js/40-fn-rolesettings.js`). Quyền theo **hạng mục/tab/báo cáo**, chưa theo **trường dữ liệu** (ẩn giá, ẩn SĐT) | Làm tiếp, không làm lại |
| Luồng đơn 5 bước (mục 11) | Có quy trình công việc nhiều giai đoạn: `TASK_FLOW`, `taskAdvance`, `taskRequests`, thông báo (`gas_v13.js` ~11360). Chưa có thực thể **Đơn hàng** riêng (sản phẩm, tồn kho, duyệt/từ chối) | Mở rộng cơ chế Công việc/ROADMAP-YEU-CAU P6, chờ Duyên chốt Q-A |
| Khuyến mãi (mục 12.1) | Sheet `CTKM` chỉ để tra/AI trả lời (`gas_v13.js` ~694–720); Pancake AI có giỏ hàng + trường khuyến mãi. Chưa có engine tính giá | Mới |
| Tích điểm (mục 12.2) | Đã có phiên bản tối giản trên client: 1% giá trị đơn = điểm, điểm tiêu đọc từ ghi chú đơn (`js/06-main-renew-sources.js` ~PTS_RATE, hiển thị `js/05-fn-saveeditphone.js` ~672). Chưa cấu hình được, chưa lưu server, chưa trừ vào thanh toán | Nâng cấp, giữ tương thích |
| Tách doanh thu 30/70 (mục 13) | Đã có quy tắc **riêng đơn Quầy Hào Nam gắn thẻ sale + note "30/70"** (`QUAY_SALE_RATIO_`, `_quaySaleRatio_`, `gas_v13.js` ~5369) | Tổng quát hoá thành cấu hình, cần Duyên chốt Q-C |
| KPI / trạng thái đơn (mục 13) | Đã có phần lớn: `posMetrics_`, báo cáo G (hủy/hoàn), Báo cáo H, KPI Pancake, `orgOverview_` | Chỉ bổ sung số còn thiếu (tin nhắn, lead, lý do hoàn) |
| UI nhập đơn nhanh + 2 loại ghi chú (mục 14) | Pancake AI: Soạn đơn từng bước, giỏ hàng, tra bảng giá. Chưa tách "ghi chú nội bộ" / "ghi chú đơn hàng" | Làm tiếp trên extension (cả Zalo AI + Pancake AI, quy tắc 15) |

## Quyết định Duyên đã chốt (2026-10-16) — thay cho câu hỏi Q-A…Q-E
- **Q-A (nguồn đơn):** HIỆN VẪN DÙNG Base + Pos làm nguồn chuẩn. Đơn tạo trên CRM chỉ là bản thay thế từng bước; khi nào CRM hoàn thiện Duyên sẽ báo chuyển hẳn sang dùng CRM. ⇒ Thiết kế U2 phải có **công tắc nguồn đơn** (mặc định = Base/Pos), đơn CRM chạy song song, KHÔNG đổi số báo cáo hiện có.
- **Q-B (quyền xem):** Đóng gói **được thấy tên + địa chỉ khách** (để in phiếu). Vẫn ẩn giá; SĐT mặc định ẩn nhưng admin bật/tắt được theo trường. Cửa hàng thấy giá: mặc định CÓ (câu trả lời "có" áp cho cả hai ý của câu hỏi) — admin chỉnh được; *Duyên xác nhận lại nếu khác*.
- **Q-C (tỷ lệ chia doanh thu):** Mặc định **chia đều giữa các sale tham gia đơn** (như hiện nay). Admin được **cài tỷ lệ lệch** cho đơn có 2 bộ phận tham gia (vd 30/70 Sale online + Cửa hàng). Quy tắc Quầy Hào Nam 30/70 hiện tại giữ nguyên là một cấu hình mẫu.
- **Q-D (điểm):** Điểm có **hạn dùng trong năm** (hết hạn cuối năm). Đơn hoàn/hủy: **trừ đi đúng số điểm đã cộng của đơn đó**; nếu số dư thành âm thì **dừng ở 0, không ghi nợ** (hiểu theo "âm thì thôi" — *Duyên xác nhận lại nếu ý khác*). Còn mở nhỏ: giá trị quy đổi 1 điểm (hiện 1.000đ), voucher + điểm dùng chung 1 đơn?, gắn hạng thành viên? — làm mặc định theo hiện trạng, hỏi sau.
- **Q-E (khuyến mãi):** Làm **đủ mọi loại** (combo giá sốc, %, số tiền cố định, quà tặng, voucher mã). Mỗi CTKM có cờ do admin cài: **áp đồng thời được** hoặc **không áp cùng CT khác** (có thể chỉ rõ danh sách CT loại trừ).

## Các hạng mục (mỗi hạng mục = 1 issue, chia việc nhỏ có thể giao riêng)

### U1 — Phân quyền theo bộ phận và theo trường dữ liệu (mục 10) · Q-B đã chốt · nền: P0b đã xong
- [ ] U1a (Đóng gói thấy tên+địa chỉ, ẩn giá; Cửa hàng thấy giá — mặc định, admin sửa được) Định nghĩa 4 bộ phận chuẩn trong `roleConfig`/`deptPerms`: Sale, Cửa hàng/Store, Sản xuất/Đóng gói, Kế toán/Quản lý (có mẫu cấu hình sẵn, admin sửa được).
- [ ] U1b Thêm khái niệm **quyền theo trường** (field mask): danh sách trường bị ẩn theo bộ phận (giá, tiền, SĐT, địa chỉ…). Hàm backend dùng chung `maskFields_(user, record)` — áp ở backend, không chỉ ẩn trên giao diện.
- [ ] U1c Màn Phân quyền (`js/40-fn-rolesettings.js`): thêm mục "Quyền theo trường" cho bộ phận Đóng gói.
- [ ] U1d Test Node (mẫu `tools/test-roles.js`): người ở Đóng gói gọi trực tiếp API vẫn không nhận được giá/SĐT; Kế toán thấy đủ.
- Nghiệm thu: mục "Nghiệm thu" 1 trong docx (mỗi bộ phận chỉ thấy đúng dữ liệu, kể cả gọi API trực tiếp).

### U2 — Đơn hàng và luồng 5 bước (mục 11) · Q-A đã chốt (Base/Pos vẫn là nguồn chuẩn) · phụ thuộc: U1 · gộp với P6 (Công việc)
- [ ] U2a (có **công tắc nguồn đơn**: Base/Pos mặc định, CRM chạy song song, báo cáo hiện có không đổi số) Thiết kế dữ liệu Đơn hàng (Supabase, theo quyết định Q1): mã đơn, khách (SĐT), sale tạo, danh sách dòng sản phẩm (mã, SL, giá, quy cách), ghi chú nội bộ, ghi chú đơn, trạng thái, lý do từ chối, người xử lý theo bước, thời điểm. Ghi vào `supabase/schema.sql` (idempotent).
- [ ] U2b Backend: action tạo/sửa đơn nháp "Chờ xử lý", duyệt/từ chối (bắt buộc lý do), chuyển "Đang chuẩn bị hàng", đóng gói xong, hoàn tất. Mỗi lần đổi trạng thái ghi AuditLog (ai, lúc nào).
- [ ] U2c Quyền theo bước: Sale tạo; Cửa hàng duyệt; Đóng gói chỉ thấy chi tiết sản phẩm/ghi chú (dùng U1b); Kế toán/Quản lý xem tất cả.
- [ ] U2d Giao diện: bảng Kanban + dạng danh sách (mới, tab "Đơn hàng"; không đụng tab Công việc cũ).
- [ ] U2e Bước 5: đơn hoàn tất → ghi nhận doanh thu + hoa hồng dùng đúng quy tắc hiện có (loại hủy/hoàn, gộp đơn tách, chia nhiều sale) — KHÔNG viết hàm tính mới, tái dùng `posMetrics_`/`buildSalesReportB_`.
- [ ] U2f Nối với tab Công việc (Sale tạo công việc từ chat Pancake, kế toán xác nhận CK): chốt gộp hay song song (Q-A).
- Bước 4 (giao vận tự động qua API hãng) = thuộc phần API, TẠM BỎ; trong lúc đó cho đổi trạng thái giao tay.

### U3 — Engine khuyến mãi (mục 12.1) · Q-E đã chốt · nên làm trước U2e
- [ ] U3a Mô hình CTKM có cấu trúc (Settings hoặc Supabase): loại (combo giá sốc / % / số tiền cố định / quà tặng / voucher mã — làm đủ), điều kiện (sản phẩm, SL tối thiểu, thời gian, nguồn đơn), giới hạn dùng, cờ **áp đồng thời** / **không áp cùng CT khác** (+ danh sách loại trừ) do admin cài, thứ tự ưu tiên.
- [ ] U3b Hàm tính giá cuối thuần (`calcPromo_(items, promos, voucher)`) dùng chung client + backend, có test Node nhiều ca (combo + % + quà + voucher; hết hạn; không đủ điều kiện; hai CT loại trừ nhau; hai CT áp đồng thời).
- [ ] U3c Màn admin tạo/sửa CTKM (tự nhập, không phụ thuộc đọc sheet `CTKM` cũ; giữ sheet cũ cho AI trả lời như hiện nay).
- [ ] U3d Gắn vào giỏ hàng Pancake AI + Zalo AI (quy tắc 15) và form đơn U2: Sale chọn sản phẩm → giá cuối tự tính, hiện rõ CTKM đã áp.
- [ ] U3e Gắn CTKM vào chiến dịch resale (P3a "Ưu đãi").

### U4 — Tích điểm khách hàng thân thiết (mục 12.2) · Q-D đã chốt
- [ ] U4a Cấu hình trong Settings: tỷ lệ cộng điểm (ví dụ 150.000đ = 1 điểm), giá trị quy đổi 1 điểm, **hạn dùng trong năm** (hết hạn cuối năm). Hiện đang cố định 1%/1.000đ ở `js/06-main-renew-sources.js` (`PTS_RATE`, `PTS_VALUE`) — giữ cho đến khi U4a xong để số cũ không đổi.
- [ ] U4b Tính điểm ở backend theo cấu hình, từ đơn Pos hợp lệ (loại hoàn/hủy, gộp đơn tách); sổ điểm (cộng/trừ/lý do/đơn) lưu bền, không chỉ đọc ghi chú.
- [ ] U4c Dùng điểm trừ vào thanh toán khi tạo đơn (U2); đơn hoàn/hủy: trừ đúng số điểm đã cộng của đơn đó, số dư không xuống dưới 0. Điểm hết hạn cuối năm (job/tính khi đọc).
- [ ] U4d Hiển thị số điểm ở hồ sơ khách và Danh sách KH (đã có hiển thị cũ, đổi nguồn sang sổ điểm).
- [ ] U4e Test: đối chiếu số điểm cũ (đọc từ ghi chú) với số mới, sai lệch 0 trên dữ liệu thật trước khi chuyển.

### U5 — Báo cáo bổ sung (mục 13) · Q-C đã chốt
- [ ] U5a Tổng quát hoá tỷ lệ chia doanh thu: mặc định chia đều sale tham gia; admin cài tỷ lệ lệch cho đơn 2 bộ phận (cấu hình `revenueSplit`), giữ nguyên mặc định giữ đúng quy tắc Quầy 30/70 hiện tại (`QUAY_SALE_RATIO_`) để KHÔNG đổi số cũ. Test so sánh với `buildSalesReportB_` bản hiện tại.
- [ ] U5b Báo cáo hiệu suất: bổ sung số tin nhắn, số lead, tỷ lệ chuyển đổi theo từng sale/từng cửa hàng — phần chưa có dữ liệu hiện "chưa có dữ liệu" (không hiện 0). Nguồn tin/lead: Pancake webhook (docs/PANCAKE-INBOX.md) — phụ thuộc P7.
- [ ] U5c Báo cáo trạng thái đơn: số đơn đang treo (chưa hoàn tất quá N ngày), đơn hoàn, **phân nhóm lý do hoàn** (cần cột lý do hoàn có chuẩn hoá). Tái dùng Báo cáo G.
- [ ] U5d Tất cả lấy từ `posMetrics_`/hàm dùng chung (một chỉ số một hàm); xuất Sheet; phân quyền theo vai trò.

### U6 — Giao diện nhập đơn (mục 14) · làm song song, ít phụ thuộc
- [ ] U6a Thanh tìm kiếm sản phẩm thông minh trong Soạn đơn (gõ không dấu, gõ một phần, gợi ý theo bảng giá DANH_MUC) — **cả Pancake AI và Zalo AI** (chạy `node tools/check-ext-parity.js`).
- [ ] U6b Tách 2 ô "Ghi chú nội bộ" (giữa các phòng ban, không in cho khách) và "Ghi chú đơn hàng" (đi theo đơn tới Đóng gói) trong form đơn (CRM web + extension).
- [ ] U6c Tốc độ: phím tắt, nhớ lựa chọn gần nhất, thêm dòng nhanh — đo số thao tác trước/sau.

## Thứ tự đề xuất để phân công song song
1. **Làm ngay, độc lập:** U6 (giao diện nhập đơn), U3a–U3c (engine khuyến mãi, thuần logic + test), U5b/U5c (số liệu có sẵn), U1a–U1b (hạ tầng quyền theo trường).
2. **Ngay sau nhóm 1 (đã chốt Q-A/Q-B):** U1c–U1d, U2a–U2c.
3. **Sau U2 + U3:** U2d–U2f, U3d, U4b–U4d.
4. **Sau U2:** U5a.
5. Cuối: API (mục 9) khi Duyên bật lại.

## Việc cần làm tiếp (cho phiên sau)
- Q-A…Q-E đã chốt (2026-10-16): có thể làm toàn bộ U1–U6 (trừ API). Bắt đầu nhóm "làm ngay" ở mục 1; chỉ hỏi lại 3 chỗ đánh dấu *Duyên xác nhận lại* ở trên.
- Khi xong 1 mục nhỏ: tick `[x]` tại đây, đóng/ghi chú trong issue tương ứng, ghi "việc cần làm tiếp" trong commit.

# 11 hạng mục CRM — trạng thái thực tế trong code (đối chiếu 2026-11-27)

Nguồn yêu cầu: `docs/Chot-noi-dung-CRM-11-hang-muc.docx` (bản Duyên đã sửa/chốt thêm). Cập nhật file này mỗi khi xong 1 mục.
Ký hiệu: ✅ có và chạy · 🟡 có một phần · ❌ chưa có · ⏳ chờ bên ngoài (khoá/API/chính sách) · 🚫 bỏ/để sau.

| # | Hạng mục | Code hiện có | Còn thiếu | Làm được ngay? |
|---|---|---|---|---|
| 1 | Zalo OA | ❌ không có code OA (Zalo chỉ đọc qua extension Zalo AI) | App ID/Secret/OA Secret Key hoặc đi qua Pancake (docx cho phép "kết nối vào Pancake đưa về CRM") | ⏳ chờ Huy |
| 2 | EMS | ❌ chưa có | API EMS, bảng ánh xạ trạng thái, luồng thông báo giao không thành. Docx mục 3: CRM thay POS → lên đơn ở CRM rồi đẩy thẳng EMS | ⏳ chờ tài khoản API |
| 3 | Đẩy đơn sang POS | 🚫 bỏ (CRM thay POS, đi thẳng EMS) | — | — |
| 4 | Pancake webhook | 🟡 bước 1 (bảng `pk_webhook_raw` + route Worker `/pancake-webhook`) + bước 2–3 + tab 💬 Chat đã code, chưa xác nhận bằng payload thật (`docs/PANCAKE-INBOX.md`) | Duyên đặt biến Cloudflare, khai webhook, gửi payload mẫu → bật lại | ⏳ làm tay |
| 5 | Tổng đài (ccall) | ❌ chưa có | Tài liệu API+khoá; máy lẻ 108 (chị Hoàn), máy 102 dùng chung; đổi mật khẩu SIP riêng | ⏳ chờ chị Hoàn |
| 6 | AI + Google Sheets | 🟡 có khung AI (`callAI_`, trợ lý) và xuất Sheet (`gas/11`) | Khoá nhà cung cấp AI + hạn mức; tài khoản dịch vụ Google | ⏳ chờ khoá |
| 7 | Hoa hồng + thưởng | ✅ cơ chế: ngưỡng 15tr (`CS_COMMISSION_THRESHOLD_`), % cá nhân/team/kênh, luật vàng kênh Nguồn, loại Hủy/Hoàn (`gas/09`, `gas/10`) | Chính sách đang TẮT; chốt: 1,5% (≥15tr) / 1% (<15tr), **trừ hoa hồng kỳ sau nếu đơn hoàn sau khi đã trả**, chu kỳ chốt/trả | 🟡 bật bảng % + logic trừ đơn hoàn kỳ sau |
| 8 | KPI | ✅ KPI doanh thu 9 bậc, 500tr chính thức / 100tr thử việc, KPI riêng từng người (`readSaleKpiConfig_`, `buildSaleKpiReport_`); tỷ lệ chốt = đơn Base ÷ tương tác Pancake | ❌ điểm KPI nhiều chỉ tiêu Σ(trọng số × min(đạt÷định mức, trần)); ❌ KPI tự cam kết + duyệt + nhật ký; ❌ chốt danh sách chỉ tiêu/trọng số; "Màu mặc định" trong docx đang để trống | 🟡 phần cam kết/duyệt làm được; điểm KPI cần danh sách chỉ tiêu |
| 9 | Hạng + điểm | ✅ 4 hạng theo doanh thu cộng dồn, cấu hình được (`_tierCfg_`, `_aaHangKey_`, màn "Cấu hình hạng KH") | ❌ **điểm tích luỹ 1%/năm** (trừ khi hoàn, hết hạn theo năm, dùng trừ đơn/đổi quà); ❌ lịch sử đổi hạng; ❌ quyền lợi theo hạng (giảm 5%/10%, miễn ship ≥1tr, danh sách mã KHÔNG GIẢM / TỐI ĐA 5%) | 🟡 BƯỚC 2 + 2b XONG ở backend: hàm điểm/hạng + sổ điểm sheet `LoyaltyPoints`/`LoyaltyTier` + action `loyaltyGet`/`loyaltyRedeem` (`gas/34_Loyalty.gs`, test `tools/test-loyalty*.js`); + 2c giao diện: khối "Hạng & điểm" trong hồ sơ khách (`js/99-c-loyalty-card.js`, test `tools/test-loyalty-card.js`). 2d: hoàn tác dùng điểm (admin, `loyaltyUndo`, thêm dòng + AuditLog). Dùng điểm trong đơn: xong ở Đơn CRM 4b. **9b XONG (hàm thuần): quyền lợi THẺ** (`_loyaltyBenefitLevel_/_Apply_`, test `tools/test-loyalty-benefit.js`): VIP = mua từ lần 2 giảm 5%; SUPER = lịch sử ≥ 50tr giảm 10%; miễn ship đơn ≥ 1tr; 13 nhóm mã KHÔNG GIẢM + 6 nhóm TỐI ĐA 5% theo docx. **9c XONG:** server báo giá thẻ (`loyaltyBenefitQuote`, chỉ đọc) + màn Tạo đơn tự điền giảm % từng dòng và Miễn ship qua nút Áp dụng (`js/99-e-crm-card-benefit.js`). Còn thiếu: hiện thẻ ở hồ sơ khách |
| 10 | Chia doanh thu, ghi nhận đơn | ✅ chia đều nhiều sale; quầy 30/70 (`quayKeywords`, `quayRatio`); đơn ghép/tách dò Base | Ngày ghi nhận = ngày lên đơn (kiểm lại mọi báo cáo dùng đúng); đơn đổi trả/bảo hành/thay dây không tính thưởng ngày | 🟡 kiểm tra + test |
| 11 | Ticket, giờ làm việc | 🟡 BƯỚC 11a XONG: hàm thuần hạn ticket + hạn trả lời tin + trạng thái trễ (`gas/34b_Ticket.gs`, test `tools/test-ticket-sla.js`). **Đã chốt:** 08:00–17:00 trong giờ (trả lời 30 phút), từ 17:00 ngoài giờ (2 giờ thực; ca tối đến 21:00 vẫn trực), T2–CN; ticket 24h/72h/7 ngày | ❌ sheet Ticket + action + giao diện (11b/11c); ❌ **người được giao + trưởng phòng được báo theo từng loại — Duyên chưa chốt (`owners` đang để trống)**; ❌ cách ghi nhận khi trễ (đề xuất: thêm dòng nhật ký + báo trưởng phòng) | 🟡 11b làm được, thiếu danh sách người |
| — | Quy tắc chung | ✅ **Nhật ký đổi cấu hình XONG & có test** (bước 3): mọi cài đặt đi qua `setSetting_` → `AuditLog` (`config:setting:<khoá>`: giờ, người đổi theo token, cũ → mới; khoá nhạy cảm chỉ ghi "đã đổi"); gồm tierConfig, saleKpiConfig, loyaltyConfig, individualRates, channelCommissionRates, bonusPrograms, closeRateThresholds…; có màn xem ở Cấu hình (`js/37`). Test `tools/test-audit-config-keys.js` | Còn: "chưa có dữ liệu" thay vì 0 (chưa kiểm); dòng `loyalty:undo` đã ghi riêng | ✅ |

## Chỗ docx còn mâu thuẫn / thiếu — cần Duyên chốt trước khi code
1. ~~Mục 11 giờ làm việc~~ ĐÃ CHỐT (27/11): 08:00–17:00 là giờ ở công ty (trả lời 30 phút); từ 17:00 là ngoài giờ (2 giờ thực), ca tối đến 21:00 + mọi người vẫn trực online. Còn thiếu: ai được giao ticket / trưởng phòng nào được báo theo từng loại.
2. **Mục 9 điểm:** ĐÃ CHỐT 1 điểm = 1.000đ, trừ thẳng vào đơn. CÒN GIẢ ĐỊNH CHƯA XÁC NHẬN: hết hạn 31/12 cuối năm tích (docx: "hết hạn theo năm"); điểm tích trên số tiền khách THỰC TRẢ (sau khi trừ điểm).
3. ~~Mục 9 quyền lợi~~ ĐÃ CHỐT (27/11): quyền lợi theo THẺ, không theo hạng doanh thu — VIP = khách mua từ lần 2: giảm 5%; SUPER VIP = lịch sử mua ≥ 50tr: giảm 10%; cả hai miễn ship đơn từ 1tr (dưới 1tr chỉ giảm, không miễn ship). Còn GIẢ ĐỊNH chưa xác nhận: miễn ship xét trên tiền hàng TRƯỚC giảm; "charm 10k" không nhắc đá/ngọc coi là KHÔNG GIẢM (an toàn); mã cụ thể thắng khi 2 danh sách chồng (charm vàng khởi lộc 10k = tối đa 5%).
4. **Mục 9:** còn "hệ thứ hai theo số đơn (VIP/Thân thiết/Tiềm năng)" — giữ hay bỏ? Có dòng `[][]` trống trong docx.
5. **Mục 8:** "Màu mặc định: []" trống; chưa có danh sách chỉ tiêu + trọng số.
6. **Mục 7:** chu kỳ chốt/trả hoa hồng (tháng? ngày nào?).

## Thứ tự làm đề xuất (mỗi bước 1 file, push + cập nhật HANDOFF)
1. ✅ Bảng này.
2. ✅ Điểm tích luỹ + lịch sử đổi hạng (mục 9) — hàm thuần + test (1 điểm = 1.000đ, trừ thẳng vào đơn, hết hạn 31/12 theo năm). 2b ✅ sổ điểm + action GAS (cần deploy GAS). 2c ✅ giao diện hồ sơ khách + dùng điểm. 2d ✅ hoàn tác (admin). 2e ✅ đã có từ phiên Đơn CRM 4b (điểm trừ thẳng vào đơn, Hủy/Hoàn tự hoàn điểm) — không làm lại.
3. ✅ Nhật ký đổi cấu hình — đã có từ 12/10; đã kiểm + thêm test cho khoá hạng/KPI/điểm/hoa hồng/thưởng (không cần code thêm).
4. Trừ hoa hồng kỳ sau khi đơn hoàn (mục 7).
5. KPI tự cam kết + duyệt (mục 8).
6. Quyền lợi hạng + danh sách mã không giảm (mục 9) — sau khi chốt câu 3.
7. Ticket + giờ làm việc (mục 11): 11a ✅ hàm thuần; 11b sheet Ticket + action; 11c giao diện + báo trễ (cần danh sách người được giao).

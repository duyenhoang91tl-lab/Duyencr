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
| 9 | Hạng + điểm | ✅ 4 hạng theo doanh thu cộng dồn, cấu hình được (`_tierCfg_`, `_aaHangKey_`, màn "Cấu hình hạng KH") | ❌ **điểm tích luỹ 1%/năm** (trừ khi hoàn, hết hạn theo năm, dùng trừ đơn/đổi quà); ❌ lịch sử đổi hạng; ❌ quyền lợi theo hạng (giảm 5%/10%, miễn ship ≥1tr, danh sách mã KHÔNG GIẢM / TỐI ĐA 5%) | 🟡 BƯỚC 2 + 2b XONG ở backend: hàm điểm/hạng + sổ điểm sheet `LoyaltyPoints`/`LoyaltyTier` + action `loyaltyGet`/`loyaltyRedeem` (`gas/34_Loyalty.gs`, test `tools/test-loyalty*.js`); CHƯA có giao diện (hồ sơ khách, ô nhập điểm khi tạo đơn) |
| 10 | Chia doanh thu, ghi nhận đơn | ✅ chia đều nhiều sale; quầy 30/70 (`quayKeywords`, `quayRatio`); đơn ghép/tách dò Base | Ngày ghi nhận = ngày lên đơn (kiểm lại mọi báo cáo dùng đúng); đơn đổi trả/bảo hành/thay dây không tính thưởng ngày | 🟡 kiểm tra + test |
| 11 | Ticket, giờ làm việc | ❌ chưa có ticket; chưa có hàm giờ làm việc/hạn trả lời | Hạn ticket (24h/72h/7 ngày), giờ làm việc, hạn trả lời tin 30 phút/2 giờ, báo trưởng phòng khi trễ, người được giao theo loại | ⏳ cần chốt mâu thuẫn giờ (xem dưới) |
| — | Quy tắc chung | ✅ có `AuditLog` (sheet) | Nhật ký đổi cấu hình (hạng, mốc, ngưỡng, % hoa hồng): giờ, người đổi, giá trị cũ/mới — chưa kiểm từng chỗ đã ghi chưa; "chưa có dữ liệu" thay vì 0 — chưa kiểm | 🟡 kiểm từng chỗ |

## Chỗ docx còn mâu thuẫn / thiếu — cần Duyên chốt trước khi code
1. **Mục 11 giờ làm việc:** ghi "08:00–21h" nhưng "ngoài giờ (từ 17h trở đi)". Ví dụ 16:50 → hạn 17:20; 20:00 → hạn 22:00. Vậy giờ làm việc là 08:00–17:00 hay –21:00? (Nếu 21:00 thì 20:00 vẫn trong giờ, hạn phải là 20:30.)
2. **Mục 9 điểm:** ĐÃ CHỐT 1 điểm = 1.000đ, trừ thẳng vào đơn. CÒN GIẢ ĐỊNH CHƯA XÁC NHẬN: hết hạn 31/12 cuối năm tích (docx: "hết hạn theo năm"); điểm tích trên số tiền khách THỰC TRẢ (sau khi trừ điểm).
3. **Mục 9 quyền lợi:** Thẻ Vip ghi "từ lần mua thứ 2" còn hạng Vip trong code theo 30tr; hạng "Ưu tiên" (15tr) chưa có quyền lợi. Hạng nào được giảm gì? Super VVip "trên 50tr" = từ 50tr?
4. **Mục 9:** còn "hệ thứ hai theo số đơn (VIP/Thân thiết/Tiềm năng)" — giữ hay bỏ? Có dòng `[][]` trống trong docx.
5. **Mục 8:** "Màu mặc định: []" trống; chưa có danh sách chỉ tiêu + trọng số.
6. **Mục 7:** chu kỳ chốt/trả hoa hồng (tháng? ngày nào?).

## Thứ tự làm đề xuất (mỗi bước 1 file, push + cập nhật HANDOFF)
1. ✅ Bảng này.
2. ✅ Điểm tích luỹ + lịch sử đổi hạng (mục 9) — hàm thuần + test (1 điểm = 1.000đ, trừ thẳng vào đơn, hết hạn 31/12 theo năm). 2b ✅ sổ điểm + action GAS (cần deploy GAS). 2c: giao diện hồ sơ khách + dùng điểm.
3. Nhật ký đổi cấu hình (quy tắc chung) — kiểm các chỗ đổi hạng/ngưỡng/% hoa hồng đã ghi `AuditLog` chưa, bù chỗ thiếu.
4. Trừ hoa hồng kỳ sau khi đơn hoàn (mục 7).
5. KPI tự cam kết + duyệt (mục 8).
6. Quyền lợi hạng + danh sách mã không giảm (mục 9) — sau khi chốt câu 3.
7. Ticket + giờ làm việc (mục 11) — sau khi chốt câu 1.

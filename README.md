Dự án Duyên AI CRM (Sasum) — repo duyenhoang91tl-lab/Duyencr. BẮT BUỘC đọc crm-kb/00-READ-FIRST.md trước mọi việc, rồi chỉ mở thêm file KB đúng phần cần sửa theo bảng định tuyến trong đó.
Trước khi làm gì, đọc crm-kb/00-READ-FIRST.md." Dòng này đảm bảo ai sửa cũng phải đọc chỉ dẫn

## Quy tắc tính doanh thu & loại đơn (Duyên chốt 10/2026 — mọi báo cáo phải tuân thủ)
1. **Pos** ("dữ liệu đơn", cột *Trạng thái đơn*): loại **Hủy đơn / Hoàn đơn / Đã hoàn / Đang hoàn** (`POS_EXCLUDED_ORDER_STATUSES_`).
2. **Đơn ghép** = ghi chú Pos có **từ 2 mã bộ đếm trở lên** → check ngược Base: đơn nào của ai thì doanh thu tính cho người đó, chia đều những người tham gia theo từng đơn (`POS_GHEP_BASE_ENABLED_`, `POS_GHEP_MIN_CODES_`). Đơn Pos 0–1 mã tính thuần theo Pos.
3. Pos **nguồn cửa hàng** (Quầy Hào Nam / Cửa hàng) có gắn thẻ sale → chia **30/70**: 30% của sale (chia đều tiếp cho các sale tham gia), 70% của quầy (`_quaySaleRatio_`).
4. **Base** (DT TỔNG, cột H *Trạng thái*): chỉ loại **"Thất bại"** (`EXCLUDED_ORDER_STATUSES_`; Dashboard dùng `_DASH_EXCLUDED_STATUS` cùng quy tắc). Cũng dùng làm điều kiện khi check ngược đơn ghép.
5. Doanh thu Pos = doanh thu trong tháng − đơn hoàn/hủy của tháng trước (thất bại bên Base, hoàn/hủy bên Pos). **Chỉ tiến hành vào ngày mùng 1 hàng tháng, sau khi Duyên cập nhật đủ dữ liệu tháng trước.** → Triển khai ở **Báo cáo B → 🔒 Chốt tháng Pos** (admin): bấm *Chốt tháng* để lưu mốc doanh thu từng sale của tháng M-1; số trừ tháng M = mốc − doanh thu M-1 tính lại hiện tại (đơn hoàn/hủy phát sinh sau khi chốt). Chưa chốt thì chưa trừ gì (`closePosMonth_`, `posMonthAdjust_`).

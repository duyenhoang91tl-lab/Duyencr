# Trừ tồn kho tự động theo đơn Pos

Mặc định **TẮT**. Nguồn: sheet Pos `dữ liệu đơn`, cột I (Sản phẩm) / J (Mã sản phẩm, ngăn bằng `;`) / K (Số lượng, ngăn bằng `,`). Code: khối "TON KHO — TRU TON TU DONG THEO DON" trong `gas_v13.js` (nằm trong `gas/24_TonKho.gs`). Test: `node tools/test-tonkho-trudon.js`.

## Quy tắc (Duyên chốt 12/10/2026)
- Mỗi **mã** trừ từ kho đang **chứa mã đó** (hiện có 2 kho: Kho sản xuất, Quầy). Mã nằm ở cả 2 kho → dùng thứ tự ưu tiên; chưa đặt thì **giữ đơn** (`cho_duyet`).
- **Combo**: admin khai báo thành phần (sheet `KhoCombo`); trừ theo thành phần × số lượng. Combo (mã `CB…` hoặc tên có "COMBO") **chưa khai báo → giữ cả đơn**, không trừ; khai báo xong lần chạy sau tự trừ.
- Mã không thuộc kho nào và không giống combo (dịch vụ, quà, nguyên vật liệu) → bỏ qua, không chặn đơn.
- Đơn **Hủy / Hoàn** (`Hủy đơn`, `Hoàn đơn`, `Đã hoàn`, `Đang hoàn`) → không trừ; nếu đã trừ thì **cộng trả đúng số đã trừ**; đơn hủy rồi có lại → trừ lại.
- **Không để tồn âm**: trừ tối đa bằng tồn hiện có, phần thiếu ghi vào báo cáo `shortages` để kho kiểm lại.
- Số lượng bất thường (≤ 0, không phải số, > 500 như `2001`), số mã ≠ số lượng → **giữ đơn**, không trừ.

## An toàn
- Chỉ xét đơn có ngày ≥ **ngày bắt đầu** (`start`) — admin PHẢI đặt; không bao giờ trừ lịch sử.
- **Sổ cái** (sheet `TonKhoTruDon`): khóa đơn = ngày | SĐT | mã | SL | giá trị | ghi chú → mỗi đơn trừ **đúng 1 lần**, chạy lại không trừ thêm; dòng import lặp chỉ tính 1.
- Đơn bị sửa (khóa đổi) hoặc mất khỏi sheet → báo **mồ côi** (`orphans`); admin tự hoàn bằng `tonKhoTruDonHoanTay`, hệ thống **không tự hoàn**.
- Mỗi lần chạy tối đa 300 đơn mới/đổi; phần còn lại chạy tiếp lần sau.
- Cấu hình nằm sheet riêng `KhoCauHinh` (KHÔNG dùng `setSetting` chung vì action đó cho client ghi khóa bất kỳ). Mọi lần trừ/cộng trả ghi `TonKhoLog` (loại `tru_don` / `hoan_don`, kèm `ref` = khóa đơn, người = `he-thong`).

## Cách bật (admin)
1. Deploy GAS bản mới (có `gas/24_TonKho.gs`).
2. Sheet **`KhoCauHinh`** (tự tạo lần đầu): thêm dòng `start` = `dd/MM/yyyy` (ngày bắt đầu trừ, vd `13/10/2026`). Nếu có mã nằm ở 2 kho: dòng `priority` = `["<id kho ưu tiên>", "<id kho kia>"]` (id lấy ở sheet `Kho`). Chưa bật gì cả: `mode` để trống/`off`.
3. Sheet **`KhoCombo`**: mỗi combo 1 dòng — `comboCode`, `name`, `components` dạng `[{"code":"MÃ-1","qty":1},{"code":"MÃ-2","qty":2}]`, `active` = TRUE.
4. Chạy `tonKhoTruDonXemTruocTay` (Apps Script Editor → Run → xem Execution log) — **chỉ xem, không ghi**: đơn nào sẽ trừ, đơn nào bị giữ và vì sao, mã không thuộc kho nào, thiếu tồn. Sửa combo/ưu tiên cho tới khi hợp lý.
5. Đặt `mode` = `on` trong `KhoCauHinh`, chạy `tonKhoTruDonCaiTrigger` (mỗi 10 phút tự trừ). Theo dõi sheet `TonKhoTruDon` (cột `status`: `da_tru` / `da_hoan` / `cho_duyet`) và `TonKhoLog`.
6. Tắt: đặt `mode` = `off` (hoặc chạy `tonKhoTruDonGoTrigger`). Không cần xóa gì; số đã trừ giữ nguyên.

## Action (cần token admin) — để làm giao diện sau
`tonKhoTruDonCauHinh` {mode, start, priority}, `tonKhoTruDonXemTruoc`, `tonKhoTruDonChay`, `tonKhoTruDonHoanTay` {key}, `khoComboSave` {combo:{code,name,components,active}}; GET `khoCombo`, `tonKhoTruDonTrangThai`.

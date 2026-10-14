# Kế hoạch chỉnh bố cục CRM theo "CRM mẫu" (clip màn hình máy tính 14/10/2026) + trang Phân quyền giống clip

Nguồn: clip 2 phút 53 giây, app "CustomerCare CRM" (dữ liệu demo). Bổ sung cho `docs/ROADMAP-CRM-MAU.md` (clip điện thoại 11/10: đối chiếu CHỨC NĂNG, B0–B6) và `docs/UI-PRO-PLAN.md` (giao diện PRO hiện tại, màu tím). Tài liệu này chỉ lo **BỐ CỤC / GIAO DIỆN** và **trang Phân quyền**. Mỗi bước nhỏ push riêng, tick `[x]`, ghi "việc cần làm tiếp" (quy tắc 12). Mọi style mới đặt dưới namespace `html.ui-pro` (test: `tools/test-ui-pro.js`), hàm thuần đặt tên `xxx_` + `module.exports` để test bằng Node.
**Giới hạn khi làm:** không có trình duyệt thật trong môi trường làm việc nên KHÔNG tự kiểm tra được hình dáng. Mỗi bước giao diện cần Duyên mở trang (tải lại Ctrl+F5) và gửi ảnh chụp để chỉnh tiếp.

## 1. Thiết kế của clip (đã bóc ra từng khung hình)
**Khung chung**
- Menu trái nền trắng: logo + tên app + dòng phụ; ô "Tìm chức năng… Ctrl+K"; mục menu có icon nét mảnh, mục đang chọn là **viên thuốc xanh nhạt**; nhãn nhóm chữ nhỏ in hoa ("QUẢN LÝ", "DỮ LIỆU LIÊN QUAN"); cuối menu có "Thu gọn" (thu thành cột icon).
- Thanh trên: tên trang bên trái; bên phải: nút viền "Làm mới" (icon xoay), nút xanh đặc "+ Thêm khách", công tắc sáng/tối, chuông, thẻ người dùng (chữ cái đầu trong vòng xanh nhạt + tên + vai trò + mũi tên).
- Nền nội dung xám xanh rất nhạt; **thẻ trắng viền mảnh bo ~12px**, gần như không đổ bóng; chữ đen xanh đậm, chữ phụ xám.
**Khuôn mỗi trang:** tiêu đề lớn + dòng mô tả xám → thanh lọc (nhãn nằm TRÊN ô, nút "Áp dụng" xanh + "Xóa lọc" viền) → khối nội dung. Tổng quan mở bằng lời chào cỡ rất lớn + ngày giờ bên phải.
**Thành phần dùng đi dùng lại:** (a) thẻ số: ô icon nền xanh nhạt bo góc + nhãn, SỐ RẤT LỚN, dòng chú thích xám; (b) hàng "chip" đếm có icon, chip quá hạn nền đỏ nhạt; (c) thẻ danh sách thanh ngang (xanh; thành công xanh lá; thất bại xám đậm) kèm số bên phải và link "Mở bảng theo giai đoạn"; (d) bảng: hàng tiêu đề nền xám nhạt, nhãn trạng thái dạng viên thuốc màu dịu (cam: Đang thương lượng / Đến hạn chăm lại; xám: Mới), nút hành động viền; (e) chân bảng: "1–10 trên 26 bản ghi", "Dòng / trang [10]", « ‹ Trang 1 / 3 › »; (f) trạng thái rỗng: tiêu đề đậm + mô tả xám giữa trang; trạng thái tải: vòng xoay + "Đang tải dữ liệu…"; (g) nút "Xuất CSV" / "Xuất Excel" / "Tùy chỉnh danh sách ↗" cạnh tiêu đề bảng.
**Menu của clip:** Tổng quan · Khách hàng · Cơ hội bán hàng · Hộp thư khách hàng · Đơn hàng · Hỗ trợ & phản hồi · Xử lý đơn hàng · Sản phẩm & tồn kho · Công việc · Lịch làm việc · Chăm sóc theo đơn · Chiến dịch tái mua · Chăm sóc & tái mua · Hạng thành viên | QUẢN LÝ: Báo cáo · Phân tích kinh doanh · Bảng giá & khuyến mãi · Chất lượng hội thoại · Hiệu quả nhân viên · Hoa hồng & thưởng · Tệp xuất dữ liệu · Phân công khách · Hợp nhất hồ sơ · Nhập dữ liệu · Cấu hình · Trường & trạng thái khách · Kết nối Base · Chính sách thành viên · Vai trò & quyền hạn | DỮ LIỆU LIÊN QUAN: Doanh nghiệp · Ghi chú · Nhật ký cuộc gọi.

## 2. Trang "Vai trò & quyền hạn" trong clip (làm GIỐNG Y)
- **3 tab gạch chân:** `Quyền vai trò` · `Quyền từng người` · `Phòng ban & nhóm`. *(Clip chỉ mở tab 1; nội dung tab 2 và 3 chưa thấy — xem câu hỏi ở mục 5.)*
- **Tab Quyền vai trò:** tiêu đề "Quyền sử dụng theo vai trò" + mô tả "Xem phạm vi của 5 vai trò. Chọn một vai trò để bật/tắt tính năng cho tất cả người dùng thuộc vai trò đó".
  - Hàng **5 thẻ vai trò** chọn được (thẻ đang chọn viền đậm; Quản trị viên có huy hiệu 🔒 "Khóa"): Quản trị viên "Toàn bộ dữ liệu và cấu hình" · CEO "Toàn bộ dữ liệu kinh doanh" · Trưởng phòng "Các nhóm thuộc phòng của mình" · Trưởng nhóm "Nhóm của mình và hồ sơ được chia sẻ" · Nhân viên kinh doanh "Hồ sơ phụ trách hoặc được chia sẻ".
  - Dưới thẻ: tên vai trò, mô tả, đoạn giải thích; dòng "Quyền Quản trị viên luôn bật để bảo đảm truy cập quản trị."; hai nút **"Bỏ thay đổi"** (viền) và **"Lưu quyền"** (xanh, mờ cho tới khi có thay đổi).
  - **Bảng ma trận** cột: `Tính năng | Quản trị viên | CEO | Trưởng phòng | Trưởng nhóm | Nhân viên kinh doanh`. Hàng chia theo **nhóm có dòng tiêu đề nền xám** ("Bán hàng & công việc", "Dữ liệu", "Quản lý", "Quản trị hệ thống · cố định"). Mỗi hàng: tên tính năng đậm + mô tả xám nhiều dòng. Ô: `Bật` (cột Quản trị viên kèm dòng nhỏ "Luôn bật · khóa", nền xám nhạt) · `Tắt` (+ "Không được cấp" nếu khóa) · hàng cố định ("Quản lý tài khoản và nhóm", "Cấu hình lịch nhắc việc", "Thay đổi quyền các vai trò"): Quản trị viên "Bật · Có khóa", các vai trò khác "Không được cấp".
  - Cuối trang: ghi chú "Khi lưu, quyền mới được kiểm tra ở máy chủ cho các thao tác tiếp theo…" và khối **"Thay đổi gần đây"** (kèm "Cập nhật dd/mm/yyyy · hh:mm"; rỗng thì "Chưa có thay đổi. Hệ thống đang sử dụng quyền mặc định.").

## 3. Hiện có trong CRM (đối chiếu)
| Phần | Hiện có | Cần làm |
|---|---|---|
| Phân quyền | `js/40-fn-rolesettings.js`: 4 mục Vai trò / Quyền theo vai trò / Quyền theo bộ phận / Xem thử theo tài khoản; ma trận quyền XEM hạng mục + tác vụ; backend `roleConfig` / `saveRoleConfig` / `_featureAllowed_` (chặn ở GAS v13.45); vai trò admin, CEO, Trưởng phòng, Quản lý, Trưởng team, Nhân viên | Dựng lại GIAO DIỆN thành 3 tab + thẻ vai trò + ma trận nhóm/ô như clip; thêm cột "Luôn bật · khóa"; hàng quản trị cố định; nút Bỏ thay đổi/Lưu quyền; "Thay đổi gần đây" (đọc AuditLog); thêm mô tả từng tính năng |
| Menu | `js/29-sidenav.js` (nhóm theo `GROUPS`) + `css/05-sidenav.css`, menu tím | Chỉnh dáng theo clip (xem L1); giữ nhóm hiện tại trừ khi Duyên đồng ý đổi (câu hỏi 3) |
| Thanh trên | `<header>` trong `index.html` | Đưa về khuôn clip (L1) |
| Thẻ số / chip / bảng / phân trang | `pro-card`, `pro-kpi` (ô màu gradient), `pro-chip` trong `css/06-pro.css`; bảng KH tự vẽ ở `js/` | Thêm kiểu "thẻ số sáng" và bảng + phân trang chuẩn (L2) |

## 4. Các bước (mỗi bước push riêng, chờ Duyên xem ảnh)
- [ ] **L0 – Mã thiết kế:** bảng màu/chữ/viền/bo góc/khoảng cách của clip thành biến `--ui-*` trong `css/06-pro.css` (không đổi màu gì đang chạy cho tới L1). Chốt màu thương hiệu & phông (câu hỏi 1, 2).
- [ ] **L1 – Khung:** thanh trên (Làm mới · + Thêm khách · công tắc sáng/tối · chuông · thẻ người dùng), menu trái (viên thuốc xanh nhạt, nhãn nhóm in hoa, ô tìm chức năng Ctrl+K, Thu gọn thành cột icon). Chỉ đổi giao diện, không đổi chức năng/nhóm menu.
- [ ] **L2 – Thành phần dùng chung:** khuôn trang (tiêu đề + mô tả), thanh lọc (nhãn trên ô, Áp dụng/Xóa lọc), thẻ số sáng, hàng chip, thẻ danh sách thanh ngang, bảng + chân phân trang "Dòng / trang", trạng thái rỗng/đang tải, nhãn trạng thái viên thuốc. Test hàm thuần bằng Node.
- [ ] **L3 – Phân quyền giống clip:** dựng lại `js/40-fn-rolesettings.js` (giữ nguyên backend và logic `_featAllowed` — test hiện có phải còn PASS), 3 tab, thẻ vai trò, ma trận như mục 2, "Thay đổi gần đây" (cần action đọc AuditLog, GAS mới). Đây là bước làm sớm nhất (đã được yêu cầu "giống y như clip").
- [ ] **L4 – Áp dụng khuôn mới theo từng màn:** Tổng quan → Danh sách khách → Công việc → Báo cáo (A–L dùng thẻ số/bảng mới) → Tồn kho → Cấu hình. Mỗi màn 1 lần push.
- [ ] **L5 – Chế độ tối** (nếu Duyên muốn — clip có công tắc) và **L6 – màn hình nhỏ/điện thoại** (menu trượt).

## 5. Câu hỏi cần Duyên chốt (chặn L0/L1/L3)
1. **Màu thương hiệu:** clip dùng xanh dương + trắng sạch; CRM hiện tại menu/đầu trang màu tím (PRO). Đổi sang xanh như clip, hay giữ tím và chỉ lấy bố cục?
2. **Phông chữ:** clip dùng phông hình học hiện đại (chữ số rất đẹp ở thẻ số). Cho tải 1 phông từ Google Fonts, hay giữ phông hệ thống?
3. **Menu:** giữ nhóm menu hiện tại (như Duyên chốt 11/10) hay sắp lại đúng thứ tự/nhóm như clip?
4. **Phân quyền — tab 2 & 3 chưa thấy trong clip:** "Quyền từng người" = ngoại lệ bật/tắt riêng cho từng tài khoản (ghi đè quyền vai trò)? "Phòng ban & nhóm" = quyền theo phòng/team (như mục "Quyền theo bộ phận" hiện có)? Duyên quay thêm 2 tab đó, hoặc xác nhận theo cách hiểu này.
5. **Vai trò:** CRM có 6 vai trò (thêm "Quản lý" so với 5 vai trò trong clip). Giữ cả 6 cột, hay gộp "Quản lý" vào "Trưởng phòng"?
6. **Tên "Trưởng nhóm" / "Nhân viên kinh doanh"** dùng như clip, hay giữ "Trưởng team" / "Nhân viên"?

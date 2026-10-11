# 08 — Kho / Tồn kho (CRM thay Pos làm nơi cập nhật tồn thật) — quyết định của Duyên 2026-10-12

## Quyết định (đã chốt)
- CRM là nguồn tồn thật (thay Pos hoàn toàn); nhập đầu kỳ từ file Excel Pos "Tổng hợp tồn kho" (4 cột: Tên kho, Mã hàng, Tên hàng, Cuối kỳ), mỗi kho 1 file.
- **Admin tạo kho** và gán leader + thành viên (giống Team). Sửa tồn: admin, leader, thành viên của đúng kho đó. **Mọi tài khoản đều XEM được.**
- **Tự trừ tồn khi có đơn** (làm ở bước lên đơn: gọi `khoAdjust_` bên trong lúc lưu đơn; KHÔNG có action công khai để trừ).

## Dữ liệu (Supabase, `supabase/schema.sql` mục 7)
`kho(id, ten, leader, members jsonb, active)` · `ton_kho(kho_id, ma_hang, ten_hang, ton, nguong, ver, updated_by, updated_at)` · `ton_kho_log(kho_id, ma_hang, truoc, sau, loai, ly_do, ref, by_user, at)`.
Hàm SQL nguyên tử (đã thử trên Postgres thật): `ton_kho_set` (sửa tay, kiểm `ver` → trả `conflict` kèm dòng hiện tại thay vì ghi đè; ver=0 = tạo mới), `ton_kho_adjust` (cộng/trừ, `ref` chống trừ 2 lần cho cùng kho+mã+loại; `p_allow_negative`), `ton_kho_import` (ghi đè theo (kho, mã), bỏ dòng thiếu mã/số). Mọi đổi số đều ghi `ton_kho_log` cùng giao dịch.

## GAS (`gas_v13.js`, khối KHO ngay sau `sbKHTrangThaiDongBo`)
Quyền kiểm Ở SERVER bằng token phiên (`_sessUser_`); người sửa (`by`) lấy từ token, không tin client.
GET: `khoList`, `tonKho` (kho, q, low=1, limit≤1000, offset), `tonKhoLog` (kho, ma?, limit≤200). POST: `khoSave` (admin), `tonKhoSet`, `tonKhoNguong`, `tonKhoImport` (≤2000 dòng/lần). Nội bộ: `khoAdjust_`. Worker KHÔNG cache các action này (không có trong TTL_SEC) — đúng ý, tồn phải tươi.
Test: `node tools/test-kho.js`.

## Việc còn lại (theo thứ tự)
1. Tab "Tồn kho" trong web (chọn kho, tìm, sửa trực tiếp trên dòng, báo xung đột, cảnh báo sắp hết, nút nhập file Excel Pos, admin tạo/sửa kho). → `js/` + `index.html` (menu trong `js/29-sidenav.js`).
2. Màn lên đơn 3 tab (Sản phẩm / Khách hàng / Thanh toán) lấy sản phẩm từ kho, lưu đơn mới vào bảng Supabase `orders`/`order_items` rồi trừ tồn (`khoAdjust_` với `ref` = mã đơn; huỷ đơn → `loai='hoan'`).
3. Giá bán: lấy từ bảng giá `DANH_MUC` (đã có).

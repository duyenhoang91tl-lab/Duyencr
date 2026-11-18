# 13 — Thư viện sản phẩm (thư mục ảnh theo sản phẩm / combo)

Menu **Social → 🛍️ Thư viện sản phẩm** (18/11/2026, Duyên yêu cầu). Khác "Thư viện" cũ (`js/48`, gas `mlib*`: ảnh/ghi âm/mẫu tin phẳng) — KHÔNG sửa phần cũ.

## Mô hình
- 1 sản phẩm trong bảng giá (DANH_MUC qua `priceCatalogFlat`) = 1 thư mục, gộp theo **tên** (cột Tên sản phẩm, fallback Tên thương mại): mọi size/chất liệu cùng tên dùng chung thư mục.
- 1 combo (`comboList`) = 1 thư mục, tên gửi lên `"Combo: <tên>"`, group `"Combo"`.
- Tối đa **50 ảnh/thư mục**, do SERVER chặn (`plibUpload` trả `full:true`); client chỉ hiển thị "N/50" và cắt bớt ảnh thừa khi tải nhiều ảnh.
- **KEY** thư mục = tên bỏ dấu/thường/gọn (`_plibKey_` ở GAS ⇄ `_plKey` ở `js/94`) — PHẢI giống nhau, đổi 1 bên là lệch thư mục.

## Backend (gas_v13.js, khối "THU VIEN SAN PHAM", test `tools/test-plib.js`)
Sheet `ThuVienSP` (id, productKey, productName, group, fileId, url, name, mime, size, createdBy, createdAt, deleted); Drive folder `CRM_ThuVienSanPham` (hoặc Script Property `PLIB_FOLDER_ID`), mỗi SP 1 thư mục con, chia sẻ "ai có link xem".
| Action | Method | Việc |
|---|---|---|
| plibList | GET | không `key` → `counts{key:{n,cover,name}}` mọi thư mục; có `key` → ảnh của thư mục |
| plibUpload | POST | 1 ảnh/lần (base64, ≤6MB, chỉ image/*), chặn ảnh thứ 51 |
| plibDelete | POST | xóa mềm (deleted=1), người tải lên hoặc admin |
Cần token phiên (`_mlibUser_`), tài khoản `demo` không dùng được. 🐞 Cùng SP gõ khác hoa/thường/dấu từng tạo 2 thư mục Drive → nay dùng TÊN lưu đầu tiên của key.

## Client (`js/94-plib-tab.js`, test `tools/test-plib-tab.js`)
`registerExtraTab('plib')` + `'plib'` trong nhóm Social ở `js/29`. Ô tìm không dấu tìm cả SP lẫn combo; ↑/↓ chọn, Enter (hoặc bấm) mở thẳng thư mục. API cho nơi khác: `plibSearch(q, limit)`, `plibOpen(name, group)`. Chưa nối vào ô tìm khách toàn cục (`js/69`) vì ngoài yêu cầu — nếu Duyên muốn: gọi `plibSearch` trong `ssRender_` + `plibOpen` khi chọn.

## Việc có thể làm thêm
Thêm `plib` vào `_PERM_TAB_DEFS` (js/06) nếu cần phân quyền riêng; nút "chọn ảnh từ thư viện SP" trong chat Pancake/Soạn đơn; hiện ảnh bìa SP ở tab Combo.

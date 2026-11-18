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
`registerExtraTab('plib')` + `'plib'` trong nhóm Social ở `js/29`. Ô tìm không dấu tìm cả SP lẫn combo; ↑/↓ chọn, Enter (hoặc bấm) mở thẳng thư mục. API cho nơi khác: `plibSearch(q, limit)`, `plibOpen(name, group)`. Ô tìm khách toàn cục (`js/69`, 18/11 v2): `ssProdSuggest_`/`ssProdHtml_` thêm khối "🛍️ sản phẩm / combo" dưới danh sách khách (chỉ khi gõ chữ ≥2 ký tự); `ssRender_` gọi `plibPreload` tải ngầm danh mục lần đầu; bấm/Enter → `plibOpen`. Thứ tự `_ssState.items` = khách rồi SP (khớp thứ tự DOM để ↑↓/Enter đúng). Thiếu js/94 → không hiện gì.

## Thông tin sản phẩm (v2)
Văn bản tự do mỗi thư mục (ý nghĩa, điểm nổi bật, cách tư vấn…), tối đa 4000 ký tự, sheet `ThuVienSPInfo` (1 dòng/thư mục, ép định dạng văn bản). POST `plibInfoSave` CHỈ ADMIN (server kiểm), lưu rỗng = xóa. `plibList` không key trả `info` trong `counts` (ô tìm tìm được trong nội dung; thư mục chỉ có info vẫn hiện n=0); có key trả `info:{text,by,at}`. Client: khung 📝 trên danh sách ảnh (xem/chép/sửa, nút chèn mục gợi ý, dòng tiêu đề kết thúc bằng ":" in đậm). Xếp hạng tìm: tên bắt đầu bằng cụm gõ > tên/nhóm chứa đủ từ > chỉ khớp trong thông tin. Chưa đưa vào prompt Trợ lý AI.

## Việc có thể làm thêm
Thêm `plib` vào `_PERM_TAB_DEFS` (js/06) nếu cần phân quyền riêng; nút "chọn ảnh từ thư viện SP" trong chat Pancake/Soạn đơn; hiện ảnh bìa SP ở tab Combo.

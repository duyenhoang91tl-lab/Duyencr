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

## Ảnh có sẵn trên Google Drive (v3, 26/11/2026)
Duyên có thư mục Drive "Hình ảnh theo File Giá" (id mặc định `PLIB_SRC_DEFAULT_` trong gas_v13.js, đổi bằng Script Property `PLIB_SRC_FOLDER_ID`) chia theo bảng giá. CRM **chỉ đọc** thư mục này (không tải về, không di chuyển, không đổi quyền chia sẻ), hiện ảnh trong thư mục sản phẩm tương ứng, tách khỏi ảnh tải lên CRM.
| Action | Method | Việc |
|---|---|---|
| plibDriveScan | GET | quét cây gốc ≤3 cấp, ≤3000 thư mục → `folders[{id,name,path}]` + `links`; cache 10 phút, `fresh=1` bỏ cache |
| plibFolderImages | GET | ảnh (image/*) của 1 thư mục, ≤200, sắp theo tên; **chỉ nhận thư mục nằm trong cây gốc** (`_plibInRoot_`) |
| plibLinkSave | POST | CHỈ ADMIN: gắn tay thư mục (link hoặc id) cho SP/combo; `folder` rỗng = gỡ. Sheet `ThuVienSPLink` |
- **Khớp**: client khớp theo tên thư mục (bỏ dấu/hoa thường) = tên SP, tên thương mại, hoặc tên combo (không kèm "Combo:"); tối đa 3 thư mục/SP. **Gắn tay thắng tự khớp.** Khớp ở client vì client có bảng giá; server chỉ liệt kê.
- **Thư mục nhóm** (vd "Nhẫn", chứa thư mục con) không tính vào thống kê "chưa khớp" — chỉ thư mục lá.
- **Điều kiện chạy** (hiện đã thỏa: tài khoản chạy script chính là chủ thư mục Drive — Duyên xác nhận 26/11/2026): tài khoản Google chạy Apps Script PHẢI có quyền xem thư mục gốc (không thì báo lỗi kèm email cần chia sẻ, quyền Người xem). Ảnh hiện cho nhân viên qua thumbnail Drive nên cần tệp chia sẻ dạng "ai có link" (hoặc nhân viên đăng nhập Google có quyền).
- **Giới hạn 50 ảnh** chỉ áp cho ảnh TẢI LÊN CRM; thư mục Drive hiện tối đa 200 ảnh.
- Bẫy test: mảng trả từ code chạy trong `vm` khác prototype → `deepStrictEqual` fail dù giống nhau, so bằng `JSON.stringify`. Cấu trúc thật của thư mục Drive CHƯA được xem (cần đăng nhập) — quét 3 cấp để chịu được "Nhóm / Sản phẩm" lẫn "Nhóm / Sản phẩm / Chất liệu".

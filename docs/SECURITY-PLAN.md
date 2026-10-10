# Kế hoạch bảo mật backend (GAS) — trạng thái & việc tiếp theo

Cập nhật 2026-10-11. Nguyên nhân gốc: trước đây `action=users` trả `passHash` cho bất kỳ ai, `saveUsers` không cần xác thực, đăng nhập so hash ngay trên trình duyệt; repo public nên URL GAS + salt ai cũng đọc được.

## Bước 1+2 — ĐÃ LÀM (gas v13.25-auth-session)
- `POST webLogin {username,password}` → server kiểm tra (giới hạn 5 lần sai/10 phút), trả `token` ký HMAC (hết hạn 7 ngày, bí mật `sessSecret` nằm trong Script Properties) + hồ sơ không có hash. Tài khoản role demo nhận thêm `demoToken`.
- `GET action=users`: KHÔNG BAO GIỜ trả `passHash`. Có `token` hợp lệ → thêm perms/saleType/startDate; không token → danh sách rút gọn (username,name,names,team,role,active) cho extension Zalo/Pancake.
- `POST saveUsers` bắt buộc token của admin đang hoạt động (trừ khi sheet Users trống = tạo admin đầu tiên). Hash giữ theo username; đổi mật khẩu qua trường `setPassword` (server tự băm). `passHash` do client gửi bị bỏ qua với tài khoản đã có.
- Client: `doLogin` gọi webLogin; token lưu `ome_sess_token`/`ome_sess_exp`; phiên cũ (không có token) bị buộc đăng nhập lại 1 lần.
- `verifyLogin` (extension Pancake) giữ nguyên hình dạng trả về; salt cũ OME được nâng lên salt mới ngay ở server.

## Bước 3 — CHƯA LÀM: ghi log request không token
Thêm log (sheet hoặc Script Properties, có giới hạn dòng) cho các action đọc/ghi dữ liệu khách/đơn khi không có token hợp lệ: `customers, lookup, saveSingle, saveBatch, deleteOrder, deleteDuplicateOrders, replaceOrders, patchOrder, setOrderCareCS...`. Mục tiêu: biết extension/nơi nào còn gọi trần trước khi bắt buộc token.

## Bước 4 — CHƯA LÀM: bắt buộc token + lọc theo vai trò ở server
- Client: gắn `token` vào mọi request tới GAS (hàm `window.fetch` bọc ở `js/06-main-renew-sources.js`). Lưu ý Worker Cloudflare đang cache GET theo URL → thêm `token` vào `NO_CACHE_PARAMS` hoặc chuẩn hoá cache key bỏ `token` nhưng vẫn xác thực ở Worker.
- Extension Zalo/Pancake: cần cơ chế xác thực riêng (khoá API cho extension hoặc `verifyLogin` → token) trước khi bắt buộc.
- Role cs/leader: lọc `customers`/`lookup` ở server theo tên CS của tài khoản (hiện chỉ lọc ở `_inUserScope` phía trình duyệt).

## Việc thủ công sau mỗi lần sửa
Deploy lại GAS (dán `gas_v13.js` hoặc nút "Đồng bộ mã GAS mới nhất", rồi Deploy → New version) — nếu GAS cũ thì đăng nhập web báo "Máy chủ chưa hỗ trợ đăng nhập mới". Nên đổi mật khẩu các tài khoản yếu (hash cũ đã từng công khai) và cân nhắc để repo private.

# Kế hoạch bảo mật backend (GAS) — trạng thái & việc tiếp theo

Cập nhật 2026-10-11. Nguyên nhân gốc: trước đây `action=users` trả `passHash` cho bất kỳ ai, `saveUsers` không cần xác thực, đăng nhập so hash ngay trên trình duyệt; repo public nên URL GAS + salt ai cũng đọc được.

## Bước 1+2 — ĐÃ LÀM (gas v13.25-auth-session)
- `POST webLogin {username,password}` → server kiểm tra (giới hạn 5 lần sai/10 phút), trả `token` ký HMAC (hết hạn 7 ngày, bí mật `sessSecret` nằm trong Script Properties) + hồ sơ không có hash. Tài khoản role demo nhận thêm `demoToken`.
- `GET action=users`: KHÔNG BAO GIỜ trả `passHash`. Có `token` hợp lệ → thêm perms/saleType/startDate; không token → danh sách rút gọn (username,name,names,team,role,active) cho extension Zalo/Pancake.
- `POST saveUsers` bắt buộc token của admin đang hoạt động (trừ khi sheet Users trống = tạo admin đầu tiên). Hash giữ theo username; đổi mật khẩu qua trường `setPassword` (server tự băm). `passHash` do client gửi bị bỏ qua với tài khoản đã có.
- Client: `doLogin` gọi webLogin; token lưu `ome_sess_token`/`ome_sess_exp`; phiên cũ (không có token) bị buộc đăng nhập lại 1 lần.
- `verifyLogin` (extension Pancake) giữ nguyên hình dạng trả về; salt cũ OME được nâng lên salt mới ngay ở server.

## Bước 3 — ĐÃ LÀM (gas v13.26-auth-log-notoken): ghi log request không token, CHƯA chặn gì
- `doGet`/`doPost` gọi `_ntlNote_(method, action, token, src)` cho 39 action dữ liệu (`NTL_ACTIONS_`: customers, lookup, reminders, tasks, save*, patchOrder, deleteOrder, replaceOrders, setOrderCareCS*, broadcast*...). Tài khoản demo không đi qua log.
- Đếm theo ngày + `method action | src=… | token/NO-TOKEN` ở CacheService (TTL tối đa 6 giờ, không khoá, không ghi sheet → không làm chậm đường lưu của CS; đếm gần đúng khi nhiều request đồng thời; tối đa 200 khoá/ngày; mọi lỗi bị nuốt).
- Xem kết quả: `GET action=ntlReport&adminKey=…` hoặc chạy hàm `xemLogKhongToken` trong Apps Script Editor (xem Execution log). NO-TOKEN xếp trước.
- Nguồn gọi nhận diện qua tham số `src` (mặc định `?`). **Bước 3b — ĐÃ LÀM (2026-10-11):** web client gắn `src=web` + `token` phiên vào MỌI request tới GAS (bọc `fetch` ở `js/06-main-renew-sources.js`; POST chèn khoá bằng nối chuỗi, không parse lại body lớn); extension Zalo gắn `src=zalo` (bọc `fetch` ngay sau `let GAS_URL`), Pancake gắn `src=pancake` (bọc `self.fetch` đầu `pancake-background.js`, chỉ URL script.google.com / *.workers.dev); Worker gắn `src=worker` cho GET chưa có `src` và BỎ `token`/`src` khỏi khoá cache (cache vẫn dùng chung). Chưa chặn gì. Lưu ý: token đang nằm trên query string của GET (để GAS đọc được) — bước 4 nên chuyển các GET nhạy cảm sang POST hoặc xác thực ở Worker. Request trúng cache Worker không tới GAS nên không vào log (log đếm thiếu một phần).
**Sau 1–2 ngày:** xem `ntlReport` (hoặc chạy `xemLogKhongToken`): web phải toàn `token`; nếu còn `NO-TOKEN` với `src=web` → có đường gọi chưa đi qua `fetch` bọc (vd `<img>`/`navigator.sendBeacon`); `src=zalo`/`pancake` NO-TOKEN là bình thường tới khi xong cơ chế xác thực extension (bước 4).
Test: `node tools/test-cloudflare-worker.js`, `node tools/test-ntl.js`.

## Bước 4 — CHƯA LÀM: bắt buộc token + lọc theo vai trò ở server
- Client: gắn `token` vào mọi request tới GAS (hàm `window.fetch` bọc ở `js/06-main-renew-sources.js`). Lưu ý Worker Cloudflare đang cache GET theo URL → thêm `token` vào `NO_CACHE_PARAMS` hoặc chuẩn hoá cache key bỏ `token` nhưng vẫn xác thực ở Worker.
- Extension Zalo/Pancake: cần cơ chế xác thực riêng (khoá API cho extension hoặc `verifyLogin` → token) trước khi bắt buộc.
- Role cs/leader: lọc `customers`/`lookup` ở server theo tên CS của tài khoản (hiện chỉ lọc ở `_inUserScope` phía trình duyệt).

## Việc thủ công sau mỗi lần sửa
Deploy lại GAS (dán `gas_v13.js` hoặc nút "Đồng bộ mã GAS mới nhất", rồi Deploy → New version) — nếu GAS cũ thì đăng nhập web báo "Máy chủ chưa hỗ trợ đăng nhập mới". Nên đổi mật khẩu các tài khoản yếu (hash cũ đã từng công khai) và cân nhắc để repo private.

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

## Bước 4a — ĐÃ LÀM (gas v13.27-auth-extkey-log): khoá API riêng cho extension, CHỈ GHI LOG
- Mỗi extension 1 khoá (`zalo`, `pancake`) trong Script Properties (`extApiKeys`) — KHÔNG để trong sheet Settings, KHÔNG để trong code (repo public).
- **Lấy/đổi khoá:** chạy `xemKhoaExtension` (tự sinh nếu chưa có), `doiKhoaZalo`, `doiKhoaPancake` trong Apps Script Editor → xem Execution log. Dán khoá vào trang Cài đặt của đúng extension, ô "Khóa truy cập CRM" (lưu `chrome.storage.local['ome_ext_key']`, không đồng bộ).
- Extension gửi khoá qua tham số **`ek`** (GET) / trường **`"ek"`** (POST). Không dùng tên `key` vì `getSetting&key=` / `setSetting.key` đã dùng.
- `ntlReport` giờ có nhãn: `token` (web) | `key-zalo` / `key-pancake` (khoá đúng — tin vào KHOÁ chứ không tin `src` tự khai) | `NO-TOKEN(key-sai)` | `NO-TOKEN`; thêm `keyTotal`. Worker bỏ `ek` khỏi khoá cache.
- Test: `node tools/test-ntl.js` (case khoá), `node tools/test-cloudflare-worker.js`.

## Bước 4b — CHƯA LÀM: BẮT BUỘC (chỉ làm khi log sạch)
Điều kiện: sau khi dán khoá vào MỌI máy CS, `ntlReport` không còn `NO-TOKEN` (kể cả `key-sai`) cho `src=zalo|pancake` trong ≥2 ngày làm việc. Khi đó:
- GAS từ chối action dữ liệu nếu không có token hợp lệ HOẶC khoá extension hợp lệ; extension chỉ được dùng danh sách action cho phép (rút ra từ `ntlReport`: lookup, saveSingle, reminders, ai, priceSearch, getSetting... — KHÔNG gồm deleteOrder/replaceOrders/saveUsers/deleteDuplicateOrders… trừ khi extension thật sự gọi).
- Web: token phiên (đã gửi sẵn). Lọc `customers`/`lookup` theo vai trò cs/leader ở server.
- Token hiện nằm trên query của GET (Apps Script không đọc được header) → cân nhắc chuyển action nhạy cảm sang POST, hoặc xác thực HMAC ở Worker trước khi trả cache.
- Khoá dùng chung cả extension: lộ khoá = ai cũng gọi được các action được phép → đổi khoá bằng `doiKhoa*` rồi phát khoá mới. Nếu cần biết CS nào gọi → nâng lên khoá riêng từng CS.


## Việc thủ công sau mỗi lần sửa
Deploy lại GAS (dán `gas_v13.js` hoặc nút "Đồng bộ mã GAS mới nhất", rồi Deploy → New version) — nếu GAS cũ thì đăng nhập web báo "Máy chủ chưa hỗ trợ đăng nhập mới". Nên đổi mật khẩu các tài khoản yếu (hash cũ đã từng công khai) và cân nhắc để repo private.

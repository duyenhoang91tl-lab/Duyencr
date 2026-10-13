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

## Bước 4b — ĐÃ VIẾT CODE (gas v13.28-auth-enforce-switch), MẶC ĐỊNH TẮT
Deploy lên không đổi hành vi nào. Bật chặn bằng công tắc theo nguồn (`web`, `zalo`, `pancake`, `other` = src lạ/thiếu/worker), chạy trong Apps Script Editor (xem Execution log): `xemTrangThaiChan`, `batChanWeb`/`tatChanWeb`, `batChanZalo`/`tatChanZalo`, `batChanPancake`/`tatChanPancake`, `batChanKhac`/`tatChanKhac`. Công tắc lưu Script Properties (`enforceModes`), có hiệu lực ≤20 giây, KHÔNG cần deploy lại để bật/tắt.
- **Phạm vi:** 42 action dữ liệu trong `NTL_ACTIONS_`. Request được qua nếu (a) token phiên web hợp lệ, hoặc (b) khoá extension hợp lệ VÀ action nằm trong `EXT_ALLOWED_` của extension đó (Zalo: addCareLead, broadcastMark, customers, deleteDuplicateOrders, lookup, reminders, saveSingle, syncZaloFriendStatus; Pancake: addCareLead, customers, donOrdersByPhone, lookup, reminders, saveSingle, toggleAssignDone — rút từ code extension, `tools/test-enforce.js` tự đối chiếu), hoặc (c) công tắc của nguồn đó đang tắt.
- **Worker (đường vòng qua cache):** nếu đặt Secret `SESS_SECRET` (= kết quả hàm `xemBiMatPhien` trong GAS) thì Worker chỉ phục vụ/ghi cache cho request có token phiên hợp lệ; còn lại chuyển thẳng GAS (`x-crm-cache: BYPASS:no-valid-token`) để GAS quyết định. KHÔNG đặt `SESS_SECRET` = Worker hoạt động như cũ. Nếu bật chặn ở GAS mà quên đặt `SESS_SECRET` thì ai gọi qua Worker vẫn đọc được dữ liệu đã cache → phải đặt trước khi bật `web`.
- **Web:** token hết hạn (7 ngày) → `fetch` bọc xoá token và hiện màn hình đăng nhập.
- **Thứ tự bật gợi ý (mỗi bước theo dõi `ntlReport` + hỏi CS vài giờ; lỗi → chạy `tatChan...` tương ứng):**
  1. Điều kiện: đã dán khoá vào MỌI máy CS; log ≥2 ngày làm việc không còn `NO-TOKEN` cho `src=zalo|pancake` và `src=web`; đã đặt `SESS_SECRET` trên Worker.
  2. Thử trên 1 máy (cửa sổ ẩn danh, đăng nhập mới) rồi `batChanWeb` → tải CRM, lọc, lưu chăm sóc, tạo/xoá đơn thử.
  3. `batChanZalo`, `batChanPancake` → mở từng extension: tra khách, lưu chăm sóc, nhắc hẹn.
  4. `batChanKhac` CUỐI CÙNG — đây mới là bước chặn kẻ giả `src`; trước đó ai khai `src` của nguồn chưa bật vẫn qua được.
- **Điểm có thể gãy (kiểm tra khi thử):** request web gọi dữ liệu TRƯỚC khi đăng nhập (nếu có sẽ bị chặn và hiện lỗi); máy CS chưa dán khoá/chưa reload extension; extension gọi action chưa có trong `EXT_ALLOWED_` (báo `FORBIDDEN` kèm tên action → thêm vào `EXT_ALLOWED_`).
- Test: `node tools/test-enforce.js`, `node tools/test-ntl.js`, `node tools/test-cloudflare-worker.js`.

## Bước 4c — CHƯA LÀM (các lỗ hổng còn lại sau 4b)
- Token hợp lệ = MỌI vai trò gọi được MỌI action đã theo dõi (CS vẫn xoá đơn / ghi đè đơn được nếu gọi thẳng API). Cần gắn vai trò vào token (`r`) và bảng "action → vai trò được phép", sau khi xác nhận với client từng nút ai được dùng.
- Dữ liệu khách chưa lọc theo CS ở server: CS có token vẫn lấy được toàn bộ `customers`/`lookup` bằng cách gọi API trực tiếp (hiện chỉ lọc ở `_inUserScope` phía trình duyệt).
- Các action KHÔNG nằm trong `NTL_ACTIONS_` vẫn mở: `assign` (GET), `setSetting`/`getSetting` khoá thường, `saveCannedResponse`, `saveMessageTemplate`, `deleteMessageTemplate`, `saveAIContext`, `csStats`, `findDuplicateOrders`, `addZaloNick`... Cần rà từng cái rồi thêm vào `NTL_ACTIONS_` (+ `EXT_ALLOWED_` nếu extension dùng).
- Token nằm trên query string của GET (Apps Script không đọc được header) → lộ trong log/lịch sử; cân nhắc chuyển action nhạy cảm sang POST. Token hợp lệ chỉ kiểm HMAC, không đọc sheet nên tài khoản bị khoá vẫn dùng được token cũ tới hết hạn (≤7 ngày); đổi `sessSecret` trong Script Properties = đăng xuất toàn bộ.
- Khoá extension dùng chung cả extension: lộ khoá = ai cũng gọi được các action cho phép → `doiKhoaZalo`/`doiKhoaPancake` rồi phát khoá mới; nếu cần biết CS nào gọi → khoá riêng từng CS.

## Việc thủ công sau mỗi lần sửa
Deploy lại GAS (dán `gas_v13.js` hoặc nút "Đồng bộ mã GAS mới nhất", rồi Deploy → New version) — nếu GAS cũ thì đăng nhập web báo "Máy chủ chưa hỗ trợ đăng nhập mới". Nên đổi mật khẩu các tài khoản yếu (hash cũ đã từng công khai) và cân nhắc để repo private.

## Buoc 4c-1 - LAM (gas v13.46-owner-gate, 2026-10-13): CHI CHU SO HUU moi duoc SUA/XOA don
- Nguyen nhan goc: token hop le = moi vai tro goi duoc moi action nen CS goi thang API van xoa/sua duoc don du UI da an nut. Them `_ownerGate_` (doGet + doPost, sau `_enforceCheck_`/`_featureGate_`) chan `OWNER_ONLY_ACTIONS_` = patchOrder, deleteOrder, deleteDuplicateOrders, replaceOrders, importSheetRows, dedupeCare voi token cua nguoi KHONG phai chu so huu (tra `FORBIDDEN`).
- Chu so huu: Script Properties `ownerUsers` (mang username). Chay `datChuSoHuu("ten_dang_nhap")` (them), `xoaChuSoHuu`, `xemChuSoHuu` trong Apps Script Editor. CHUA cai -> du phong = moi tai khoan role admin (khong doi hanh vi cu, an toan khi deploy).
- Chi chan khi co token hop le; thieu/het han token do cong tac 4b xu ly. Khoa extension (`ek`) KHONG qua gate nay.
- Test: `node tools/test-roles.js` (phan 4c-1).

## Viec tiep (4c-2, 4c-3) - CHUA LAM
- [ ] **Quyet dinh can xac nhan:** extension Zalo dang goi `deleteDuplicateOrders` (zalo-content.js:1057, 1361) bang khoa `ek` va `EXT_ALLOWED_.zalo` cho phep -> CS van xoa don trung duoc qua extension. Neu muon chi Duyent xoa: bo `deleteDuplicateOrders` khoi `EXT_ALLOWED_.zalo` + an nut trong extension (can reload extension).
- [ ] 4c-2: loc `customers`/`lookup`/`donOrdersByPhone`/`reminders` THEO CS o server (CS chi nhan khach cua minh theo logic `_inUserScope` o js/08-fn-invalidatefiltercache.js: careCS, assign, hoac CS phu trach don o.cs; ai co quyen khac thi theo vai tro/bo phan). Luu y Worker cache: action nay phai khoa cache theo user (them vao `GATED_ACTIONS` o cloudflare/worker.mjs).
- [ ] 4c-3: dua cac action dang mo vao kiem soat: assign (GET), setSetting/getSetting khoa thuong, saveCannedResponse, saveMessageTemplate, deleteMessageTemplate, saveAIContext, csStats, findDuplicateOrders, addZaloNick.
- [ ] Sau khi xong: bat cong tac chan 4b theo thu tu trong "Buoc 4b" (can bat thi 4c-1 moi het ke ho khi gui khong token).

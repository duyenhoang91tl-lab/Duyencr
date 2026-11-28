# Tài khoản test (role "Tài khoản test")

Dùng cho người ngoài (IT test): xem được thông tin và tính năng nhưng **chỉ XEM**, không ghi/sửa được dữ liệu, không lấy được mã Apps Script.
Danh sách khách/đơn/lead **chỉ gồm khách của đúng (các) sale được chọn** cho tài khoản (từ 2026-11-27; trước đó là 5 dòng mỗi nguồn, không theo sale).

## Cài 1 lần
1. **Đặt khoá quản trị:** sheet `Settings` (file CRM) → dòng `adminKey` | `<chuỗi bí mật dài>`. Lấy/đồng bộ mã GAS phải nhập khoá này; chưa đặt khoá = không ai lấy được mã.
2. Trong app: 🔑 Tài khoản → tạo tài khoản, vai trò **Tài khoản test**, ô tên CS chọn **đúng (các) sale muốn cho xem**. Không chọn sale nào của người khác = không thấy khách của họ.
3. Đưa cho người test: link app + tài khoản/mật khẩu. KHÔNG thêm họ vào repo GitHub, không đưa link Google Sheet.
4. (Tuỳ chọn) muốn che 4 số cuối SĐT cả trong dữ liệu đã lọc: `Settings` thêm `demoMaskPhone` = `1`.

## Cơ chế
- Đăng nhập (`webLogin`) cấp token phiên + `demoToken`. Máy chủ **nhận ra tài khoản test từ token phiên** (vai trò đọc ở sheet Users, `_demoSessionUser_`).
- GET: chỉ action trong `DEMO_SESSION_GET_`. Action trả danh sách (`SCOPE_LIST_ACTIONS_`: customers, orders, careLeads, reminders, cskhDuyen…) được **lọc theo SĐT của các sale được chọn** (không cộng thêm tên Quầy/CSKH); tra cứu 1 SĐT ngoài phạm vi → `FORBIDDEN`; chưa chọn sale → danh sách rỗng (`_demoSessionGet_`).
- Action tổng hợp / bảng giá (không lọc theo SĐT được): cắt dòng chi tiết còn tối đa 5 dòng mỗi nguồn và che SĐT (`_demoClip_`).
- POST: máy chủ từ chối mọi thao tác ghi (kể cả khi chỉ gửi token phiên); trình duyệt chặn sớm và báo "chỉ xem" (`js/51-demo-guard.js`).
- Trình duyệt: `js/08 _inUserScope` lọc khách theo sale được chọn; `body.demo-mode` ẩn nút quản trị / Google Sheets / mã GAS; tab hiện theo phân quyền như tài khoản thường; các nút sửa chỉ dành cho admin không hiện.
- `getSetting` không trả các key `api*`, `geminiKey`, `gasSource*`, `adminKey`, `demoToken`.
- Đổi `demoToken` (xoá dòng đó trong Settings) làm khoá `demoToken` cũ hết dùng được; muốn chặn hẳn 1 người thì khoá/đổi mật khẩu tài khoản của họ.
- Test: `tools/test-demo-scope.js` (máy chủ), `tools/test-demo-scope-ui.js`, `tools/test-demo-scope-web.js` (trình duyệt).

## Giới hạn cần biết
- **Báo cáo tổng hợp (A, B, C, F, G, Pancake, KPI…) vẫn là số TOÀN CÔNG TY**, không lọc theo sale đã chọn; giao diện báo cáo (`_srIsAdmin`, js/10) còn coi tài khoản test như admin (nút ghi vẫn bị máy chủ từ chối). Báo cáo tính ở trình duyệt (E, H) chỉ tính trên dữ liệu máy chủ trả cho tài khoản test nên không đầy đủ.
- Đơn POS (`donDaily`, `donPhones`) chưa mở cho tài khoản test (chưa lọc theo SĐT được).
- Tab/tính năng mà máy chủ không phục vụ cho tài khoản test (chat, công việc, thư viện, Zalo AI…) nếu hiện ra sẽ báo không được phép.
- Người cố tình bỏ token phiên và chỉ gửi `demoToken` sẽ đi đường cũ (số cắt dòng của cả công ty, SĐT che). Request không có token nào thì xử lý như người chưa đăng nhập (tuỳ chế độ chặn xác thực, xem `docs/SECURITY-PLAN.md`).
- Cloudflare Worker cache chung `donPhones`/`staffOverview` theo token hợp lệ — cần sửa ở Worker nếu muốn kín.
- Đổi vai trò một tài khoản sang test có thể mất tới 60 giây mới bị chặn ghi (cache).

## Đăng nhập test: dọn cache + tải lại trang 1 lần (2026-10-10; việc lọc dữ liệu nay theo mục "Cơ chế" ở trên)
Lúc đang ở màn hình đăng nhập CHƯA có `demoToken`, vòng đồng bộ lúc mở trang gọi GAS không kèm token → máy chủ trả ĐẦY ĐỦ (~134k SĐT CSKH-Duyên) vào bộ nhớ trang (`allCustomers`/`customerMap`/`cskhData`) và cache máy. Trước đây đăng nhập test chỉ xoá `cskhData` nên danh sách đầy đủ vẫn hiện. Nay `_demoPurgeAndReload_` (js/14-fn-aasplit.js) xoá cache dữ liệu (localStorage `ome_care*`, `ome_cskh_duyen*`, `ome_don_*`; IndexedDB `cskh_lite_v1`, `orders_v1`) rồi reload 1 lần mỗi phiên đăng nhập (cờ sessionStorage `ome_demo_clean` = token; xoá khi đăng xuất). Sau reload token đã có sẵn trong localStorage nên mọi request đều kèm token → máy chủ cắt 5 dòng/nguồn + che SĐT.


## Hiển thị '••••' + mã hóa file tải về của tài khoản test (2026-10-15)
- Khi máy chủ có che SĐT (action tổng hợp, hoặc bật `demoMaskPhone`), nó che bằng cách đổi 4 số cuối thành `0000` (giữ đúng độ dài để `normPhone()` không làm rơi/gộp dòng). `js/51-demo-guard.js` (nạp sau `js/50`) chỉ thay đoạn `…0000` cuối đó bằng `••••` trên giao diện khi có `ome_demo_token` — không đổi dữ liệu, tài khoản thường không bị ảnh hưởng.
- Mọi file tài khoản test tải về (`a.download` blob/data, `XLSX.writeFile`) bị MÃ HÓA AES-256-GCM, đuôi `.enc` (khóa PBKDF2 từ `demoToken`). Giải mã (admin): `node tools/decrypt-demo-file.js <file.enc> <demoToken> [file_ra]`; `demoToken` ở sheet Settings. Định dạng: `DEMOENC1`(8) | salt(16) | iv(12) | ciphertext+tag.
- Giới hạn trung thực: người test giữ `demoToken` trong localStorage của trình duyệt họ nên người rành kỹ thuật vẫn tự giải mã được — nhưng nội dung file chỉ gồm dữ liệu tài khoản test được xem (khách của sale được chọn; số tổng hợp đã cắt dòng). Chưa chặn copy chữ/chụp màn hình. Chưa che tên, địa chỉ.
- Test: giữ `tools/test-dist-equivalence.js` (build nén vẫn tương đương); đã thử jsdom: che hiển thị, mã hóa↔giải mã khớp, sai token bị từ chối, không rò plaintext.

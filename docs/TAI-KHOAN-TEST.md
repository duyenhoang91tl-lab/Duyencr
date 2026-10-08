# Tài khoản test (role "Tài khoản test")

Dùng cho người ngoài (IT test): xem được các tab Báo cáo (doanh số A–G, Pancake, KPI Pancake, Checklist MKT, Báo cáo ngày),
nhưng **dòng dữ liệu chi tiết (đơn / khách / lead) chỉ thấy tối đa 5 dòng cho MỖI NGUỒN** (nguồn = cột `source`/`kenhBan` của đơn; dòng không có nguồn thì 5 dòng đầu), không ghi/sửa được gì, không thấy nút Google Sheets / mã GAS / cấu hình.

## Cài 1 lần
1. **Đặt khoá quản trị:** mở sheet `Settings` (file CRM) → thêm dòng `adminKey` | `<chuỗi bí mật dài>`.
   Từ giờ lấy/đồng bộ mã GAS (nút "Copy Apps Script Code" / "Đồng bộ mã GAS mới nhất") phải nhập khoá này (app hỏi 1 lần/máy).
   Chưa đặt khoá = không ai lấy được mã.
2. **Deploy GAS bản v13.19-demo-lock** (dán `gas_v13.js` vào Apps Script → Triển khai MỚI), rồi "Đồng bộ mã GAS mới nhất" trong modal Google Sheets.
3. Trong app: 🔑 Tài khoản → tạo tài khoản mới, vai trò **Tài khoản test**, chọn bất kỳ tên CS (chỉ để qua bước kiểm tra form).
4. Đưa cho người test: link app + tài khoản/mật khẩu. KHÔNG thêm họ vào repo GitHub, không đưa link Google Sheet.

## Cơ chế
- Đăng nhập test gọi `demoLogin` → máy chủ cấp `demoToken` (lưu ở Settings key `demoToken`, tự sinh).
- Mọi request kèm token chỉ được gọi các action xem báo cáo (danh sách `DEMO_ALLOWED_GET_` trong `gas_v13.js`);
  các mảng `orders / ordersCur / ordersPrev / ordersDetail` bị cắt còn tối đa 5 dòng mỗi nguồn (hàm `_demoClipPerSource_`; `rows` ở `careLeads`, `careLeadReport`, `cskhDuyenLite` cũng qua hàm này); mọi POST bị chặn.
- Đổi token (thu hồi mọi phiên test): xoá dòng `demoToken` trong Settings.
- `getSetting` không trả các key `api*`, `geminiKey`, `gasSource*`, `adminKey`, `demoToken`.

## Giới hạn cần biết
- Request KHÔNG có token vẫn chạy như cũ (để extension Zalo/Pancake và CS đang dùng không bị hỏng). Người cố tình bỏ token và gọi thẳng link GAS vẫn lấy được dữ liệu như hiện nay. Muốn chặn kín phải bắt mọi request có mã (cần sửa 2 extension) — làm đợt riêng.
- Action `users` vẫn trả danh sách tài khoản kèm `passHash` (CRM đăng nhập kiểm tra ở trình duyệt) — chưa đổi trong đợt này.
- Báo cáo E (hoa hồng/thưởng) và Báo cáo H tính ở trình duyệt từ danh sách đơn/khách → với tài khoản test chỉ tính trên các dòng đã cắt (5 dòng/nguồn) nên số không đầy đủ (H còn cần action `assign` chưa mở cho test). Các báo cáo tính ở máy chủ (A, B, C, D, F, G, Pancake, KPI, Checklist) vẫn đủ số tổng.
